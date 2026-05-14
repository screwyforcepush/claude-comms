# Phase 14: Reflection V2 Read-Side Cutover — Spec

**Phase ID:** 14-ReflectionV2ReadSideCutover
**Predecessor:** Phase 13 (write-side cutover — landed `reflectionsV2` table + module + `reflect.ts` CLI flip; commits `0c92be8a`, `ee724263`, `ac7aaf81`)
**Date drafted:** 2026-05-14
**Status:** Plan — awaiting PM job dispatch

---

## 1. Purpose

Phase 13 flipped `reflect.ts` to write the new V2 capture shape (`reflectionsV2` table). New claude-comms reflections now land in `reflectionsV2` with **no consumer reading them** — the dashboard still queries V1, the introspection CLIs still read V1, and V2 entries are effectively invisible.

This phase catches the **read side** up:

- The `IntrospectionDashboard` is hard-cutover to `api.reflectionsV2.*` (no V1↔V2 toggle, no parallel view). Anchor/risk visual split collapses into a single rubric surface because rubricV2 is a friction-presence detector with no anchor counterpart.
- Three new V2 introspection CLIs land alongside (not replacing) the V1 ones, preserving the dual-life window described in mental-model.md §V2 Rollout Strategy.

Other namespaces continue writing V1 from their pinned SHAs; V1 reads (table, module, V1 CLIs, V1 dump-reflections output) remain queryable for analysis until the user decides to migrate-or-drop.

## 2. Overview

Two work-packages with **zero file overlap** → run as parallel implement jobs.

| WP | Scope | Files touched |
|----|-------|---------------|
| **WP-A** | UI dashboard cutover + mental-model amendment | `workflow-engine/ui/js/api.js`, `workflow-engine/ui/js/components/introspection/IntrospectionDashboard.js`, `workflow-engine/ui/styles.css`, `docs/project/spec/mental-model.md` |
| **WP-B** | Three new V2 introspection CLIs | `.agents/tools/workflow/introspection/dump-reflections-v2.ts`, `keywords-inventory-v2.ts`, `keywords-normalize-v2.ts` |

No Convex changes — `reflectionsV2` already exposes `insert/byJob/recent/coverageRate/gaps/normalizeKeywords`. For the four dashboard call-sites (`coverageRate`, `recent`, `gaps`, `byJob`) the **public argument shapes and return envelopes match V1 1:1** — `recent` returns `{page, isDone, continueCursor}`, `coverageRate` returns `{terminalJobs, reflectedJobs, rate, byHarness, eligibleCoverage}`, `gaps` returns the same row-array shape. The `recent.page` **row payload** differs (V2 narrative+items[] vs V1 description/critique/etc.). The `insert` mutation and `normalizeKeywords` mutation intentionally have different semantics (V2 insert validates `{narrative, items}`; V2 normalize rewrites both top-level and items[] layers) — these are not dashboard surfaces and do not affect the cutover.

## 3. Architecture & Data Flow

### 3.1 V1 → V2 query substitution (UI side)

The four dashboard queries map 1:1 without argument changes:

| V1 reference | V2 substitute | Shape change in return |
|---|---|---|
| `api.reflections.coverageRate` | `api.reflectionsV2.coverageRate` | None — `{terminalJobs, reflectedJobs, rate, byHarness, eligibleCoverage}` |
| `api.reflections.recent` | `api.reflectionsV2.recent` | None at envelope (`{page, isDone, continueCursor}`); **row payload differs** (see 3.2) |
| `api.reflections.gaps` | `api.reflectionsV2.gaps` | None — `[{jobId, jobType, harness, status, completedAt, sessionIdPresent, skipReason, resultPreview}]` |
| (`api.reflections.byJob` — not currently used by dashboard) | `api.reflectionsV2.byJob` | n/a (untouched) |

Coverage denominator semantics, harness-eligibility filter, gap reason taxonomy (`unsupported_harness` / `missing_session_id` / `reflection_missing`) — all identical. No new convex code needed.

### 3.2 V1 vs V2 row shape (the actual diff that flows through `summarizeReflections` and `ReflectionDetail`)

V1 row (kept for context, V1 stays alive on its own table):
```
{ jobId, sessionId, namespaceId, harness, jobType,
  totalTokens, toolCallCount, durationMs,
  description, critique, alternativeApproach, improvements,
  rubric: Record<string, boolean>,
  keywords: string[],
  reflectionCliVersion, clientGitSha, engineGitSha, createdAt }
```

