// FILE: src/commands/project/get.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Fetch and render a single project by raw id, SID, or alias.
//   SCOPE: Project reference resolution, project fetch execution, human output, and JSON output.
//   DEPENDS: citty, src/lib/auth/index.ts, src/lib/http/index.ts, src/lib/project-ref-resolver/index.ts, src/api/generated/clients/projectControllerGetById.ts
//   LINKS: M-PROJECT-COMMANDS-READ, M-PROJECT-REF-RESOLVER, M-HTTP-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   projectGetCommand - `singu project get` command definition.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added `project get` with raw id, SID, and alias resolution.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { projectControllerGetById } from "../../api/generated/clients/projectControllerGetById.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveProjectReference } from "../../lib/project-ref-resolver/index.ts";

function exitWithProjectCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function formatProjectOutput(project: {
  id: string;
  title: string;
  note?: string;
  emoji?: string;
  color?: string;
  parent?: string;
  parentOrder?: number;
  isNotebook?: boolean;
  start?: string;
  end?: string;
  reviewValidationDate?: string;
  reviewValidationInterval?: number;
  journalDate?: string;
}): string {
  const lines = [
    `Title: ${project.title}`,
    `ID: ${project.id}`,
    `Emoji: ${project.emoji ?? "-"}`,
    `Color: ${project.color ?? "-"}`,
    `Notebook: ${project.isNotebook ? "yes" : "no"}`,
    `Parent: ${project.parent ?? "-"}`,
    `Parent Order: ${project.parentOrder ?? "-"}`,
    `Start: ${project.start ?? "-"}`,
    `End: ${project.end ?? "-"}`,
    `Review Date: ${project.reviewValidationDate ?? "-"}`,
    `Review Interval: ${project.reviewValidationInterval ?? "-"}`,
    `Archived At: ${project.journalDate ?? "-"}`,
  ];

  if (project.note) {
    lines.push(`Note: ${project.note}`);
  }

  return lines.join("\n");
}

export const projectGetCommand = defineCommand({
  meta: {
    name: "get",
    description: "Get a project by raw id, short id, or alias",
  },
  args: {
    reference: {
      type: "positional",
      description: "Project raw id, short id, or @alias",
      required: true,
    },
    json: {
      type: "boolean",
      description: "Render JSON output instead of the human view",
    },
  },
  // START_BLOCK_EXECUTE_PROJECT_GET
  async run({ args }) {
    let resolvedProjectId = args.reference;

    try {
      const authContext = await requireAuthContext();
      const resolvedReference = await resolveProjectReference(args.reference);
      resolvedProjectId = resolvedReference.id;
      const client = createAuthorizedClient(authContext.token);
      const project = await projectControllerGetById({ id: resolvedReference.id }, { client });

      if (args.json) {
        console.log(
          JSON.stringify(
            {
              reference: resolvedReference,
              project,
            },
            null,
            2,
          ),
        );
        return;
      }

      if (resolvedReference.kind !== "raw") {
        console.log(`Resolved ${resolvedReference.input} -> ${resolvedReference.id}`);
      }

      console.log(formatProjectOutput(project));
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        throw new Error("Authentication failed while fetching the project. Run `singu auth status --check` or `singu auth login`.");
      }

      if (isApiClientError(error) && error.status === 404) {
        throw new Error(`Project "${resolvedProjectId}" was not found.`);
      }

      if (isApiClientError(error)) {
        exitWithProjectCommandError(new Error(`Failed to fetch the project: ${error.status} ${error.statusText}.`));
        return;
      }

      exitWithProjectCommandError(error);
    }
  },
  // END_BLOCK_EXECUTE_PROJECT_GET
});
