# Phase 15: Docs Freshen Up (post-CC2) — Completion Summary

**Status:** Complete
**Date:** 2026-05-14

## What Changed

Freshened the doc tree after CC2 retirement so new readers encounter only CC3 (workflow engine) reality. Four stale CC2-era doctrine docs archived, the two live specs regenerated against current schema and UI, and the README front-door corrected. Three commits, nine files touched, zero code changes.

### WP-1 — Demolition + Link Repair (commit `2ed3fed7`)

Four doctrine docs moved to `docs/project/archive/`:

| Source | Destination |
|---|---|
| `docs/spec/multi-agent-orchestration.md` | `docs/project/archive/multi-agent-orchestration.md` |
| `docs/spec/principles.md` | `docs/project/archive/principles.md` |
| `docs/project/guides/orchestration-guide.md` | `docs/project/archive/orchestration-guide.md` |
| `docs/project/guides/consultant-paradigm-guide.md` | `docs/project/archive/consultant-paradigm-guide.md` |

`docs/spec/` directory removed (empty after moves).

Six inbound link repairs:
- **`docs/project/guides/system-diagram.md`** line 4 — `orchestration-guide.md` reference replaced with pointer to `workflow-engine-spec.md` + `parallel-job-groups-architecture.md`.
- **`.claude/commands/learn.md`** lines 29, 32 — `docs/spec/principles.md` → `docs/project/spec/mental-model.md`; `docs/spec/multi-agent-orchestration.md` → `docs/project/spec/workflow-engine-spec.md` + `docs/project/guides/system-diagram.md`.

### WP-2 — README Refresh (commit `2ed3fed7`, same commit as WP-1)

- **Port fix** — `:3500` → `:3000` in architecture diagram and Server Ports table.
- **Empty heading removed** — `### Getting Started` deleted (🚀 Quick Start at top already covers `/cc3-server` entry).
- **Documentation Hub refreshed** — removed links to archived docs; added links to `mental-model.md`, `harness-model-config-spec.md`, `reflection-feedback-spec.md`, `password-wall.md`, `convex-bandwidth-optimization.md`, `system-diagram.md`.
- **Peer-Comms CLI corrected** — `--message` / `--namespace` syntax replaced with positional `post "msg"` / `sync` matching live `agent-comms.mjs --help`.
- **Model-diversity sentence** — `consultant-paradigm-guide.md` link removed from line 33 reference.

### WP-3 — Workflow Engine Spec Rewrite (commit `2a3695f6`)

`docs/project/spec/workflow-engine-spec.md` — 745 lines, version 2.1, dated 2026-05-14.

Regenerated against live `workflow-engine/convex/schema.ts`. Key additions:
- **New tables documented:** `reflections` (V1), `reflectionsV2` (V2), `agentComms` (peer communication).
- **Missing fields added:** `namespaces.harnessDefaults` + `assignmentCounts`; `assignments.pmNudge`; `jobs.namespaceId` + `killRequested` + `retryCount` + `retryAfter` + `rateLimitType` + `model` + `sessionId` + `exitForced` + runner metrics (`toolCallCount`, `subagentCount`, `totalTokens`, `lastEventAt`); `chatThreads.guardianSessions` + `lastReadAt` + `assignmentsCreated` + `latestMessageAt`; `chatMessages.hint`; `chatJobs` runner metrics + `killRequested` + `model` + `exitForced`.
- **Status union:** `awaiting_retry` added as fifth state.
- **Indexes:** all live indexes documented (`by_namespace_completedAt`, `by_status_killRequested`, `by_latest_message`, `by_thread_status`).
- **CLI section** refreshed against `cli.ts --help` — new commands (`assignment --nudge`), new flags (`--jobs-file`, `--nudge`, `--clear-nudge`, `--append-northstar`, `--status`), removed subcommands (`block`, `unblock`, `complete` → `update-assignment --status`).
- **Cross-references:** why-layer note at top linking `mental-model.md`; links to `reflection-feedback-spec.md`, `harness-model-config-spec.md`, `guardian-mode-spec.md`, `password-wall.md`, `convex-bandwidth-optimization.md`.

### WP-4 — Workflow Engine UI Spec Rewrite (commit `320a3962`)

`docs/project/spec/workflow-engine-ui-spec.md` — 302 lines, version 2.0, dated 2026-05-14.

Replaced 3-month-old content with live UI reality:
- **Tech stack corrected:** React 18 via ESM importmap + `React.createElement()` (no JSX), Convex ESM, marked + dompurify, Service Worker / PWA.
- **Full component tree documented:** `auth/` (password wall), `chat/` (operations center), `effects/` (grain overlay, scanline sweep), `introspection/` (V2 reflection dashboard), `job/` (AgentHUD cards), `namespace/` (settings modal), `shared/` (ConfirmDialog, EmptyState, ErrorBoundary, JsonViewer, LoadingSkeleton, QIcon, StatusBadge, Timestamp).
- **All 14 mental-model surfaces covered:** password wall, cross-namespace thread list, unread indicators, mode toggle (jam/cook/guardian), AgentHUD job cards, kill button, draft persistence, assignment pane with pmNudge + north-star amendment, multi-assignment history, introspection dashboard, namespace settings modal, brandkit Q-palette + effects, responsive breakpoints, mobile back-button handling.
- **Cross-references:** why-layer note at top linking `mental-model.md`; links to `password-wall.md`, `harness-model-config-spec.md`, `reflection-feedback-spec.md`, `guardian-mode-spec.md`, `convex-bandwidth-optimization.md`.

