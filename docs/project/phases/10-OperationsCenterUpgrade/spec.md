# Phase 10 — Operations Center Upgrade

**Status: COMPLETION REVIEWED** — All 7 work packages implemented, validated (tsc + syntax check pass), 6 post-review fixes applied and PM-verified. Awaiting manual UAT by user.

## Purpose

The user manages AI agent work across multiple namespaces simultaneously. The current UI forces single-namespace views, has no unread indicators, loses draft text when switching threads, shows only one assignment per thread, and provides no way to kill runaway agents or change assignment status from the UI. This upgrade transforms the Workflow Engine UI from a single-namespace viewer into a cross-namespace **operations center** — the control terminal described in the mental model.

## Overview

Nine acceptance criteria (U1–U6, B1, R1–R2) spanning schema changes, backend mutations/queries, UI component rewrites, CLI modifications, and runner-side kill hooks. All schema changes are additive (`v.optional()`) for backward compatibility with runners in other repos.

---

## Architecture Design

### Data Flow Summary

```
UI ←→ Convex Backend ←→ Runner/CLI
         ↑
   Schema (source of truth)
```

**Key principle**: Schema changes land first, backend functions second, then UI consumes them. CLI changes are isolated to the `linkAssignment` path only.

### Component Architecture (Current → Target)

**Current layout hierarchy:**
```
App
 └─ AppLayout
     ├─ NamespaceList (sidebar — selects ONE namespace)
     └─ ChatPanel (scoped to selectedNamespace)
         ├─ ThreadsPane (lists threads for ONE namespace)
         │   └─ ChatSidebar → ThreadList → ThreadItem
         ├─ ChatView
         │   ├─ ChatHeader
         │   ├─ MessageList
         │   └─ ChatInput
         └─ AssignmentPane (single assignment)
```

**Target layout hierarchy:**
```
App
 └─ AppLayout
     ├─ NamespaceList (sidebar — branding + connection only, no namespace selection)
     └─ ChatPanel (ALL namespaces — no namespace prop needed)
         ├─ ThreadsPane (merged threads+namespace drawer)
         │   ├─ NamespaceFilter (collapsed accordion, multi-select toggle)
         │   └─ ChatSidebar → ThreadList → ThreadItem (+ namespace badge, + unread dot)
         ├─ ChatView
         │   ├─ ChatHeader
         │   ├─ MessageList (triggers markRead on render)
         │   └─ ChatInput (with per-thread draft persistence)
         └─ AssignmentPane (multi-assignment nav + status editing)
```

### Schema Changes (All Optional)

| Table | Field | Type | Purpose | Criteria |
|-------|-------|------|---------|----------|
| `chatThreads` | `lastReadAt` | `v.optional(v.number())` | Unread tracking | B1 |
| `chatThreads` | `assignmentsCreated` | `v.optional(v.array(v.id("assignments")))` | Multi-assignment history | U6 |
| `jobs` | `killRequested` | `v.optional(v.boolean())` | Agent kill signal | R1 |
| `chatJobs` | `killRequested` | `v.optional(v.boolean())` | Chat job kill signal | R1, R2 |

### New/Modified Backend Functions

| Module | Function | Type | Purpose | Criteria |
|--------|----------|------|---------|----------|
| `chatThreads` | `listAll` (modify) | Query | Return ALL threads cross-namespace, ordered by `updatedAt` desc | U1 |
| `chatThreads` | `markRead` (new) | Mutation | Set `lastReadAt = Date.now()` on a thread | B1 |
| `chatThreads` | `linkAssignment` (modify) | Mutation | Also push `assignmentId` into `assignmentsCreated` array | U6 |
| `chatThreads` | `updateFocusAssignment` (new) | Mutation | Change `assignmentId` focus pointer to a different assignment from `assignmentsCreated` | U6 |
| `chatMessages` | `getLatestTimestamp` (new) | Query | Return `createdAt` of the most recent message in a thread (for unread calc) | B1 |
| `jobs` | `requestKill` (new) | Mutation | Set `killRequested = true` on a job | R1 |
| `chatJobs` | `requestKill` (new) | Mutation | Set `killRequested = true` on a chatJob | R1, R2 |
| `assignments` | `update` (existing) | Mutation | Already supports status change — no modification needed | U5 |

