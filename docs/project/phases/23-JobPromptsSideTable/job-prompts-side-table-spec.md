# Job Prompts Side Table (Spec)

Phase: `23-JobPromptsSideTable`
Status: PLANNED at HEAD `82b23ace`. No code written yet.
Why-layer: `docs/project/spec/mental-model.md` → `#mm-prompt-is-visibility-artefact`, `#mm-self-surgery`, "Subscription Efficiency Principle", "Execution Records vs. Filesystem State". These are settled. This spec does not reopen them.

External research: skipped on purpose. This is a repo-internal change to an existing Convex schema. The repo already has a pattern for every choice: `lib/` helpers that take `Pick<…Ctx, "db">` and are tested with a fake ctx (`lib/notificationFeed.ts` + `.test.ts`), `useQuery` with an error channel (`ui/js/hooks/useConvex.js`), and additive tables (`reflectionsV2`). There is no greenfield technology decision to put through a matrix.

---

## Hard constraints (verbatim from the north star; every WP brief carries this block)

> **Hard constraints — this is self-surgery (`mental-model.md#mm-self-surgery`)**
> Every crew member on this assignment is a job running inside the runner, subscribed to the Convex deployment being edited. Therefore:
> - NEVER start, stop or restart the runner. It would kill your own process.
> - NEVER run `convex dev`, `convex deploy`, or any command that pushes functions/schema to ANY Convex deployment (dev or prod). The only permitted Convex command is the local `convex codegen` script.
> - NEVER exercise the workflow loop end to end, insert test jobs, or run e2e/UAT. No `uat` job is to be inserted on this assignment; the PM routes review from code only.
> - Review is static: reviewers verify by tracing the write path, the fallback order, the single delete helper and its three call sites, and the UI degrade path. Validation is the validate CLI and nothing else.
> - Deploy (Convex, then readback) and live verification of the modal belong to the Steward after this chain completes. No runner restart is needed because the runner is untouched; do not route one.

Repo addenda (from `.agents/AGENTS.md`): never `git stash`. Do not edit `.agents/tools/workflow/cli.ts` or `runner.ts`. tsx recompiles them on every crew invocation.

---

## Purpose

A 192-job chain broke the runner. `scheduler.getReadyJobs` → `findReadyJobs` walks every group from the head to the first pending group and `collect()`s every job document on the way. Each started job carried its ~100–120 KB prompt, so the walk crossed Convex's 16 MiB per-query read limit. The runner's subscription errored and `cleanup()` killed every running job in the namespace, chats included.

The prompt is only a visibility artefact for the human reading the job detail modal. Nothing in the engine reads it back. Moving it beside the job record makes every chain walk independent of prompt size. This is the proportionate fix. There is no migration, no scheduler redesign and no runner change.

## Overview

| Piece | Change |
|---|---|
| `schema.ts` | New `jobPrompts { jobId, prompt, createdAt }` table with index `by_job`. `jobs.prompt` stays optional for historical rows. |
| `lib/jobPrompts.ts` (new) | The pure resolver `resolveJobPrompt`, plus three ctx helpers: `readJobPrompt`, `upsertJobPrompt` and `deleteJob` (the single job-delete helper). |
| `lib/jobPrompts.test.ts` (new) | `node:test` coverage of the resolver order, laziness, upsert and delete. |
| `jobs.ts` | `start` upserts the prompt row and stops patching `prompt`. New `getPrompt` query. `getWithGroup` joins `prompt`. `retryGroup` cascade uses `deleteJob`. |
| `assignments.ts`, `chatThreads.ts` | Their job-delete loops call `deleteJob`. |
| `_generated/api.d.ts` | Regenerated with `npm run generate`. It gains the `lib_jobPrompts` module entry. |
| UI `api.js`, `JobDetail.js` | Register `jobs.getPrompt`. The modal fetches the prompt lazily, shows a skeleton while loading, and renders no prompt section on a missing prompt or a query error. |
| `convex-bandwidth-optimization.md` | Add §6d. |

