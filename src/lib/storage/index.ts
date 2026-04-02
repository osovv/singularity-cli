// FILE: src/lib/storage/index.ts
// VERSION: 1.1.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve runtime storage paths for config and cache data with `SINGU_HOME` override support.
//   SCOPE: Storage path resolution, secure directory creation, and atomic JSON file writes.
//   DEPENDS: node:fs/promises, node:os, node:path
//   LINKS: M-STORAGE-PATHS, M-CONFIG, M-PROJECT-REF-CACHE, M-PROJECT-ALIAS-STORE, M-TASK-REF-CACHE, M-TASK-ALIAS-STORE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   APP_DIR_NAME - Shared application directory name used for XDG fallbacks.
//   HOME_ENV_VAR - Environment variable that overrides XDG config and cache roots.
//   resolveStoragePaths - Resolve config and cache paths for the current runtime.
//   ensureDirectory - Create a directory with the requested permissions.
//   writeJsonFileAtomic - Persist JSON files safely through a temporary file swap.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.1.0 - Added task cache file paths alongside project cache storage.]
// END_CHANGE_SUMMARY

import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const APP_DIR_NAME = "singu";
export const HOME_ENV_VAR = "SINGU_HOME";
export const CONFIG_FILE_NAME = "config.json";
export const ALIASES_FILE_NAME = "aliases.json";
export const PROJECT_LAST_LIST_CACHE_FILE_NAME = "project-last-list.json";
export const TASK_LAST_LIST_CACHE_FILE_NAME = "task-last-list.json";

export type StorageRuntime = {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
};

export type StoragePaths = {
  appRootPath: string | undefined;
  configDirPath: string;
  cacheDirPath: string;
  configFilePath: string;
  aliasesFilePath: string;
  projectLastListCacheFilePath: string;
  taskLastListCacheFilePath: string;
};

export type JsonFileWriteOptions = {
  directoryMode?: number;
  fileMode?: number;
};

function resolveHomeDir(runtime: StorageRuntime): string {
  return runtime.homeDir ?? homedir();
}

// START_CONTRACT: resolveStoragePaths
//   PURPOSE: Resolve config and cache file paths using `SINGU_HOME` when present, otherwise XDG-first fallbacks.
//   INPUTS: { runtime: StorageRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { StoragePaths - Absolute storage paths for config and cache files. }
//   SIDE_EFFECTS: none
//   LINKS: M-STORAGE-PATHS
// END_CONTRACT: resolveStoragePaths
export function resolveStoragePaths(runtime: StorageRuntime = {}): StoragePaths {
  const env = runtime.env ?? process.env;
  const homeDir = resolveHomeDir(runtime);
  const singuHome = env[HOME_ENV_VAR]?.trim();

  // START_BLOCK_RESOLVE_STORAGE_PATHS
  if (singuHome) {
    const appRootPath = resolve(singuHome);

    return {
      appRootPath,
      configDirPath: appRootPath,
      cacheDirPath: join(appRootPath, "cache"),
      configFilePath: join(appRootPath, CONFIG_FILE_NAME),
      aliasesFilePath: join(appRootPath, ALIASES_FILE_NAME),
      projectLastListCacheFilePath: join(appRootPath, "cache", PROJECT_LAST_LIST_CACHE_FILE_NAME),
      taskLastListCacheFilePath: join(appRootPath, "cache", TASK_LAST_LIST_CACHE_FILE_NAME),
    };
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
  const xdgCacheHome = env.XDG_CACHE_HOME?.trim();
  const configRoot = xdgConfigHome ? resolve(xdgConfigHome) : resolve(homeDir, ".config");
  const cacheRoot = xdgCacheHome ? resolve(xdgCacheHome) : resolve(homeDir, ".cache");
  const configDirPath = join(configRoot, APP_DIR_NAME);
  const cacheDirPath = join(cacheRoot, APP_DIR_NAME);

  return {
    appRootPath: undefined,
    configDirPath,
    cacheDirPath,
    configFilePath: join(configDirPath, CONFIG_FILE_NAME),
    aliasesFilePath: join(configDirPath, ALIASES_FILE_NAME),
    projectLastListCacheFilePath: join(cacheDirPath, PROJECT_LAST_LIST_CACHE_FILE_NAME),
    taskLastListCacheFilePath: join(cacheDirPath, TASK_LAST_LIST_CACHE_FILE_NAME),
  };
  // END_BLOCK_RESOLVE_STORAGE_PATHS
}

// START_CONTRACT: ensureDirectory
//   PURPOSE: Create a runtime directory with explicit permissions.
//   INPUTS: { directoryPath: string - Directory path to ensure. mode: number | undefined - Permission mode to apply. }
//   OUTPUTS: { Promise<void> - Resolves once the directory exists. }
//   SIDE_EFFECTS: Creates or updates permissions on the target directory.
//   LINKS: M-STORAGE-PATHS
// END_CONTRACT: ensureDirectory
export async function ensureDirectory(directoryPath: string, mode = 0o700): Promise<void> {
  await mkdir(directoryPath, { recursive: true, mode });
  await chmod(directoryPath, mode);
}

// START_CONTRACT: writeJsonFileAtomic
//   PURPOSE: Persist JSON safely by writing a temporary file and renaming it into place.
//   INPUTS: { filePath: string - Target JSON file path. data: unknown - Serializable JSON payload. options: JsonFileWriteOptions | undefined - Directory and file mode overrides. }
//   OUTPUTS: { Promise<void> - Resolves once the file has been written atomically. }
//   SIDE_EFFECTS: Creates the parent directory, writes a temporary file, and renames it into place.
//   LINKS: M-STORAGE-PATHS
// END_CONTRACT: writeJsonFileAtomic
export async function writeJsonFileAtomic(
  filePath: string,
  data: unknown,
  options: JsonFileWriteOptions = {},
): Promise<void> {
  const directoryMode = options.directoryMode ?? 0o700;
  const fileMode = options.fileMode ?? 0o600;
  const directoryPath = dirname(filePath);
  const temporaryFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  await ensureDirectory(directoryPath, directoryMode);
  await writeFile(temporaryFilePath, `${JSON.stringify(data, null, 2)}\n`, { mode: fileMode });
  await chmod(temporaryFilePath, fileMode);
  await rename(temporaryFilePath, filePath);
  await chmod(filePath, fileMode);
}
