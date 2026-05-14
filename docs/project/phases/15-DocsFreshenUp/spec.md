# Phase 15 — Docs Freshen Up (post-CC2)

**Status:** Planned
**Created:** 2026-05-14
**Owner:** docs-only (no code touched)
**Why-layer authority:** [`docs/project/spec/mental-model.md`](../../spec/mental-model.md)

---

## Purpose

CC2 was scrubbed in v2.0.0 (commit `9adb2929`, release notes at
[`docs/project/spec/v2-release-notes.md`](../../spec/v2-release-notes.md)). The
deletion was surgical against code/config but explicitly deferred ~1,500 lines
of doctrine documents (`orchestration-guide.md`, `multi-agent-orchestration.md`,
`consultant-paradigm-guide.md`, `principles.md`). The two live specs
(`workflow-engine-spec.md`, `workflow-engine-ui-spec.md`) are dated
**2026-02-02** — three months behind reality. The README still advertises
port `:3500` (live UI is `:3000`) and has an empty "Getting Started" heading.

A new contributor — human or agent — reading `docs/` today calibrates against a
system that no longer exists. The fix is to drop the stale doctrine into
`archive/`, regenerate the two live specs against the live schema + live UI,
and patch the README's surface inaccuracies. Nothing else.

---

## Overview

Documentation-only assignment, four work packages, no code paths touched.

| WP | Scope | Touches | Independent? |
|----|-------|---------|--------------|
| WP-1 Demolition + Link Repair | Archive 4 docs, remove `docs/spec/` directory, repair inbound links | `docs/spec/*`, `docs/project/guides/{orchestration,consultant-paradigm}-guide.md`, surviving docs that link in | Yes (no dep on others) |
| WP-2 README Refresh | Port fix, empty heading, Documentation Hub link list, peer-comms CLI section | `README.md` only | Depends on WP-1 (so it can remove links to archived docs) |
| WP-3 Workflow Engine Spec Rewrite | Regenerate schema section against `convex/schema.ts`; refresh CLI section against `cli.ts --help` | `docs/project/spec/workflow-engine-spec.md` | Yes (independent of WP-1/2/4) |
| WP-4 Workflow Engine UI Spec Rewrite | Replace 3-month-old content with React.createElement + Q-palette + live component tree reality | `docs/project/spec/workflow-engine-ui-spec.md` | Yes (independent of WP-1/2/3) |

WP-1, WP-3, WP-4 are fully parallelizable. WP-2 must follow WP-1.

---

## Hard Constraints (non-negotiable)

1. **No code changes.** `workflow-engine/`, `packages/`, `scripts/`, root configs are read-only references.
2. **Nothing inside `.agents/`.** Templates, runner, CLI tooling, `agent-comms.mjs` — all off-limits.
3. **`mental-model.md` is authoritative.** Specs cite it as the why-layer; they do not contradict or override it.
4. **Historical receipts are frozen.** `docs/project/phases/`, `docs/project/research/`, `docs/project/archive/` (existing contents) are NOT retroactively rewritten. Phase 14's completion summary stays as-is even though it references `consultant-paradigm-guide.md` — it was correctly recording an exclusion at that time.
5. **No deploys.** No `pnpm build`, no `npx convex deploy`, no schema migrations. Validation = manual link check + visual diff review.

---

## Architecture Design

Documentation has three roles in this repo's doc tree, and the rewrite preserves the separation:

```
                          ┌─────────────────────────────────┐
                          │ WHY LAYER (mental-model.md)     │
                          │ - intent, philosophy            │
                          │ - design principles             │
                          │ - authoritative; specs cite     │
                          └────────────────┬────────────────┘
                                           │
                                           │ specs reference (not override)
                                           ▼
   ┌──────────────────────────┐  ┌─────────────────────────────────────┐
   │ WHAT LAYER (spec/*.md)   │  │ HOW LAYER (guides/*.md, README.md)  │
   │ - schema, fields         │  │ - operational pointers              │
   │ - status transitions     │  │ - architecture diagrams (ascii)     │
   │ - API/CLI surfaces       │  │ - quick-start, command tables       │
   │ - sourced from live code │  │ - "where to look" index             │
   └──────────────────────────┘  └─────────────────────────────────────┘

   ┌──────────────────────────┐  ┌─────────────────────────────────────┐
   │ RECEIPT LAYER (phases/,  │  │ ARCHIVE LAYER (archive/)            │
   │ research/, archive/)     │  │ - retired doctrine                  │
   │ - frozen, accurate as-of │  │ - preserved for historical context  │
   │   date of write          │  │ - NOT linked from live docs         │
   └──────────────────────────┘  └─────────────────────────────────────┘
```

