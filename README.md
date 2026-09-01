# singularity-cli

`singu` is a Bun-based CLI client for the Singularity task manager API.

Official product site: https://singularity-app.com/

This is an unofficial CLI client and is not affiliated with or endorsed by Singularity.
Use of the API remains subject to Singularity's own product terms, billing model, and access controls.

## Install

Global install with Bun:

```bash
bun add -g singularity-cli
```

Then run:

```bash
singu --help
```

## Agent Skill

This repository also ships an agent skill for operating an installed `singu` binary in an end-user environment.

Skill location in the repo:

- `skills/singularity-cli`

Install it with the Skills CLI:

```bash
npx skills add osovv/singularity-cli@singularity-cli -g -y
```

The installed skill helps an agent use `singu` for auth, project inspection, task capture and triage, scheduling, aliases, and focus blocks.
It is written for users who have `singu` on PATH and does not depend on a local repository checkout.

## Status

Current scope:

- auth is implemented
- project read flows are implemented
- task read flows are implemented
- task write flows for capture, move, and scheduling are implemented
- project write flows are not implemented yet
- block capture is implemented

Project commands are read-only for now:

- `singu project list`
- `singu project get <reference>`
- `singu project alias set <name> <reference>`
- `singu project alias list`
- `singu project alias remove <name>`

Task commands available today:

- `singu task list`
- `singu task list --inbox`
- `singu task list --project <project-ref>`
- `singu task list --all`
- `singu task get <reference>`
- `singu task add "title"`
- `singu task edit <reference> --title "new title"`
- `singu task move <reference> --project <project-ref>`
- `singu task move <reference> --inbox`
- `singu task schedule <reference> --start <when>`
- `singu task recur <reference> --every <day|week|month> [--interval <n>] [--at HH:MM] [--count <n>]`
- `singu task unrecur <reference>`
- `singu task unschedule <reference>`
- `singu task rm <reference>`
- `singu task do <reference>`
- `singu task undo <reference>`
- `singu task alias set <name> <reference>`
- `singu task alias list`
- `singu task alias remove <name>`
- `singu block <duration> "title"`

Not implemented yet:

- `project create`
- `project update`
- `project delete`
- `task delete`

## Recurring Tasks (CLI-side)

The public Singularity v2 API exposes recurrence on tasks as read-only data, so `singu` implements recurring tasks client-side. Rules live in a marker stored on the carrier task itself (`externalId`), which means chains follow the task on the server and work from every device:

- `singu task recur 1 --every day --at 07:00` attaches a rule marker to the task. Re-running `recur` on the same task edits the rule; tasks carrying a foreign `externalId` (from integrations) are refused.
- When a recurring task is marked done via `singu task do`, the CLI automatically creates the next occurrence with the same title, project, and priority, scheduled per the rule (always strictly in the future). `--count N` finishes the chain after N spawned occurrences.
- Completing a recurring task **outside** the CLI (Singularity app, another client) stalls the chain; `singu recur sync` catches it up from any device, cleans stale markers, and reports duplicate tails. Running `singu task do` on such a task catches it up too.
- `singu recur sync` also migrates the legacy pre-marker `recurrence.json` registry in place.
- `singu task get` shows the active rule; tasks with server-side recurrence (created in the app) show `server-managed`.
- `singu task unrecur 1` stops the chain.

## Stack

- Bun
- TypeScript
- citty
- Kubb
- GRACE workflow and docs

## Development

Install dependencies:

```bash
bun install
```

Refresh the local OpenAPI snapshot:

```bash
bun run spec:sync
```

Regenerate the SDK from the local snapshot:

```bash
bun run codegen
```

Run both in sequence:

```bash
bun run api:refresh
```

Type-check:

```bash
bun run check
```

Run tests:

```bash
bun run test
```

Run the CLI directly:

```bash
bun run cli --help
```

Build the standalone binary:

```bash
bun run build
```

This produces `./singu`.

## Auth

Auth uses a single bearer token.

Commands:

