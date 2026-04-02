// FILE: src/lib/project-ref-resolver/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve user-facing project references expressed as raw ids, numeric SIDs, or `@alias` strings.
//   SCOPE: Project reference classification, SID resolution, alias resolution, and user-facing resolution errors.
//   DEPENDS: src/lib/auth/index.ts, src/lib/project-ref-cache/index.ts, src/lib/project-alias-store/index.ts
//   LINKS: M-PROJECT-REF-RESOLVER, M-PROJECT-REF-CACHE, M-PROJECT-ALIAS-STORE, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   isProjectSid - Detect numeric SID references from the last list output.
//   isProjectAlias - Detect `@alias` project references.
//   resolveProjectReference - Resolve a raw id, SID, or alias into a project id plus metadata.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added project reference resolution across raw ids, SIDs, and aliases.]
// END_CHANGE_SUMMARY

import { requireAuthContext, type AuthRuntime } from "../auth/index.ts";
import { getProjectAlias, normalizeProjectAliasName } from "../project-alias-store/index.ts";
import { resolveProjectSid } from "../project-ref-cache/index.ts";

export type ResolvedProjectReference = {
  kind: "raw" | "sid" | "alias";
  input: string;
  id: string;
  sid?: string;
  aliasName?: string;
  title?: string;
};

// START_CONTRACT: isProjectSid
//   PURPOSE: Check whether a user reference is a numeric SID from the last project list output.
//   INPUTS: { reference: string - User-provided project reference. }
//   OUTPUTS: { boolean - Whether the reference is a numeric SID. }
//   SIDE_EFFECTS: none
//   LINKS: M-PROJECT-REF-RESOLVER
// END_CONTRACT: isProjectSid
export function isProjectSid(reference: string): boolean {
  return /^[1-9]\d*$/.test(reference.trim());
}

// START_CONTRACT: isProjectAlias
//   PURPOSE: Check whether a user reference is an `@alias`.
//   INPUTS: { reference: string - User-provided project reference. }
//   OUTPUTS: { boolean - Whether the reference starts with `@` and contains an alias body. }
//   SIDE_EFFECTS: none
//   LINKS: M-PROJECT-REF-RESOLVER
// END_CONTRACT: isProjectAlias
export function isProjectAlias(reference: string): boolean {
  const normalizedReference = reference.trim();
  return normalizedReference.startsWith("@") && normalizedReference.length > 1;
}

// START_CONTRACT: resolveProjectReference
//   PURPOSE: Resolve a user-facing project reference into a raw Singularity project id plus metadata.
//   INPUTS: { reference: string - Raw id, SID, or alias reference. runtime: AuthRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ResolvedProjectReference> - Resolved raw project id plus reference metadata. }
//   SIDE_EFFECTS: Reads auth state, alias storage, and SID cache from disk.
//   LINKS: M-PROJECT-REF-RESOLVER
// END_CONTRACT: resolveProjectReference
export async function resolveProjectReference(
  reference: string,
  runtime: AuthRuntime = {},
): Promise<ResolvedProjectReference> {
  const normalizedReference = reference.trim();

  if (!normalizedReference) {
    throw new Error("Project reference is empty.");
  }

  const authContext = await requireAuthContext(runtime);

  // START_BLOCK_RESOLVE_PROJECT_REFERENCE
  if (isProjectAlias(normalizedReference)) {
    const aliasName = normalizeProjectAliasName(normalizedReference.slice(1));
    const projectId = await getProjectAlias(authContext.tokenFingerprint, aliasName, runtime);

    if (!projectId) {
      throw new Error(
        `Project alias "@${aliasName}" is unknown. Run \`singu project alias list\` or create it with \`singu project alias set ${aliasName} <reference>\`.`,
      );
    }

    return {
      kind: "alias",
      input: normalizedReference,
      id: projectId,
      aliasName,
    };
  }

  if (isProjectSid(normalizedReference)) {
    const projectItem = await resolveProjectSid(authContext.tokenFingerprint, normalizedReference, runtime);

    if (!projectItem) {
      throw new Error(`Short ID "${normalizedReference}" is unknown. Run \`singu project list\` first or pass a full project ID.`);
    }

    return {
      kind: "sid",
      input: normalizedReference,
      id: projectItem.id,
      sid: projectItem.sid,
      title: projectItem.title,
    };
  }

  if (normalizedReference.startsWith("id:")) {
    const rawId = normalizedReference.slice(3).trim();

    if (!rawId) {
      throw new Error("Project reference after `id:` is empty.");
    }

    return {
      kind: "raw",
      input: normalizedReference,
      id: rawId,
    };
  }

  return {
    kind: "raw",
    input: normalizedReference,
    id: normalizedReference,
  };
  // END_BLOCK_RESOLVE_PROJECT_REFERENCE
}
