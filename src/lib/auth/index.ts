// FILE: src/lib/auth/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve, mask, validate, and collect status for the CLI auth token.
//   SCOPE: Environment token resolution, saved token resolution, token validation, masked output, token prompts, and auth state inspection.
//   DEPENDS: src/lib/config/index.ts, src/api/generated/clients/projectControllerList.ts, node:readline
//   LINKS: M-AUTH-RUNTIME, M-CONFIG, M-API-CLIENT
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   TOKEN_ENV_VAR - Environment variable that overrides the saved token.
//   resolveAuthState - Returns the effective token source and config metadata.
//   maskToken - Redacts tokens for safe terminal output.
//   validateToken - Probes the API with the active token and reports the HTTP result.
//   saveAuthToken - Persists a validated or user-supplied token.
//   clearAuthToken - Removes the saved token from local config storage.
//   promptForToken - Collects a token from an interactive terminal session.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added auth runtime helpers for XDG-first token storage and status checks.]
// END_CHANGE_SUMMARY

import readline from "node:readline";

import { getProjectControllerListUrl } from "../../api/generated/clients/projectControllerList.ts";
import {
  clearSavedToken,
  loadConfig,
  resolveConfigPaths,
  saveConfig,
  type ConfigPaths,
  type ConfigRuntime,
} from "../config/index.ts";

export const TOKEN_ENV_VAR = "SINGULARITY_TOKEN";

export type TokenSource = "env" | "file" | "none";

