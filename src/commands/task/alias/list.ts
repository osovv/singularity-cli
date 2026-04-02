// FILE: src/commands/task/alias/list.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: List saved task aliases for the active account.
//   SCOPE: Alias listing, JSON output, and human-readable tabular output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/task-alias-store/index.ts
//   LINKS: M-TASK-ALIAS-COMMANDS, M-TASK-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskAliasListCommand - `singu task alias list` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task alias list` for account-scoped alias inspection.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { listTaskAliases } from "../../../lib/task-alias-store/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function renderAliasTable(entries: Array<{ name: string; id: string }>): string {
  if (entries.length === 0) {
    return "No task aliases saved.";
  }

  const headers = ["ALIAS", "ID"];
  const rows = entries.map((entry) => [`@${entry.name}`, entry.id]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)));
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

export const taskAliasListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List saved task aliases",
    alias: ["ls"],
  },
  args: {
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human table",
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const aliases = await listTaskAliases(authContext.tokenFingerprint);

      if (args.json) {
        console.log(JSON.stringify({ aliases }, null, 2));
        return;
      }

      console.log(renderAliasTable(aliases));
    } catch (error) {
      exitWithTaskCommandError(error);
    }
  },
});
