# Phase 12: Uncap Job Chain — Two-Tier Subscription Architecture

## Purpose

The assignment pane's job chain visualization hardcodes 20 `useQuery` subscriptions — one per group. Assignments with >20 groups show wrong rollup metrics (TIME/FRAGS/DMG/FIENDS are underreported), groups beyond 20 are invisible, and their jobs are inaccessible. This phase removes the cap so ALL jobs in an assignment are visible with accurate metrics, while *reducing* total Convex subscription count from 20+ to exactly 2.

## Overview

Replace the 20 hardcoded per-group `useQuery` hooks with a two-tier query architecture:

| Tier | Name | What it returns | Invalidation frequency |
|------|------|----------------|----------------------|
| **Tier 1** | Archive | All groups in chain order + jobs for terminal groups (complete/failed) | Rare — only on group transition or chain growth |
| **Tier 2** | Live Wire | Non-terminal groups + their jobs | Frequent — expected, but payload is tiny (0-2 groups) |

The client merges both tiers. Live data wins for active groups. When a group completes, the archive absorbs it on next invalidation.

## Architecture Design

### Convex Reactivity Model (Key Constraint)

Convex invalidates at **query granularity**: when any document a query read changes, the entire query re-runs and the full result is re-sent to the client. This means:

- A single query reading 100 docs re-sends all 100 when any one changes
- Terminal job data is immutable (complete/failed jobs never change) — safe to bulk-fetch
- Active job data changes frequently (metrics updates) — must be isolated to a small query

This is why two tiers exist: the archive query reads many docs but rarely invalidates; the live query invalidates often but reads few docs.

### Data Flow

```
Convex Backend                          Frontend (AssignmentPane)
                                        
assignments.getChainWithTerminalJobs    useQuery (Tier 1: Archive)
  - Walk linked list (headGroupId →)        │
  - For each group:                         │
    - Include group metadata                │
    - If terminal: fetch + include jobs     │
    - If active: jobs = [] flag             │
                                            ▼
jobs.getActiveGroupsWithJobs            useQuery (Tier 2: Live Wire)
  - Index: jobGroups.by_assignment          │
  - Filter: status != complete/failed       │
  - For each active group: fetch jobs       │
                                            ▼
                                        useMemo: Merge
                                          - Archive provides chain order
                                          - Archive provides terminal jobs
                                          - Live provides active group jobs
                                          - Live wins when both have data
                                            │
                                            ▼
                                        JobChain receives groups[]
                                        (all groups, all jobs, no cap)
```

### Backend: New Convex Queries

#### 1. `assignments.getChainWithTerminalJobs`

Replaces `getGroupChain` (which returned groups-only, no jobs).

```typescript
// assignments.ts
export const getChainWithTerminalJobs = query({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (!assignment) return null;

    const groups = [];
    let currentGroupId = assignment.headGroupId;
    while (currentGroupId) {
      const group = await ctx.db.get(currentGroupId);
      if (!group) break;

      const isTerminal = group.status === "complete" || group.status === "failed";
      let jobs = [];
      if (isTerminal) {
        jobs = await ctx.db
          .query("jobs")
          .withIndex("by_group", (q) => q.eq("groupId", currentGroupId!))
          .collect();
      }

      groups.push({
        _id: group._id,
        status: group.status,
        nextGroupId: group.nextGroupId,
        createdAt: group.createdAt,
        assignmentId: group.assignmentId,
        aggregatedResult: group.aggregatedResult,
        jobs,
        isTerminal,
      });
      currentGroupId = group.nextGroupId;
    }

    return { ...assignment, groups };
  },
});
```

