# Guardian Convergence Checkpoints + Verbatim Notifications (Spec)

Phase: `22-GuardianCheckpointsVerbatimNotify`
Status: IMPLEMENTED in git (`d6ad6158`, 2026-10-15); awaiting owner cutover. Convex is not deployed and the runner has not been restarted. Cutover is owner-only, at an idle boundary (no PM group or guardian chat job in flight): deploy Convex **first**, then restart the runner **immediately** (see §"Live-vs-memory map" and P2). Owner follow-ups: §"Owner follow-ups".
Why-layer: `docs/project/spec/mental-model.md` → "The Machine — Roles and What Each Layer Deliberately Lacks" (Guardian bullet), "Session Routing", "Mid-Flight Assignment Modification", "Hands-Free Voice Loop (Mobile)". These were tuned in jam to this intent. Settled there and in the north star, **not relitigated here**: Guardian wakes at convergence checkpoints (every third completion-review knock-back) and at the final assessment; PM reports between checkpoints never reach the fork; notifications are the message verbatim, truncated at ~5k chars, for every Steward message in any mode or harness when the global toggle is on.

External research: skipped deliberately. This is repo-internal refinement on an existing engine. Every choice is constrained by in-repo patterns (pure `lib/` modules + `node:test`, Convex `by_group` / chain walks, the validate gate config). There is no greenfield technology decision to put through a matrix.

Mental-model headings carry no `{#mm-…}` slugs today, so code citations reference the section by heading text, e.g. `@see docs/project/spec/mental-model.md § The Machine (Guardian)`.

---

## Self-surgery constraint (HARD, applies to every job in this chain)

This assignment edits the runner that is executing it.

- **Never start, restart, kill, or run the runner** (`runner.ts`, `run-runner.sh`). The owner restarts it after deploying.
- **Never deploy Convex**, prod or dev, by any command (`convex deploy`, `convex dev`, `npx convex …`). Convex edits do nothing until the owner deploys. The `ts:check` gate is the proof.
- **No `uat` jobs.** Code review is fine. Proof is the validate gates plus cold unit tests.
- **`.agents/tools/workflow/cli.ts` is out of scope and must not be edited.** tsx recompiles it on every crew invocation, so a bad save breaks job insertion immediately.
- **Lib modules imported by `cli.ts` are live as well:** `lib/harness-defaults.ts`, `lib/collapse-fanout.ts`, `lib/engine-version.ts`, `lib/coverage-merge.ts`, `lib/attachments.ts`. Do not edit them in this assignment. WP1's test-fixture fix touches `lib/collapse-fanout.test.ts`, which `cli.ts` does not import, so that edit is safe.
- **Never `git stash`.**
- Expected side effects while this lands, which nobody should work around: (1) notifications stop once `notify-spawn.ts` is deleted; (2) guardian prompts show literal `{{CHECKPOINT_ROUND}}`-style placeholders once they are added to `product-owner.md`. See §"Live-vs-memory map".

---

## Purpose

**Guardian.** Guardian mode has gone unused. Every PM report went into the guardian fork, and each one was too incremental to show a pattern, so drift was never caught. The owner's manual workaround is to paste the latest PM response into the Steward after the third completion-review knock-back and ask "converging, or thrashing on the wrong thing?". This assignment automates that cadence. Guardian wakes only at those checkpoints and at the final assessment. Each wake carries the round number, the completion-review count, and a one-line chain shape, so a single turn can judge convergence.

**Notifications.** Today every Steward reply forks the thread's session and runs a full agent pass to re-author a "listenable" copy. The owner does not use read-aloud. The alert and its preview are the product. The new design posts the message verbatim from the runner, with no child process and no agent run.

**Runner typecheck.** `runner.ts` and its spawn scripts have never been typechecked. This is self-surgery that cannot be exercised live, so a TypeScript gate is the only compile-level proof that the new runner will start.

---

## Overview

Four work packages:

| WP | Delivers | Lands |
|---|---|---|
| WP1 | `tsconfig.typecheck.json` for `.agents/tools/workflow` + `ts:workflow` validate gate; fix the 5 pre-existing errors outside `cli.ts` | first |
| WP2 | Guardian convergence checkpoints: pure decision module, lean Convex chain-shape query, `chatJobs.trigger` checkpoint payload, prompt placeholders, runner thin dispatch, completion-thread preference, blocked guard | after WP1 |
| WP3 | Verbatim notifications: server-side toggle in `notifications.post`, runner posts from `saveChatResponse`, deletions | after WP1 (parallel with WP2; see runner.ts region ownership) |
| WP4 | Docs: rewrite notification paragraphs (engine-spec, north-star-lifecycle) and per-PM guardian claims (guardian-mode-spec, system-diagram) | after WP2+WP3 |

---

## Architecture Design

### A. Current flow (traced end to end, `runner.ts` at HEAD `ebd09859`)

```
executeJob.onComplete/onFail/onTimeout (crew/PM job)
  → jobs.complete|fail → res.groupCompleted
  → handleGroupCompletion(group, assignment)              runner.ts:628
      getGroupWithJobs → hasPMJob?
        yes → triggerGuardianEvaluation(assignment, pmResult)      ← EVERY PM (removed)
              if !nextGroupId → checkAndCompleteAssignment(…)
                   listGroups → none pending/running → assignments.complete
                   → triggerCompletionSummary → getCompletionThread (jam/cook only)
        no  → nextGroupId? scheduler : triggerPMGroup

executeChatJob.onComplete  → chatJobs.complete → saveChatResponse → save session
                           → maybeSpawnNotification (claude + jam/cook + sessionId only)
                               → spawn notify-spawn.ts → claude --fork-session → notify.ts
executeChatJob.onFail/onTimeout → chatJobs.fail → saveChatResponse(partial, hint)  (no notify)
executeJob (legacy isChatJob path) → saveChatResponse ×3                            (no notify on fail)
```

Defects the target design removes:
- The per-PM guardian trigger. This is the boiling-the-frog problem.
- Notifications fire only on success, only for claude, and never in guardian mode.
- Every notification costs a full agent run.
- **Latent bug:** a PM that blocks the assignment and inserts no next group falls into `checkAndCompleteAssignment` and gets auto-completed. Nothing checks status.

