// FILE: src/commands/task/unrecur.ts
// VERSION: 3.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Disable CLI-side recurrence for a task via `singu task unrecur` by stripping its note marker line.
//   SCOPE: Task reference resolution, marker decoding, marker stripping with user note preservation, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/lib/recurrence-rule/index.ts, src/lib/recurrence-marker/index.ts, src/api/generated/clients/taskControllerGetById.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-RECURRENCE-COMMANDS, M-RECURRENCE-MARKER, M-RECURRENCE-RULE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskUnrecurCommand - `singu task unrecur` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v3.0.0 - Strips the marker line from the task note through the API, preserving user note text.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { decodeRecurrenceMarker, withoutMarkerLine } from "../../lib/recurrence-marker/index.ts";
import { describeRecurrenceRule } from "../../lib/recurrence-rule/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

export const taskUnrecurCommand = defineCommand({
  meta: {
    name: "unrecur",
    description: "Disable CLI-side recurrence for a task by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_UNRECUR
  async run({ args }) {
    let resolvedTaskId = args.reference;

    try {
      const authContext = await requireAuthContext();
      const resolvedReference = await resolveTaskReference(args.reference);
      resolvedTaskId = resolvedReference.id;
      const client = createAuthorizedClient(authContext.token);
      const task = await taskControllerGetById({ id: resolvedReference.id }, { client });
      const decoded = decodeRecurrenceMarker(task.note);

      if (decoded?.kind === "rule") {
        await taskControllerUpdate({ id: task.id, data: { note: withoutMarkerLine(task.note) } }, { client });

        if (resolvedReference.kind !== "raw") {
          console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
        }

        console.log(`Recurrence removed: ${task.title} (${task.id}) - was ${describeRecurrenceRule(decoded.rule)}`);
        return;
      }

      if (task.recurrenceGeneratorId) {
        console.log(`Task "${task.title}" has a server-managed recurrence. Stop it in the Singularity app.`);
        return;
      }

      console.log(`No recurrence rule found for: ${task.title} (${task.id}).`);
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
  // END_BLOCK_EXECUTE_TASK_UNRECUR
});
