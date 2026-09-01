// FILE: src/lib/recurrence-sync/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Pure classification of recurrence marker state across a task listing into convergence actions.
//   SCOPE: Marker decoding aggregation, seed grouping, max-done chain invariant, catch-up/finish/stale/duplicate action planning, and catch-up anchor resolution.
//   DEPENDS: src/lib/recurrence-marker/index.ts, src/lib/recurrence-rule/index.ts
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-MARKER, M-RECURRENCE-RULE
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RecurrenceSyncTask - Minimal task fields consumed by the classifier.
//   RecurrenceSyncAction - Planned convergence action for one task or chain.
//   RecurrenceSyncPlan - Actions plus warnings produced by one classification pass.
//   planRecurrenceSync - Classify all marker state in a task listing.
//   resolveCatchUpAnchor - Resolve the catch-up anchor date: start, else completeLast, else now.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added pure sync classifier implementing the max-done chain invariant.]
// END_CHANGE_SUMMARY

import { decodeRecurrenceMarker } from "../recurrence-marker/index.ts";
import type { RecurrenceRule } from "../recurrence-rule/index.ts";

export type RecurrenceSyncTask = {
  id: string;
  checked: number;
  externalId?: string | null;
};

export type RecurrenceSyncAction =
  | { kind: "catch-up"; carrierId: string; rule: RecurrenceRule }
  | { kind: "clear-stale"; taskId: string }
  | { kind: "finish"; taskId: string; rule: RecurrenceRule }
  | { kind: "duplicate-tails"; taskIds: string[]; rule: RecurrenceRule };

export type RecurrenceSyncPlan = {
  actions: RecurrenceSyncAction[];
  warnings: string[];
};

type ClassifiedTask = {
  task: RecurrenceSyncTask;
  rule: RecurrenceRule;
};

// START_CONTRACT: planRecurrenceSync
//   PURPOSE: Classify all marker state in a task listing into convergence actions.
//   INPUTS: { tasks: RecurrenceSyncTask[] - Task listing with id, checked, and externalId. }
//   OUTPUTS: { RecurrenceSyncPlan - Actions and warnings. Live tails are unchecked tasks with the seed's maximum done; completed carriers at the maximum with no live tail are stalled chains (catch-up, or finish when the quota was reached); every other marker task of a seed with exactly one live tail is stale; two or more live tails with equal maximum done are reported for manual unrecur. Corrupt markers warn and are ignored. Cancelled carriers (checked 2) are left untouched. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-MARKER
// END_CONTRACT: planRecurrenceSync
export function planRecurrenceSync(tasks: RecurrenceSyncTask[]): RecurrenceSyncPlan {
  const warnings: string[] = [];
  const bySeed = new Map<string, ClassifiedTask[]>();

  for (const task of tasks) {
    const decoded = decodeRecurrenceMarker(task.externalId);

    if (!decoded) {
      continue;
    }

    if (decoded.kind === "corrupt") {
      warnings.push(`Task ${task.id} carries an unreadable recurrence marker; ignoring it.`);
      continue;
    }

    const group = bySeed.get(decoded.rule.seed) ?? [];
    group.push({ task, rule: decoded.rule });
    bySeed.set(decoded.rule.seed, group);
  }

  const actions: RecurrenceSyncAction[] = [];

  for (const group of bySeed.values()) {
    const maxDone = Math.max(...group.map((entry) => entry.rule.done));
    const tails = group.filter((entry) => entry.task.checked === 0 && entry.rule.done === maxDone);
    const head = tails[0];

    if (tails.length > 1 && head) {
      actions.push({
        kind: "duplicate-tails",
        taskIds: tails.map((entry) => entry.task.id),
        rule: head.rule,
      });
      continue;
    }

    if (head) {
      for (const entry of group) {
        if (entry.task.id !== head.task.id) {
          actions.push({ kind: "clear-stale", taskId: entry.task.id });
        }
      }

      continue;
    }

    const stalled = group.filter((entry) => entry.task.checked === 1 && entry.rule.done === maxDone);
    const stalledHead = stalled[0];

    if (stalled.length > 1 && stalledHead) {
      actions.push({
        kind: "duplicate-tails",
        taskIds: stalled.map((entry) => entry.task.id),
        rule: stalledHead.rule,
      });
      continue;
    }

    if (stalledHead) {
      if (stalledHead.rule.count !== undefined && stalledHead.rule.done >= stalledHead.rule.count) {
        actions.push({ kind: "finish", taskId: stalledHead.task.id, rule: stalledHead.rule });
      } else {
        actions.push({ kind: "catch-up", carrierId: stalledHead.task.id, rule: stalledHead.rule });
      }
    }
  }

  return { actions, warnings };
}

// START_CONTRACT: resolveCatchUpAnchor
//   PURPOSE: Resolve the anchor date for catch-up spawning.
//   INPUTS: { carrier: { start?: string, completeLast?: string } - Stalled carrier fields. fallbackNow: Date - Used when neither field is present. }
//   OUTPUTS: { Date - Anchor for nextOccurrenceDate: carrier start when set, else completeLast, else the fallback. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-SYNC, M-RECURRENCE-RULE
// END_CONTRACT: resolveCatchUpAnchor
export function resolveCatchUpAnchor(
  carrier: { start?: string; completeLast?: string },
  fallbackNow: Date,
): Date {
  if (carrier.start) {
    return new Date(carrier.start);
  }

  if (carrier.completeLast) {
    return new Date(carrier.completeLast);
  }

  return fallbackNow;
}
