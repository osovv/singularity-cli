// FILE: src/commands/task/note.ts
// VERSION: 1.0.0
// PURPOSE: Read or update a task note.

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const taskNoteCommand = defineCommand({
  meta: {
    name: "note",
    description: "Read or update a task note",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    text: {
      type: "positional",
      description: "New note text (omit to read the current note)",
      required: false,
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);

      if (args.text === undefined) {
        const task = await taskControllerGetById({ id: resolvedTask.id }, { client });
        console.log(task.note || "(empty note)");
        return;
      }

      const payload: TaskControllerUpdateMutationRequest = { note: args.text };
      const updatedTask = await taskControllerUpdate({ id: resolvedTask.id, data: payload }, { client });

      console.log(`Updated note for task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(updatedTask.note || "(empty note)");
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while updating the task note. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while updating its note."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});