**Untouched (criterion 9):** `scheduler.ts`, `.agents/tools/workflow/runner.ts`, `assignments.getChainWithTerminalJobs`, `jobs.getActiveGroupsWithJobs`, `chatJobs.ts` (including `chatJobs.start` and the `chatJobs.prompt` field), and `cli.ts`.

---

## Architecture Design

### A. Trace at HEAD: every writer, reader and deleter of `jobs.prompt`

Confirmed by `rg -n '\bprompt\b' workflow-engine/convex workflow-engine/ui/js .agents/tools/workflow` and `rg -n 'ctx\.db\.delete' workflow-engine/convex`.

**Writers**
- `jobs.ts:297-310` `start`: `ctx.db.patch(args.id, { status, startedAt, prompt: args.prompt })`. Two callers:
  - `runner.ts:456`: `jobs.start({ id, prompt })`, the built prompt.
  - `cli.ts:721` `startJob`: `jobs.start({ id })` with **no prompt**. Today, patching `prompt: undefined` clears the field.
- Nothing else writes it. `createGroup`/`insertGroupAfter` never set it. `executeRetry` (`jobs.ts:510`) and `retryGroup` (`jobs.ts:585`) leave it as it is.

**Readers** (every one gets the full job doc, so the prompt rides along)
- **Chain walks.** These pay for prompt bytes today and stop paying for new jobs without any edit:
  - `scheduler.findReadyJobs` (`scheduler.ts:97`)
  - `assignments.getChainWithTerminalJobs` (`assignments.ts:137`)
  - `jobs.getActiveGroupsWithJobs`, `jobs.getGroupWithJobs`, `jobs.list`
  - `updateGroupStatus`
- **Single-job reads.**
  - `jobs.get` is used by `reflect.ts:350`, which does not read `prompt`.
  - `jobs.getWithAssignment`: the runner does not read `prompt` from it.
  - `jobs.getWithGroup` has four callers:
    - `reflections.ts:345` dumps `prompt` into `jobs.ndjson`. **This one needs the join.**
    - `runner.ts:1103` (reconcile) does not read `prompt`.
    - `reflect-spawn.ts:138` does not read `prompt`.
    - `cli.ts:289` (`job get`) prints the row, so it needs the shape unchanged.
- **UI.** `JobDetail.js:377` destructures `prompt` from the `job` prop, and `:759-762` renders it in `ContentViewer`. The `job` prop is a snapshot from the chain or group subscriptions. JobDetail is rendered in two places, both for assignment jobs only and both only while the modal is open:
  - `ChatView.js:289`: `selectedJob && …`
  - `JobChain.js:1388`: `showModal && selectedJob && …`

  No other UI file reads `prompt`.

**Deleters of job documents** (exactly three; every other `ctx.db.delete` targets another table)
1. `assignments.ts:357-358` `remove`: per group, `collect` jobs, then `delete(job._id)`.
2. `chatThreads.ts:658-663` `remove`: thread → assignment cascade, same loop.
3. `jobs.ts:566-571` `retryGroup`: downstream groups' jobs. Surviving member jobs are only reset (`:586-607`).

`namespaces.remove` does not cascade.

### B. Target data flow

```
runner.executeJob ──jobs.start({id, prompt})──▶ [one mutation]
                                                  patch jobs[id] {status:"running", startedAt}   (no prompt)
                                                  upsertJobPrompt(jobId, prompt, now)              → jobPrompts
                                                  group/assignment/namespace patches (unchanged)

scheduler.findReadyJobs / chain queries ──▶ read jobs docs only   (no prompt bytes for new jobs)

JobDetail (mounted only while open) ──useQuery(jobs:getPrompt,{id})──▶ readJobPrompt
                                         1. jobPrompts.by_job(jobId).first()  → row? return row.prompt
                                         2. else ctx.db.get(jobId)?.prompt ?? null   (historical/unstarted)

reflections dump ──jobs:getWithGroup──▶ {...job, prompt: resolved, group, assignment}

assignments.remove / chatThreads.remove / retryGroup downstream ──▶ deleteJob(ctx, jobId)
                                         delete every jobPrompts row by_job(jobId), then the job
```

