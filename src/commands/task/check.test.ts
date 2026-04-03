import { describe, expect, it } from "vitest";

import { createTaskCheckedUpdate } from "./check.ts";

// FILE: src/commands/task/check.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: Verify minimal PATCH payload creation for `task do` and `task undo`.
//   SCOPE: Already-satisfied detection and checked-state update payload generation.
//   DEPENDS: vitest, src/commands/task/check.ts
//   LINKS: V-M-TASK-ACTION-COMMANDS, M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT

describe("createTaskCheckedUpdate", () => {
  it("returns no update when the task is already done", () => {
    expect(createTaskCheckedUpdate({ checked: 1 }, 1)).toBeUndefined();
  });

  it("returns no update when the task is already open", () => {
    expect(createTaskCheckedUpdate({ checked: 0 }, 0)).toBeUndefined();
    expect(createTaskCheckedUpdate({}, 0)).toBeUndefined();
  });

  it("returns checked + complete payload for do transitions", () => {
    expect(createTaskCheckedUpdate({ checked: 0 }, 1)).toEqual({ checked: 1, complete: 100 });
    expect(createTaskCheckedUpdate({}, 1)).toEqual({ checked: 1, complete: 100 });
    expect(createTaskCheckedUpdate({ checked: 2 }, 1)).toEqual({ checked: 1, complete: 100 });
  });

  it("returns checked + complete=0 payload for undo transitions", () => {
    expect(createTaskCheckedUpdate({ checked: 1 }, 0)).toEqual({ checked: 0, complete: 0 });
    expect(createTaskCheckedUpdate({ checked: 2 }, 0)).toEqual({ checked: 0, complete: 0 });
  });
});