V2 row (`reflectionsV2` rows; what `recent.page` returns post-cutover):
```
{ jobId, sessionId, namespaceId, harness, jobType,
  totalTokens, toolCallCount, durationMs,
  narrative: string,
  items: Array<{ keywords: string[], painPoint: string, suggestion: string }>,
  keywords: string[],                       // derived = union of items[].keywords
  rubric: Record<string, boolean>,           // rubricV2 question keys
  reflectionCliVersion, clientGitSha, engineGitSha, createdAt }
```

**Identical metadata, identical top-level `keywords`, identical `rubric` schema-shape but different keys.** Prose fields swap from four buckets to `narrative + items[]`.

### 3.3 RubricV2 label maps

The 20 V2 question keys + phrasings live in `docs/project/spec/rubric-v2-draft.json` and are also baked into `reflect.ts --help`. UI needs the short human labels for chart axis legends and rubric tokens. Cluster grouping (from the `reflect.ts --help` structure) provides natural visual grouping if needed for the radar/heatmap.

Five clusters (per reflect.ts --help):
- **Intent / context conflicts** — assignmentInstructionConflict, silentReconciliationForced, intentDriftMidJob, trainingDefaultOverriddenByProject, decisionFrameworkAmbiguous
- **Context / docs** — unsolicitedContextReceived, externalSoTDocsNeeded, oversizedSingleDocEncountered, artifactReadBackNeeded, sameFileReadMultipleTimes
- **CLI / best-tool-for-job availability** — kludgedBashForMissingTool, betterToolMissedAtTime, toolSchemaLookupRequired
- **Tool ergonomics** — inputShapeMismatch, shellQuotingRetry, errorMessageUninformative, toolFailedRecoveredSameTurn
- **Workflow hygiene** — parallelReadsMissed, validationRunBeforeCompletion, subagentReportNeededVerification

The implementer maintains a single `RUBRIC_V2_LABELS: Record<string,string>` constant + a `RUBRIC_V2_CLUSTERS: Record<cluster, key[]>` constant. Both derived directly from rubric-v2-draft.json (read it; do not hardcode question keys from memory).

### 3.4 Visual collapse: anchor/risk → single rubric

V1 dashboard split into **anchor** (positive — "good things present") and **risk** (negative — "bad things present"). RubricV2 is **near-monomodal**: 19 of 20 questions are friction-presence. There is no rubricV2 counterpart to "assignmentMatchedWork" / "followedConventions" / "projectStateClean" / "docsSufficient" — they were retired (see rubric-v2-draft.json `retiredV1Questions`).

**Polarity exception — `validationRunBeforeCompletion`.** This single V2 question is positive-polarity: `true` means the reflector ran the validation suite before reporting done (good hygiene); `false` is the friction signal. The other 19 questions follow the inverse — `true` is the friction signal. Treating every `true` as friction would corrupt the radar / matrix / attentionScore. See D9 (§8) for the chosen handling: this key is **excluded from friction aggregation** (radar topN, attentionScore riskRate, matrix sort) but **still rendered** in the rubric matrix (with the same red ramp) and the ReflectionDetail rubric grid so the reflector still sees their answer. The label map describes it neutrally as "Validation run before completion".

**Decision (recorded here so implement does not re-litigate):** collapse to a single rubric panel. The radar chart shows the top firing questions (any cluster). The matrix heatmap stops segmenting by `isAnchor` vs `isRisk` — single color ramp, single sort order (by trueCount desc, then rate, then label). The anchor chip row beneath the radar is removed entirely (no anchor data to display).

If the implementer feels strongly that cluster grouping adds value to the radar/heatmap visual, that is a stretch — record the choice in implement decisions, do not gate on it.

### 3.5 ReflectionDetail drawer — V2 rendering

V1 ReflectionDetail renders:
- Meta strip (job ID, created, shape) — **kept as-is**
- Top-level keyword chip row — **kept as-is** (V2 `keywords` is the derived union — chip row works unchanged)
- Four `DetailField` blocks: Description, Critique, Alternative Approach, Improvements — **REMOVED** (V2 has none)
- Rubric grid — **kept structurally**, just uses the new V2 label map