The four demolition targets are doctrine that no longer matches what-and-how
reality. They move to **archive layer**; nothing in **why/what/how layers**
should link to them after this phase ships.

---

## Cross-Doc Impact Map (inbound references)

Grep ran across `docs/`, `README.md`, `.claude/`, `workflow-engine/`.
Findings split into **must-fix** (live docs/code) and **leave-alone**
(historical receipts):

### Must-fix (live docs)

| File | Line | Reference | WP | Treatment |
|---|---|---|---|---|
| `README.md` | 33 | `consultant-paradigm-guide.md` | WP-2 | Remove the linked sentence; model-diversity story now lives in the workflow engine (`harness` field per job, `harness-model-config-spec.md`). |
| `README.md` | 154 | `orchestration-guide.md` | WP-2 | Remove from Documentation Hub. |
| `README.md` | 155 | `consultant-paradigm-guide.md` | WP-2 | Remove from Documentation Hub. |
| `docs/project/guides/system-diagram.md` | 4 | `orchestration-guide.md` | WP-1 | Header references the doc — replace with pointer to `workflow-engine-spec.md` + `parallel-job-groups-architecture.md` only. (system-diagram.md is otherwise correct and stays put per north star "current and good".) |
| `.claude/commands/learn.md` | 29 | `docs/spec/principles.md` | WP-1 | Replace pointer with `docs/project/spec/mental-model.md` (the new "must grok" why-layer for the tutor). |
| `.claude/commands/learn.md` | 32 | `docs/spec/multi-agent-orchestration.md` | WP-1 | Replace pointer with `docs/project/spec/workflow-engine-spec.md` + `docs/project/guides/system-diagram.md`. |

### Leave-alone (historical receipts — north star §D forbids rewriting)

| File | Reason it stays |
|---|---|
| `docs/project/phases/14-ReflectionV2ReadSideCutover/completion-summary.md:97` | Records D14.22 exclusion accurately as-of phase commit. |
| `docs/project/spec/v2-release-notes.md:100,102` | "Known gaps #3, #4" — this is precisely the receipt naming what *this* phase fixes. Update is unnecessary; the v2 release shipped with those gaps. Optionally: add a tiny "→ resolved in Phase 15" pointer (out-of-scope for WP-1; can be a WP-1.5 nice-to-have). |
| `docs/project/spec/cc2-retirement-survey.md:125,495` | Decision receipt preserved per `cc2-retirement-as-shipped.md`. |
| `docs/project/spec/cc2-retirement-as-shipped.md:182` | Records the explicit user defer on `multi-agent-orchestration.md`. |

**No other inbound references found.** The four targets are link-isolated from
the rest of the doc tree once the six must-fix lines above are repaired.

---

## WP-1 — Demolition + Link Repair

### Scope

Move four doctrine files into `docs/project/archive/`, remove the now-empty
`docs/spec/` directory, repair the six inbound links listed above.

### Decision: Pure archive move (no shim)

Files move as-is with no replacement stubs at the original paths.
Rationale (decision logged): `v2-release-notes.md` already plays the
"what was deleted and why" role for CC2-era artifacts. A shim file at
`docs/project/guides/orchestration-guide.md` would just be a tombstone that
some future grep treats as live content. Cleaner to let the link repair speak
for itself.

### Decision: Remove `docs/spec/` directory

After the two files inside move to archive, the directory is empty. Delete
it. An empty placeholder is dead structure that misleads tree-walkers
(human or agent) into thinking content is coming. `docs/project/spec/` is the
canonical spec home; no historical reason to preserve a sibling `docs/spec/`.

### Files moved

| Source | Destination |
|---|---|
| `docs/spec/multi-agent-orchestration.md` | `docs/project/archive/multi-agent-orchestration.md` |
| `docs/spec/principles.md` | `docs/project/archive/principles.md` |
| `docs/project/guides/orchestration-guide.md` | `docs/project/archive/orchestration-guide.md` |
| `docs/project/guides/consultant-paradigm-guide.md` | `docs/project/archive/consultant-paradigm-guide.md` |

