// FILE: src/commands/task/list.ts
// VERSION: 1.1.0
// START_MODULE_CONTRACT
//   PURPOSE: List tasks through default actionable, inbox, or raw views, print SIDs, and persist the last-list SID context.
//   SCOPE: Task list request execution, CLI arg parsing, optional project reference filtering, default actionable grouping, inbox filtering, human output, JSON output, and SID cache refresh.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-cache/index.ts, src/lib/project-ref-resolver/index.ts, src/api/generated/clients/taskControllerList.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-REF-CACHE, M-PROJECT-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   buildTaskListView - Build default, inbox, or raw task views from API results.
//   resolveTaskListMode - Resolve CLI flags into default, inbox, or raw task list modes.
//   taskListCommand - `singu task list` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.1.0 - Made `task list` default to today and overdue work, added `--inbox`, and added `--all` as a raw-list escape hatch.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerList } from "../../api/generated/clients/taskControllerList.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveProjectReference } from "../../lib/project-ref-resolver/index.ts";
import { saveTaskListContext, type TaskListContextItem } from "../../lib/task-ref-cache/index.ts";

export type TaskListRecord = {
  id: string;
  title: string;
  checked?: number;
  projectId?: string;
  start?: string;
  deadline?: string;
};

export type TaskListMode = "default" | "inbox" | "all";

export type TaskListView = {
  mode: TaskListMode;
  items: TaskListRecord[];
  overdue: TaskListRecord[];
  today: TaskListRecord[];
};

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

function hasNonEmptyValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function parseTaskDate(value: string | undefined): Date | undefined {
  if (!hasNonEmptyValue(value)) {
    return undefined;
  }

  const normalizedValue = value!.trim();
  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, yearString = "", monthString = "", dayString = ""] = dateOnlyMatch;
    const year = Number.parseInt(yearString, 10);
    const month = Number.parseInt(monthString, 10);
    const day = Number.parseInt(dayString, 10);
    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
}

function getDayBounds(now: Date): { startOfToday: Date; endOfToday: Date } {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  return { startOfToday, endOfToday };
}

function isTaskOpen(task: TaskListRecord): boolean {
  return task.checked !== 1 && task.checked !== 2;
}

function classifyTaskTiming(task: TaskListRecord, now: Date): "overdue" | "today" | undefined {
  const { startOfToday, endOfToday } = getDayBounds(now);
  const startDate = parseTaskDate(task.start);
  const deadlineDate = parseTaskDate(task.deadline);
  const relevantDates = [startDate, deadlineDate].filter((value): value is Date => value instanceof Date);

  if (relevantDates.length === 0) {
    return undefined;
  }

  if (relevantDates.some((date) => date < startOfToday)) {
    return "overdue";
  }

  if (relevantDates.some((date) => date >= startOfToday && date < endOfToday)) {
    return "today";
  }

  return undefined;
}

function getTaskSortDate(task: TaskListRecord): Date | undefined {
  return parseTaskDate(task.start) ?? parseTaskDate(task.deadline);
}

function compareTaskScheduleAsc(left: TaskListRecord, right: TaskListRecord): number {
  const leftDate = getTaskSortDate(left);
  const rightDate = getTaskSortDate(right);

  if (leftDate && rightDate) {
    const difference = leftDate.getTime() - rightDate.getTime();

    if (difference !== 0) {
      return difference;
    }
  }

  if (leftDate && !rightDate) {
    return -1;
  }

  if (!leftDate && rightDate) {
    return 1;
  }

  const titleDifference = left.title.localeCompare(right.title);

  if (titleDifference !== 0) {
    return titleDifference;
  }

  return left.id.localeCompare(right.id);
}

function paginateItems<TItem>(items: TItem[], limit: number | undefined, offset: number | undefined): TItem[] {
  const startIndex = offset ?? 0;

  if (limit === undefined) {
    return items.slice(startIndex);
  }

  return items.slice(startIndex, startIndex + limit);
}

// START_CONTRACT: buildTaskListView
//   PURPOSE: Build the visible task list view for default actionable, inbox, or raw modes.
//   INPUTS: { tasks: TaskListRecord[] - Task records returned by the API. mode: TaskListMode - View mode selected by CLI args. options: { now?: Date; limit?: number; offset?: number } | undefined - Deterministic view controls for time and pagination. }
//   OUTPUTS: { TaskListView - Visible task items and grouped sections for rendering and SID caching. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-COMMANDS-READ
// END_CONTRACT: buildTaskListView
export function buildTaskListView(
  tasks: TaskListRecord[],
  mode: TaskListMode,
  options: { now?: Date; limit?: number; offset?: number } = {},
): TaskListView {
  const now = options.now ?? new Date();
  const limit = options.limit;
  const offset = options.offset;

  if (mode === "all") {
    const items = paginateItems(tasks, limit, offset);
    return {
      mode,
      items,
      overdue: [],
      today: [],
    };
  }

  if (mode === "inbox") {
    const inboxItems = tasks.filter(
      (task) => isTaskOpen(task) && !hasNonEmptyValue(task.projectId) && !hasNonEmptyValue(task.start) && !hasNonEmptyValue(task.deadline),
    );
    const items = paginateItems(inboxItems, limit, offset);

    return {
      mode,
      items,
      overdue: [],
      today: [],
    };
  }

  const openTasks = tasks.filter(isTaskOpen);
  const overdue = openTasks.filter((task) => classifyTaskTiming(task, now) === "overdue").sort(compareTaskScheduleAsc);
  const today = openTasks.filter((task) => classifyTaskTiming(task, now) === "today").sort(compareTaskScheduleAsc);
  const visibleItems = paginateItems([...overdue, ...today], limit, offset);
  const visibleIds = new Set(visibleItems.map((task) => task.id));

  return {
    mode,
    items: visibleItems,
    overdue: overdue.filter((task) => visibleIds.has(task.id)),
    today: today.filter((task) => visibleIds.has(task.id)),
  };
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

function createTaskContextItems(tasks: TaskListRecord[]): TaskListContextItem[] {
  return tasks.map((task, index) => {
    const item: TaskListContextItem = {
      sid: String(index + 1),
      id: task.id,
      title: task.title,
    };

    if (typeof task.checked === "number") {
      item.checked = task.checked;
    }

    if (task.projectId) {
      item.projectId = task.projectId;
    }

    if (task.deadline) {
      item.deadline = task.deadline;
    }

    if (task.start) {
      item.start = task.start;
    }

    return item;
  });
}

function renderTaskTable(items: TaskListContextItem[]): string {
  if (items.length === 0) {
    return "No tasks found.";
  }

  const headers = ["SID", "TITLE", "CHECK", "PROJECT", "START", "DEADLINE"];
  const rows = items.map((item) => [item.sid, item.title, formatTaskCheck(item.checked ?? 0), item.projectId ?? "-", item.start ?? "-", item.deadline ?? "-"]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)));
  const renderRow = (cells: string[]) => cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ").trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

