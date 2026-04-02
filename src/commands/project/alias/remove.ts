// FILE: src/commands/project/alias/remove.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Remove a saved project alias for the active account.
//   SCOPE: Alias normalization, alias removal, and user-facing removal status.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/project-alias-store/index.ts
//   LINKS: M-PROJECT-ALIAS-COMMANDS, M-PROJECT-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectAliasRemoveCommand - `singu project alias remove` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `project alias remove` for account-scoped alias cleanup.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { normalizeProjectAliasName, removeProjectAlias } from "../../../lib/project-alias-store/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const projectAliasRemoveCommand = defineCommand({
  meta: {
    name: "remove",
    description: "Remove a saved project alias",
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
      const normalizedName = normalizeProjectAliasName(args.name);
      const removed = await removeProjectAlias(authContext.tokenFingerprint, normalizedName);

      if (!removed) {
        exitWithProjectCommandError(new Error(`Project alias "@${normalizedName}" is unknown.`));
        return;
      }

      console.log(`Removed project alias @${normalizedName}`);
    } catch (error) {
      exitWithProjectCommandError(error);
    }
  },
});
