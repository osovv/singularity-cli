// FILE: src/cli.ts
// VERSION: 1.3.0
// START_MODULE_CONTRACT
//   PURPOSE: Provide the top-level `singu` CLI entry point and attach user-facing auth, project, and task command groups.
//   SCOPE: CLI metadata, top-level help text, and top-level command registration.
//   DEPENDS: src/commands/auth/index.ts, src/commands/project/index.ts, src/commands/task/index.ts, citty
//   LINKS: M-CLI-ENTRY, M-AUTH-COMMANDS, M-PROJECT-COMMANDS-READ, M-PROJECT-ALIAS-COMMANDS, M-TASK-COMMANDS-READ, M-TASK-ALIAS-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   main - Top-level citty command for the `singu` binary.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.3.0 - Attached the task command group with read and alias workflows.]
// END_CHANGE_SUMMARY

import { defineCommand, runMain } from "citty";

import { authCommand } from "./commands/auth/index.ts";
import { projectCommand } from "./commands/project/index.ts";
import { taskCommand } from "./commands/task/index.ts";

const main = defineCommand({
  meta: {
    name: "singu",
    version: "0.1.0",
    description: "CLI client for the Singularity task manager API",
  },
  subCommands: {
    auth: authCommand,
    project: projectCommand,
    task: taskCommand,
  },
  // START_BLOCK_RUN_MAIN_COMMAND
  async run() {
    if (process.argv.slice(2).length > 0) {
      return;
    }

    console.log("singu is ready. Run `singu --help` to inspect commands.");
  },
  // END_BLOCK_RUN_MAIN_COMMAND
});

await runMain(main);
