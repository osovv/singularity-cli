// FILE: src/commands/task/unrecur.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Disable CLI-side recurrence for a task via `singu task unrecur`.
//   SCOPE: Task reference resolution, registry removal, and user-facing output.
//   DEPENDS: citty, src/lib/task-ref-resolver/index.ts, src/lib/recurrence-store/index.ts
//   LINKS: M-RECURRENCE-COMMANDS, M-RECURRENCE-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskUnrecurCommand - `singu task unrecur` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task unrecur` for disabling CLI-side recurring tasks.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { removeRecurrenceRule } from "../../lib/recurrence-store/index.ts";
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
    try {
      const resolvedReference = await resolveTaskReference(args.reference);

      if (resolvedReference.kind !== "raw") {
        console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
      }

      const removed = await removeRecurrenceRule(resolvedReference.id);

      if (removed) {
        console.log(`Recurrence removed for task ${resolvedReference.id}.`);
      } else {
        console.log(`No recurrence rule found for task ${resolvedReference.id}.`);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  },
  // END_BLOCK_EXECUTE_TASK_UNRECUR
});
