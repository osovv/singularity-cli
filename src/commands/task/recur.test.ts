// FILE: src/commands/task/recur.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify recurrence rule option validation for `singu task recur`.
//   SCOPE: Deterministic assertions over createRecurrenceRuleOptions happy paths and validation errors.
//   DEPENDS: vitest, src/commands/task/recur.ts
//   LINKS: V-M-RECURRENCE-COMMANDS, M-RECURRENCE-COMMANDS
// END_MODULE_CONTRACT

import { describe, expect, it } from "vitest";

import { createRecurrenceRuleOptions } from "./recur.ts";

describe("createRecurrenceRuleOptions", () => {
  it("builds a rule from valid inputs", () => {
    expect(createRecurrenceRuleOptions({ every: "week", interval: "2", at: "09:00", count: "5", seedTaskId: "T-seed" })).toEqual({
      every: "week",
      interval: 2,
      at: "09:00",
      count: 5,
      seedTaskId: "T-seed",
      history: [],
    });
  });

  it("defaults interval to 1 and omits optional fields", () => {
    expect(createRecurrenceRuleOptions({ every: "day", seedTaskId: "T-seed" })).toEqual({
      every: "day",
      interval: 1,
      seedTaskId: "T-seed",
      history: [],
    });
  });

  it("rejects invalid period, interval, time, and count inputs", () => {
    expect(() => createRecurrenceRuleOptions({ every: "year", seedTaskId: "T" })).toThrow(/--every/);
    expect(() => createRecurrenceRuleOptions({ every: "day", interval: "0", seedTaskId: "T" })).toThrow(/--interval/);
    expect(() => createRecurrenceRuleOptions({ every: "day", at: "25:00", seedTaskId: "T" })).toThrow(/--at/);
    expect(() => createRecurrenceRuleOptions({ every: "day", count: "0", seedTaskId: "T" })).toThrow(/--count/);
  });
});
