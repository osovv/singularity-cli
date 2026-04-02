import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadTaskListContext, resolveTaskSid, saveTaskListContext } from "./index.ts";

// FILE: src/lib/task-ref-cache/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify account-scoped task SID cache persistence and lookup.
//   SCOPE: Cache writes, cache reads, and SID resolution.
//   DEPENDS: vitest, src/lib/task-ref-cache/index.ts
//   LINKS: V-M-TASK-REF-CACHE, M-TASK-REF-CACHE
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-task-cache-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CACHE_HOME: join(rootPath, "xdg-cache"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("task SID cache", () => {
  it("writes and reads the current task list context", async () => {
    const runtime = await createRuntime();
    await saveTaskListContext(
      {
        accountFingerprint: "acct-1",
        command: "singu task list",
        items: [{ sid: "1", id: "task-1", title: "Inbox task" }],
      },
      runtime,
    );

    const cache = await loadTaskListContext("acct-1", runtime);
    const resolvedItem = await resolveTaskSid("acct-1", "1", runtime);

    expect(cache?.items).toEqual([{ sid: "1", id: "task-1", title: "Inbox task" }]);
    expect(resolvedItem).toEqual({ sid: "1", id: "task-1", title: "Inbox task" });
  });

  it("ignores cache entries from another account fingerprint", async () => {
    const runtime = await createRuntime();
    await saveTaskListContext(
      {
        accountFingerprint: "acct-1",
        command: "singu task list",
        items: [{ sid: "1", id: "task-1", title: "Inbox task" }],
      },
      runtime,
    );

    await expect(loadTaskListContext("acct-2", runtime)).resolves.toBeUndefined();
    await expect(resolveTaskSid("acct-2", "1", runtime)).resolves.toBeUndefined();
  });
});
