# Agent Reflection Feedback Loop -- Implementation Plan

> **Revision history**
> - **v0.3** -- structural and follow-up amendments:
>   - Restructured for offline implementer pickup: Overview at top captures intent/purpose/success/constraints/references.
>   - Manual Implementation Steps re-sequenced to five phases with sessionId capture as a standalone Phase 1.
>   - `document` job type included in reflection scope (was previously excluded without strong reasoning).
>   - Rubric reshaped from a typed object to a flexible kvp (`v.record(v.string(), v.boolean())`) so the question set can evolve without schema migrations. Question set ships as a v1 draft (20 questions; `assignmentScopeClear` / `successCriteriaExplicit` / `futureAgentCouldBeFaster` removed for being too "what"-oriented; `toolOutputAwkward` split into `toolOutputNoise` and `toolOutputInsufficient`).
>   - `bySessionId` query dropped -- sessionId is metadata, not a useful query axis.
>   - `coverageRate` and `recent` reshaped: namespace always required (CLI-injected), optional `jobType` / `harness` filters, window selector (`since` | `since`+`until` | `last`; defaults to `last: 100`).
>   - `awaiting_retry` exclusion explicitly justified: a rate-limited job's reflection invocation would also be rate-limited; the reflection happens (or doesn't) on terminal completion of the eventual retry.
>   - Reflection wall-clock timeout moved to `config.json` (`reflectionTimeoutMs`, default 5 min).
>   - `jobs.by_completedAt` index changed to `by_namespace_completedAt` compound (queries always filter by namespace).
>   - `--fork-session` flag spelling verified against `streams.ts:312`.
> - **v0.4** -- implementation clarification:
>   - `jobs.namespaceId` is added as an optional denormalized field, with no historical backfill. Its presence marks jobs created after reflection integration and defines the coverage-rate denominator. Historical jobs without `namespaceId` are excluded from reflection coverage.
>   - Removed the stale Phase 2 mention of `bySessionId`; `sessionId` remains row metadata only.
> - **v0.2** -- amended after fan-out review at `docs/project/spec/reflection-feedback-critique.md`. Major architectural pivot: dropped MCP-stdio tool in favour of a CLI script (consistent with the existing assignment toolkit). All eight High-severity issues resolved or pinned. Mediums and Lows applied where applicable.
> - **v0.1** -- initial draft.

---

## Overview

This document is the implementation plan for the **Agent Reflection Feedback Loop**. It is intended to be self-contained: an offline implementer should be able to pick this up cold and execute through to deployment without further conversation.

### Why this exists (operator's intent)

Every job in the workflow engine is also a usability test of its own tooling and operating environment. Today that signal is invisible: agents hit friction (broken tools, undocumented setup, missing affordances), find workarounds, exit, and take the experience with them. The next agent in the same situation rediscovers the workaround from scratch.

The operator wants:
- **Visibility into recurring friction.** If an agent type keeps hitting 500s on a tool, that should surface at fleet scale, not stay buried in individual run logs.
- **Per-namespace telemetry within a project.** Many client projects pull from this codebase. Reflection telemetry must be namespace-scoped per consumer but driven by the same engine.
- **Slice-and-dice analysis.** By harness, jobtype, namespace, time window, version. Eventually a dashboard; near-term a Steward analysis toolkit (the Outcome Steward agent in each namespace).
- **A self-improving system.** Reflections feed back into spec changes, tooling fixes, and prompt edits over time.

### Two products distinguished (only the first is in scope here)

- **Ergonomics reflection (this spec, v1)** -- outcome-blind. About *how* the agent operated: tool friction, environment issues, repetition, mistakes. Fires after every reflectable job (success or failure). Cheap, fire-and-forget.
- **Workflow effectiveness reflection (deferred)** -- outcome-aware. About *what* the agent produced and whether it landed. Different lens, different timing. Not in this spec.

### What success looks like

When implementation is complete, after a Claude job ends (success or failure):
1. The runner fire-and-forgets a reflection wrapper (`reflect-spawn.ts`).
2. The wrapper resurrects the agent into a forked session (`claude --resume <sessionId> --fork-session`) and delivers a reflection prompt.
3. The agent runs `npx tsx .agents/tools/workflow/reflect.ts --help`, constructs a structured JSON payload, and submits via the CLI.
4. A row lands in the `reflections` table with denormalised job-weight metadata, a flexible boolean rubric (v1 draft: ~20 questions; freely extensible), free-form fields, and three version axes.
5. `api.reflections.coverageRate` returns a healthy ratio for Claude jobs. Non-Claude harnesses appear at 0% in the `byHarness` breakdown -- expected, intentionally visible.
6. The Outcome Steward (and eventually a dashboard) can answer questions like *"what's broken across this namespace's last 30 days of jobs?"*

If implementation stops at any phase boundary, the system is in a valid state. Phase 1 alone (sessionId capture) is independently valuable as a debugging affordance.

### Key design constraints (hard rules; do not deviate without operator review)

- **Self-surgery.** The runner that executes work IS the system being modified. Implementation is offline -- manually-invoked agent, not via the assignment pipeline -- with explicit, bounded runner restarts (two total in the sequenced plan).
- **Fire-and-forget.** No retry, no error recovery in the reflection path. Coverage rate is the alarm; missed reflections degrade silently.
- **No parsing of agent output.** The reflection CLI takes structured JSON as input. Free-text agent output is never parsed.
- **CLI-script pattern, not MCP.** Mirrors the existing assignment toolkit (`cli.ts` + `--help` discovery). MCP-stdio was considered and rejected for complexity.
- **`--fork-session` always.** The reflection turn lives in a throwaway forked session so the original `sessionId` thread stays clean.
- **Flexible rubric.** Stored as a kvp (`v.record(v.string(), v.boolean())`) so the question set can evolve without schema migrations. Field omission is itself signal.
- **Claude-only at v1.** Codex/Gemini reflect-equivalents deferred. Non-Claude jobs skip silently.
- **Failed jobs reflect.** Failure is exactly when friction signal is highest; the contract changes in `HarnessExecutor` and `api.jobs.fail` exist to support this.

