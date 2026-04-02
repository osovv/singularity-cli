import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTokenFingerprint } from "../auth/index.ts";
import { saveConfig } from "../config/index.ts";
import { setTaskAlias } from "../task-alias-store/index.ts";
import { saveTaskListContext } from "../task-ref-cache/index.ts";
import { isTaskAlias, isTaskSid, resolveTaskReference } from "./index.ts";

// FILE: src/lib/task-ref-resolver/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify task reference resolution across raw ids, SIDs, and aliases.
//   SCOPE: Reference classification and account-scoped resolution behavior.
//   DEPENDS: vitest, src/lib/task-ref-resolver/index.ts, src/lib/task-ref-cache/index.ts, src/lib/task-alias-store/index.ts, src/lib/config/index.ts
//   LINKS: V-M-TASK-REF-RESOLVER, M-TASK-REF-RESOLVER
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-task-ref-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CONFIG_HOME: join(rootPath, "xdg-config"),
      XDG_CACHE_HOME: join(rootPath, "xdg-cache"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("task reference helpers", () => {
  it("detects numeric SIDs and @aliases", () => {
    expect(isTaskSid("12")).toBe(true);
    expect(isTaskSid("abc")).toBe(false);
    expect(isTaskAlias("@today")).toBe(true);
    expect(isTaskAlias("task-1")).toBe(false);
  });
});

describe("resolveTaskReference", () => {
  it("passes raw ids through unchanged", async () => {
    const runtime = await createRuntime();
    await saveConfig({ token: "demo-token" }, runtime);

    const resolved = await resolveTaskReference("task-1", runtime);

    expect(resolved).toEqual({ kind: "raw", input: "task-1", id: "task-1" });
  });

  it("resolves numeric SIDs from the saved last-list cache", async () => {
    const runtime = await createRuntime();
    const token = "demo-token";
    const accountFingerprint = createTokenFingerprint(token);
    await saveConfig({ token }, runtime);
    await saveTaskListContext(
      {
        accountFingerprint,
        command: "singu task list",
        items: [{ sid: "1", id: "task-1", title: "Inbox task" }],
      },
      runtime,
    );

    const resolved = await resolveTaskReference("1", runtime);

    expect(resolved).toEqual({ kind: "sid", input: "1", id: "task-1", sid: "1", title: "Inbox task" });
  });

  it("resolves aliases from the saved alias store", async () => {
    const runtime = await createRuntime();
    const token = "demo-token";
    const accountFingerprint = createTokenFingerprint(token);
    await saveConfig({ token }, runtime);
    await setTaskAlias(accountFingerprint, "today", "task-1", runtime);

    const resolved = await resolveTaskReference("@Today", runtime);

    expect(resolved).toEqual({ kind: "alias", input: "@Today", id: "task-1", aliasName: "today" });
  });
});
