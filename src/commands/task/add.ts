// FILE: src/commands/task/add.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Create a task from a title and optional project reference.
//   SCOPE: Task creation input parsing, optional project resolution, authenticated create request execution, and user-facing output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/project-ref-resolver/index.ts, src/api/generated/clients/taskControllerCreate.ts
//   LINKS: M-TASK-WRITE-COMMANDS, M-PROJECT-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskAddCommand - `singu task add` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `task add` for inbox and project-targeted task creation.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import type { TaskControllerCreateMutationRequest } from "../../api/generated/models/TaskControllerCreate.ts";
import { taskControllerCreate } from "../../api/generated/clients/taskControllerCreate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveProjectReference } from "../../lib/project-ref-resolver/index.ts";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createTaskAddPayload(title: string, projectId: string | undefined): TaskControllerCreateMutationRequest {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("Task title is empty.");
  }

  return {
    title: normalizedTitle,
    ...(projectId ? { projectId } : {}),
  };
}

export const taskAddCommand = defineCommand({
  meta: {
    name: "add",
    description: "Create a task from a title and optional project reference",
  },
  args: {
    title: {
      type: "positional",
      description: "Task title",
      required: true,
    },
    project: {
      type: "string",
      description: "Assign the task to a project raw id, short id, or @alias",
      valueHint: "project-ref",
    },
  },
  // START_BLOCK_EXECUTE_TASK_ADD
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedProject = args.project ? await resolveProjectReference(args.project) : undefined;
      const createdTask = await taskControllerCreate(
        {
          data: createTaskAddPayload(args.title, resolvedProject?.id),
        },
        { client },
      );

      if (resolvedProject) {
        console.log(`Resolved project ${args.project} -> ${resolvedProject.id}`);
      }

      console.log(`Created task: ${createdTask.title} (${createdTask.id})`);

      if (createdTask.projectId) {
        console.log(`Project: ${createdTask.projectId}`);
      } else {
        console.log("Project: inbox");
      }
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while creating the task. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithTaskCommandError(new Error(`Failed to create the task: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_TASK_ADD
});
