// FILE: src/commands/task/alias/set.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist a stable alias for a task resolved from a raw id, SID, or alias.
//   SCOPE: Alias input parsing, task reference resolution, alias persistence, and user output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/task-ref-resolver/index.ts, src/lib/task-alias-store/index.ts
//   LINKS: M-TASK-ALIAS-COMMANDS, M-TASK-REF-RESOLVER, M-TASK-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskAliasSetCommand - `singu task alias set` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task alias set` to persist stable task aliases.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { normalizeTaskAliasName, setTaskAlias } from "../../../lib/task-alias-store/index.ts";
import { resolveTaskReference } from "../../../lib/task-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const taskAliasSetCommand = defineCommand({
  meta: {
    name: "set",
    description: "Save or replace a stable alias for a task",
  },
  args: {
    name: {
      type: "positional",
      description: "Alias name to save",
      required: true,
    },
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
  },
  // START_BLOCK_EXECUTE_TASK_ALIAS_SET
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const normalizedName = normalizeTaskAliasName(args.name);
      const resolvedReference = await resolveTaskReference(args.reference);
      const savedAlias = await setTaskAlias(authContext.tokenFingerprint, normalizedName, resolvedReference.id);

      console.log(`Saved task alias @${savedAlias.name} -> ${savedAlias.id}`);
    } catch (error) {
      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_ALIAS_SET
});
