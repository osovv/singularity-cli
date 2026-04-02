// FILE: src/commands/task/check.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Provide shared helpers for `task do` and `task undo` state transitions.
//   SCOPE: Task checked-state transitions, current task inspection, update execution, and transition status output.
//   DEPENDS: src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/api/generated/clients/taskControllerGetById.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-TASK-ACTION-COMMANDS, M-TASK-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   createTaskCheckedUpdate - Build the minimal PATCH payload for changing task checked state.
//   runTaskCheckedCommand - Execute a checked-state transition for a task reference.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added shared helpers for `task do` and `task undo`.]
// END_CHANGE_SUMMARY

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

export type TaskCheckedTarget = 0 | 1;

type TaskCheckCandidate = {
  checked?: number;
};

type RunTaskCheckedCommandOptions = {
  reference: string;
  targetChecked: TaskCheckedTarget;
  completionMessage: string;
  alreadyMessage: string;
};

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// START_CONTRACT: createTaskCheckedUpdate
//   PURPOSE: Build the minimal PATCH payload required to change task checked state.
//   INPUTS: { task: TaskCheckCandidate - Current task state candidate. targetChecked: TaskCheckedTarget - Desired checked state. }
//   OUTPUTS: { TaskControllerUpdateMutationRequest | undefined - Minimal update payload or undefined when the task is already in the target state. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-ACTION-COMMANDS
// END_CONTRACT: createTaskCheckedUpdate
export function createTaskCheckedUpdate(
  task: TaskCheckCandidate,
  targetChecked: TaskCheckedTarget,
): TaskControllerUpdateMutationRequest | undefined {
  const normalizedChecked = typeof task.checked === "number" ? task.checked : 0;

  if (normalizedChecked === targetChecked) {
    return undefined;
  }

  const payload: TaskControllerUpdateMutationRequest = {
    checked: targetChecked,
  };

  // Singularity requires both `checked` and `complete` for proper task completion
  if (targetChecked === 1) {
    payload.complete = 100;
  } else {
    payload.complete = 0;
  }

  return payload;
}

// START_CONTRACT: runTaskCheckedCommand
//   PURPOSE: Resolve a task reference and apply a checked-state transition through the API.
//   INPUTS: { options: RunTaskCheckedCommandOptions - Reference, target checked state, and user-facing copy. }
//   OUTPUTS: { Promise<void> - Resolves once the task state transition is complete or already satisfied. }
//   SIDE_EFFECTS: Reads and updates the target task through authenticated API calls and prints user-facing output.
//   LINKS: M-TASK-ACTION-COMMANDS
// END_CONTRACT: runTaskCheckedCommand
export async function runTaskCheckedCommand(options: RunTaskCheckedCommandOptions): Promise<void> {
  let resolvedTaskId = options.reference;

  try {
    const authContext = await requireAuthContext();
    const resolvedReference = await resolveTaskReference(options.reference);
    resolvedTaskId = resolvedReference.id;
    const client = createAuthorizedClient(authContext.token);
    const task = await taskControllerGetById({ id: resolvedReference.id }, { client });
    const update = createTaskCheckedUpdate({ checked: task.checked }, options.targetChecked);

    if (!update) {
      console.log(`${options.alreadyMessage}: ${task.title} (${task.id})`);
      return;
    }

    const updatedTask = await taskControllerUpdate({ id: task.id, data: update }, { client });

    if (resolvedReference.kind !== "raw") {
      console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
    }

    console.log(`${options.completionMessage}: ${updatedTask.title} (${updatedTask.id})`);
    console.log("Run `singu task list` to refresh short IDs.");
  } catch (error) {
    if (isApiClientError(error) && error.status === 401) {
      exitWithTaskCommandError(new Error("Authentication failed while updating the task. Run `singu auth status --check` or `singu auth login`."));
      return;
    }

    if (isApiClientError(error) && error.status === 404) {
      exitWithTaskCommandError(new Error(`Task "${resolvedTaskId}" was not found.`));
      return;
    }

    if (isApiClientError(error)) {
      exitWithTaskCommandError(new Error(`Failed to update the task: ${error.status} ${error.statusText}.`));
      return;
    }

    exitWithTaskCommandError(error);
  }
}