**Invalidation profile:** Re-runs when:
- Assignment doc changes (headGroupId updated when new group added)
- Any group doc changes (status transition — rare, ~1 per PM cycle)
- Any terminal job doc changes (never — they're immutable)

**Does NOT re-run when:**
- Active job metrics update (active jobs not read by this query)

#### 2. `jobs.getActiveGroupsWithJobs`

New query — fetches only non-terminal group data.

```typescript
// jobs.ts
export const getActiveGroupsWithJobs = query({
  args: { password: v.string(), assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);

    const groups = await ctx.db
      .query("jobGroups")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    const activeGroups = groups.filter(
      (g) => g.status !== "complete" && g.status !== "failed"
    );

    const result = [];
    for (const group of activeGroups) {
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();
      result.push({ groupId: group._id, jobs });
    }

    return result;
  },
});
```

**Invalidation profile:** Re-runs when:
- Any jobGroup doc for this assignment changes (including terminal ones, since we read all via index then filter — see note below)
- Any active job doc changes (metrics, status transitions)

**Note on index read:** This query reads ALL groups via the `by_assignment` index, then filters client-side for non-terminal. This means a terminal group doc change (e.g., aggregatedResult being set) triggers a re-run. This is acceptable because: (a) aggregatedResult is set once at completion, and (b) the re-run payload is tiny (only active groups' jobs). If needed, a `by_assignment_status` compound index could avoid reading terminal groups, but this optimization is premature for the typical 0-2 active groups.

### Frontend: Two-Tier Hook

#### Replace `useGroupJobs` in AssignmentPane.js

```javascript
/**
 * Two-tier subscription hook for job chain data.
 * Tier 1 (Archive): All groups + terminal job data. Rarely invalidates.
 * Tier 2 (Live): Active group job data only. Frequent but tiny.
 */
function useGroupJobsTwoTier(assignmentId) {
  // Tier 1: Archive — chain structure + terminal jobs
  const { data: archive } = useQuery(
    assignmentId ? api.assignments.getChainWithTerminalJobs : null,
    assignmentId ? { id: assignmentId } : {}
  );

  // Tier 2: Live Wire — active group jobs only
  const { data: liveGroups } = useQuery(
    assignmentId ? api.jobs.getActiveGroupsWithJobs : null,
    assignmentId ? { assignmentId } : {}
  );

  return useMemo(() => {
    if (!archive?.groups) return [];

    // Build lookup: groupId → live jobs
    const liveJobMap = {};
    if (liveGroups) {
      for (const entry of liveGroups) {
        liveJobMap[entry.groupId] = entry.jobs;
      }
    }

    // Merge: archive provides chain order, live wins for active groups
    return archive.groups.map((group) => {
      const jobs = group.isTerminal
        ? group.jobs          // Terminal: use archive (immutable)
        : (liveJobMap[group._id] || []);  // Active: use live data
      return { ...group, jobs };
    });
  }, [archive, liveGroups]);
}
```

#### Remove `getGroupChain` Subscription Chain

Currently the data flows: `ChatPanel` → subscribes to `getGroupChain` → passes `chainData.groups` through `ChatView` → to `AssignmentPane` as `chainGroups` prop.

With the two-tier hook, `AssignmentPane` manages its own subscriptions via `assignmentId`. The entire chainGroups prop pipeline is removed:

| File | Change |
|------|--------|
| `ChatPanel.js:448-451` | Remove `getGroupChain` useQuery subscription |
| `ChatView.js:237` | Remove `chainGroups` prop passthrough |
| `AssignmentPane.js` | Change prop from `chainGroups` to `assignmentId`; use `useGroupJobsTwoTier(assignmentId)` internally |

#### Remove GroupChain Filter Workaround

`JobChain.js:1009` currently filters out groups with empty jobs arrays (caused by the 20-group cap):
```javascript
const validGroups = groups.filter(g => g.jobs && g.jobs.length > 0);
```

With uncapped data, this filter hides legitimate empty groups (pending groups with no jobs yet). Replace with:
```javascript
// No filtering — all groups are rendered. Empty pending groups show placeholder.
```

### Dependency Map

```
WP1: Backend Queries ──────────────────┐
  (no frontend dependencies)           │
                                        ├─► WP2: Frontend Integration
WP1 must complete before WP2           │     (depends on new query APIs)
                                        │
                                        └─► WP3: Cleanup & Verification
                                              (depends on WP2 working)
```

**Parallelization:** WP1 backend work has zero frontend dependencies. A developer could write WP1 and WP2 sequentially in one session — they share context and the total scope is small.

## Work Package Breakdown

### WP1: Backend — Two-Tier Convex Queries

**Scope:** Add two new Convex queries to support the archive/live split.

**Files touched:**
- `workflow-engine/convex/assignments.ts` — add `getChainWithTerminalJobs`
- `workflow-engine/convex/jobs.ts` — add `getActiveGroupsWithJobs`

**Implementation details:**
1. Add `getChainWithTerminalJobs` to assignments.ts (see Architecture section for implementation)
2. Add `getActiveGroupsWithJobs` to jobs.ts (see Architecture section for implementation)
3. Keep existing `getGroupChain` and `getWithGroups` — they have other consumers (runner, potentially CLI). Mark `getGroupChain` with a comment noting it's superseded by the new query for UI use.

**Success criteria:**
- [ ] `getChainWithTerminalJobs` returns all groups in chain order with terminal group jobs populated and active group jobs empty
- [ ] `getActiveGroupsWithJobs` returns only non-terminal groups with their jobs
- [ ] Both queries enforce password auth
- [ ] `npx convex dev` typechecks cleanly (or deploy succeeds)
- [ ] Existing queries (`getGroupChain`, `getWithGroups`, `list`) untouched

### WP2: Frontend — Two-Tier Hook & Wiring

**Scope:** Replace the 20-hook pattern with the two-tier subscription hook and clean up the data flow.

**Files touched:**
- `workflow-engine/ui/js/components/chat/AssignmentPane.js` — replace `useGroupJobs` hook, update component props
- `workflow-engine/ui/js/components/chat/ChatPanel.js` — remove `getGroupChain` subscription, stop passing chainGroups
- `workflow-engine/ui/js/components/chat/ChatView.js` — remove chainGroups prop passthrough, pass assignmentId instead
- `workflow-engine/ui/js/components/job/JobChain.js` — remove line 1009 empty-group filter, adjust empty-state guard
- `workflow-engine/ui/js/api.js` — register new query references for `getChainWithTerminalJobs` and `getActiveGroupsWithJobs`

**Implementation details:**

1. **AssignmentPane.js:**
   - Delete the entire `useGroupJobs` function (lines 16-69)
   - Add `useGroupJobsTwoTier(assignmentId)` (see Architecture section)
   - Update `AssignmentPane` component to accept `assignmentId` prop instead of `chainGroups`
   - Call `useGroupJobsTwoTier(assignmentId)` to get merged groups with jobs
   - The archive query also returns the assignment data, so the separate `assignments.get` subscription in ChatPanel may be consolidatable (evaluate during implementation)

2. **ChatPanel.js:**
   - Remove the `getGroupChain` useQuery (lines 448-451)
   - Remove `chainGroups` / `selectedChainData` from the props passed to ChatView

3. **ChatView.js:**
   - Remove `chainGroups` from AssignmentPane props (line 237)
   - Pass `assignmentId={assignment?._id}` instead
   - Verify no other consumer of chainData exists in this component

4. **JobChain.js:**
   - Line 1009: Remove `groups.filter(g => g.jobs && g.jobs.length > 0)` — render all groups
   - Line 1115: Adjust empty-state guard — change `groups.length === 0 || allJobs.length === 0` to only check `groups.length === 0`. With the two-tier model, `allJobs` may be empty momentarily while live data loads for active groups; the chain structure (groups) should still render.
   - Consider adding a minimal "pending" placeholder for groups with 0 jobs (optional, cosmetic)

5. **api.js:**
   - Add `getChainWithTerminalJobs: "assignments:getChainWithTerminalJobs"` to `api.assignments`
   - Add `getActiveGroupsWithJobs: "jobs:getActiveGroupsWithJobs"` to `api.jobs`
   - Without these entries, the frontend `useQuery` calls will reference undefined API keys and fail at runtime

**Success criteria:**
- [ ] Assignment pane renders ALL groups regardless of chain length (no 20-group cap)
- [ ] Rollup metrics (TIME/FRAGS/DMG/FIENDS) are accurate across all groups
- [ ] Only 2 Convex subscriptions per assignment pane (archive + live), down from 20+
- [ ] Live subscriptions only cover non-terminal groups
- [ ] When a running group completes, its data transitions from live to archive seamlessly (no flicker)
- [ ] New groups added by PM appear in real-time without reload
- [ ] AgentHUD job cards, connectors, fan-in/fan-out rendering preserved
- [ ] GroupChain line 1009 workaround removed
- [ ] No JS console errors or React hook order violations

## Assignment-Level Success Criteria

1. **No hardcoded group cap** — chains of any length render fully
2. **Accurate rollup metrics** — TIME/FRAGS/DMG/FIENDS reflect ALL groups
3. **Efficient subscriptions** — exactly 2 Convex subscriptions per assignment pane (was 20+)
4. **Terminal isolation** — live subscriptions only for pending/running groups
5. **Seamless transitions** — group completing moves from live → archive with no visual disruption
6. **Real-time chain growth** — new groups/jobs appear immediately
7. **No visual regression** — job cards, connectors, group rows all preserved
8. **Line 1009 workaround removed** — empty-group filter deleted

## Ambiguities & Decisions

### Resolved

**Q: Should the archive query walk the linked list or use the `by_assignment` index?**
A: Walk the linked list. The UI needs chain order for rendering, and the linked list provides this naturally. The `by_assignment` index doesn't guarantee order.

**Q: Should we keep `getGroupChain` or replace it?**
A: Keep it. The runner and other consumers may use it. Add the new query alongside it.

**Q: Should the live query use a compound index `by_assignment_status` to avoid reading terminal groups?**
A: Not yet. The current `by_assignment` index + filter is sufficient. Terminal group doc changes are rare (aggregatedResult set once). If profiling shows unnecessary invalidations, add the compound index as a follow-up.

### Open

**Q: Can the separate `assignments.get` subscription in ChatPanel.js be eliminated?**
The archive query returns the full assignment document. If ChatPanel only uses it to pass to AssignmentPane, the archive query makes it redundant. However, ChatPanel may use assignment data for other purposes (e.g., status display in thread list). **Decision: evaluate during WP2 implementation; don't scope-creep.**

**Q: Should pending groups with 0 jobs show a placeholder in the chain?**
After removing the line 1009 filter, empty pending groups will render with 0 job cards. A minimal "awaiting jobs" placeholder would improve UX. **Decision: cosmetic, handle in WP2 if trivial, otherwise defer.**

## Recommended Job Sequence

```
WP1 (Backend) → WP2 (Frontend) → Code Review
```

- **WP1 first:** New queries must exist and deploy before the frontend can consume them
- **WP2 immediately after:** Frontend rewiring consumes the new APIs
- **No UAT jobs:** Per north star constraint, verification is via code review only. No UAT jobs inserted.
- **Both WPs can be a single implementation job** given their tight coupling and moderate scope

## CONSTRAINT: NO UAT JOBS

This assignment must NOT have UAT jobs inserted. The change is a frontend refactor + backend query additions with no business logic changes. Verification is via code review of the implementation against the success criteria above.
