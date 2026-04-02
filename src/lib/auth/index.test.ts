import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveConfigPaths, saveConfig } from "../config/index.ts";
import { TOKEN_ENV_VAR, maskToken, resolveAuthState, validateToken } from "./index.ts";

// FILE: src/lib/auth/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify env-first auth resolution, token masking, and validation result handling.
//   SCOPE: Auth state precedence and token probe result normalization.
//   DEPENDS: vitest, src/lib/auth/index.ts, src/lib/config/index.ts
//   LINKS: V-M-AUTH-RUNTIME, M-AUTH-RUNTIME
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime(env: NodeJS.ProcessEnv = {}) {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-auth-"));
  tempDirectories.push(rootPath);

  return {
    env,
    homeDir: join(rootPath, "home"),
  };
}

describe("maskToken", () => {
  it("redacts long tokens with fixed visible edges", () => {
    expect(maskToken("abcdefgh12345678")).toBe("abcd****5678");
  });

  it("redacts short tokens without exposing the full value", () => {
    expect(maskToken("abcd")).toBe("ab****");
  });
});

describe("resolveAuthState", () => {
  it("prefers the environment token over the saved file token", async () => {
    const runtime = await createRuntime({ [TOKEN_ENV_VAR]: "env-token" });
    await saveConfig({ token: "file-token" }, runtime);

    const authState = await resolveAuthState(runtime);

    expect(authState.source).toBe("env");
    expect(authState.token).toBe("env-token");
    expect(authState.hasEnvToken).toBe(true);
    expect(authState.hasSavedToken).toBe(true);
  });

  it("falls back to the saved token when the environment token is missing", async () => {
    const runtime = await createRuntime();
    const paths = resolveConfigPaths(runtime);
    await saveConfig({ token: "file-token" }, runtime);

    const authState = await resolveAuthState(runtime);

    expect(authState.source).toBe("file");
    expect(authState.token).toBe("file-token");
    expect(authState.configFilePath).toBe(paths.configFilePath);
  });
});

describe("validateToken", () => {
  it("returns an ok result for successful probes", async () => {
    const runtime = await createRuntime();
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => {
      return new Response(JSON.stringify([]), { status: 200, statusText: "OK" });
    });

    const result = await validateToken("demo-token", { ...runtime, fetchImpl });

    expect(result).toEqual({ ok: true, status: 200, statusText: "OK" });
  });

  it("normalizes network failures into a stable result", async () => {
    const runtime = await createRuntime();
    const fetchImpl = vi.fn(async (_input: string, _init?: RequestInit) => {
      throw new Error("network down");
    });

    const result = await validateToken("demo-token", { ...runtime, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.statusText).toBe("NETWORK_ERROR");
    expect(result.errorMessage).toContain("network down");
  });
});
