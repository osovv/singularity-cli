// FILE: src/commands/task/recur.test.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify recurrence rule option validation and carrier rule resolution for `singu task recur`.
//   SCOPE: Deterministic assertions over createRecurrenceRuleOptions validation and resolveCarrierRule guard and merge behavior.
//   DEPENDS: vitest, src/commands/task/recur.ts, src/lib/recurrence-marker/index.ts
//   LINKS: V-M-RECURRENCE-COMMANDS, M-RECURRENCE-COMMANDS, M-RECURRENCE-MARKER
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Updated validation tests to rule params and added guard/merge tests for carrier rule resolution.]
// END_CHANGE_SUMMARY

import { describe, expect, it } from "vitest";

import { encodeRecurrenceMarker } from "../../lib/recurrence-marker/index.ts";
import type { RecurrenceRule } from "../../lib/recurrence-rule/index.ts";
import { createRecurrenceRuleOptions, resolveCarrierRule } from "./recur.ts";

describe("createRecurrenceRuleOptions", () => {
  it("builds rule params from valid inputs", () => {
    expect(createRecurrenceRuleOptions({ every: "week", interval: "2", at: "09:00", count: "5" })).toEqual({
      every: "week",
      interval: 2,
      at: "09:00",
      count: 5,
    });
  });

  it("defaults interval to 1 and omits optional fields", () => {
    expect(createRecurrenceRuleOptions({ every: "day" })).toEqual({
      every: "day",
      interval: 1,
    });
  });

  it("rejects invalid period, interval, time, and count inputs", () => {
    expect(() => createRecurrenceRuleOptions({ every: "year" })).toThrow(/--every/);
    expect(() => createRecurrenceRuleOptions({ every: "day", interval: "0" })).toThrow(/--interval/);
    expect(() => createRecurrenceRuleOptions({ every: "day", at: "25:00" })).toThrow(/--at/);
    expect(() => createRecurrenceRuleOptions({ every: "day", count: "0" })).toThrow(/--count/);
  });
});

describe("resolveCarrierRule", () => {
  const params = createRecurrenceRuleOptions({ every: "day", at: "09:00", count: 4 });

  it("seeds a new rule with the task id and done 0 on a clean task", () => {
    expect(resolveCarrierRule(params, { id: "T-1", externalId: "" })).toEqual({
      every: "day",
      interval: 1,
      at: "09:00",
      count: 4,
      seed: "T-1",
      done: 0,
    });
    expect(resolveCarrierRule(params, { id: "T-1" })).toEqual({
      ...params,
      seed: "T-1",
      done: 0,
    });
  });

  it("re-parameterizes an existing marker while preserving seed and done", () => {
    const existing: RecurrenceRule = { every: "week", interval: 2, seed: "T-seed", done: 3 };
    const rule = resolveCarrierRule(params, { id: "T-9", externalId: encodeRecurrenceMarker(existing) });

    expect(rule.every).toBe("day");
    expect(rule.at).toBe("09:00");
    expect(rule.count).toBe(4);
    expect(rule.seed).toBe("T-seed");
    expect(rule.done).toBe(3);
  });

  it("refuses tasks with a foreign externalId", () => {
    expect(() => resolveCarrierRule(params, { id: "T-1", externalId: "cal-4711" })).toThrow(/externalId from another system/);
  });
});
