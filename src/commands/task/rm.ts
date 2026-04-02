// FILE: src/commands/task/rm.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Delete a task through a raw id, SID, or alias reference.
//   SCOPE: Task reference resolution, authenticated delete request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/api/generated/clients/taskControllerDelete.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-TASK-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskRemoveCommand - `singu task rm` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task rm` for deleting tasks by reference.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerDelete } from "../../api/generated/clients/taskControllerDelete.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const taskRemoveCommand = defineCommand({
  meta: {
    name: "rm",
    description: "Delete a task by raw id, short id, or alias",
    alias: ["remove", "delete"],
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_REMOVE
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);

      await taskControllerDelete({ id: resolvedTask.id }, { client });

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Removed task: ${resolvedTask.id}`);
      console.log("Run `singu task list` to refresh short IDs.");
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while removing the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while removing it."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to remove the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_REMOVE
});
