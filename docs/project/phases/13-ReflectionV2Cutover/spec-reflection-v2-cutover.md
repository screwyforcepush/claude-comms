# Phase 13 — Reflection V2 Cutover

> Spec doc for the V2 reflection capture rollout. Executable by the implement job; no further design work needed before implementation.

## Purpose

V1 reflection capture has been running for 319 entries. Its three-bucket prose shape (`critique` / `alternativeApproach` / `improvements`) plus a free-form top-level `keywords` array makes aggregation lossy: keywords don't carry the prose passage that justified them, and prose isn't tagged with which theme it speaks to. The V1 rubric also has questions firing at 95–99% (no signal) and at 6–13% (under-reported), failing the discrimination band.

V2 sharpens capture without disrupting any client currently writing V1:
- A single `narrative` block holds rationale and context (read on drill-down only).
- An `items[]` array carries `{keywords, painPoint, suggestion}` per friction — items are leaf nodes hanging off keywords; keywords become the join key across entries.
- Top-level `keywords` becomes a derived union of `items[].keywords` so existing inventory/normalize tooling keeps working.
- A new `rubric-v2-draft.r2` (20 questions) replaces the V1 question set.

**Cutover, not migration.** A new `reflectionsV2` table lands alongside V1. V1 keeps working for client repos pinned to older `reflect.ts` SHAs. The user rolls clients forward at their own pace.

## Overview

Four-file surface in a strict deploy order:

1. **`workflow-engine/convex/schema.ts`** — ADD `reflectionsV2` table block. V1 `reflections` table block stays byte-identical.
2. **`workflow-engine/convex/reflectionsV2.ts`** — NEW module mirroring V1's public surface (`insert`, `byJob`, `recent`, `coverageRate`, `gaps`, `normalizeKeywords`) with V2 shape semantics.
3. **`.agents/tools/workflow/reflect.ts`** — UPDATE in place: V2 input shape, `REFLECTION_CLI_VERSION = "0.2.0"`, all 20 rubricV2 keys baked into `--help`, calls `api.reflectionsV2.insert`.
4. **`.agents/tools/workflow/templates/reflect.md`** — REPLACE: reflector-POV prompt with three-layer framing, keywords-as-themes guidance, no downstream-aggregation talk.

**Deploy order is non-negotiable**: Convex deploy must succeed BEFORE the local CLI flips. A reflection firing during the work uses the old CLI writing to V1 (still healthy); new reflections land in V2 only after the CLI is flipped.

The assignment is self-validating: this very assignment's `implement`, `review`, and `pm` jobs trigger the V2 prompt and produce V2 reflections in `reflectionsV2` that the user inspects as the end-to-end check.

## Architecture Design

### Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│ Local Repo (.agents/tools/workflow/)                                 │
│                                                                      │
│   reflect-spawn.ts ──renders──▶ templates/reflect.md  (V2 prompt)    │
│        │                                                             │
│        └──spawns harness──▶ Agent ──invokes──▶ reflect.ts (V2 CLI)   │
│                                                       │              │
└───────────────────────────────────────────────────────┼──────────────┘
                                                        │ ConvexHttpClient
                                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Convex (prod:utmost-vulture-618)                                     │