### B. Target flow

```
handleGroupCompletion — PM branch (thin dispatch)
  chain  = query assignments.getChainShape({ id })            // one round trip, lean
  wake   = decideGuardianWake(chain, group._id)               // pure, lib/guardian-checkpoint.ts
  switch wake.kind
    "final"      → checkAndCompleteAssignment(…)               // existing flow + blocked guard
                     → triggerCompletionSummary → getCompletionThread (guardian ▸ jam/cook)
    "checkpoint" → triggerGuardianEvaluation(assignment, pmResult, wake.checkpoint)
                     → getGuardianThread → chatMessages.add(role "pm")
                     → chatJobs.trigger({ isGuardianEvaluation, checkpoint })
    "none"       → log only. No guardian message, no chat job.

saveChatResponse(threadId, content, { hint?, failed? })        // the ONE save path
  → chatMessages.add(…)                                         // unchanged
  → after chatMessages.add succeeds: notifications.post({ threadId, body: composeNotificationBody(…) })
       server: audio toggle off → return null (no row); on → insert, body sliced to 5000
       runner: best-effort, own try/catch, never affects chat
```

### C. Guardian checkpoint decision module: `.agents/tools/workflow/lib/guardian-checkpoint.ts` (new, pure)

```ts
export const CHECKPOINT_INTERVAL = 3;

/** One group in chain order (headGroupId → nextGroupId). jobTypes in stored job order. */
export interface ChainGroup {
  _id: string;
  jobTypes: string[];
}

export interface GuardianCheckpoint {
  round: number;             // completionReviews / CHECKPOINT_INTERVAL  (1, 2, …)
  completionReviews: number; // completion-review groups in chain[0 .. predecessor]
  chainShape: string;        // formatChainShape(chain[0 .. completed PM group])
}

export type GuardianWake =
  | { kind: "final" }
  | { kind: "checkpoint"; checkpoint: GuardianCheckpoint }
  | { kind: "none" };

export function isCompletionReviewGroup(group: ChainGroup): boolean;
export function formatChainShape(groups: readonly ChainGroup[]): string;
export function decideGuardianWake(
  chain: readonly ChainGroup[],
  completedPmGroupId: string
): GuardianWake;
```

Rules, in this order:
1. `idx = chain.findIndex(g => g._id === completedPmGroupId)`. If `idx === -1 || !chain[idx].jobTypes.includes("pm")`, return `none`.
2. **Final first.** If `idx === chain.length - 1` (the PM inserted no next group), return `final`. A finished assignment never gets a checkpoint.
3. The predecessor is `chain[idx - 1]`, found by chain position, never by creation time. If there is no predecessor, or `!isCompletionReviewGroup(pred)`, return `none`.
4. `completionReviews` = count of `isCompletionReviewGroup` over `chain[0..idx-1]`. If `completionReviews === 0 || completionReviews % CHECKPOINT_INTERVAL !== 0`, return `none`.
5. Otherwise return `checkpoint { round: completionReviews / 3, completionReviews, chainShape: formatChainShape(chain.slice(0, idx + 1)) }`.

`isCompletionReviewGroup`: `jobTypes` contains `"review"` **and** `"document"`. Matching is exact, against the Job Type Catalog. A `uat` alongside them does not change the result.

`formatChainShape`: groups joined by `" "`. Within a group, the job letters are joined by `"+"` in stored order. Letters: `plan→P, pm→M, implement→I, review→R, uat→U, document→D`. An unknown type maps to its first character uppercased. The shape covers the chain **up to and including the completed PM group**. The PM's freshly inserted next group is excluded, because it hasn't run yet and the PM report already describes it. This reproduces the north star example exactly: `P M I M R+R+R+D M I M R+R+R+D M I M R+R+R+D M`.

**Required unit tests** in `lib/guardian-checkpoint.test.ts`, which the existing `test` gate already globs. "CR" means `R+R+R+D`.

| # | Fixture (chain shape) | Assertion |
|---|---|---|
| 1 | Seven-round thrash: `P M I M` + 7 × `(R+R+R+D M I M)` | Iterate every PM group. Exactly two checkpoints: the PM after CR #3 → `{round 1, completionReviews 3, chainShape "P M I M R+R+R+D M I M R+R+R+D M I M R+R+R+D M"}`; the PM after CR #6 → round 2, count 6. The tail M → `final`. Every other PM → `none` (PMs after CR #1, #2, #4, #5, #7 and non-tail PMs after `I`). Also evaluate the prefix through CR #3's reacting PM plus a newly inserted `I` tail: it yields the same checkpoint as evaluating that PM in the full seven-round chain, proving future CRs are not counted. |
| 2 | Three rounds then pass: `P M I M` + 2 × `(R+R+R+D M I M)` + `R+R+R+D M` | The tail PM after CR #3 → `final`, not checkpoint (finality beats checkpoint). |
| 3 | Trailing document-only group: take the row 2 chain and append `D M`; also test that chain with `I` appended | In both variants the PM after CR #3 → checkpoint round 1. The PM after the lone `D` → `final` in the first variant and `none` in the second. Also insert the lone `D` directly between CR #3 and its reacting PM, then append `I`: that PM → `none` because its immediate predecessor is document-only, despite the count being 3. The `D`-only group never counts. |
| 4 | Implement straight into review, no PM between: `P M I R+R+R+D M I R+R+R+D M I R+R+R+D M I` | The PM after the third CR → checkpoint round 1, count 3. |
| 5 | Chain ends on a non-PM group: `… CR#3 M I` (completed PM is not the tail) | Checkpoint round 1, not final. Also pass the tail `I` group id: returns `none` (non-PM group never triggers final or checkpoint). |
| 6 | Mid-assignment reviews without document: `P M I M R+R M I M R+R M I M R+R M I`; plus a variant interleaving these groups between actual CRs | Every PM in the first chain → `none`. In the mixed variant only actual CRs advance the count; checkpoints still occur at CR #3 and #6, never at a PM reacting to `R+R`. |
| 7 | Edge: completed id not in chain | `none`. |
| 8 | `formatChainShape` | Letter map, `+` joining, unknown-type fallback, empty chain → `""`. |