V2 ReflectionDetail renders (per design decision below):
- Meta strip — unchanged
- Top-level keyword chip row — unchanged
- **Narrative** — single `DetailField` block with the narrative string (`white-space: pre-wrap` already in CSS)
- **Items** — new section heading + stack of per-item cards:
  - Per-item card: keyword chip row at top (re-using `.introspection-chip`), then `Pain` heading + paragraph, then `Suggestion` heading + paragraph
- Rubric grid — unchanged structure; rubric tokens use `RUBRIC_V2_LABELS` (falls back to `humanizeKey` for any unknown keys, same as V1 fallback)

### 3.6 ReflectionStream card preview shape

V1 card shows: `previewText(row.description || row.critique, 120)` + `previewText(row.improvements || row.alternativeApproach, 110)`. Two-line shape: high-level + specific.

**Decision:** preserve the two-line shape with V2 fields:
- Top line (strong): `previewText(row.narrative, 120)`
- Bottom line (small): `previewText(row.items?.[0]?.painPoint, 110)` (falls back to empty if no items)

Rationale: cleanest analog to the existing density. The reflector ordered `items`, so `items[0]` is reasonable "loudest" without scoring. Showing suggestion instead of painPoint inverts the signal (suggestion is the remedy, painPoint is the friction — preview should hook on the friction). No item-count badge; the drawer carries that detail.

### 3.7 The three V2 introspection CLIs (WP-B)

Mirror the V1 templates one-for-one. **Do not modify the V1 files** — verified by `git diff --quiet .agents/tools/workflow/introspection/{dump-reflections,keywords-inventory,keywords-normalize}.ts` after implement.

#### dump-reflections-v2.ts
- Imports + config loading: copy from V1
- Default output: `/tmp/reflections-v2-dump.json` (avoid clobbering V1 dumps)
- Query: `api.reflectionsV2.recent` (not `api.reflections.recent`)
- Output rows: raw V2 reflection rows + injected `namespaceName` (same pattern as V1)
- Flags: `--output <path>`, `--last <N>` (default 1000 — page cap), `--help/-h`
- Help text mentions "V2 capture shape" so user knows the difference

#### keywords-inventory-v2.ts
- Imports + config loading: copy from V1
- Counting: V2 rows still expose top-level `keywords` (derived union). Counting at top-level is entry-level (one count per entry per canonical) — **honest severity signal per mental-model.md §Structural Direction**.
- **Do NOT iterate `items[]` and count keywords inside items** — that inflates counts when one entry breaks a theme into multiple items.
- Query: `api.reflectionsV2.recent`
- Flags: `--all` (default), `--current`, `--last <N>`, `--json`, `--help/-h` — identical to V1
- Help text mentions "counts top-level (entry-level) keywords on V2 rows; items[]-level counting deliberately omitted"

#### keywords-normalize-v2.ts
- Imports + config loading: copy from V1
- Inline `MAPPING: Record<string,string>` starts **empty** (`{}`) with a comment block explaining: V2 volume is too thin to seed canonicals yet; add entries as variants accumulate; re-runs are idempotent; the V2 mutation rewrites BOTH top-level and items[].keywords (so a single mapping entry fixes both layers, per the convex handler at `reflectionsV2.normalizeKeywords`).
- Mutation: `api.reflectionsV2.normalizeKeywords`
- Flags: `--dry-run`, `--help/-h` — identical to V1
- Help text mentions "two-layer rewrite (top-level + items[].keywords) handled server-side"

### 3.8 Mental model amendment (folded into WP-A)

Append a short note to `docs/project/spec/mental-model.md` §V2 Implementation Surface (around line 387) recording that the read-side cutover landed:

```
**Read-side cutover (landed Phase 14).** The IntrospectionDashboard now queries
`api.reflectionsV2.*` exclusively (hard cutover — no V1 toggle). Anchor/risk
visual split collapsed into a single rubric surface because rubricV2 has no
anchor counterpart. New V2 introspection CLIs (`dump-reflections-v2.ts`,
`keywords-inventory-v2.ts`, `keywords-normalize-v2.ts`) ship alongside the
V1 ones; V1 introspection tooling preserved for the dual-life window.
```

No structural changes to the mental model. If implement surfaces a new insight, surface it in the implement report and let PM decide whether to expand.

## 4. Dependency Map & Parallelisation

