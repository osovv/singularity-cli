// FILE: src/lib/recurrence-marker/index.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify the recurrence marker codec: round-trips, total decoding, foreign detection, and marker size.
//   SCOPE: Deterministic assertions over encodeRecurrenceMarker, decodeRecurrenceMarker, and isForeignExternalId.
//   DEPENDS: vitest, src/lib/recurrence-marker/index.ts
//   LINKS: V-M-RECURRENCE-MARKER, M-RECURRENCE-MARKER
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added marker codec tests.]
// END_CHANGE_SUMMARY

import { describe, expect, it } from "vitest";

import type { RecurrenceRule } from "../recurrence-rule/index.ts";
import { MARKER_PREFIX, decodeRecurrenceMarker, encodeRecurrenceMarker, isForeignExternalId } from "./index.ts";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { every: "day", interval: 1, seed: "T-seed", done: 0, ...overrides };
}

describe("encodeRecurrenceMarker / decodeRecurrenceMarker", () => {
  it("round-trips a minimal rule", () => {
    const marker = encodeRecurrenceMarker(rule());
    expect(marker.startsWith(MARKER_PREFIX)).toBe(true);
    expect(decodeRecurrenceMarker(marker)).toEqual({ kind: "rule", rule: rule() });
  });

  it("round-trips a full rule with at, count, done, and a long seed", () => {
    const full = rule({ every: "week", interval: 2, at: "09:00", count: 10, done: 3, seed: "0b5f0ad7-9a72-41b7-b0a8-a1ea1e26e000" });
    expect(decodeRecurrenceMarker(encodeRecurrenceMarker(full))).toEqual({ kind: "rule", rule: full });
  });

  it("keeps typical markers compact", () => {
    const marker = encodeRecurrenceMarker(rule({ every: "week", interval: 2, at: "09:00", count: 10, done: 3, seed: "0b5f0ad7-9a72-41b7-b0a8-a1ea1e26e000" }));
    expect(marker.length).toBeLessThanOrEqual(200);
  });

  it("returns undefined for empty, null, and foreign values", () => {
    expect(decodeRecurrenceMarker(undefined)).toBeUndefined();
    expect(decodeRecurrenceMarker(null)).toBeUndefined();
    expect(decodeRecurrenceMarker("")).toBeUndefined();
    expect(decodeRecurrenceMarker("cal-4711")).toBeUndefined();
  });

  it("returns corrupt for our prefix with invalid base64url", () => {
    expect(decodeRecurrenceMarker(`${MARKER_PREFIX}!!!!not-base64!!!!`)).toEqual({ kind: "corrupt" });
  });

  it("returns corrupt for payloads violating the schema", () => {
    const encodeJson = (json: string) => MARKER_PREFIX + Buffer.from(json).toString("base64url");

    expect(decodeRecurrenceMarker(encodeJson(JSON.stringify({ e: "year", i: 1, d: 0, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(encodeJson(JSON.stringify({ e: "day", i: 0, d: 0, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(encodeJson(JSON.stringify({ e: "day", i: 1, d: -1, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(encodeJson(JSON.stringify({ e: "day", i: 1, d: 0, s: "" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(encodeJson(JSON.stringify({ e: "day", i: 1, d: 0, s: "T-seed", c: 0 })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(encodeJson("not-json"))).toEqual({ kind: "corrupt" });
  });
});

describe("isForeignExternalId", () => {
  it("is false for empty, undefined, and our markers", () => {
    expect(isForeignExternalId("")).toBe(false);
    expect(isForeignExternalId(undefined)).toBe(false);
    expect(isForeignExternalId(null)).toBe(false);
    expect(isForeignExternalId(encodeRecurrenceMarker(rule()))).toBe(false);
  });

  it("is true for any other non-empty value", () => {
    expect(isForeignExternalId("cal-4711")).toBe(true);
    expect(isForeignExternalId("singu-recur:v2:abc")).toBe(true);
    expect(isForeignExternalId("singu-recu:v1:payload")).toBe(true);
  });
});
