// FILE: src/lib/recurrence-sync/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify the pure sync classifier: chain grouping, max-done invariant, catch-up, finish, stale cleanup, duplicates, and anchor resolution.
//   SCOPE: Deterministic assertions over planRecurrenceSync and resolveCatchUpAnchor.
//   DEPENDS: vitest, src/lib/recurrence-sync/index.ts, src/lib/recurrence-marker/index.ts
//   LINKS: V-M-RECURRENCE-SYNC, M-RECURRENCE-SYNC
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added classifier tests covering every action kind and edge case.]
// END_CHANGE_SUMMARY

import { describe, expect, it } from "vitest";

import { encodeRecurrenceMarker } from "../recurrence-marker/index.ts";
import type { RecurrenceRule } from "../recurrence-rule/index.ts";
import { MARKER_PREFIX } from "../recurrence-marker/index.ts";
import { planRecurrenceSync, resolveCatchUpAnchor, type RecurrenceSyncTask } from "./index.ts";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { every: "day", interval: 1, seed: "S-1", done: 0, ...overrides };
}

function task(id: string, checked: number, carried: RecurrenceRule | string | null): RecurrenceSyncTask {
  if (carried === null) {
    return { id, checked, externalId: "" };
  }

  if (typeof carried === "string") {
    return { id, checked, externalId: carried };
  }

  return { id, checked, externalId: encodeRecurrenceMarker(carried) };
}

describe("planRecurrenceSync", () => {
  it("plans a single catch-up for a stalled completed carrier", () => {
    const carried = rule();
    const plan = planRecurrenceSync([task("T-1", 1, carried)]);

    expect(plan.actions).toEqual([{ kind: "catch-up", carrierId: "T-1", rule: carried }]);
    expect(plan.warnings).toEqual([]);
  });

  it("clears stale markers instead of catching up when a live tail exists (crash window)", () => {
    const plan = planRecurrenceSync([
      task("T-1", 1, rule({ done: 0 })),
      task("T-2", 0, rule({ done: 1 })),
    ]);

    expect(plan.actions).toEqual([{ kind: "clear-stale", taskId: "T-1" }]);
  });

  it("keeps exactly one live tail and clears every other marker of the seed", () => {
    const plan = planRecurrenceSync([
      task("T-1", 1, rule({ done: 0 })),
      task("T-2", 1, rule({ done: 1 })),
      task("T-3", 0, rule({ done: 2 })),
    ]);

    expect(plan.actions).toEqual([{ kind: "clear-stale", taskId: "T-1" }, { kind: "clear-stale", taskId: "T-2" }]);
  });

  it("warns on duplicate live tails with equal maximum done and plans nothing else for the seed", () => {
    const plan = planRecurrenceSync([
      task("T-1", 1, rule({ done: 0 })),
      task("T-2", 0, rule({ done: 1 })),
      task("T-3", 0, rule({ done: 1 })),
    ]);

    expect(plan.actions).toEqual([
      { kind: "duplicate-tails", taskIds: ["T-2", "T-3"], rule: rule({ done: 1 }) },
    ]);
  });

  it("finishes a stalled chain whose quota was reached instead of catching up", () => {
    const carried = rule({ count: 2, done: 2 });
    const plan = planRecurrenceSync([task("T-1", 1, carried)]);

    expect(plan.actions).toEqual([{ kind: "finish", taskId: "T-1", rule: carried }]);
  });

  it("catches up when the quota is not yet reached", () => {
    const carried = rule({ count: 3, done: 1 });
    const plan = planRecurrenceSync([task("T-1", 1, carried)]);

    expect(plan.actions).toEqual([{ kind: "catch-up", carrierId: "T-1", rule: carried }]);
  });

  it("warns on corrupt markers and plans no actions for them", () => {
    const plan = planRecurrenceSync([task("T-1", 1, `${MARKER_PREFIX}not-base64!!`)]);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("T-1");
  });

  it("ignores tasks without markers", () => {
    const plan = planRecurrenceSync([task("T-1", 1, null), task("T-2", 0, "cal-4711")]);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it("classifies independent seeds independently", () => {
    const plan = planRecurrenceSync([
      task("T-1", 1, rule({ seed: "S-1" })),
      task("T-2", 1, rule({ seed: "S-2", done: 4 })),
    ]);

    expect(plan.actions).toEqual([
      { kind: "catch-up", carrierId: "T-1", rule: rule({ seed: "S-1" }) },
      { kind: "catch-up", carrierId: "T-2", rule: rule({ seed: "S-2", done: 4 }) },
    ]);
  });

  it("leaves cancelled carriers untouched when they hold the maximum done", () => {
    const plan = planRecurrenceSync([task("T-1", 2, rule())]);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it("plans nothing for an empty listing", () => {
    const plan = planRecurrenceSync([]);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });
});

describe("resolveCatchUpAnchor", () => {
  const fallback = new Date(2026, 8, 1, 12, 0);

  it("prefers start", () => {
    expect(resolveCatchUpAnchor({ start: "2026-08-01T09:00:00.000Z", completeLast: "2026-08-02T10:00:00.000Z" }, fallback).toISOString()).toBe("2026-08-01T09:00:00.000Z");
  });

  it("falls back to completeLast", () => {
    expect(resolveCatchUpAnchor({ completeLast: "2026-08-02T10:00:00.000Z" }, fallback).toISOString()).toBe("2026-08-02T10:00:00.000Z");
  });

  it("falls back to the provided now", () => {
    expect(resolveCatchUpAnchor({}, fallback)).toBe(fallback);
  });
});
