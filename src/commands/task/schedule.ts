// FILE: src/commands/task/schedule.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Update task start and optional deadline values from CLI-friendly schedule input.
//   SCOPE: Task reference resolution, schedule input parsing, payload construction, authenticated update request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/lib/time/index.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-TASK-REF-RESOLVER, M-TIME-UTILS, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   createTaskSchedulePayload - Build the minimal schedule update payload from parsed start and deadline inputs.
//   taskScheduleCommand - `singu task schedule` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task schedule` for parsed start and deadline updates.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";
import { resolveScheduleInput, type ResolvedScheduleInput } from "../../lib/time/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// START_CONTRACT: createTaskSchedulePayload
//   PURPOSE: Build a task update payload from parsed start and optional deadline inputs.
//   INPUTS: { start: ResolvedScheduleInput - Parsed start input. deadline: ResolvedScheduleInput | undefined - Parsed optional deadline input. }
//   OUTPUTS: { TaskControllerUpdateMutationRequest - Minimal task schedule patch payload. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-WRITE-COMMANDS
// END_CONTRACT: createTaskSchedulePayload
export function createTaskSchedulePayload(
  start: ResolvedScheduleInput,
  deadline?: ResolvedScheduleInput,
): TaskControllerUpdateMutationRequest {
  if (deadline && deadline.date.getTime() < start.date.getTime()) {
    throw new Error("`--deadline` must be greater than or equal to `--start`.");
  }

  const hasTime = start.hasTime || Boolean(deadline?.hasTime);
  const basePayload: TaskControllerUpdateMutationRequest = {
    start: start.value,
    ...(deadline ? { deadline: deadline.value } : {}),
    ...(hasTime ? { useTime: true } : {}),
  };

  if (deadline && hasTime) {
    const timeLength = Math.max(0, Math.round((deadline.date.getTime() - start.date.getTime()) / 60000));
    return {
      ...basePayload,
      timeLength,
    };
  }

  return basePayload;
}

export const taskScheduleCommand = defineCommand({
  meta: {
    name: "schedule",
    description: "Schedule a task with start and optional deadline inputs",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    start: {
      type: "string",
      description: "Schedule start: now, today, tomorrow, YYYY-MM-DD, or ISO datetime",
      required: true,
      valueHint: "when",
    },
    deadline: {
      type: "string",
      description: "Optional deadline: today, tomorrow, YYYY-MM-DD, or ISO datetime",
      valueHint: "when",
    },
  },
  // START_BLOCK_EXECUTE_TASK_SCHEDULE
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const resolvedStart = resolveScheduleInput(args.start);
      const resolvedDeadline = args.deadline ? resolveScheduleInput(args.deadline) : undefined;
      const updatedTask = await taskControllerUpdate(
        {
          id: resolvedTask.id,
          data: createTaskSchedulePayload(resolvedStart, resolvedDeadline),
        },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`Scheduled task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(`Start: ${updatedTask.start || "-"}`);
      console.log(`Deadline: ${updatedTask.deadline || "-"}`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while scheduling the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task was not found while scheduling it."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to schedule the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_SCHEDULE
});