```
                                  ┌─────────────────┐
                                  │ START (PM gate) │
                                  └────────┬────────┘
                                           │
                  ┌────────────────────────┴────────────────────────┐
                  │                                                  │
        ┌─────────▼──────────┐                          ┌────────────▼─────────┐
        │   Implement WP-A   │                          │   Implement WP-B     │
        │  (UI + MM amend.)  │                          │   (3 V2 CLIs)        │
        └─────────┬──────────┘                          └────────────┬─────────┘
                  │                                                  │
                  └────────────────────────┬─────────────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │   PM gate #1     │
                                  │  (assess both)   │
                                  └────────┬─────────┘
                                           │
                                  ┌────────▼─────────────────────┐
                                  │  Review (fan-out)            │
                                  │  Claude || Codex || Gemini   │
                                  └────────┬─────────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │   PM gate #2     │
                                  │   ALIGN or       │
                                  │   REFINE         │
                                  └────────┬─────────┘
                                           │
                  ┌────────────────────────┴────────────────────────┐
                  │                                                  │
       (REFINE: one impl + tiny re-review)                   (ALIGN: archive)
                  │                                                  │
                  └────────────────────────┬─────────────────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │   COMPLETE       │
                                  └──────────────────┘
```

**Parallelisation opportunities:**
- WP-A and WP-B implement jobs **must run in parallel** (no file overlap, no shared mutation; runs in independent worktrees if engine harness supports it, otherwise serialised-but-independent).
- Review fan-out: Claude + Codex + Gemini reviewers run in parallel as one group reviewing the union of both implements.

**Sequencing constraints:**
- Reviewers must wait for **both** implements to complete (single review group sees both diffs).
- UI changes deploy atomically with the Convex backend, so there is no deploy ordering risk for WP-A. WP-B CLIs are local file additions, no runner restart needed.

## 5. Work Package Breakdown

### WP-A — UI dashboard cutover (vertical slice: "Steward opens dashboard, sees V2 data")

**Files modified:**
- `workflow-engine/ui/js/api.js` (3 line changes — re-point `reflections.*` references to `reflectionsV2:*`; keep the `reflections` export key OR rename to `reflectionsV2` — see decision below)
- `workflow-engine/ui/js/components/introspection/IntrospectionDashboard.js` (substantial — see scope items)
- `workflow-engine/ui/styles.css` (small additions — one `.introspection-detail-item` block + a heading rule; nothing removed)
- `docs/project/spec/mental-model.md` (one paragraph append at §V2 Implementation Surface)

