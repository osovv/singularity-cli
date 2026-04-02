// FILE: src/commands/project/alias/list.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: List saved project aliases for the active account.
//   SCOPE: Alias listing, JSON output, and human-readable tabular output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/project-alias-store/index.ts
//   LINKS: M-PROJECT-ALIAS-COMMANDS, M-PROJECT-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectAliasListCommand - `singu project alias list` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `project alias list` for account-scoped alias inspection.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { requireAuthContext } from "../../../lib/auth/index.ts";
import { listProjectAliases } from "../../../lib/project-alias-store/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function renderAliasTable(entries: Array<{ name: string; id: string }>): string {
  if (entries.length === 0) {
    return "No project aliases saved.";
  }

  const headers = ["ALIAS", "ID"];
  const rows = entries.map((entry) => [`@${entry.name}`, entry.id]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)));
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

export const projectAliasListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List saved project aliases",
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
      const aliases = await listProjectAliases(authContext.tokenFingerprint);

      if (args.json) {
        console.log(JSON.stringify({ aliases }, null, 2));
        return;
      }

      console.log(renderAliasTable(aliases));
    } catch (error) {
      exitWithProjectCommandError(error);
    }
  },
});
