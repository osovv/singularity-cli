// FILE: src/commands/task/undo.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Reopen a task through a raw id, SID, or alias reference.
//   SCOPE: CLI argument parsing and shared checked-state transition invocation for `checked = 0`.
//   DEPENDS: citty, src/commands/task/check.ts
//   LINKS: M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskUndoCommand - `singu task undo` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task undo` for reopening a task.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { runTaskCheckedCommand } from "./check.ts";

export const taskUndoCommand = defineCommand({
  meta: {
    name: "undo",
    description: "Reopen a task by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_UNDO
  async run({ args }) {
    await runTaskCheckedCommand({
      reference: args.reference,
      targetChecked: 0,
      completionMessage: "Reopened task",
      alreadyMessage: "Task is already open",
    });
  },
  // END_BLOCK_EXECUTE_TASK_UNDO
});
