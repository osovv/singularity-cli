// FILE: src/lib/recurrence-rule/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Pure recurrence rule math: next occurrence dates and human-readable descriptions.
//   SCOPE: Rule types, next occurrence computation for day/week/month periods, optional time-of-day attachment, and rule formatting.
//   DEPENDS: none (pure module)
//   LINKS: M-RECURRENCE-RULE, M-RECURRENCE-STORE, M-RECURRENCE-COMMANDS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RecurrenceEvery - Literal union of supported recurrence periods.
//   RecurrenceRule - Persisted rule shape carried by the active recurrence task.
//   nextOccurrenceDate - Compute the next occurrence datetime strictly after the base datetime.
//   describeRecurrenceRule - Render a rule as a human-readable phrase.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added pure recurrence rule math for CLI-side recurring tasks.]
// END_CHANGE_SUMMARY

export type RecurrenceEvery = "day" | "week" | "month";

export type RecurrenceRule = {
  every: RecurrenceEvery;
  interval: number;
  at?: string;
  count?: number;
  seedTaskId: string;
  history: string[];
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
  result.setMonth(result.getMonth() + rule.interval);
  result.setDate(Math.min(targetDay, daysInMonth(result.getFullYear(), result.getMonth())));
  return result;
}

// START_CONTRACT: nextOccurrenceDate
//   PURPOSE: Compute the next occurrence datetime strictly after the base datetime.
//   INPUTS: { rule: RecurrenceRule - Active rule. base: Date - Completion anchor date. }
//   OUTPUTS: { Date - Next occurrence local datetime with rule time-of-day applied when present. }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-RULE
// END_CONTRACT: nextOccurrenceDate
export function nextOccurrenceDate(rule: RecurrenceRule, base: Date): Date {
  let next = advance(base, rule);

  if (rule.at) {
    let withTime = attachTimeOfDay(next, rule.at);

    while (withTime.getTime() <= base.getTime()) {
      next = advance(next, rule);
      withTime = attachTimeOfDay(next, rule.at);
    }

    return withTime;
  }

  if (next.getTime() <= base.getTime()) {
    next = advance(next, rule);
  }

  return next;
}

// START_CONTRACT: describeRecurrenceRule
//   PURPOSE: Render a rule as a human-readable phrase with optional quota progress.
//   INPUTS: { rule: RecurrenceRule - Rule to describe. }
//   OUTPUTS: { string - Description like "every 2 weeks at 09:00 (3/10)". }
//   SIDE_EFFECTS: none
//   LINKS: M-RECURRENCE-RULE
// END_CONTRACT: describeRecurrenceRule
export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const phrase = rule.interval === 1 ? `every ${rule.every}` : `every ${rule.interval} ${rule.every}s`;

  if (rule.count !== undefined) {
    return `${phrase}${rule.at ? ` at ${rule.at}` : ""} (${rule.history.length}/${rule.count})`;
  }

  return `${phrase}${rule.at ? ` at ${rule.at}` : ""}`;
}
