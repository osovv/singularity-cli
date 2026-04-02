// FILE: src/commands/project/list.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: List projects, print SIDs, and persist the last-list SID context.
//   SCOPE: Project list request execution, CLI arg parsing, human output, JSON output, and SID cache refresh.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/project-ref-cache/index.ts, src/api/generated/clients/projectControllerList.ts
//   LINKS: M-PROJECT-COMMANDS-READ, M-PROJECT-REF-CACHE, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectListCommand - `singu project list` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `project list` with SID output and cache persistence.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { projectControllerList } from "../../api/generated/clients/projectControllerList.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { saveProjectListContext, type ProjectListContextItem } from "../../lib/project-ref-cache/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseOptionalInteger(value: string | undefined, flagName: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${flagName} must be a non-negative integer.`);
  }

  return parsedValue;
}

function createProjectContextItems(projects: Array<{ id: string; title: string; emoji?: string; isNotebook?: boolean }>): ProjectListContextItem[] {
  return projects.map((project, index) => {
    const item: ProjectListContextItem = {
      sid: String(index + 1),
      id: project.id,
      title: project.title,
    };

    if (project.emoji) {
      item.emoji = project.emoji;
    }

    if (typeof project.isNotebook === "boolean") {
      item.isNotebook = project.isNotebook;
    }

    return item;
  });
}

function renderProjectTable(items: ProjectListContextItem[]): string {
  if (items.length === 0) {
    return "No projects found.";
  }

  const headers = ["SID", "TITLE", "EMOJI", "NOTEBOOK"];
  const rows = items.map((item) => [item.sid, item.title, item.emoji ?? "", item.isNotebook ? "yes" : "no"]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)));
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

function buildProjectListCommandLabel(args: {
  limit: string | undefined;
  offset: string | undefined;
  archived: boolean | undefined;
  removed: boolean | undefined;
}): string {
  const segments = ["singu project list"];

  if (args.limit) {
    segments.push(`--limit ${args.limit}`);
  }

  if (args.offset) {
    segments.push(`--offset ${args.offset}`);
  }

  if (args.archived) {
    segments.push("--archived");
  }

  if (args.removed) {
    segments.push("--removed");
  }

  return segments.join(" ");
}

export const projectListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List projects and save short-id context",
    alias: ["ls"],
  },
  args: {
    limit: {
      type: "string",
      description: "Maximum number of projects to request",
      valueHint: "count",
    },
    offset: {
      type: "string",
      description: "Offset into the project list",
      valueHint: "count",
    },
    archived: {
      type: "boolean",
      description: "Include archived projects",
    },
    removed: {
      type: "boolean",
      description: "Include removed projects",
    },
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human table",
    },
  },
  // START_BLOCK_EXECUTE_PROJECT_LIST
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const maxCount = parseOptionalInteger(args.limit, "--limit");
      const offset = parseOptionalInteger(args.offset, "--offset");
      const response = await projectControllerList(
        {
          params: {
            ...(maxCount !== undefined ? { maxCount } : {}),
            ...(offset !== undefined ? { offset } : {}),
            ...(args.archived ? { includeArchived: true } : {}),
            ...(args.removed ? { includeRemoved: true } : {}),
          },
        },
        { client },
      );

      const items = createProjectContextItems(response.projects);

      await saveProjectListContext(
        {
          accountFingerprint: authContext.tokenFingerprint,
          command: buildProjectListCommandLabel(args),
          items,
        },
      );

      if (args.json) {
        console.log(
          JSON.stringify(
            {
              projects: response.projects,
              sidContext: items,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(renderProjectTable(items));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        throw new Error("Authentication failed while listing projects. Run `singu auth status --check` or `singu auth login`.");
      }

      if (isApiClientError(error)) {
        exitWithProjectCommandError(new Error(`Failed to list projects: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithProjectCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_PROJECT_LIST
});