### C. Decisions

**D1. Everything lives in one new module, `workflow-engine/convex/lib/jobPrompts.ts`.** It holds the resolver and the shared delete helper. This follows the `lib/notificationFeed.ts` pattern: only `import type` from `../_generated/*` (so `node:test` loads it with no Convex runtime), ctx narrowed to `Pick<QueryCtx | MutationCtx, "db">`, and tests with a hand-rolled fake `db`. `jobs.ts` was the alternative, but importing it from tests would pull in `convex/server` registration and `_generated/api` runtime. Keeping the prompt's whole lifecycle (write, read, delete) in one file also lets a reviewer see the invariant in one place.

Exports (the contract; names are binding because WP2 is written against them):

```ts
/** Row wins; the legacy loader runs only when no row exists. No I/O of its own. */
export async function resolveJobPrompt(
  row: { prompt: string } | null,
  loadLegacy: () => Promise<string | undefined>,
): Promise<string | null>;

/** by_job lookup, then resolveJobPrompt. Default legacy loader = ctx.db.get(jobId)?.prompt.
 *  Callers that already hold the job doc pass `async () => job.prompt`. */
export async function readJobPrompt(
  ctx: Pick<QueryCtx, "db">,
  jobId: Id<"jobs">,
  loadLegacy?: () => Promise<string | undefined>,
): Promise<string | null>;

/** Insert {jobId, prompt, createdAt: now}, or patch the existing row {prompt, createdAt: now}. */
export async function upsertJobPrompt(
  ctx: Pick<MutationCtx, "db">,
  jobId: Id<"jobs">,
  prompt: string,
  now: number,
): Promise<void>;

/** The ONLY way a job document is deleted: its jobPrompts row(s), then the job. */
export async function deleteJob(ctx: Pick<MutationCtx, "db">, jobId: Id<"jobs">): Promise<void>;
```

**D2. The pure resolver takes an injected legacy loader, not a legacy value.** Criterion 3's load-bearing property is laziness. The job document must **not** be read when a row exists, because reading it adds a document-level dependency that re-fires `getPrompt` on every metric tick of a running job. A sync `pick(row, legacyValue)` would be pure, but the caller would have to fetch the job before calling it, and laziness would become an untested convention at the call site. With a loader, laziness is a tested property of the pure function ("loader called 0 times when row present"). The function stays pure in the sense that matters: it is deterministic and does no I/O of its own. Fallback order:
1. A row exists → return `row.prompt`. Row presence wins, even for `""`.
2. No row → `await loadLegacy()`; return `undefined` as `null`.

**D3. Upsert semantics in `jobs.start`.**
- When `args.prompt !== undefined`, call `upsertJobPrompt` **after** the job status patch. The patch throws on a missing job, so an orphan row is impossible. `start` must upsert, not insert, because a job is started more than once (rate-limit `executeRetry` → re-pend → re-start, and `retryGroup` survivors).
- When `args.prompt === undefined` (`cli.ts job start`), leave `jobPrompts` untouched. This deliberately differs from today's clear-on-undefined patch: nothing new to show beats deleting the last prompt the agent was given. It only affects the manual CLI path. (See Q1.)
- `createdAt` records when the current prompt was written: insert time, refreshed on overwrite.
- The job patch drops `prompt` entirely. It does not write `prompt: undefined`, which would clear historical values: that is a write, and migrations are out of scope.
- Mutation name and args are unchanged (`prompt: v.optional(v.string())` stays). `chatJobs.start` is untouched.

