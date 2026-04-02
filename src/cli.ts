// FILE: src/cli.ts
// VERSION: 1.1.0
// START_MODULE_CONTRACT
//   PURPOSE: Provide the top-level `singu` CLI entry point and attach user-facing command groups.
//   SCOPE: CLI metadata, top-level help text, and auth command registration.
//   DEPENDS: src/commands/auth/index.ts, citty
//   LINKS: M-CLI-ENTRY, M-AUTH-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   main - Top-level citty command for the `singu` binary.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.1.0 - Renamed the runtime binary to `singu` and attached the auth command group.]
// END_CHANGE_SUMMARY

import { defineCommand, runMain } from "citty";

import { authCommand } from "./commands/auth/index.ts";

const main = defineCommand({
  meta: {
    name: "singu",
    version: "0.1.0",
    description: "CLI client for the Singularity task manager API",
  },
  subCommands: {
    auth: authCommand,
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
