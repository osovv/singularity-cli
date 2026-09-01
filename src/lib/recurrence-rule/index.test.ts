// FILE: src/lib/recurrence-rule/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify recurrence rule math: period advancement, month clamping, time-of-day, and forward guarantees.
//   SCOPE: Deterministic assertions over nextOccurrenceDate and describeRecurrenceRule.
//   DEPENDS: vitest, src/lib/recurrence-rule/index.ts
//   LINKS: V-M-RECURRENCE-RULE, M-RECURRENCE-RULE
// END_MODULE_CONTRACT

import { describe, expect, it } from "vitest";

import { describeRecurrenceRule, nextOccurrenceDate, type RecurrenceRule } from "./index.ts";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { every: "day", interval: 1, seedTaskId: "T-seed", history: [], ...overrides };
}

describe("nextOccurrenceDate", () => {
  it("advances by one day by default", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule(), base).toISOString()).toBe(new Date(2026, 8, 2, 9, 0).toISOString());
  });

  it("honours multi-day intervals", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule({ interval: 2 }), base).toISOString()).toBe(new Date(2026, 8, 3, 9, 0).toISOString());
  });

  it("advances by interval weeks", () => {
    const base = new Date(2026, 8, 1, 9, 0);
    expect(nextOccurrenceDate(rule({ every: "week", interval: 2 }), base).toISOString()).toBe(new Date(2026, 8, 15, 9, 0).toISOString());
  });

  it("clamps month recurrence to the target month length", () => {
    const base = new Date(2026, 0, 31, 9, 0);
    expect(nextOccurrenceDate(rule({ every: "month" }), base).toISOString()).toBe(new Date(2026, 1, 28, 9, 0).toISOString());
  });

  it("attaches the requested time of day and stays in the future", () => {
    const base = new Date(2026, 8, 1, 15, 0);
    const next = nextOccurrenceDate(rule({ at: "09:00" }), base);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(2);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });
});

describe("describeRecurrenceRule", () => {
  it("describes singular and plural phrases with quota", () => {
    expect(describeRecurrenceRule(rule())).toBe("every day");
    expect(describeRecurrenceRule(rule({ every: "week", interval: 2, at: "09:00" }))).toBe("every 2 weeks at 09:00");
    expect(describeRecurrenceRule(rule({ count: 10, history: ["T-a"] }))).toBe("every day (1/10)");
  });
});