Then: `rmdir docs/spec/` (directory now empty).

### Link repairs

Edits per the impact map above:
- `docs/project/guides/system-diagram.md` line 4
- `.claude/commands/learn.md` lines 29 and 32

### Acceptance criteria

- [ ] All four files exist under `docs/project/archive/` and no longer exist at their original paths
- [ ] `docs/spec/` directory does not exist
- [ ] `rg -l 'orchestration-guide|multi-agent-orchestration|consultant-paradigm' docs/project/guides docs/project/spec README.md .claude/` returns ONLY: `docs/project/spec/v2-release-notes.md`, `docs/project/spec/cc2-retirement-survey.md`, `docs/project/spec/cc2-retirement-as-shipped.md`, `docs/project/phases/14-ReflectionV2ReadSideCutover/completion-summary.md` (the historical-receipts list — these stay untouched)
- [ ] `rg -l 'docs/spec/' docs/ README.md .claude/` returns no matches in live docs (only historical receipts)
- [ ] All link repairs land in the same commit as the moves (no broken-link window in history)

### Suggested UAT slice

Manual link check: from a fresh terminal, click through every link in `README.md` Documentation Hub, every `mental-model.md`-referenced cross-link, and the system-diagram.md header. Zero 404s.

---

## WP-2 — README Refresh

### Scope

Three categorical fixes to `README.md`:

1. **Port correction** — line 55 (architecture ASCII diagram, `:3500`) and line 203 (Server Ports table) → `:3000`. CLAUDE.md memory and live `ui-server` confirm port 3000.
2. **Empty "Getting Started" heading** (line 146) — **decision: delete the heading**. Rationale (decision logged): the "🚀 Quick Start" section at line 26 already points to `/cc3-server`, which is the entry-point flow. A second "Getting Started" with the same content duplicates; an empty heading is dead weight. Single source for getting-started messaging stays at top.
3. **Documentation Hub** (lines 144–156) — remove links to demolition targets; add links to existing-but-unlinked specs:
   - Remove: `orchestration-guide.md`, `consultant-paradigm-guide.md`
   - Add: `mental-model.md` (the why-layer authority), `harness-model-config-spec.md`, `reflection-feedback-spec.md`, `password-wall.md`, `convex-bandwidth-optimization.md`, `guardian-mode-spec.md` (already linked — verify)
   - Also: the model-diversity sentence at line 33 must drop its `consultant-paradigm-guide.md` link. Replace with a pointer to `workflow-engine-spec.md` (harness field on jobs) or just remove the trailing reference.
4. **Peer-Comms CLI section** (lines 178–185) — README says:
   ```
   node .agents/tools/workflow/agent-comms.mjs post --message "discovery" --namespace my-project
   node .agents/tools/workflow/agent-comms.mjs sync --namespace my-project
   ```
   Live CLI (`agent-comms --help`) actually accepts `--group <groupId>` and `--name <name>`, with the message as a **positional** argument (not `--message`). No `--namespace` flag. Correct README to:
   ```
   node .agents/tools/workflow/agent-comms.mjs post "discovery"
   node .agents/tools/workflow/agent-comms.mjs sync
   ```
   Note env-var defaults (`WORKFLOW_GROUP_ID`, `AGENT_COMMS_GROUP`).

   **Do NOT modify `agent-comms.mjs` itself** — `.agents/` is off-limits. README is the only thing that changes.

### Acceptance criteria

- [ ] No `:3500` in README (`rg ':3500' README.md` returns nothing)
- [ ] No empty `### Getting Started` heading
- [ ] Documentation Hub has no links to archived docs
- [ ] Documentation Hub links to all current `docs/project/spec/*.md` specs (excluding cc2-retirement-* receipts, draft files, and release notes)
- [ ] Peer-Comms CLI block matches actual `agent-comms.mjs --help` interface
- [ ] All link targets resolve (no 404s)

### Suggested UAT slice

Visual diff of rendered README on GitHub or VSCode preview. Click every link. Then `nohup npm start > /tmp/ui.log 2>&1 &` from `workflow-engine/ui/` and confirm `localhost:3000` loads — sanity check on the port fix.

---

## WP-3 — Workflow Engine Spec Rewrite

### Scope

