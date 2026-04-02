// FILE: src/commands/task/index.ts
// VERSION: 1.3.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `task` command group for `singu`.
//   SCOPE: Parent task command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/task/list.ts, src/commands/task/get.ts, src/commands/task/add.ts, src/commands/task/move.ts, src/commands/task/schedule.ts, src/commands/task/do.ts, src/commands/task/undo.ts, src/commands/task/alias/index.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-WRITE-COMMANDS, M-TASK-ACTION-COMMANDS, M-TASK-ALIAS-COMMANDS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskCommand - Parent task command with list, get, add, move, schedule, do, undo, and alias subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.3.0 - Added task add, move, and schedule commands.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskAddCommand } from "./add.ts";
import { taskAliasCommand } from "./alias/index.ts";
import { taskDoCommand } from "./do.ts";
import { taskGetCommand } from "./get.ts";
import { taskListCommand } from "./list.ts";
import { taskMoveCommand } from "./move.ts";
import { taskScheduleCommand } from "./schedule.ts";
import { taskUndoCommand } from "./undo.ts";

export const taskCommand = defineCommand({
  meta: {
    name: "task",
    description: "Inspect and reference Singularity tasks",
  },
  subCommands: {
    list: taskListCommand,
    get: taskGetCommand,
    add: taskAddCommand,
    move: taskMoveCommand,
    schedule: taskScheduleCommand,
    do: taskDoCommand,
    undo: taskUndoCommand,
    alias: taskAliasCommand,
  },
});
