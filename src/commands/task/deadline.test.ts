import { describe, expect, it } from "vitest";

import { resolveScheduleInput } from "../../lib/time/index.ts";
import { createTaskClearDeadlinePayload, createTaskDeadlinePayload } from "./deadline.ts";

// FILE: src/commands/task/deadline.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify deadline payload creation (date-only → ISO) and clear payload (null).
//   SCOPE: Deadline payload generation.
//   DEPENDS: vitest, src/commands/task/deadline.ts, src/lib/time/index.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskDeadlinePayload", () => {
  it("converts date-only deadline to ISO datetime", () => {
    const payload = createTaskDeadlinePayload(resolveScheduleInput("2026-08-15", new Date("2026-08-09T12:00:00.000Z")));

    expect(payload).toEqual({
      deadline: "2026-08-15T00:00:00.000Z",
    });
  });

  it("keeps ISO datetime with time and sets useTime", () => {
    const payload = createTaskDeadlinePayload(resolveScheduleInput("2026-08-15T18:00:00.000Z", new Date("2026-08-09T12:00:00.000Z")));

    expect(payload).toEqual({
      deadline: "2026-08-15T18:00:00.000Z",
      useTime: true,
    });
  });
});

describe("createTaskClearDeadlinePayload", () => {
  it("clears deadline via null", () => {
    expect(createTaskClearDeadlinePayload() as unknown as Record<string, unknown>).toEqual({
      deadline: null,
      deadlineNotifyReaded: false,
    });
  });
});
