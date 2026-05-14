# Phase 14: Reflection V2 Read-Side Cutover — Completion Summary

**Status:** Complete
**Date:** 2026-05-14

## What Changed

Shipped the V2 read-side cutover: the IntrospectionDashboard now queries `api.reflectionsV2.*` exclusively (hard cutover, no V1 toggle), and three new V2 introspection CLIs land alongside the V1 ones. V1 reflections table, V1 module, and V1 introspection CLIs are untouched — other client repos pinned to older SHAs continue writing and reading V1.

### WP-A — UI Dashboard Cutover

- **`workflow-engine/ui/js/api.js`** — Binding key renamed from `reflections` to `reflectionsV2`; all four string values repointed (`reflectionsV2:byJob`, `reflectionsV2:coverageRate`, `reflectionsV2:recent`, `reflectionsV2:gaps`). No backwards-compat alias.
- **`workflow-engine/ui/js/components/introspection/IntrospectionDashboard.js`** — Substantial rework:
  - `RUBRIC_V2_LABELS` constant: 20-key map covering all rubricV2 question keys with short human phrasings sourced from `rubric-v2-draft.json`.
  - `RUBRIC_V2_POSITIVE_POLARITY_KEYS` Set: contains `validationRunBeforeCompletion` — excluded from friction aggregation (`riskYes`/`riskAnswered`/`riskRate`), excluded from radar topN, but still rendered in rubric matrix and ReflectionDetail rubric grid.
  - `summarizeReflections` flattened: anchor/risk partition removed; single rubric surface. `attentionScore = riskRate * 80 + count_bonus * 20` (anchor weight redistributed to risk).
  - `buildInsights.topRisk` sources from `analytics.radarRows[0]` (polarity-filtered + trueCount-sorted), closing the polarity leak identified in the completion review.
  - `RubricPanel`: single radar of top-6 firing V2 questions; anchor chip row removed.
  - `RubricMatrixPanel`: single color ramp (red); no anchor/risk segmentation; `validationRunBeforeCompletion` rendered but not friction-ranked.
  - `JobTypeAttentionPanel`: anchor chip removed from card signals row.
  - `ReflectionStream` card: `previewText(row.narrative, 120)` + `previewText(row.items?.[0]?.painPoint, 110)`.
  - `ReflectionDetail` drawer: meta strip + keyword chip row + narrative `DetailField` + items[] card list (each card: keyword chips + Pain heading + Suggestion heading) + rubric grid with V2 labels.
  - Dead `RUBRIC_V2_CLUSTERS` constant removed (declared unused per D14.13; confirmed zero grep hits).
- **`workflow-engine/ui/styles.css`** — Added `.introspection-detail-items` and `.introspection-detail-item` rules with `h5` + `p` styling for the items[] card layout.
- **`docs/project/spec/mental-model.md`** — One paragraph appended at §V2 Implementation Surface (line ~396) recording that the read-side cutover landed.

### WP-B — V2 Introspection CLIs

Three new files in `.agents/tools/workflow/introspection/`:

- **`dump-reflections-v2.ts`** — Queries `api.reflectionsV2.recent`; default output `/tmp/reflections-v2-dump.json`; flags: `--output <path>`, `--last <N>` (default 1000), `--help`. Verified: 46 V2 rows across 5 namespaces dumped successfully.
- **`keywords-inventory-v2.ts`** — Counts entry-level (top-level `row.keywords` only, NO `items[]` iteration); flags: `--all` (default), `--current`, `--last <N>`, `--json`, `--help`.
- **`keywords-normalize-v2.ts`** — Inline `MAPPING = {}` with multi-line comment explaining V2-thin-volume rationale; calls `api.reflectionsV2.normalizeKeywords` which rewrites both top-level and `items[].keywords` server-side; flags: `--dry-run`, `--help`.

V1 templates (`dump-reflections.ts`, `keywords-inventory.ts`, `keywords-normalize.ts`) byte-identical to pre-Phase-14 dirty baseline (Phase 13 inheritance of +41 uncommitted lines in `keywords-normalize.ts` preserved, no new hunks).

## Acceptance Criteria Met

