import { describe, expect, it } from "vitest";

import { createTaskUnschedulePayload } from "./unschedule.ts";

// FILE: src/commands/task/unschedule.test.ts
// VERSION: 1.1.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify unschedule payload clears dates via null (API rejects empty strings for ISO fields).
//   SCOPE: Unschedule payload generation.
//   DEPENDS: vitest, src/commands/task/unschedule.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskUnschedulePayload", () => {
  it("clears task schedule metadata via null (empty string is rejected by API)", () => {
    const payload = createTaskUnschedulePayload() as unknown as Record<string, unknown>;

    expect(payload).toEqual({
      start: null,
      deadline: null,
      useTime: false,
    });
  });
});
