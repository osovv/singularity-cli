import { describe, expect, it } from "vitest";

import { resolveScheduleInput } from "../../lib/time/index.ts";
import { createTaskSchedulePayload } from "./schedule.ts";

// FILE: src/commands/task/schedule.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify task schedule payload creation from parsed start and deadline inputs.
//   SCOPE: Schedule payload generation and invalid deadline ordering checks.
//   DEPENDS: vitest, src/commands/task/schedule.ts, src/lib/time/index.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskSchedulePayload", () => {
  it("creates a minimal start-only payload for date-only scheduling", () => {
    const payload = createTaskSchedulePayload(resolveScheduleInput("2026-04-03", new Date("2026-04-02T12:00:00.000Z")));

    expect(payload).toEqual({
      start: "2026-04-03",
    });
  });

  it("adds deadline, useTime, and timeLength for timed scheduling", () => {
    const start = resolveScheduleInput("2026-04-03T09:00:00.000Z", new Date("2026-04-02T12:00:00.000Z"));
    const deadline = resolveScheduleInput("2026-04-03T10:30:00.000Z", new Date("2026-04-02T12:00:00.000Z"));

    const payload = createTaskSchedulePayload(start, deadline);

    expect(payload).toEqual({
      start: "2026-04-03T09:00:00.000Z",
      deadline: "2026-04-03T10:30:00.000Z",
      useTime: true,
      timeLength: 90,
    });
  });

  it("rejects deadlines that are earlier than start", () => {
    const start = resolveScheduleInput("2026-04-03T09:00:00.000Z", new Date("2026-04-02T12:00:00.000Z"));
    const deadline = resolveScheduleInput("2026-04-03T08:00:00.000Z", new Date("2026-04-02T12:00:00.000Z"));

    expect(() => createTaskSchedulePayload(start, deadline)).toThrow(/must be greater than or equal/);
  });
});
