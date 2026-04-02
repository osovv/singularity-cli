import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getTaskAlias, listTaskAliases, normalizeTaskAliasName, removeTaskAlias, setTaskAlias } from "./index.ts";

// FILE: src/lib/task-alias-store/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify account-scoped task alias validation and persistence.
//   SCOPE: Alias normalization, alias reads, alias writes, and alias removal.
//   DEPENDS: vitest, src/lib/task-alias-store/index.ts
//   LINKS: V-M-TASK-ALIAS-STORE, M-TASK-ALIAS-STORE
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-task-alias-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CONFIG_HOME: join(rootPath, "xdg-config"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("task alias store", () => {
  it("normalizes alias names and persists aliases for the active account", async () => {
    const runtime = await createRuntime();
    const entry = await setTaskAlias("acct-1", "Today.Main", "task-1", runtime);

    expect(entry).toEqual({ name: "today.main", id: "task-1" });
    await expect(getTaskAlias("acct-1", "TODAY.MAIN", runtime)).resolves.toBe("task-1");
    await expect(listTaskAliases("acct-1", runtime)).resolves.toEqual([{ name: "today.main", id: "task-1" }]);
  });

  it("removes only the requested alias for the active account", async () => {
    const runtime = await createRuntime();
    await setTaskAlias("acct-1", "today", "task-1", runtime);
    await setTaskAlias("acct-2", "today", "task-2", runtime);

    await expect(removeTaskAlias("acct-1", "today", runtime)).resolves.toBe(true);
    await expect(listTaskAliases("acct-1", runtime)).resolves.toEqual([]);
    await expect(listTaskAliases("acct-2", runtime)).resolves.toEqual([{ name: "today", id: "task-2" }]);
  });

  it("rejects invalid alias names", () => {
    expect(() => normalizeTaskAliasName("bad alias")).toThrow(/may only contain/);
  });
});
