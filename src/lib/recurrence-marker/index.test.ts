// FILE: src/lib/recurrence-marker/index.test.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify the note-carried recurrence marker codec: round-trips, total decoding, note preservation, and marker size.
//   SCOPE: Deterministic assertions over encodeRecurrenceMarker, decodeRecurrenceMarker, withMarkerLine, and withoutMarkerLine.
//   DEPENDS: vitest, src/lib/recurrence-marker/index.ts
//   LINKS: V-M-RECURRENCE-MARKER, M-RECURRENCE-MARKER
// END_MODULE_CONTRACT
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Updated to the note-line carrier and added note preservation tests.]
// END_CHANGE_SUMMARY

import { describe, expect, it } from "vitest";

import type { RecurrenceRule } from "../recurrence-rule/index.ts";
import { MARKER_LINE_PREFIX, decodeRecurrenceMarker, encodeRecurrenceMarker, withMarkerLine, withoutMarkerLine } from "./index.ts";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return { every: "day", interval: 1, seed: "T-seed", done: 0, ...overrides };
}

describe("encodeRecurrenceMarker / decodeRecurrenceMarker", () => {
  it("round-trips a minimal rule carried as a note line", () => {
    const marker = encodeRecurrenceMarker(rule());
    expect(marker.startsWith(MARKER_LINE_PREFIX)).toBe(true);
    expect(decodeRecurrenceMarker(marker)).toEqual({ kind: "rule", rule: rule() });
  });

  it("decodes a marker line embedded in a user note", () => {
    const note = `water the plants\nremember the fertilizer\n${encodeRecurrenceMarker(rule({ at: "09:00" }))}`;
    expect(decodeRecurrenceMarker(note)).toEqual({ kind: "rule", rule: rule({ at: "09:00" }) });
  });

  it("round-trips a full rule with at, count, done, and a long seed", () => {
    const full = rule({ every: "week", interval: 2, at: "09:00", count: 10, done: 3, seed: "0b5f0ad7-9a72-41b7-b0a8-a1ea1e26e000" });
    expect(decodeRecurrenceMarker(encodeRecurrenceMarker(full))).toEqual({ kind: "rule", rule: full });
  });

  it("keeps typical markers compact", () => {
    const marker = encodeRecurrenceMarker(rule({ every: "week", interval: 2, at: "09:00", count: 10, done: 3, seed: "0b5f0ad7-9a72-41b7-b0a8-a1ea1e26e000" }));
    expect(marker.length).toBeLessThanOrEqual(200);
  });

  it("returns undefined for empty, null, and marker-less notes", () => {
    expect(decodeRecurrenceMarker(undefined)).toBeUndefined();
    expect(decodeRecurrenceMarker(null)).toBeUndefined();
    expect(decodeRecurrenceMarker("")).toBeUndefined();
    expect(decodeRecurrenceMarker("just a user note\ntwo lines")).toBeUndefined();
  });

  it("returns corrupt for a marker line with invalid base64url or schema", () => {
    expect(decodeRecurrenceMarker(`${MARKER_LINE_PREFIX}!!!!not-base64!!!!`)).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(`note\n${MARKER_LINE_PREFIX}!!!!`)).toEqual({ kind: "corrupt" });
  });

  it("returns corrupt for payloads violating the schema", () => {
    const noteWith = (json: string) => `note\n${MARKER_LINE_PREFIX}${Buffer.from(json).toString("base64url")}`;

    expect(decodeRecurrenceMarker(noteWith(JSON.stringify({ e: "year", i: 1, d: 0, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(noteWith(JSON.stringify({ e: "day", i: 0, d: 0, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(noteWith(JSON.stringify({ e: "day", i: 1, d: -1, s: "T-seed" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(noteWith(JSON.stringify({ e: "day", i: 1, d: 0, s: "" })))).toEqual({ kind: "corrupt" });
    expect(decodeRecurrenceMarker(noteWith("not-json"))).toEqual({ kind: "corrupt" });
  });
});

describe("withMarkerLine / withoutMarkerLine", () => {
  it("appends the marker to a user note preserving user lines", () => {
    const note = withMarkerLine("first\nsecond", encodeRecurrenceMarker(rule()));
    expect(note).toBe(`first\nsecond\n${encodeRecurrenceMarker(rule())}`);
    expect(withoutMarkerLine(note)).toBe("first\nsecond");
  });

  it("replaces an existing marker line without duplicating it", () => {
    const first = withMarkerLine("user text", encodeRecurrenceMarker(rule({ done: 0 })));
    const second = withMarkerLine(first, encodeRecurrenceMarker(rule({ done: 1 })));
    expect(second).toBe(`user text\n${encodeRecurrenceMarker(rule({ done: 1 }))}`);
    expect(decodeRecurrenceMarker(second)).toEqual({ kind: "rule", rule: rule({ done: 1 }) });
  });

  it("produces a marker-only note for empty input and strips back to empty", () => {
    const marker = encodeRecurrenceMarker(rule());
    expect(withMarkerLine(undefined, marker)).toBe(marker);
    expect(withMarkerLine("", marker)).toBe(marker);
    expect(withoutMarkerLine(marker)).toBe("");
    expect(withoutMarkerLine(undefined)).toBe("");
  });

  it("strips marker-only notes from mixed content without touching user lines", () => {
    const marker = encodeRecurrenceMarker(rule());
    expect(withoutMarkerLine(`top\n${marker}\nbottom`)).toBe("top\nbottom");
  });
});