### Reference documents (read these before starting)

- `docs/project/spec/mental-model.md` § "Agent Reflection Feedback Loop" -- the why-layer; this spec is the how. Read first.
- `docs/project/spec/harness-model-config-spec.md` -- precedent for a self-surgery implementation plan in this project; structurally similar.
- `docs/project/spec/reflection-feedback-critique.md` -- fan-out review of v0.1 of this spec. Each High/Med/Low has a disposition row in the **Amendments** table at the end of this document.
- Project root `CLAUDE.md` -- Convex deploy procedure (root symlink requirement, password env var, deploy command). The deploy command is mandatory; misuse risks data loss.
- `.agents/AGENTS.md` -- agent operating procedures; calibrate from `AOP.CALIBRATE` before starting Phase 1.

---

## Implementation Context

This spec touches the workflow engine's own infrastructure: schema, runner, and two new scripts. Since the runner is the live process that would be modified, implementing this feature via the standard assignment/PM job chain risks **self-surgery** -- the runner restarting mid-execution. This work must be done **offline by a manually invoked agent**, not through the normal assignment pipeline.

**Key files in scope:**
- `workflow-engine/convex/schema.ts` -- new `reflections` table; optional `jobs.namespaceId`; `jobs.sessionId`; `jobs.by_namespace_completedAt` compound index
- `workflow-engine/convex/jobs.ts` -- both `complete` AND `fail` mutations gain optional `sessionId`; retry-flow paths (`executeRetry`, `retryGroup`, related) clear `sessionId` on reset
- `workflow-engine/convex/reflections.ts` -- **new** -- mutations + queries for the reflections table
- `.agents/tools/workflow/lib/harness-executor.ts` -- `onFail` / `onTimeout` callback signatures extended to carry `sessionId`
- `.agents/tools/workflow/runner.ts` -- onComplete/onFail/onTimeout pass `sessionId`; spawn wrapper post-completion
- `.agents/tools/workflow/reflect.ts` -- **new** -- agent-facing CLI (the tool the agent invokes)
- `.agents/tools/workflow/reflect-spawn.ts` -- **new** -- runner-side wrapper that resurrects the agent via `claude --resume --fork-session`
- `.agents/tools/workflow/templates/reflect.md` -- **new** -- reflection prompt template

**Out of scope (deferred):**
- Workflow effectiveness reflection (outcome-aware variant) -- separate product
- Codex / Gemini session resume -- v1 is Claude-only; non-Claude jobs skip reflection silently
- Steward analysis toolkit -- separate phase, consumes the same Convex query functions as the dashboard
- Dashboard UI for reflection slicing -- separate phase
- Reflection-on-reflections meta-aggregator -- separate phase

---

## Scope of Changes