### UI API Layer Changes (`api.js`)

Add entries for new functions:
```js
chatThreads: {
  ...existing,
  listAll: "chatThreads:listAll",
  markRead: "chatThreads:markRead",
  updateFocusAssignment: "chatThreads:updateFocusAssignment",
},
chatMessages: {
  ...existing,
  getLatestTimestamp: "chatMessages:getLatestTimestamp",
},
assignments: {
  ...existing,
  update: "assignments:update",  // already exists in backend, add to api.js
},
jobs: {
  ...existing,
  requestKill: "jobs:requestKill",
},
chatJobs: {
  ...existing,
  requestKill: "chatJobs:requestKill",
}
```

### CLI Change (`cli.ts`)

In `createAssignment`, after `chatThreads.linkAssignment`, also call a push to `assignmentsCreated`. However, since `linkAssignment` itself will handle this (modified mutation), no additional CLI call is needed — the mutation change covers it.

### Draft Persistence Strategy

**Hybrid approach**: React state (`useRef` with a `Map<threadId, draftText>`) for in-memory speed during thread switching, plus debounced `localStorage` writes (keyed `workflow-engine:draft:<threadId>`) for refresh survival.

- On thread switch: save current draft to Map + trigger debounced localStorage write; load new thread's draft from Map (or localStorage on first load).
- On send: clear the draft from both Map and localStorage.
- ChatInput receives `draftText` and `onDraftChange` props from ChatPanel.

### Kill Mechanism Design

**Signal path**: UI sets `killRequested=true` → Runner polls job status (already does for `status` field) → Runner checks `killRequested` → SIGTERM → wait 5s → SIGKILL if still alive → mark job `failed` with result "Killed by user".

**Race condition handling**: If job completes while kill is in-flight, the runner ignores `killRequested` since the job is already terminal. The `requestKill` mutation only operates on `running` or `pending` jobs.

**UI state**: Button immediately shows "Killing..." after mutation call. Convex subscription updates status reactively when runner marks job as failed/complete.

---

## Dependency Map

```
                    ┌──────────────────┐
                    │   WP-1: Schema   │
                    │   (Foundation)    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────▼──────┐ ┌────▼──────┐ ┌─────▼────────┐
    │ WP-2: Backend  │ │ WP-3: CLI │ │ WP-4: API.js │
    │ (Queries/Muts) │ │ (linkAsn) │ │ (References)  │
    └───────┬────────┘ └───────────┘ └──────┬────────┘
            │                               │
            └──────────┬────────────────────┘
                       │
         ┌─────────────┼──────────────────┐
         │             │                  │
   ┌─────▼─────┐ ┌────▼──────┐ ┌─────────▼──────────┐
   │ WP-5: UI  │ │ WP-6: UI  │ │ WP-7: UI           │
   │ Thread    │ │ Chat &    │ │ Assignment &        │
   │ Mgmt      │ │ Drafts    │ │ Agent Control       │
   │ U1,U2,U3  │ │ B1,U4    │ │ U5,U6,R1,R2        │
   └───────────┘ └───────────┘ └─────────────────────┘
```

**Parallelization opportunities:**
- WP-2, WP-3, WP-4 can run in parallel after WP-1.
- WP-5, WP-6, WP-7 can run in parallel after WP-2 + WP-4 complete.

---

## Work Package Breakdown

### WP-1: Schema Additions (Foundation) — COMPLETE

**Scope**: Add 4 optional fields across 3 tables.

**Files changed:**
- `workflow-engine/convex/schema.ts`

