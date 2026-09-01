// FILE: src/commands/recur/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `recur` command group for `singu`.
//   SCOPE: Parent recur command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/recur/sync.ts
//   LINKS: M-RECURRENCE-SYNC, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   recurCommand - Parent recur command with the sync subcommand.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added recur command group exposing recurrence reconciliation.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { recurSyncCommand } from "./sync.ts";

export const recurCommand = defineCommand({
  meta: {
    name: "recur",
    description: "Manage CLI-side recurrence chains across devices",
  },
  subCommands: {
    sync: recurSyncCommand,
  },
});
