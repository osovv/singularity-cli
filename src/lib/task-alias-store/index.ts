// FILE: src/lib/task-alias-store/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist stable named task aliases in config storage and scope them to the active account fingerprint.
//   SCOPE: Alias name normalization, alias reads, alias writes, alias listing, and alias removal.
//   DEPENDS: node:fs/promises, src/lib/storage/index.ts
//   LINKS: M-TASK-ALIAS-STORE, M-TASK-REF-RESOLVER, M-PROJECT-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   normalizeTaskAliasName - Validate and normalize user-provided task alias names.
//   setTaskAlias - Persist or replace a task alias for the active account.
//   listTaskAliases - List saved task aliases for the active account.
//   removeTaskAlias - Remove a saved task alias for the active account.
//   getTaskAlias - Resolve a saved alias name to a raw task id.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added account-scoped task alias persistence in shared config storage.]
// END_CHANGE_SUMMARY

import { readFile, rm } from "node:fs/promises";

import { resolveStoragePaths, type StorageRuntime, writeJsonFileAtomic } from "../storage/index.ts";

export type TaskAliasEntry = {
  name: string;
  id: string;
};

type TaskAliasesFile = {
  version: 1;
  accounts: Record<string, { projects: Record<string, string>; tasks: Record<string, string> }>;
};

function createEmptyTaskAliasesFile(): TaskAliasesFile {
  return {
    version: 1,
    accounts: {},
  };
}

function normalizeTaskAliasesFile(input: unknown): TaskAliasesFile {
  if (input === undefined || input === null) {
    return createEmptyTaskAliasesFile();
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Task aliases file must be a JSON object.");
  }

  const record = input as Record<string, unknown>;

  if (record.version !== 1 || typeof record.accounts !== "object" || record.accounts === null || Array.isArray(record.accounts)) {
    throw new Error("Task aliases file has an invalid shape.");
  }

  const normalizedAccounts: TaskAliasesFile["accounts"] = {};

  for (const [accountFingerprint, value] of Object.entries(record.accounts)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Task aliases file contains an invalid account entry.");
    }

    const projects = (value as { projects?: unknown }).projects;
    const tasks = (value as { tasks?: unknown }).tasks;

    if (projects !== undefined && (typeof projects !== "object" || projects === null || Array.isArray(projects))) {
      throw new Error("Task aliases file contains an invalid project alias map.");
    }

    if (typeof tasks !== "object" || tasks === null || Array.isArray(tasks)) {
      throw new Error("Task aliases file contains an invalid task alias map.");
    }

    normalizedAccounts[accountFingerprint] = { projects: {}, tasks: {} };

    if (projects) {
      for (const [aliasName, projectId] of Object.entries(projects)) {
        if (typeof projectId !== "string" || !projectId.trim()) {
          throw new Error("Project aliases must map to non-empty string ids.");
        }

        normalizedAccounts[accountFingerprint].projects[aliasName] = projectId.trim();
      }
    }

    for (const [aliasName, taskId] of Object.entries(tasks)) {
      if (typeof taskId !== "string" || !taskId.trim()) {
        throw new Error("Task aliases must map to non-empty string ids.");
      }

      normalizedAccounts[accountFingerprint].tasks[aliasName] = taskId.trim();
    }
  }

  return {
    version: 1,
    accounts: normalizedAccounts,
  };
}

async function loadTaskAliasesFile(runtime: StorageRuntime = {}): Promise<TaskAliasesFile> {
  const { aliasesFilePath } = resolveStoragePaths(runtime);

  try {
    const fileContents = await readFile(aliasesFilePath, "utf8");
    return normalizeTaskAliasesFile(JSON.parse(fileContents) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyTaskAliasesFile();
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse task aliases at ${aliasesFilePath}.`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read task aliases at ${aliasesFilePath}: ${error.message}`);
    }

    throw new Error(`Failed to read task aliases at ${aliasesFilePath}.`);
  }
}

async function saveTaskAliasesFile(file: TaskAliasesFile, runtime: StorageRuntime = {}): Promise<void> {
  const { aliasesFilePath } = resolveStoragePaths(runtime);

  if (Object.keys(file.accounts).length === 0) {
    await rm(aliasesFilePath, { force: true });
    return;
  }

  // START_BLOCK_PERSIST_TASK_ALIASES
  await writeJsonFileAtomic(aliasesFilePath, file, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });
  // END_BLOCK_PERSIST_TASK_ALIASES
}