**D4. Uniqueness.** One row per job is guaranteed by the upsert running inside a serializable mutation.
- Reads use `.first()`. They do not use `.unique()`, which would turn a theoretical duplicate into a thrown query (a crashed modal, a failed dump).
- `deleteJob` `.collect()`s all rows by `by_job` and deletes each, so it also cleans up any duplicate. The cost is the same as reading the one row.

**D5. `getPrompt` and `getWithGroup`.**
- `getPrompt` is `query({ password: v.string(), id: v.id("jobs") })`. It calls `requirePassword(args)` and returns `readJobPrompt(ctx, args.id)`, typed `string | null`.
- `getWithGroup` already holds the job doc. It calls `readJobPrompt(ctx, job._id, async () => job.prompt)` and returns `{ ...job, prompt: resolved ?? undefined, group, assignment }`. Mapping `null` to `undefined` keeps the field **absent** (Convex drops `undefined`) for jobs with no prompt. The dump and `cli job get` shapes are then byte-for-byte what they were: present when a prompt existed, absent otherwise.
- Bandwidth for the other `getWithGroup` callers (runner reconcile, reflect-spawn, `cli job get`) is unchanged. They already received prompt bytes inside the job doc.

**D6. A pending job has no row, so `getPrompt` reads the job doc.** This is acceptable and stays inside criterion 3:
- Pending jobs do not tick metrics.
- The `jobs.start` mutation that makes a job tick also inserts its row. That invalidates the `by_job` range read, and the re-run takes branch 1 and drops the job-doc dependency.
- Historical jobs fall back permanently, but they are terminal, so they do not tick.

**D7. How JobDetail degrades.** The modal follows the repo's loading vocabulary and makes three explicit render states:
- Call `useQuery(api.jobs.getPrompt, { id: _id })` unconditionally at the top of `JobDetail` (hooks rule).
- JobDetail is mounted only while the modal is open (see A), so the subscription exists only while open. No `skip` plumbing is needed, and the hook unsubscribes on unmount.
- Derive the state:
  - `error` is truthy → **empty**. Render nothing for the prompt section, exactly as today when `prompt` is falsy (`ContentViewer` returns `null`).
  - `loading && !error` → **loading**: the `Prompt` label, then `LoadingSkeleton` (shared primitive, `variant: 'text'`, a few lines), in a wrapper with `aria-busy="true"`.
  - Otherwise → `ContentViewer({ content: data, label: 'Prompt' })`. A `null` data value renders nothing.
- Missing function: when the UI deploys before Convex, `ConvexClient.onUpdate` calls the hook's `onError` ("Could not find public function"). The hook sets `error` and logs `console.error`, so the UI shows the **empty** state and nothing throws. Every `useQuery` call already relies on this channel.
- Remove `prompt` from the `job` destructure. No UI file reads `job.prompt`.
- No new modal, toast or retry affordance. A prompt that cannot be fetched is a gap in a visibility artefact, not an error the user must act on.

**D8. Codegen.**
- Run `cd workflow-engine && npm run generate` (`convex codegen`). This is the only permitted Convex command. It generates types locally and pushes nothing.
- Expected diff: `_generated/api.d.ts` gains `import type * as lib_jobPrompts from "../lib/jobPrompts.js";` and the matching `"lib/jobPrompts": typeof lib_jobPrompts` entry. `dataModel.d.ts` derives from the schema and may not change at all. `api.js` is `anyApi` and does not change.
- If codegen fails for environmental reasons (auth or network on deployment selection), **do not try any other Convex command**. Hand-edit `api.d.ts` to mirror the existing `lib_*` entries (precedent: `67437faf`) and say so in the job result.

**D9. Known limit (not fixed, no regression).** `assignments.remove` and `chatThreads.remove` still read every prompt of the chain being deleted:
- before this change, through the job docs;
- after it, through `deleteJob`'s `by_job` read.

A very large chain (about 140+ started jobs at ~110 KB each) therefore still cannot be deleted in one mutation. This is the status quo, and deletion is not the hot path. Recorded in §6d and Q3.

---

## Dependency Map

