// FILE: src/commands/task/unschedule.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Clear task scheduling fields from a raw id, SID, or alias reference.
//   SCOPE: Task reference resolution, minimal unschedule payload creation, authenticated update request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-TASK-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   createTaskUnschedulePayload - Build the minimal payload for clearing task scheduling fields.
//   taskUnscheduleCommand - `singu task unschedule` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task unschedule` for clearing task scheduling metadata.]
// END_CHANGE_SUMMARY

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

// START_CONTRACT: createTaskUnschedulePayload
//   PURPOSE: Build the minimal payload required to clear task scheduling fields.
//   INPUTS: { none }
//   OUTPUTS: { TaskControllerUpdateMutationRequest - Minimal unschedule payload. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-WRITE-COMMANDS
// END_CONTRACT: createTaskUnschedulePayload
export function createTaskUnschedulePayload(): TaskControllerUpdateMutationRequest {
  return {
    start: "",
    deadline: "",
    useTime: false,
    timeLength: 0,
  };
}

export const taskUnscheduleCommand = defineCommand({
  meta: {
    name: "unschedule",
    description: "Clear start and deadline values for a task",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_UNSCHEDULE
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const updatedTask = await taskControllerUpdate(
        {
          id: resolvedTask.id,
          data: createTaskUnschedulePayload(),
        },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Unscheduled task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(`Start: ${updatedTask.start || "-"}`);
      console.log(`Deadline: ${updatedTask.deadline || "-"}`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while unscheduling the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while unscheduling it."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to unschedule the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_UNSCHEDULE
});
