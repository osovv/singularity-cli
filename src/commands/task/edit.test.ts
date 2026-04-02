import { describe, expect, it } from "vitest";

import { createTaskEditPayload } from "./edit.ts";

// FILE: src/commands/task/edit.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify task edit payload creation from CLI title input.
//   SCOPE: Title trimming and empty-title validation for task edit.
//   DEPENDS: vitest, src/commands/task/edit.ts
//   LINKS: V-M-TASK-WRITE-COMMANDS, M-TASK-WRITE-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskEditPayload", () => {
  it("trims the provided title", () => {
    expect(createTaskEditPayload("  New title  ")).toEqual({ title: "New title" });
  });

  it("rejects empty titles", () => {
    expect(() => createTaskEditPayload("   ")).toThrow(/Task title is empty/);
  });
});
