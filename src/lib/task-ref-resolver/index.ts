// FILE: src/lib/task-ref-resolver/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve user-facing task references expressed as raw ids, numeric SIDs, or `@alias` strings.
//   SCOPE: Task reference classification, SID resolution, alias resolution, and user-facing resolution errors.
//   DEPENDS: src/lib/auth/index.ts, src/lib/task-ref-cache/index.ts, src/lib/task-alias-store/index.ts
//   LINKS: M-TASK-REF-RESOLVER, M-TASK-REF-CACHE, M-TASK-ALIAS-STORE, M-AUTH-RUNTIME
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   isTaskSid - Detect numeric SID references from the last task list output.
//   isTaskAlias - Detect `@alias` task references.
//   resolveTaskReference - Resolve a raw id, SID, or alias into a task id plus metadata.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added task reference resolution across raw ids, SIDs, and aliases.]
// END_CHANGE_SUMMARY

import { requireAuthContext, type AuthRuntime } from "../auth/index.ts";
import { getTaskAlias, normalizeTaskAliasName } from "../task-alias-store/index.ts";
import { resolveTaskSid } from "../task-ref-cache/index.ts";

export type ResolvedTaskReference = {
  kind: "raw" | "sid" | "alias";
  input: string;
  id: string;
  sid?: string;
  aliasName?: string;
  title?: string;
};

export function isTaskSid(reference: string): boolean {
  return /^[1-9]\d*$/.test(reference.trim());
}

export function isTaskAlias(reference: string): boolean {
  const normalizedReference = reference.trim();
  return normalizedReference.startsWith("@") && normalizedReference.length > 1;
}

export async function resolveTaskReference(reference: string, runtime: AuthRuntime = {}): Promise<ResolvedTaskReference> {
  const normalizedReference = reference.trim();

  if (!normalizedReference) {
    throw new Error("Task reference is empty.");
  }

  const authContext = await requireAuthContext(runtime);

  // START_BLOCK_RESOLVE_TASK_REFERENCE
  if (isTaskAlias(normalizedReference)) {
    const aliasName = normalizeTaskAliasName(normalizedReference.slice(1));
    const taskId = await getTaskAlias(authContext.tokenFingerprint, aliasName, runtime);

    if (!taskId) {
      throw new Error(
        `Task alias "@${aliasName}" is unknown. Run \`singu task alias list\` or create it with \`singu task alias set ${aliasName} <reference>\`.`,
      );
    }

    return {
      kind: "alias",
      input: normalizedReference,
      id: taskId,
      aliasName,
    };
  }

  if (isTaskSid(normalizedReference)) {
    const taskItem = await resolveTaskSid(authContext.tokenFingerprint, normalizedReference, runtime);

    if (!taskItem) {
      throw new Error(`Short ID "${normalizedReference}" is unknown. Run \`singu task list\` first or pass a full task ID.`);
    }

    return {
      kind: "sid",
      input: normalizedReference,
      id: taskItem.id,
      sid: taskItem.sid,
      title: taskItem.title,
    };
  }

  if (normalizedReference.startsWith("id:")) {
    const rawId = normalizedReference.slice(3).trim();

    if (!rawId) {
      throw new Error("Task reference after `id:` is empty.");
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
  // END_BLOCK_RESOLVE_TASK_REFERENCE
}