│                                                                      │
│   reflections (V1)   ────── still alive, still receiving writes      │
│       │                     from older client SHAs                   │
│       │                                                              │
│   reflectionsV2 (NEW)  ◀── new table, written by V2 CLI only         │
│                                                                      │
│   reflections.ts   (V1 module — UNTOUCHED)                           │
│   reflectionsV2.ts (NEW module — mirrors V1 surface, V2 shape)       │
└──────────────────────────────────────────────────────────────────────┘
```

### Data Flow at Insert

1. Reflector agent reads V2 prompt → writes V2 JSON to `/tmp/reflection-<jobId>.json`.
2. Reflector runs `reflect.ts --job-id <id> --input <file>`.
3. CLI validates: rubric is `record<string, boolean>`; `narrative` is non-empty string; `items[]` is array where each item has `keywords` (length ≥ 1, all strings), `painPoint` (non-empty string), `suggestion` (non-empty string).
4. CLI computes `keywords = [...new Set(items.flatMap(i => i.keywords))]` — top-level is derived, never read from input.
5. CLI calls `api.reflectionsV2.insert` with namespace/session/harness/jobType cross-checks against the job record (same pattern as V1).
6. Convex `insert` mutation re-validates items, re-derives top-level `keywords` server-side (defense-in-depth — never trust client derivation), denormalizes job-weight metadata, writes row, returns inserted ID.

### Two-Layer Normalize

The V2 `normalizeKeywords` mutation differs from V1 in one important way:

- **V1**: rewrites only the top-level `keywords` array.
- **V2**: rewrites `items[i].keywords` for each item, then re-derives the top-level `keywords` array from the union. This keeps the two layers consistent and prevents drift where top-level matches the canonical taxonomy but items still carry pre-canonical variants (or vice versa).

Idempotent: only patch rows where the mapping actually changes the keyword set after re-derivation.

### Decision: `description` Field — DROPPED

V1 carried `description` as a 1-line debugging convenience — the only "what" field, with everything else being "how". The North Star explicitly leaves this as the planner's call.

**Decision: drop `description` in V2.** Rationale:
- The V2 `narrative` block fully absorbs the role of a debug-friendly prose summary.
- Keeping an optional `description` adds a redundant field the reflector has to consider; the prompt would need to mention or ignore it.
- A leaner schema is easier to reason about and easier to extend later.
- The `--help` block notes the change so V1-familiar reflectors know not to look for it.

**Schema impact**: `reflectionsV2` table has no `description` field. CLI input schema has no `description` key. Validation rejects unknown keys generously (warn-and-ignore) so a reflector who paste-copies a V1-style draft doesn't get a hard failure on `description` — instead they see a warning that the field was dropped in V2.

### Files OUT OF SCOPE (must not be modified)

- V1 reflections table block in `workflow-engine/convex/schema.ts` (lines 117–149) — **byte-frozen**.
- `workflow-engine/convex/reflections.ts` — **byte-frozen**.
- `.agents/tools/workflow/introspection/*` — V1 inventory/normalize tools keep working on V1 data.
- `.agents/tools/workflow/runner.ts` and `.agents/tools/workflow/reflect-spawn.ts` — the V2 CLI path is the same file path with the same arg shape (`--job-id <id> --input <path>`), so the spawn code does not change. Verified by reading `reflect-spawn.ts` lines 150–157: prompt is rendered from `templates/reflect.md` and the spawned harness invokes `reflect.ts` by being told to in the prompt — no hardcoded CLI path or arg shape lives in spawn code.
- `docs/project/spec/rubric-v2-draft.json` — read-only design artifact.
- `docs/project/spec/mental-model.md` — only edit if an implementation insight genuinely requires it (high bar; unlikely).

## Dependency Map

```
                      ┌─── schema.ts (add reflectionsV2 block)
COMMIT 1 ─────────────┤
                      └─── reflectionsV2.ts (NEW module)
                                  │
                                  ▼
                          npx convex deploy (gate)
                                  │
                                  ▼
                      ┌─── reflect.ts (update in-place)
COMMIT 2 ─────────────┤
                      └─── templates/reflect.md (replace)
```

**Parallelization opportunities**:
- Within COMMIT 1: `schema.ts` edit and `reflectionsV2.ts` authoring are independent until typecheck — implementer can draft both in parallel.
- Within COMMIT 2: `reflect.ts` edit and `reflect.md` replacement are fully independent.

**Hard ordering**: COMMIT 1 → deploy → verify → COMMIT 2. Crossing this boundary mid-flight risks a CLI flipped to V2 against a backend that doesn't have the V2 table yet, which fails reflection writes silently from the agent's POV.

## File-by-File Change Specification

### File 1 — `workflow-engine/convex/schema.ts` (ADD a table block)

**Change**: Append a new `reflectionsV2` table block. **Do not modify** the existing `reflections` block (lines 117–149).

**Insert location**: After the existing `reflections` block, before `chatThreads`.

**Fields** (in declaration order):

| Field | Validator | Source / Notes |
|---|---|---|
| `jobId` | `v.id("jobs")` | Same as V1. |
| `sessionId` | `v.string()` | Same as V1. |
| `namespaceId` | `v.id("namespaces")` | Denormalized; same as V1. |
| `harness` | `v.union(v.literal("claude"), v.literal("codex"), v.literal("gemini"))` | Same as V1. |
| `jobType` | `v.string()` | Same as V1. |
| `totalTokens` | `v.optional(v.number())` | Same as V1. |
| `toolCallCount` | `v.optional(v.number())` | Same as V1. |
| `durationMs` | `v.optional(v.number())` | Same as V1. |
| `narrative` | `v.string()` | NEW — single prose block. |
| `items` | `v.array(v.object({ keywords: v.array(v.string()), painPoint: v.string(), suggestion: v.string() }))` | NEW — structured items. |
| `keywords` | `v.array(v.string())` | DERIVED — union of `items[].keywords`. |
| `rubric` | `v.record(v.string(), v.boolean())` | Same shape as V1; rubricV2 keys. |
| `reflectionCliVersion` | `v.string()` | `"0.2.0"` for the V2 CLI. |
| `clientGitSha` | `v.optional(v.string())` | Same as V1. |
| `engineGitSha` | `v.optional(v.string())` | Same as V1. |
| `createdAt` | `v.number()` | Same as V1. |

**Indexes** (mirror V1):
- `.index("by_job", ["jobId"])`
- `.index("by_namespace_created", ["namespaceId", "createdAt"])`
- `.index("by_namespace_harness_created", ["namespaceId", "harness", "createdAt"])`
- `.index("by_created", ["createdAt"])`

**Verification after edit**:
- `git diff workflow-engine/convex/schema.ts` shows ONLY additions for `reflectionsV2`; no lines in the `reflections` block (117–149) are modified.
- TypeScript typecheck of `workflow-engine/convex/` passes (Convex generates types from this file).

### File 2 — `workflow-engine/convex/reflectionsV2.ts` (NEW module)

**Pattern**: Mirror `workflow-engine/convex/reflections.ts` structure and helper functions. Mostly drop-in with shape adjustments.

**Helpers to reuse (copy as-is)**:
- `harnessValidator`, `windowArgs`, `Harness`, `WindowMode` types.
- `REFLECTABLE_HARNESSES`, `isTerminal`, `isReflectableHarness`, `validateWindow`, `durationMs`.
- `getReflectedJobIds` — same logic, but queries the `reflectionsV2` table instead of `reflections`.
- `selectTerminalJobs` — identical to V1 (operates on `jobs`, not on the reflection table).

**`insert` mutation**:

```
args = {
  password: v.string(),
  jobId, sessionId, namespaceId, harness, jobType,
  totalTokens?, toolCallCount?, durationMs?,
  narrative: v.string(),
  items: v.array(v.object({
    keywords: v.array(v.string()),
    painPoint: v.string(),
    suggestion: v.string(),
  })),
  rubric: v.record(v.string(), v.boolean()),
  reflectionCliVersion, clientGitSha?, engineGitSha?, createdAt?
}
```

Note: the V2 mutation deliberately does NOT accept a `keywords` arg — it is derived server-side from items.

Handler steps:
1. `requirePassword(args)`.
2. Fetch job by id; same cross-checks as V1 (`namespaceId`, `sessionId`, `harness`, `jobType` must all match the job record; job must be terminal; job must have `namespaceId` and `sessionId`).
3. Validate `narrative` is non-empty (trim-check).
4. Validate `items`: each item must have `keywords.length >= 1`, all keyword entries non-empty strings, `painPoint` non-empty trimmed, `suggestion` non-empty trimmed. Reject with a clear message naming the offending index, e.g. `items[2].keywords must have at least 1 entry`.
5. Derive `keywords = [...new Set(args.items.flatMap(i => i.keywords))]`.
6. `ctx.db.insert("reflectionsV2", { ... all fields ..., createdAt: args.createdAt ?? Date.now() })`.

**`byJob` query**: Same shape as V1, querying `reflectionsV2` instead.

**`recent` query**: Same shape as V1 (windowed; harness filter; jobType filter; pagination), querying `reflectionsV2`.

**`coverageRate` query**: Same shape as V1, but the reflected-job lookup queries `reflectionsV2`. The terminal-job side is shared (`selectTerminalJobs` on `jobs` is identical).

**`gaps` query**: Same shape as V1, with reflected-job lookup against `reflectionsV2`.

**`normalizeKeywords` mutation** — TWO-LAYER, the only material change from V1:

```
args = {
  password: v.string(),
  mapping: v.record(v.string(), v.string()),
}
```

Handler steps:
1. `requirePassword(args)`.
2. `const all = await ctx.db.query("reflectionsV2").collect();`
3. For each row:
   - `scanned += 1`.
   - For each item in `row.items`: rewrite `item.keywords = [...new Set(item.keywords.map(k => mapping[k] ?? k))]`.
   - Re-derive `newTopLevel = [...new Set(newItems.flatMap(i => i.keywords))]`.
   - Build a stable comparison signature `before = JSON.stringify({ top: [...row.keywords].sort(), items: row.items.map(i => [...i.keywords].sort()) })` and the same for `after`.
   - If `before !== after`: `await ctx.db.patch(row._id, { items: newItems, keywords: newTopLevel });` `updated += 1`.
4. Return `{ scanned, updated }`.

Idempotency: a second invocation with the same mapping changes nothing.

**Verification after edit**:
- `npx tsc --noEmit -p workflow-engine/convex/tsconfig.json` (or whatever the local equivalent is) passes.
- `git diff --stat workflow-engine/convex/reflections.ts` shows 0 changes (V1 module byte-frozen).

### File 3 — `.agents/tools/workflow/reflect.ts` (UPDATE in place)

**Change list**:

1. Bump `const REFLECTION_CLI_VERSION = "0.2.0";`.
2. Replace `interface ReflectionInput` with the V2 shape:
   ```
   interface ReflectionItem {
     keywords: string[];
     painPoint: string;
     suggestion: string;
   }
   interface ReflectionInput {
     narrative: string;
     items: ReflectionItem[];
     rubric: Record<string, boolean>;
   }
   ```
3. Replace `validateInput`:
   - `narrative` required, non-empty string.
   - `items` required, non-empty array (allow zero only if there is a strong reason — recommendation: require `items.length >= 1` to force the reflector to surface at least one friction; if zero is desired, document in --help). **Decision: enforce `items.length >= 1`** — the prompt asks for friction; an empty `items` is a sign the reflector skipped the structured layer.
   - Each item: `keywords: string[]` with `length >= 1`, all entries non-empty; `painPoint`: non-empty string; `suggestion`: non-empty string. Error messages name the offending item index.
   - `rubric`: same validation as V1 (`record<string, boolean>`).
   - **Reject V1 fields with a clear message**: if input contains `critique`, `alternativeApproach`, `improvements`, fail with: `V2 CLI: critique/alternativeApproach/improvements were replaced by narrative + items; see --help`.
   - **Soft-handle `description`**: if present, log a stderr warning `description was dropped in V2; the narrative absorbs that purpose. Ignoring.` and discard. No hard failure.
4. Remove construction of top-level `keywords` from input. The Convex mutation derives it server-side. The CLI does not pass `keywords` at all.
5. Switch the mutation call from `api.reflections.insert` to `api.reflectionsV2.insert`. Remove `keywords` from the args spread; pass `narrative`, `items`, `rubric` instead of the three V1 prose fields.
6. **Rewrite `help()`** with the V2 schema documentation. Inline ALL 20 rubric question keys as a single source of truth in the CLI source (rubric-v2-draft.json stays as the design artifact, the CLI doesn't load it at runtime). Suggested structure for the help block:

   ```
   Submit a structured reflection on a completed workflow job (V2 capture).

   Usage:
     reflect.ts --job-id <jobId> --input <path-to-json>
     reflect.ts --help

   Required:
     --job-id <id>    The job you are reflecting on.
     --input  <path>  Path to a JSON file containing the V2 reflection.

   Input file shape (V2):
     {
       "narrative": "string — one prose block, rationale + context",
       "items": [
         {
           "keywords": ["theme-1", "theme-2"],
           "painPoint":  "specific friction observed",
           "suggestion": "concrete remedy"
         }
       ],
       "rubric": {
         "<questionKey>": true | false
       }
     }

   Item rules:
     - At least one item required (the prompt asks for friction).
     - Each item: keywords[] with length ≥ 1, non-empty painPoint, non-empty suggestion.
     - Keywords are friction THEMES (e.g. "tool-output-noise"), not locator
       tags (e.g. "phase-6", "this-task"). The top-level keywords field on
       the stored row is derived automatically from the union of items' keywords.

   Rubric question keys (v2-draft.r2, 20 questions):
     Intent / context conflicts:
       assignmentInstructionConflict
         "Did you encounter a direct contradiction between two instruction
          sources you were told to follow (north star vs AOP, prompt template
          vs assignment brief, spec vs decision record, etc.)?"
       silentReconciliationForced
         "Did you have to silently choose between two seemingly-authoritative
          steers because they couldn't both be followed as written (without
          surfacing the conflict to the user)?"
       intentDriftMidJob
         "Did your understanding of the assignment's true intent shift mid-job
          because of context that surfaced later (a doc you read mid-job, a
          tool result, a user message, an artifact from a prior PM round)?"
       trainingDefaultOverriddenByProject
         "Did a project-specific instruction (in CLAUDE.md, AGENTS.md, the
          prompt template, the north star, or the user's direct message)
          require you to override or suppress one of your training defaults?"
       decisionFrameworkAmbiguous
         "Did the PM decision-framework rules give an ambiguous mapping for
          the actual situation in front of you, requiring judgment beyond
          the named rules?"

     Context / docs:
       unsolicitedContextReceived
         "Did you receive context you neither asked for nor used — in any
          form — that ate context budget without changing your next action?"
       externalSoTDocsNeeded
         "To act on this assignment, did you need to read at least one
          Source-of-Truth document (mental-model.md, AGENTS.md, a phase
          spec) that was NOT inlined into the prompt?"
       oversizedSingleDocEncountered
         "Did you encounter a single document that you needed to read in
          full, but which exceeded a comfortable single-Read bite (>5k
          tokens or >300 lines) and forced you to either page or skim?"
       artifactReadBackNeeded
         "Did you have to scroll through a flat artifacts/decisions prose
          blob in the prompt to find a specific prior decision or artifact
          (because there is no key-based readback)?"
       sameFileReadMultipleTimes
         "Did you Read the same file more than once during this job for
          reasons other than intentional offset/limit paging through a
          large file?"

     CLI / best-tool-for-job availability:
       kludgedBashForMissingTool
         "Did you compose a multi-step bash pipeline because no single
          dedicated CLI or registered tool cleanly covered the operation?"
       betterToolMissedAtTime
         "Did you discover during or after the job that a better-fitting
          tool / CLI / built-in existed that you didn't reach for at the
          time?"
       toolSchemaLookupRequired
         "Did you have to fetch a tool's schema or read its --help output
          mid-task because the tool surface available to you did not
          include that information up front?"

     Tool ergonomics:
       inputShapeMismatch
         "Did at least one tool require you to marshal its input into a
          shape that didn't match how you held the data — stringified JSON
          in argv, comma-separated lists, manually escaped newlines/quotes,
          etc.?"
       shellQuotingRetry
         "Did at least one Bash invocation fail or require re-quoting
          because shell consumed backticks, single/double quotes, or
          JSON specials before the binary saw the argument?"
       errorMessageUninformative
         "When a tool call failed, did the error message tell you only
          that the call failed without giving you enough to fix it?"
       toolFailedRecoveredSameTurn
         "Did at least one tool call fail with an error that you
          self-corrected on a retry without abandoning the approach?"

     Workflow hygiene:
       parallelReadsMissed
         "Did you make three or more sequential Read/Grep/Glob calls
          within a single decision point that had no inter-dependency
          and could have been issued as one parallel batch?"
       validationRunBeforeCompletion
         "Before reporting this job complete, did you execute the
          project's validation suite (tests, typecheck, lint, smoke
          check, or the AOP-named validate step) at least once?"
       subagentReportNeededVerification
         "Did you re-read source files or rerun a command to verify
          a claim made by a spawned sub-agent, because the report
          alone was not trustworthy?"

   Rubric values must be booleans. Omit any key you have no opinion on;
   omission is itself signal. Keys not in the list above are accepted
   without warning (the schema is intentionally flexible).

   Notes:
     - `description` (V1) was dropped in V2; the narrative absorbs that
       purpose. Passing description triggers a warning and is ignored.
     - V1 fields `critique` / `alternativeApproach` / `improvements` are
       not accepted; passing them is a hard error.
     - The top-level `keywords` array is derived server-side from the
       union of items[].keywords; do not include it in the input.
   ```

   (The implementer is free to rephrase wording but must include every one of the 20 question keys with the phrasing sourced from `rubric-v2-draft.json` `questions[].key` + `questions[].phrasing`.)

**Verification after edit**:
- `npx tsx .agents/tools/workflow/reflect.ts --help` prints the V2 schema and lists all 20 rubric keys with phrasings.
- Run `npx tsc --noEmit` on the file (or the project's typecheck) — no errors.
- Build a happy-path test JSON and dry-invoke against a real terminal job from this assignment — it should write to `reflectionsV2` and print `ok`. (This is also the self-validation check, see Test Plan below.)
- Try a V1-shaped JSON (with `critique`) — CLI should fail with the rejection message.
- Try a JSON missing `narrative` — CLI should fail naming the missing field.
- Try a JSON with an item missing `painPoint` — CLI should fail naming `items[N].painPoint`.

### File 4 — `.agents/tools/workflow/templates/reflect.md` (REPLACE)

**Pattern**: Reflector-POV. Speak to the agent who just finished a job. They need to know **what** to write, NOT **how** the data is aggregated downstream.

**Required content (in order)**:

1. **Header**: `You just completed a {{JOB_TYPE}} job (status: {{JOB_STATUS}}, id: {{JOB_ID}}).` — preserve these placeholders exactly. The runner substitutes them via the `render()` function in `reflect-spawn.ts` lines 32–38.

2. **Framing paragraph**: Reflect on the OPERATING EXPERIENCE — tooling, environment, friction, context, intent conflicts, ergonomics. Outcome quality is out of scope. Be concrete and adversarial — sycophantic or generic feedback pollutes the dataset.

3. **Three-layer structure explanation** (the heart of the prompt):
   - **Rubric** — fixed yes/no questions about presence patterns. Cheap to fill. Run through them once; if a question doesn't apply (e.g. you spawned no sub-agents, so `subagentReportNeededVerification` has no answer), omit it. Omission is itself signal.
   - **Narrative** — one prose block holding rationale and context. This is where you tell the story of the job: what was hard, what surprised you, what you'd say if you sat down with the system designer for two minutes.
   - **Items** — the 3–5 loudest specific frictions, each with `keywords`, `painPoint`, `suggestion`. This is the actionable layer; the system reads it to decide what to fix.

4. **Keywords guidance** (critical — must be explicit):

   Keywords are friction **THEMES**, not LOCATOR TAGS.

   Good (theme-naming):
   - `tool-output-noise`
   - `parallel-dispatch-missed`
   - `intent-conflict-aop-vs-northstar`
   - `cli-shell-escaping`
   - `context-bloat`

   Bad (locator-only, not a friction theme):
   - `phase-6` (which phase you were on doesn't describe the friction)
   - `review-job` (job type isn't a friction)
   - `this-task` (no information content)
   - `claude-comms` (project name, not a theme)

   A future Steward reads across many entries to find the loudest themes. A keyword that says "where in the workflow" tells them nothing; a keyword that names the friction lets the system aggregate.

5. **Concrete example** (good vs bad item phrasing):

   Good:
   ```
   {
     "keywords": ["todowrite-noise", "system-reminder-injection"],
     "painPoint": "TodoWrite system-reminders fired three times mid-tool-call, each interrupting an active batch and consuming ~500 tokens of unrelated context.",
     "suggestion": "Suppress TodoWrite reminders inside an active parallel tool batch; resume them only at decision points."
   }
   ```

   Bad:
   ```
   {
     "keywords": ["this-task", "tooling"],
     "painPoint": "Tooling was noisy.",
     "suggestion": "Make it less noisy."
   }
   ```

6. **Submission instructions** (preserve V1's 3-step pattern):
   ```
   This is a new reflection turn. The original job instructions no longer prohibit
   writing a temporary JSON file for submission. Do not modify project files.

   To submit:
   1. Run `npx tsx .agents/tools/workflow/reflect.ts --help` to see the V2 input schema
      and the full list of rubric question keys with phrasings.
   2. Write your structured reflection as JSON to a temp file:
      `/tmp/reflection-{{JOB_ID}}.json`
   3. Invoke:
      `npx tsx .agents/tools/workflow/reflect.ts --job-id {{JOB_ID}} --input /tmp/reflection-{{JOB_ID}}.json`
   4. Exit after the CLI prints `ok`.
   ```

7. **Assignment scope hint** (preserve V1's tail):
   ```
   Brief context cue. The assignment was about:
   {{ASSIGNMENT_SCOPE_HINT}}
   ```

**Things the prompt MUST NOT mention** (these break the reflector-POV framing):
- "Aggregation", "join keys", "Steward", "downstream normalization", "canonical taxonomy".
- "Top-level keywords field" (it's derived; the reflector doesn't write it).
- V1-vs-V2 history (the reflector doesn't care about the migration story).
- Any rubric question keys (those live in `--help`; duplicating them here bloats the prompt).

**Verification after edit**:
- Manually read the rendered prompt with sample placeholder substitutions — does it read as a coherent instruction to an agent? Does it explain the three layers without using internal jargon?
- Run `reflect-spawn.ts` end-to-end against one of this assignment's own completed jobs and inspect the resulting Convex row.

## Deploy Ordering (Step-by-Step Runsheet)

### Step 1 — Schema + module work (offline)

1. Edit `workflow-engine/convex/schema.ts`: add `reflectionsV2` block.
2. Author `workflow-engine/convex/reflectionsV2.ts`: new module.
3. Run typecheck on the Convex package: it must pass before deploy. (`pnpm ts:check` from the monorepo root.)
4. **Verify byte-frozen V1**: `git diff workflow-engine/convex/reflections.ts` → must show zero changes. `git diff workflow-engine/convex/schema.ts` → must show ONLY additive lines for the `reflectionsV2` block.
5. Commit. Suggested message: `Add reflectionsV2 schema + module for V2 capture (V1 untouched)`.

### Step 2 — Convex deploy (the gate)

1. Confirm the symlink: `readlink /workspaces/claude-comms/convex` → must print `/workspaces/claude-comms/workflow-engine/convex`. If missing, **STOP** — do not recreate. Surface to user.
2. Run from monorepo root: `CONVEX_DEPLOYMENT=prod:utmost-vulture-618 npx convex deploy`.
3. Wait for the deploy to finish.
4. **Verify deploy success**:
   - Convex CLI exits 0 and reports new functions deployed (`reflectionsV2:insert`, `reflectionsV2:byJob`, `reflectionsV2:recent`, `reflectionsV2:coverageRate`, `reflectionsV2:gaps`, `reflectionsV2:normalizeKeywords`).
   - Smoke-test query against the new table (any reasonable namespace ID will do; pull one from `api.namespaces.list`):
     ```
     npx tsx -e "
       import { ConvexHttpClient } from 'convex/browser';
       import { anyApi } from 'convex/server';
       import { readFileSync } from 'fs';
       const cfg = JSON.parse(readFileSync('.agents/tools/workflow/config.json', 'utf-8'));
       const c = new ConvexHttpClient(cfg.convexUrl);
       const ns = (await c.query(anyApi.namespaces.list, { password: cfg.password }))[0];
       const r = await c.query(anyApi.reflectionsV2.recent, { password: cfg.password, namespaceId: ns._id, last: 1 });
       console.log(JSON.stringify(r, null, 2));
     "
     ```
   - Expected: `{ page: [], isDone: true, continueCursor: null }` (or equivalent — empty page since no rows yet).
5. **If deploy fails or smoke-test errors**: STOP. Do not proceed to Step 3. Investigate the failure. Do NOT flip the CLI.

### Step 3 — CLI + prompt flip (after gate passes)

1. Edit `.agents/tools/workflow/reflect.ts`: V2 input shape, version bump, V2 help, V2 mutation call.
2. Replace `.agents/tools/workflow/templates/reflect.md` with the V2 prompt.
3. Run `npx tsx .agents/tools/workflow/reflect.ts --help` — verify all 20 rubric keys appear with phrasings, V1 fields are not listed.
4. Commit. Suggested message: `Flip reflect.ts CLI to V2 shape; replace prompt template`.

### Step 4 — Self-validation (no separate UAT job)

The PM should chain the assignment forward to `implement` and `review` jobs that produce real V2 reflections via this assignment's own reflection cycle. The user inspects the resulting rows in `reflectionsV2` as the end-to-end validation.

PM may add one more `implement`/`review` cycle if `review` surfaces issues; otherwise mark assignment complete once V2 reflections are confirmed visible.

## Work Package Breakdown

This is a single vertical-slice WP — splitting it would risk the cross-step ordering. The implementer owns end-to-end execution of all four files with the deploy gate in the middle.

### WP-1 — V2 Reflection Capture Cutover (single WP)

**Scope**: All four files + deploy + self-validation.

**Owner**: implement job (single agent).

**Vertical slice**: schema → module → deploy → CLI → prompt → run a reflection through the pipeline.

**Success criteria**:
1. `git diff main -- workflow-engine/convex/reflections.ts` is empty (V1 module byte-frozen).
2. `git diff main -- workflow-engine/convex/schema.ts` shows only an additive `reflectionsV2` block; the existing `reflections` block (originally lines 117–149) is byte-identical.
3. `workflow-engine/convex/reflectionsV2.ts` exists, typechecks, and exposes `insert`, `byJob`, `recent`, `coverageRate`, `gaps`, `normalizeKeywords`.
4. `npx convex deploy` against `prod:utmost-vulture-618` exits 0 and the smoke-test query against `reflectionsV2:recent` returns an empty page.
5. `.agents/tools/workflow/reflect.ts`:
   - Has `REFLECTION_CLI_VERSION = "0.2.0"`.
   - Rejects V1-shape input with the message specified in §File 3.
   - Validates V2 input per the rules in §File 3.
   - Calls `api.reflectionsV2.insert`.
   - `--help` lists all 20 rubric keys with phrasings.
6. `.agents/tools/workflow/templates/reflect.md` matches the structure in §File 4: three-layer framing, keywords-as-themes guidance, no aggregation talk, preserves `{{JOB_TYPE}}`, `{{JOB_STATUS}}`, `{{JOB_ID}}`, `{{ASSIGNMENT_SCOPE_HINT}}`.
7. Project lint/typecheck/test/build all pass after both commits.
8. The assignment's own `implement` and `review` jobs successfully produce V2 reflection rows visible in `reflectionsV2` (verifiable via `api.reflectionsV2.recent`).

## Assignment-Level Success Criteria

Mirror North Star §COMPLETION exactly:

1. ✅ `reflectionsV2` table + module deployed to Convex (smoke-test query returns empty page = success gate).
2. ✅ `.agents/tools/workflow/reflect.ts` writes V2 shape with rubricV2 keys baked into `--help` and `REFLECTION_CLI_VERSION = "0.2.0"`.
3. ✅ `.agents/tools/workflow/templates/reflect.md` is the new reflector-POV prompt with three-layer framing, keywords-as-themes guidance, no aggregation talk.
4. ✅ V1 reflections table block and V1 module unchanged (`git diff main` confirms byte-frozen on V1 surface).
5. ✅ The assignment's own `implement` and `review` jobs produce V2 reflections visible in `reflectionsV2` — the user inspects these as the final validation.

## Recommended Job Sequence

```
plan (this job)
  └─▶ implement (single agent, owns all four files + deploy + smoke test)
        └─▶ review (single agent — Claude harness sufficient; small surface)
              └─▶ pm: mark complete if review surfaces no blockers,
                   OR chain one more implement→review cycle if review
                   surfaces issues.
```

**Notes for PM**:
- **No UAT job.** The assignment self-validates: the `implement` and `review` jobs themselves trigger the new V2 prompt and write to `reflectionsV2`. The user inspecting those rows IS the UAT.
- **Single-reviewer is appropriate.** The surface is small (~4 files, locked design) — a fan-out review would be over-engineering for this scope.
- **No further `plan` cycle expected.** All design decisions are locked in the North Star and this spec. If review surfaces an issue, the fix is execution-level, not design-level.
- **Cap at one additional implement/review cycle** if review surfaces issues. Residual nits go in a follow-up phase; this assignment ships when V2 capture is live and validating.

## Ambiguities & Open Questions Identified

The North Star is unusually prescriptive — most things are locked. The few judgment calls and their resolutions:

1. **`description` field — drop or preserve?**
   - **Resolved (planner decision): DROP.** Rationale in §Architecture > Decision: description field — DROPPED.

2. **`items[]` minimum cardinality — allow zero or require ≥ 1?**
   - North Star says "zero items is permitted (rare in practice if prompt bites hard enough); soft cap via prompt".
   - **Resolved (planner decision): require `items.length >= 1`.** A reflection prompt that asks for friction and gets back zero items is a sign the reflector skipped the structured layer. The CLI should refuse rather than silently accept; a determined zero-item reflector can submit a single item with `painPoint: "no notable friction"` if they truly mean it.

3. **Unknown rubric keys — accept silently, warn, or reject?**
   - The North Star says rubric keys are flexible and that the question set may evolve. V1 accepted unknown keys silently.
   - **Resolved (planner decision): accept silently.** The CLI source's question list is the canonical recommendation, not an enforcement list. The schema is `v.record(v.string(), v.boolean())` — any key is valid.

4. **`description` field in input — warn or hard-fail?**
   - **Resolved (planner decision): warn + ignore.** Hard-failing on a deprecated optional field is more friction than signal. V1 prose fields (critique/alternativeApproach/improvements) still hard-fail because they signal a fundamentally V1-shaped JSON that almost certainly has wrong content elsewhere too.

5. **Items validation: trim or just non-empty?**
   - **Resolved (planner decision): trim and require non-empty post-trim** for `painPoint` and `suggestion`. A `painPoint` of `"   "` should fail.

6. **Top-level `keywords` in CLI input — accept-and-discard, or reject?**
   - **Resolved (planner decision): reject with a clear message.** The CLI deriving and the input also carrying creates a footgun where they disagree. Make the field server-derived only.

7. **Open question for the user (does not block implementation)**: should the V2 `--help` output also note the existence of `themesNotCovered` in `rubric-v2-draft.json` so reflectors know which themes are *expected* to live in `items[]` rather than the rubric? Probably yes, but a one-liner is enough — full enumeration would bloat help.
   - **Resolved (planner decision)**: include a one-line pointer in `--help`: `(Themes intentionally not in the rubric — CLI/UX specifics, workflow patterns — are documented as items-friendly in docs/project/spec/rubric-v2-draft.json under themesNotCovered.)`. This stays out of the prompt template (per reflector-POV constraint).

## References

- North Star §V2 Implementation Surface (this assignment's brief).
- `docs/project/spec/mental-model.md` §RubricV2 — Greenfield, Evidence-Based, Framing-Led; §Structural Direction (Converging on V2); §V2 Rollout Strategy; §V2 Implementation Surface.
- `docs/project/spec/rubric-v2-draft.json` — source for the 20 rubric questions + phrasings to bake into `--help`.
- `workflow-engine/convex/schema.ts` lines 117–149 — V1 reflections table block (template to mirror).
- `workflow-engine/convex/reflections.ts` — V1 module (template to mirror).
- `.agents/tools/workflow/reflect.ts` — V1 CLI (file to update in place).
- `.agents/tools/workflow/templates/reflect.md` — V1 prompt (file to replace).
- `.agents/tools/workflow/reflect-spawn.ts` — verified unchanged; renders `templates/reflect.md` with `{{JOB_TYPE}}`, `{{JOB_STATUS}}`, `{{JOB_ID}}`, `{{ASSIGNMENT_SCOPE_HINT}}`.
- `CLAUDE.md` — root memory: Convex symlink + deploy command.

## AS-SHIPPED NOTES

Deviations between this spec and what was actually deployed (2026-05-14):

### 1. Template keywords guidance — Steward/aggregate language removed

**Spec said** (§File 4, lines 433–435): The template should include "A future Steward reads across many entries to find the loudest themes. A keyword that says 'where in the workflow' tells them nothing; a keyword that names the friction lets the system aggregate."

**As shipped**: This language was omitted from the template because it violates North Star AC5 ("NO talk of aggregation, join keys, Stewards, or any downstream consumption"). The shipped template uses the reflector-POV-safe phrasing: "Keywords name the FRICTION, not your location in the workflow" with good/bad examples — achieving the same guidance without mentioning downstream consumers.

Additionally, line 30 initially shipped with "rationale and context layer — it is read on drill-down, not aggregated" and was surgically corrected in commit `ac7aaf81` to "rationale and context layer." — removing the last trace of aggregation vocabulary.

**Spec tension**: §File 4 lines 433–435 and §File 4 line 478 ("Things the prompt MUST NOT mention: 'Aggregation'") contradict each other. The implementer correctly prioritized AC5 over the spec's example text. The spec's example text was illustrative of intent but used forbidden vocabulary.

### 2. Rubric question phrasings — paraphrased in --help

**Spec said** (§File 3, line 393): "The implementer is free to rephrase wording but must include every one of the 20 question keys with the phrasing sourced from `rubric-v2-draft.json`."

**As shipped**: All 20 question keys are present. Some phrasings are lightly paraphrased (abridged) relative to `rubric-v2-draft.json`. Per the spec's own permission ("free to rephrase"), this is in-spec. Review A and B noted it; PM declined the nit (D13).

### 3. `_generated/api.d.ts` committed with CLI flip

The Convex-generated `_generated/api.d.ts` was committed in the CLI-flip commit (`ee724263`) rather than the schema commit (`0c92be8a`). This is cosmetic — the file is regenerated on each `npx convex deploy` — and has zero functional impact. Review A noted it; PM declined the nit (D14).
