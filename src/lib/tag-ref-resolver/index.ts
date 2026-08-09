// FILE: src/lib/tag-ref-resolver/index.ts
// VERSION: 1.0.0
// PURPOSE: Resolve tag references (raw A- id or exact title) into stable tag identity.
// SCOPE: Raw-id detection, title-based lookup, and unified resolution output.

import { tagControllerGetById } from "../../api/generated/clients/tagControllerGetById.ts";
import { tagControllerList } from "../../api/generated/clients/tagControllerList.ts";
import { requireAuthContext } from "../auth/index.ts";
import { createAuthorizedClient } from "../http/index.ts";

export type ResolvedTagReference = {
  kind: "raw" | "title";
  input: string;
  id: string;
  title: string;
};

export function isTagRawId(reference: string): boolean {
  return /^A-[0-9a-fA-F-]+$/.test(reference.trim());
}

export type TagPathNode = {
  id: string;
  title: string;
  parent: string;
  removed: boolean;
};

// START_CONTRACT: findTagByPath
//   PURPOSE: Resolve a nested tag path like `state/waiting` by walking the parent chain (pure, no I/O).
//   INPUTS: { tags: TagPathNode[] - Flat tag list. path: string - Slash-separated path. }
//   OUTPUTS: { TagPathNode | undefined - Resolved tag or undefined. }
//   SIDE_EFFECTS: none
// END_CONTRACT: findTagByPath
export function findTagByPath(tags: TagPathNode[], path: string): TagPathNode | undefined {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return undefined;
  }

  const visible = tags.filter((tag) => !tag.removed);
  let current: TagPathNode | undefined = visible.find((tag) => tag.title === segments[0] && !tag.parent);

  if (!current) {
    current = visible.find((tag) => tag.title === segments[0]);
  }

  for (const segment of segments.slice(1)) {
    if (!current) {
      return undefined;
    }

    current = visible.find((tag) => tag.parent === current!.id && tag.title === segment);
  }

  return current;
}

// START_CONTRACT: resolveTagReference
//   PURPOSE: Resolve a tag reference (raw id, exact title, or nested path like `state/waiting`) to a stable tag.
//   INPUTS: { reference: string - Tag raw id (A-...), exact title, or parent/child path. runtime: { token?: string } - Optional auth override. }
//   OUTPUTS: { ResolvedTagReference - Resolved tag identity. }
//   SIDE_EFFECTS: Performs authenticated API reads when resolving by title or validating a raw id.
// END_CONTRACT: resolveTagReference
export async function resolveTagReference(
  reference: string,
  runtime: { token?: string } = {},
): Promise<ResolvedTagReference> {
  const input = reference.trim();

  if (!input) {
    throw new Error("Tag reference is empty.");
  }

  const authContext = runtime.token ? { token: runtime.token, tokenFingerprint: "" } : await requireAuthContext();
  const client = createAuthorizedClient(authContext.token);

  if (isTagRawId(input)) {
    const tag = await tagControllerGetById({ id: input }, { client });
    return { kind: "raw", input, id: tag.id, title: tag.title };
  }

  const response = await tagControllerList({}, { client });
  const tags = response.tags.filter((tag) => !tag.removed);

  // Nested path support: "state/waiting" walks the parent chain.
  const pathSegments = input.split("/").filter(Boolean);

  if (pathSegments.length > 1) {
    const found = findTagByPath(response.tags, input);

    if (found) {
      return { kind: "title", input, id: found.id, title: found.title };
    }

    throw new Error(`Tag path not found: ${input}. List tags with \`singu tag list\`.`);
  }

  for (const tag of tags) {
    if (tag.title === input) {
      return { kind: "title", input, id: tag.id, title: tag.title };
    }
  }

  throw new Error(`Tag not found by title: ${input}. List tags with \`singu tag list\`.`);
}
