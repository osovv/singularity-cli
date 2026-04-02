// FILE: src/commands/task/do.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Mark a task as done through a raw id, SID, or alias reference.
//   SCOPE: CLI argument parsing and shared checked-state transition invocation for `checked = 1`.
//   DEPENDS: citty, src/commands/task/check.ts
//   LINKS: M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskDoCommand - `singu task do` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task do` for marking a task done.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { runTaskCheckedCommand } from "./check.ts";

export const taskDoCommand = defineCommand({
  meta: {
    name: "do",
    description: "Mark a task as done by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_DO
  async run({ args }) {
    await runTaskCheckedCommand({
      reference: args.reference,
      targetChecked: 1,
      completionMessage: "Marked task done",
      alreadyMessage: "Task is already done",
    });
  },
  // END_BLOCK_EXECUTE_TASK_DO
});
