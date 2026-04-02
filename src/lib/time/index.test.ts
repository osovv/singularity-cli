import { describe, expect, it } from "vitest";

import { addMinutes, formatLocalDateOnly, parseDurationMinutes, resolveScheduleInput } from "./index.ts";

// FILE: src/lib/time/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify shared duration and schedule parsing helpers used by task write and block flows.
//   SCOPE: Duration parsing, schedule input parsing, and date arithmetic.
//   DEPENDS: vitest, src/lib/time/index.ts
//   LINKS: V-M-TIME-UTILS, M-TIME-UTILS
// END_MODULE_CONTRACT

describe("parseDurationMinutes", () => {
  it("parses hour and minute combinations", () => {
    expect(parseDurationMinutes("30m")).toBe(30);
    expect(parseDurationMinutes("1h")).toBe(60);
    expect(parseDurationMinutes("1h30m")).toBe(90);
    expect(parseDurationMinutes("2h15m")).toBe(135);
  });

  it("rejects invalid duration strings", () => {
    expect(() => parseDurationMinutes("")) .toThrow(/Duration input is empty/);
    expect(() => parseDurationMinutes("1d")).toThrow(/Invalid duration input/);
    expect(() => parseDurationMinutes("abc")).toThrow(/Invalid duration input/);
  });
});

describe("resolveScheduleInput", () => {
  const referenceNow = new Date("2026-04-02T12:30:00.000Z");

  it("resolves now, today, and tomorrow shorthands", () => {
    expect(resolveScheduleInput("now", referenceNow)).toMatchObject({ value: "2026-04-02T12:30:00.000Z", hasTime: true });
    expect(resolveScheduleInput("today", referenceNow)).toMatchObject({ value: formatLocalDateOnly(referenceNow), hasTime: false });
    expect(resolveScheduleInput("tomorrow", referenceNow)).toMatchObject({ value: "2026-04-03", hasTime: false });
  });

  it("passes through date-only input and normalizes datetimes", () => {
    expect(resolveScheduleInput("2026-05-01", referenceNow)).toMatchObject({ value: "2026-05-01", hasTime: false });
    expect(resolveScheduleInput("2026-05-01T15:45:00.000Z", referenceNow)).toMatchObject({
      value: "2026-05-01T15:45:00.000Z",
      hasTime: true,
    });
  });

  it("rejects invalid schedule strings", () => {
    expect(() => resolveScheduleInput("not-a-date", referenceNow)).toThrow(/Invalid schedule input/);
  });
});

describe("addMinutes", () => {
  it("returns a new date with the requested duration applied", () => {
    const start = new Date("2026-04-02T12:30:00.000Z");
    expect(addMinutes(start, 90).toISOString()).toBe("2026-04-02T14:00:00.000Z");
  });
});
