import { describe, expect, it } from "vitest";

import { createTaskMovePayload } from "./move.ts";

// FILE: src/commands/task/move.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify move payloads keep projectId+group consistent (API rejects mismatches with GROUP_PROJECT_MISMATCH).
//   SCOPE: Move payload generation for project and inbox destinations.
//   DEPENDS: vitest, src/commands/task/move.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskMovePayload", () => {
  it("includes projectId and default group for project moves", () => {
    expect(createTaskMovePayload({ projectId: "P-1", groupId: "Q-2", inbox: false })).toEqual({
      projectId: "P-1",
      group: "Q-2",
    });
  });

  it("omits group when destination has no default group", () => {
    expect(createTaskMovePayload({ projectId: "P-1", groupId: undefined, inbox: false })).toEqual({
      projectId: "P-1",
    });
  });

  it("clears both projectId and group for inbox moves", () => {
    expect(createTaskMovePayload({ projectId: undefined, groupId: undefined, inbox: true })).toEqual({
      projectId: "",
      group: "",
    });
  });
});
