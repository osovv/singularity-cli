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
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    const byTitle = new Map(tags.map((tag) => [tag.title, tag]));
    let current: (typeof tags)[number] | undefined = byTitle.get(pathSegments[0] ?? "");

    for (const segment of pathSegments.slice(1)) {
      if (!current) {
        break;
      }

      current = tags.find((tag) => tag.parent === current!.id && tag.title === segment);
    }

    if (current) {
      return { kind: "title", input, id: current.id, title: current.title };
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
