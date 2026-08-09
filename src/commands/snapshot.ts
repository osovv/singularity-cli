// FILE: src/commands/snapshot.ts
// VERSION: 1.0.0
// PURPOSE: Aggregate read of the full Singularity state for deterministic consumption by Hermes.

import { defineCommand } from "citty";

import { projectControllerList } from "../api/generated/clients/projectControllerList.ts";
import { tagControllerList } from "../api/generated/clients/tagControllerList.ts";
import { taskControllerList } from "../api/generated/clients/taskControllerList.ts";
import { taskGroupControllerList } from "../api/generated/clients/taskGroupControllerList.ts";
import { requireAuthContext } from "../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../lib/http/index.ts";

function exitWithSnapshotError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

export const snapshotCommand = defineCommand({
  meta: {
    name: "snapshot",
    description: "Dump the full Singularity state (projects, tags, groups, tasks) as JSON",
  },
  args: {
    archived: {
      type: "boolean",
      description: "Include archived projects",
    },
    removed: {
      type: "boolean",
      description: "Include removed tasks",
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const [projectResponse, tagResponse, groupResponse, taskResponse] = await Promise.all([
        projectControllerList(
          { params: { ...(args.archived ? { includeArchived: true } : {}) } },
          { client },
        ),
        tagControllerList({}, { client }),
        taskGroupControllerList({}, { client }),
        taskControllerList(
          { params: { ...(args.removed ? { includeRemoved: true } : {}) } },
          { client },
        ),
      ]);

      const snapshot = {
        generatedAt: new Date().toISOString(),
        projects: projectResponse.projects,
        tags: tagResponse.tags,
        groups: groupResponse.taskGroups,
        tasks: taskResponse.tasks,
      };

      console.log(JSON.stringify(snapshot, null, 2));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithSnapshotError(new Error("Authentication failed while building the snapshot. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithSnapshotError(error);
    }
  },
});
