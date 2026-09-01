// FILE: src/lib/recurrence-marker/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Encode and decode the versioned recurrence rule marker carried in task externalId.
//   SCOPE: Marker prefix constants, rule-to-marker encoding, total marker decoding with corrupt tolerance, and foreign externalId detection.
//   DEPENDS: src/lib/recurrence-rule/index.ts
//   LINKS: M-RECURRENCE-MARKER, M-RECURRENCE-RULE, M-RECURRENCE-COMMANDS, M-RECURRENCE-SYNC, M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   MARKER_PREFIX - Versioned marker prefix identifying CLI-managed recurrence rules.
//   MARKER_VERSION - Marker schema version embedded in the prefix.
//   DecodedExternalId - Decode result: valid rule, corrupt marker, or undefined for empty/foreign values.
//   encodeRecurrenceMarker - Encode a rule as a compact marker string.
//   decodeRecurrenceMarker - Decode externalId into a rule, corrupt signal, or undefined; never throws.
//   isForeignExternalId - True when externalId is non-empty and does not carry our marker.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added marker codec so recurrence rules travel with carrier tasks through the Singularity API.]
// END_CHANGE_SUMMARY

import type { RecurrenceEvery, RecurrenceRule } from "../recurrence-rule/index.ts";

export const MARKER_VERSION = "v1";
export const MARKER_PREFIX = `singu-recur:${MARKER_VERSION}:`;

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

// START_CONTRACT: encodeRecurrenceMarker
//   PURPOSE: Encode a rule as a compact marker string for the task externalId field.
//   INPUTS: { rule: RecurrenceRule - Rule to encode. }
//   OUTPUTS: { string - MARKER_PREFIX followed by base64url-encoded compact JSON. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER
// END_CONTRACT: encodeRecurrenceMarker
export function encodeRecurrenceMarker(rule: RecurrenceRule): string {
  return MARKER_PREFIX + Buffer.from(JSON.stringify(toPayload(rule))).toString("base64url");
}

// START_CONTRACT: decodeRecurrenceMarker
//   PURPOSE: Decode an externalId value into a rule, a corrupt signal, or undefined.
//   INPUTS: { externalId: string | undefined | null - Task externalId as returned by the API. }
//   OUTPUTS: { DecodedExternalId - rule for valid markers, corrupt for undecodable our-prefix values, undefined for empty or foreign values. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER
// END_CONTRACT: decodeRecurrenceMarker
export function decodeRecurrenceMarker(externalId: string | undefined | null): DecodedExternalId {
  if (typeof externalId !== "string" || externalId.length === 0 || !externalId.startsWith(MARKER_PREFIX)) {
    return undefined;
  }

  try {
    const json = Buffer.from(externalId.slice(MARKER_PREFIX.length), "base64url").toString("utf8");
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

// START_CONTRACT: isForeignExternalId
//   PURPOSE: Detect externalId values owned by other systems so recurrence attach can fail closed.
//   INPUTS: { externalId: string | undefined | null - Task externalId as returned by the API. }
//   OUTPUTS: { boolean - True when the value is non-empty and does not carry our marker. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-MARKER, M-RECURRENCE-COMMANDS
// END_CONTRACT: isForeignExternalId
export function isForeignExternalId(externalId: string | undefined | null): boolean {
  if (typeof externalId !== "string" || externalId.length === 0) {
    return false;
  }

  return !externalId.startsWith(MARKER_PREFIX);
}

export type DecodedExternalId =
  | { kind: "rule"; rule: RecurrenceRule }
  | { kind: "corrupt" }
  | undefined;
