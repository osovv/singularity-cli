// FILE: src/commands/project/alias/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `project alias` command group for `singu`.
//   SCOPE: Parent alias command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/project/alias/set.ts, src/commands/project/alias/list.ts, src/commands/project/alias/remove.ts
//   LINKS: M-PROJECT-ALIAS-COMMANDS, M-PROJECT-COMMANDS-READ
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectAliasCommand - Parent alias command with set, list, and remove subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added the `project alias` command group.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { projectAliasListCommand } from "./list.ts";
import { projectAliasRemoveCommand } from "./remove.ts";
import { projectAliasSetCommand } from "./set.ts";

export const projectAliasCommand = defineCommand({
  meta: {
    name: "alias",
    description: "Manage stable aliases for projects",
  },
  subCommands: {
    set: projectAliasSetCommand,
    list: projectAliasListCommand,
    remove: projectAliasRemoveCommand,
  },
});