**Changes:**
1. `chatThreads` table: Add `lastReadAt: v.optional(v.number())` and `assignmentsCreated: v.optional(v.array(v.id("assignments")))`
2. `jobs` table: Add `killRequested: v.optional(v.boolean())`
3. `chatJobs` table: Add `killRequested: v.optional(v.boolean())`

**Success criteria:**
- `pnpm ts:check` passes with new schema fields.
- `pnpm build` succeeds (Convex schema deploys without error).
- All new fields are `v.optional()` — existing documents remain valid.
- Existing runners continue to function (no required field additions).

---

### WP-2: Backend Functions (Queries & Mutations) — COMPLETE

**Scope**: New and modified Convex functions to support all acceptance criteria.

**Files changed:**
- `workflow-engine/convex/chatThreads.ts`
- `workflow-engine/convex/chatMessages.ts`
- `workflow-engine/convex/jobs.ts`
- `workflow-engine/convex/chatJobs.ts`

**Changes:**

**chatThreads.ts:**
1. **Modify `listAll`**: Currently returns all threads unordered. Change to order by `updatedAt` desc. This becomes the primary thread list query for the cross-namespace view.
2. **New `markRead` mutation**: Args `{ password, id: v.id("chatThreads") }`. Sets `lastReadAt: Date.now()`.
3. **Modify `linkAssignment` mutation**: After patching `assignmentId`, also push the `assignmentId` into the `assignmentsCreated` array (initialize array if null, avoid duplicates).
4. **New `updateFocusAssignment` mutation**: Args `{ password, id: v.id("chatThreads"), assignmentId: v.id("assignments") }`. Validates `assignmentId` is in `assignmentsCreated` array, then patches `assignmentId` as the new focus pointer.

**chatMessages.ts:**
5. **New `getLatestTimestamp` query**: Args `{ password, threadId: v.id("chatThreads") }`. Uses `by_thread_created` index, orders desc, takes first, returns `createdAt` (or null). Lightweight query for unread calculation.

**jobs.ts:**
6. **New `requestKill` mutation**: Args `{ password, id: v.id("jobs") }`. Guards: only operates if job `status` is `"running"` or `"pending"`. Sets `killRequested: true`.

**chatJobs.ts:**
7. **New `requestKill` mutation**: Args `{ password, id: v.id("chatJobs") }`. Guards: only operates if job `status` is `"running"` or `"pending"`. Sets `killRequested: true`.

**Success criteria:**
- All new functions type-check and build.
- `markRead` sets `lastReadAt` to current timestamp.
- Modified `linkAssignment` pushes to `assignmentsCreated` array without duplicates.
- `updateFocusAssignment` rejects IDs not in the `assignmentsCreated` array.
- `requestKill` mutations only operate on non-terminal jobs.
- `getLatestTimestamp` returns `null` for empty threads and a number for threads with messages.

---

### WP-3: CLI Modification — COMPLETE (no-op)

**Scope**: The `linkAssignment` mutation change in WP-2 covers the CLI case automatically — when the CLI calls `chatThreads.linkAssignment`, the mutation now handles both the focus pointer update AND the `assignmentsCreated` push. No CLI code change needed.

**Files changed:** None (mutation-level change handles it).

**Success criteria:**
- CLI `createAssignment --threadId` still works.
- The `assignmentsCreated` array is populated server-side by the mutation.

---

### WP-4: API Layer Update — COMPLETE

**Scope**: Add new function references to the UI API module.

**Files changed:**
- `workflow-engine/ui/js/api.js`

**Changes:**
1. Add `chatThreads.listAll`, `chatThreads.markRead`, `chatThreads.updateFocusAssignment`
2. Add `chatMessages.getLatestTimestamp`
3. Add `assignments.update` (already exists in backend, missing from api.js)
4. Add `jobs.requestKill`, `chatJobs.requestKill`

**Success criteria:**
- All new API references match the backend function names exactly.
- Existing references remain unchanged.

---

### WP-5: UI — Thread Management (U1, U2, U3, B1-display) — COMPLETE