## Validation

| Check | Result | Method |
|-------|--------|--------|
| No `:3500` in README | Pass | `rg ':3500' README.md` — 0 matches |
| No empty `### Getting Started` | Pass | `rg 'Getting Started' README.md` — 0 matches |
| `docs/spec/` removed | Pass | Directory absent from filesystem |
| Stale CC2 references in live docs | Pass | `rg 'orchestration-guide\|consultant-paradigm\|docs/spec/' docs/project/guides docs/project/spec README.md .claude/` returns only historical receipts |
| Schema field round-trip | Pass | Table-by-table walk: all fields, indexes, and status tokens in `schema.ts` reflected in `workflow-engine-spec.md` |
| UI component inventory | Pass | All component directories and files under `workflow-engine/ui/js/components/` named in `workflow-engine-ui-spec.md` |
| `Last Updated: 2026-05-14` | Pass | Both specs carry current date |
| Why-layer cross-references | Pass | Both specs link `mental-model.md` at top |
| Documentation Hub links resolve | Pass | All link targets in README Documentation Hub exist at their paths |
| Archived files present | Pass | All four files exist under `docs/project/archive/` |
| `git diff --check HEAD~3..HEAD` | Pass | No whitespace errors |

## Decision Log

| ID | Decision | Rationale |
|----|----------|-----------|
| D15.1 | Pure archive move — no shim tombstones at original paths. | `v2-release-notes.md` already plays the "what was deleted and why" role; shims create grep false-positives. |
| D15.2 | README empty `### Getting Started` heading **deleted**, not filled. | 🚀 Quick Start at top already covers `/cc3-server` entry; duplicate is worse than missing. |
| D15.3 | `docs/spec/` directory **removed** once both files archived. | Empty placeholder misleads tree-walkers; `docs/project/spec/` is canonical. |
| D15.4 | `v2-release-notes.md` "Known gaps #3, #4" entries stay as-is — no retroactive "→ resolved in Phase 15" pointer. | Historical receipts are frozen per north star §D. |
| D15.5 | No browser automation in UAT — manual link check + grep is sufficient. | Docs-only phase; no runtime behavior to validate. |
| D15.6 | Planner recommended skipping review job — doc accuracy verified by direct comparison to live source. | Independent review adds no signal beyond what schema/UI file comparison covers. |
| D15.7 | NavigatorPM overrode D15.6 — inserted completion review. | Framework default + full-scope completion; independent review catches prose-level misalignment and broken anchors that mechanical grep cannot. |
| D15.8 | Document job inserted alongside review to produce `completion-summary.md`. | Follows Phase 14 pattern. |
| D15.9 | UAT job omitted. | D15.5 still stands; review's manual link/grep walk covers UAT slice from spec. |

## Constraints Honored

- **No code changes** — `workflow-engine/`, `packages/`, `scripts/`, root configs untouched.
- **No `.agents/` changes** — templates, runner, CLI tooling, `agent-comms.mjs` all untouched (README corrected to match existing CLI, not vice versa).
- **`mental-model.md` untouched** — remains the authoritative why-layer. Both specs cross-reference it at top without overriding.
- **Historical receipts frozen** — `docs/project/phases/`, `docs/project/research/`, existing `docs/project/archive/` contents, `v2-release-notes.md`, `cc2-retirement-survey.md`, `cc2-retirement-as-shipped.md` — none retroactively rewritten.
- **No deploys** — no `pnpm build`, no `npx convex deploy`, no schema migrations.

## Out of Scope (Not Touched)

- `mental-model.md` — read-only reference; no structural changes
- `docs/project/guides/system-diagram.md` — only line 4 link repair; content confirmed accurate and left alone
- `docs/project/phases/14-*` — historical receipt, not modified (D14.22 reference to `consultant-paradigm-guide.md` stays as-is)
- `v2-release-notes.md` — historical receipt; Known gaps #3, #4 left as-is per D15.4
- `.agents/tools/workflow/introspection/dump-reflections.ts` — pre-existing uncommitted file, not part of this phase
- `docs/project/spec/rubric-v2-draft.json` — pre-existing uncommitted file, not part of this phase
- `docs/project/spec/v2-release-notes.md` — pre-existing uncommitted file, not part of this phase

## Observations

Untracked worktree entries at time of Phase 15 completion (pre-existing, unowned by this phase):
- `.agents/tools/workflow/introspection/keywords-normalize.ts` — modified (Phase 13 inheritance)
- `.agents/tools/workflow/introspection/dump-reflections.ts` — untracked
- `docs/project/phases/15-DocsFreshenUp/` — this phase's own spec + completion summary
- `docs/project/spec/rubric-v2-draft.json` — untracked
- `docs/project/spec/v2-release-notes.md` — untracked

These are flagged as observation, not blocker.