```
WP1 (backend: schema, lib, jobs/assignments/chatThreads, codegen)
WP2 (UI: api.js + JobDetail)            ── depends on WP1 only through the contract in D1/D5 (`jobs:getPrompt`)
WP3 (doc: bandwidth spec §6d)           ── independent
```

In principle all three can run in parallel, because the contract is fixed above and their files are disjoint. **Recommendation: do not parallelise.** The crew shares one working tree and one single-flight validate CLI. A parallel implementer's half-finished edit would fail its sibling's `ts:check` or `build` gate and cause false blame and thrash. The whole diff is about 200 lines. One implement job running WP1 → WP2 → WP3 in order and validating once at the end is cheaper and safer.

---

## Work Packages

Vertical-slice note: the user-visible slice is "open a job → see its prompt". Under self-surgery the crew cannot exercise it live. Each WP is therefore proven statically (unit tests, types, build gate, grep), and the live readback belongs to the Steward after deploy.

### WP1: Backend side table, resolver, single delete helper, codegen

> **Hard constraints — this is self-surgery (`mental-model.md#mm-self-surgery`)**
> Every crew member on this assignment is a job running inside the runner, subscribed to the Convex deployment being edited. Therefore:
> - NEVER start, stop or restart the runner. It would kill your own process.
> - NEVER run `convex dev`, `convex deploy`, or any command that pushes functions/schema to ANY Convex deployment (dev or prod). The only permitted Convex command is the local `convex codegen` script.
> - NEVER exercise the workflow loop end to end, insert test jobs, or run e2e/UAT. No `uat` job is to be inserted on this assignment; the PM routes review from code only.
> - Review is static: reviewers verify by tracing the write path, the fallback order, the single delete helper and its three call sites, and the UI degrade path. Validation is the validate CLI and nothing else.
> - Deploy (Convex, then readback) and live verification of the modal belong to the Steward after this chain completes. No runner restart is needed because the runner is untouched; do not route one.

Files:
- `workflow-engine/convex/schema.ts`
  - Add `jobPrompts: defineTable({ jobId: v.id("jobs"), prompt: v.string(), createdAt: v.number() }).index("by_job", ["jobId"])`.
  - Put a comment carrying `@see docs/project/spec/mental-model.md#mm-prompt-is-visibility-artefact` at the table.
  - Re-comment `jobs.prompt` as legacy/historical only. Never written; new prompts live in `jobPrompts`. Keep it `v.optional(v.string())`.
- `workflow-engine/convex/lib/jobPrompts.ts` (new): the four exports in D1, with the semantics in D2–D4.
- `workflow-engine/convex/lib/jobPrompts.test.ts` (new): TDD, written first. Header `Run with: npx tsx --test workflow-engine/convex/lib/jobPrompts.test.ts`. Use the fake-ctx style of `notificationFeed.test.ts`. Required cases:
  - `resolveJobPrompt`:
    - row present → `row.prompt`, and the loader is called **0 times**;
    - row present and legacy present → row wins;
    - row `{prompt: ""}` → `""`, and the loader is not called;
    - no row and legacy string → legacy;
    - no row and legacy `undefined` → `null`.
  - `readJobPrompt`:
    - queries `jobPrompts` with index `by_job`, `eq("jobId", id)`;
    - when the row exists, `db.get` is **never** called (the document-dependency invariant);
    - when there is no row, `db.get(jobId)` is called once and returns `.prompt`;
    - a missing job → `null`;
    - an injected loader is used instead of `db.get`.
  - `upsertJobPrompt`:
    - no row → one `insert("jobPrompts", {jobId, prompt, createdAt: now})`;
    - row exists → one `patch(row._id, {prompt, createdAt: now})` and no insert.
  - `deleteJob`:
    - deletes every `by_job` row, then the job id;
    - no row → deletes only the job;
    - never touches any other id.
