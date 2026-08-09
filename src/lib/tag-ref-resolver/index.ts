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
//   PURPOSE: Resolve a tag reference (raw id or exact title) to a stable tag.
//   INPUTS: { reference: string - Tag raw id (A-...) or exact title. runtime: { token?: string } - Optional auth override. }
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

  for (const tag of response.tags) {
    if (tag.title === input && !tag.removed) {
      return { kind: "title", input, id: tag.id, title: tag.title };
    }
  }

  throw new Error(`Tag not found by title: ${input}. List tags with \`singu tag list\`.`);
}
