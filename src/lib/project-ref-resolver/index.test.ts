import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTokenFingerprint } from "../auth/index.ts";
import { saveConfig } from "../config/index.ts";
import { setProjectAlias } from "../project-alias-store/index.ts";
import { saveProjectListContext } from "../project-ref-cache/index.ts";
import { isProjectAlias, isProjectSid, resolveProjectReference } from "./index.ts";

// FILE: src/lib/project-ref-resolver/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify project reference resolution across raw ids, SIDs, and aliases.
//   SCOPE: Reference classification and account-scoped resolution behavior.
//   DEPENDS: vitest, src/lib/project-ref-resolver/index.ts, src/lib/project-ref-cache/index.ts, src/lib/project-alias-store/index.ts, src/lib/config/index.ts
//   LINKS: V-M-PROJECT-REF-RESOLVER, M-PROJECT-REF-RESOLVER
// END_MODULE_CONTRACT

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directoryPath) => rm(directoryPath, { force: true, recursive: true })));
});

async function createRuntime() {
  const rootPath = await mkdtemp(join(tmpdir(), "singu-project-ref-"));
  tempDirectories.push(rootPath);

  return {
    env: {
      XDG_CONFIG_HOME: join(rootPath, "xdg-config"),
      XDG_CACHE_HOME: join(rootPath, "xdg-cache"),
    },
    homeDir: join(rootPath, "home"),
  };
}

describe("project reference helpers", () => {
  it("detects numeric SIDs and @aliases", () => {
    expect(isProjectSid("12")).toBe(true);
    expect(isProjectSid("abc")).toBe(false);
    expect(isProjectAlias("@inbox")).toBe(true);
    expect(isProjectAlias("project-1")).toBe(false);
  });
});

describe("resolveProjectReference", () => {
  it("passes raw ids through unchanged", async () => {
    const runtime = await createRuntime();
    await saveConfig({ token: "demo-token" }, runtime);

    const resolved = await resolveProjectReference("project-1", runtime);

    expect(resolved).toEqual({ kind: "raw", input: "project-1", id: "project-1" });
  });

  it("resolves numeric SIDs from the saved last-list cache", async () => {
    const runtime = await createRuntime();
    const token = "demo-token";
    const accountFingerprint = createTokenFingerprint(token);
    await saveConfig({ token }, runtime);
    await saveProjectListContext(
      {
        accountFingerprint,
        command: "singu project list",
        items: [{ sid: "1", id: "project-1", title: "Inbox" }],
      },
      runtime,
    );

    const resolved = await resolveProjectReference("1", runtime);

    expect(resolved).toEqual({ kind: "sid", input: "1", id: "project-1", sid: "1", title: "Inbox" });
  });

  it("resolves aliases from the saved alias store", async () => {
    const runtime = await createRuntime();
    const token = "demo-token";
    const accountFingerprint = createTokenFingerprint(token);
    await saveConfig({ token }, runtime);
    await setProjectAlias(accountFingerprint, "inbox", "project-1", runtime);

    const resolved = await resolveProjectReference("@Inbox", runtime);

    expect(resolved).toEqual({ kind: "alias", input: "@Inbox", id: "project-1", aliasName: "inbox" });
  });
});
