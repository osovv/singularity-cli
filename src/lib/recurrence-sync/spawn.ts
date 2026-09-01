// FILE: src/lib/recurrence-sync/spawn.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: API-driven recurrence spawn engine shared by `task do` and `singu recur sync`.
//   SCOPE: Next-carrier creation with an embedded incremented marker, carrier marker clearing, and finished-chain summaries.
//   DEPENDS: src/lib/http/index.ts, src/lib/recurrence-rule/index.ts, src/lib/recurrence-marker/index.ts, src/api/generated/clients/taskControllerCreate.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-MARKER, M-RECURRENCE-RULE, M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RecurrenceSpawnCarrier - Carrier task fields consumed by the spawn engine.
//   spawnNextOccurrence - Create the next carrier with an incremented marker and clear the old marker.
//   clearRecurrenceMarker - Clear the marker on a task through the API.
//   finishChainSummary - Render the user-facing summary line for a finished chain.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added shared spawn engine so recurrence chains advance identically from task do and recur sync.]
// END_CHANGE_SUMMARY

import { taskControllerCreate } from "../../api/generated/clients/taskControllerCreate.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { createAuthorizedClient } from "../http/index.ts";
import { encodeRecurrenceMarker } from "../recurrence-marker/index.ts";
import { describeRecurrenceRule, nextOccurrenceDate, type RecurrenceRule } from "../recurrence-rule/index.ts";

export type RecurrenceSpawnClient = ReturnType<typeof createAuthorizedClient>;

export type RecurrenceSpawnCarrier = {
  id: string;
  title: string;
  start?: string;
  projectId?: string;
  priority?: number;
};

// START_CONTRACT: spawnNextOccurrence
//   PURPOSE: Create the next carrier task with an embedded incremented marker, then clear the marker on the completed carrier.
//   INPUTS: { options.carrier: RecurrenceSpawnCarrier - Completed carrier. options.rule: RecurrenceRule - Rule carried by it. options.client: RecurrenceSpawnClient - Authorized API client. }
//   OUTPUTS: { Promise<{ task: { id, title, start }, rule: RecurrenceRule }> - Created next carrier and the rule it now carries (done + 1). }
//   SIDE_EFFECTS: Creates the next task and clears the completed carrier marker through the API.
//   LINKS: M-RECURRENCE-SYNC, M-TASK-ACTION-COMMANDS, M-RECURRENCE-COMMANDS
// END_CONTRACT: spawnNextOccurrence
export async function spawnNextOccurrence(options: {
  carrier: RecurrenceSpawnCarrier;
  rule: RecurrenceRule;
  client: RecurrenceSpawnClient;
}): Promise<{ task: { id: string; title: string; start: string }; rule: RecurrenceRule }> {
  const anchor = options.carrier.start ? new Date(options.carrier.start) : new Date();
  const nextStart = nextOccurrenceDate(options.rule, anchor).toISOString();
  const nextRule: RecurrenceRule = { ...options.rule, done: options.rule.done + 1 };

  const nextTask = await taskControllerCreate(
    {
      data: {
        title: options.carrier.title,
        start: nextStart,
        externalId: encodeRecurrenceMarker(nextRule),
        ...(options.carrier.projectId ? { projectId: options.carrier.projectId } : {}),
        ...(options.carrier.priority !== undefined ? { priority: options.carrier.priority as 0 | 1 | 2 } : {}),
        ...(options.rule.at ? { useTime: true } : {}),
      },
    },
    { client: options.client },
  );

  await clearRecurrenceMarker(options.carrier.id, options.client);

  return { task: { id: nextTask.id, title: nextTask.title, start: nextStart }, rule: nextRule };
}

// START_CONTRACT: clearRecurrenceMarker
//   PURPOSE: Clear the recurrence marker on a task through the API.
//   INPUTS: { taskId: string - Task whose marker should be cleared. client: RecurrenceSpawnClient - Authorized API client. }
//   OUTPUTS: { Promise<void> }
//   SIDE_EFFECTS: Patches the task externalId to an empty string.
//   LINKS: M-RECURRENCE-SYNC, M-TASK-ACTION-COMMANDS
// END_CONTRACT: clearRecurrenceMarker
export async function clearRecurrenceMarker(taskId: string, client: RecurrenceSpawnClient): Promise<void> {
  await taskControllerUpdate({ id: taskId, data: { externalId: "" } }, { client });
}

// START_CONTRACT: finishChainSummary
//   PURPOSE: Render the user-facing summary line for a chain that reached its count quota.
//   INPUTS: { rule: RecurrenceRule - Rule that reached its quota. }
//   OUTPUTS: { string - Summary line like "Recurrence finished: 3/3 occurrences created." }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-SYNC, M-TASK-ACTION-COMMANDS
// END_CONTRACT: finishChainSummary
export function finishChainSummary(rule: RecurrenceRule): string {
  return `Recurrence finished: ${describeRecurrenceRule(rule)} - ${rule.done}/${rule.count} occurrences created.`;
}
