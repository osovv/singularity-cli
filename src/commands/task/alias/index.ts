// FILE: src/commands/task/alias/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `task alias` command group for `singu`.
//   SCOPE: Parent alias command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/task/alias/set.ts, src/commands/task/alias/list.ts, src/commands/task/alias/remove.ts
//   LINKS: M-TASK-ALIAS-COMMANDS, M-TASK-COMMANDS-READ
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskAliasCommand - Parent alias command with set, list, and remove subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added the `task alias` command group.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskAliasListCommand } from "./list.ts";
import { taskAliasRemoveCommand } from "./remove.ts";
import { taskAliasSetCommand } from "./set.ts";

export const taskAliasCommand = defineCommand({
  meta: {
    name: "alias",
    description: "Manage stable aliases for tasks",
  },
  subCommands: {
    set: taskAliasSetCommand,
    list: taskAliasListCommand,
    remove: taskAliasRemoveCommand,
  },
});