- `workflow-engine/convex/jobs.ts`
  - `start`: remove `prompt` from the job patch, then `if (args.prompt !== undefined) await upsertJobPrompt(ctx, args.id, args.prompt, now)` immediately after the patch. Args unchanged.
  - New `getPrompt` query next to `get`/`getWithGroup` (D5).
  - `getWithGroup`: join `prompt` (D5).
  - `retryGroup`: the downstream loop calls `deleteJob(ctx, j._id)`. Update the header comment ("Preserves prompt/…") to say surviving member jobs keep their `jobPrompts` row, which is overwritten on their next start.
- `workflow-engine/convex/assignments.ts` `remove`: `await deleteJob(ctx, job._id)` in place of `ctx.db.delete(job._id)`. Keep the `jobsDeleted` count.
- `workflow-engine/convex/chatThreads.ts` `remove`: same substitution in the assignment cascade.
- `workflow-engine/convex/_generated/*`: `cd workflow-engine && npm run generate` (D8).

Success criteria:
1. `rg -n 'ctx\.db\.delete' workflow-engine/convex --glob '!_generated'`: the only call whose target is a `jobs` id is inside `lib/jobPrompts.ts` `deleteJob`. Every other remaining call targets groups, assignments, chatJobs, chatMessages, threads, namespaces or jobPrompts.
2. `rg -n 'deleteJob\(' workflow-engine/convex` shows exactly three call sites: `assignments.ts`, `chatThreads.ts`, `jobs.ts retryGroup`.
3. `jobs.start`'s job patch has no `prompt` key. `chatJobs.ts` has no diff.
4. `getPrompt` reaches `ctx.db.get` only through the resolver's no-row branch, and the unit test proves it.
5. `git diff --stat` contains none of: `scheduler.ts`, `chatJobs.ts`, `.agents/tools/workflow/runner.ts`, `.agents/tools/workflow/cli.ts`. `getChainWithTerminalJobs` and `getActiveGroupsWithJobs` have no hunk.
6. `_generated/api.d.ts` contains `lib_jobPrompts`.
7. The new test file passes under the validate `test` gate, which already globs `workflow-engine/convex/lib/*.test.ts`.

### WP2: JobDetail lazy prompt fetch with a graceful degrade

> **Hard constraints — this is self-surgery (`mental-model.md#mm-self-surgery`)**
> Every crew member on this assignment is a job running inside the runner, subscribed to the Convex deployment being edited. Therefore:
> - NEVER start, stop or restart the runner. It would kill your own process.
> - NEVER run `convex dev`, `convex deploy`, or any command that pushes functions/schema to ANY Convex deployment (dev or prod). The only permitted Convex command is the local `convex codegen` script.
> - NEVER exercise the workflow loop end to end, insert test jobs, or run e2e/UAT. No `uat` job is to be inserted on this assignment; the PM routes review from code only.
> - Review is static: reviewers verify by tracing the write path, the fallback order, the single delete helper and its three call sites, and the UI degrade path. Validation is the validate CLI and nothing else.
> - Deploy (Convex, then readback) and live verification of the modal belong to the Steward after this chain completes. No runner restart is needed because the runner is untouched; do not route one.

Files:
- `workflow-engine/ui/js/api.js`: add `getPrompt: "jobs:getPrompt"` under `jobs`, with a one-line comment in the file's style ("Lazy prompt fetch for the job detail modal").
- `workflow-engine/ui/js/components/job/JobDetail.js`, per D7:
  - Import `useQuery` from `../../hooks/useConvex.js`, `api` from `../../api.js`, and `LoadingSkeleton` from `../shared/LoadingSkeleton.js` (or the shared index).
  - Remove `prompt` from the `job` destructure.
  - Call the hook unconditionally.
  - Replace the `// Prompt` block (`:758-762`) with the three-state render.

Success criteria:
1. `rg -n 'prompt' workflow-engine/ui/js` returns only the `api.js` registration and the `getPrompt`/derived-state lines in `JobDetail.js`. There is no `job.prompt` and no destructured `prompt` from `job`.
2. Static trace of the degrade path:
   - `useQuery` `onError` → `error` set → the prompt section renders `null`, and no `throw` is reachable.
   - `loading` → a skeleton labelled `Prompt` with `aria-busy`.
   - `data === null` → nothing.
   - a string → `ContentViewer`.