**Scope**: Merge namespace drawer into thread drawer, multi-select namespace filter, namespace badge on threads, unread indicators.

**Files changed:**
- `workflow-engine/ui/js/main.js` (AppLayout — remove namespace selection dependency)
- `workflow-engine/ui/js/components/chat/ChatPanel.js` (switch from `chatThreads.list` per-namespace to `chatThreads.listAll`, add namespace filter state, subscribe to `markRead`)
- `workflow-engine/ui/js/components/chat/ChatSidebar.js` (add namespace filter accordion above thread list)
- `workflow-engine/ui/js/components/chat/ThreadList.js` (pass namespace info through, handle filtered list)
- `workflow-engine/ui/js/components/chat/ThreadItem.js` (add namespace badge, add unread indicator Fullbright dot)
- `workflow-engine/ui/js/components/namespace/NamespaceList.js` (simplify to branding-only sidebar, remove namespace selection)
- `workflow-engine/ui/js/components/namespace/NamespaceCard.js` (may be repurposed as filter chip)

**Design details:**

**U1 — Merged drawer:**
- `AppLayout` no longer tracks `selectedNamespaceName`. ChatPanel receives all namespaces.
- `NamespaceList` sidebar becomes a slim branding sidebar (CC3 logo, connection status, collapse toggle). No namespace cards.
- Namespace filter moves into the threads pane as a collapsible accordion section.

**U2 — Multi-select filter:**
- State: `Set<namespaceId>` in ChatPanel. Empty set = all shown (default).
- Accordion toggle chips per namespace. Clicking toggles membership in the set.
- Thread query uses `chatThreads.listAll` (all threads), filtered client-side by the active namespace set.

**U3 — Namespace label:**
- ThreadItem receives `namespaceName` prop.
- Display as a small badge (Q palette `stone3` background, `bone1` text, display font) above or beside the thread title.
- Requires joining namespace data: ChatPanel subscribes to `namespaces.list` and passes a `namespaceMap` (id→name) to ThreadList.

**B1 (display) — Unread indicator:**
- ThreadItem receives `lastReadAt` (from thread) and `latestMessageAt` (from separate query or enriched data).
- If `latestMessageAt > lastReadAt` (or `lastReadAt` is null and messages exist), show a Fullbright dot (torch color, pulsing).
- Unread calculation: For efficiency, use a per-thread `getLatestTimestamp` subscription only for visible threads (virtualized), OR batch into the `listAll` query by having it join latest message timestamps server-side. **Decision: Enrich `listAll` server-side** — the query already reads all threads; adding a single `by_thread_created` desc first lookup per thread is O(N) but avoids N separate subscriptions.

**Success criteria:**
- Namespace drawer is removed; namespaces appear as filter accordion in threads pane.
- Accordion collapsed by default. 0 selected = all threads shown.
- Each thread item shows a namespace badge.
- Unread dot appears on threads with messages newer than `lastReadAt`.
- Thread list shows threads from ALL namespaces sorted by `updatedAt` desc.
- All existing responsive behaviors (mobile drawer, collapse, etc.) still work.

---

### WP-6: UI — Chat & Drafts (B1-write, U4) — COMPLETE

**Scope**: Mark threads as read when messages render, persist drafts per thread.

**Files changed:**
- `workflow-engine/ui/js/components/chat/ChatPanel.js` (draft state management, markRead on thread selection)
- `workflow-engine/ui/js/components/chat/ChatInput.js` (accept `draftText`/`onDraftChange` props)
- `workflow-engine/ui/js/components/chat/MessageList.js` (trigger markRead when messages render)

**Design details:**

**B1 (write) — Mark as read:**
- In `ChatPanel`, when `selectedThreadId` changes and messages load, call `chatThreads.markRead({ id: selectedThreadId })`.
- Debounce: call markRead once on thread selection + when new messages arrive while thread is active.
- In `MessageList`: use an `useEffect` that fires when `messages` array changes, calling a `onMarkRead` callback from ChatPanel.

