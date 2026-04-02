// FILE: src/commands/task/move.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Move a task into a project or back to inbox.
//   SCOPE: Task reference resolution, destination project resolution, authenticated update request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/task-ref-resolver/index.ts, src/lib/project-ref-resolver/index.ts, src/api/generated/clients/taskControllerUpdate.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-TASK-REF-RESOLVER, M-PROJECT-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskMoveCommand - `singu task move` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task move` for project assignment and inbox triage.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveProjectReference } from "../../lib/project-ref-resolver/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createTaskMovePayload(options: { projectId: string | undefined; inbox: boolean }): TaskControllerUpdateMutationRequest {
  if (options.inbox) {
    return {
      projectId: "",
    };
  }

  if (!options.projectId) {
    throw new Error("Task move requires either `--project <project-ref>` or `--inbox`.");
  }

  return {
    projectId: options.projectId,
  };
}

export const taskMoveCommand = defineCommand({
  meta: {
    name: "move",
    description: "Move a task into a project or back to inbox",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    project: {
      type: "string",
      description: "Destination project raw id, short id, or @alias",
      valueHint: "project-ref",
    },
    inbox: {
      type: "boolean",
      description: "Move the task back to inbox by clearing its project assignment",
    },
  },
  // START_BLOCK_EXECUTE_TASK_MOVE
  async run({ args }) {
    try {
      if (!args.project && !args.inbox) {
        throw new Error("Task move requires either `--project <project-ref>` or `--inbox`.");
      }

      if (args.project && args.inbox) {
        throw new Error("`task move --project` cannot be combined with `--inbox`. Choose one destination.");
      }

      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const resolvedProject = args.project ? await resolveProjectReference(args.project) : undefined;
      const updatedTask = await taskControllerUpdate(
        {
          id: resolvedTask.id,
          data: createTaskMovePayload({ projectId: resolvedProject?.id, inbox: Boolean(args.inbox) }),
        },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      if (resolvedProject) {
        console.log(`Resolved project ${args.project} -> ${resolvedProject.id}`);
      }

      console.log(`Moved task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(`Project: ${updatedTask.projectId || "inbox"}`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while moving the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task or project was not found while moving the task."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to move the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_MOVE
});