3. The hook lives in `JobDetail`, which only mounts while the modal is open (`ChatView.js:289`, `JobChain.js:1388`). No subscription is added to any always-mounted component.
4. The validate `build` gate (`node --check` over `ui/js/**`) passes.

### WP3: Bandwidth spec §6d

> **Hard constraints — this is self-surgery (`mental-model.md#mm-self-surgery`)**
> Every crew member on this assignment is a job running inside the runner, subscribed to the Convex deployment being edited. Therefore:
> - NEVER start, stop or restart the runner. It would kill your own process.
> - NEVER run `convex dev`, `convex deploy`, or any command that pushes functions/schema to ANY Convex deployment (dev or prod). The only permitted Convex command is the local `convex codegen` script.
> - NEVER exercise the workflow loop end to end, insert test jobs, or run e2e/UAT. No `uat` job is to be inserted on this assignment; the PM routes review from code only.
> - Review is static: reviewers verify by tracing the write path, the fallback order, the single delete helper and its three call sites, and the UI degrade path. Validation is the validate CLI and nothing else.
> - Deploy (Convex, then readback) and live verification of the modal belong to the Steward after this chain completes. No runner restart is needed because the runner is untouched; do not route one.

File: `docs/project/spec/convex-bandwidth-optimization.md`. Insert `**6d. Prompt bytes leave the chain.**` directly after the 6c paragraph and before the section's `**Impact:**` line. Content (prose, 1–2 short paragraphs plus a rule line):
- **6c's assumption failed.** 6b short-circuits only while a group is *running*. Whenever no group is running and some group is pending, which happens at every group transition, `findReadyJobs` walks head → first pending group and `collect()`s every job document, and the walk re-runs reactively. Every started job carried its ~100–120 KB prompt, so the read grew linearly with chain length.
- **The 16 MiB per-query read limit.** A 192-job chain crossed it. The runner subscription errored and `cleanup()` killed every running job in the namespace, chats included.
- **The fix.** Prompts live in `jobPrompts` (one row per job, `by_job`). `jobs.start` writes them. `jobs.getPrompt` (job detail modal) and `jobs.getWithGroup` (single-job reads) read them. `jobs.prompt` stays optional for historical rows, is never written, and is not migrated.
- **The rule, stated plainly:** *`jobPrompts` is read by id, never joined in a chain walk.* Cite `mental-model.md#mm-prompt-is-visibility-artefact`.
- **The known limit.** Deleting a chain still reads one prompt row per started job, so very large chains can hit the same limit in `assignments.remove` and the thread cascade. This is unchanged from before.

Success criteria: §6d sits between 6c and **Impact**. It covers all five bullets. No other section of the doc changes.

---

## Assignment-Level Success Criteria

These map 1:1 to the north star's eleven criteria.

