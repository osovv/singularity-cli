// FILE: src/commands/task/edit.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Rename a task through a raw id, SID, or alias reference.
//   SCOPE: Task reference resolution, title validation, authenticated update request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-TASK-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   createTaskEditPayload - Build the minimal title update payload.
//   taskEditCommand - `singu task edit` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task edit` for task title updates.]
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

// START_CONTRACT: createTaskEditPayload
//   PURPOSE: Build the minimal title update payload for a task edit operation.
//   INPUTS: { title: string - New task title. }
//   OUTPUTS: { TaskControllerUpdateMutationRequest - Minimal title update payload. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-WRITE-COMMANDS
// END_CONTRACT: createTaskEditPayload
export function createTaskEditPayload(title: string): TaskControllerUpdateMutationRequest {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("Task title is empty.");
  }

  return {
    title: normalizedTitle,
  };
}

export const taskEditCommand = defineCommand({
  meta: {
    name: "edit",
    description: "Rename a task by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    title: {
      type: "string",
      description: "New task title",
      required: true,
      valueHint: "title",
    },
  },
  // START_BLOCK_EXECUTE_TASK_EDIT
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const updatedTask = await taskControllerUpdate(
        {
          id: resolvedTask.id,
          data: createTaskEditPayload(args.title),
        },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Renamed task: ${updatedTask.title} (${updatedTask.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while editing the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while editing it."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to edit the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_EDIT
});