**Scope items:**
1. **api.js binding rename.** Rename the `reflections` export key to `reflectionsV2` and point each value at `reflectionsV2:byJob` / `reflectionsV2:coverageRate` / `reflectionsV2:recent` / `reflectionsV2:gaps`. Hard rename — no alias. Grep the UI tree after the change: zero hits for `api.reflections.` (period or `[`).
2. **Replace rubric label maps.** Delete `ANCHOR_RUBRIC_LABELS` and `RISK_RUBRIC_LABELS` constants. Add `RUBRIC_V2_LABELS: Record<string,string>` covering all 20 V2 question keys with human-short labels paraphrased from rubric-v2-draft.json phrasings (e.g. `unsolicitedContextReceived` → `"Unsolicited context received"`; `kludgedBashForMissingTool` → `"Kludged bash for missing tool"`). Add `RUBRIC_V2_CLUSTERS: Record<cluster, key[]>` if used for visual grouping.
3. **Update `summarizeReflections`.** Drop the `riskKeys`/`anchorKeys` partition and the corresponding `isAnchor`/`isRisk` flags on `rubricCounts` / `rubricByJobType` / `jobTypeGroups`. Rubric stats become flat. Replace `anchorYes`/`anchorAnswered` tracking and `anchorRate` derivation. The `jobTypeAttentionRows` derivation needs to be reworked — `anchorRate` no longer exists. **Recommendation:** redefine `attentionScore` as `Math.round(riskRate * 80 + Math.min(group.count / 5, 1) * 20)` where `riskRate` becomes the share of yes answers across the **19 friction-polarity rubric questions** — i.e., excluding `validationRunBeforeCompletion`. Add a `const RUBRIC_V2_POSITIVE_POLARITY_KEYS = new Set(['validationRunBeforeCompletion'])` near the label maps; `summarizeReflections` must skip these keys when computing `riskYes`/`riskAnswered`/`riskRate` AND when selecting topN for the radar. The key still gets counted in `rubricCounts[key]` for the matrix render. Surface the formula choice in implement decisions if a different blend is chosen.
4. **`RubricPanel` rework.** Drop the anchor chip row beneath the radar. Single radar of top firing V2 questions (top 6). Title becomes `"Rubric"` (`"Boolean signal shape"` eyebrow can stay or change to `"friction presence"`).
5. **`RubricMatrixPanel` rework.** Drop the `isAnchor` vs `isRisk` filter and the two-color heatmap split. Single color ramp (use the existing risk-style red `196, 56, 24`). Sort by `trueCount` desc, then `rate` desc, then `label`.
6. **`JobTypeAttentionPanel` adjustment.** `row.topRisk` label resolution falls back to `RUBRIC_V2_LABELS[key]` (no anchor map to consult). `anchorRate` chip removed from the card signals row (or replaced with another V2-meaningful signal — designer's call; safest is to just drop it).
7. **`buildInsights` review.** No structural change — the "topRisk"/"topKeyword"/"topGap" insight logic still works against the flat rubric. Just drop any reference to anchor stats.
8. **`ReflectionStream` card.** Replace `previewText(row.description || row.critique, 120)` with `previewText(row.narrative, 120)`. Replace `previewText(row.improvements || row.alternativeApproach, 110)` with `previewText(row.items?.[0]?.painPoint, 110)`. Empty fallback if no items.
9. **`ReflectionDetail` rework.** Remove the four `DetailField` calls for description/critique/alternativeApproach/improvements. Add: one `DetailField` for narrative ("Narrative" title), then a new "Items" section rendering an array of item cards. Each item card has chip row + Pain heading + paragraph + Suggestion heading + paragraph. Use a new component `ReflectionItem({item})` for readability.
10. **CSS addition.** One block for `.introspection-detail-item` (padding, border, gap, similar tone to `.introspection-detail-field`). Reuses existing chip styles. Heading rule for the "Items" section if not covered by existing `<h4>` rules.
11. **Mental model amendment.** Append the read-side cutover paragraph in §V2 Implementation Surface (mental-model.md ~line 387).

**Success criteria (WP-A):**
- (S-A1) `grep -rn "api\.reflections\." workflow-engine/ui/` returns **zero** matches (period or `[`).
- (S-A2) `grep -rn "api\.reflectionsV2\." workflow-engine/ui/` returns **at least four** matches (the four query call-sites in IntrospectionDashboard.js).
- (S-A3) `grep -rn "ANCHOR_RUBRIC_LABELS\|RISK_RUBRIC_LABELS" workflow-engine/ui/` returns **zero** matches.
- (S-A4) The dashboard renders without console errors (no UAT — but `npm run typecheck` if applicable must pass; the JS doesn't have a typechecker but the UI server should start clean).
- (S-A5) ReflectionDetail no longer references `row.description`, `row.critique`, `row.alternativeApproach`, `row.improvements` (grep verification).
- (S-A6) Mental model contains the read-side cutover note paragraph.
- (S-A7) **String-binding cutover in api.js:** `grep -n '"reflections:' workflow-engine/ui/js/api.js` returns **zero** matches; `grep -n '"reflectionsV2:' workflow-engine/ui/js/api.js` returns **four** matches (byJob, coverageRate, recent, gaps). Guards against the case where call-sites are updated but the underlying string binding still routes to the V1 module.
- (S-A8) **Polarity exception wired:** `grep -n "RUBRIC_V2_POSITIVE_POLARITY_KEYS\|validationRunBeforeCompletion" workflow-engine/ui/js/components/introspection/IntrospectionDashboard.js` shows the positive-polarity set is defined and `summarizeReflections` references it when computing `riskYes/riskAnswered/riskRate` and when selecting radar topN. The key is still present in the matrix render (not filtered out).

### WP-B — V2 introspection CLIs (vertical slice: "Steward dumps/inventories/normalises V2 keywords from CLI")

**Files added:**
- `.agents/tools/workflow/introspection/dump-reflections-v2.ts`
- `.agents/tools/workflow/introspection/keywords-inventory-v2.ts`
- `.agents/tools/workflow/introspection/keywords-normalize-v2.ts`

**Files NOT modified (verified at the end):**
- `.agents/tools/workflow/introspection/dump-reflections.ts`
- `.agents/tools/workflow/introspection/keywords-inventory.ts`
- `.agents/tools/workflow/introspection/keywords-normalize.ts`

**Scope items:** see §3.7 for per-file detail.

**Success criteria (WP-B):**
- (S-B1) Three new files exist in `.agents/tools/workflow/introspection/` with names exactly `dump-reflections-v2.ts`, `keywords-inventory-v2.ts`, `keywords-normalize-v2.ts`.
- (S-B2) `npx tsx .agents/tools/workflow/introspection/dump-reflections-v2.ts --help` and `npx tsx .agents/tools/workflow/introspection/keywords-inventory-v2.ts --help` and `npx tsx .agents/tools/workflow/introspection/keywords-normalize-v2.ts --help` all print without error. (V1 templates run via `npx tsx` since their file mode is `100644`; mirror that invocation pattern.)
- (S-B3) `npx tsx .agents/tools/workflow/introspection/dump-reflections-v2.ts --output /tmp/test-v2-dump.json --last 50` writes a file containing the V2 row shape (narrative + items[] visible in at least one row if reflectionsV2 has data; empty array is acceptable if not). Hand-validated by the implementer or in PM gate.
- (S-B4) `npx tsx .agents/tools/workflow/introspection/keywords-inventory-v2.ts --all --json` runs end-to-end and emits valid JSON with `rowsScanned`, `distinctKeywords`, `counts`.
- (S-B5) `npx tsx .agents/tools/workflow/introspection/keywords-normalize-v2.ts --dry-run` runs and reports `Mapping entries: 0` (empty seed) — confirms wiring is correct even with empty mapping.
- (S-B6) **Baseline-aware V1-untouched check.** The working tree is NOT clean at WP-B dispatch (Phase 14 inherits an uncommitted `+41` line addition in `keywords-normalize.ts`, an untracked `dump-reflections.ts`, and edits to `mental-model.md`). Verification: capture a baseline diff for the three V1 introspection files **before WP-B starts** (`git diff -- .agents/tools/workflow/introspection/{dump-reflections,keywords-inventory,keywords-normalize}.ts > /tmp/wp-b-baseline.diff`). After WP-B implement, the same diff command must produce **byte-identical output** to `/tmp/wp-b-baseline.diff` — i.e., WP-B added zero hunks to V1 files. The three new `*-v2.ts` files appear as additions in `git status` but are excluded from this check. Do NOT use `HEAD~1` or `git diff --name-only` gates here; they false-fail against the dirty baseline.
- (S-B7) `keywords-inventory-v2.ts` counts entry-level (top-level row.keywords), not items-level — verifiable by code inspection (single loop over `row.keywords`, no nested iteration over `row.items[*].keywords`).

## 6. Acceptance Criteria Mapping

| North-Star AC | Satisfied by | Verification evidence |
|---|---|---|
| **AC1** — UI dashboard hard cutover, zero V1 hits in UI | WP-A | `grep -rn "api\.reflections\." workflow-engine/ui/` returns nothing |
| **AC2** — Rubric label refresh (rubricV2 keys + phrasings; anchor/risk decision recorded) | WP-A | RUBRIC_V2_LABELS constant present with 20 keys; ANCHOR/RISK constants gone; spec records the single-panel decision (§3.4) |
| **AC3** — ReflectionDetail renders V2 shape (narrative + items[]); no `row.description`/`critique`/etc. references | WP-A | Code grep for the four V1 field names returns zero in IntrospectionDashboard.js; visual confirmation in PM gate via screenshot or manual UAT-by-user (NOT by an agent UAT job) |
| **AC4** — Three new V2 CLIs; V1 CLIs untouched | WP-B | `git diff --stat HEAD~1` shows three new V2 files; `git diff HEAD~1 -- .agents/tools/workflow/introspection/{dump-reflections,keywords-inventory,keywords-normalize}.ts` empty |
| **AC5** — mental-model.md §V2 Implementation Surface amended | WP-A | grep mental-model.md for "read-side cutover (landed Phase 14)" |
| **AC6** — NO UAT JOB | This spec (§7) | The PM job chain must NOT include a UAT job. Reviews are fine. User self-validates the dashboard. |

## 7. Job Sequence (PM, take note)

**Group 1 — parallel implement (fan-out, 2 jobs):**
- `implement` × 1 → WP-A (UI cutover + mental model amendment)
- `implement` × 1 → WP-B (three V2 introspection CLIs)

**Group 2 — review fan-out (parallel, 2–3 jobs):**
- `review` × N (Claude, Codex, Gemini per namespace harness config) — single review group covers both WP-A and WP-B diffs

**Group 3 — PM gate:**
- Assess review verdicts. ALIGN → COMPLETE. REFINE → one targeted implement group then re-review then PM.

**Group 4 (only if needed) — refinement.**

**NO UAT JOB AT ANY POINT IN THIS CHAIN.** The user has explicitly directed self-validation of the dashboard. Inserting a UAT job violates AC6. Reviewers verify code-level correctness; the user verifies UX/visual rendering personally.

**Document job:** not needed as a separate group. The mental-model amendment is folded into WP-A. If PM gates discover additional documentation drift during review, fold corrections into a refinement implement.

## 8. Critical Decisions Recorded (so implement does not re-litigate)

| ID | Decision | Rationale |
|----|----------|-----------|
| **D1** | **Single rubric panel** (no anchor/risk visual split). | RubricV2 is 100% friction-presence; no anchor questions exist. Splitting on cluster (intentContextConflict / cliBestToolAvailability / toolErgonomics / etc.) is permitted as a stretch ordering signal, NOT as a binary partition. |
| **D2** | **Stream card preview: narrative excerpt (top, ~120 ch) + first-item painPoint (bottom, ~110 ch).** | Preserves V1's two-line "summary + specific" shape using V2 fields. Reflector ordered `items`; `items[0]` is a reasonable "loudest" proxy. Showing painPoint (not suggestion) hooks on the friction, which is what the stream is for. |
| **D3** | **ReflectionDetail items[] rendering: compact card list, one per item.** Card layout: chip row of item keywords + `<h5>Pain</h5> <p>` + `<h5>Suggestion</h5> <p>`. | Mirrors `.introspection-detail-field` styling. Avoids tables (prose too long). Avoids inline definition lists (less readable). One new CSS class (`.introspection-detail-item`). |
| **D4** | **V2 normalize MAPPING seeds empty (`{}`) + multi-line comment.** | V2 volume too thin to canonicalize. Seeding from V1 canonicals would bias V2 discovery (V1 keywords are Claude-harness loaded; rubricV2 deliberately reworked away from those vocabularies). Re-runs are idempotent — safe to leave empty until variants accumulate. |
| **D5** | **api.js: hard rename of the binding key from `reflections` to `reflectionsV2`.** | No backwards-compat alias. UI is the only consumer. Renaming surfaces any missed call-sites at first run rather than silently routing through a stale alias. |
| **D6** | **`attentionScore` formula adjustment for the flat rubric.** Use `Math.round(riskRate * 80 + Math.min(group.count / 5, 1) * 20)` with `riskRate = riskYes / riskAnswered` over all V2 rubric questions (no anchor term). | The V1 formula gave anchor 20% weight (`(1 - anchorRate) * 20`); that weight redistributes to risk (was 70 → 80) since there's no anchor signal. Implement may choose another blend if motivated — record in decisions. |
| **D7** | **`reflect.md` template / `reflect.ts` CLI: untouched.** | Phase 13 already wrote them. This phase is read-side only. |
| **D8** | **No new convex code.** | `reflectionsV2.ts` is complete (verified file-by-file). The dashboard substitution is purely call-site re-pointing. |
| **D9** | **Polarity exception: `validationRunBeforeCompletion` is excluded from friction aggregation.** Define `const RUBRIC_V2_POSITIVE_POLARITY_KEYS = new Set(['validationRunBeforeCompletion'])` near the label map. `summarizeReflections` skips these keys when computing `riskYes`/`riskAnswered`/`riskRate` and when selecting the radar's topN firing questions. The key remains in `rubricCounts` so the matrix still renders it (label text: `"Validation run before completion"`). | RubricV2 is near-monomodal but not pure: this one question asks whether a positive hygiene action happened. Counting its `true` as "friction firing" would invert the signal — a job that ran validation (good) would inflate the radar. Excluding from aggregation (vs inverting in-place) preserves the literal answer in the matrix without forcing a re-phrasing of the V2 question key (which lives upstream in rubric-v2-draft.json + reflect.ts and is out of scope for this read-side phase). |

## 9. Out of Scope (Non-Goals)

- Migrating V1 rows into V2 (explicit non-goal per mental-model.md §V2 Rollout Strategy).
- V1↔V2 toggle in UI (hard cutover per north star).
- Modifying V1 reflections module, V1 introspection CLIs, V1 reflect.ts (V1 surface is frozen, not retired).
- Seeding V2 normalize MAPPING with deep canonicals.
- Agent-driven UAT on the dashboard (AC6).
- New rubric questions (rubricV2 is shipped; further iteration deferred to a later rubric-refinement assignment).
- Bubble chart, alternative theme cloud layouts, or any unrelated dashboard redesign (scope creep avoidance).

## 10. Ambiguities & Questions

| # | Question | Recommended default | Who decides if it matters |
|---|----------|--------------------|--------------------------|
| Q1 | Do we want cluster-grouped ordering on the radar (e.g. radar polygon shaded by cluster) or just a flat top-6 sort? | Flat top-6 by `trueCount` desc, then rate desc. Cluster grouping is a stretch and not required by AC2. | Implementer can choose; record in implement decisions. |
| Q2 | The `JobTypeAttentionPanel` card shows `anchor X%` chip — once dropped, do we replace with another signal? | Drop the chip entirely. Card shows: count, risk%, duration. Three signals is enough. | Implementer. |
| Q3 | Should `humanizeKey` fallback in ReflectionDetail keep working for unknown rubric keys? | Yes — V2 rubric is intentionally extensible (per Phase 13 design); unknown keys should fall through gracefully. | Locked. |
| Q4 | If a V2 row's `items` array is empty (edge case — schema requires >=1 but defence-in-depth), should the stream card hide the bottom line? | Yes — `row.items?.[0]?.painPoint || ''` and `previewText` returns empty string, so the card naturally renders narrative-only. No additional null-guard logic needed. | Locked. |
| Q5 | Do we add a V2-version-pill anywhere on the dashboard (e.g. "reflections V2" eyebrow)? | No — the dashboard is V2-only post-cutover; an explicit pill would imply a V1 view exists somewhere, which it does not. Eyebrow text stays generic. | Locked. |

If implement encounters something not covered here, surface it in the implement report; do not invent answers.

## 11. Assignment-Level Success Criteria

**The assignment is DONE when:**

1. All WP-A success criteria (S-A1..S-A6) pass.
2. All WP-B success criteria (S-B1..S-B7) pass.
3. All six North-Star acceptance criteria (AC1..AC6) are satisfied per §6 verification evidence.
4. Reviewers (fan-out) reach ALIGN verdict OR the PM gate accepts a minor punch-list as acceptable.
5. The user, on receiving the COMPLETE signal, sanity-checks the dashboard themselves (this is NOT an agent UAT — it is user self-validation, AC6).

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Implementer accidentally modifies a V1 introspection file | Low | Medium (breaks dual-life) | S-B6 grep gate; reviewers double-check. |
| `attentionScore` redefinition produces visually identical rankings on current sparse V2 data, masking a formula error | Medium | Low | Reviewer reads the formula; data sparsity will resolve as V2 accumulates rows. |
| Dashboard rendering breaks on edge-case empty `items` (early V2 rows that pre-date schema enforcement, if any) | Low | Low | Defensive `?.` chaining (Q4); reviewer spot-checks. |
| Mental model amendment drifts in scope ("while I'm here…") | Medium | Medium | Spec is explicit (§3.8): one paragraph append, no structural changes. PM flags any extra edits in review. |
| New CSS class collides with existing `.introspection-detail-field` styling | Low | Low | Pick a non-conflicting class name (`.introspection-detail-item`); reviewer spot-checks computed styles. |
| Reviewer fan-out includes UAT by mistake | Low | High (AC6 violation) | This spec §7 is explicit; PM acknowledges in dispatch. |

## 13. Engine / Deploy Notes

This is a self-modifying repo. WP-A touches UI files which deploy atomically with the (unchanged) Convex backend — safe. WP-B adds local introspection CLIs that the user invokes manually (not runner-spawned) — no runner restart needed. **No deploy ordering risk.** No Convex schema change. The PM does not need to gate on `npx convex deploy` — that already happened in Phase 13.

---

**End of spec.**