// START_CONTRACT: normalizeTaskAliasName
//   PURPOSE: Validate and normalize a user-provided task alias name.
//   INPUTS: { name: string - User-provided alias name. }
//   OUTPUTS: { string - Lowercased validated alias name. }
//   SIDE_EFFECTS: none
//   LINKS: M-TASK-ALIAS-STORE, M-TASK-REF-RESOLVER
// END_CONTRACT: normalizeTaskAliasName
export function normalizeTaskAliasName(name: string): string {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    throw new Error("Task alias name is empty.");
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalizedName)) {
    throw new Error("Task alias names may only contain letters, numbers, dots, underscores, and dashes.");
  }

  return normalizedName;
}

// START_CONTRACT: listTaskAliases
//   PURPOSE: List saved task aliases for an account fingerprint.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<TaskAliasEntry[]> - Sorted alias entries for the active account. }
//   SIDE_EFFECTS: Reads the aliases file from disk when present.
//   LINKS: M-TASK-ALIAS-STORE
// END_CONTRACT: listTaskAliases
export async function listTaskAliases(accountFingerprint: string, runtime: StorageRuntime = {}): Promise<TaskAliasEntry[]> {
  const file = await loadTaskAliasesFile(runtime);
  const taskAliases = file.accounts[accountFingerprint]?.tasks ?? {};

  return Object.entries(taskAliases)
    .map(([name, id]) => ({ name, id }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

// START_CONTRACT: getTaskAlias
//   PURPOSE: Resolve a saved alias name to a raw task id for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to resolve. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<string | undefined> - Raw task id when an alias exists. }
//   SIDE_EFFECTS: Reads the aliases file from disk when present.
//   LINKS: M-TASK-ALIAS-STORE, M-TASK-REF-RESOLVER
// END_CONTRACT: getTaskAlias
export async function getTaskAlias(accountFingerprint: string, name: string, runtime: StorageRuntime = {}): Promise<string | undefined> {
  const normalizedName = normalizeTaskAliasName(name);
  const aliases = await listTaskAliases(accountFingerprint, runtime);

  return aliases.find((alias) => alias.name === normalizedName)?.id;
}

// START_CONTRACT: setTaskAlias
//   PURPOSE: Persist or replace a task alias for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to store. taskId: string - Raw task id. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<TaskAliasEntry> - The saved alias entry. }
//   SIDE_EFFECTS: Writes the aliases file to config storage.
//   LINKS: M-TASK-ALIAS-STORE
// END_CONTRACT: setTaskAlias
export async function setTaskAlias(
  accountFingerprint: string,
  name: string,
  taskId: string,
  runtime: StorageRuntime = {},
): Promise<TaskAliasEntry> {
  const normalizedName = normalizeTaskAliasName(name);
  const normalizedTaskId = taskId.trim();

  if (!normalizedTaskId) {
    throw new Error("Task alias target id is empty.");
  }

  const file = await loadTaskAliasesFile(runtime);

  file.accounts[accountFingerprint] ??= { projects: {}, tasks: {} };
  file.accounts[accountFingerprint].tasks[normalizedName] = normalizedTaskId;

  await saveTaskAliasesFile(file, runtime);

  return {
    name: normalizedName,
    id: normalizedTaskId,
  };
}

// START_CONTRACT: removeTaskAlias
//   PURPOSE: Remove a saved task alias for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to remove. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<boolean> - Whether the alias existed and was removed. }
//   SIDE_EFFECTS: Writes or removes the aliases file in config storage.
//   LINKS: M-TASK-ALIAS-STORE
// END_CONTRACT: removeTaskAlias
export async function removeTaskAlias(accountFingerprint: string, name: string, runtime: StorageRuntime = {}): Promise<boolean> {
  const normalizedName = normalizeTaskAliasName(name);
  const file = await loadTaskAliasesFile(runtime);
  const accountAliases = file.accounts[accountFingerprint];
  const taskAliases = accountAliases?.tasks;

  if (!taskAliases || !(normalizedName in taskAliases)) {
    return false;
  }

  delete taskAliases[normalizedName];

  if (accountAliases && Object.keys(taskAliases).length === 0 && Object.keys(accountAliases.projects).length === 0) {
    delete file.accounts[accountFingerprint];
  }

  await saveTaskAliasesFile(file, runtime);

  return true;
}
