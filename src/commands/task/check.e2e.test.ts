import { afterAll, describe, expect, it } from "vitest";

// FILE: src/commands/task/check.e2e.test.ts
// VERSION: 1.0.0
// START_MODULE_CONTRACT
//   PURPOSE: End-to-end verify that `task do` and `task undo` drive the real Singularity API completion fields correctly.
//   SCOPE: CLI-driven task creation, completion, reopening, inspection, and cleanup against the live API.
//   DEPENDS: vitest, bun runtime, src/cli.ts
//   LINKS: V-M-TASK-ACTION-COMMANDS, M-TASK-ACTION-COMMANDS
// END_MODULE_CONTRACT

const repoRoot = "/home/al/dev/singularity-cli";
const shouldRunE2E = process.env.SINGULARITY_RUN_E2E === "1";
const createdTaskIds: string[] = [];

type CliRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

async function runCli(args: string[]): Promise<CliRunResult> {
  const proc = Bun.spawn(["bun", "./src/cli.ts", ...args], {
    cwd: repoRoot,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    exitCode,
    stdout,
    stderr,
  };
}

function extractTaskId(output: string): string {
  const match = output.match(/\((T-[^)]+)\)/);

  if (!match?.[1]) {
    throw new Error(`Failed to extract task id from output:\n${output}`);
  }

  return match[1];
}

async function cleanupTask(taskId: string): Promise<void> {
  const result = await runCli(["task", "rm", taskId]);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clean up task ${taskId}:\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
}

afterAll(async () => {
  if (!shouldRunE2E) {
    return;
  }

  while (createdTaskIds.length > 0) {
    const taskId = createdTaskIds.pop();

    if (!taskId) {
      continue;
    }

    await cleanupTask(taskId);
  }
});

describe.skipIf(!shouldRunE2E)("task do and undo live e2e", () => {
  it("sets complete=100 on do and complete=0 on undo against the live API", async () => {
    const taskTitle = `[e2e ${Date.now()}] task do complete flow`;
    const addResult = await runCli(["task", "add", taskTitle]);

    expect(addResult.exitCode).toBe(0);
    expect(addResult.stderr).toBe("");

    const taskId = extractTaskId(addResult.stdout);
    createdTaskIds.push(taskId);

    const doResult = await runCli(["task", "do", taskId]);

    expect(doResult.exitCode).toBe(0);
    expect(doResult.stdout).toContain("Marked task done");

    const doneGetResult = await runCli(["task", "get", taskId, "--json"]);

    expect(doneGetResult.exitCode).toBe(0);

    const donePayload = JSON.parse(doneGetResult.stdout) as {
      task: {
        checked: number;
        complete: number | null;
      };
    };

    expect(donePayload.task.checked).toBe(1);
    expect(donePayload.task.complete).toBe(100);

    const undoResult = await runCli(["task", "undo", taskId]);

    expect(undoResult.exitCode).toBe(0);
    expect(undoResult.stdout).toContain("Reopened task");

    const undoneGetResult = await runCli(["task", "get", taskId, "--json"]);

    expect(undoneGetResult.exitCode).toBe(0);

    const undonePayload = JSON.parse(undoneGetResult.stdout) as {
      task: {
        checked: number;
        complete: number | null;
      };
    };

    expect(undonePayload.task.checked).toBe(0);
    expect(undonePayload.task.complete).toBe(0);

    await cleanupTask(taskId);
    createdTaskIds.splice(createdTaskIds.indexOf(taskId), 1);
  }, 120000);
});
