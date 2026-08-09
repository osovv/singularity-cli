// FILE: src/commands/task/index.ts
// VERSION: 1.4.0
// START_MODULE_CONTRACT
//   PURPOSE: Register the `task` command group for `singu`.
//   SCOPE: Parent task command metadata and subcommand composition.
//   DEPENDS: citty, src/commands/task/list.ts, src/commands/task/get.ts, src/commands/task/add.ts, src/commands/task/edit.ts, src/commands/task/move.ts, src/commands/task/schedule.ts, src/commands/task/unschedule.ts, src/commands/task/rm.ts, src/commands/task/do.ts, src/commands/task/undo.ts, src/commands/task/alias/index.ts
//   LINKS: M-TASK-COMMANDS-READ, M-TASK-WRITE-COMMANDS, M-TASK-ACTION-COMMANDS, M-TASK-ALIAS-COMMANDS, M-CLI-ENTRY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   taskCommand - Parent task command with list, get, add, edit, move, schedule, unschedule, rm, do, undo, and alias subcommands.
// END_MODULE_MAP
//
// START_CHANGE_SUMMARY
//   LAST_CHANGE: [v1.4.0 - Added task edit, unschedule, and rm commands.]
// END_CHANGE_SUMMARY

import { defineCommand } from "citty";

import { taskAddCommand } from "./add.ts";
import { taskAliasCommand } from "./alias/index.ts";
import { taskClearDeadlineCommand, taskDeadlineCommand } from "./deadline.ts";
import { taskDoCommand } from "./do.ts";
import { taskEditCommand } from "./edit.ts";
import { taskGetCommand } from "./get.ts";
import { taskListCommand } from "./list.ts";
import { taskMoveCommand } from "./move.ts";
import { taskNoteCommand } from "./note.ts";
import { taskRemoveCommand } from "./rm.ts";
import { taskScheduleCommand } from "./schedule.ts";
import { taskSomedayCommand, taskUnSomedayCommand } from "./someday.ts";
import { taskTagCommand } from "./tag.ts";
import { taskUndoCommand } from "./undo.ts";
import { taskUnscheduleCommand } from "./unschedule.ts";

export const taskCommand = defineCommand({
  meta: {
    name: "task",
    description: "Inspect and reference Singularity tasks",
  },
  subCommands: {
    list: taskListCommand,
    get: taskGetCommand,
    add: taskAddCommand,
    edit: taskEditCommand,
    move: taskMoveCommand,
    schedule: taskScheduleCommand,
    unschedule: taskUnscheduleCommand,
    deadline: taskDeadlineCommand,
    cleardeadline: taskClearDeadlineCommand,
    rm: taskRemoveCommand,
    do: taskDoCommand,
    undo: taskUndoCommand,
    tag: taskTagCommand,
    note: taskNoteCommand,
    someday: taskSomedayCommand,
    unsomeday: taskUnSomedayCommand,
    alias: taskAliasCommand,
  },
});