**What changes:**
1. New Convex table `reflections` joined to `jobs` by `jobId`, with denormalized job-weight metadata (namespace, harness, tokens, duration, tool calls) frozen at reflection time.
2. `jobs` table gains optional `namespaceId` and `sessionId` fields. `namespaceId` is written only for new jobs after this integration and intentionally marks jobs included in reflection coverage.
3. Both `api.jobs.complete` AND `api.jobs.fail` accept optional `sessionId`.
4. `HarnessExecutor.ExecutionCallbacks.onFail` and `onTimeout` are extended to pass `sessionId` (sourced from the active stream handler's `getSessionId()`); the dead-orphan finalize path threads `result.sessionId` through to `api.jobs.fail`.
5. Runner's three job-completion paths (live `onComplete`, live `onFail`/`onTimeout`, reconcile/dead-orphan) pass `sessionId` through to mutations.
6. Retry-flow paths clear `sessionId` on reset so retried jobs reflect on their own session, not the prior attempt's.
7. Runner fire-and-forgets `reflect-spawn.ts <jobId>` after a successful or failed job-completion mutation.
8. New `reflect-spawn.ts` (runner-facing wrapper): reads the job from Convex, renders the reflection prompt, spawns `claude --resume <sessionId> --fork-session` with a 5-min wall-clock timeout, exits.
9. New `reflect.ts` (agent-facing CLI): the agent calls this from inside the resurrected session with structured input. Validates, denormalizes job metadata, captures versions/SHAs, writes one `reflections` row, exits.
10. Coverage-rate query (`{ rate, byHarness }`) is queryable as the pipeline-health self-diagnostic.

**What is intentionally NOT changing:**
- Existing job execution path behavior (reflection is purely additive)
- Chat job execution (chat does not auto-reflect; user-driven only)
- PM cascade, fan-out logic, retry/rate-limit handling
- Runner uptime requirements (reflection failures are silent and self-isolated)

---

## Architecture & Data Flow

```
Job runs and completes (or fails / times out)
    |
    v
Runner.onComplete | onFail | onTimeout (each carries sessionId)
    |
    +--> api.jobs.complete | api.jobs.fail (sessionId, ...)   (synchronous, primary path)
    |
    +--> spawnReflection(jobId)                               (fire-and-forget child process)
    |       |
    |       v
    |   reflect-spawn.ts <jobId>:
    |     read job from Convex (sessionId, harness, jobtype, status)
    |     skip if harness != claude OR sessionId missing
    |     render reflection prompt from templates/reflect.md
    |     spawn: claude --resume <sessionId> --fork-session  (5-min wall-clock)
    |       |
    |       v
    |   Claude resumes session into a *forked* throwaway:
    |     reads reflection prompt
    |     runs `npx tsx .agents/tools/workflow/reflect.ts --help` to learn the interface
    |     constructs structured payload (description, critique, rubric subset, keywords, etc.)
    |     writes payload to a temp JSON file (Write tool)
    |     invokes: npx tsx .agents/tools/workflow/reflect.ts \
    |              --job-id <jobId> --input <tmp.json>
    |       |
    |       v
    |   reflect.ts:
    |     reads --input file, validates payload shape
    |     reads config.json for Convex auth (same as runner/cli)
    |     queries Convex for the job record:
    |       sessionId, namespaceId, harness, jobType,
    |       totalTokens, toolCallCount, startedAt, completedAt
    |     captures auto metadata:
    |       reflectionCliVersion (const in source)
    |       clientGitSha (git rev-parse HEAD in cwd)
    |       engineGitSha   (git rev-parse HEAD at runner __dirname)
    |     calls api.reflections.insert with full denormalized row
    |     prints success / exits 0
    |       |
    |       v
    |   Claude's forked session exits.
    |   reflect-spawn.ts exits (or SIGKILL'd by 5-min timer).
    |
    +--> handleGroupCompletion(...)                          (continues normal cascade)
```

**Key design decisions:**

1. **CLI-script tool, not MCP.** The `reflect` tool is a plain Node script the agent invokes via Bash, mirroring the existing assignment toolkit (`cli.ts`). The agent learns its interface via `--help`. This drops a substantial pile of complexity (no MCP stdio server, no `.mcp.json` rendering, no env propagation surgery, no second file to distribute, no auth-token-in-tempfile concerns) and keeps the codebase pattern uniform.

2. **Two scripts, two responsibilities.**
   - `reflect.ts` -- agent-facing. Single responsibility: take structured input, validate, denormalize job metadata, write to Convex.
   - `reflect-spawn.ts` -- runner-facing. Single responsibility: resurrect the agent with `--resume --fork-session` and a reflection prompt. The agent never sees this file; `--help` on the agent tool stays uncluttered.

3. **`--fork-session` prevents session contamination.** The runner already supports `forkSession` for guardian (`harness-executor.ts`). Reusing the pattern means the reflection turn lives in a throwaway forked session; the original `sessionId` remains a clean trace pointer. Pinned, not "verify during implementation."

4. **Failed jobs reflect.** The `onFail`/`onTimeout` callback contracts and `api.jobs.fail` mutation are extended to carry `sessionId`. Failure is exactly when friction signal is highest; dropping it would lose the most valuable slice of the dataset.

5. **Flexible rubric.** Stored as `v.record(v.string(), v.boolean())` so the question set can evolve without schema migrations. Field omission is itself signal ("the agent had no opinion on this dimension") and lets analysis distinguish *not answered* from *answered no*. v1 ships a draft question list of ~20 keys.

6. **Idempotence: accept duplicates at v1.** One CLI invocation per job under prompt instruction. If duplication occurs, `byJob` returns the most recent. No upsert logic, no uniqueness index at v1; revisit only if duplication shows up as a real problem.

7. **Auto-captured metadata vs joined metadata.** Auto-captured fields snapshot at reflection time (`reflectionCliVersion`, `clientGitSha`, `engineGitSha`). Job-weight fields (`namespaceId`, `harness`, `totalTokens`, `toolCallCount`, duration) are denormalized onto the row at write time so analysis queries are single-table and the *weight at the moment of reflection* is frozen even if the job is retried/edited later.

8. **Self-diagnostic over guarantees.** No retry, no error handling, no failure recovery. Coverage rate (`reflectedJobs / terminalJobs`, broken down by harness) surfaces drops -- harness crashes, broken sessionId capture, agents skipping the tool. Single number plus `byHarness` breakdown so the non-Claude expected-zero is visible at a glance.

9. **5-min wall-clock timeout** in `reflect-spawn.ts`. SIGTERM, then SIGKILL on expiry. Hung children don't hold runner resources; missed reflections show in coverage rate.

10. **Distribution: `.agents/` auto-propagates.** Per `harness-model-config-spec.md` precedent and the GitHub tarball fetcher, anything under `.agents/` is included in client installs automatically. Both new scripts and the prompt template propagate via the existing path. The raw-URL fallback manifest does not include reflection files; this is acknowledged and accepted (single-user threat model; tarball is the canonical install path).

---

## Schema Changes

### New table: `reflections`

```typescript
reflections: defineTable({
  jobId: v.id("jobs"),               // FK to jobs table -- canonical join key
  sessionId: v.string(),             // Captured for traceability

  // Denormalized job-weight metadata (frozen at reflection time)
  namespaceId: v.id("namespaces"),      // Required on reflection rows; source job must have it
  harness: v.union(
    v.literal("claude"),
    v.literal("codex"),
    v.literal("gemini")
  ),
  jobType: v.string(),
  totalTokens: v.optional(v.number()),
  toolCallCount: v.optional(v.number()),
  durationMs: v.optional(v.number()),  // completedAt - startedAt at reflection time

  // Content fields
  description: v.string(),           // 1-line "what" (debugging convenience)
  critique: v.string(),              // Free-form: friction, mistakes, ergonomics
  alternativeApproach: v.string(),   // How they would do it again
  improvements: v.string(),          // Suggested improvements for future agents

  // Boolean rubric -- flexible key/value map. Keys are NOT typed at the schema level
  // so the question set can evolve without schema migrations. Values are booleans.
  // Omission of a key is itself signal ("the agent had no opinion on this dimension").
  // The current question set is a v1 DRAFT, expected to evolve based on real reflection data.
  rubric: v.record(v.string(), v.boolean()),

  keywords: v.array(v.string()),     // Free-form, no taxonomy at v1

  // Auto-captured metadata
  reflectionCliVersion: v.string(),  // Const in reflect.ts source, bumped per push
  clientGitSha: v.optional(v.string()),  // git rev-parse HEAD in cwd
  engineGitSha: v.optional(v.string()),  // git rev-parse HEAD at runner __dirname

  createdAt: v.number(),
})
  .index("by_job", ["jobId"])
  .index("by_namespace_created", ["namespaceId", "createdAt"])
  .index("by_namespace_harness_created", ["namespaceId", "harness", "createdAt"])
  .index("by_created", ["createdAt"]),
```

### `jobs` table -- add optional `namespaceId` and `sessionId`

```typescript
namespaceId: v.optional(v.id("namespaces")), // Integration-era denominator marker; no backfill
sessionId: v.optional(v.string()),  // Harness session id (Claude-only at v1)
```

The harness executor's `ClaudeStreamHandler` captures `session_id` from streamed events; the runner's `onComplete` callback already receives it. Currently this is only persisted for chat jobs (routed to `chatThreads.claudeSessionId`). Adding the field here lets assignment jobs persist it for reflection.

Add a namespace-scoped `completedAt` compound index for coverage queries (queries always filter by namespace, so the compound index avoids a full scan):
```typescript
.index("by_namespace_completedAt", ["namespaceId", "completedAt"])
```

Note: the existing `jobs` table does not currently have a direct `namespaceId` field -- it's reachable via `groupId -> assignmentId -> namespaceId`. Phase 1 denormalises `namespaceId` onto new job records only. It stays optional and is not backfilled. Coverage-rate queries treat `jobs.namespaceId` presence as the reflection-integration denominator marker, so historical jobs without the field are excluded instead of counted as missing reflections.

### `api.jobs.complete` and `api.jobs.fail` -- accept `sessionId`

Both mutations gain an optional `sessionId: v.optional(v.string())` arg. Each writes the value to the job record. Failed jobs reflect, so `fail` must accept the field too -- a load-bearing fix from the v0.1 review.

### Retry-flow `sessionId` lifecycle

Anywhere job execution state is reset for retry (`executeRetry`, `retryGroup`, rate-limit auto-retry), `sessionId` is cleared. A retried job reflects on its own session, not the prior attempt's. Document overwrite semantics in `jobs.ts`.

### `HarnessExecutor` callback contract changes

`workflow-engine/.agents/tools/workflow/lib/harness-executor.ts`:

```typescript
interface ExecutionCallbacks {
  onComplete: (result: string, sessionId: string | undefined, exitForced: boolean) => Promise<void> | void;
  onFail:     (reason: string, partialResult: string | undefined, exitForced: boolean, sessionId: string | undefined) => Promise<void> | void;
  onTimeout:  (partialResult: string, sessionId: string | undefined) => Promise<void> | void;
  // ...others unchanged
}
```

Callers (the runner) pull `sessionId` from `handler.getSessionId()` (or the executor passes it through directly).

For the dead-orphan recovery path: `DeadOrphanResult.sessionId` is materialised by `finalizeDeadOrphan` via log replay (the on-disk status file does NOT contain it -- corrected from v0.1's L1). The reconcile path threads `result.sessionId` into the appropriate complete/fail/rateLimited mutation.

### New file: `workflow-engine/convex/reflections.ts`

Exports:
- `insert` mutation -- writes a reflection row. Accepts all content + denormalized + auto-captured fields. Validates ownership (the `jobId` must exist and be terminal). Rubric is `v.record(v.string(), v.boolean())` -- accepts any boolean keys.
- `byJob` query -- given a `jobId`, returns the most recent reflection (last-write-wins under v1's permissive duplicate semantics).
- `coverageRate` query -- the pipeline-health metric. See **Coverage Rate Self-Diagnostic** for the full arg shape and semantics. The denominator is terminal jobs with `namespaceId` present.
- `recent` query -- list reflections with the same filter / window args as `coverageRate`. Returns full reflection rows for analysis. Cursor-paginated when window is `{ since, until }` or `{ since }`; not paginated when window is `{ last: N }` (caller already chose N).

All mutations and queries enforce password auth, matching the project's pattern.

`bySessionId` query was considered (v0.1 critique L5) and rejected -- `sessionId` is row metadata, not a useful query axis.

---

## Reflection Trigger Integration (`runner.ts`)

The runner has three completion code paths; each gets the same treatment:

1. **Main job execution** assignment `onComplete` (~line 577): pass `sessionId` to `api.jobs.complete`.
2. **Main job execution** assignment `onFail` / `onTimeout` (~lines 609 / 652): pass `sessionId` (now in callback signature) to `api.jobs.fail`.
3. **Reconcile -- live orphan adoption** (~line 1111): pass `sessionId` to `complete`/`fail` callbacks (signature update).
4. **Reconcile -- dead orphan finalize** (~line 1170+): use `result.sessionId` from `finalizeDeadOrphan` when calling `complete` / `fail` / `rateLimited`.

After each successful mutation, **but after `handleGroupCompletion` returns** (so the cascade is not delayed), spawn the wrapper:

```typescript
function spawnReflection(jobId: string): void {
  try {
    const child = spawn(
      "npx",
      ["tsx", path.join(__dirname, "reflect-spawn.ts"), jobId],
      {
        detached: true,
        stdio: "ignore",
        cwd: __dirname,
        env: process.env,
      }
    );
    child.on("error", () => { /* silent: coverage rate is the alarm */ });
    child.unref();
  } catch {
    // Silent. Missing reflection rows show up in coverage rate.
  }
}
```

Order: `mutation → handleGroupCompletion → spawnReflection`. The cascade happens first; the reflection child runs after, decoupled and non-blocking.

**Chat jobs do NOT trigger reflection.** The chat onComplete/onFail paths are untouched. Chat reflection is on-demand by user request only.

**Failed-but-no-sessionId jobs.** Some failure modes (immediate harness crash, kill before any output) leave no `sessionId`. `reflect-spawn.ts` skips silently in this case. Coverage rate naturally reflects this.

---

## Reflection Spawn Wrapper (`reflect-spawn.ts`)

Runner-facing. The agent never sees this file.

Entry: `npx tsx .agents/tools/workflow/reflect-spawn.ts <jobId>`

**Flow:**
1. **Argv parse** -- single positional `jobId`. Exit silently if missing.
2. **Connect to Convex** via the same `config.json` as the runner.
3. **Read job record**: `sessionId`, `harness`, `jobType`, `status`, partial context.
4. **Eligibility checks** (silent skip on any):
   - status is `complete` or `failed` (not `running`/`pending`).
   - **Not `awaiting_retry`.** Rate-limited jobs would resurrect into a rate-limited harness -- the reflection invocation would also be rate-limited. The reflection happens (or doesn't) on the eventual terminal completion of the retried run.
   - harness is `claude` (others deferred to a follow-up).
   - `sessionId` is non-empty.
5. **Render the reflection prompt** from `templates/reflect.md` with placeholders bound to:
   - `{{JOB_TYPE}}` -- `job.jobType`
   - `{{JOB_STATUS}}` -- `job.status`
   - `{{JOB_ID}}` -- `job._id` (so the agent can pass it to `reflect.ts`)
   - `{{ASSIGNMENT_SCOPE_HINT}}` -- first 200 chars of the assignment's north star
6. **Spawn Claude** with:
   - `--resume <sessionId>`
   - `--fork-session` (forks the resumed session into a throwaway; original session record stays clean)
   - The prompt on stdin
   - Wall-clock timer (default 5 min, configurable via `config.json` `reflectionTimeoutMs`): SIGTERM at expiry; SIGKILL if not exited within 10s
7. **Wait** for the child to exit. No output parsing.
8. **Exit.**

**Failure modes (all silent, all OK):**
- Convex unreachable -> exit 0
- Job not found / not eligible -> exit 0
- Claude CLI fails to start / hangs -> exit 0 after timeout
- Agent never invokes `reflect.ts` -> no row, surfaces in coverage rate

---

## Reflection CLI (`reflect.ts`) -- agent-facing

Entry: `npx tsx .agents/tools/workflow/reflect.ts [--help | --job-id <id> --input <path>]`

This is the tool the agent invokes from inside the resurrected session. The reflection prompt directs the agent here and instructs them to read `--help` first.

### Top-level constant

```typescript
const REFLECTION_CLI_VERSION = "0.1.0";  // Bump on every push touching the reflection system.
```

### `--help` output (informal)

```
Submit a structured reflection on a completed job.

Usage:
  reflect.ts --job-id <jobId> --input <path-to-json>
  reflect.ts --help

Required:
  --job-id <id>       The job you are reflecting on (provided in the prompt).
  --input  <path>     Path to a JSON file containing the structured reflection.

Input file shape:
  {
    "description":          string,    // 1-line "what" of the job (debug convenience)
    "critique":             string,    // friction, mistakes, ergonomics observations
    "alternativeApproach":  string,    // how you would do this again
    "improvements":         string,    // concrete suggestions for future agents
    "rubric": {                        // Flexible kvp; omit any key if no opinion.
                                       // Question set is a DRAFT; agents may answer any
                                       // subset they form an opinion on. The runner-side
                                       // prompt directs the agent to the canonical
                                       // current-draft question list.
      "<questionKey>": boolean,
      ...
    },
    "keywords": string[]
  }

Current draft rubric question keys (v1):
  Clarity:    intentInferred, assignmentMatchedWork
  Tooling:    toolErrorsBlocked, toolRepetitionRequired, neededToolMissing,
              toolOutputNoise, toolOutputInsufficient
  Environment: projectStateClean, undocumentedSetup, hiddenContextDiscovered,
              priorStateInterfered
  Efficiency: repeatedWork, wrongPathFirst, contextLoadingExcessive
  Approach:   sameApproachAgain, overengineeredPart, underdeliveredPart,
              followedConventions
  Knowledge:  docsSufficient, assumedUnverified

  20 questions in this draft. The list will evolve; the schema does not gate it.

Behavior:
  - Validates input shape; exits non-zero with a diagnostic on validation failure.
  - Looks up the job in Convex to denormalise namespace, harness, jobType,
    totalTokens, toolCallCount, and duration onto the reflection row.
  - Captures reflectionCliVersion, clientGitSha (cwd HEAD), engineGitSha
    (runner __dirname HEAD) automatically.
  - Writes one row to the reflections table. Prints "ok" and exits 0.
```

### Flow

1. Argv parse.
2. Read `--input` JSON.
3. Validate shape (required string fields; rubric is a kvp where every value is boolean; keywords array of strings).
4. Read `config.json` for Convex auth (same connection params as runner/cli).
5. Query `api.jobs.byId` (or equivalent) for the job's denormalisation source.
6. Capture `clientGitSha` via `git rev-parse HEAD` in cwd; `engineGitSha` via `git -C <runner __dirname> rev-parse HEAD`. Either may be null on failure.
7. Compose the full row: input + denormalised job-weight + auto metadata + `createdAt`.
8. Call `api.reflections.insert`.
9. Print `ok` to stdout; exit 0.

### Validation rules

- Required string fields present (allow empty string).
- `rubric` is an object; every value is a `boolean`. Keys are **not** restricted -- the rubric is intentionally a flexible kvp so the question set can evolve without schema migrations.
- `keywords` is an array of strings.
- `--job-id` is a non-empty string.
- `--input` file exists and is JSON-parseable.

On any failure: exit non-zero with a one-line diagnostic. The agent can read it, fix, and retry.

---

## Reflection Prompt Template (`templates/reflect.md`)

Drafted by the user offline. Skeleton:

```
You just completed a {{JOB_TYPE}} job (status: {{JOB_STATUS}}, id: {{JOB_ID}}).

Reflect on the OPERATING EXPERIENCE of doing that job: tooling, environment,
friction, efficiency. NOT the output you produced. Outcome quality is out of scope.

Be adversarial. Sycophancy here pollutes the dataset other agents (and the operator)
use to improve future runs. If something was bad, say so concretely.

To submit:
  1. Run `npx tsx .agents/tools/workflow/reflect.ts --help` to see the input schema.
  2. Write your structured reflection as JSON to a temp file.
  3. Invoke:
       npx tsx .agents/tools/workflow/reflect.ts \
         --job-id {{JOB_ID}} \
         --input <your-tmp-file>
  4. Exit.

Brief context cue (the assignment was about):
  {{ASSIGNMENT_SCOPE_HINT}}
```

Placeholder bindings are explicit (see `reflect-spawn.ts` step 5).

---

## Coverage Rate Self-Diagnostic

`coverageRate` is the pipeline-health metric. The `recent` query takes the same arg shape (filters + window).

### Args

```typescript
{
  password: string,                    // auth, same as other queries
  namespaceId: Id<"namespaces">,       // ALWAYS provided -- the CLI/Steward toolkit injects from config
  jobType:  string?,                   // optional filter
  harness:  ("claude" | "codex" | "gemini")?,   // optional filter

  // Window -- exactly one of the following groups; if none provided, defaults to { last: 100 }
  since?:   number,                    // unix ms; "since" alone = open-ended-up-to-now
  until?:   number,                    // unix ms; only valid alongside `since` (= between)
  last?:    number,                    // last N terminal jobs (default 100 if no window args)
}
```

Window resolution:
- `{ since, until }` provided     -> window is `[since, until]` (between)
- `{ since }` only                -> window is `[since, now]`
- `{ last: N }` provided          -> window is the most recent N terminal jobs (no time filter)
- nothing provided                -> defaults to `{ last: 100 }`
- mixing (e.g., `since` + `last`) -> validation error

### Return

```typescript
{
  terminalJobs: number,        // jobs with status complete | failed in window (after filters)
  reflectedJobs: number,       // subset paired with a reflections row
  rate: number,                // reflectedJobs / terminalJobs (NaN-safe -- 0 when no jobs)
  byHarness: Record<"claude" | "codex" | "gemini", {
    terminal: number,
    reflected: number,
  }>,
  eligibleCoverage: number,    // reflected / terminal restricted to harnesses that support reflection (Claude-only at v1)
}
```

### Notes

- `namespaceId` is always required because metrics are scoped to a single namespace. The Steward analysis toolkit injects this from its config; cross-namespace aggregation is out of scope.
- Only jobs with denormalized `jobs.namespaceId` participate in coverage. This intentionally excludes historical jobs from before the reflection integration; no backfill is required.
- `byHarness` is intentionally retained: the non-Claude expected-zero is the single most informative signal in the breakdown -- it makes the harness gap visible at a glance.
- Drops in `eligibleCoverage` indicate harness crashes, broken sessionId capture, or agents skipping the tool.
- Indexes used: `jobs.by_namespace_completedAt` (Phase 1 adds this index, scoped to namespace), `reflections.by_namespace_created`. The `last: N` form requires a `by_namespace_completedAt_desc` traversal limited to N rows.

---

## Versioning

Three version axes for analysis:

1. **`reflectionCliVersion`** -- string constant in `reflect.ts`, bumped on every push touching the reflection system. Answers: "did v0.2 of the reflection harness change what agents report?"
2. **`clientGitSha`** -- captured from the consuming repo's HEAD at reflection time. Answers: "is reflection feedback in this codebase getting better over time?"
3. **`engineGitSha`** -- captured from the runner's `__dirname` HEAD at reflection time. Answers: "is reflection feedback changing as the workflow engine evolves?" Closes the v0.1 gap from L7.

---

## Risks (all pinned; no open questions remain at architectural level)

### Sycophancy in reflections
Self-reflection is biased toward optimism. Mitigation: the prompt explicitly invites adversarial framing. Long-term: a meta-reflector (the Outcome Steward) cross-references many reflections to surface patterns. Not in v1 scope.

### Cost
One small extra harness invocation per reflectable job, dominated by `--resume` context loading. The reflection turn itself is short. Cost is acceptable.

### Session contamination
**Mitigated by `--fork-session`.** Original session record stays clean.

### Failed-but-unresumable jobs
Some failures leave no `sessionId`. `reflect-spawn.ts` skips silently; coverage breakdown reflects this.

### PII / secret persistence
Reflections may include verbatim file contents, env values, or credentials in free-text fields. Same trust boundary as `jobs.result`. Single-user threat model accepts this. **Spec note added per M5.**

### Duplicate reflections
Permitted at v1. `byJob` returns latest. If real-world data shows duplication, add a uniqueness index in a follow-up.

### Engine-version not pinned across client installs
Client repos pull workflow tools via git, asynchronously. `engineGitSha` captures the runner-side version per reflection; `reflectionCliVersion` captures the agent-tool version. The two SHAs disambiguate.

---

## Manual Implementation Steps (Offline)

The implementer runs through these manually. Phases are ordered so each one is independently valuable and stops the system in a valid state. **Two runner restarts total**, both bounded and explicit (Phase 1 and Phase 5). Phases 2–4 require zero runner interaction — fully safe to do alongside live work.

### Phase 1 — SessionId capture (deployable on its own; standalone debugging value)

**Goal:** persist the harness session id for every assignment job — success and failure paths both. This unblocks reflection but is also a useful debugging affordance on its own (sessions can be resumed for inspection).

1. **Schema** (`workflow-engine/convex/schema.ts`):
   - Add `namespaceId: v.optional(v.id("namespaces"))` to the `jobs` table. Write it only for newly created jobs; do not backfill historical rows.
   - Add `sessionId: v.optional(v.string())` to the `jobs` table.
   - Add `by_namespace_completedAt` compound index on `jobs` (used by the coverageRate query in Phase 2; namespace-scoped traversal is more efficient than a global completedAt index given queries always filter by namespace).
2. **Mutations** (`workflow-engine/convex/jobs.ts`): extend BOTH `complete` AND `fail` to accept and write optional `sessionId`. Both must be done — failed jobs reflect.
3. **Convex deploy** per `CLAUDE.md` instructions (root symlink, deployment env var). Verify functions are bundled (data-loss warning).
4. **HarnessExecutor** (`.agents/tools/workflow/lib/harness-executor.ts`): extend `ExecutionCallbacks.onFail` and `onTimeout` signatures to pass `sessionId` from the active stream handler's `getSessionId()`. The `onComplete` signature already passes it.
5. **Runner** (`.agents/tools/workflow/runner.ts`):
   - Live `onComplete` (~line 577): pass `sessionId` to `api.jobs.complete`.
   - Live `onFail` / `onTimeout` (~lines 609 / 652): pass `sessionId` to `api.jobs.fail` (signature now permits it).
   - Reconcile / live orphan adoption (~line 1111): pass `sessionId` in adopted callbacks.
   - Reconcile / dead-orphan finalize (~line 1170+): use `result.sessionId` from `finalizeDeadOrphan` when calling `complete` / `fail` / `rateLimited`. The on-disk status file does NOT contain sessionId; recovery is via the executor's log replay.
6. **Retry-flow `sessionId` clearing** (`workflow-engine/convex/jobs.ts`): in `executeRetry`, `retryGroup`, and any path that resets job execution state, clear `sessionId` so retried jobs reflect on their own session.
7. **Runner restart #1.**
8. **Validate**: trigger a real assignment with both success and failure cases; confirm `jobs.sessionId` is populated in Convex for each. Confirm a retried job has the field cleared and re-set on its retry attempt.

**Rollback**: revert the commit; runner restart; existing `sessionId` values linger harmlessly.

**Stopping here is valid.** SessionIds are a debuggable artifact even with no reflection downstream.

---

### Phase 2 — Reflections data plane (additive; no behaviour change)

**Goal:** stand up the reflections table and Convex queries. Nothing yet writes to it via the workflow.

1. **Schema** (`workflow-engine/convex/schema.ts`): add the `reflections` table per the **Schema Changes** section, including all indexes (`by_job`, `by_namespace_created`, `by_namespace_harness_created`, `by_created`).
2. **Convex module**: create `workflow-engine/convex/reflections.ts` with `insert`, `byJob`, `coverageRate`, `recent`. All authed (password from `auth.ts`).
3. **Convex deploy.** Verify functions bundled.
4. **Validate**: insert one row manually via the Convex dashboard against a real recent `jobId`. Confirm `byJob` returns it. Confirm `coverageRate` runs against a recent time window without errors.

**Rollback**: revert; reflection rows from validation linger harmlessly.

**Stopping here is valid.** Schema and queries are sound; no agents are reflecting yet.

---

### Phase 3 — `reflect.ts` (agent-facing CLI; standalone testable)

**Goal:** a working submission tool that an agent (or a human, for testing) can invoke against any completed job to land a reflection.

1. **Implement** `.agents/tools/workflow/reflect.ts` per the **Reflection CLI** section:
   - `--help` describes the schema explicitly.
   - `--job-id <id>` and `--input <path>` required for submission.
   - Validates the input JSON shape (required strings, rubric kvp where every value is boolean, keywords array of strings). Rubric keys are unrestricted.
   - Reads `config.json` for Convex auth (same connection params as runner/cli).
   - Queries the job to denormalise `namespaceId`, `harness`, `jobType`, `totalTokens`, `toolCallCount`, `durationMs`.
   - Captures `reflectionCliVersion` (const), `clientGitSha` (cwd HEAD), `engineGitSha` (runner `__dirname` HEAD).
   - Calls `api.reflections.insert`. Prints `ok` and exits 0 on success; non-zero with diagnostic on validation failure.
2. **Manual test**: pick a recent Claude-harness completed job. Hand-craft a reflection JSON (cover required fields and a partial rubric). Invoke `reflect.ts --job-id <id> --input <file>`. Confirm the row lands with all denormalised + auto fields populated correctly.

**Rollback**: delete the file.

**Stopping here is valid.** Submission tool is ready for any caller.

---

### Phase 4 — `reflect-spawn.ts` and prompt template (standalone testable)

**Goal:** the runner-side wrapper that resurrects an agent and points them at `reflect.ts`. Still no runner integration.

1. **Implement** `.agents/tools/workflow/reflect-spawn.ts` per the **Reflection Spawn Wrapper** section:
   - Single positional `<jobId>`.
   - Eligibility checks (silent skip on any): job is terminal; harness is `claude`; `sessionId` non-empty.
   - Render `templates/reflect.md` with bound placeholders (`{{JOB_TYPE}}`, `{{JOB_STATUS}}`, `{{JOB_ID}}`, `{{ASSIGNMENT_SCOPE_HINT}}`).
   - Spawn `claude --resume <sessionId> --fork-session` with the rendered prompt on stdin.
   - 5-min wall-clock timeout: SIGTERM at expiry, SIGKILL after 10s.
   - Exit silently on any failure; coverage rate is the alarm.
2. **Draft** `.agents/tools/workflow/templates/reflect.md`: skeleton from the **Reflection Prompt Template** section. Operator iterates the wording in-flow as it gets used.
3. **Manual test**: pick a recent Claude-harness completed job. Run `reflect-spawn.ts <jobId>` from the runner's cwd. Confirm:
   - The agent runs `reflect.ts --help`, then submits.
   - A row lands.
   - The original session record is uncontaminated (the forked session is throwaway). Spot-check by inspecting the on-disk session file or running another `--resume` against the original sessionId and confirming the reflection turn isn't there.

**Rollback**: delete both files.

**Stopping here is valid.** Full reflection flow works under manual invocation.

---

### Phase 5 — Runner integration

**Goal:** wire the runner to fire `reflect-spawn.ts` automatically on every reflectable job completion.

1. **Add** `spawnReflection(jobId)` helper in `.agents/tools/workflow/runner.ts` per the example in **Reflection Trigger Integration**.
2. **Wire** it after `handleGroupCompletion` returns, in all three completion paths (live success, live failure/timeout, reconcile). Order: cascade first, reflection spawn after.
3. **Runner restart #2.**
4. **Validate**:
   - Run a test assignment; confirm reflections appear naturally for each completed job.
   - Confirm `coverageRate` returns sensible numbers; confirm `byHarness` shows non-Claude at 0%.
   - Force a job failure (e.g., kill via UI) and confirm a reflection still lands.
5. **Bump** `REFLECTION_CLI_VERSION` const in `reflect.ts` if any tweaks landed during phases 3–5.

**Rollback**: revert the runner.ts change; runner restart; reflection rows from Phase 5 testing linger but are harmless.

---

**Distribution note:** `reflect.ts`, `reflect-spawn.ts`, and `templates/reflect.md` propagate to client installs automatically because they live under `.agents/`, which the GitHub tarball fetcher includes wholesale (per `harness-model-config-spec.md` precedent). The raw-URL fallback manifest does NOT include them; this is acknowledged and accepted (single-user threat model; tarball is the canonical install path).

The dashboard, Steward analysis toolkit, and meta-reflector are separate phases beyond this spec.

---

## Acceptance Criteria

The implementation plan is solid when:

1. Every file change is identified with a clear before/after intent.
2. Self-surgery risk is acknowledged; the implementation order avoids runner restart during destructive moments.
3. The `reflect.ts` CLI contract (one invocation per job, structured input file, Convex auth via `config.json`) is unambiguous and consistent with the existing toolkit pattern.
4. The boolean rubric is fully optional and stored as a typed Convex object (not JSON blob), so the dashboard can index/filter.
5. Failed jobs reflect: `onFail`/`onTimeout` and `api.jobs.fail` carry `sessionId`; retry-flow paths clear `sessionId` on reset.
6. `--fork-session` prevents session contamination; pinned, not deferred.
7. Distribution path is explicit: `.agents/` auto-propagates via tarball; raw-URL fallback gap is acknowledged and accepted.
8. The coverage-rate query (`{ rate, byHarness, eligibleCoverage }`) is precisely defined and indexed.
   Its denominator is terminal integration-era jobs: rows with `jobs.namespaceId` present and matching the requested namespace.
9. Failure modes (Claude unavailable, sessionId missing, agent skips the tool, duplicate writes) all degrade silently with the coverage rate as the alarm.
10. Non-Claude harnesses skip cleanly; their expected-zero is visible in `byHarness`.

---

## Out of Scope -- Explicit

- **Codex / Gemini reflection.** Deferred until those harnesses' resume-equivalents are validated.
- **Workflow effectiveness reflection** (outcome-aware variant). Separate product.
- **Steward analysis toolkit.** Separate phase, consumes the same Convex query functions as the dashboard.
- **Reflection dashboard UI.** Separate phase.
- **Reflection-on-reflections meta-aggregator.** Separate phase.
- **MCP-based tool invocation.** Considered and rejected in favour of the CLI-script pattern; see Architecture decision (1).

---

## Amendments Applied from v0.1 Critique (`reflection-feedback-critique.md`)

| Issue | Disposition |
|---|---|
| H1 | Applied (failed jobs reflect; `onFail`/`onTimeout`/`api.jobs.fail` carry `sessionId`). |
| H2 | Applied (`api.jobs.fail` accepts `sessionId`). |
| H3 | Applied & extended in v0.3: rubric reshaped to a flexible kvp (`v.record(v.string(), v.boolean())`). Keys are not typed at the schema level so the question set can evolve without migrations; v1 ships a draft list of 20 questions. |
| H4 | Obsolete (no MCP, no env propagation). |
| H5 | Applied (`--fork-session` pinned). |
| H6 | Applied (`.agents/` propagation made canonical; raw-URL fallback gap explicitly accepted, not closed). |
| H7 | Applied (duplicates accepted at v1; `byJob` returns latest; revisit if real). |
| H8 | Partially applied (5-min wall-clock timeout default, configurable via `config.json` `reflectionTimeoutMs`; `--allowedTools` dropped per user direction -- agent may use any tools during reflection; only the `reflect.ts` invocation matters as output). |
| M1 | Applied (denormalisation extended to `namespaceId`, `harness`, `jobType`, `totalTokens`, `toolCallCount`, `durationMs`; new indexes added; `eligibleCoverage` defined). |
| M2 | Applied (spawn after `handleGroupCompletion`; `cwd: __dirname`; `child.on('error')` silent). |
| M3 | Applied (5-min timeout, SIGTERM->SIGKILL). |
| M4 | Applied (retry-flow `sessionId` clearing pinned). |
| M5 | Applied (PII/secret note in Risks). |
| M6 | Applied & extended in v0.3: rubric pinned as a flexible kvp -- never needs a schema migration to add/remove questions. Loophole closed by design rather than by commitment. |
| L1 | Applied (dead-orphan recovery via log replay, not status file -- corrected). |
| L2 | Applied (job-type enumeration: plan, implement, review, uat, pm, document). |
| L3 | Applied: `document` job type included in reflection scope. Reflectable list: plan, implement, review, uat, pm, document. Only `chat` excluded. |
| L4 | Applied counter to recommendation: `byHarness` retained; mental model updated. |
| L5 | Reversed in v0.3: `bySessionId` dropped -- sessionId is row metadata, not a useful query axis. |
| L6 | Applied (cursor-based pagination for `recent`). |
| L7 | Applied (`engineGitSha` added). |
| L8 | Applied (placeholder bindings explicit). |
| L9 | Applied (one-line rollback per phase). |