Regenerate the schema section of `docs/project/spec/workflow-engine-spec.md`
against the live `workflow-engine/convex/schema.ts`. Refresh the CLI section
against `cli.ts --help` output. Update "Last Updated" to 2026-05-14. Add a
**"Why-layer reference"** note pointing readers to `mental-model.md` for
intent/philosophy.

### Schema diff inventory (live `schema.ts` ↔ current spec)

Exhaustive list of fields/tables/indexes present in the live schema but
**missing or stale** in `workflow-engine-spec.md`:

#### `namespaces` (missing fields)
- `assignmentCounts: { pending, active, blocked, complete }` — denormalized counters
- `harnessDefaults: string` (JSON-encoded `HarnessDefaults`, see `harness-model-config-spec.md`)

#### `assignments` (missing fields)
- `pmNudge: optional string` — short-lived directive consumed by next PM (see mental-model §Mid-Flight Assignment Modification)

#### `jobs` (missing fields + status + indexes)
- `namespaceId: optional Id<"namespaces">` — denormalized for reflection coverage (historical jobs may omit)
- `toolCallCount`, `subagentCount`, `totalTokens`, `lastEventAt` — runner-streamed metrics
- `model: optional string` — exact CLI `--model` argument, stamped at insert time (see `harness-model-config-spec.md`)
- `sessionId: optional string` — harness session/thread ID for resume/debugging
- `exitForced: optional bool`
- **Rate-limit auto-retry fields**: `retryCount`, `retryAfter` (ms epoch), `rateLimitType` (`"five_hour" | "seven_day"`)
- `killRequested: optional bool` — Phase 10 kill signal from UI
- **Status union** must include `"awaiting_retry"` (currently only documents 4 of 5 states)
- **Indexes** to add: `by_namespace_completedAt`, `by_status_killRequested`

#### `chatThreads` (missing fields + index)
- `guardianSessions: optional record<string, string>` — per-assignment forked session IDs (key = assignmentId)
- `lastReadAt: optional number` — unread tracking
- `assignmentsCreated: optional array<Id<"assignments">>` — multi-assignment history per thread
- `latestMessageAt: optional number` — denormalized
- **Index** to add: `by_latest_message`

#### `chatMessages` (missing field)
- `hint: optional string` — metadata for differential prompting

#### `chatJobs` (missing fields + indexes)
- `model: optional string`
- `toolCallCount`, `subagentCount`, `totalTokens`, `lastEventAt`, `exitForced`
- `killRequested: optional bool`
- **Indexes** to add: `by_thread_status`, `by_status_killRequested`

#### Brand-new tables (entirely missing from spec)
- **`reflections`** — V1 reflection capture (denormalized job metadata + 3 prose buckets + boolean rubric + keywords + CLI version + git SHAs). Schema in `schema.ts:117-149`. See `reflection-feedback-spec.md` and mental-model §Agent Reflection Feedback Loop.
- **`reflectionsV2`** — V2 reflection capture (narrative + `items[]` array of `{keywords, painPoint, suggestion}` + boolean rubric). Schema in `schema.ts:151-184`. See mental-model §Structural Direction.
- **`agentComms`** — lightweight peer-comms table (groupId, position, instance, message). Schema in `schema.ts:223-230`. Backs `agent-comms.mjs`.

### CLI section refresh

Source: live `npx tsx .agents/tools/workflow/cli.ts --help` output (captured during planning). New surface to document:
- `assignment [id] --nudge` — read-only pmNudge fetch (lightweight, env-var aware)
- `update-assignment` new flags: `--nudge <str>`, `--clear-nudge`, `--append-northstar <str>`, `--status <pending|active|blocked|complete>`
- `insert-job` new flag: `--jobs-file <path>` (escape heredoc/quoting)
- New env vars: `WORKFLOW_ARTIFACTS`, `WORKFLOW_DECISIONS` (append base for `update-assignment`)
- Removed: `block`, `unblock`, `complete` are gone — now `update-assignment --status`

### Known-issues section

Re-evaluate the "Known Issues and Considerations (2026-02-02)" section against
current code state. Items #1–#5 should be revisited; some may have been
addressed by Phase 12 (UncapJobChain) or Phase 10 (Operations Center).
Implementer decides: keep, prune, or replace with a fresh-as-of-2026-05-14 list.

### Cross-references to add

