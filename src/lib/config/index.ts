// FILE: src/lib/config/index.ts
// VERSION: 1.1.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve config file paths from runtime storage paths and persist the single local auth token for the CLI.
//   SCOPE: Config path resolution, config normalization, config reads, config writes, and token clearing.
//   DEPENDS: node:fs/promises, src/lib/storage/index.ts
//   LINKS: M-CONFIG, M-AUTH-RUNTIME, M-STORAGE-PATHS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   CONFIG_FILE_NAME - JSON config filename for the CLI.
//   resolveConfigPaths - Derives the active config directory and file paths.
//   normalizeConfig - Validates and trims raw config input into the supported shape.
//   loadConfig - Reads the config file if it exists.
//   saveConfig - Writes the config file with secure permissions or removes it when empty.
//   clearSavedToken - Removes the persisted token from local config storage.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.1.0 - Moved config path resolution onto shared storage paths with `SINGU_HOME` support.]
// END_CHANGE_SUMMARY

import { readFile, rm } from "node:fs/promises";

import {
  CONFIG_FILE_NAME,
  resolveStoragePaths,
  type StorageRuntime,
  writeJsonFileAtomic,
} from "../storage/index.ts";

export type CliConfig = {
  token?: string;
};

export type ConfigPaths = {
  configDirPath: string;
  configFilePath: string;
};

export type ConfigRuntime = StorageRuntime;

function normalizeToken(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Config token must be a string.");
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

// START_CONTRACT: resolveConfigPaths
//   PURPOSE: Resolve the config directory and file used by the CLI.
//   INPUTS: { runtime: ConfigRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { ConfigPaths - Absolute config directory and file paths. }
//   SIDE_EFFECTS: none
//   LINKS: M-CONFIG
// END_CONTRACT: resolveConfigPaths
export function resolveConfigPaths(runtime: ConfigRuntime = {}): ConfigPaths {
  const { configDirPath, configFilePath } = resolveStoragePaths(runtime);

  return {
    configDirPath,
    configFilePath,
  };
}

// START_CONTRACT: normalizeConfig
//   PURPOSE: Validate that raw config input matches the supported persisted shape.
//   INPUTS: { input: unknown - Raw parsed JSON config or ad-hoc input object. }
//   OUTPUTS: { CliConfig - Sanitized config object with a trimmed optional token. }
//   SIDE_EFFECTS: none
//   LINKS: M-CONFIG
// END_CONTRACT: normalizeConfig
export function normalizeConfig(input: unknown): CliConfig {
  if (input === undefined || input === null) {
    return {};
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Config must be a JSON object.");
  }

  const token = normalizeToken((input as { token?: unknown }).token);

  return token ? { token } : {};
}

// START_CONTRACT: loadConfig
//   PURPOSE: Load persisted CLI config if the config file exists.
//   INPUTS: { runtime: ConfigRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<CliConfig> - Sanitized persisted config or an empty object when no config exists. }
//   SIDE_EFFECTS: Reads the local config file from disk.
//   LINKS: M-CONFIG, M-AUTH-RUNTIME
// END_CONTRACT: loadConfig
export async function loadConfig(runtime: ConfigRuntime = {}): Promise<CliConfig> {
  const { configFilePath } = resolveConfigPaths(runtime);

  // START_BLOCK_VALIDATE_CONFIG_INPUT
  try {
    const fileContents = await readFile(configFilePath, "utf8");
    const parsedConfig = JSON.parse(fileContents) as unknown;

    return normalizeConfig(parsedConfig);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse config file at ${configFilePath}.`);
    }

    if (error instanceof Error) {
      throw new Error(`Failed to read config file at ${configFilePath}: ${error.message}`);
    }

    throw new Error(`Failed to read config file at ${configFilePath}.`);
  }
  // END_BLOCK_VALIDATE_CONFIG_INPUT
}

// START_CONTRACT: saveConfig
//   PURPOSE: Persist sanitized CLI config with secure directory and file permissions.
//   INPUTS: { config: CliConfig - Config values to persist. runtime: ConfigRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<ConfigPaths> - The active config directory and file paths. }
//   SIDE_EFFECTS: Creates the config directory, writes the config file, adjusts permissions, or removes the file when config is empty.
//   LINKS: M-CONFIG, M-AUTH-RUNTIME
// END_CONTRACT: saveConfig
export async function saveConfig(config: CliConfig, runtime: ConfigRuntime = {}): Promise<ConfigPaths> {
  const normalizedConfig = normalizeConfig(config);
  const paths = resolveConfigPaths(runtime);

  if (!normalizedConfig.token) {
    await rm(paths.configFilePath, { force: true });
    return paths;
  }

  // START_BLOCK_PERSIST_CONFIG_FILE
  await writeJsonFileAtomic(paths.configFilePath, normalizedConfig, {
    directoryMode: 0o700,
    fileMode: 0o600,
  });

  return paths;
  // END_BLOCK_PERSIST_CONFIG_FILE
}

// START_CONTRACT: clearSavedToken
//   PURPOSE: Remove the persisted token from local config storage.
//   INPUTS: { runtime: ConfigRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<ConfigPaths> - The active config directory and file paths. }
//   SIDE_EFFECTS: Removes the local config file when it only contains the auth token.
//   LINKS: M-CONFIG, M-AUTH-RUNTIME
// END_CONTRACT: clearSavedToken
export async function clearSavedToken(runtime: ConfigRuntime = {}): Promise<ConfigPaths> {
  return saveConfig({}, runtime);
}
