// FILE: src/lib/recurrence-store/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify the local recurrence registry: upsert, seed retirement, chain move, removal, and persistence.
//   SCOPE: Deterministic assertions against an isolated home directory.
//   DEPENDS: vitest, node:fs/promises, src/lib/recurrence-store/index.ts
//   LINKS: V-M-RECURRENCE-STORE, M-RECURRENCE-STORE
// END_MODULE_CONTRACT

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { RecurrenceRule } from "../recurrence-rule/index.ts";
import { getRecurrenceRule, moveRecurrenceRule, removeRecurrenceRule, upsertRecurrenceRule } from "./index.ts";

async function runtime() {
  return { homeDir: await mkdtemp(join(tmpdir(), "singu-recurrence-")) };
}

function sampleRule(seedTaskId: string): RecurrenceRule {
  return { every: "day", interval: 1, seedTaskId, history: [] };
}

describe("recurrence store", () => {
  it("upserts and reads back a rule", async () => {
    const rt = await runtime();
    await upsertRecurrenceRule("T-one", sampleRule("T-one"), rt);
    expect((await getRecurrenceRule("T-one", rt))?.seedTaskId).toBe("T-one");
  });

  it("retires an older carrier of the same seed on upsert", async () => {
    const rt = await runtime();
    await upsertRecurrenceRule("T-old", sampleRule("T-seed"), rt);
    await upsertRecurrenceRule("T-new", { ...sampleRule("T-seed"), history: ["T-new"] }, rt);
    expect(await getRecurrenceRule("T-old", rt)).toBeUndefined();
    expect((await getRecurrenceRule("T-new", rt))?.seedTaskId).toBe("T-seed");
  });

  it("moves the rule to the next carrier and records history", async () => {
    const rt = await runtime();
    await upsertRecurrenceRule("T-first", sampleRule("T-seed"), rt);
    const moved = await moveRecurrenceRule("T-first", "T-second", rt);
    expect(moved?.history).toEqual(["T-second"]);
    expect(await getRecurrenceRule("T-first", rt)).toBeUndefined();
    expect((await getRecurrenceRule("T-second", rt))?.seedTaskId).toBe("T-seed");
  });

  it("removes rules and reports when nothing was carried", async () => {
    const rt = await runtime();
    await upsertRecurrenceRule("T-one", sampleRule("T-one"), rt);
    expect(await removeRecurrenceRule("T-one", rt)).toBe(true);
    expect(await removeRecurrenceRule("T-one", rt)).toBe(false);
  });
});
