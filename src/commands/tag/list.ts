// FILE: src/commands/tag/list.ts
// VERSION: 1.0.0
// PURPOSE: List all tags with optional JSON output.

import { defineCommand } from "citty";

import { tagControllerList } from "../../api/generated/clients/tagControllerList.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";

function exitWithTagCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function renderTagTable(
  tags: { id: string; title: string; parent: string; hotkey: number; removed: boolean }[],
): string {
  if (tags.length === 0) {
    return "No tags found.";
  }

  const visibleTags = tags.filter((tag) => !tag.removed);
  const rows = visibleTags.map((tag) => [tag.id, tag.title, tag.parent || "-", String(tag.hotkey || "-")]);
  const headers = ["ID", "TITLE", "PARENT", "HOTKEY"];
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)),
  );
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

export const tagListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all tags",
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
      const client = createAuthorizedClient(authContext.token);
      const response = await tagControllerList({}, { client });

      if (args.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      console.log(renderTagTable(response.tags));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTagCommandError(new Error("Authentication failed while listing tags. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithTagCommandError(error);
    }
  },
});