| AC | Status | Evidence |
|----|--------|----------|
| **AC1** — UI dashboard hard cutover, zero V1 hits | Pass | `grep -rn "api\.reflections\." workflow-engine/ui/` returns 0 matches; `grep -rn "api\.reflectionsV2\." workflow-engine/ui/` returns 4 matches |
| **AC2** — Rubric label refresh | Pass | `RUBRIC_V2_LABELS` constant present with 20 keys; `ANCHOR_RUBRIC_LABELS`/`RISK_RUBRIC_LABELS` deleted (0 grep hits); single-panel decision recorded in spec §3.4 and D14.2 |
| **AC3** — ReflectionDetail renders V2 shape | Pass | Narrative + items[] rendering implemented; `row.description`/`row.critique`/`row.alternativeApproach`/`row.improvements` return 0 grep hits in `IntrospectionDashboard.js` |
| **AC4** — Three new V2 CLIs; V1 untouched | Pass | Three `*-v2.ts` files exist; all `--help` commands print without error; `--dry-run` reports `Mapping entries: 0`; V1 diff unchanged from baseline |
| **AC5** — Mental model amended | Pass | `mental-model.md` line ~396 contains "Read-side cutover (landed Phase 14)" paragraph |
| **AC6** — No UAT job | Pass | No UAT job was inserted at any point in the chain; user self-validates the dashboard |

## Spec Success Criteria

All WP-A criteria (S-A1 through S-A8) and WP-B criteria (S-B1 through S-B7) passed during verification:

- **S-A1:** 0 `api.reflections.` hits in UI tree
- **S-A2:** 4 `api.reflectionsV2.` hits in UI tree
- **S-A3:** 0 `ANCHOR_RUBRIC_LABELS`/`RISK_RUBRIC_LABELS` hits
- **S-A5:** 0 V1 row field references in dashboard
- **S-A6:** Mental-model amendment present
- **S-A7:** api.js: 0 `"reflections:"` strings, 4 `"reflectionsV2:"` strings
- **S-A8:** `POSITIVE_POLARITY_KEYS` Set defined; `summarizeReflections` gating + radar filter wired

## Completion Review & Refine Pass

**First completion review:** 9-way fan-out (reviewers A through 9). Three returned clean PASS. Six returned Concern/Refine, all independently converging on the same two issues:

1. **D14.18 — `buildInsights.topRisk` polarity leak (Medium).** `topRisk` at line 279 read from unfiltered `analytics.rubricRows`; `validationRunBeforeCompletion` (positive-polarity) could surface as "top risk" insight, inverting the readout the same way it would invert radar/matrix/attentionScore. The spec (D14.9) enumerated riskRate/radar/attentionScore but missed `buildInsights`. Fix: one line — reassign from `analytics.rubricRows.find(...)` to `analytics.radarRows[0]` (already polarity-filtered + trueCount-desc sorted). Landed at `IntrospectionDashboard.js` line 271.

2. **D14.19 — Dead `RUBRIC_V2_CLUSTERS` constant.** D14.13 declared cluster grouping unused (flat top-6 radar chosen); the constant was purely cognitive overhead. Removed from top of file. Zero grep hits remain across `workflow-engine/ui/`.

**Refine pass:** Two surgical edits to `IntrospectionDashboard.js`. No other files touched. No scope expansion.

**Closure review:** Focused single-reviewer pass (not another 9-way fan-out) confirming D14.18 fix, D14.19 deletion, and no regression to AC1-AC5 surfaces.

## Decision Log

