// FILE: src/commands/task/list.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: List tasks, print SIDs, and persist the last-list SID context.
//   SCOPE: Task list request execution, CLI arg parsing, optional project reference filtering, human output, JSON output, and SID cache refresh.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-cache/index.ts, src/lib/project-ref-resolver/index.ts, src/api/generated/clients/taskControllerList.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-REF-CACHE, M-PROJECT-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskListCommand - `singu task list` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task list` with SID output, project filtering, and cache persistence.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerList } from "../../api/generated/clients/taskControllerList.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveProjectReference } from "../../lib/project-ref-resolver/index.ts";
import { saveTaskListContext, type TaskListContextItem } from "../../lib/task-ref-cache/index.ts";

function exitWithTaskCommandError(error: unknown): void {
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

function formatTaskCheck(checked: number): string {
  if (checked === 1) {
    return "done";
  }

  if (checked === 2) {
    return "cancelled";
  }

  return "open";
}

function createTaskContextItems(tasks: Array<{ id: string; title: string; projectId: string; checked: number; deadline: string }>): TaskListContextItem[] {
  return tasks.map((task, index) => {
    const item: TaskListContextItem = {
      sid: String(index + 1),
      id: task.id,
      title: task.title,
      checked: task.checked,
    };

    if (task.projectId) {
      item.projectId = task.projectId;
    }

    if (task.deadline) {
      item.deadline = task.deadline;
    }

    return item;
  });
}

function renderTaskTable(items: TaskListContextItem[]): string {
  if (items.length === 0) {
    return "No tasks found.";
  }

  const headers = ["SID", "TITLE", "CHECK", "PROJECT", "DEADLINE"];
  const rows = items.map((item) => [item.sid, item.title, formatTaskCheck(item.checked ?? 0), item.projectId ?? "-", item.deadline ?? "-"]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)));
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

function buildTaskListCommandLabel(args: {
  limit: string | undefined;
  offset: string | undefined;
  archived: boolean | undefined;
  removed: boolean | undefined;
  "all-recurrence": boolean | undefined;
  project: string | undefined;
}): string {
  const segments = ["singu task list"];

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

  if (args["all-recurrence"]) {
    segments.push("--all-recurrence");
  }

  if (args.project) {
    segments.push(`--project ${args.project}`);
  }

  return segments.join(" ");
}

export const taskListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List tasks and save short-id context",
    alias: ["ls"],
  },
  args: {
    limit: {
      type: "string",
      description: "Maximum number of tasks to request",
      valueHint: "count",
    },
    offset: {
      type: "string",
      description: "Offset into the task list",
      valueHint: "count",
    },
    archived: {
      type: "boolean",
      description: "Include archived tasks",
    },
    removed: {
      type: "boolean",
      description: "Include removed tasks",
    },
    "all-recurrence": {
      type: "boolean",
      description: "Include all recurrence instances",
    },
    project: {
      type: "string",
      description: "Filter tasks by project raw id, short id, or @alias",
      valueHint: "project-ref",
    },
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human table",
    },
  },
  // START_BLOCK_EXECUTE_TASK_LIST
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const maxCount = parseOptionalInteger(args.limit, "--limit");
      const offset = parseOptionalInteger(args.offset, "--offset");
      const resolvedProject = args.project ? await resolveProjectReference(args.project) : undefined;
      const response = await taskControllerList(
        {
          params: {
            ...(maxCount !== undefined ? { maxCount } : {}),
            ...(offset !== undefined ? { offset } : {}),
            ...(args.archived ? { includeArchived: true } : {}),
            ...(args.removed ? { includeRemoved: true } : {}),
            ...(args.allRecurrence ? { includeAllRecurrenceInstances: true } : {}),
            ...(resolvedProject ? { projectId: resolvedProject.id } : {}),
          },
        },
        { client },
      );

      const items = createTaskContextItems(response.tasks);

      await saveTaskListContext(
        {
          accountFingerprint: authContext.tokenFingerprint,
          command: buildTaskListCommandLabel(args),
          items,
        },
      );

      if (args.json) {
        console.log(
          JSON.stringify(
            {
              tasks: response.tasks,
              sidContext: items,
              projectFilter: resolvedProject,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (resolvedProject) {
        console.log(`Project filter: ${args.project} -> ${resolvedProject.id}`);
      }

      console.log(renderTaskTable(items));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while listing tasks. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to list tasks: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_LIST
});
