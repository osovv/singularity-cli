// FILE: src/lib/project-ref-cache/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist and resolve the most recent project list context as account-scoped SID mappings.
//   SCOPE: Project list cache normalization, cache reads, cache writes, and numeric SID resolution.
//   DEPENDS: node:fs/promises, src/lib/storage/index.ts
//   LINKS: M-PROJECT-REF-CACHE, M-PROJECT-REF-RESOLVER
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   saveProjectListContext - Persist the current project SID context to cache storage.
//   loadProjectListContext - Load the account-scoped project SID cache.
//   resolveProjectSid - Resolve a numeric SID from the saved project list context.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added account-scoped project SID cache persistence and lookup.]
// END_CHANGE_SUMMARY

import { readFile } from "node:fs/promises";

import { resolveStoragePaths, type StorageRuntime, writeJsonFileAtomic } from "../storage/index.ts";

export type ProjectListContextItem = {
  sid: string;
  id: string;
  title: string;
  emoji?: string;
  isNotebook?: boolean;
};

export type ProjectLastListCache = {
  version: 1;
  entity: "project";
  generatedAt: string;
  accountFingerprint: string;
  command: string;
  items: ProjectListContextItem[];
};

export type ProjectListContextInput = {
  accountFingerprint: string;
  command: string;
  items: ProjectListContextItem[];
};

function normalizeProjectListContextItem(input: unknown): ProjectListContextItem {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Project list context items must be objects.");
  }

  const record = input as Record<string, unknown>;

  if (typeof record.sid !== "string" || typeof record.id !== "string" || typeof record.title !== "string") {
    throw new Error("Project list context items must contain string sid, id, and title fields.");
  }

  const normalizedItem: ProjectListContextItem = {
    sid: record.sid.trim(),
    id: record.id.trim(),
    title: record.title.trim(),
  };

  if (!normalizedItem.sid || !normalizedItem.id || !normalizedItem.title) {
    throw new Error("Project list context items must not contain empty sid, id, or title fields.");
  }

  if (typeof record.emoji === "string" && record.emoji.trim()) {
    normalizedItem.emoji = record.emoji.trim();
  }

  if (typeof record.isNotebook === "boolean") {
    normalizedItem.isNotebook = record.isNotebook;
  }

  return normalizedItem;
}

function normalizeProjectLastListCache(input: unknown): ProjectLastListCache {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Project last-list cache must be a JSON object.");
  }

  const record = input as Record<string, unknown>;

  if (
    record.version !== 1 ||
    record.entity !== "project" ||
    typeof record.generatedAt !== "string" ||
    typeof record.accountFingerprint !== "string" ||
    typeof record.command !== "string" ||
    !Array.isArray(record.items)
  ) {
    throw new Error("Project last-list cache has an invalid shape.");
  }

  return {
    version: 1,
    entity: "project",
    generatedAt: record.generatedAt,
    accountFingerprint: record.accountFingerprint,
    command: record.command,
    items: record.items.map(normalizeProjectListContextItem),
  };
}

// START_CONTRACT: saveProjectListContext
//   PURPOSE: Persist the latest project list result as SID context for the active account.
//   INPUTS: { input: ProjectListContextInput - Account fingerprint, command string, and project rows. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ProjectLastListCache> - Saved project list cache payload. }
//   SIDE_EFFECTS: Writes the cache file to local cache storage.
//   LINKS: M-PROJECT-REF-CACHE
// END_CONTRACT: saveProjectListContext
export async function saveProjectListContext(
  input: ProjectListContextInput,
  runtime: StorageRuntime = {},
): Promise<ProjectLastListCache> {
  const { projectLastListCacheFilePath } = resolveStoragePaths(runtime);
  const cache: ProjectLastListCache = {
    version: 1,
    entity: "project",
    generatedAt: new Date().toISOString(),
    accountFingerprint: input.accountFingerprint.trim(),
    command: input.command.trim(),
    items: input.items.map(normalizeProjectListContextItem),
  };

  if (!cache.accountFingerprint || !cache.command) {
    throw new Error("Project list cache requires a non-empty account fingerprint and command string.");
  }

  // START_BLOCK_SAVE_PROJECT_LIST_CONTEXT
  await writeJsonFileAtomic(projectLastListCacheFilePath, cache, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });

  return cache;
  // END_BLOCK_SAVE_PROJECT_LIST_CONTEXT
}

// START_CONTRACT: loadProjectListContext
//   PURPOSE: Load the current project SID cache for a given account fingerprint.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ProjectLastListCache | undefined> - Matching project SID cache or undefined when absent or scoped to another account. }
//   SIDE_EFFECTS: Reads the cache file from disk when present.
//   LINKS: M-PROJECT-REF-CACHE
// END_CONTRACT: loadProjectListContext
export async function loadProjectListContext(
  accountFingerprint: string,
  runtime: StorageRuntime = {},
): Promise<ProjectLastListCache | undefined> {
  const { projectLastListCacheFilePath } = resolveStoragePaths(runtime);

  try {
    const fileContents = await readFile(projectLastListCacheFilePath, "utf8");
    const parsedCache = normalizeProjectLastListCache(JSON.parse(fileContents) as unknown);

    return parsedCache.accountFingerprint === accountFingerprint ? parsedCache : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse project SID cache at ${projectLastListCacheFilePath}.`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read project SID cache at ${projectLastListCacheFilePath}: ${error.message}`);
    }

    throw new Error(`Failed to read project SID cache at ${projectLastListCacheFilePath}.`);
  }
}

// START_CONTRACT: resolveProjectSid
//   PURPOSE: Resolve a numeric SID into a cached project context item.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. sid: string - Numeric SID from the last list output. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ProjectListContextItem | undefined> - Matching project context item when found. }
//   SIDE_EFFECTS: Reads the cache file from disk when present.
//   LINKS: M-PROJECT-REF-CACHE, M-PROJECT-REF-RESOLVER
// END_CONTRACT: resolveProjectSid
export async function resolveProjectSid(
  accountFingerprint: string,
  sid: string,
  runtime: StorageRuntime = {},
): Promise<ProjectListContextItem | undefined> {
  const cache = await loadProjectListContext(accountFingerprint, runtime);

  return cache?.items.find((item) => item.sid === sid.trim());
}
