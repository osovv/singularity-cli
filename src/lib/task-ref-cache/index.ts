// FILE: src/lib/task-ref-cache/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist and resolve the most recent task list context as account-scoped SID mappings.
//   SCOPE: Task list cache normalization, cache reads, cache writes, and numeric SID resolution.
//   DEPENDS: node:fs/promises, src/lib/storage/index.ts
//   LINKS: M-TASK-REF-CACHE, M-TASK-REF-RESOLVER
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   saveTaskListContext - Persist the current task SID context to cache storage.
//   loadTaskListContext - Load the account-scoped task SID cache.
//   resolveTaskSid - Resolve a numeric SID from the saved task list context.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added account-scoped task SID cache persistence and lookup.]
// END_CHANGE_SUMMARY

import { readFile } from "node:fs/promises";

import { resolveStoragePaths, type StorageRuntime, writeJsonFileAtomic } from "../storage/index.ts";

export type TaskListContextItem = {
  sid: string;
  id: string;
  title: string;
  projectId?: string;
  checked?: number;
  deadline?: string;
};

export type TaskLastListCache = {
  version: 1;
  entity: "task";
  generatedAt: string;
  accountFingerprint: string;
  command: string;
  items: TaskListContextItem[];
};

export type TaskListContextInput = {
  accountFingerprint: string;
  command: string;
  items: TaskListContextItem[];
};

function normalizeTaskListContextItem(input: unknown): TaskListContextItem {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Task list context items must be objects.");
  }

  const record = input as Record<string, unknown>;

  if (typeof record.sid !== "string" || typeof record.id !== "string" || typeof record.title !== "string") {
    throw new Error("Task list context items must contain string sid, id, and title fields.");
  }

  const normalizedItem: TaskListContextItem = {
    sid: record.sid.trim(),
    id: record.id.trim(),
    title: record.title.trim(),
  };

  if (!normalizedItem.sid || !normalizedItem.id || !normalizedItem.title) {
    throw new Error("Task list context items must not contain empty sid, id, or title fields.");
  }

  if (typeof record.projectId === "string" && record.projectId.trim()) {
    normalizedItem.projectId = record.projectId.trim();
  }

  if (typeof record.checked === "number") {
    normalizedItem.checked = record.checked;
  }

  if (typeof record.deadline === "string" && record.deadline.trim()) {
    normalizedItem.deadline = record.deadline.trim();
  }

  return normalizedItem;
}

function normalizeTaskLastListCache(input: unknown): TaskLastListCache {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Task last-list cache must be a JSON object.");
  }

  const record = input as Record<string, unknown>;

  if (
    record.version !== 1 ||
    record.entity !== "task" ||
    typeof record.generatedAt !== "string" ||
    typeof record.accountFingerprint !== "string" ||
    typeof record.command !== "string" ||
    !Array.isArray(record.items)
  ) {
    throw new Error("Task last-list cache has an invalid shape.");
  }

  return {
    version: 1,
    entity: "task",
    generatedAt: record.generatedAt,
    accountFingerprint: record.accountFingerprint,
    command: record.command,
    items: record.items.map(normalizeTaskListContextItem),
  };
}

export async function saveTaskListContext(input: TaskListContextInput, runtime: StorageRuntime = {}): Promise<TaskLastListCache> {
  const { taskLastListCacheFilePath } = resolveStoragePaths(runtime);
  const cache: TaskLastListCache = {
    version: 1,
    entity: "task",
    generatedAt: new Date().toISOString(),
    accountFingerprint: input.accountFingerprint.trim(),
    command: input.command.trim(),
    items: input.items.map(normalizeTaskListContextItem),
  };

  if (!cache.accountFingerprint || !cache.command) {
    throw new Error("Task list cache requires a non-empty account fingerprint and command string.");
  }

  // START_BLOCK_SAVE_TASK_LIST_CONTEXT
  await writeJsonFileAtomic(taskLastListCacheFilePath, cache, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });

  return cache;
  // END_BLOCK_SAVE_TASK_LIST_CONTEXT
}

export async function loadTaskListContext(accountFingerprint: string, runtime: StorageRuntime = {}): Promise<TaskLastListCache | undefined> {
  const { taskLastListCacheFilePath } = resolveStoragePaths(runtime);

  try {
    const fileContents = await readFile(taskLastListCacheFilePath, "utf8");
    const parsedCache = normalizeTaskLastListCache(JSON.parse(fileContents) as unknown);

    return parsedCache.accountFingerprint === accountFingerprint ? parsedCache : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse task SID cache at ${taskLastListCacheFilePath}.`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read task SID cache at ${taskLastListCacheFilePath}: ${error.message}`);
    }

    throw new Error(`Failed to read task SID cache at ${taskLastListCacheFilePath}.`);
  }
}

export async function resolveTaskSid(accountFingerprint: string, sid: string, runtime: StorageRuntime = {}): Promise<TaskListContextItem | undefined> {
  const cache = await loadTaskListContext(accountFingerprint, runtime);

  return cache?.items.find((item) => item.sid === sid.trim());
}