Build fixtures with a tiny shape-parser helper in the test file (e.g. `chain("P M I M R+R+R+D M")` → `ChainGroup[]` with ids `g0…gN`) so the tables above read verbatim.

The query must preserve link order even when creation order differs: `insertGroupAfter` creates a newer group pointing to the older successor (`workflow-engine/convex/jobs.ts:259-286`). Include a cold query fixture with that ordering; sorting groups by creation time would fail it. Rows 4 and 5 deliberately have a non-PM tail, so the completed PM is not final. `completedPmGroupId` is a PM id supplied by the runner's existing `hasPMJob` branch; the module need not infer job completion status.

### D. Convex: lean chain-shape query (new) — `workflow-engine/convex/assignments.ts`

```ts
export const getChainShape = query({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (!assignment) return [];
    const groups: { _id: Id<"jobGroups">; jobTypes: string[] }[] = [];
    // walk headGroupId → nextGroupId (chain order, never creation time)
    // per group: jobs via withIndex("by_group") → map(j => j.jobType)
    // guard: stop on a revisited id
    return groups;
  },
});
```

- Return shape: `Array<{ _id, jobTypes: string[] }>` only. No results, statuses, or aggregated text in the payload. This is one round trip.
- `getChainWithTerminalJobs` is **not** used or changed. It serves the UI archive tier and ships full job documents.

### E. Convex: `chatJobs.trigger` checkpoint payload — `workflow-engine/convex/chatJobs.ts`

Additive optional arg:

```ts
checkpoint: v.optional(v.object({
  round: v.number(),
  completionReviews: v.number(),
  chainShape: v.string(),
})),
```

It is copied into the stored chat context as `...(args.checkpoint ? { checkpoint: args.checkpoint } : {})`. Nothing else in `trigger` changes. Session routing is untouched, so a guardian eval still resolves the per-assignment fork, or forks the OG session on first use.

### F. Convex: completion-thread preference — `workflow-engine/convex/chatThreads.ts`

`getCompletionThread` keeps the same signature and the same `by_assignment` index. It collects the threads linked to the assignment and returns the **guardian** thread if one exists, otherwise the jam/cook thread, otherwise `null`. Update the comment above it. The runner's `triggerCompletionSummary` is unchanged apart from its log text, and it keeps a single lookup. Putting the preference in Convex keeps it out of the runner and avoids a second query.

**Verified guardian completion route; preserve it, do not add a second routing mechanism.** `chatJobs.trigger` resolves sessions from thread mode, independently of `isCompletionSummary`: a linked guardian thread resumes `guardianSessions[assignmentId]`, or forks `claudeSessionId` on first use (`chatJobs.ts:71-83`). Stored context retains `mode: "guardian"`, `effectivePromptMode: "cook"`, `assignmentId`, and `isCompletionSummary: true` (`:85-100`). The runner forwards `forkSession` (`runner.ts:874-875`) and saves a successful returned session to the guardian map using the stored context (`:907-914`), leaving the OG session alone. With neither session present it starts fresh and still saves into that map. `determinePromptType` checks completion before guardian evaluation and before new-session handling (`lib/prompts.ts:319-333`); `buildChatPrompt` selects only `COMPLETION_SUMMARY` and injects the PM report once (`:407-420`). No additional production session-routing or prompt-selection change is needed. Add the guardian-mode prompt regression in §G.

### G. Prompts: `lib/prompts.ts` + `templates/product-owner.md`

- `ChatJobContext` gains `checkpoint?: GuardianCheckpoint`, a type-only import from `./guardian-checkpoint.js`.
- `buildChatPrompt`'s `replaceVars` gains:
  - `{{CHECKPOINT_ROUND}}` → `String(checkpoint.round)`
  - `{{COMPLETION_REVIEWS}}` → `String(checkpoint.completionReviews)`
  - `{{CHAIN_SHAPE}}` → `checkpoint.chainShape`
  - When `checkpoint` is absent, each renders `(n/a)`. This includes guardian evals triggered by the old runner (including against new Convex), old queued contexts, and direct triggers without the optional payload. Ordinary guardian user messages and completion summaries also lack it but select other template sections.
- `determinePromptType` is unchanged. A checkpoint eval is still `guardian_eval`.
- `templates/product-owner.md`: add **only** the three placeholders to the `GUARDIAN_MODE` section, directly under the existing `**Assignment ID:** {{ASSIGNMENT_ID}}` line and in the same metadata form:
  ```
  **Checkpoint round:** {{CHECKPOINT_ROUND}} · **Completion reviews:** {{COMPLETION_REVIEWS}}
  **Chain shape:** `{{CHAIN_SHAPE}}`
  ```
  Do not change any other line of that section. The prose belongs to the owner (see Q1).
- Tests in `lib/prompts.scenario.test.ts`:
  - A guardian eval with a checkpoint renders all three values, and no `{{CHECKPOINT_`, `{{COMPLETION_REVIEWS}}`, or `{{CHAIN_SHAPE}}` text remains.
  - Without a checkpoint, the prompt renders `(n/a)`.
  - A jam prompt is byte-identical with or without a checkpoint present.
  - A completion summary in guardian mode selects `completion_summary` and renders the final PM report exactly once, without guardian-evaluation prose or checkpoint placeholders. Cover existing-fork, first-fork, and session-less contexts; completion wins even if `isGuardianEvaluation` is also true. Keep the existing cook completion test.

### H. Runner thin dispatch (`runner.ts`, WP2 region)

