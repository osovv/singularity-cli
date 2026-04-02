import { describe, expect, it } from "vitest";

import { createBlockTaskPayload } from "./block.ts";

// FILE: src/commands/block.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify block task creation payload generation.
//   SCOPE: Focus-block payload generation from title, project, start, and duration.
//   DEPENDS: vitest, src/commands/block.ts
//   LINKS: V-M-BLOCK-COMMAND, M-BLOCK-COMMAND
// END_MODULE_CONTRACT

describe("createBlockTaskPayload", () => {
  it("creates a timed task payload that starts now and ends after the requested duration", () => {
    const payload = createBlockTaskPayload({
      title: "Deep work on pet project",
      projectId: "P-1",
      start: new Date("2026-04-02T12:00:00.000Z"),
      durationMinutes: 60,
    });

    expect(payload).toEqual({
      title: "Deep work on pet project",
      projectId: "P-1",
      start: "2026-04-02T12:00:00.000Z",
      deadline: "2026-04-02T13:00:00.000Z",
      useTime: true,
      timeLength: 60,
    });
  });
});
