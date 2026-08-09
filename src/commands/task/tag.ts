// FILE: src/commands/task/tag.ts
// VERSION: 1.0.0
// PURPOSE: Attach or detach a tag on a task.

import { defineCommand } from "citty";

import type { TaskControllerUpdateMutationRequest } from "../../api/generated/models/TaskControllerUpdate.ts";
import { taskControllerGetById } from "../../api/generated/clients/taskControllerGetById.ts";
import { taskControllerUpdate } from "../../api/generated/clients/taskControllerUpdate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTagReference } from "../../lib/tag-ref-resolver/index.ts";
import { resolveTaskReference } from "../../lib/task-ref-resolver/index.ts";

type TagOperation = "add" | "remove";

function exitWithTaskCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createTaskTagPayload(currentTags: string[], tagId: string, operation: TagOperation): TaskControllerUpdateMutationRequest {
  const tagSet = new Set(currentTags.filter(Boolean));

  if (operation === "add") {
    tagSet.add(tagId);
  } else {
    tagSet.delete(tagId);
  }

  return { tags: [...tagSet] };
}

export const taskTagCommand = defineCommand({
  meta: {
    name: "tag",
    description: "Attach or detach a tag on a task",
  },
  args: {
    reference: {
      type: "positional",
      description: "Task raw id, short id, or @alias",
      required: true,
    },
    operation: {
      type: "positional",
      description: "Operation: add or remove",
      required: true,
    },
    tag: {
      type: "positional",
      description: "Tag raw id or exact title",
      required: true,
    },
  },
  async run({ args }) {
    const operation = args.operation as TagOperation;

    if (operation !== "add" && operation !== "remove") {
      exitWithTaskCommandError(new Error("Operation must be `add` or `remove`."));
      return;
    }

    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const resolvedTask = await resolveTaskReference(args.reference);
      const resolvedTag = await resolveTagReference(args.tag);
      const currentTask = await taskControllerGetById({ id: resolvedTask.id }, { client });
      const updatedTask = await taskControllerUpdate(
        {
          id: resolvedTask.id,
          data: createTaskTagPayload(currentTask.tags ?? [], resolvedTag.id, operation),
        },
        { client },
      );

      if (resolvedTask.kind !== "raw") {
        console.log(`Resolved task ${resolvedTask.input} -> ${resolvedTask.id}`);
      }

      console.log(`${operation === "add" ? "Attached" : "Detached"} tag ${resolvedTag.title} (${resolvedTag.id}) ${operation === "add" ? "to" : "from"} task: ${updatedTask.title} (${updatedTask.id})`);
      console.log(`Tags: ${(updatedTask.tags ?? []).length > 0 ? updatedTask.tags.join(", ") : "-"}`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTaskCommandError(new Error("Authentication failed while updating task tags. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error) && error.status === 404) {
        exitWithTaskCommandError(new Error("Task or tag was not found while updating task tags."));
        return;
      }

      exitWithTaskCommandError(error);
    }
  },
});
