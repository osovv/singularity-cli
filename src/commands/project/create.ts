// FILE: src/commands/project/create.ts
// VERSION: 1.0.0
// PURPOSE: Create a project from a title and optional note.

import { defineCommand } from "citty";

import type { ProjectControllerCreateMutationRequest } from "../../api/generated/models/ProjectControllerCreate.ts";
import { projectControllerCreate } from "../../api/generated/clients/projectControllerCreate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createProjectCreatePayload(title: string, note: string | undefined): ProjectControllerCreateMutationRequest {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("Project title is empty.");
  }

  return {
    title: normalizedTitle,
    ...(note !== undefined ? { note } : {}),
  };
}

export const projectCreateCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a project from a title and optional note",
  },
  args: {
    title: {
      type: "positional",
      description: "Project title",
      required: true,
    },
    note: {
      type: "string",
      description: "Optional project note",
    },
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human message",
    },
  },
  async run({ args }) {
    try {
      const authContext = await requireAuthContext();
      const client = createAuthorizedClient(authContext.token);
      const createdProject = await projectControllerCreate(
        { data: createProjectCreatePayload(args.title, args.note) },
        { client },
      );

      if (args.json) {
        console.log(JSON.stringify(createdProject, null, 2));
        return;
      }

      console.log(`Created project: ${createdProject.project.title} (${createdProject.project.id})`);
      if (createdProject.taskGroup) {
        console.log(`Default group: ${createdProject.taskGroup.id}`);
      }
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithProjectCommandError(new Error("Authentication failed while creating the project. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithProjectCommandError(error);
    }
  },
});