**U4 — Draft persistence:**
- `ChatPanel` maintains a `useRef<Map<string, string>>()` for in-memory drafts.
- On thread switch: save `currentDraft` to map + debounced localStorage write; load new thread's draft from map.
- `ChatInput` receives `value` prop (controlled component pattern) and `onChange` prop.
- On send success: clear draft from map and localStorage.
- localStorage key pattern: `workflow-engine:draft:<threadId>`

**Success criteria:**
- Switching away from a thread and back preserves typed text.
- Draft survives page refresh (localStorage).
- Sending a message clears the draft.
- `lastReadAt` is updated when a thread's messages are viewed.
- No unread dot on the currently viewed thread.

---

### WP-7: UI — Assignment & Agent Control (U5, U6, R1, R2) — COMPLETE

**Scope**: Status editing, multi-assignment navigation, kill buttons.

**Files changed:**
- `workflow-engine/ui/js/components/chat/AssignmentPane.js` (status pill dropdown, multi-assignment nav)
- `workflow-engine/ui/js/components/chat/ChatPanel.js` (handle assignment focus changes, pass kill handlers)
- `workflow-engine/ui/js/components/chat/ChatView.js` (add Stop/Interrupt button for active chatJob)
- `workflow-engine/ui/js/components/job/JobDetail.js` (add Kill button for running jobs)

**Design details:**

**U5 — Status editing:**
- In `AssignmentPane`, the status currently displays as text. Replace with a clickable pill.
- On click: show a dropdown with options `pending`, `active`, `blocked` (not `complete` — complete is a terminal action via separate flow).
- Selecting calls `assignments.update({ id, status: newStatus })`.
- Optimistic update: immediately reflect in UI via Convex subscription.
- Style: dropdown with Q palette — stone2 background, copper border, bone3 text. Selected item highlighted with torch.

**U6 — Multi-assignment navigation:**
- `AssignmentPane` header shows current assignment index and total: "Assignment 2/3" with prev/next buttons.
- Data source: `thread.assignmentsCreated` array.
- Clicking prev/next calls `chatThreads.updateFocusAssignment({ id: threadId, assignmentId: targetId })`.
- ChatPanel re-subscribes to the new assignment via `assignments.get`.
- Navigation controls hidden when `assignmentsCreated` has 0 or 1 entries.

**R1 — Kill agent:**
- `JobDetail` modal adds a Kill button when job status is `"running"`.
- Button calls `jobs.requestKill({ id: jobId })`.
- After mutation: button shows "Kill Requested" (disabled, lava-colored).
- Runner-side: not implemented here (additive — old runners ignore the field). Document the expected runner behavior for separate implementation.

**R2 — Interrupt chat job:**
- `ChatView` (or `ChatInput` area) shows a Stop button when `activeChatJob` is truthy.
- Button calls `chatJobs.requestKill({ id: activeChatJob._id })`.
- After click: button shows "Stopping..." and the typing indicator remains until the runner marks the job terminal.
- Thread remains conversational — user can send a follow-up.
- Style: Quake skull icon (QIcon `skull`), lava palette.

**Success criteria:**
- Clicking assignment status opens dropdown; selecting a status updates it.
- Multi-assignment nav shows prev/next when 2+ assignments linked.
- Clicking nav changes the focused assignment in the pane.
- Kill button appears on running jobs in the job detail modal.
- Kill button calls `requestKill` mutation and disables itself.
- Stop button appears during active chatJob; clicking it fires `requestKill`.
- Thread remains usable after chat job interruption.

---

