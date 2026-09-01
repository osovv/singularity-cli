// FILE: src/lib/recurrence-rule/index.ts
// VERSION: 2.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Pure recurrence rule math: next occurrence dates and human-readable descriptions.
//   SCOPE: Rule types, next occurrence computation for day/week/month periods with strict-future clamping, optional time-of-day attachment, and rule formatting.
//   DEPENDS: none (pure module)
//   LINKS: M-RECURRENCE-RULE, M-RECURRENCE-MARKER, M-RECURRENCE-COMMANDS, M-RECURRENCE-SYNC
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RecurrenceEvery - Literal union of supported recurrence periods.
//   RecurrenceRule - Rule shape carried by the active recurrence task marker.
//   nextOccurrenceDate - Compute the next occurrence datetime strictly after both the base anchor and now.
//   describeRecurrenceRule - Render a rule as a human-readable phrase with done-counter progress.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v2.0.0 - Replaced history array with done counter (seed renamed from seedTaskId) and clamped next occurrences strictly after now so late completions never spawn past occurrences.]
// END_CHANGE_SUMMARY

export type RecurrenceEvery = "day" | "week" | "month";

export type RecurrenceRule = {
  every: RecurrenceEvery;
  interval: number;
  at?: string;
  count?: number;
  seed: string;
  done: number;
};

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function attachTimeOfDay(value: Date, at: string): Date {
  const [hours, minutes] = at.split(":");
  const result = new Date(value);
  result.setHours(Number(hours), Number(minutes), 0, 0);
  return result;
}

function advance(base: Date, rule: RecurrenceRule): Date {
  const result = new Date(base);

  if (rule.every === "day") {
    result.setDate(result.getDate() + rule.interval);
    return result;
  }

  if (rule.every === "week") {
    result.setDate(result.getDate() + rule.interval * 7);
    return result;
  }

  const targetDay = result.getDate();
  const probe = new Date(result.getFullYear(), result.getMonth(), 1);
  probe.setMonth(probe.getMonth() + rule.interval);
  const lastDay = daysInMonth(probe.getFullYear(), probe.getMonth());
  return new Date(
    probe.getFullYear(),
    probe.getMonth(),
    Math.min(targetDay, lastDay),
    result.getHours(),
    result.getMinutes(),
    result.getSeconds(),
    result.getMilliseconds(),
  );
}

// START_CONTRACT: nextOccurrenceDate
//   PURPOSE: Compute the next occurrence datetime strictly after both the base anchor and now.
//   INPUTS: { rule: RecurrenceRule - Active rule. base: Date - Completion anchor date. now: Date | undefined - Reference for strict-future clamping, defaults to the current time. }
//   OUTPUTS: { Date - Next occurrence local datetime with rule time-of-day applied when present, strictly after max(base, now). }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-RULE, M-RECURRENCE-SYNC
// END_CONTRACT: nextOccurrenceDate
export function nextOccurrenceDate(rule: RecurrenceRule, base: Date, now: Date = new Date()): Date {
  const reference = base.getTime() > now.getTime() ? base : now;
  let next = advance(base, rule);

  if (rule.at) {
    let withTime = attachTimeOfDay(next, rule.at);

    while (withTime.getTime() <= reference.getTime()) {
      next = advance(next, rule);
      withTime = attachTimeOfDay(next, rule.at);
    }

    return withTime;
  }

  while (next.getTime() <= reference.getTime()) {
    next = advance(next, rule);
  }

  return next;
}

// START_CONTRACT: describeRecurrenceRule
//   PURPOSE: Render a rule as a human-readable phrase with optional done-counter progress.
//   INPUTS: { rule: RecurrenceRule - Rule to describe. }
//   OUTPUTS: { string - Description like "every 2 weeks at 09:00 (3/10)". }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-RULE
// END_CONTRACT: describeRecurrenceRule
export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const phrase = rule.interval === 1 ? `every ${rule.every}` : `every ${rule.interval} ${rule.every}s`;

  if (rule.count !== undefined) {
    return `${phrase}${rule.at ? ` at ${rule.at}` : ""} (${rule.done}/${rule.count})`;
  }

  return `${phrase}${rule.at ? ` at ${rule.at}` : ""}`;
}
