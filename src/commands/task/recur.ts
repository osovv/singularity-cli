// FILE: src/commands/task/recur.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Enable CLI-side recurrence for a task via `singu task recur`.
//   SCOPE: Rule option parsing and validation, task reference resolution, registry upsert, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/lib/recurrence-rule/index.ts, src/lib/recurrence-store/index.ts, src/api/generated/clients/taskControllerGetById.ts
//   LINKS: M-RECURRENCE-COMMANDS, M-RECURRENCE-STORE, M-RECURRENCE-RULE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskRecurCommand - `singu task recur` command definition.
//   createRecurrenceRuleOptions - Validate raw CLI inputs into a RecurrenceRule.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task recur` for enabling CLI-side recurring tasks.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { describeRecurrenceRule, type RecurrenceEvery, type RecurrenceRule } from "../../lib/recurrence-rule/index.ts";
import { upsertRecurrenceRule } from "../../lib/recurrence-store/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

const EVERY_VALUES: RecurrenceEvery[] = ["day", "week", "month"];
const AT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function createRecurrenceRuleOptions(input: {
  every: string;
  interval: string | number | undefined;
  at: string | undefined;
  count: string | number | undefined;
  seedTaskId: string;
}): RecurrenceRule {
  if (!EVERY_VALUES.includes(input.every as RecurrenceEvery)) {
    throw new Error(`--every must be one of: ${EVERY_VALUES.join(", ")}.`);
  }

  const interval = input.interval === undefined ? 1 : Number(input.interval);

  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("--interval must be a positive integer.");
  }

  if (input.at !== undefined && !AT_PATTERN.test(input.at)) {
    throw new Error("--at must be in HH:MM 24-hour format.");
  }

  const count = input.count === undefined ? undefined : Number(input.count);

  if (count !== undefined && (!Number.isInteger(count) || count < 1)) {
    throw new Error("--count must be a positive integer.");
  }

  return {
    every: input.every as RecurrenceEvery,
    interval,
    ...(input.at ? { at: input.at } : {}),
    ...(count !== undefined ? { count } : {}),
    seedTaskId: input.seedTaskId,
    history: [],
  };
}

export const taskRecurCommand = defineCommand({
  meta: {
    name: "recur",
    description: "Enable CLI-side recurrence for a task by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    every: {
      type: "string",
      description: "Recurrence period: day, week, or month",
      required: true,
    },
    interval: {
      type: "string",
      description: "Interval in periods (default 1)",
    },
    at: {
      type: "string",
      description: "Optional time of day in HH:MM",
    },
    count: {
      type: "string",
      description: "Optional total number of occurrences",
    },
  },
  // START_BLOCK_EXECUTE_TASK_RECUR
  async run({ args }) {
    let resolvedTaskId = args.reference;

    try {
      const authContext = await requireAuthContext();
      const resolvedReference = await resolveTaskReference(args.reference);
      resolvedTaskId = resolvedReference.id;
      const client = createAuthorizedClient(authContext.token);
      const task = await taskControllerGetById({ id: resolvedReference.id }, { client });
      const rule = createRecurrenceRuleOptions({
        every: args.every,
        ...(args.interval !== undefined ? { interval: args.interval } : {}),
        ...(args.at !== undefined ? { at: args.at } : {}),
        ...(args.count !== undefined ? { count: args.count } : {}),
        seedTaskId: task.id,
      });

      await upsertRecurrenceRule(task.id, rule);

      if (resolvedReference.kind !== "raw") {
        console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
      }

      console.log(`Recurrence enabled: ${task.title} (${task.id})`);
      console.log(`Rule: ${describeRecurrenceRule(rule)}`);
      console.log("The next occurrence is created automatically when this task is marked done.");
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        console.error("Authentication failed while reading the task. Run `singu auth status --check` or `singu auth login`.");
        process.exitCode = 1;
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        console.error(`Task "${resolvedTaskId}" was not found.`);
        process.exitCode = 1;
        return;
      }

      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
  // END_BLOCK_EXECUTE_TASK_RECUR
});
