// FILE: src/lib/project-alias-store/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Persist stable named project aliases in config storage and scope them to the active account fingerprint.
//   SCOPE: Alias name normalization, alias reads, alias writes, alias listing, and alias removal.
//   DEPENDS: node:fs/promises, src/lib/storage/index.ts
//   LINKS: M-PROJECT-ALIAS-STORE, M-PROJECT-REF-RESOLVER
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   normalizeProjectAliasName - Validate and normalize user-provided alias names.
//   setProjectAlias - Persist or replace a project alias for the active account.
//   listProjectAliases - List saved aliases for the active account.
//   removeProjectAlias - Remove a saved alias for the active account.
//   getProjectAlias - Resolve a saved alias name to a raw project id.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added account-scoped project alias persistence in config storage.]
// END_CHANGE_SUMMARY

import { readFile, rm } from "node:fs/promises";

import { resolveStoragePaths, type StorageRuntime, writeJsonFileAtomic } from "../storage/index.ts";

export type ProjectAliasEntry = {
  name: string;
  id: string;
};

type ProjectAliasesFile = {
  version: 1;
  accounts: Record<string, { projects: Record<string, string> }>;
};

const DEFAULT_PROJECT_ALIASES_FILE: ProjectAliasesFile = {
  version: 1,
  accounts: {},
};

function createEmptyProjectAliasesFile(): ProjectAliasesFile {
  return {
    version: DEFAULT_PROJECT_ALIASES_FILE.version,
    accounts: {},
  };
}

function normalizeProjectAliasesFile(input: unknown): ProjectAliasesFile {
  if (input === undefined || input === null) {
    return createEmptyProjectAliasesFile();
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Project aliases file must be a JSON object.");
  }

  const record = input as Record<string, unknown>;

  if (record.version !== 1 || typeof record.accounts !== "object" || record.accounts === null || Array.isArray(record.accounts)) {
    throw new Error("Project aliases file has an invalid shape.");
  }

  const normalizedAccounts: ProjectAliasesFile["accounts"] = {};

  for (const [accountFingerprint, value] of Object.entries(record.accounts)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Project aliases file contains an invalid account entry.");
    }

    const projects = (value as { projects?: unknown }).projects;

    if (typeof projects !== "object" || projects === null || Array.isArray(projects)) {
      throw new Error("Project aliases file contains an invalid project alias map.");
    }

    normalizedAccounts[accountFingerprint] = { projects: {} };

    for (const [aliasName, projectId] of Object.entries(projects)) {
      if (typeof projectId !== "string" || !projectId.trim()) {
        throw new Error("Project aliases must map to non-empty string ids.");
      }

      normalizedAccounts[accountFingerprint].projects[aliasName] = projectId.trim();
    }
  }

  return {
    version: 1,
    accounts: normalizedAccounts,
  };
}

async function loadProjectAliasesFile(runtime: StorageRuntime = {}): Promise<ProjectAliasesFile> {
  const { aliasesFilePath } = resolveStoragePaths(runtime);

  try {
    const fileContents = await readFile(aliasesFilePath, "utf8");
    return normalizeProjectAliasesFile(JSON.parse(fileContents) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyProjectAliasesFile();
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse project aliases at ${aliasesFilePath}.`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read project aliases at ${aliasesFilePath}: ${error.message}`);
    }

    throw new Error(`Failed to read project aliases at ${aliasesFilePath}.`);
  }
}

async function saveProjectAliasesFile(file: ProjectAliasesFile, runtime: StorageRuntime = {}): Promise<void> {
  const { aliasesFilePath } = resolveStoragePaths(runtime);

  if (Object.keys(file.accounts).length === 0) {
    await rm(aliasesFilePath, { force: true });
    return;
  }

  // START_BLOCK_PERSIST_PROJECT_ALIASES
  await writeJsonFileAtomic(aliasesFilePath, file, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });
  // END_BLOCK_PERSIST_PROJECT_ALIASES
}

