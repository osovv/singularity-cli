// FILE: src/commands/task/someday.ts
// VERSION: 1.0.0
// PURPOSE: Mark a task as deferred (Someday representation) or clear the deferred flag.

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createTaskSomedayPayload(deferred: boolean): TaskControllerUpdateMutationRequest {
  return { deferred };
}

export const taskSomedayCommand = defineCommand({
  meta: {
    name: "someday",
    description: "Mark a task as deferred (Someday)",
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
      const updatedTask = await taskControllerUpdate(
        { id: resolvedTask.id, data: createTaskSomedayPayload(true) },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Marked task as Someday: ${updatedTask.title} (${updatedTask.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while updating the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});

export const taskUnSomedayCommand = defineCommand({
  meta: {
    name: "unsomeday",
    description: "Clear the deferred (Someday) flag on a task",
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
      const updatedTask = await taskControllerUpdate(
        { id: resolvedTask.id, data: createTaskSomedayPayload(false) },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Cleared Someday flag on task: ${updatedTask.title} (${updatedTask.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while updating the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});
