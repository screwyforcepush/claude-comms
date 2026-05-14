# Phase 13: Reflection V2 Cutover — Completion Summary

**Status:** Complete
**Date:** 2026-05-14

## What Changed

Shipped V2 reflection capture as a cutover alongside V1. New `reflectionsV2` Convex table with a sharper shape (narrative + items[] + derived keywords + rubricV2), deployed behind a strict schema-first gate. V1 table, V1 module, and V1 introspection tooling are untouched — other client repos pinned to older SHAs continue writing to V1.

### Backend (Convex)

- **`workflow-engine/convex/schema.ts`** — Added `reflectionsV2` table block (narrative, items array with keywords/painPoint/suggestion, derived top-level keywords, rubric as record<string, boolean>, reflectionCliVersion, plus all V1 metadata fields). Four indexes mirroring V1: `by_job`, `by_namespace_created`, `by_namespace_harness_created`, `by_created`. V1 `reflections` block is byte-identical to pre-cutover.
- **`workflow-engine/convex/reflectionsV2.ts`** — New module mirroring V1 public surface: `insert`, `byJob`, `recent`, `coverageRate`, `gaps`, `normalizeKeywords`. Key differences from V1: `insert` validates items (keywords length >= 1, non-empty painPoint/suggestion) and derives top-level keywords server-side; `normalizeKeywords` rewrites both item-level and top-level keyword arrays for referential consistency.

### CLI + Prompt

- **`.agents/tools/workflow/reflect.ts`** — `REFLECTION_CLI_VERSION` bumped to `"0.2.0"`. V2 input shape: `{ narrative, items[], rubric }`. Hard-fails on V1 fields (critique/alternativeApproach/improvements) with migration message. Warns and ignores deprecated `description`. Rejects client-side `keywords` (server-derived only). Calls `api.reflectionsV2.insert`. `--help` lists all 20 rubricV2 question keys with phrasings.
- **`.agents/tools/workflow/templates/reflect.md`** — Replaced with reflector-POV three-layer prompt (rubric/narrative/items). Keywords-as-themes guidance with concrete good/bad examples. No downstream aggregation or Steward talk.

### Generated

- **`workflow-engine/convex/_generated/api.d.ts`** — Updated by Convex deploy to register `reflectionsV2` module exports.

## Commits

| SHA | Message | Files |
|-----|---------|-------|
| `0c92be8a` | Add reflectionsV2 schema + module for V2 capture (V1 untouched) | schema.ts, reflectionsV2.ts |
| `ee724263` | Flip reflect.ts CLI to V2 shape; replace prompt template | reflect.ts, reflect.md, _generated/api.d.ts |
| `ac7aaf81` | Remove aggregation talk from reflect.md narrative section (AC5 compliance) | reflect.md |

Deploy gate between commits 1 and 2: `CONVEX_DEPLOYMENT=prod:utmost-vulture-618 npx convex deploy` succeeded; smoke-test `reflectionsV2.recent` returned empty page confirming table registration.

Commit 3 was a post-review fix: Review B identified that line 30 of `reflect.md` contained "not aggregated" — downstream-aggregation language that violates AC5 ("NO talk of aggregation"). Surgical one-line removal changed the phrase from "rationale and context layer — it is read on drill-down, not aggregated." to "rationale and context layer." Grep-verified clean of all forbidden vocabulary (aggregation, normalize, join-key, Steward, downstream).

## Acceptance Criteria Met

1. `reflectionsV2` table + module deployed to Convex (smoke-test verified)
2. `reflect.ts` writes V2 shape with `REFLECTION_CLI_VERSION = "0.2.0"` and all 20 rubricV2 keys in `--help`
3. `reflect.md` is the new reflector-POV prompt with three-layer framing and keywords-as-themes guidance
4. V1 reflections table and module byte-frozen (`git diff` on reflections.ts is empty; schema.ts shows only additive V2 block)
5. **AC5 — no downstream-aggregation language in template** (post-review fix in `ac7aaf81`; grep-verified clean)
6. Deploy ordering followed: schema+module commit -> deploy -> verify -> CLI+prompt commit
7. Self-validating: the assignment's own implement and review jobs trigger the V2 prompt and write to `reflectionsV2`

## Spec Accuracy

Implementation matches the spec (`spec-reflection-v2-cutover.md`) on all material dimensions: four-file surface, deploy ordering, validation rules, two-layer normalizeKeywords, and all design decisions (D1-D8). Three minor deviations are documented in the spec's AS-SHIPPED NOTES section: (1) template keywords guidance omitted Steward/aggregate language per AC5, resolving an internal contradiction in the spec; (2) rubric phrasings lightly paraphrased in --help, per spec-granted permission; (3) `_generated/api.d.ts` committed in the CLI-flip commit rather than the schema commit (cosmetic).

## Out of Scope (Not Touched)

- V1 `reflections` table and `reflections.ts` module — byte-frozen
- V1 introspection tooling (`.agents/tools/workflow/introspection/*`) — untouched, continues operating on V1 data
- `reflect-spawn.ts` and `runner.ts` — no changes needed (same CLI path and arg shape)
- `rubric-v2-draft.json` — read-only design artifact, not modified
- `mental-model.md` — not modified

## Open Items Deferred

- V2 inventory/normalize CLI tooling (separate follow-up assignment after V2 has data)
- Migrating V1 rows to V2 (user decision, not yet scheduled)
- UI changes to read `reflectionsV2` table
- Cross-V1+V2 coverage rate calculation
