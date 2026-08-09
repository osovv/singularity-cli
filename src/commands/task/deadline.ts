// FILE: src/commands/task/deadline.ts
// VERSION: 1.0.0
// PURPOSE: Set or clear a task deadline without touching the start date.

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";
import { resolveScheduleInput } from "../../lib/time/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const taskDeadlineCommand = defineCommand({
  meta: {
    name: "deadline",
    description: "Set a task deadline without changing its start date",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    when: {
      type: "positional",
      description: "Deadline: today, tomorrow, YYYY-MM-DD, or ISO datetime",
      required: true,
      valueHint: "when",
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const resolvedWhen = resolveScheduleInput(args.when);
      const deadlineValue = resolvedWhen.hasTime ? resolvedWhen.value : resolvedWhen.date.toISOString();
      const payload: TaskControllerUpdateMutationRequest = {
        deadline: deadlineValue,
        ...(resolvedWhen.hasTime ? { useTime: true } : {}),
      };
      const updatedTask = await taskControllerUpdate({ id: resolvedTask.id, data: payload }, { client });

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Set deadline: ${updatedTask.deadline || "-"} on task: ${updatedTask.title} (${updatedTask.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while updating the task deadline. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while updating its deadline."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});

export const taskClearDeadlineCommand = defineCommand({
  meta: {
    name: "cleardeadline",
    description: "Clear the deadline on a task without changing its start date",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const payload: TaskControllerUpdateMutationRequest = { deadline: "", deadlineNotifyReaded: false };
      const updatedTask = await taskControllerUpdate({ id: resolvedTask.id, data: payload }, { client });

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Cleared deadline on task: ${updatedTask.title} (${updatedTask.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while clearing the task deadline. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});
