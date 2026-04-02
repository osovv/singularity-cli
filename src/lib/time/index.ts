// FILE: src/lib/time/index.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Parse duration and scheduling inputs such as `1h`, `90m`, `now`, `today`, `tomorrow`, dates, and datetimes into stable task payload values.
//   SCOPE: Duration parsing, schedule input parsing, date-only formatting, and minute-based date arithmetic.
//   DEPENDS: none
//   LINKS: M-TIME-UTILS, M-TASK-WRITE-COMMANDS, M-BLOCK-COMMAND
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   formatLocalDateOnly - Format a Date into a local YYYY-MM-DD string.
//   parseDurationMinutes - Parse CLI duration input into minutes.
//   resolveScheduleInput - Resolve schedule shorthands and ISO values into stable payload values.
//   addMinutes - Add a number of minutes to a Date.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.0.0 - Added shared duration and schedule parsing helpers for task write and block flows.]
// END_CHANGE_SUMMARY

export type ResolvedScheduleInput = {
  raw: string;
  value: string;
  date: Date;
  hasTime: boolean;
};

function assertFinitePositiveInteger(value: number, input: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid duration input: ${input}. Use values like \`30m\`, \`1h\`, or \`1h30m\`.`);
  }
}

// START_CONTRACT: formatLocalDateOnly
//   PURPOSE: Format a Date into a local YYYY-MM-DD string for date-only task fields.
//   INPUTS: { value: Date - Date to format. }
//   OUTPUTS: { string - Local YYYY-MM-DD representation. }
//   SIDE_EFFECTS: none
//   LINKS: M-TIME-UTILS
// END_CONTRACT: formatLocalDateOnly
export function formatLocalDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// START_CONTRACT: parseDurationMinutes
//   PURPOSE: Parse a CLI duration string such as `1h`, `90m`, or `1h30m` into minutes.
//   INPUTS: { input: string - User-provided duration string. }
//   OUTPUTS: { number - Total duration in minutes. }
//   SIDE_EFFECTS: none
//   LINKS: M-TIME-UTILS, M-BLOCK-COMMAND
// END_CONTRACT: parseDurationMinutes
export function parseDurationMinutes(input: string): number {
  const normalizedInput = input.trim().toLowerCase();

  if (!normalizedInput) {
    throw new Error("Duration input is empty.");
  }

  const durationPattern = /(\d+)(h|m)/g;
  let match: RegExpExecArray | null;
  let consumedCharacters = 0;
  let totalMinutes = 0;

  while ((match = durationPattern.exec(normalizedInput)) !== null) {
    const [, rawAmount = "", unit = "m"] = match;
    const amount = Number.parseInt(rawAmount, 10);

    assertFinitePositiveInteger(amount, input);
    consumedCharacters += match[0].length;
    totalMinutes += unit === "h" ? amount * 60 : amount;
  }

  if (consumedCharacters !== normalizedInput.length || totalMinutes <= 0) {
    throw new Error(`Invalid duration input: ${input}. Use values like \`30m\`, \`1h\`, or \`1h30m\`.`);
  }

  return totalMinutes;
}

function parseDateOnly(input: string): Date | undefined {
  const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateOnlyMatch) {
    return undefined;
  }

  const [, yearString = "", monthString = "", dayString = ""] = dateOnlyMatch;
  const year = Number.parseInt(yearString, 10);
  const month = Number.parseInt(monthString, 10);
  const day = Number.parseInt(dayString, 10);
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime()) || formatLocalDateOnly(parsedDate) !== input) {
    return undefined;
  }

  return parsedDate;
}

// START_CONTRACT: resolveScheduleInput
//   PURPOSE: Resolve `now`, `today`, `tomorrow`, dates, and datetimes into stable task payload values.
//   INPUTS: { input: string - User-provided schedule input. now: Date | undefined - Optional reference time for deterministic tests. }
//   OUTPUTS: { ResolvedScheduleInput - Normalized payload value, Date instance, and time-awareness metadata. }
//   SIDE_EFFECTS: none
//   LINKS: M-TIME-UTILS, M-TASK-WRITE-COMMANDS, M-BLOCK-COMMAND
// END_CONTRACT: resolveScheduleInput
export function resolveScheduleInput(input: string, now: Date = new Date()): ResolvedScheduleInput {
  const normalizedInput = input.trim();

  if (!normalizedInput) {
    throw new Error("Schedule input is empty.");
  }

  const loweredInput = normalizedInput.toLowerCase();

  // START_BLOCK_RESOLVE_SCHEDULE_INPUT
  if (loweredInput === "now") {
    const reference = new Date(now);

    return {
      raw: normalizedInput,
      value: reference.toISOString(),
      date: reference,
      hasTime: true,
    };
  }

  if (loweredInput === "today" || loweredInput === "tomorrow") {
    const reference = new Date(now);
    reference.setHours(0, 0, 0, 0);

    if (loweredInput === "tomorrow") {
      reference.setDate(reference.getDate() + 1);
    }

    return {
      raw: normalizedInput,
      value: formatLocalDateOnly(reference),
      date: reference,
      hasTime: false,
    };
  }

  const dateOnly = parseDateOnly(normalizedInput);

  if (dateOnly) {
    return {
      raw: normalizedInput,
      value: normalizedInput,
      date: dateOnly,
      hasTime: false,
    };
  }

  const parsedDate = new Date(normalizedInput);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(
      `Invalid schedule input: ${input}. Use \`now\`, \`today\`, \`tomorrow\`, \`YYYY-MM-DD\`, or an ISO datetime.`,
    );
  }

  return {
    raw: normalizedInput,
    value: parsedDate.toISOString(),
    date: parsedDate,
    hasTime: true,
  };
  // END_BLOCK_RESOLVE_SCHEDULE_INPUT
}

// START_CONTRACT: addMinutes
//   PURPOSE: Add a number of minutes to a Date and return a new Date instance.
//   INPUTS: { value: Date - Start time. minutes: number - Minutes to add. }
//   OUTPUTS: { Date - New Date advanced by the provided number of minutes. }
//   SIDE_EFFECTS: none
//   LINKS: M-TIME-UTILS, M-BLOCK-COMMAND
// END_CONTRACT: addMinutes
export function addMinutes(value: Date, minutes: number): Date {
  const nextValue = new Date(value);
  nextValue.setMinutes(nextValue.getMinutes() + minutes);
  return nextValue;
}