- Top of doc: "**Why-layer:** see [`mental-model.md`](mental-model.md) for intent and design principles."
- Reflection tables → link `reflection-feedback-spec.md`
- Harness/model fields → link `harness-model-config-spec.md`
- `awaiting_retry` status → link `mental-model.md#rate-limit-resilience`
- Guardian/`guardianSessions` → link `guardian-mode-spec.md` and `mental-model.md#session-context-isolation`
- Password protection on Convex → link `password-wall.md`
- Subscription efficiency → link `convex-bandwidth-optimization.md`

### Acceptance criteria

- [ ] Every field in `workflow-engine/convex/schema.ts` is reflected in the spec (table-by-table walk)
- [ ] Every index in the live schema is documented
- [ ] CLI section matches `cli.ts --help` output byte-equivalent (or with intentional summary that doesn't drop commands/flags)
- [ ] "Last Updated" = 2026-05-14
- [ ] Why-layer note links `mental-model.md`
- [ ] All cross-spec links resolve

### Suggested UAT slice

Pick three random fields from `schema.ts` (e.g., `jobs.retryAfter`,
`chatThreads.guardianSessions`, `reflectionsV2.items`) and grep them in the
spec to confirm round-trip presence. Pick three CLI commands and confirm the
spec's flags match `--help`.

---

## WP-4 — Workflow Engine UI Spec Rewrite

### Scope

Replace the 3-month-old content of
`docs/project/spec/workflow-engine-ui-spec.md` with the live state. The
existing spec describes a "Vanilla JavaScript application" with "No build
step" — both still true — but the component tree, surfaces, and feature set
have moved on substantially.

### Tech-stack corrections needed
- "Vanilla JavaScript, HTML, CSS" → React 18 via ESM imports (`https://esm.sh/react@18.2.0`), `React.createElement()` only (no JSX), Tailwind via CDN, Convex via ESM
- Add: marked + dompurify for markdown rendering, Service Worker registration, manifest.json (PWA)
- Add: importmap-based module loading

### Live component tree to document

From `workflow-engine/ui/js/components/`:

```
auth/           — Password wall (NEW since 2026-02-02)
  LoginGate, LoginForm, PasswordContext, index
chat/           — Operations center
  ChatView, ChatPanel, ChatSidebar, ChatHeader, ChatInput,
  ThreadList, ThreadItem, MessageList, MessageBubble, ModeToggle,
  AssignmentPane, index
effects/        — Visual effects layer (NEW)
  GrainOverlay, ScanlineSweep (exported from index)
introspection/  — Reflection dashboard (NEW)
  IntrospectionDashboard, index
job/            — Job visualization
  JobCard, JobChain, JobDetail, index
namespace/      — Namespace UI + settings modal
  NamespaceList, NamespaceCard, NamespaceHeader, NamespaceSettings, index
shared/         — Reusable primitives (entirely missing from spec)
  ConfirmDialog, EmptyState, ErrorBoundary, JsonViewer, LoadingSkeleton,
  QIcon, StatusBadge, Timestamp, index
```

### Surfaces missing from current spec (covered by mental-model.md)

1. **Password wall** (`auth/LoginGate`, `auth/LoginForm`, `auth/PasswordContext`) — see `password-wall.md` and mental-model §Security Model
2. **Cross-namespace operations center** — all-namespace thread list as default, namespace filter accordion, per-thread namespace badges — see mental-model §UI Mental Model
3. **Unread indicators** — torch-colored pulse on threads with messages after `lastReadAt` — binary, not counted
4. **Guardian-mode mode toggle** — already documented but needs to reflect 3-mode reality (jam/cook/guardian)
5. **AgentHUD job cards** — Quake HUD styling: HP=duration, ARM=idle, FRAGS=tool calls, etc. — see mental-model §Job Card Mental Model
6. **Kill button** — `killRequested` from UI on JobDetail / chat job — see mental-model §Agent Control
7. **Draft persistence** — per-thread draft state survives thread switching — see mental-model §Draft Persistence
8. **Assignment pane: pmNudge + north-star amendment surfaces** — see mental-model §Mid-Flight Assignment Modification
9. **Multi-assignment history** — `assignmentsCreated[]` navigation on AssignmentPane
10. **Introspection dashboard** — V2 reflections (post Phase 14): narrative + items + rubricV2 — see mental-model §Read-side cutover landed Phase 14
11. **NamespaceSettings modal** — harness/model config editor — see `harness-model-config-spec.md`
12. **Brandkit Q-palette + effects** — `GrainOverlay`, `ScanlineSweep`, `torchFlicker`, zero rounded corners — see mental-model §Quake Aesthetic Philosophy
13. **Responsive breakpoints** — mobile (<768), tablet (<1024), laptop (<1440), desktop (≥1440) — from `main.js:18-22`
14. **Mobile back-button handling** — popstate listener closes drawers instead of leaving the app

### Real-Time Updates section refresh

Current spec lists 5 queries. Live UI uses (at minimum):
- `api.namespaces.list`
- `api.chatThreads.listAll` (cross-namespace) and `api.chatThreads.list`
- `api.chatMessages.list`
- `api.assignments.getWithGroups`
- `api.jobs.byGroup`, `api.chatJobs.list`
- `api.reflectionsV2.*` (post Phase 14)
- `api.scheduler.watchQueue`, `api.scheduler.getHitList`

Implementer should grep the UI for actual `useQuery(api.*)` usages and list the live set.

### Cross-references to add

- Top of doc: "**Why-layer:** see [`mental-model.md`](mental-model.md) for intent, aesthetic, and information-priority decisions."
- Password wall section → `password-wall.md`
- Harness settings modal → `harness-model-config-spec.md`
- Introspection dashboard → `reflection-feedback-spec.md`
- Guardian mode UI → `guardian-mode-spec.md`
- Reactive subscription discipline → `convex-bandwidth-optimization.md`
- Aesthetic / brandkit → `docs/project/guides/styleguide/brandkit.jsx` (file pointer, not a link target — brandkit is JSX source, not docs)

### "Pending Enhancements" section

Current list (assignment creation from UI, job result viewing, guardian
actions, responsive design) is largely **shipped**. Implementer reviews and
either removes or replaces with a current pending-list (or drops the section
entirely if nothing is pending).

### Acceptance criteria

- [ ] Component architecture diagram matches actual `find workflow-engine/ui/js/components -type d` output
- [ ] Every component file under `workflow-engine/ui/js/components/` is named in the spec (or explicitly mentioned as a sub-piece)
- [ ] All 14 surfaces from "Surfaces missing" section are documented with at least a paragraph
- [ ] Tech-stack section says React 18 + ESM imports + `React.createElement`, not "Vanilla JavaScript"
- [ ] `Open ui/index.html in browser` (current development instructions) → replaced with the live `nohup npm start > /tmp/ui-server.log 2>&1 &` from `workflow-engine/ui/` (from CLAUDE.md memory)
- [ ] "Last Updated" = 2026-05-14
- [ ] Why-layer note links `mental-model.md`

### Suggested UAT slice

Open `localhost:3000`, walk through: login wall → namespace list → all-thread
list with mixed-namespace items → click a thread → mode toggle (jam/cook/guardian)
→ assignment pane → kill button on a running job → introspection dashboard.
For each surface visited, confirm the spec describes a recognizable artifact.

---

## Dependency Map (Parallelization Opportunities)

```
              ┌──────────────────────────────────────────────────┐
              │  WP-1 Demolition + Link Repair                   │
              │  (touches: docs/spec/, archive/, guides/, .claude│
              │   commands/learn.md, system-diagram.md)          │
              └────────────────────────┬─────────────────────────┘
                                       │ enables clean Documentation Hub
                                       ▼
              ┌──────────────────────────────────────────────────┐
              │  WP-2 README Refresh                             │
              │  (touches: README.md only)                       │
              └──────────────────────────────────────────────────┘

              ┌──────────────────────────────────────────────────┐
              │  WP-3 Workflow Engine Spec Rewrite               │
              │  (touches: workflow-engine-spec.md only)         │  ← parallel
              └──────────────────────────────────────────────────┘

              ┌──────────────────────────────────────────────────┐
              │  WP-4 Workflow Engine UI Spec Rewrite            │
              │  (touches: workflow-engine-ui-spec.md only)      │  ← parallel
              └──────────────────────────────────────────────────┘
```

**Parallel-safe set:** WP-1, WP-3, WP-4 can all run simultaneously (no shared
files). WP-2 should follow WP-1 so that the Documentation Hub doesn't
temporarily reference paths that are mid-move.

**Recommended sequencing:**
- **Batch A (parallel):** WP-1, WP-3, WP-4 — three implement jobs
- **Batch B (sequential):** WP-2 — single implement job after WP-1 lands
- **Batch C (sequential):** UAT pass that exercises all four WPs together (link check + visual review)

If single-thread execution is preferred: WP-1 → WP-2 → WP-3 → WP-4. The
specs (WP-3, WP-4) are deepest and can absorb any cycle-time savings from
parallelism but don't block on each other.

---

## Assignment-Level Success Criteria

A fresh contributor (human or agent) reading `docs/` after this phase ships:

1. **Encounters no live references to CC2 systems** — `rg 'orchestration-guide|consultant-paradigm|docs/spec/' docs/project/guides docs/project/spec README.md .claude/` returns only historical receipts (the four phases/spec files in the "leave-alone" list).
2. **Sees an accurate schema spec** — every table, field, status union, and index in `workflow-engine/convex/schema.ts` is described in `workflow-engine-spec.md`. Reflection tables (V1+V2) are documented. Phase 10 fields (killRequested, pmNudge, lastReadAt, assignmentsCreated, guardianSessions) are documented. `awaiting_retry` + retry fields are documented.
3. **Sees an accurate UI spec** — `workflow-engine-ui-spec.md` reflects React-via-ESM + `React.createElement` + Q-palette + the live component tree (auth/, chat/, effects/, introspection/, job/, namespace/, shared/). All 14 mental-model surfaces have at least a paragraph.
4. **Hits a working README front-door** — port `:3000` everywhere, no empty heading, Documentation Hub links resolve and cover all live specs, peer-comms CLI syntax matches `agent-comms.mjs --help`.
5. **`mental-model.md` is untouched** and is the consistent why-layer authority that both specs cross-reference at the top.

---

## Ambiguities / Open Questions for User

None that block planning. The three planner judgment calls below are
recorded under "Decisions" and can be reversed if the user disagrees:

1. **Pure archive move, not shim files.** If the user wants tombstones at the
   original paths (`docs/project/guides/orchestration-guide.md` → 5-line file
   saying "moved to archive, see workflow-engine-spec.md"), reverse this.
2. **Delete empty `### Getting Started` heading in README.** If the user
   wants it filled instead (e.g., expanded `/cc3-server` walkthrough), reverse
   this — but then mention that `Quick Start` at top should probably collapse
   into it.
3. **Remove `docs/spec/` directory after archive.** If the user wants the
   directory preserved as a placeholder (with a README explaining the move),
   reverse this.

Minor open item: should `v2-release-notes.md` get a "→ resolved in Phase 15"
pointer on its "Known gaps #3, #4" entries? Cleaner trail for future grepping,
but technically a retroactive edit to a historical receipt. **Default: no.**

---

## Recommended Job Sequence

For PM to consider:

1. **Batch A — parallel implement (3 jobs):** WP-1, WP-3, WP-4 — independent
   doc surfaces, no merge conflict potential.
2. **WP-2 implement:** single sequential job, depends on WP-1 (Documentation
   Hub link list is finalized only after archived doc paths are confirmed
   dead).
3. **UAT slice:** single manual-QA job exercising all four acceptance-
   criteria sets — link check, port check, schema round-trip spot-check,
   live-UI surface spot-check. No browser-automation needed; manual visual
   diff + grep checks are sufficient since validation is "doc reflects
   reality."

Review jobs are **not recommended** as a separate batch for this assignment.
Doc accuracy is verified by direct comparison to live source (schema, UI
files, CLI `--help`); independent review adds no signal beyond what the UAT
slice covers.

---

## Decisions (to record via `update-assignment --decisions`)

1. **D15.1:** Demolition is pure archive move — no shim files left at original paths. Rationale: `v2-release-notes.md` already plays the "what was deleted and why" role; shim tombstones create grep false-positives.
2. **D15.2:** README's empty `### Getting Started` heading is **deleted** (not filled). Rationale: 🚀 Quick Start at top already covers `/cc3-server` entry — duplicate is worse than missing.
3. **D15.3:** `docs/spec/` directory is **removed** after its two files archive. Rationale: empty placeholder misleads tree-walkers; `docs/project/spec/` is the canonical spec home.
4. **D15.4:** `v2-release-notes.md` "Known gaps #3, #4" entries stay as-is, no "→ resolved in Phase 15" pointer added. Rationale: historical receipt should reflect what the v2 release shipped with, not be revised retroactively.
5. **D15.5:** No browser automation in UAT — manual link check + grep round-trip is sufficient for a docs-only phase.
