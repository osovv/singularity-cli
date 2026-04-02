// FILE: src/commands/auth/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `auth` command group for `singu`.
//   SCOPE: Parent auth command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/auth/login.ts, src/commands/auth/status.ts, src/commands/auth/logout.ts
//   LINKS: M-AUTH-COMMANDS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   authCommand - Parent auth command with login, status, and logout subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added the auth command group for singu.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { loginCommand } from "./login.ts";
import { logoutCommand } from "./logout.ts";
import { statusCommand } from "./status.ts";

export const authCommand = defineCommand({
  meta: {
    name: "auth",
    description: "Manage the Singularity API token",
  },
  subCommands: {
    login: loginCommand,
    status: statusCommand,
    logout: logoutCommand,
  },
});
