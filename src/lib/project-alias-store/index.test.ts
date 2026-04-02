import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getProjectAlias, listProjectAliases, normalizeProjectAliasName, removeProjectAlias, setProjectAlias } from "./index.ts";

// FILE: src/lib/project-alias-store/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify account-scoped project alias validation and persistence.
//   SCOPE: Alias normalization, alias reads, alias writes, and alias removal.
//   DEPENDS: vitest, src/lib/project-alias-store/index.ts
//   LINKS: V-M-PROJECT-ALIAS-STORE, M-PROJECT-ALIAS-STORE
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-project-alias-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CONFIG_HOME: join(rootPath, "xdg-config"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("project alias store", () => {
  it("normalizes alias names and persists aliases for the active account", async () => {
    const runtime = await createRuntime();
    const entry = await setProjectAlias("acct-1", "Inbox.Main", "project-1", runtime);

    expect(entry).toEqual({ name: "inbox.main", id: "project-1" });
    await expect(getProjectAlias("acct-1", "INBOX.MAIN", runtime)).resolves.toBe("project-1");
    await expect(listProjectAliases("acct-1", runtime)).resolves.toEqual([{ name: "inbox.main", id: "project-1" }]);
  });

  it("removes only the requested alias for the active account", async () => {
    const runtime = await createRuntime();
    await setProjectAlias("acct-1", "inbox", "project-1", runtime);
    await setProjectAlias("acct-2", "inbox", "project-2", runtime);

    await expect(removeProjectAlias("acct-1", "inbox", runtime)).resolves.toBe(true);
    await expect(listProjectAliases("acct-1", runtime)).resolves.toEqual([]);
    await expect(listProjectAliases("acct-2", runtime)).resolves.toEqual([{ name: "inbox", id: "project-2" }]);
  });

  it("rejects invalid alias names", () => {
    expect(() => normalizeProjectAliasName("bad alias")).toThrow(/may only contain/);
  });
});
