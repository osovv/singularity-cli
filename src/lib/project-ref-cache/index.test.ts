import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadProjectListContext, resolveProjectSid, saveProjectListContext } from "./index.ts";

// FILE: src/lib/project-ref-cache/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify account-scoped project SID cache persistence and lookup.
//   SCOPE: Cache writes, cache reads, and SID resolution.
//   DEPENDS: vitest, src/lib/project-ref-cache/index.ts
//   LINKS: V-M-PROJECT-REF-CACHE, M-PROJECT-REF-CACHE
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-project-cache-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CACHE_HOME: join(rootPath, "xdg-cache"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("project SID cache", () => {
  it("writes and reads the current project list context", async () => {
    const runtime = await createRuntime();
    await saveProjectListContext(
      {
        accountFingerprint: "acct-1",
        command: "singu project list",
        items: [{ sid: "1", id: "project-1", title: "Inbox" }],
      },
      runtime,
    );

    const cache = await loadProjectListContext("acct-1", runtime);
    const resolvedItem = await resolveProjectSid("acct-1", "1", runtime);

    expect(cache?.items).toEqual([{ sid: "1", id: "project-1", title: "Inbox" }]);
    expect(resolvedItem).toEqual({ sid: "1", id: "project-1", title: "Inbox" });
  });

  it("ignores cache entries from another account fingerprint", async () => {
    const runtime = await createRuntime();
    await saveProjectListContext(
      {
        accountFingerprint: "acct-1",
        command: "singu project list",
        items: [{ sid: "1", id: "project-1", title: "Inbox" }],
      },
      runtime,
    );

    await expect(loadProjectListContext("acct-2", runtime)).resolves.toBeUndefined();
    await expect(resolveProjectSid("acct-2", "1", runtime)).resolves.toBeUndefined();
  });
});
