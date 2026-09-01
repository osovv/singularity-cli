#!/usr/bin/env bun
// FILE: src/cli.ts
// VERSION: 1.6.0
// START_MODULE_CONTRACT
//   PURPOSE: Provide the top-level `singu` CLI entry point and attach user-facing auth, project, task, recur, and block command groups.
//   SCOPE: CLI metadata, top-level help text, and top-level command registration.
//   DEPENDS: src/commands/auth/index.ts, src/commands/project/index.ts, src/commands/task/index.ts, src/commands/recur/index.ts, src/commands/block.ts, citty
//   LINKS: M-CLI-ENTRY, M-AUTH-COMMANDS, M-PROJECT-COMMANDS-READ, M-PROJECT-ALIAS-COMMANDS, M-TASK-COMMANDS-READ, M-TASK-WRITE-COMMANDS, M-TASK-ACTION-COMMANDS, M-TASK-ALIAS-COMMANDS, M-RECURRENCE-SYNC, M-BLOCK-COMMAND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   main - Top-level citty command for the `singu` binary.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.6.0 - Registered the recur command group and aligned the version meta with package.json 0.2.0.]
// END_CHANGE_SUMMARY

import { defineCommand, runMain } from "citty";

import { authCommand } from "./commands/auth/index.ts";
import { blockCommand } from "./commands/block.ts";
import { projectCommand } from "./commands/project/index.ts";
import { recurCommand } from "./commands/recur/index.ts";
import { snapshotCommand } from "./commands/snapshot.ts";
import { tagCommand } from "./commands/tag/index.ts";
import { taskCommand } from "./commands/task/index.ts";

const main = defineCommand({
  meta: {
    name: "singu",
    version: "0.2.0",
    description: "CLI client for the Singularity task manager API",
  },
  subCommands: {
    auth: authCommand,
    project: projectCommand,
    task: taskCommand,
    recur: recurCommand,
    tag: tagCommand,
    block: blockCommand,
    snapshot: snapshotCommand,
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
