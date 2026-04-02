// FILE: src/commands/block.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Create a scheduled focus block as a new task that starts now and ends after a parsed duration.
//   SCOPE: Duration parsing, optional project resolution, authenticated task creation, and user-facing block output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/project-ref-resolver/index.ts, src/lib/time/index.ts, src/api/generated/clients/taskControllerCreate.ts
//   LINKS: M-BLOCK-COMMAND, M-PROJECT-REF-RESOLVER, M-TIME-UTILS, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   createBlockTaskPayload - Build the task creation payload for a new focus block.
//   blockCommand - Top-level `singu block` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added top-level `block` for immediate scheduled focus-block creation.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import type { TaskControllerCreateMutationRequest } from "../api/generated/models/TaskControllerCreate.ts";
import { taskControllerCreate } from "../api/generated/clients/taskControllerCreate.ts";
import { requireAuthContext } from "../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../lib/http/index.ts";
import { resolveProjectReference } from "../lib/project-ref-resolver/index.ts";
import { addMinutes, parseDurationMinutes } from "../lib/time/index.ts";

function exitWithBlockCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// START_CONTRACT: createBlockTaskPayload
//   PURPOSE: Build the task creation payload for an immediate focus block.
//   INPUTS: { title: string - Block title. projectId: string | undefined - Optional resolved project id. start: Date - Start time. durationMinutes: number - Block duration in minutes. }
//   OUTPUTS: { TaskControllerCreateMutationRequest - Task creation payload for the new focus block. }
//   SIDE_EFFECTS: none
//   LINKS: M-BLOCK-COMMAND
// END_CONTRACT: createBlockTaskPayload
export function createBlockTaskPayload(options: {
  title: string;
  projectId?: string;
  start: Date;
  durationMinutes: number;
}): TaskControllerCreateMutationRequest {
  const normalizedTitle = options.title.trim();

  if (!normalizedTitle) {
    throw new Error("Block title is empty.");
  }

  return {
    title: normalizedTitle,
    ...(options.projectId ? { projectId: options.projectId } : {}),
    start: options.start.toISOString(),
    deadline: addMinutes(options.start, options.durationMinutes).toISOString(),
    useTime: true,
    timeLength: options.durationMinutes,
  };
}

export const blockCommand = defineCommand({
  meta: {
    name: "block",
    description: "Create a scheduled focus block starting now",
  },
  args: {
    duration: {
      type: "positional",
      description: "Duration such as 30m, 1h, or 1h30m",
      required: true,
    },
    title: {
      type: "positional",
      description: "Task title for the new block",
      required: true,
    },
    project: {
      type: "string",
      description: "Optional project raw id, short id, or @alias",
      valueHint: "project-ref",
    },
  },
  // START_BLOCK_EXECUTE_BLOCK_CREATE
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const durationMinutes = parseDurationMinutes(args.duration);
      const resolvedProject = args.project ? await resolveProjectReference(args.project) : undefined;
      const createdTask = await taskControllerCreate(
        {
          data: createBlockTaskPayload({
            title: args.title,
            start: new Date(),
            durationMinutes,
            ...(resolvedProject ? { projectId: resolvedProject.id } : {}),
          }),
        },
        { client },
      );

      if (resolvedProject) {
        console.log(`Resolved project ${args.project} -> ${resolvedProject.id}`);
      }

      console.log(`Created block: ${createdTask.title} (${createdTask.id})`);
      console.log(`Start: ${createdTask.start}`);
      console.log(`Deadline: ${createdTask.deadline}`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithBlockCommandError(new Error("Authentication failed while creating the block. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      if (isApiClientError(error)) {
        exitWithBlockCommandError(new Error(`Failed to create the block: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithBlockCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_BLOCK_CREATE
});
