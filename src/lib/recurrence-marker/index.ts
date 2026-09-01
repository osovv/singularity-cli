// FILE: src/lib/recurrence-marker/index.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Encode and decode the versioned recurrence rule marker carried in the carrier task note.
//   SCOPE: Marker line constants, rule-to-marker encoding, total marker decoding with corrupt tolerance, and note-aware append/strip helpers.
//   DEPENDS: src/lib/recurrence-rule/index.ts
//   LINKS: M-RECURRENCE-MARKER, M-RECURRENCE-RULE, M-RECURRENCE-COMMANDS, M-RECURRENCE-SYNC, M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   MARKER_VERSION - Marker schema version embedded in the marker line prefix.
//   MARKER_LINE_PREFIX - Line prefix identifying the CLI-managed recurrence marker inside a task note.
//   DecodedMarker - Decode result: valid rule, corrupt marker, or undefined when no marker line exists.
//   encodeRecurrenceMarker - Encode a rule as a compact marker line.
//   decodeRecurrenceMarker - Extract and decode the marker line from a note; never throws.
//   markerLineOf - Return the raw marker line carried by a note, when present.
//   withMarkerLine - Append or replace the marker line on a note while preserving user text.
//   withoutMarkerLine - Strip the marker line from a note, preserving user text.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Moved the marker carrier from externalId to a standalone note line after live E2E proved an active calendar integration claims externalId on scheduled tasks; added note-aware append/strip helpers.]
// END_CHANGE_SUMMARY

import type { RecurrenceEvery, RecurrenceRule } from "../recurrence-rule/index.ts";

export const MARKER_VERSION = "v1";
export const MARKER_LINE_PREFIX = `singu-recur:${MARKER_VERSION}:`;

/**
 * Compact wire keys keep markers small: e=every, i=interval, a=at, c=count, d=done, s=seed.
 */
type MarkerPayload = {
  e: string;
  i: number;
  a?: string;
  c?: number;
  d: number;
  s: string;
};

const EVERY_VALUES: readonly string[] = ["day", "week", "month"];

function toPayload(rule: RecurrenceRule): MarkerPayload {
  return {
    e: rule.every,
    i: rule.interval,
    ...(rule.at !== undefined ? { a: rule.at } : {}),
    ...(rule.count !== undefined ? { c: rule.count } : {}),
    d: rule.done,
    s: rule.seed,
  };
}

function fromPayload(payload: MarkerPayload): RecurrenceRule | null {
  const every = EVERY_VALUES.includes(payload.e) ? (payload.e as RecurrenceEvery) : null;

  if (!every) {
    return null;
  }

  if (typeof payload.i !== "number" || !Number.isFinite(payload.i) || payload.i < 1) {
    return null;
  }

  if (typeof payload.d !== "number" || !Number.isFinite(payload.d) || payload.d < 0) {
    return null;
  }

  if (typeof payload.s !== "string" || payload.s.length === 0) {
    return null;
  }

  if (payload.c !== undefined && (typeof payload.c !== "number" || !Number.isFinite(payload.c) || payload.c < 1)) {
    return null;
  }

  if (payload.a !== undefined && typeof payload.a !== "string") {
    return null;
  }

  return {
    every,
    interval: payload.i,
    ...(payload.a !== undefined ? { at: payload.a } : {}),
    ...(payload.c !== undefined ? { count: payload.c } : {}),
    seed: payload.s,
    done: payload.d,
  };
}

function findMarkerLine(note: string): string | undefined {
  const lines = note.split("\n");
  const markerLine = lines.find((line) => line.trim().startsWith(MARKER_LINE_PREFIX));
  return markerLine?.trim();
}

// START_CONTRACT: encodeRecurrenceMarker
//   PURPOSE: Encode a rule as a compact standalone marker line for the task note.
//   INPUTS: { rule: RecurrenceRule - Rule to encode. }
//   OUTPUTS: { string - MARKER_LINE_PREFIX followed by base64url-encoded compact JSON, without a trailing newline. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER
// END_CONTRACT: encodeRecurrenceMarker
export function encodeRecurrenceMarker(rule: RecurrenceRule): string {
  return MARKER_LINE_PREFIX + Buffer.from(JSON.stringify(toPayload(rule))).toString("base64url");
}

// START_CONTRACT: decodeRecurrenceMarker
//   PURPOSE: Extract and decode the marker line from a task note.
//   INPUTS: { note: string | undefined | null - Task note as returned by the API. }
//   OUTPUTS: { DecodedMarker - rule for valid markers, corrupt for undecodable marker lines, undefined when the note carries no marker line. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER
// END_CONTRACT: decodeRecurrenceMarker
export function decodeRecurrenceMarker(note: string | undefined | null): DecodedMarker {
  if (typeof note !== "string" || note.length === 0) {
    return undefined;
  }

  const markerLine = findMarkerLine(note);

  if (!markerLine) {
    return undefined;
  }

  try {
    const json = Buffer.from(markerLine.slice(MARKER_LINE_PREFIX.length), "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<MarkerPayload>;

    if (!parsed || typeof parsed !== "object") {
      return { kind: "corrupt" };
    }

    const rule = fromPayload({ e: "", i: 0, d: 0, s: "", ...parsed });

    return rule ? { kind: "rule", rule } : { kind: "corrupt" };
  } catch {
    return { kind: "corrupt" };
  }
}

// START_CONTRACT: markerLineOf
//   PURPOSE: Return the raw marker line carried by a note, when present.
//   INPUTS: { note: string | undefined | null - Task note as returned by the API. }
//   OUTPUTS: { string | undefined - The trimmed marker line, or undefined when the note carries none. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER
// END_CONTRACT: markerLineOf
export function markerLineOf(note: string | undefined | null): string | undefined {
  if (typeof note !== "string" || note.length === 0) {
    return undefined;
  }

  return findMarkerLine(note);
}

// START_CONTRACT: withMarkerLine
//   PURPOSE: Append or replace the marker line on a note while preserving user text.
//   INPUTS: { note: string | undefined | null - Current note. marker: string - Encoded marker line to carry. }
//   OUTPUTS: { string - Note whose final line is the marker; any previous marker line is removed first. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER, M-RECURRENCE-COMMANDS
// END_CONTRACT: withMarkerLine
export function withMarkerLine(note: string | undefined | null, marker: string): string {
  const userLines = withoutMarkerLine(note).split("\n").filter((line, index, all) => line.trim().length > 0 || index < all.length - 1);
  const base = userLines.length > 0 ? userLines.join("\n") : "";

  return base.length > 0 ? `${base}\n${marker}` : marker;
}

// START_CONTRACT: withoutMarkerLine
//   PURPOSE: Strip the marker line from a note, preserving user text.
//   INPUTS: { note: string | undefined | null - Note that may carry a marker line. }
//   OUTPUTS: { string - Note text without the marker line; empty string when the note was marker-only. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER, M-RECURRENCE-COMMANDS, M-RECURRENCE-SYNC
// END_CONTRACT: withoutMarkerLine
export function withoutMarkerLine(note: string | undefined | null): string {
  if (typeof note !== "string" || note.length === 0) {
    return "";
  }

  return note
    .split("\n")
    .filter((line) => line.trim().startsWith(MARKER_LINE_PREFIX) === false)
    .join("\n")
    .replace(/\n+$/, "");
}

export type DecodedMarker =
  | { kind: "rule"; rule: RecurrenceRule }
  | { kind: "corrupt" }
  | undefined;
