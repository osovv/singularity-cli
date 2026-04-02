import { describe, expect, it } from "vitest";

import { createTaskUnschedulePayload } from "./unschedule.ts";

// FILE: src/commands/task/unschedule.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify task unschedule payload generation.
//   SCOPE: Clearing schedule fields and resetting timed metadata.
//   DEPENDS: vitest, src/commands/task/unschedule.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskUnschedulePayload", () => {
  it("clears task schedule metadata", () => {
    expect(createTaskUnschedulePayload()).toEqual({
      start: "",
      deadline: "",
      useTime: false,
      timeLength: 0,
    });
  });
});