// START_CONTRACT: normalizeProjectAliasName
//   PURPOSE: Validate and normalize a user-provided project alias name.
//   INPUTS: { name: string - User-provided alias name. }
//   OUTPUTS: { string - Lowercased validated alias name. }
//   SIDE_EFFECTS: none
//   LINKS: M-PROJECT-ALIAS-STORE, M-PROJECT-REF-RESOLVER
// END_CONTRACT: normalizeProjectAliasName
export function normalizeProjectAliasName(name: string): string {
  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    throw new Error("Project alias name is empty.");
  }

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalizedName)) {
    throw new Error("Project alias names may only contain letters, numbers, dots, underscores, and dashes.");
  }

  return normalizedName;
}

// START_CONTRACT: listProjectAliases
//   PURPOSE: List saved project aliases for an account fingerprint.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ProjectAliasEntry[]> - Sorted alias entries for the active account. }
//   SIDE_EFFECTS: Reads the aliases file from disk when present.
//   LINKS: M-PROJECT-ALIAS-STORE
// END_CONTRACT: listProjectAliases
export async function listProjectAliases(
  accountFingerprint: string,
  runtime: StorageRuntime = {},
): Promise<ProjectAliasEntry[]> {
  const file = await loadProjectAliasesFile(runtime);
  const projectAliases = file.accounts[accountFingerprint]?.projects ?? {};

  return Object.entries(projectAliases)
    .map(([name, id]) => ({ name, id }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

// START_CONTRACT: getProjectAlias
//   PURPOSE: Resolve a saved alias name to a raw project id for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to resolve. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<string | undefined> - Raw project id when an alias exists. }
//   SIDE_EFFECTS: Reads the aliases file from disk when present.
//   LINKS: M-PROJECT-ALIAS-STORE, M-PROJECT-REF-RESOLVER
// END_CONTRACT: getProjectAlias
export async function getProjectAlias(
  accountFingerprint: string,
  name: string,
  runtime: StorageRuntime = {},
): Promise<string | undefined> {
  const normalizedName = normalizeProjectAliasName(name);
  const aliases = await listProjectAliases(accountFingerprint, runtime);

  return aliases.find((alias) => alias.name === normalizedName)?.id;
}

// START_CONTRACT: setProjectAlias
//   PURPOSE: Persist or replace a project alias for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to store. projectId: string - Raw project id. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<ProjectAliasEntry> - The saved alias entry. }
//   SIDE_EFFECTS: Writes the aliases file to config storage.
//   LINKS: M-PROJECT-ALIAS-STORE
// END_CONTRACT: setProjectAlias
export async function setProjectAlias(
  accountFingerprint: string,
  name: string,
  projectId: string,
  runtime: StorageRuntime = {},
): Promise<ProjectAliasEntry> {
  const normalizedName = normalizeProjectAliasName(name);
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    throw new Error("Project alias target id is empty.");
  }

  const file = await loadProjectAliasesFile(runtime);

  file.accounts[accountFingerprint] ??= { projects: {} };
  file.accounts[accountFingerprint].projects[normalizedName] = normalizedProjectId;

  await saveProjectAliasesFile(file, runtime);

  return {
    name: normalizedName,
    id: normalizedProjectId,
  };
}

// START_CONTRACT: removeProjectAlias
//   PURPOSE: Remove a saved project alias for the active account.
//   INPUTS: { accountFingerprint: string - Active account fingerprint. name: string - Alias name to remove. runtime: StorageRuntime | undefined - Optional runtime overrides for tests. }
//   OUTPUTS: { Promise<boolean> - Whether the alias existed and was removed. }
//   SIDE_EFFECTS: Writes or removes the aliases file in config storage.
//   LINKS: M-PROJECT-ALIAS-STORE
// END_CONTRACT: removeProjectAlias
export async function removeProjectAlias(
  accountFingerprint: string,
  name: string,
  runtime: StorageRuntime = {},
): Promise<boolean> {
  const normalizedName = normalizeProjectAliasName(name);
  const file = await loadProjectAliasesFile(runtime);
  const projectAliases = file.accounts[accountFingerprint]?.projects;

  if (!projectAliases || !(normalizedName in projectAliases)) {
    return false;
  }

  delete projectAliases[normalizedName];

  if (Object.keys(projectAliases).length === 0) {
    delete file.accounts[accountFingerprint];
  }

  await saveProjectAliasesFile(file, runtime);

  return true;
}
