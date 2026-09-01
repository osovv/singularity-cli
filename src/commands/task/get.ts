// FILE: src/commands/task/get.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Fetch and render a single task by raw id, SID, or alias.
//   SCOPE: Task reference resolution, task fetch execution, human output, and JSON output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/api/generated/clients/taskControllerGetById.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskGetCommand - `singu task get` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task get` with raw id, SID, and alias resolution.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";
import { describeRecurrenceRule } from "../../lib/recurrence-rule/index.ts";
import { getRecurrenceRule } from "../../lib/recurrence-store/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
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

function formatTaskPriority(priority: number): string {
  if (priority === 0) {
    return "high";
  }

  if (priority === 2) {
    return "low";
  }

  return "normal";
}

function formatTaskOutput(task: {
  id: string;
  title: string;
  note: string;
  checked: number;
  priority: number;
  projectId: string;
  parent: string;
  start: string;
  deadline: string;
  timeLength: number;
  isNote: boolean;
  tags: string[];
  recurrence?: object;
}, recurrenceLabel: string): string {
  const lines = [
    `Title: ${task.title}`,
    `ID: ${task.id}`,
    `Check: ${formatTaskCheck(task.checked)}`,
    `Priority: ${formatTaskPriority(task.priority)}`,
    `Project: ${task.projectId || "-"}`,
    `Parent: ${task.parent || "-"}`,
    `Start: ${task.start || "-"}`,
    `Deadline: ${task.deadline || "-"}`,
    `Duration: ${task.timeLength || 0}`,
    `Note Task: ${task.isNote ? "yes" : "no"}`,
    `Tags: ${task.tags.length > 0 ? task.tags.join(", ") : "-"}`,
    `Recurrence: ${recurrenceLabel}`,
  ];

  if (task.note) {
    lines.push(`Note: ${task.note}`);
  }

  return lines.join("\n");
}

export const taskGetCommand = defineCommand({
  meta: {
    name: "get",
    description: "Get a task by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human view",
    },
  },
  // START_BLOCK_EXECUTE_TASK_GET
  async run({ args }) {
    let resolvedTaskId = args.reference;

    try {
      const authContext = await requireAuthContext();
      const resolvedReference = await resolveTaskReference(args.reference);
      resolvedTaskId = resolvedReference.id;
      const client = createAuthorizedClient(authContext.token);
      const task = await taskControllerGetById({ id: resolvedReference.id }, { client });

      if (args.json) {
        console.log(JSON.stringify({ reference: resolvedReference, task }, null, 2));
        return;
      }

      if (resolvedReference.kind !== "raw") {
        console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
      }

      const recurrenceRule = await getRecurrenceRule(task.id);
        const recurrenceLabel = task.recurrence ? "server-managed" : recurrenceRule ? describeRecurrenceRule(recurrenceRule) : "-";
        console.log(formatTaskOutput(task, recurrenceLabel));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while fetching the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error(`Task "${resolvedTaskId}" was not found.`));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to fetch the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_GET
});