## Assignment-Level Success Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| S1 | All schema changes are `v.optional()` | Code review of `schema.ts` |
| S2 | `pnpm ts:check && pnpm build && pnpm lint` pass | CI/manual run |
| S3 | Threads from all namespaces appear in single unified list | Visual: thread list shows mixed namespaces |
| S4 | Namespace accordion filter works (multi-select, 0=all) | Visual: toggle namespaces, verify filtering |
| S5 | Each thread shows a namespace badge | Visual: badge visible on each thread item |
| S6 | Unread dot appears on threads with new messages | Visual: send a message, switch threads, verify dot |
| S7 | Draft text survives thread switching | Functional: type text, switch away, switch back |
| S8 | Draft survives page refresh | Functional: type text, refresh, verify restoration |
| S9 | Assignment status is editable from the UI | Functional: click status pill, select new status, verify change |
| S10 | Multi-assignment navigation works | Functional: thread with 2+ assignments shows nav, clicking switches focus |
| S11 | Kill button appears on running jobs | Visual: open job detail for running job, verify button |
| S12 | Stop button appears during active chatJob | Visual: send message, verify stop button while processing |
| S13 | Existing runners continue to work without modification | Integration: runner processes jobs normally with new schema |
| S14 | Mobile responsive behavior preserved | Visual: test on mobile viewport |

---

## Ambiguities & Decisions

### D1: Unread count — per-subscription vs server-enriched
**Decision**: Enrich `chatThreads.listAll` server-side to include `latestMessageAt` per thread. This avoids N separate subscriptions and is O(N) within a single query. The query already reads all threads; adding one indexed lookup per thread is acceptable for typical namespace sizes (<100 threads).

### D2: Namespace filter — client-side vs server-side
**Decision**: Client-side filtering. `chatThreads.listAll` returns all threads; the UI filters by selected namespace IDs. This keeps the query simple and avoids dynamic query parameters that would create new Convex subscriptions per filter combination.

### D3: Draft persistence scope
**Decision**: In-memory `Map` + debounced `localStorage`. Drafts survive refresh. No server-side persistence (overkill for single-user).

### D4: Kill mechanism — runner polling
**Runner behavior** (documented, not implemented in this phase): Runner should check `killRequested` on its tracked jobs during its existing polling loop. When detected, send SIGTERM, wait 5s, SIGKILL if still alive, then mark job as `failed` with result "Killed by user". This is additive — runners without this code simply ignore the field.

### D5: Assignment status editing — which statuses are allowed?
**Decision**: Dropdown shows `pending`, `active`, `blocked`. `complete` is excluded from the dropdown — it requires explicit completion via the existing `assignments.complete` mutation (which has different side effects like namespace count updates). The user can add `complete` to the dropdown later if desired.

### Q1 (Resolved): Should the `listAll` enrichment include message count or just latest timestamp?
**Decision**: Just `latestMessageAt` — it's sufficient for unread comparison and avoids the cost of counting all messages per thread. Unread dot is binary (has unread / doesn't), not a count. Implemented as designed.

### D6: Validation scope
**Decision**: `tsc --noEmit` (exit 0) + `node --check` syntax validation on all 36 JS files. No lint/test/build scripts configured in pnpm root — validation scoped to tsc + syntax.

### D7: enableGuardianMode must push to assignmentsCreated
**Decision**: `enableGuardianMode` now mirrors `linkAssignment` dedup logic — reads thread first, computes `assignmentsCreated` with dedup, single atomic `ctx.db.patch`. Consistent pattern across both assignment-linking paths.

### D8: linkAssignment consolidated to single patch
**Decision**: `linkAssignment` refactored from double-patch to read→compute→single-patch. Eliminates partial-update race condition where the second patch could fail leaving an inconsistent state.

### D9: StatusPill dropdown positioning
**Decision**: StatusPill dropdown uses `position: fixed` with `getBoundingClientRect()` — simpler than a portal, cleanly escapes all `overflow: hidden` ancestors in the assignment pane.

### D10: All borderRadius violations fixed to 0
**Decision**: All `borderRadius: 9999px` violations in Phase 10 code fixed to `0` per brandkit mandate (zero rounded corners). Legacy `NamespaceCard.js` retains its existing `borderRadius` as out-of-scope.

### D11: Namespace filter auto-reselects first visible thread
**Decision**: Added `useEffect` in `ChatPanel.js` that auto-selects the first visible thread when namespace filter changes hide the currently selected thread. Prevents empty-state confusion.