function renderTaskListView(view: TaskListView, contextItems: TaskListContextItem[]): string {
  if (view.mode !== "default") {
    if (view.mode === "inbox" && contextItems.length === 0) {
      return "No inbox tasks found.";
    }

    return renderTaskTable(contextItems);
  }

  if (contextItems.length === 0) {
    return "No tasks scheduled for today or earlier.";
  }

  const contextItemsById = new Map(contextItems.map((item) => [item.id, item]));
  const overdueItems = view.overdue.map((task) => contextItemsById.get(task.id)).filter((value): value is TaskListContextItem => Boolean(value));
  const todayItems = view.today.map((task) => contextItemsById.get(task.id)).filter((value): value is TaskListContextItem => Boolean(value));
  const sections: string[] = [];

  if (overdueItems.length > 0) {
    sections.push(`Overdue\n${renderTaskTable(overdueItems)}`);
  }

  if (todayItems.length > 0) {
    sections.push(`Today\n${renderTaskTable(todayItems)}`);
  }

  return sections.join("\n\n");
}

export function resolveTaskListMode(args: { inbox?: boolean | undefined; all?: boolean | undefined; project?: string | undefined }): TaskListMode {
  if (args.inbox && args.project) {
    throw new Error("`task list --inbox` cannot be combined with `--project`. Inbox tasks are, by definition, not assigned to a project.");
  }

  if (args.inbox && args.all) {
    throw new Error("`task list --inbox` cannot be combined with `--all`. Choose either the inbox view or the raw list view.");
  }

  if (args.inbox) {
    return "inbox";
  }

  if (args.all) {
    return "all";
  }

  return "default";
}

function buildTaskListCommandLabel(args: {
  limit: string | undefined;
  offset: string | undefined;
  archived: boolean | undefined;
  removed: boolean | undefined;
  allRecurrence: boolean | undefined;
  inbox: boolean | undefined;
  all: boolean | undefined;
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

  if (args.allRecurrence) {
    segments.push("--all-recurrence");
  }

  if (args.inbox) {
    segments.push("--inbox");
  }

  if (args.all) {
    segments.push("--all");
  }

  if (args.project) {
    segments.push(`--project ${args.project}`);
  }

  return segments.join(" ");
}

export const taskListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List actionable tasks and save short-id context",
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
    inbox: {
      type: "boolean",
      description: "Show unscheduled tasks without a project",
    },
    all: {
      type: "boolean",
      description: "Show the raw task list instead of the default actionable view",
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
      const mode = resolveTaskListMode({
        inbox: Boolean(args.inbox),
        all: Boolean(args.all),
        project: args.project,
      });
      const resolvedProject = args.project ? await resolveProjectReference(args.project) : undefined;
      const response = await taskControllerList(
        {
          params: {
            ...(args.archived ? { includeArchived: true } : {}),
            ...(args.removed ? { includeRemoved: true } : {}),
            ...(args.allRecurrence ? { includeAllRecurrenceInstances: true } : {}),
            ...(resolvedProject ? { projectId: resolvedProject.id } : {}),
          },
        },
        { client },
      );

      const view = buildTaskListView(response.tasks, mode, {
        ...(maxCount !== undefined ? { limit: maxCount } : {}),
        ...(offset !== undefined ? { offset } : {}),
      });
      const items = createTaskContextItems(view.items);

      await saveTaskListContext(
        {
          accountFingerprint: authContext.tokenFingerprint,
          command: buildTaskListCommandLabel({
            limit: args.limit,
            offset: args.offset,
            archived: Boolean(args.archived),
            removed: Boolean(args.removed),
            allRecurrence: Boolean(args.allRecurrence),
            inbox: Boolean(args.inbox),
            all: Boolean(args.all),
            project: args.project,
          }),
          items,
        },
      );

      if (args.json) {
        console.log(
          JSON.stringify(
            view.mode === "default"
              ? {
                  mode: view.mode,
                  overdue: view.overdue,
                  today: view.today,
                  sidContext: items,
                  projectFilter: resolvedProject,
                }
              : {
                  mode: view.mode,
                  tasks: view.items,
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

      console.log(renderTaskListView(view, items));
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
