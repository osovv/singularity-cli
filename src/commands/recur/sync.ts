// FILE: src/commands/recur/sync.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Reconcile CLI-side recurrence chains across all tasks via `singu recur sync`.
//   SCOPE: Legacy recurrence.json migration, paginated task scan, pure classification, per-chain action execution with failure isolation, and summary output.
//   DEPENDS: citty, node:fs/promises, node:path, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/storage/index.ts, src/lib/recurrence-marker/index.ts, src/lib/recurrence-rule/index.ts, src/lib/recurrence-sync/index.ts, src/lib/recurrence-sync/spawn.ts, src/api/generated/clients/taskControllerList.ts, src/api/generated/clients/taskControllerGetById.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-MARKER, M-RECURRENCE-RULE, M-STORAGE-PATHS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   recurSyncCommand - `singu recur sync` command definition.
//   loadLegacyRecurrenceStore - Read the pre-marker recurrence.json registry when present.
//   fetchAllTasks - Page through GET /v2/task until the listing is exhausted.
//   applySyncAction - Execute one planned convergence action through the API.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added recurrence reconciliation command with legacy registry migration and idempotent convergence.]
// END_CHANGE_SUMMARY

import { readFile, rename } from "node:fs/promises";
import { join } from "node:path";

import { defineCommand } from "citty";

import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerList } from "../../api/generated/clients/taskControllerList.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import type { TaskResponseDto } from "../../api/generated/models/TaskResponseDto.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { decodeRecurrenceMarker, encodeRecurrenceMarker, isForeignExternalId } from "../../lib/recurrence-marker/index.ts";
import type { RecurrenceRule } from "../../lib/recurrence-rule/index.ts";
import { planRecurrenceSync, resolveCatchUpAnchor, type RecurrenceSyncAction } from "../../lib/recurrence-sync/index.ts";
import { clearRecurrenceMarker, finishChainSummary, spawnNextOccurrence, type RecurrenceSpawnClient } from "../../lib/recurrence-sync/spawn.ts";
import { resolveStoragePaths } from "../../lib/storage/index.ts";

const LEGACY_FILE_NAME = "recurrence.json";
const LEGACY_MIGRATED_SUFFIX = ".migrated";
const PAGE_SIZE = 200;

type LegacyRecurrenceRule = {
  every: RecurrenceRule["every"];
  interval: number;
  at?: string;
  count?: number;
  seedTaskId: string;
  history: string[];
};

type LegacyStore = {
  rules: Record<string, LegacyRecurrenceRule>;
};

