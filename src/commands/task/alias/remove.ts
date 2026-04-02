// FILE: src/commands/task/alias/remove.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Remove a saved task alias for the active account.
//   SCOPE: Alias normalization, alias removal, and user-facing removal status.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/task-alias-store/index.ts
//   LINKS: M-TASK-ALIAS-COMMANDS, M-TASK-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskAliasRemoveCommand - `singu task alias remove` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task alias remove` for account-scoped alias cleanup.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { normalizeTaskAliasName, removeTaskAlias } from "../../../lib/task-alias-store/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const taskAliasRemoveCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a saved task alias",
    alias: ["rm"],
  },
  args: {
    name: {
      type: "positional",
      description: "Alias name to remove",
      required: true,
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const normalizedName = normalizeTaskAliasName(args.name);
      const removed = await removeTaskAlias(authContext.tokenFingerprint, normalizedName);

      if (!removed) {
        exitWithTaskCommandError(new Error(`Task alias "@${normalizedName}" is unknown.`));
        return;
      }

      console.log(`Removed task alias @${normalizedName}`);
    } catch (error) {
      exitWithTaskCommandError(error);
    }
  },
});
