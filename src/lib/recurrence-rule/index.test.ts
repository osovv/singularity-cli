// FILE: src/lib/recurrence-rule/index.test.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify recurrence rule math: period advancement, month clamping, time-of-day, strict-future guarantees, and done-counter descriptions.
//   SCOPE: Deterministic assertions over nextOccurrenceDate and describeRecurrenceRule with an injected now.
//   DEPENDS: vitest, src/lib/recurrence-rule/index.ts
//   LINKS: V-M-RECURRENCE-RULE, M-RECURRENCE-RULE
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Updated to the done-counter rule shape, injected a fixed now for determinism, and added strict-future clamping cases.]
// END_CHANGE_SUMMARY

import { describe, expect, it } from "vitest";

import { describeRecurrenceRule, nextOccurrenceDate, type RecurrenceRule } from "./index.ts";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { every: "day", interval: 1, seed: "T-seed", done: 0, ...overrides };
}

// Fixed clock: 2026-09-01 08:00 local, before every base used below.
const NOW = new Date(2026, 8, 1, 8, 0);

describe("nextOccurrenceDate", () => {
  it("advances by one day by default", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule(), base, NOW).toISOString()).toBe(new Date(2026, 8, 2, 9, 0).toISOString());
  });

  it("honours multi-day intervals", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule({ interval: 2 }), base, NOW).toISOString()).toBe(new Date(2026, 8, 3, 9, 0).toISOString());
  });

  it("advances by interval weeks", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule({ every: "week", interval: 2 }), base, NOW).toISOString()).toBe(new Date(2026, 8, 15, 9, 0).toISOString());
  });

  it("clamps month recurrence to the target month length", () => {
    const base = new Date(2026, 0, 31, 9, 0);
    const now = new Date(2026, 0, 31, 8, 0);
    expect(nextOccurrenceDate(rule({ every: "month" }), base, now).toISOString()).toBe(new Date(2026, 1, 28, 9, 0).toISOString());
  });

  it("attaches the requested time of day and stays in the future", () => {
    const base = new Date(2026, 8, 1, 15, 0);
    const next = nextOccurrenceDate(rule({ at: "09:00" }), base, NOW);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(2);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it("never returns a datetime in the past relative to now", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    const now = new Date(2026, 8, 3, 15, 0);
    const next = nextOccurrenceDate(rule(), base, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.toISOString()).toBe(new Date(2026, 8, 4, 9, 0).toISOString());
  });

  it("clamps timed rules strictly after now when the anchor is stale", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    const now = new Date(2026, 8, 2, 10, 30);
    const next = nextOccurrenceDate(rule({ at: "09:00" }), base, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.toISOString()).toBe(new Date(2026, 8, 3, 9, 0).toISOString());
  });

  it("prefers the later of base and now as the reference point", () => {
    const base = new Date(2026, 8, 10, 9, 0);
    const now = new Date(2026, 8, 1, 9, 0);
    const next = nextOccurrenceDate(rule(), base, now);
    expect(next.toISOString()).toBe(new Date(2026, 8, 11, 9, 0).toISOString());
  });
});

describe("describeRecurrenceRule", () => {
  it("describes singular and plural phrases with quota", () => {
    expect(describeRecurrenceRule(rule())).toBe("every day");
    expect(describeRecurrenceRule(rule({ every: "week", interval: 2, at: "09:00" }))).toBe("every 2 weeks at 09:00");
    expect(describeRecurrenceRule(rule({ count: 10, done: 3 }))).toBe("every day (3/10)");
  });
});