- `singu auth login`
- `singu auth status`
- `singu auth logout`

Rules:

- `SINGULARITY_TOKEN` overrides the saved token
- the saved token is stored locally in config storage
- `auth login` validates the token against the API by default

Examples:

```bash
singu auth login --token "<token>"
singu auth status
singu auth status --check
singu auth logout
```

## Project References

Project commands accept three kinds of references:

- raw Singularity id
- short id from the last `project list`, for example `1`
- alias, for example `@inbox`

Examples:

```bash
singu project list
singu project get 1
singu project get @inbox
singu project get id:raw-project-id
```

## Task References

Task commands accept the same three kinds of references:

- raw Singularity id
- short id from the last `task list`, for example `1`
- alias, for example `@today`

Examples:

```bash
singu task list
singu task list --inbox
singu task list --project @work
singu task list --all
singu task add "Call Peter"
singu task edit 1 --title "Call Peter about the release"
singu task move 1 --project @work
singu task move 1 --inbox
singu task schedule 1 --start tomorrow
singu task schedule 1 --start 2026-04-03T09:00:00.000Z --deadline 2026-04-03T10:00:00.000Z
singu task unschedule 1
singu task get 1
singu task get @today
singu task do 1
singu task undo 1
singu task rm 1
singu block 1h "Deep work on pet project"
singu task get id:raw-task-id
```

Default `task list` is an actionable view, not a raw dump.

By default it shows open tasks that are:

- scheduled for today
- scheduled earlier than today and still not completed

Default actionable output is sorted by `start asc`.

Useful task list modes:

- `singu task list` for the default actionable view
- `singu task list --inbox` for unscheduled tasks without a project
- `singu task list --project <project-ref>` to narrow the view to one project
- `singu task list --all` for the raw list without smart filtering

## Short IDs And Aliases

### Short IDs

`singu project list` prints numeric `SID` values and saves the latest list context locally.

That allows follow-up commands like:

```bash
singu project get 1
```

Short IDs are contextual:

- they come from the most recent `project list`
- they are scoped to the active auth token fingerprint
- they are not stable permanent ids

### Aliases

Aliases are stable local names that point to raw project ids.

Examples:

```bash
singu project alias set inbox 1
singu project alias list
singu project get @inbox
singu project alias remove inbox
```

Alias behavior:

- aliases are stored locally
- aliases are scoped to the active auth token fingerprint
- aliases do not depend on the last-list SID cache once saved

Task aliases work the same way:

```bash
singu task alias set today 1
singu task alias list
singu task get @today
singu task alias remove today
```

## Local Storage

By default:

- config lives in `$XDG_CONFIG_HOME/singu` or `~/.config/singu`
- cache lives in `$XDG_CACHE_HOME/singu` or `~/.cache/singu`

Used files:

- `config.json` for the saved token
- `aliases.json` for project aliases
- `project-last-list.json` for project SID cache
- `task-last-list.json` for task SID cache

If `SINGU_HOME` is set, everything is stored under that root instead:

- `config.json`
- `aliases.json`
- `cache/project-last-list.json`
- `cache/task-last-list.json`

## OpenAPI And SDK

The CLI does not generate from a live remote OpenAPI URL during codegen.

Workflow:

1. `bun run spec:sync` fetches the upstream Swagger UI bootstrap
2. it extracts the embedded `swaggerDoc`
3. it writes `openapi/swagger.json`
4. `bun run codegen` generates the SDK from that local file

Generated code lives in:

- `src/api/generated`

## Current CLI Surface

Top-level commands:

- `singu auth`
- `singu project`
- `singu task`
- `singu block`

Project subcommands today:

- `list`
- `get`
- `alias set`
- `alias list`
- `alias remove`

Task subcommands today:

- `list`
- `get`
- `add`
- `edit`
- `move`
- `schedule`
- `unschedule`
- `rm`
- `do`
- `undo`
- `alias set`
- `alias list`
- `alias remove`

The README should stay aligned with the actual implemented command surface.
