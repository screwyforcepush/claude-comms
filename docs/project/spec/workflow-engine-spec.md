# Workflow Engine Specification

> Convex-backed orchestration for assignment jobs, chat jobs, reflection telemetry,
> and lightweight peer communication.

**Version:** 2.1
**Last Updated:** 2026-05-14
**Status:** Active
**Why-layer:** See [mental-model.md](mental-model.md) for the authoritative
intent, philosophy, user mental model, and design principles. This document is
the what-layer: live schema, relationships, scheduler behavior, and CLI surface.

---

## Source Of Truth

This spec was refreshed against:

- `workflow-engine/convex/schema.ts` for tables, fields, union values, and indexes.
- `npx tsx .agents/tools/workflow/cli.ts --help` for the workflow CLI surface.
- [harness-model-config-spec.md](harness-model-config-spec.md) for namespace
  harness/model semantics.
- [reflection-feedback-spec.md](reflection-feedback-spec.md) for reflection row
  intent and analysis semantics.
- [guardian-mode-spec.md](guardian-mode-spec.md) and
  [mental-model.md#session-context-isolation](mental-model.md#session-context-isolation)
  for guardian session routing.
- [password-wall.md](password-wall.md) for the single-user password-wall security
  model.
- [convex-bandwidth-optimization.md](convex-bandwidth-optimization.md) for the
  subscription-efficiency model behind denormalized counts and targeted indexes.

---

## Overview

The Workflow Engine coordinates work across namespaces. Each namespace owns
assignments, chained job groups, jobs, chat threads, chat messages, chat jobs,
reflection telemetry, and optional lightweight peer-comms groups.

The high-level data shape is:

```text
Namespace
  -> Assignments
       -> JobGroups, chained by nextGroupId
            -> Jobs, parallel within a group
       -> Reflections / ReflectionsV2, joined through jobs

Namespace
  -> ChatThreads
       -> ChatMessages
       -> ChatJobs

AgentComms
  -> groupId-scoped message stream for hand-cranked agent batches
```

Primary capabilities:

- Namespace isolation for multiple projects or client installs.
- Assignment execution through group-level chains.
- Parallel execution inside each job group.
- Harness/model resolution from namespace `harnessDefaults`, stamped onto jobs
  and chat jobs at insert time.
- Real-time chat in `jam`, `cook`, and `guardian` modes.
- Per-assignment guardian forks through `chatThreads.guardianSessions`.
- Runner metrics, kill requests, session IDs, rate-limit pause/retry state, and
  reflection coverage data.
- Password-protected UI/runner/CLI access per the password-wall model.

---

## Relationships

| Relationship | Cardinality | Notes |
|---|---:|---|
| `namespaces` -> `assignments` | 1:N | `assignments.namespaceId` is required. |
| `assignments` -> `jobGroups` | 1:N | `assignments.headGroupId` points to the first group; each group can point to `nextGroupId`. |
| `jobGroups` -> `jobs` | 1:N | Jobs in the same group run in parallel. |
| `jobs` -> `reflections` | 1:N | Reflection rows join by `jobId`; duplicates are accepted by schema. |
| `jobs` -> `reflectionsV2` | 1:N | V2 rows join by `jobId`; read-side tooling prefers V2 where available. |
| `namespaces` -> `chatThreads` | 1:N | Threads can be listed by namespace or globally sorted pinned-first then by `latestMessageAt`. |
| `chatThreads` -> `chatMessages` | 1:N | Message history is indexed by thread and creation time. |
| `chatThreads` -> `chatJobs` | 1:N | Chat jobs are async responses and are not tied to assignment groups. |
| `chatThreads` -> `assignments` | 0:1 focus, 0:N history | `assignmentId` is the current focus; `assignmentsCreated` preserves all assignments linked from the thread. |
| `agentComms.groupId` -> messages | 1:N | Capability-style group string, monotonic `position` within group. |

---

## Schema

All timestamps are numeric Unix epoch milliseconds unless a field description
states otherwise. `Id<"...">` means a Convex document ID for that table.

### `namespaces`

Isolated workspaces for organizing assignments, chat, and harness defaults.

| Field | Type | Required | Description |
|---|---|---:|---|
| `name` | `string` | Yes | Namespace identifier. |
| `description` | `string` | No | Human-readable namespace description. |
| `assignmentCounts` | object | No | Denormalized assignment status counts used by sidebar/queue summaries. |
| `assignmentCounts.pending` | `number` | Yes, when object exists | Count of pending assignments. |
| `assignmentCounts.active` | `number` | Yes, when object exists | Count of active assignments. |
| `assignmentCounts.blocked` | `number` | Yes, when object exists | Count of blocked assignments. |
| `assignmentCounts.complete` | `number` | Yes, when object exists | Count of complete assignments. |
| `harnessDefaults` | `string` | No | JSON-encoded `HarnessDefaults`; see [harness-model-config-spec.md](harness-model-config-spec.md). |
| `createdAt` | `number` | Yes | Creation timestamp. |
| `updatedAt` | `number` | Yes | Last namespace metadata update timestamp. |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_name` | `name` | Resolve namespace by configured name. |

`harnessDefaults` parses to:

```ts
type Harness = "claude" | "codex" | "gemini";

interface HarnessModelEntry {
  harness: Harness;
  model?: string;
}

interface HarnessDefaults {
  default: HarnessModelEntry;
  [jobType: string]: HarnessModelEntry | HarnessModelEntry[];
}
```

Resolution order is job type key, then `default`, then error. Array values fan
out to multiple jobs in one group. Model strings are exact CLI model arguments,
not aliases maintained by the workflow engine.

### `assignments`

High-level work units with a north star and a chain of job groups.

| Field | Type | Required | Description |
|---|---|---:|---|
| `namespaceId` | `Id<"namespaces">` | Yes | Parent namespace. |
| `northStar` | `string` | Yes | Assignment objective. North-star amendments append to this string. |
| `status` | union | Yes | Assignment lifecycle status. |
| `blockedReason` | `string` | No | Reason shown when blocked. |
| `alignmentStatus` | union | No | Guardian-mode alignment assessment. |
| `pmNudge` | `string` | No | Short-lived directive consumed by the next PM; see [mental-model.md#mid-flight-assignment-modification](mental-model.md#mid-flight-assignment-modification). |
| `independent` | `boolean` | Yes | Whether this assignment can run in parallel with other non-complete assignments. |
| `priority` | `number` | Yes | Lower number means higher priority among pending sequential assignments. |
| `artifacts` | `string` | Yes | Accumulated artifact notes. |
| `decisions` | `string` | Yes | Accumulated decision notes. |
| `headGroupId` | `Id<"jobGroups">` | No | First group in the assignment chain. |
| `createdAt` | `number` | Yes | Creation timestamp. |
| `updatedAt` | `number` | Yes | Last assignment update timestamp. |

Union values:

| Field | Values |
|---|---|
| `status` | `pending`, `active`, `blocked`, `complete` |
| `alignmentStatus` | `aligned`, `uncertain`, `misaligned` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_namespace` | `namespaceId` | List assignments in a namespace. |
| `by_namespace_status` | `namespaceId`, `status` | Runner and UI filters without reading blocked/complete work unnecessarily. |
| `by_status` | `status` | Global status lookup. |

Status transitions are implemented by mutations and CLI updates:

- `pending` -> `active` when the first job starts.
- `active` -> `blocked` when user or guardian intervention is needed.
- `blocked` -> `active` when work is resumed.
- Any non-complete status -> `complete` when the assignment is finished.

### `jobGroups`

Parallel execution containers. Groups form a singly linked chain per assignment.

| Field | Type | Required | Description |
|---|---|---:|---|
| `assignmentId` | `Id<"assignments">` | Yes | Parent assignment. |
| `nextGroupId` | `Id<"jobGroups">` | No | Next group in the assignment chain. |
| `status` | union | Yes | Derived group lifecycle status. |
| `aggregatedResult` | `string` | No | Markdown aggregation of member job results for PM context. |
| `createdAt` | `number` | Yes | Creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `status` | `pending`, `running`, `complete`, `failed` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_assignment` | `assignmentId` | Walk or inspect a chain for one assignment. |
| `by_status` | `status` | Global group status lookup. |

Group status rules:

- `pending`: all member jobs are pending.
- `running`: at least one member job is running.
- `complete`: all member jobs are terminal and at least one succeeded.
- `failed`: all member jobs are terminal and all failed.

### `jobs`

Individual assignment work items. Each job has its own type, harness, optional
model, prompt, metrics, kill signal, session ID, and retry state.

| Field | Type | Required | Description |
|---|---|---:|---|
| `groupId` | `Id<"jobGroups">` | Yes | Parent group. |
| `namespaceId` | `Id<"namespaces">` | No | Denormalized namespace marker for reflection coverage; historical jobs may omit it. |
| `jobType` | `string` | Yes | Work type, for example `review`, `pm`, `implement`, or `uat`. |
| `harness` | union | Yes | Harness binary selected for execution. |
| `context` | `string` | No | Job-specific context. |
| `prompt` | `string` | No | Full prompt sent to the agent. |
| `status` | union | Yes | Job lifecycle status. |
| `result` | `string` | No | Agent output or failure output. |
| `startedAt` | `number` | No | Start timestamp. |
| `completedAt` | `number` | No | Terminal completion timestamp. |
| `toolCallCount` | `number` | No | Runner-streamed tool-call metric. |
| `subagentCount` | `number` | No | Runner-streamed subagent metric. |
| `totalTokens` | `number` | No | Runner-streamed context-pressure metric. For Claude this is input plus cache creation/read tokens, excluding output tokens. |
| `lastEventAt` | `number` | No | Timestamp of most recent streamed event/activity. |
| `model` | `string` | No | Exact model argument passed to the harness CLI; see [harness-model-config-spec.md](harness-model-config-spec.md). |
| `sessionId` | `string` | No | Harness session/thread ID used for resume, debugging, and reflection. |
| `exitForced` | `boolean` | No | Whether the runner had to force process exit. |
| `retryCount` | `number` | No | Count of rate-limit retry cycles. |
| `retryAfter` | `number` | No | Absolute timestamp when the scheduled retry should re-pend the job. |
| `rateLimitType` | `string` | No | Rate-limit window type. Current producer values are `five_hour` and `seven_day`. |
| `killRequested` | `boolean` | No | UI/runner kill signal. Runner polls via `by_status_killRequested`. |
| `createdAt` | `number` | Yes | Creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `harness` | `claude`, `codex`, `gemini` |
| `status` | `pending`, `running`, `complete`, `failed`, `awaiting_retry` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_group` | `groupId` | List all jobs in a group. |
| `by_group_status` | `groupId`, `status` | Find jobs in a group by status. |
| `by_status` | `status` | Global job status lookup. |
| `by_namespace_completedAt` | `namespaceId`, `completedAt` | Namespace-scoped reflection coverage and recent terminal-job queries. |
| `by_status_killRequested` | `status`, `killRequested` | Runner hit list for running jobs requested to die. |

`awaiting_retry` is a non-terminal pause for Claude assignment jobs that hit a
provider rate limit. It prevents PM auto-spawn while a Convex scheduled
function waits until `retryAfter`, then resets the job to `pending`. See
[mental-model.md#rate-limit-resilience](mental-model.md#rate-limit-resilience).

### `reflections`

V1 ergonomics reflection rows joined to assignment jobs. These rows capture
outcome-blind friction signal with denormalized job metadata. See
[reflection-feedback-spec.md](reflection-feedback-spec.md).

| Field | Type | Required | Description |
|---|---|---:|---|
| `jobId` | `Id<"jobs">` | Yes | Reflected job. |
| `sessionId` | `string` | Yes | Harness session/thread ID used for traceability. |
| `namespaceId` | `Id<"namespaces">` | Yes | Denormalized namespace. |
| `harness` | union | Yes | Harness that ran the job. |
| `jobType` | `string` | Yes | Reflected job type. |
| `totalTokens` | `number` | No | Token count copied from the job. |
| `toolCallCount` | `number` | No | Tool-call count copied from the job. |
| `durationMs` | `number` | No | Duration derived from job timestamps. |
| `description` | `string` | Yes | Short description of what happened. |
| `critique` | `string` | Yes | Free-form friction critique. |
| `alternativeApproach` | `string` | Yes | How the agent would do it again. |
| `improvements` | `string` | Yes | Suggested system improvements. |
| `rubric` | `Record<string, boolean>` | Yes | Flexible boolean rubric. |
| `keywords` | `string[]` | Yes | Free-form keyword tags. |
| `reflectionCliVersion` | `string` | Yes | Version of the reflection CLI that wrote the row. |
| `clientGitSha` | `string` | No | Client repo git SHA at reflection time. |
| `engineGitSha` | `string` | No | Engine repo git SHA at reflection time. |
| `createdAt` | `number` | Yes | Reflection creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `harness` | `claude`, `codex`, `gemini` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_job` | `jobId` | Reflection lookup for one job. |
| `by_namespace_created` | `namespaceId`, `createdAt` | Namespace-scoped recent reflections. |
| `by_namespace_harness_created` | `namespaceId`, `harness`, `createdAt` | Harness-sliced namespace analysis. |
| `by_created` | `createdAt` | Global recency scans. |

### `reflectionsV2`

V2 reflection rows keep the same denormalized job metadata as V1 but store a
narrative plus structured itemized pain points and suggestions.

| Field | Type | Required | Description |
|---|---|---:|---|
| `jobId` | `Id<"jobs">` | Yes | Reflected job. |
| `sessionId` | `string` | Yes | Harness session/thread ID used for traceability. |
| `namespaceId` | `Id<"namespaces">` | Yes | Denormalized namespace. |
| `harness` | union | Yes | Harness that ran the job. |
| `jobType` | `string` | Yes | Reflected job type. |
| `totalTokens` | `number` | No | Token count copied from the job. |
| `toolCallCount` | `number` | No | Tool-call count copied from the job. |
| `durationMs` | `number` | No | Duration derived from job timestamps. |
| `narrative` | `string` | Yes | Free-form reflection narrative. |
| `items` | object array | Yes | Structured V2 reflection items. |
| `items[].keywords` | `string[]` | Yes | Keywords for one item. |
| `items[].painPoint` | `string` | Yes | Specific friction point. |
| `items[].suggestion` | `string` | Yes | Suggested improvement for the pain point. |
| `keywords` | `string[]` | Yes | Row-level keyword tags. |
| `rubric` | `Record<string, boolean>` | Yes | Flexible boolean rubric. |
| `reflectionCliVersion` | `string` | Yes | Version of the reflection CLI that wrote the row. |
| `clientGitSha` | `string` | No | Client repo git SHA at reflection time. |
| `engineGitSha` | `string` | No | Engine repo git SHA at reflection time. |
| `createdAt` | `number` | Yes | Reflection creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `harness` | `claude`, `codex`, `gemini` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_job` | `jobId` | Reflection lookup for one job. |
| `by_namespace_created` | `namespaceId`, `createdAt` | Namespace-scoped recent reflections. |
| `by_namespace_harness_created` | `namespaceId`, `harness`, `createdAt` | Harness-sliced namespace analysis. |
| `by_created` | `createdAt` | Global recency scans. |

### `chatThreads`

User/agent conversation containers. Threads are namespace-scoped, but the UI can
also list all namespaces together sorted pinned-first then by `latestMessageAt`.
Pinned threads float above unpinned threads; within each tier, ordering is by
latest activity descending. The pinned-first sort is applied before the row-cap
slice so a quiet pinned thread never falls out of the sidebar window.

| Field | Type | Required | Description |
|---|---|---:|---|
| `namespaceId` | `Id<"namespaces">` | Yes | Parent namespace. |
| `title` | `string` | Yes | Thread title. |
| `mode` | union | Yes | Prompt/execution mode. |
| `lastPromptMode` | union | No | Last non-guardian prompt mode sent to Claude for differential prompting. |
| `assignmentId` | `Id<"assignments">` | No | Current focused assignment for guardian/assignment pane routing. |
| `claudeSessionId` | `string` | No | Original Claude session for jam/cook conversation. |
| `guardianSessions` | `Record<string, string>` | No | Per-assignment guardian fork session IDs; key is assignment ID string, value is Claude session ID. |
| `lastReadAt` | `number` | No | Unread tracking timestamp. |
| `assignmentsCreated` | `Id<"assignments">[]` | No | All assignments ever created/linked from this thread. |
| `latestMessageAt` | `number` | No | Denormalized timestamp of the latest message, used for cross-namespace sorting. |
| `pinned` | `boolean` | No | When true, thread floats above unpinned threads in the sidebar. Global (cross-namespace, unaffected by namespace filter). |
| `createdAt` | `number` | Yes | Creation timestamp. |
| `updatedAt` | `number` | Yes | Last thread metadata update timestamp. |

Union values:

| Field | Values |
|---|---|
| `mode` | `jam`, `cook`, `guardian` |
| `lastPromptMode` | `jam`, `cook` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_namespace` | `namespaceId` | List threads in one namespace. |
| `by_namespace_updated` | `namespaceId`, `updatedAt` | Namespace-scoped thread recency. |
| `by_assignment` | `assignmentId` | Find a thread linked to an assignment, especially guardian mode. |
| `by_latest_message` | `latestMessageAt` | Cross-namespace operations-center sorting. |

Guardian mode uses forked session context: jam/cook stays on `claudeSessionId`,
while guardian traffic for a focused assignment routes through
`guardianSessions[assignmentId]`. See [guardian-mode-spec.md](guardian-mode-spec.md)
and [mental-model.md#session-context-isolation](mental-model.md#session-context-isolation).

### `chatMessages`

Messages in a chat thread.

| Field | Type | Required | Description |
|---|---|---:|---|
| `threadId` | `Id<"chatThreads">` | Yes | Parent thread. |
| `role` | union | Yes | Message speaker/source. |
| `content` | `string` | Yes | Message body. |
| `hint` | `string` | No | Metadata for differential prompting. |
| `createdAt` | `number` | Yes | Message creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `role` | `user`, `assistant`, `pm` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_thread` | `threadId` | List messages in a thread. |
| `by_thread_created` | `threadId`, `createdAt` | Ordered thread history. |

### `agentComms`

Lightweight peer communication for hand-cranked agent batches. This backs
`.agents/tools/workflow/agent-comms.mjs`.

| Field | Type | Required | Description |
|---|---|---:|---|
| `groupId` | `string` | Yes | Capability-style group string shared among agents. |
| `position` | `number` | Yes | Monotonic position within the group. |
| `instance` | `string` | No | Sender instance/name. Readers can filter out their own messages. |
| `message` | `string` | Yes | Message text. |
| `createdAt` | `number` | Yes | Message creation timestamp. |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_group_position` | `groupId`, `position` | Poll unread messages after a known position. |

### `chatJobs`

Async chat responses. Chat jobs are processed by the runner but are separate
from assignment job groups.

| Field | Type | Required | Description |
|---|---|---:|---|
| `threadId` | `Id<"chatThreads">` | Yes | Parent thread. |
| `namespaceId` | `Id<"namespaces">` | Yes | Parent namespace. |
| `harness` | union | Yes | Harness binary selected for execution. |
| `model` | `string` | No | Exact model argument passed to the harness CLI. |
| `context` | `string` | Yes | JSON containing thread info, mode, session routing, and trigger message context. |
| `prompt` | `string` | No | Full prompt sent to the agent. |
| `status` | union | Yes | Chat job lifecycle status. |
| `result` | `string` | No | Assistant output or failure output. |
| `startedAt` | `number` | No | Start timestamp. |
| `completedAt` | `number` | No | Terminal completion timestamp. |
| `toolCallCount` | `number` | No | Runner-streamed tool-call metric. |
| `subagentCount` | `number` | No | Runner-streamed subagent metric. |
| `totalTokens` | `number` | No | Runner-streamed context-pressure metric. For Claude this is input plus cache creation/read tokens, excluding output tokens. |
| `lastEventAt` | `number` | No | Timestamp of most recent streamed event/activity. |
| `exitForced` | `boolean` | No | Whether the runner had to force process exit. |
| `killRequested` | `boolean` | No | UI/runner kill signal. Runner polls via `by_status_killRequested`. |
| `createdAt` | `number` | Yes | Creation timestamp. |

Union values:

| Field | Values |
|---|---|
| `harness` | `claude`, `codex`, `gemini` |
| `status` | `pending`, `running`, `complete`, `failed` |

Indexes:

| Index | Fields | Purpose |
|---|---|---|
| `by_namespace` | `namespaceId` | List chat jobs in one namespace. |
| `by_status` | `status` | Global chat job status lookup. |
| `by_namespace_status` | `namespaceId`, `status` | Runner dispatch of pending chat jobs. |
| `by_thread` | `threadId` | List chat jobs for one thread. |
| `by_thread_status` | `threadId`, `status` | Efficient active-job/typing indicator lookup. |
| `by_status_killRequested` | `status`, `killRequested` | Runner hit list for running chat jobs requested to die. |

Chat jobs do not use `awaiting_retry`; if a chat response fails, the user can
send a follow-up message.

---

## Scheduler Behavior

The runner asks Convex for ready assignment jobs and ready chat jobs. The
assignment/chat scheduler path accepts password arguments according to the
[password-wall.md](password-wall.md) model; authentication is function-level,
not stored on documents.

### Assignment Job Dispatch

`scheduler.getReadyJobs`:

1. Reads only `active` and `pending` assignments for the namespace via
   `assignments.by_namespace_status`.
2. Runs all ready independent assignments in parallel.
3. Allows only one non-independent assignment to make progress at a time.
4. For sequential assignments, prefers an active assignment; otherwise chooses
   the pending assignment with lowest `priority`, then oldest `createdAt`.
5. For each selected assignment, short-circuits if any group is `running`.
6. Walks the group chain from `headGroupId` only when no group is running.
7. Returns all `pending` jobs from the next ready group so they can run in
   parallel.
8. Accumulates prior non-PM group results for PM context and resets accumulated
   context after PM groups.

Ready-job payloads include:

| Field | Meaning |
|---|---|
| `job` | The pending job document to run. |
| `group` | Parent group document. |
| `assignment` | Parent assignment document. |
| `accumulatedResults` | Results since the previous PM group. |
| `previousNonPmGroupResults` | Results from the most recent non-PM group. |
| `r1GroupResults` | Group before the latest review group, for post-review PM decision context. |

This shape follows the subscription-efficiency principles in
[convex-bandwidth-optimization.md](convex-bandwidth-optimization.md): avoid
reactive reads of high-churn job documents unless the caller actually needs the
jobs.

### Chat Job Dispatch

`scheduler.getReadyChatJobs` reads pending chat jobs for one namespace through
`chatJobs.by_namespace_status`, sorts oldest first, and returns `{ chatJob }`
items to the runner.

### Kill Dispatch

`scheduler.getHitList` reads running assignment jobs and chat jobs where
`killRequested` is true via the two `by_status_killRequested` indexes. The UI
sets the flag; the runner owns process termination.

---

## Harness And Model Resolution

Harness/model selection is namespace-scoped and Convex-backed. The workflow
engine does not maintain a local alias map for model names. The model string is
passed verbatim to the harness CLI.

Assignment jobs:

1. CLI reads `namespaces.getHarnessDefaults`.
2. CLI resolves each requested job type to one entry or an array of entries.
3. Fan-out arrays become multiple jobs in the same group.
4. The CLI calls Convex with resolved `jobType`, `harness`, optional `model`,
   and optional `context`.
5. `jobs.createGroup` or `jobs.insertGroupAfter` stamps `namespaceId` from the
   assignment and inserts jobs as complete execution specs.

Chat jobs:

1. `chatJobs.trigger` accepts optional explicit `harness` and `model`.
2. Without explicit harness, it resolves the namespace `chat` config, then
   `default`.
3. Chat does not fan out; if config resolves to an array, the first entry is
   used.

Default namespace config from the live parser is:

```json
{
  "default": { "harness": "claude" },
  "implement": { "harness": "claude" },
  "review": [
    { "harness": "claude" },
    { "harness": "codex" },
    { "harness": "gemini", "model": "auto-gemini-3" }
  ],
  "pm": { "harness": "claude" },
  "chat": { "harness": "claude" }
}
```

This replaces the older hardcoded `AUTO_EXPAND_CONFIG` story. Fan-out is now
data-driven through `namespaces.harnessDefaults`.

## Harness Execution Modes

The runner executes Codex and Gemini through their normal non-interactive CLI
paths. Claude has a local runner feature flag:

- `claudeExecutionMode: "headless"` (default) uses the existing
  `claude -p --output-format stream-json` path.
- `claudeExecutionMode: "interactive"` runs
  `.agents/tools/workflow/claude-interactive-driver.py`, which starts Claude in
  a PTY, injects the prompt into the TUI, and tails hook JSONL written through
  `.agents/tools/workflow/claude-hook-settings.json`.

Interactive hook settings are passed explicitly with `--settings`; they are not
installed under project `.claude/`. With the feature flag off, the runner does
not load the wrapper settings and the headless path remains unchanged.

---

## CLI Interface

The live help output on 2026-05-14 is:

```text
Workflow Engine CLI

Commands:
  help                                Show this usage information
  assignments [--status <status>]     List assignments
  assignment [id] [--nudge]            Get assignment details (--nudge: only pmNudge field, supports WORKFLOW_ASSIGNMENT_ID)
  groups [--status <status>]          List job groups
  group <id>                          Get group details with jobs
  jobs [--status <status>] [--group <groupId>] [--assignment <assignmentId>]
                                      List jobs (filterable by status, group, or assignment)
  job <id>                            Get job details
  queue                               Show queue status

  create <northStar> [--priority N] [--independent] [--thread <threadId>]
                                      Create assignment
  insert-job [assignmentId] [--type <type>] [--jobs <json>] [--jobs-file <path>] [--harness <harness>] [--context <ctx>] [--after <groupId>]
              assignmentId defaults to WORKFLOW_ASSIGNMENT_ID
              --jobs: JSON array [{"jobType":"review"},{"jobType":"implement","harness":"codex"}]
              --jobs-file: path to JSON file with the same array shape (escapes heredoc/quoting)
              --type: single job type (shorthand for --jobs with one entry)
              --after defaults to WORKFLOW_GROUP_ID, then auto-finds tail group
  update-assignment [id] [--status <pending|active|blocked|complete>] [--reason <str>]
                         [--artifacts <str>] [--decisions <str>] [--alignment <aligned|uncertain|misaligned>]
                         [--nudge <str>] [--clear-nudge] [--append-northstar <str>]
              --reason required when setting status to blocked
              --nudge: set pmNudge for next PM   --clear-nudge: clear pmNudge
              --append-northstar: append amendment text to northStar
  delete-assignment <id>              Delete assignment and all its groups/jobs

  start-job <jobId>                   Mark job as running
  complete-job <jobId> --result <str> Mark job as complete
  fail-job <jobId> [--result <str>]   Mark job as failed

Chat Commands:
  chat-threads                        List chat threads
  chat-thread <threadId>              Get thread with messages
  chat-create [--title <title>]       Create a new chat thread
  chat-send <threadId> <message>      Send message and create chat job
  chat-mode <threadId> <jam|cook|guardian> [--assignment <id>]  Change thread mode
  chat-title <threadId> <title>       Update thread title

Environment Variables (auto-injected):
  WORKFLOW_ASSIGNMENT_ID   Default assignment for commands
  WORKFLOW_GROUP_ID        Default --after for insert-job
  WORKFLOW_JOB_ID          Current job
  WORKFLOW_THREAD_ID       Auto-link thread for create
  WORKFLOW_ARTIFACTS       Append base for update-assignment --artifacts
  WORKFLOW_DECISIONS       Append base for update-assignment --decisions
```

Important CLI notes:

- `assignment [id] --nudge` prints only `{ "pmNudge": ... }`; when `--nudge`
  is present, the ID may come from `WORKFLOW_ASSIGNMENT_ID`.
- `update-assignment --nudge <str>` sets `assignments.pmNudge`.
- `update-assignment --clear-nudge` clears `assignments.pmNudge`.
- `update-assignment --append-northstar <str>` appends permanent amendment text
  to `assignments.northStar`.
- `update-assignment --status blocked --reason <str>` replaces the old
  assignment-level block shortcut.
- Assignment-level `complete`, `block`, and `unblock` are not CLI commands in
  the live help surface. Use `update-assignment --status complete`,
  `update-assignment --status blocked --reason ...`, or
  `update-assignment --status active`.
- Job-level `complete-job` remains a live command; the removed `complete`
  shortcut refers only to assignment status.
- `insert-job --jobs-file <path>` accepts the same JSON array shape as
  `--jobs` and exists to avoid shell quoting/heredoc problems.
- `WORKFLOW_ARTIFACTS` and `WORKFLOW_DECISIONS` are append bases for
  `update-assignment --artifacts` and `update-assignment --decisions`.

---

## Thread Modes

| Mode | Description | Assignment behavior |
|---|---|---|
| `jam` | Ideation and requirement shaping. | Does not create autonomous assignment work by itself. |
| `cook` | Full autonomous execution. | PO can create assignments and insert jobs. |
| `guardian` | Cook plus alignment monitoring. | Requires focused assignment; PM reports are surfaced and evaluated. |

Guardian flow:

1. User develops context with the PO in a thread.
2. Thread links to an assignment and switches to `guardian`.
3. Assignment executes job groups normally.
4. PM results are inserted as `chatMessages` with role `pm`.
5. A guardian chat job evaluates alignment.
6. The PO can set `alignmentStatus`, write `pmNudge`, or block the assignment
   by status update if the work is misaligned.

The session fork model is stored in `chatThreads.guardianSessions` and described
in [mental-model.md#session-context-isolation](mental-model.md#session-context-isolation).

---

## Result Aggregation

When a group completes, member job results are aggregated into markdown on
`jobGroups.aggregatedResult`.

```text
## review A
{result from first review job}

---

## review B
{result from second review job}

---

## uat
{result from uat job}
```

Rules:

- Multiple jobs of the same type get `A`, `B`, `C` suffixes.
- Single jobs of a type get no suffix.
- Harness/model names are not included in headers; fan-out review result
  anonymity prevents evaluator bias.
- Failed jobs can carry `result`, but group success is based on at least one
  complete job.
- PM groups reset downstream accumulated context.

---

## Operational Considerations

| Topic | Current behavior |
|---|---|
| Security | UI, runner, and workflow CLI paths use password-protected Convex functions per [password-wall.md](password-wall.md). Password is function-level, not a document field. |
| Rate limits | Assignment jobs can enter `awaiting_retry`; chat jobs fail normally and require a user follow-up. |
| Kill requests | `killRequested` is stored on `jobs` and `chatJobs`; runner polls `scheduler.getHitList`. |
| Metrics | Runner streams `toolCallCount`, `subagentCount`, context-pressure `totalTokens`, and `lastEventAt` to assignment jobs and chat jobs. |
| Reflection coverage | `jobs.namespaceId` marks integration-era jobs included in reflection coverage; historical jobs without it are excluded. |
| Subscription efficiency | Counts and recency fields are denormalized to avoid broad reactive reads; see [convex-bandwidth-optimization.md](convex-bandwidth-optimization.md). |
| Filesystem truth | Execution records describe how work got here; the code on disk remains the source of truth for actual project state, per [mental-model.md#execution-records-vs-filesystem-state](mental-model.md#execution-records-vs-filesystem-state). |

---

## File Locations

| Component | Path |
|---|---|
| Convex schema | `workflow-engine/convex/schema.ts` |
| Namespace functions | `workflow-engine/convex/namespaces.ts` |
| Assignment functions | `workflow-engine/convex/assignments.ts` |
| Job and group functions | `workflow-engine/convex/jobs.ts` |
| Scheduler queries | `workflow-engine/convex/scheduler.ts` |
| Chat thread functions | `workflow-engine/convex/chatThreads.ts` |
| Chat message functions | `workflow-engine/convex/chatMessages.ts` |
| Chat job functions | `workflow-engine/convex/chatJobs.ts` |
| Reflection V1 functions | `workflow-engine/convex/reflections.ts` |
| Reflection V2 functions | `workflow-engine/convex/reflectionsV2.ts` |
| Agent comms functions | `workflow-engine/convex/agentComms.ts` |
| Workflow CLI | `.agents/tools/workflow/cli.ts` |
| Runner | `.agents/tools/workflow/runner.ts` |
| Workflow config | `.agents/tools/workflow/config.json` |
| Claude interactive driver | `.agents/tools/workflow/claude-interactive-driver.py` |
| Claude interactive hook settings | `.agents/tools/workflow/claude-hook-settings.json` |