### D12: markRead Server Error is deployment-only
**Decision**: The `markRead` mutation code is correct but requires Convex redeployment to register the new function. "Server Error" during UAT is not a code bug — it resolves after `npx convex deploy`.

### D13: PM-verified all 6 fixes applied correctly
**Decision**: All 6 post-review fixes (FIX-1 through FIX-6) verified against codebase by PM. Code matches expected patterns. Phase is completion-review eligible.

---

## Recommended Job Sequence

```
1. WP-1: Schema     ─── implement ─── validate (build/typecheck)
2. WP-2: Backend    ─┐
   WP-4: API.js     ─┤── implement in parallel ─── validate
   WP-3: CLI (noop) ─┘
3. WP-5: Thread Mgmt ─┐
   WP-6: Chat/Drafts  ─┤── implement in parallel ─── validate
   WP-7: Agent Control ─┘
4. Manual UAT by user (no automated UAT job)
```

**Rationale**: Schema first because everything depends on it. Backend + API + CLI form a parallel layer. UI work packages are independent of each other (different components) and can be parallelized. No UAT job — user tests manually per the north star constraints.

---

## Implementation Summary

**Completed**: All 7 WPs across 21 files. Post-review: 6 fixes applied across 5 files.

### Files Modified
- **Schema**: `workflow-engine/convex/schema.ts` — 4 new optional fields
- **Backend**: `chatThreads.ts` (4 functions: listAll modified, markRead/linkAssignment modified/updateFocusAssignment new; post-review: enableGuardianMode + linkAssignment atomicity fixes), `chatMessages.ts` (getLatestTimestamp new), `jobs.ts` (requestKill new), `chatJobs.ts` (requestKill new)
- **API Layer**: `workflow-engine/ui/js/api.js` — 7 new string references
- **UI**: `main.js`, `ChatPanel.js` (post-review: namespace filter auto-reselect, hamburger aria-label fix), `ChatSidebar.js`, `ThreadList.js`, `ThreadItem.js` (post-review: borderRadius fix), `NamespaceList.js` (post-review: borderRadius fix), `ChatInput.js`, `ChatView.js`, `MessageList.js`, `AssignmentPane.js` (post-review: StatusPill position:fixed, borderRadius fix), `JobDetail.js`, `JobChain.js` (post-review: borderRadius fix)

### Deviations from Spec
- **None material** — all acceptance criteria implemented as specified.
- `NamespaceCard.js` was not repurposed as a filter chip; the chip component was built inline in `ChatSidebar.js` instead.

### Post-Review Fixes Applied
| Fix | Severity | Files | Summary |
|-----|----------|-------|---------|
| FIX-1 | HIGH | `chatThreads.ts` | `enableGuardianMode` now reads thread, computes `assignmentsCreated` with dedup, single atomic patch (D7) |
| FIX-2 | HIGH | `chatThreads.ts` | `linkAssignment` refactored to read→single-patch, eliminates partial-update race (D8) |
| FIX-3 | MED | `AssignmentPane.js` | StatusPill dropdown `position: fixed` with `getBoundingClientRect()` (D9) |
| FIX-4 | MED | `AssignmentPane.js`, `JobChain.js`, `ThreadItem.js`, `NamespaceList.js` | All `borderRadius` violations → `0` (D10) |
| FIX-5 | MED | `ChatPanel.js` | Auto-select first visible thread on namespace filter change (D11) |
| FIX-6 | LOW | `ChatPanel.js` | Mobile hamburger aria-label "Open namespaces" → "Open sidebar" |

### Pending
- **Manual UAT** by user (per north star: no automated UAT job for this assignment)
- **Convex redeployment** required for `markRead` and other new backend functions to register (D12)
- **Runner-side kill** (D4) — `killRequested` flag is set by UI, but runner process termination logic is additive/separate work

---

## Spec Doc Path

`docs/project/phases/10-OperationsCenterUpgrade/spec.md`
