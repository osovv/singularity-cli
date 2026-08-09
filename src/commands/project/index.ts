// FILE: src/commands/project/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `project` command group for `singu`.
//   SCOPE: Parent project command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/project/list.ts, src/commands/project/get.ts, src/commands/project/alias/index.ts
//   LINKS: M-PROJECT-COMMANDS-READ, M-PROJECT-ALIAS-COMMANDS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectCommand - Parent project command with list, get, and alias subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added the project command group with read and alias subcommands.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { projectAliasCommand } from "./alias/index.ts";
import { projectCreateCommand } from "./create.ts";
import { projectGetCommand } from "./get.ts";
import { projectListCommand } from "./list.ts";

export const projectCommand = defineCommand({
  meta: {
    name: "project",
    description: "Inspect and reference Singularity projects",
  },
  subCommands: {
    list: projectListCommand,
    get: projectGetCommand,
    create: projectCreateCommand,
    alias: projectAliasCommand,
  },
});
