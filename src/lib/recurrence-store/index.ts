// FILE: src/lib/recurrence-store/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist the local registry of CLI-side recurrence rules keyed by the active carrier task id.
//   SCOPE: Registry file resolution, atomic reads and writes, rule upsert, lookup, chain move on completion, and removal.
//   DEPENDS: node:fs/promises, node:path, src/lib/storage/index.ts, src/lib/recurrence-rule/index.ts
//   LINKS: M-RECURRENCE-STORE, M-STORAGE-PATHS, M-RECURRENCE-RULE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RECURRENCE_FILE_NAME - Registry filename inside the CLI config directory.
//   RecurrenceStoreFile - On-disk registry shape.
//   loadRecurrenceStore - Read the registry, returning an empty registry when missing.
//   saveRecurrenceStore - Persist the registry atomically with secure permissions.
//   getRecurrenceRule - Look up the rule carried by a task id.
//   upsertRecurrenceRule - Save a rule under a task id and retire any older carrier of the same seed.
//   moveRecurrenceRule - Move a rule to the next carrier task id and record it in history.
//   removeRecurrenceRule - Remove the rule carried by a task id.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added local recurrence rule registry for CLI-side recurring tasks.]
// END_CHANGE_SUMMARY

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { RecurrenceRule } from "../recurrence-rule/index.ts";
import { resolveStoragePaths, writeJsonFileAtomic, type StorageRuntime } from "../storage/index.ts";

export const RECURRENCE_FILE_NAME = "recurrence.json";

export type RecurrenceStoreFile = {
  rules: Record<string, RecurrenceRule>;
};

function resolveRecurrenceFilePath(runtime: StorageRuntime): string {
  return join(resolveStoragePaths(runtime).configDirPath, RECURRENCE_FILE_NAME);
}

// START_CONTRACT: loadRecurrenceStore
//   PURPOSE: Read the recurrence registry, returning an empty registry when the file is absent.
//   INPUTS: { runtime: StorageRuntime | undefined - Storage overrides for tests. }
//   OUTPUTS: { Promise<RecurrenceStoreFile> - Parsed registry. }
//   SIDE_EFFECTS: Reads the local registry file from disk.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: loadRecurrenceStore
export async function loadRecurrenceStore(runtime: StorageRuntime = {}): Promise<RecurrenceStoreFile> {
  try {
    const contents = await readFile(resolveRecurrenceFilePath(runtime), "utf8");
    const parsed = JSON.parse(contents) as RecurrenceStoreFile;

    if (!parsed || typeof parsed !== "object" || typeof parsed.rules !== "object" || parsed.rules === null) {
      return { rules: {} };
    }

    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { rules: {} };
    }

    throw error;
  }
}

// START_CONTRACT: saveRecurrenceStore
//   PURPOSE: Persist the recurrence registry atomically with secure permissions.
//   INPUTS: { store: RecurrenceStoreFile - Registry to persist. runtime: StorageRuntime | undefined. }
//   OUTPUTS: { Promise<string> - Registry file path. }
//   SIDE_EFFECTS: Writes the local registry file to disk.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: saveRecurrenceStore
export async function saveRecurrenceStore(store: RecurrenceStoreFile, runtime: StorageRuntime = {}): Promise<string> {
  return writeJsonFileAtomic(resolveRecurrenceFilePath(runtime), store, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });
}

// START_CONTRACT: getRecurrenceRule
//   PURPOSE: Look up the rule currently carried by a task id.
//   INPUTS: { taskId: string - Carrier task id. runtime: StorageRuntime | undefined. }
//   OUTPUTS: { Promise<RecurrenceRule | undefined> - Rule when present. }
//   SIDE_EFFECTS: Reads the local registry file from disk.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: getRecurrenceRule
export async function getRecurrenceRule(taskId: string, runtime: StorageRuntime = {}): Promise<RecurrenceRule | undefined> {
  const store = await loadRecurrenceStore(runtime);
  return store.rules[taskId];
}

// START_CONTRACT: upsertRecurrenceRule
//   PURPOSE: Save a rule under a task id, retiring any older carrier of the same seed task.
//   INPUTS: { taskId: string - Carrier task id. rule: RecurrenceRule - Rule to save. runtime: StorageRuntime | undefined. }
//   OUTPUTS: { Promise<void> }
//   SIDE_EFFECTS: Reads and writes the local registry file.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: upsertRecurrenceRule
export async function upsertRecurrenceRule(taskId: string, rule: RecurrenceRule, runtime: StorageRuntime = {}): Promise<void> {
  const store = await loadRecurrenceStore(runtime);

  for (const key of Object.keys(store.rules)) {
    if (key !== taskId && store.rules[key].seedTaskId === rule.seedTaskId) {
      delete store.rules[key];
    }
  }

  store.rules[taskId] = rule;
  await saveRecurrenceStore(store, runtime);
}

// START_CONTRACT: moveRecurrenceRule
//   PURPOSE: Move a rule to the next carrier task id and append it to the rule history.
//   INPUTS: { fromTaskId: string - Completed carrier. toTaskId: string - Newly created carrier. runtime: StorageRuntime | undefined. }
//   OUTPUTS: { Promise<RecurrenceRule | null> - Moved rule or null when none was carried. }
//   SIDE_EFFECTS: Reads and writes the local registry file.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: moveRecurrenceRule
export async function moveRecurrenceRule(fromTaskId: string, toTaskId: string, runtime: StorageRuntime = {}): Promise<RecurrenceRule | null> {
  const store = await loadRecurrenceStore(runtime);
  const rule = store.rules[fromTaskId];

  if (!rule) {
    return null;
  }

  delete store.rules[fromTaskId];
  rule.history = [...rule.history, toTaskId];
  store.rules[toTaskId] = rule;
  await saveRecurrenceStore(store, runtime);
  return rule;
}

// START_CONTRACT: removeRecurrenceRule
//   PURPOSE: Remove the rule carried by a task id.
//   INPUTS: { taskId: string - Carrier task id. runtime: StorageRuntime | undefined. }
//   OUTPUTS: { Promise<boolean> - True when a rule was removed. }
//   SIDE_EFFECTS: Reads and writes the local registry file.
//   LINKS: M-RECURRENCE-STORE
// END_CONTRACT: removeRecurrenceRule
export async function removeRecurrenceRule(taskId: string, runtime: StorageRuntime = {}): Promise<boolean> {
  const store = await loadRecurrenceStore(runtime);

  if (!(taskId in store.rules)) {
    return false;
  }

  delete store.rules[taskId];
  await saveRecurrenceStore(store, runtime);
  return true;
}
