// FILE: src/commands/tag/create.ts
// VERSION: 1.0.0
// PURPOSE: Create a tag, optionally nested under a parent tag.

import { defineCommand } from "citty";

import type { TagControllerCreateMutationRequest } from "../../api/generated/models/TagControllerCreate.ts";
import { tagControllerCreate } from "../../api/generated/clients/tagControllerCreate.ts";
import { requireAuthContext } from "../../lib/auth/index.ts";
import { createAuthorizedClient, isApiClientError } from "../../lib/http/index.ts";
import { resolveTagReference } from "../../lib/tag-ref-resolver/index.ts";

function exitWithTagCommandError(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function createTagCreatePayload(title: string, parentId: string | undefined): TagControllerCreateMutationRequest {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("Tag title is empty.");
  }

  return {
    title: normalizedTitle,
    ...(parentId ? { parent: parentId } : {}),
  };
}

export const tagCreateCommand = defineCommand({
  meta: {
    name: "create",
    description: "Create a tag, optionally nested under a parent tag",
  },
  args: {
    title: {
      type: "positional",
      description: "Tag title",
      required: true,
    },
    parent: {
      type: "string",
      description: "Parent tag raw id or exact title",
      valueHint: "tag-ref",
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
      const resolvedParent = args.parent ? await resolveTagReference(args.parent) : undefined;
      const createdTag = await tagControllerCreate(
        {
          data: createTagCreatePayload(args.title, resolvedParent?.id),
        },
        { client },
      );

      if (args.json) {
        console.log(JSON.stringify(createdTag, null, 2));
        return;
      }

      if (resolvedParent) {
        console.log(`Resolved parent tag ${args.parent} -> ${resolvedParent.id}`);
      }

      console.log(`Created tag: ${createdTag.title} (${createdTag.id})`);
    } catch (error) {
      if (isApiClientError(error) && error.status === 401) {
        exitWithTagCommandError(new Error("Authentication failed while creating the tag. Run `singu auth status --check` or `singu auth login`."));
        return;
      }

      exitWithTagCommandError(error);
    }
  },
});