- `handleGroupCompletion` PM branch becomes exactly: compute `pmResult` (unchanged) → query `getChainShape` → `decideGuardianWake` → three-way dispatch. Remove the unconditional `triggerGuardianEvaluation` call. Do not gate it. The `!currentGroup.nextGroupId` test moves into the module's `final` rule.
- `triggerGuardianEvaluation(assignment, pmResult, checkpoint)` passes `checkpoint` to `chatJobs.trigger`. The rest of its body is unchanged.
- **Status guard lives in the mutation (D6, resolves P1).** `assignments.complete` (`convex/assignments.ts:240-256`; the runner is its only caller) refuses inside its transaction when the assignment is `"blocked"`: no patch, no count change, return `{ completed: false, status: "blocked" }`. Otherwise it behaves as today and returns `{ completed: true }`; an already-`complete` status still returns `completed: true` (the PM ran `update-assignment --status complete`), so the summary fires. Missing assignment → `{ completed: false, status: null }`. `checkAndCompleteAssignment` adds **no** separate status read: it checks the return value, and when `completed` is false it logs and returns without `triggerCompletionSummary`. Args are unchanged and the return is additive, so the old runner on new Convex simply ignores it. Add cold handler tests under `convex/lib/` with an in-memory fake ctx: blocked → refused, untouched, counts untouched; active → completed + counts adjusted; already complete → `completed: true`, counts untouched. Extract the decision into a pure helper there if that makes the test cleaner.
- If `decideGuardianWake` returns `none` because the completed PM group id is not in the chain, the runner logs a one-line warning (it should never happen). The module stays pure; the warning is the only addition.
- Preserve the `res.groupCompleted` gates in every caller. Those tokens, not `assignments.complete`, prevent duplicate group-completion side effects (`convex/jobs.ts:355-381,398-420`; `runner.ts:531-536,567-568,611-612`). `assignments.complete` avoids a second count adjustment but still writes `updatedAt` on every call (`convex/assignments.ts:244-254`). The PM's earlier status update must therefore not suppress the single summary owned by the terminal callback. This is once per group finalization under successful calls, not a durable retry/delivery guarantee.
- The in-transaction guard closes the read/complete race a separate runner read would leave open, and it removes a round trip.
- If `getChainShape` throws, the error propagates to the existing `onComplete`/`onFail` catch. That is the same failure class as today's `listGroups` call in the same path. Add no new fallback logic.

### I. Notifications: verbatim post

**Convex (`settings.ts`, `notifications.ts`):**
- Extract `readAudioNotifications(ctx)`, a plain helper in `settings.ts`. `getAudioNotifications` and `notifications.post` both use it.
- `notifications.post`: once password and thread are validated, if the toggle is off, return `null` (no insert). The body contract is `args.body.slice(0, MAX_BODY_CHARS)` and nothing else. Remove the trim and the empty-body throw (D5). Title composition (`"<namespace> · <thread title>"`), the schema, `feed`, and `markDelivered` are unchanged.
- Remove the now-redundant server-local `prepareBody` helper too (`convex/notifications.ts:9-17`); use the slice directly. There are currently no Convex notification mutation tests: `convex/lib/` tests cover attachments and group transitions, while the body/feed tests are in workflow `lib/notify-lib.test.ts`. Add cold mutation-handler tests using an in-memory fake context (no live Convex): toggle absent/false/malformed → `null` and zero inserts; true → one insert; empty, whitespace, markdown, and over-5000 bodies preserve exactly the slice contract; title and row fields stay unchanged. These tests belong under `convex/lib/` so the existing test gate runs them.

**Runner (`runner.ts`, WP3 region):**
- `saveChatResponse(threadId, content, opts?: { hint?: string; failed?: boolean })`. After `chatMessages.add` succeeds, call `notifications.post({ threadId, body: composeNotificationBody({ content, hint, failed }) })` inside its own try/catch. Log on error. Notification failure never touches the chat save. If `chatMessages.add` threw, nothing is posted, because the notification is the message.
- Call sites: pass `{ hint }` on success and `{ hint, failed: true }` on fail/timeout. That covers `executeChatJob` (onComplete, onFail, onTimeout, and the onComplete error fallback) and the legacy `executeJob` `isChatJob` path (×3). There is no mode, harness, or kind case list. Every assistant message written through this function posts.
- Save-path audit at review HEAD: primary success `runner.ts:906`, error fallback `:923-925`, fail/kill `:946-950`, timeout `:967-971`; legacy success `:525`, fail/kill `:561-565`, timeout `:605-609`. The fallback already supplies its error text as **content**, with no separate hint: retain that call without options, so the whole fallback message posts verbatim. The legacy branch remains reachable: `jobs` accepts any string job type (`convex/jobs.ts:170-179`), the scheduler dispatches all pending member jobs (`convex/scheduler.ts:109-118`), and `isChatJob` recognizes `chat` and `product-owner` (`lib/prompts.ts:442-443`). Do not remove its coverage merely because normal UI chat now uses `chatJobs`.
- Keep notification errors inside the helper's own catch so they cannot enter the onComplete fallback and create an extra assistant message. One successful `chatMessages.add` yields one `notifications.post` attempt, with no duplicate call from the caller. Preserve the helper's existing non-throwing chat-save behavior. PM-role inserts use `triggerGuardianEvaluation` / `triggerCompletionSummary` directly; user inserts come through other entry points. Neither uses this assistant-only helper and neither pushes. No extra toggle query or retry is added.
- Delete `maybeSpawnNotification`, both of its call sites, and the `shouldNotify` import.

**`lib/notify-lib.ts` after WP3:**
- **Removed:** `shouldNotify`, `ShouldNotifyInput`, `prepareBody`, `PreparedBody`, `MAX_BODY_CHARS` (dead once `prepareBody` goes, because the server owns truncation), and their tests.
- **Added:** `composeNotificationBody({ content, hint, failed }): string`:
  - `failed` and `hint` set and `content` non-empty → `` `${hint}\n\n${content}` ``
  - `failed` and `hint` set and `content` empty → `hint`
  - not `failed` → `content` verbatim. Success hints are telemetry ("Context Pressure: 72k", force-kill note), and putting them first would push the message out of the preview (D4).
  - `failed` with no hint → `content` verbatim. An empty successful message remains empty; whitespace is preserved in every branch.
  - No trimming or truncation in the runner.
