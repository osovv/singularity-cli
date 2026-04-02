import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveStoragePaths } from "./index.ts";

// FILE: src/lib/storage/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify `SINGU_HOME` and XDG-first storage path resolution.
//   SCOPE: Storage root selection and config/cache path derivation.
//   DEPENDS: vitest, src/lib/storage/index.ts
//   LINKS: V-M-STORAGE-PATHS, M-STORAGE-PATHS
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRootPath(): Promise<string> {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-storage-"));
  tempDirectories.push(rootPath);
  return rootPath;
}

describe("resolveStoragePaths", () => {
  it("uses SINGU_HOME as the shared runtime root when it is set", async () => {
    const rootPath = await createRootPath();
    const paths = resolveStoragePaths({ env: { SINGU_HOME: join(rootPath, "workspace") }, homeDir: join(rootPath, "home") });

    expect(paths.configFilePath).toBe(join(rootPath, "workspace", "config.json"));
    expect(paths.aliasesFilePath).toBe(join(rootPath, "workspace", "aliases.json"));
    expect(paths.projectLastListCacheFilePath).toBe(join(rootPath, "workspace", "cache", "project-last-list.json"));
    expect(paths.taskLastListCacheFilePath).toBe(join(rootPath, "workspace", "cache", "task-last-list.json"));
  });

  it("falls back to XDG config and cache roots when SINGU_HOME is absent", async () => {
    const rootPath = await createRootPath();
    const paths = resolveStoragePaths({
      env: {
        XDG_CONFIG_HOME: join(rootPath, "xdg-config"),
        XDG_CACHE_HOME: join(rootPath, "xdg-cache"),
      },
      homeDir: join(rootPath, "home"),
    });

    expect(paths.configFilePath).toBe(join(rootPath, "xdg-config", "singu", "config.json"));
    expect(paths.aliasesFilePath).toBe(join(rootPath, "xdg-config", "singu", "aliases.json"));
    expect(paths.projectLastListCacheFilePath).toBe(join(rootPath, "xdg-cache", "singu", "project-last-list.json"));
    expect(paths.taskLastListCacheFilePath).toBe(join(rootPath, "xdg-cache", "singu", "task-last-list.json"));
  });
});