// START_CONTRACT: loadLegacyRecurrenceStore
//   PURPOSE: Read the pre-marker local recurrence registry when it still exists.
//   INPUTS: { none - Reads from the resolved CLI config directory. }
//   OUTPUTS: { Promise<{ path: string; rules: Record<string, LegacyRecurrenceRule> } | null> - Registry path and rules, or null when absent. }
//   SIDE_EFFECTS: Reads the legacy registry file from disk.
//   LINKS: M-RECURRENCE-SYNC, M-STORAGE-PATHS
// END_CONTRACT: loadLegacyRecurrenceStore
export async function loadLegacyRecurrenceStore(): Promise<{ path: string; rules: Record<string, LegacyRecurrenceRule> } | null> {
  const configDirPath = resolveStoragePaths({}).configDirPath;
  const legacyPath = join(configDirPath, LEGACY_FILE_NAME);

  try {
    const contents = await readFile(legacyPath, "utf8");
    const parsed = JSON.parse(contents) as LegacyStore;
    const rules = parsed && typeof parsed === "object" && typeof parsed.rules === "object" && parsed.rules !== null ? parsed.rules : {};

    return { path: legacyPath, rules };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

// START_CONTRACT: fetchAllTasks
//   PURPOSE: Page through GET /v2/task until the listing is exhausted.
//   INPUTS: { client: RecurrenceSpawnClient - Authorized API client. }
//   OUTPUTS: { Promise<TaskResponseDto[]> - Every non-removed task visible to the account. }
//   SIDE_EFFECTS: Reads tasks through authenticated API calls.
//   LINKS: M-RECURRENCE-SYNC, M-HTTP-RUNTIME
// END_CONTRACT: fetchAllTasks
export async function fetchAllTasks(client: RecurrenceSpawnClient): Promise<TaskResponseDto[]> {
  const tasks: TaskResponseDto[] = [];
  let offset = 0;

  for (;;) {
    const page = await taskControllerList({ params: { maxCount: PAGE_SIZE, offset } }, { client });
    tasks.push(...page.tasks);
    offset += page.tasks.length;

    if (page.tasks.length < PAGE_SIZE) {
      return tasks;
    }
  }
}

// START_CONTRACT: applySyncAction
//   PURPOSE: Execute one planned convergence action through the API.
//   INPUTS: { action: RecurrenceSyncAction - Planned action. tasksById: Map<string, TaskResponseDto> - Listing index for carrier lookups. client: RecurrenceSpawnClient - Authorized API client. }
//   OUTPUTS: { Promise<string> - User-facing outcome line. }
//   SIDE_EFFECTS: Creates next carriers, clears markers, or reports duplicates through the API.
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-MARKER
// END_CONTRACT: applySyncAction
export async function applySyncAction(
  action: RecurrenceSyncAction,
  tasksById: Map<string, TaskResponseDto>,
  client: RecurrenceSpawnClient,
): Promise<string> {
  if (action.kind === "clear-stale") {
    await clearRecurrenceMarker(action.taskId, client);
    return `Cleared stale marker on ${action.taskId}.`;
  }

  if (action.kind === "finish") {
    await clearRecurrenceMarker(action.taskId, client);
    return finishChainSummary(action.rule);
  }

  if (action.kind === "duplicate-tails") {
    return `Warning: duplicate recurrence tails for seed ${action.rule.seed}: ${action.taskIds.join(", ")}. Run \`singu task unrecur\` on all but one.`;
  }

  const carrier = tasksById.get(action.carrierId);

  if (!carrier) {
    return `Skipped catch-up for ${action.carrierId}: task not found in listing.`;
  }

  const anchor = resolveCatchUpAnchor({ start: carrier.start, completeLast: carrier.completeLast }, new Date());
  const spawned = await spawnNextOccurrence({
    carrier: {
      id: carrier.id,
      title: carrier.title,
      start: anchor.toISOString(),
      ...(carrier.projectId ? { projectId: carrier.projectId } : {}),
      ...(carrier.priority !== undefined ? { priority: carrier.priority } : {}),
    },
    rule: action.rule,
    client,
  });

  return `Caught up chain ${action.rule.seed}: created ${spawned.task.title} (${spawned.task.id}) at ${spawned.task.start}.`;
}

async function migrateLegacyRules(
  legacy: { path: string; rules: Record<string, LegacyRecurrenceRule> },
  client: RecurrenceSpawnClient,
): Promise<{ migrated: number; failures: string[] }> {
  const failures: string[] = [];
  let migrated = 0;

  for (const [carrierId, legacyRule] of Object.entries(legacy.rules)) {
    try {
      const task = await taskControllerGetById({ id: carrierId }, { client });

      if (isForeignExternalId(task.externalId)) {
        failures.push(`${carrierId}: task carries a foreign externalId.`);
        continue;
      }

      const decoded = decodeRecurrenceMarker(task.externalId);
      const rule: RecurrenceRule = decoded?.kind === "rule"
        ? decoded.rule
        : {
            every: legacyRule.every,
            interval: legacyRule.interval,
            ...(legacyRule.at !== undefined ? { at: legacyRule.at } : {}),
            ...(legacyRule.count !== undefined ? { count: legacyRule.count } : {}),
            seed: legacyRule.seedTaskId,
            done: legacyRule.history.length,
          };

      await taskControllerUpdate({ id: carrierId, data: { externalId: encodeRecurrenceMarker(rule) } }, { client });
      migrated += 1;
    } catch (error) {
      const reason = isApiClientError(error) && error.status === 404 ? "task not found" : error instanceof Error ? error.message : String(error);
      failures.push(`${carrierId}: ${reason}`);
    }
  }

  return { migrated, failures };
}

export const recurSyncCommand = defineCommand({
  meta: {
    name: "sync",
    description: "Reconcile CLI-side recurrence chains: catch up, clean stale markers, migrate the legacy registry",
  },
  args: {},
  // START_BLOCK_EXECUTE_RECUR_SYNC
  async run() {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);

      // START_BLOCK_SYNC_MAIN_FLOW
      const legacy = await loadLegacyRecurrenceStore();

      if (legacy && Object.keys(legacy.rules).length > 0) {
        console.log(`Found legacy recurrence registry with ${Object.keys(legacy.rules).length} rule(s): ${legacy.path}`);
        const migration = await migrateLegacyRules(legacy, client);

        for (const failure of migration.failures) {
          console.log(`Migration skipped ${failure}`);
        }

        console.log(`Migrated ${migration.migrated} legacy rule(s) onto carrier markers.`);

        if (migration.failures.length === 0) {
          await rename(legacy.path, legacy.path + LEGACY_MIGRATED_SUFFIX);
          console.log(`Renamed legacy registry to ${LEGACY_FILE_NAME}${LEGACY_MIGRATED_SUFFIX}.`);
        }
      }

      const tasks = await fetchAllTasks(client);
      const tasksById = new Map(tasks.map((task) => [task.id, task]));
      const plan = planRecurrenceSync(tasks.map((task) => ({ id: task.id, checked: task.checked, externalId: task.externalId })));

      for (const warning of plan.warnings) {
        console.log(`Warning: ${warning}`);
      }

      let applied = 0;

      for (const action of plan.actions) {
        try {
          const line = await applySyncAction(action, tasksById, client);
          console.log(line);
          applied += 1;
        } catch (error) {
          console.error(`Recurrence sync: action ${action.kind} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (plan.actions.length === 0 && plan.warnings.length === 0) {
        console.log("Recurrence sync: no chains need attention.");
      } else {
        console.log(`Recurrence sync: ${applied}/${plan.actions.length} action(s) applied over ${tasks.length} task(s).`);
      }
      // END_BLOCK_SYNC_MAIN_FLOW
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        console.error("Authentication failed while syncing recurrence. Run `singu auth status --check` or `singu auth login`.");
        process.exitCode = 1;
        return;
      }

      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
  // END_BLOCK_EXECUTE_RECUR_SYNC
});
