// FILE: src/commands/task/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `task` command group for `singu`.
//   SCOPE: Parent task command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/task/list.ts, src/commands/task/get.ts, src/commands/task/alias/index.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-ALIAS-COMMANDS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskCommand - Parent task command with list, get, and alias subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added the task command group with read and alias subcommands.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskAliasCommand } from "./alias/index.ts";
import { taskGetCommand } from "./get.ts";
import { taskListCommand } from "./list.ts";

export const taskCommand = defineCommand({
  meta: {
    name: "task",
    description: "Inspect and reference Singularity tasks",
  },
  subCommands: {
    list: taskListCommand,
    get: taskGetCommand,
    alias: taskAliasCommand,
  },
});