| ID | Decision | Rationale |
|----|----------|-----------|
| D14.1 | Hard cutover UI to `api.reflectionsV2.*` — no toggle, no alias. api.js binding key renamed `reflections` → `reflectionsV2`. | AC1 explicit; surfaces missed call-sites at first run rather than silently routing through stale alias. |
| D14.2 | Collapse anchor/risk visual split to single rubric panel. | RubricV2 is 100% friction-presence; no anchor counterpart exists (verified against `rubric-v2-draft.json` retiredV1Questions). |
| D14.3 | ReflectionStream card preview = narrative excerpt (~120ch) + `items[0].painPoint` (~110ch). | Preserves V1 two-line shape; painPoint hooks on friction, which is what the stream is for. |
| D14.4 | V2 normalize MAPPING seeds empty (`{}`). | V2 volume too thin to canonicalize; seeding from V1 would bias V2 discovery. Re-runs idempotent. |
| D14.5 | `attentionScore = riskRate * 80 + count_bonus * 20` (anchor weight redistributed to risk). | V1 anchor 20% redistributed; no anchor signal in V2. |
| D14.6 | No UAT job anywhere in chain — AC6 explicit. | User self-validates dashboard. |
| D14.7 | Run WP-A and WP-B as parallel implements (zero file overlap). | Verified file-by-file in spec §2. |
| D14.8 | No new convex code — `reflectionsV2.ts` public surface complete. | Cutover is purely call-site re-pointing. |
| D14.9 | Polarity exception: `validationRunBeforeCompletion` excluded from friction aggregation (riskRate/radar topN/attentionScore). Still rendered in matrix and detail rubric grid. | RubricV2 near-monomodal; counting validation=true as friction inverts the radar. Rephrasing the question key is upstream scope. |
| D14.10 | S-B6 baseline-aware check — capture pre-implement diff, post-implement must match byte-for-byte. | Working tree dirty at Phase 14 dispatch (Phase 13 inheritance); HEAD-based gates false-fail. |
| D14.11 | S-A7 — api.js string-binding grep added. | Catches case where call-sites updated but binding still routes to V1 module. |
| D14.12 | WP-A landed per spec — `RUBRIC_V2_LABELS` covers all 20 keys; no key omissions. | — |
| D14.13 | Stretch cluster grouping NOT used — flat top-6 by trueCount desc. | Q1 recommended default in spec. |
| D14.14 | Anchor chip removed from `JobTypeAttentionPanel` card signals row (Q2 default). | Three signals enough: rows count, risk%, duration. |
| D14.15 | `humanizeKey` fallback retained for unknown rubric keys (Q3 locked). | V2 rubric intentionally extensible. |
| D14.16 | Completion review dispatched as 9-way fan-out per spec §7. | — |
| D14.17 | Working tree NOT committed before review dispatch — reviewers assess working diff directly. | Phase 14 keeps Phase 13 dirty inheritance per S-B6 baseline design. |
| D14.18 | Refine: `buildInsights.topRisk` polarity leak — reassigned from `analytics.rubricRows.find(...)` to `analytics.radarRows[0]`. | 6/9 reviewers converged; spec D14.9 enumerated surfaces but missed `buildInsights`; one-line fix. |
| D14.19 | Refine: Dead `RUBRIC_V2_CLUSTERS` constant removed. | D14.13 declared clusters unused; constant was cognitive overhead. |
| D14.20 | Matrix sort order NOT changed. | D14.9 says validation "still rendered in matrix"; matrix is reference surface. Single-reviewer dissent, no consensus. |
| D14.21 | Rubric-token color semantics NOT changed. | Spec line 109 explicit preserve; out of Phase 14 scope. |
| D14.22 | `consultant-paradigm-guide.md` is pre-Phase-14 working-tree inheritance — excluded from Phase 14 commit. | Not in phase scope. |
| D14.23 | Refine pass landed — D14.18 and D14.19 closed by surgical edits matching 6/9 reviewer consensus. | Two lines + one deleted constant; no scope expansion. |
| D14.24 | Closure verification = focused single reviewer (not another 9-way fan-out). | Refine was minimal; reviewer consensus already strong. |
| D14.25 | Document job runs parallel with closure review (zero file overlap). | Review reads code; document writes docs/. |

## AC6 Reminder

The user explicitly directed self-validation of the dashboard. No agent-driven UAT job was inserted at any point in the Phase 14 chain. Reviewer code-review verified correctness; the user validates UX/visual rendering on port 3000 personally.

## Dual-Life Note

Phase 14 is a **read-side cutover**, not a V1 retirement. The following remain queryable and operational:

- **V1 `reflections` table + `reflections.ts` module** — byte-frozen; other namespaces continue writing V1 from their pinned SHAs.
- **V1 introspection CLIs** (`dump-reflections.ts`, `keywords-inventory.ts`, `keywords-normalize.ts`) — untouched; continue operating on V1 data for the dual-life window per mental-model.md §V2 Rollout Strategy.
- **V1 `reflect.ts` on other namespaces** — pinned to pre-Phase-13 SHAs; unaffected by local CLI flip.
- **V1 data** — not migrated, not deleted. Explicit non-goal per mental-model.md §V2 Rollout Strategy (cutover, not migration).

The dashboard is now V2-only. Users needing V1 data use the V1 introspection CLIs directly.

## Spec Accuracy

Implementation matches the spec (`spec-read-side-cutover.md`) on all material dimensions. Two deviations surfaced during the completion review and were resolved in the refine pass:

1. **topRisk polarity leak** (D14.18) — the spec's D14.9 polarity exception enumerated three surfaces (riskRate, radar topN, attentionScore) but missed `buildInsights.topRisk`. The refine pass extended the exclusion to this fourth surface by sourcing from the already-filtered `radarRows[0]`.
2. **Dead RUBRIC_V2_CLUSTERS** (D14.19) — the spec recommended clusters as a stretch option (Q1); the implementation chose flat top-6 (D14.13) but left the constant declared. Refine removed it.

## Out of Scope (Not Touched)

- V1 `reflections` table and `reflections.ts` module — byte-frozen
- V1 introspection CLIs — untouched, operating on V1 data
- V1 `reflect.ts` and `reflect.md` — Phase 13 artifacts, not modified
- `rubric-v2-draft.json` — read-only design artifact, not modified
- `mental-model.md` structural changes — only the §V2 Implementation Surface paragraph appended
- Convex schema or `reflectionsV2.ts` module — no changes needed
- V1 → V2 data migration — explicit non-goal