- **Remain unchanged:** `DEFAULT_FEED_LIMIT`, `MAX_FEED_LIMIT`, `NotificationFeedRow`/`Page`/`PageOptions`, `encodeNotificationFeedCursor`, `decodeNotificationFeedCursor`, `pageNotificationFeedRows`, and their tests.
- Tests for `composeNotificationBody`:
  - success ignores the hint
  - `"Killed by user."` + partial → hint, blank line, partial
  - failed with empty partial → hint only
  - success with markdown is byte-identical
  - a 12k-char body is not truncated client-side

**Deleted files:** `.agents/tools/workflow/notify-spawn.ts` (includes `NOTIFY_DISALLOWED_TOOLS`), `.agents/tools/workflow/notify.ts`, `.agents/tools/workflow/templates/notify.md`.

**Kept:** `lib/fork-args.ts` and its test, because `reflect-spawn.ts` uses it. Change only the stale comment `// …notify-spawn adds its own.` to name no caller. Remove `notifyTimeoutMs` from `config.example.json`. Leave the live, gitignored `config.json` alone.

**Android shell:** no change. `PayloadMapper.toNotificationPayload` already handles any body string, empty included (`PayloadMapper.kt:58-73`); it still prepends the topic for the native surface, while the stored notification body is verbatim. `FeedProtocol` accepts a plain string body and does not filter empty bodies (`FeedProtocol.kt:6-18,58-78`). Run the existing `PayloadMapperTest` and `FeedProtocolTest` unchanged as JVM unit tests; these are not included in the Node validate gate. The review's Gradle attempt was blocked by missing SDK target `android-36`, not a test assertion; report that environment limitation if it persists rather than altering Android sources or claiming those tests passed.

### J. Typecheck gate (WP1)