1. `schema.ts` has `jobPrompts { jobId: v.id("jobs"), prompt: v.string(), createdAt: v.number() }` with `.index("by_job", ["jobId"])` and the `#mm-prompt-is-visibility-artefact` cite. `jobs.prompt` is still `v.optional(v.string())`.
2. `jobs.start` upserts into `jobPrompts` in the same mutation as the status flip, and its job patch has no `prompt`. Name and args are unchanged. `chatJobs.ts` has no diff.
3. `jobs.getPrompt({ password, id })` returns `string | null`. It reads `jobPrompts.by_job` first and the job doc only when no row exists (WP1 tests prove the laziness).
4. `lib/jobPrompts.ts` `resolveJobPrompt` is pure and tested in `lib/jobPrompts.test.ts` (`node:test`, `npx tsx --test`).
5. `jobs.getWithGroup` returns `prompt` resolved with the same fallback. The field is absent when there is no prompt, so the dump shape is unchanged. `reflections.ts` has no diff.
6. `deleteJob` in `lib/jobPrompts.ts` is the only job-delete path. It is called from `assignments.remove`, `chatThreads.remove` and the `jobs.retryGroup` downstream cascade. Retried-group survivors are not deleted.
7. `JobDetail.js` fetches through `api.jobs.getPrompt`, registered in `api.js`, only while open. It has a loading skeleton, and a missing or erroring query renders an empty prompt section. Grep confirms no other UI `prompt` reads.
8. `_generated/*` is regenerated with `npm run generate` (or hand-mirrored per D8, which must then be reported).
9. `scheduler.ts`, `runner.ts`, `getChainWithTerminalJobs` and `getActiveGroupsWithJobs` are unmodified.
10. `convex-bandwidth-optimization.md` §6d is present per WP3.
11. `npx tsx .agents/tools/validate/cli.ts` → `"ok": true` (lint, ts:check, ts:workflow, test, build).

---

## Ambiguities / Decisions Needed

None block the work. Each item below has a recommended default that the plan already follows. The PM can ratify them as Decisions.

- **Q1. `jobs.start` without a prompt (CLI `job start`).** Default (D3): leave `jobPrompts` untouched. Today's behaviour clears `jobs.prompt`. The difference is only visible on the manual CLI path, after a job that had a prompt is restarted by hand. Copying the clear would mean deleting the row: more code for a path nobody uses in the loop.
- **Q2. Historical jobs that are retried keep their stale `jobs.prompt` bytes.** Clearing them on the next `start` would be a write to `jobs.prompt` and a quiet partial migration, so this plan does not do it. The new row wins on read, so the modal is correct. Old chains still carry old bytes, which is accepted: the user will not revive them.
- **Q3. The Steward should know before deleting the 192-job assignment.** `assignments.remove` (and a thread delete that cascades to it) `collect()`s every job doc in that chain, prompts included. It can hit the same 16 MiB read limit before and after this change. If the Steward wants it gone, they may need to delete it in pieces or leave it parked. This is out of scope here; flagged so it does not surprise anyone.
- **Q4. The deploy window, for the Steward's readback.**
  - Convex deploys first. Until the UI deploys, the old UI reads `job.prompt` from the chain snapshot, so **new** jobs show no prompt section, while historical ones still show theirs.
  - The UI deploys second. From then on, every job resolves through `getPrompt`.
  - If the UI went out first, D7's error path renders an empty section.

  Readback checklist for the Steward:
  1. Open a job started after the deploy: the prompt shows (it comes from `jobPrompts`).
  2. Open a historical job: the prompt shows (it comes from the `jobs.prompt` fallback).
  3. `npx tsx .agents/tools/workflow/cli.ts job get <id>`: `prompt` is still present.

---

## Recommended Job Sequence

1. **implement** (single job): WP1 → WP2 → WP3 in order, TDD for WP1 (`lib/jobPrompts.test.ts` first), then `npm run generate`, then one validate run. Paste the Hard constraints block into the brief verbatim.
2. **review** (normal fan-out, static only). Brief reviewers to trace:
   - the `start` write path (patch with no prompt, upsert after it);
   - the fallback order and laziness in `resolveJobPrompt`/`readJobPrompt`;
   - `deleteJob` and exactly three call sites, with no leftover `ctx.db.delete(j|job._id)`;
   - the JobDetail degrade states;
   - the criterion-9 untouched list, via `git diff --stat`;
   - §6d placement.

   The Hard constraints block goes into this brief too.
3. **pm** → complete. **No `uat` job** and no runner restart. Hand over to the Steward for the Convex deploy, the UI deploy and the Q4 readback.

If review knocks back findings, run one implement-fix round, then re-review. Edges outside the eleven criteria (field-level projections, migrating historical prompts, moving `result` off the walk, chunked chain deletion) are out of scope by the north star and should be clamped, not hardened.