export type AuthState = {
  source: TokenSource;
  token: string | undefined;
  maskedToken: string | undefined;
  configFilePath: string;
  configDirPath: string;
  hasEnvToken: boolean;
  hasSavedToken: boolean;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type TokenValidationResult = {
  ok: boolean;
  status: number;
  statusText: string;
  errorMessage?: string;
};

export type AuthRuntime = ConfigRuntime & {
  fetchImpl?: FetchLike;
};

type MutedReadline = readline.Interface & {
  _writeToOutput?: (chunk: string) => void;
};

function readEnvToken(env: NodeJS.ProcessEnv): string | undefined {
  const rawValue = env[TOKEN_ENV_VAR];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmedValue = rawValue.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

// START_CONTRACT: maskToken
//   PURPOSE: Return a safe, human-readable token mask for terminal output.
//   INPUTS: { token: string - Raw token value to redact. }
//   OUTPUTS: { string - Masked token string suitable for logs and CLI output. }
//   SIDE_EFFECTS: none
//   LINKS: M-AUTH-RUNTIME
// END_CONTRACT: maskToken
export function maskToken(token: string): string {
  const normalizedToken = token.trim();

  if (normalizedToken.length <= 8) {
    return `${normalizedToken.slice(0, 2)}****`;
  }

  return `${normalizedToken.slice(0, 4)}****${normalizedToken.slice(-4)}`;
}

// START_CONTRACT: resolveAuthState
//   PURPOSE: Resolve the effective auth token and its source with env-first precedence.
//   INPUTS: { runtime: AuthRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<AuthState> - Effective token source, masked token, and config metadata. }
//   SIDE_EFFECTS: Reads the saved config file from disk.
//   LINKS: M-AUTH-RUNTIME, M-CONFIG
// END_CONTRACT: resolveAuthState
export async function resolveAuthState(runtime: AuthRuntime = {}): Promise<AuthState> {
  const env = runtime.env ?? process.env;
  const savedConfig = await loadConfig(runtime);
  const paths = resolveConfigPaths(runtime);
  const envToken = readEnvToken(env);
  const savedToken = savedConfig.token;
  const activeToken = envToken ?? savedToken;

  return {
    source: envToken ? "env" : savedToken ? "file" : "none",
    token: activeToken,
    maskedToken: activeToken ? maskToken(activeToken) : undefined,
    configFilePath: paths.configFilePath,
    configDirPath: paths.configDirPath,
    hasEnvToken: Boolean(envToken),
    hasSavedToken: Boolean(savedToken),
  };
}

function getValidationUrl(): string {
  return getProjectControllerListUrl().url.toString();
}

function buildAuthHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// START_CONTRACT: validateToken
//   PURPOSE: Probe the API with a bearer token and report whether it is accepted.
//   INPUTS: { token: string - Token to validate. runtime: AuthRuntime | undefined - Optional environment, home directory, and fetch overrides for tests. }
//   OUTPUTS: { Promise<TokenValidationResult> - HTTP success/failure result for the probe request. }
//   SIDE_EFFECTS: Performs a network request against the Singularity API.
//   LINKS: M-AUTH-RUNTIME, M-API-CLIENT
// END_CONTRACT: validateToken
export async function validateToken(token: string, runtime: AuthRuntime = {}): Promise<TokenValidationResult> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return {
      ok: false,
      status: 0,
      statusText: "MISSING_TOKEN",
      errorMessage: "Token is empty.",
    };
  }

  const fetchImpl = runtime.fetchImpl ?? fetch;

  // START_BLOCK_VALIDATE_REMOTE_TOKEN
  try {
    const response = await fetchImpl(getValidationUrl(), {
      method: "GET",
      headers: buildAuthHeaders(normalizedToken),
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || "UNKNOWN_STATUS",
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: "NETWORK_ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
  // END_BLOCK_VALIDATE_REMOTE_TOKEN
}

// START_CONTRACT: saveAuthToken
//   PURPOSE: Persist a trimmed auth token into the XDG-first config file.
//   INPUTS: { token: string - Token to persist. runtime: AuthRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<ConfigPaths> - Active config directory and file paths after persistence. }
//   SIDE_EFFECTS: Writes the config directory and config file to disk.
//   LINKS: M-AUTH-RUNTIME, M-CONFIG
// END_CONTRACT: saveAuthToken
export async function saveAuthToken(token: string, runtime: AuthRuntime = {}): Promise<ConfigPaths> {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new Error("Token is empty.");
  }

  return saveConfig({ token: normalizedToken }, runtime);
}

// START_CONTRACT: clearAuthToken
//   PURPOSE: Remove the saved auth token from local config storage.
//   INPUTS: { runtime: AuthRuntime | undefined - Optional environment and home directory overrides for tests. }
//   OUTPUTS: { Promise<{ hadSavedToken: boolean } & ConfigPaths> - Whether a saved token existed and the active config paths. }
//   SIDE_EFFECTS: Removes the persisted config file when the saved token is cleared.
//   LINKS: M-AUTH-RUNTIME, M-CONFIG
// END_CONTRACT: clearAuthToken
export async function clearAuthToken(runtime: AuthRuntime = {}): Promise<{ hadSavedToken: boolean } & ConfigPaths> {
  const savedConfig = await loadConfig(runtime);
  const paths = await clearSavedToken(runtime);

  return {
    hadSavedToken: Boolean(savedConfig.token),
    ...paths,
  };
}

// START_CONTRACT: promptForToken
//   PURPOSE: Collect an auth token from an interactive terminal while masking typed characters.
//   INPUTS: { promptLabel: string | undefined - Prompt label shown to the user. }
//   OUTPUTS: { Promise<string> - Trimmed token entered by the user. }
//   SIDE_EFFECTS: Reads from stdin and writes masked prompt output to stdout.
//   LINKS: M-AUTH-RUNTIME
// END_CONTRACT: promptForToken
export async function promptForToken(promptLabel = "Singularity API token: "): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`No token provided and no interactive terminal is available. Pass --token or set ${TOKEN_ENV_VAR}.`);
  }

  // START_BLOCK_PROMPT_FOR_TOKEN
  return await new Promise<string>((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    }) as MutedReadline;

    const originalWriteToOutput = rl._writeToOutput?.bind(rl);

    rl._writeToOutput = (chunk: string) => {
      if (!process.stdout.isTTY || chunk.trim().length === 0) {
        process.stdout.write(chunk);
        return;
      }

      if (chunk.includes(promptLabel)) {
        originalWriteToOutput?.(chunk);
        return;
      }

      process.stdout.write("*");
    };

    rl.question(promptLabel, (answer) => {
      rl.close();
      process.stdout.write("\n");

      const normalizedToken = answer.trim();

      if (!normalizedToken) {
        reject(new Error("Token is empty."));
        return;
      }

      resolve(normalizedToken);
    });

    rl.on("SIGINT", () => {
      rl.close();
      reject(new Error("Token entry cancelled."));
    });
  });
  // END_BLOCK_PROMPT_FOR_TOKEN
}
