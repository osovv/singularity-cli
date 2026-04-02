import { describe, expect, it } from "vitest";

import { buildTaskListView, resolveTaskListMode, type TaskListRecord } from "./list.ts";

// FILE: src/commands/task/list.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify default actionable, inbox, and raw task list filtering behavior.
//   SCOPE: Smart task list grouping, inbox filtering, raw list pagination, and mode validation.
//   DEPENDS: vitest, src/commands/task/list.ts
//   LINKS: V-M-TASK-COMMANDS-READ, M-TASK-COMMANDS-READ
// END_MODULE_CONTRACT

function createTask(overrides: Partial<TaskListRecord> & Pick<TaskListRecord, "id" | "title">): TaskListRecord {
  return {
    checked: 0,
    ...overrides,
  };
}

describe("resolveTaskListMode", () => {
  it("defaults to the actionable view", () => {
    expect(resolveTaskListMode({})).toBe("default");
  });

  it("rejects incompatible inbox combinations", () => {
    expect(() => resolveTaskListMode({ inbox: true, project: "1" })).toThrow(/cannot be combined with `--project`/);
    expect(() => resolveTaskListMode({ inbox: true, all: true })).toThrow(/cannot be combined with `--all`/);
  });
});

describe("buildTaskListView", () => {
  const now = new Date("2026-04-02T12:00:00.000Z");

  it("groups open tasks into overdue and today sections by start and deadline", () => {
    const tasks: TaskListRecord[] = [
      createTask({ id: "overdue-start", title: "Overdue start", start: "2026-04-01T09:00:00.000Z", projectId: "P-1" }),
      createTask({ id: "today-late", title: "Today late", start: "2026-04-02T18:00:00.000Z", projectId: "P-1" }),
      createTask({ id: "overdue-deadline", title: "Overdue deadline", deadline: "2026-03-31", projectId: "P-1" }),
      createTask({ id: "today-early", title: "Today early", start: "2026-04-02T09:00:00.000Z", projectId: "P-1" }),
      createTask({ id: "future", title: "Future", start: "2026-04-03T09:00:00.000Z", projectId: "P-1" }),
      createTask({ id: "done", title: "Done", start: "2026-04-01T08:00:00.000Z", checked: 1, projectId: "P-1" }),
    ];

    const view = buildTaskListView(tasks, "default", { now });

    expect(view.overdue.map((task) => task.id)).toEqual(["overdue-deadline", "overdue-start"]);
    expect(view.today.map((task) => task.id)).toEqual(["today-early", "today-late"]);
    expect(view.items.map((task) => task.id)).toEqual(["overdue-deadline", "overdue-start", "today-early", "today-late"]);
  });

  it("builds an inbox view from open unscheduled tasks without projects", () => {
    const tasks: TaskListRecord[] = [
      createTask({ id: "inbox", title: "Inbox task" }),
      createTask({ id: "project", title: "Project task", projectId: "P-1" }),
      createTask({ id: "scheduled", title: "Scheduled task", start: "2026-04-02T09:00:00.000Z" }),
      createTask({ id: "done", title: "Done inbox", checked: 1 }),
    ];

    const view = buildTaskListView(tasks, "inbox", { now });

    expect(view.items.map((task) => task.id)).toEqual(["inbox"]);
  });

  it("applies local pagination to the raw list view", () => {
    const tasks: TaskListRecord[] = [
      createTask({ id: "1", title: "One" }),
      createTask({ id: "2", title: "Two" }),
      createTask({ id: "3", title: "Three" }),
    ];

    const view = buildTaskListView(tasks, "all", { limit: 1, offset: 1, now });

    expect(view.items.map((task) => task.id)).toEqual(["2"]);
    expect(view.overdue).toEqual([]);
    expect(view.today).toEqual([]);
  });
});