**File:** `.agents/tools/workflow/tsconfig.typecheck.json`. It is deliberately **not** named `tsconfig.json`. tsx auto-loads `tsconfig.json` from its cwd, and both the runner (`run-runner.sh` does `cd` into this directory) and `reflect-spawn.ts` (spawned with `cwd: __dirname`) run with this directory as cwd. Today tsx finds no tsconfig at all. A `tsconfig.json` here would change how the next runner and every reflection spawn transpile, which this assignment cannot verify live. The `.typecheck` name has zero runtime surface (D1).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": false,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"],
    "typeRoots": ["../../../workflow-engine/node_modules/@types"]
  },
  "include": ["*.ts", "lib/*.ts", "introspection/*.ts"]
}
```

- Non-recursive globs, so tsc does not descend through the `workflow-engine` symlink in this directory.
- `convex/*` resolves from the repo-root `node_modules`. `@types/node` comes from `workflow-engine` because the root has no `@types`.
- `noImplicitAny: false` is the only explicit relaxation (D2). Under full `strict`, `cli.ts:336`, `cli.ts:352`, **and `lib/reflections-fetch.ts:32`** raise TS7022. The first two cannot be fixed because `cli.ts` cannot be edited this assignment. Every other strict check stays on. Follow-up for the owner: annotate all three variables before dropping the override. The relaxation applies to the whole workflow gate, not only these existing sites.

**Gate entry** in `.agents/tools/validate/config.json`, inserted after `ts:check`:
```json
{ "name": "ts:workflow", "command": "cd workflow-engine && npx tsc --noEmit -p ../.agents/tools/workflow/tsconfig.typecheck.json" }
```
(The installer preserves `validate/config.json` only if a client already has one, `packages/setup-installer/src/orchestrator/installer.js:349-361`, so a fresh install receives this gate along with the existing `ts:check`/`build` gates. Those already `cd workflow-engine`, so this adds no new class of client breakage. Existing clients keep their own config.)

**Pre-existing errors WP1 must fix.** I probed with exactly this config: 5 errors, none in `cli.ts`, `runner.ts`, or the spawn scripts.

| File | Error | Fix |
|---|---|---|
| `lib/collapse-fanout.test.ts:43-44` | `harness`/`model` not on the inferred element type | cast the two index accesses to `CollapsibleJob`, or move them before `assert.deepStrictEqual` (whose assertion signature narrows `out`); annotating the already-typed source alone does not undo that narrowing (test-only) |
| `lib/prompts.scenario.test.ts:49` | `assignmentId` not on `Job` | fixture uses `groupId` (what `Job` declares) |
| `lib/prompts.scenario.test.ts:80` | `messages` not on `ChatJobContext` | drop the stale `messages` fixture field |
| `reflections.ts:389` | `baseArgs.last` not on the narrowed type | read via the same `Record<string, unknown>` cast the neighbouring lines use |

The probe also showed TS1470 `import.meta` errors under `NodeNext`. `Bundler` resolution, matching `convex/tsconfig.json`, removes them. That is why the config uses it.

Review reproduced the five relaxed-config diagnostics and the three additional TS7022 diagnostics using configs under `/tmp` with absolute includes/typeRoots. Including `lib/*.test.ts` is compatible with the existing `tsx --test` gate: tsc checks those files without executing them, and the nonstandard config name leaves test transpilation unchanged. Local cached tsx's config loader searches for `tsconfig.json` from `process.cwd()`; no such config exists in the workflow cwd or its ancestors at review time. This supports D1 without running the runner.

---

## Live-vs-memory map (what the running OLD runner sees while this lands)

The runner process loaded `runner.ts` and its **static import graph** once, at start: `lib/prompts.ts`, `lib/harness-executor.ts` (+ `streams.ts`, `file-tracker.ts`), `lib/harness-defaults.ts`, `lib/metrics.ts`, `lib/notify-lib.ts`, and `config.json`. **Edits to any of these have no effect until the runner process next starts.**

**That start is not only the owner's.** The runner runs under `run-runner.sh`, which loops `npx tsx runner.ts` forever and relaunches 5s after *any* exit (`run-runner.sh:11-17`). The owner's "restart" is just a kill of the child; the wrapper does the rest. `/tmp/runner.log` records 3 unplanned exit-code-0 relaunches alongside 8 SIGTERM (143) restarts. So an unplanned exit while this assignment is in flight loads whatever `runner.ts` + lib graph is on disk at that moment. Two consequences for every job in this chain:
- **Every save of `runner.ts`, `lib/prompts.ts`, `lib/notify-lib.ts`, and the new `lib/guardian-checkpoint.ts` must leave the import graph loadable.** Land a new import and the module it names in the same step. Never save a half-refactored `saveChatResponse` signature with stale call sites. If a region needs several edits, keep each intermediate save loadable, or prepare the region and apply it in one edit. `ts:workflow` proves the end state only, not the intermediate saves.
- **An unplanned relaunch after the WP2/WP3 runner edits land, but before the owner deploys Convex, produces the *new runner + old Convex* combination below without anyone choosing it.** The owner should know that window exists between merge and deploy. PM ruling: D8 stands, no fallback. The worst case is one assignment that doesn't auto-complete (its next group was already inserted, so the chain isn't stranded), and the owner closes the window by deploying Convex promptly after merge.

Everything the runner **reads from disk per use, or spawns as a fresh process**, picks up edits immediately:

| Live surface | When read | Effect of this assignment while old runner runs |
|---|---|---|
| `templates/*.md` (via `loadTemplate`, `readFileSync` per prompt build) incl. `product-owner.md`, `pm.md`, `pm-modules/` | every prompt build | Once WP2 adds placeholders, **the old runner's guardian evals show literal `{{CHECKPOINT_ROUND}}` / `{{COMPLETION_REVIEWS}}` / `{{CHAIN_SHAPE}}`**, because the old in-memory `prompts.ts` doesn't replace them. The old runner still triggers guardian on every PM. **Expected; do not work around.** |
| `notify-spawn.ts` (spawned per successful jam/cook claude chat reply) | per spawn | Once deleted, `npx tsx notify-spawn.ts` fails inside a detached, `stdio: ignore` child, so **notifications stop silently**. In-flight notify forks invoking `notify.ts`/`notify.md` may also fail. **Expected.** |
| `reflect-spawn.ts` + its imports (`lib/fork-args.ts`, `lib/engine-version.ts`, `lib/streams.ts`), `templates/reflect.md` | per crew job completion | Only `fork-args.ts`'s comment changes. Reflections are unaffected. |
| `cli.ts` + its lib imports (`harness-defaults`, `collapse-fanout`, `engine-version`, `coverage-merge`, `attachments`) | per crew/PM CLI call | Out of scope and untouched, so the crew's `insert-job` and `update-assignment` keep working. |
| Convex functions | per call | Unchanged until the owner deploys. No job deploys. |
| `tsconfig.typecheck.json` | never at runtime | Not auto-loaded by tsx (D1). |

**Owner cutover order (post-merge, owner-only):** deploy Convex **first**, then restart the runner.
- *Old runner + new Convex* (window between the two steps) is API-compatible, **but not behaviorally safe for an in-flight final PM**:
  - per-PM guardian evals continue, with literal placeholders
  - `getCompletionThread` now prefers the guardian thread. The old PM branch still queues its unconditional guardian eval **and then** its completion summary (`runner.ts:657-660`). Both can snapshot the same fork session before either completes (`chatJobs.ts:71-100`); chat dispatch is not serialized per thread (`runner.ts:987-991`). Thus a final PM in this window can create two PM messages and two chat jobs in the guardian thread. This is an additional cutover hazard, not one of the two accepted on-save side effects. Resolved operationally (P2): the owner cuts over at an idle boundary (no PM group or guardian chat job in flight), deploys Convex, and restarts the runner immediately after. No code mitigation.
  - `notifications.post` is toggle-gated, but nothing calls it
  - `getChainShape` is unused
- *New runner + old Convex* is **unsafe** and must not happen:
  - `getChainShape` doesn't exist, so the PM branch throws and **the final path never runs (assignments never auto-complete)**
  - `chatJobs.trigger` rejects the unknown `checkpoint` arg
  - `notifications.post` ignores the toggle

---

## Dependency Map

```
WP1 (typecheck gate) ──┬──▶ WP2 (guardian checkpoints) ──┬──▶ WP4 (docs)
                       └──▶ WP3 (verbatim notify)     ───┘
```

- **WP1 → WP2/WP3:** the gate must exist so the WP2/WP3 runner edits are typechecked.
- **WP2 ∥ WP3:** these are independent. They share exactly one file, `runner.ts`, in disjoint regions:
  - WP2 owns `triggerGuardianEvaluation`, `triggerCompletionSummary`, `handleGroupCompletion`, `checkAndCompleteAssignment`, and the new import of `guardian-checkpoint`.
  - WP3 owns the imports block's `notify-lib` line, `maybeSpawnNotification`, `saveChatResponse`, and the `saveChatResponse`/`maybeSpawnNotification` call sites inside `executeJob` and `executeChatJob`.
  - Parallel sub-agents are fine if each uses `Edit` scoped to its own region. Otherwise run WP2 then WP3.
- **Convex files:**
  - WP2 owns `assignments.ts`, `chatJobs.ts`, `chatThreads.ts`.
  - WP3 owns `notifications.ts`, `settings.ts`.
  - No overlap.
- **WP4** follows both, because it documents the final shape.

---

## Work Package Breakdown

No UAT is permitted (self-surgery). Each package's "vertical slice" is proven cold: a pure module with fixture tests, plus typecheck of the runner wiring, plus the Convex typecheck.

### WP1: Runner typecheck gate

**Scope:** `.agents/tools/workflow/tsconfig.typecheck.json` (new); `.agents/tools/validate/config.json` (+`ts:workflow`); fixes in `lib/collapse-fanout.test.ts`, `lib/prompts.scenario.test.ts`, `reflections.ts`.
**Success criteria:**
- `npx tsx .agents/tools/validate/cli.ts --gates ts:workflow` → `ok: true`. The gate covers `runner.ts`, `cli.ts`, `init.ts`, `reflect*.ts`, `notify*.ts` (until WP3 deletes them), `lib/*.ts` incl. tests, `introspection/*.ts`.
- `cli.ts` byte-identical (`git diff --quiet -- .agents/tools/workflow/cli.ts`).
- No file named `tsconfig.json` added under `.agents/tools/workflow`.
- Full validate green.

### WP2: Guardian convergence checkpoints

**Scope:**
- `lib/guardian-checkpoint.ts` + `.test.ts` (new)
- `convex/assignments.ts` (+`getChainShape`; `complete` refuses `blocked` in-transaction and returns `{ completed, status }`) + cold handler tests in `convex/lib/`
- `convex/chatJobs.ts` (+`checkpoint` arg)
- `convex/chatThreads.ts` (`getCompletionThread` prefers guardian)
- cold chain-query tests (including creation order differing from link order)
- `lib/prompts.ts` (+context field, +3 placeholders) + scenario tests
- `templates/product-owner.md` (placeholders only)
- `runner.ts` WP2 region

**Success criteria:**
- All 8 fixture rows in §C pass, including the north-star example `chainShape` string exactly.
- `handleGroupCompletion` contains no unconditional `triggerGuardianEvaluation` call. The PM branch has a three-way dispatch on `decideGuardianWake` only.
- `assignments.complete` never writes a `blocked` assignment (cold-tested), and `checkAndCompleteAssignment` skips `triggerCompletionSummary` whenever it returns `completed: false`.
- `getChainWithTerminalJobs` unchanged; `getChainShape` returns ids + jobTypes only.
- `product-owner.md` diff is exactly the two placeholder lines. No prose lines change.
- Jam/cook threads behave as today:
  - checkpoint → `getGuardianThread` returns null → nothing
  - final → `getCompletionThread` returns the jam/cook thread when no guardian thread exists
- `ts:check`, `ts:workflow`, `test` green.

### WP3: Verbatim notifications

**Scope:**
- `convex/settings.ts` (helper)
- `convex/notifications.ts` (toggle check, slice-only body) + cold handler tests in `convex/lib/`
- `lib/notify-lib.ts` + test (remove/add per §I)
- `runner.ts` WP3 region
- deletions: `notify-spawn.ts`, `notify.ts`, `templates/notify.md`
- `lib/fork-args.ts` comment
- `config.example.json`

**Success criteria:**
- `rg "notify-spawn|notify\.ts|notify\.md|shouldNotify|prepareBody|NOTIFY_DISALLOWED_TOOLS|maybeSpawnNotification|notifyTimeoutMs" .agents workflow-engine/convex` → no hits (docs excluded; WP4 handles them).
- `runner.ts` posts only from `saveChatResponse`, and only after `chatMessages.add` succeeds. No `spawn` is added. The runner never queries `getAudioNotifications`.
- `notifications.post` returns `null` when the toggle is off. Otherwise the stored body is `args.body.slice(0, 5000)`. Title, schema, and `feed` are unchanged.
- `composeNotificationBody` tests per §I pass. Feed-cursor tests still pass unchanged.
- No source/test files under `workflow-engine/android-shell/` changed; existing PayloadMapper/FeedProtocol JVM tests must pass unchanged. A toolchain block leaves that evidence outstanding and must never be represented as a pass.
- `ts:check`, `ts:workflow`, `test` green.

### WP4: Docs alignment

**Scope:**
- **Required by the north star:**
  - `docs/project/phases/19-HandsFreeVoiceLoop/engine-spec.md`: rewrite the notification data-flow and component paragraphs to the verbatim-post design. Add a short "superseded by Phase 22" note where the fork/CLI/template triad is described.
  - `docs/project/guides/north-star-lifecycle.md`: drop the `notify` row (line 40) and the "Notify never sees it" bullet (line 95), or rewrite them to say the notification is the Steward's message verbatim, with no prompt and no north-star exposure.
- **Required by the Documentation Protocol** (code now diverges from these docs):
  - `docs/project/spec/guardian-mode-spec.md`: update all affected cadence claims, including Solution (`:26`), mode table (`:41`), Flow (`:63-71`), Runner Changes pseudocode, Token Economy (`:267`), and Success Criteria (`:279-280`). Checkpoints alone surface interim PM reports; final assessment uses the completion prompt.
  - `docs/project/guides/system-diagram.md`: update Group Completion (`:142-144`), WATCH/CLOSE stages (`:244-249`), and notification flow (`:256`). The final assessment prefers guardian, otherwise jam/cook.
- `docs/project/spec/mental-model.md` is read-only and already correct.

**Success criteria:** inspect all changed docs for active contradictory flow, pseudocode, and acceptance claims. Use `rg -n "notify-spawn|notify\.md|notify fork|every PM|each PM|On each PM|originating jam/cook" docs/project/guides docs/project/spec docs/project/phases/19-HandsFreeVoiceLoop` as a discovery aid, not a blanket no-hits gate: references to each PM's other duties are legitimate. Superseded historical notification claims must be marked as such.

---

## Assignment-Level Success Criteria

1. `npx tsx .agents/tools/validate/cli.ts` → `ok: true`, with the new `ts:workflow` gate among the gates.
2. `lib/guardian-checkpoint.ts` exists, is pure (no I/O imports), and exports the types and functions in §C. Its tests cover the six north-star fixture shapes plus the edge rows.
3. `assignments.getChainShape` exists and returns ids + job types only, in chain order, in one query. `getChainWithTerminalJobs` is unused by the runner and unchanged.
4. `chatJobs.trigger` accepts the optional `checkpoint` payload and stores it in context. `prompts.ts` renders `{{CHECKPOINT_ROUND}}`, `{{COMPLETION_REVIEWS}}`, `{{CHAIN_SHAPE}}`. Only those placeholders were added to `product-owner.md`.
5. The PM branch of `handleGroupCompletion` dispatches final → checkpoint → nothing via the module. The per-PM trigger is gone. The blocked guard is present. Completion lookup prefers the guardian thread.
6. `notifications.post` gates on the toggle server-side. The runner posts from `saveChatResponse` only. The deleted files and functions are gone. Feed cursor helpers and `fork-args.ts` remain.
7. `cli.ts` is unchanged. No runner start/restart/kill. No Convex deploy. No `uat` jobs.
8. Docs per WP4 match the shipped design.

---

## Decisions (for the PM's Decision Record)

- **D1:** The tsconfig is `tsconfig.typecheck.json`, not `tsconfig.json`. tsx auto-loads `tsconfig.json` from cwd, and both the runner and `reflect-spawn` run with cwd set to the workflow dir. A typecheck-only name means zero runtime change.
- **D2:** `strict` with `noImplicitAny: false`. The only `strict` failures in `cli.ts` are two TS7022 implicit-any errors, and `cli.ts` is untouchable. Full strict also reports `lib/reflections-fetch.ts:32`; annotate all three sites before flipping the flag.
- **D3:** Guardian-before-jam/cook preference lives in Convex `getCompletionThread`. That keeps one round trip and no runner logic.
- **D4:** Success notifications are `content` verbatim, with telemetry hints excluded. Failure, kill, and timeout notifications are `hint + "\n\n" + partial`. `saveChatResponse` carries an explicit `failed` flag. There is no mode or harness case list.
- **D5:** `notifications.post` body is slice-to-5000 only. The trim and empty-body throw are removed, so an empty message still yields one row ("exactly one row per message"). Android already renders an empty body safely.
- **D6:** The blocked guard is inside `assignments.complete`'s transaction (refuse + `{ completed: false }`), not a separate runner read, because only an in-transaction check makes "never auto-complete blocked" true and it saves a round trip. Already `complete` → `completed: true`; the summary fires once via the group-finalization token.
- **D7:** The chain shape covers the chain up to and including the completed PM group. The PM's newly inserted group is excluded.
- **D8:** `getChainShape` failures propagate to the existing job-callback catch. That is the same failure class as `listGroups` today, so no new fallback is added, including for the new-runner-on-old-Convex window (owner closes it by deploying promptly).
- **D9:** Placeholders without a checkpoint render `(n/a)`.

## PM rulings (formerly open decisions P1/P2)

- **P1, blocked invariant: resolved as D6.** The guard is inside the mutation; see §H.
- **P2, cutover overlap: operational, owner-only.** Cut over at an idle boundary (no PM group or guardian chat job in flight): deploy Convex, then restart the runner immediately. No scheduler or session serialization is added. The crew never performs these steps.
- **Not counted: completion reviews without a document job.** `templates/pm-modules/post-document.md` inserts a completion review of `review` (+`uat`) with no `document`, so such chains under-fire checkpoints. The north star fixes the review+document rule; a template alignment is an owner follow-up, not this assignment.
- **Superseded by the block-assessment follow-up:** Phase 22 added no special case for a checkpoint on a blocked assignment (PM blocked and also inserted a next group). The follow-up now checks fresh blocked status before chain/checkpoint evaluation and routes only the block assessment.

## Ambiguities / Questions for the owner (non-blocking prompt choices)

- **Q1: the `GUARDIAN_MODE` prose is tuned for per-PM cadence.** It describes a "two-turn rhythm" (🟠 hold, then 🔴 nudge on the next PM cycle). At checkpoint cadence, the "next turn" is three completion reviews later, or the final assessment. Per the north star, the prose is yours and is not rewritten here. Only the three metadata placeholders are added. You may want to retune it to the single-turn "converging, or thrashing on the wrong thing?" verdict that the mental model describes, including the scope-clamp lever.
- **Q2: Timeout/fail hint wording.** `describeTimeoutForChat` and `"Agent failed (…). Partial response shown above."` say "shown above". In the notification the hint sits *above* the partial. That is cosmetic, so the wording is left as is. Changing it would alter the thread hint too.
- **Observation (out of scope, not fixed):** a PM job that **fails or times out** without inserting a next group is still treated as `final` and auto-completes the assignment. Today's code does the same. Fixing it widens scope. Consider a follow-up that requires a `complete` PM group status for `final`.

## Owner follow-ups (out of scope for this assignment)

- **Flip `noImplicitAny` on (D2).** `tsconfig.typecheck.json` runs `strict` with `noImplicitAny: false` only because full strict raises TS7022 at `cli.ts:336`, `cli.ts:352` (the `page` variables in the reflection coverage/gaps loops), and `lib/reflections-fetch.ts:32` (`result`). Annotate all three variables, then delete the override. `cli.ts` must not be edited while a chain is using it.
- **Align the `post-document.md` completion-review route (D11).** `templates/pm-modules/post-document.md` inserts a completion review as `review` (+`uat`) with no `document` job. The checkpoint rule counts only groups containing both `review` and `document`, so chains that take this route under-fire checkpoints. Aligning the template, or the rule, is the owner's call.
- **Retune the `GUARDIAN_MODE` prose (Q1).** It still describes a per-PM two-turn rhythm. Only the three checkpoint placeholders were added.
- **A failed/timed-out PM with no next group is treated as `final` (Observation above).** This is unchanged from before Phase 22. A follow-up could require a `complete` PM group status before `final` applies.
- **Resolved by assignment `j57b3dahvkvk19bz4bgfgqmgb58gan7t`: A PM Block now produces no push.** Phase 22's in-transaction guard correctly refused completion but left a blocking PM report silent. The block-assessment follow-up fetches the assignment fresh in the PM-group completion branch and checks blocked status before finality/checkpoint evaluation, including when the PM queued a next group. It posts one PM report and triggers one `isBlockAssessment` chat job with the recorded `blockedReason` via `getCompletionThread` (guardian first, otherwise linked jam/cook). The separate `BLOCK_ASSESSMENT` prompt advises without resuming; the assignment stays blocked. The Steward reply uses the existing `saveChatResponse` notification path, with no new notification mechanism. See [Guardian Mode Specification](../../spec/guardian-mode-spec.md#flow).

## Recommended Job Sequence

1. **implement** (one job; the engineer crew sequences internally): WP1 → validate green → WP2 ∥ WP3 (runner.ts region ownership per Dependency Map, or sequential) → WP4 → full validate green. TDD: write `guardian-checkpoint.test.ts` and the `composeNotificationBody` tests first.
2. **Completion review group:** `review` fan-out + `document` (R+R+R+D). Reviewers verify against this spec and the north star, with the self-surgery rules in force: no runner execution, no deploy, no uat. The document job records the artifacts and the owner cutover order (Convex deploy → runner restart).
3. **No uat.** Owner deploys Convex, restarts the runner, and exercises live.
