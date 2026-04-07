---
name: singularity-cli
description: Operate the installed `singu` CLI for the Singularity task manager API. Use when Claude needs to authenticate with Singularity, inspect projects, capture or triage tasks, schedule or unschedule work, create focus blocks, or manage short IDs and aliases in an end-user environment where `singu` is available on PATH.
---

# Singularity CLI

Use `singu` as the default interface for Singularity task-manager operations.
Assume an end-user environment where the user has an installed `singu` binary and not a local repository checkout.
Do not rely on `bun run cli`, source files, or repository-only workflows.

## Workflow

1. Confirm the real command surface before acting.
Run `singu --help`, then inspect the relevant subcommand help such as `singu task --help` or `singu task schedule --help`. Trust installed help output over assumptions.

2. Confirm auth before mutating data.
Run `singu auth status` for local state and `singu auth status --check` before write flows. Use `singu auth login --token "<token>"` or interactive `singu auth login` to save a token. Remember that `SINGULARITY_TOKEN` overrides the saved token.

3. Resolve references correctly.
Use raw ids, numeric SIDs from the latest matching `list`, or `@alias` values. Refresh SIDs with `singu project list` or `singu task list` before reusing numeric references. Prefer aliases for repeated workflows.

4. Start read-only, then mutate.
Inspect with `project list`, `project get`, `task list`, and `task get` first. Use write commands only after confirming the exact target reference.

5. Prefer structured output when summarizing data.
Use `--json` on `project list`, `project get`, `task list`, and `task get` when the result needs to be parsed or quoted precisely.

## Command Surface

Use these top-level groups:

- `singu auth`
- `singu project`
- `singu task`
- `singu block`

Use the current project surface:

- `project list|ls`
- `project get`
- `project alias set|list|ls|remove|rm`

Use the current task surface:

- `task list|ls`
- `task get`
- `task add`
- `task edit`
- `task move`
- `task schedule`
- `task unschedule`
- `task rm|remove|delete`
- `task do`
- `task undo`
- `task alias set|list|ls|remove|rm`

Do not invent project write commands. The current CLI surface is read-only for projects.

## Common Flows

### Auth

```bash
singu auth status
singu auth status --check
singu auth login --token "<token>"
singu auth logout
```

### Projects

```bash
singu project list
singu project get 1
singu project get @inbox
singu project alias set inbox 1
singu project alias list
```

### Tasks

```bash
singu task list
singu task list --inbox
singu task list --project @work
singu task list --all --json
singu task get 1
singu task add "Call Peter" --project @work
singu task edit 1 --title "Call Peter about the release"
singu task move 1 --inbox
singu task move 1 --project @work
singu task do 1
singu task undo 1
singu task rm 1
```

### Scheduling

Use `--start` and `--deadline` values such as `now`, `today`, `tomorrow`, `YYYY-MM-DD`, or full ISO datetimes. Use block durations such as `30m`, `1h`, or `1h30m`.

```bash
singu task schedule 1 --start tomorrow
singu task schedule 1 --start 2026-04-03T09:00:00.000Z --deadline 2026-04-03T10:00:00.000Z
singu task unschedule 1
singu block 1h "Deep work on pet project"
singu block 30m "Inbox zero" --project @admin
```

## Reference Rules

Use raw ids when the user already has stable Singularity ids.
Use numeric SIDs only after the relevant latest `list` command in the same auth context.
Use `@alias` for stable local handles such as `@inbox` or `@today`.
Remember that aliases and SID caches are scoped to the active auth token fingerprint.

## Task List Behavior

Treat plain `singu task list` as an actionable view, not a raw dump.
Expect it to show open tasks scheduled for today and overdue open tasks.
Use `--inbox` for unscheduled tasks without a project.
Use `--all` for the unfiltered list.
Use `--project <project-ref>` to narrow the list to one project.
Use `--limit`, `--offset`, `--archived`, `--removed`, and `--all-recurrence` when the user asks for a specific slice of task data.

## Local State

Expect config to live under `$XDG_CONFIG_HOME/singu` or `~/.config/singu` and cache under `$XDG_CACHE_HOME/singu` or `~/.cache/singu`.
Expect `SINGU_HOME` to relocate both config and cache under a single root.
Expect local files such as `config.json`, `aliases.json`, `project-last-list.json`, and `task-last-list.json`.

## Guardrails

Use fresh `list` output or an alias before destructive actions such as `task rm`.
Re-check `singu <command> --help` if a command behaves differently than expected.
Do not surface saved tokens or raw bearer values back to the user.
If `singu` is not available on PATH, stop and tell the user the installed CLI is missing instead of switching to repository-specific commands.
