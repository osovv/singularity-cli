// FILE: src/commands/project/alias/set.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist a stable alias for a project resolved from a raw id, SID, or alias.
//   SCOPE: Alias input parsing, project reference resolution, alias persistence, and user output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/project-ref-resolver/index.ts, src/lib/project-alias-store/index.ts
//   LINKS: M-PROJECT-ALIAS-COMMANDS, M-PROJECT-REF-RESOLVER, M-PROJECT-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectAliasSetCommand - `singu project alias set` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `project alias set` to persist stable project aliases.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { normalizeProjectAliasName, setProjectAlias } from "../../../lib/project-alias-store/index.ts";
import { resolveProjectReference } from "../../../lib/project-ref-resolver/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const projectAliasSetCommand = defineCommand({
  meta: {
    name: "set",
    description: "Save or replace a stable alias for a project",
  },
  args: {
    name: {
      type: "positional",
      description: "Alias name to save",
      required: true,
    },
    reference: {
      type: "positional",
      description: "Project raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_PROJECT_ALIAS_SET
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const normalizedName = normalizeProjectAliasName(args.name);
      const resolvedReference = await resolveProjectReference(args.reference);
      const savedAlias = await setProjectAlias(authContext.tokenFingerprint, normalizedName, resolvedReference.id);

      console.log(`Saved project alias @${savedAlias.name} -> ${savedAlias.id}`);
    } catch (error) {
      exitWithProjectCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_PROJECT_ALIAS_SET
});
