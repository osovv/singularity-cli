// FILE: src/commands/task/note.ts
// VERSION: 2.0.0
// PURPOSE: Read or update a task note while preserving the CLI recurrence marker line.
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Note reads hide the recurrence marker line and note writes preserve it, because recurrence rules ride in task notes.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { markerLineOf, withMarkerLine, withoutMarkerLine } from "../../lib/recurrence-marker/index.ts";
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
        console.log(withoutMarkerLine(task.note) || "(empty note)");
        return;
      }

      const current = await taskControllerGetById({ id: resolvedTask.id }, { client });
      const markerLine = markerLineOf(current.note);
      const nextNote = markerLine !== undefined ? withMarkerLine(args.text, markerLine) : args.text;
      const payload: TaskControllerUpdateMutationRequest = { note: nextNote };
      const updatedTask = await taskControllerUpdate({ id: resolvedTask.id, data: payload }, { client });

      console.log(`Updated note for task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(withoutMarkerLine(updatedTask.note) || "(empty note)");
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
