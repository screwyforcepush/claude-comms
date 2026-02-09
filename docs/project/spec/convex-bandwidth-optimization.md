# Convex Bandwidth Optimization — Subscription Decomposition

## Problem

The Convex backend consumed ~3GB of bandwidth in a few days for a single-user system. Root cause: monolithic queries that read entire document graphs, subscribed reactively. A single field change (e.g., metric tick) re-executes the full query, re-reads hundreds of documents, and re-transmits the full result to every subscriber.

The core issue is **subscription scope mismatch** — consumers need narrow slices of data but are subscribed to queries that read everything.

## Guiding Principle

Each subscription should read **only the documents its consumer actually renders or acts on**. A metric tick on a running job should not cause the namespace sidebar to re-render. A job status change should not force the runner to re-walk every assignment chain.

---

## Current Subscription Map

### Runner (always active)

| Subscription | Query | What it reads | What it needs |
|---|---|---|---|
| Job dispatch | `scheduler.getReadyJobs` | ALL assignments → chain-walk ALL groups → ALL jobs per group | The next pending job group for the active assignment |
| Chat dispatch | `scheduler.getReadyChatJobs` | Pending chatJobs by namespace (indexed) | Same — this one is already efficient |

### UI (active when browser open)

| Subscription | Query | What it reads | What it needs |
|---|---|---|---|
| Namespace sidebar | `scheduler.getAllNamespaces` | ALL namespaces → ALL assignments per namespace | Namespace name + `{pending, active, blocked, complete}` counts |
| Thread sidebar badges | `scheduler.getAllAssignments` | ALL assignments → ALL groups → ALL jobs | `assignment.status` and `assignment.alignmentStatus` for ~5-15 threads |
| Job chain pane | `scheduler.getAllAssignments` (same sub) | (same) | Groups + job summaries for ONE selected assignment |
| Job detail modal | `scheduler.getAllAssignments` (same sub) | (same) | Full detail for ONE selected job |
| Chat messages | `chatMessages.list` | Messages for selected thread (indexed) | Same — already efficient |
| Typing indicator | `chatJobs.getActiveForThread` | ALL chatJobs for thread, filtered client-side | Whether a pending/running chatJob exists for this thread |

### Queries to retire

| Query | Current consumers | Action |
|---|---|---|
| `scheduler.getAllAssignments` | ChatPanel.js:89 | **Remove** — replace with targeted queries below |
| `scheduler.getAllNamespaces` | main.js:226, NamespaceList.js:146 | **Remove** — replace with `namespaces.list` + denormalized counts |
| `scheduler.watchQueue` | None (unused in current UI/runner) | **Remove** — dead code |
| `scheduler.getQueueStatus` | None (unused in current UI/runner) | **Remove** — dead code |

---

## Target Subscription Architecture

### 1. Namespace Sidebar — Denormalized Counts

**Problem:** `getAllNamespaces` fetches ALL assignments for every namespace just to compute four status counts.

**Solution:** Denormalize `{pending, active, blocked, complete}` counts directly onto the `namespaces` table. Update them atomically whenever assignment status changes.

**Schema change:**
```
namespaces: {
  ...existing fields,
  assignmentCounts: {    // new field
    pending: number,
    active: number,
    blocked: number,
    complete: number,
  }
}
```

**UI subscription:** `namespaces.list` (already exists, reads only namespace documents — no assignment reads at all).

**Mutation changes:** Every mutation that changes `assignment.status` must also update the parent namespace's counts. Affected mutations:
- `assignments.create` — increment `pending`
- `assignments.update` (when status changes) — decrement old, increment new
- `assignments.complete` — decrement old, increment `complete`
- `assignments.block` — decrement old, increment `blocked`
- `assignments.unblock` — decrement `blocked`, increment `active`
- `assignments.remove` — decrement old status count
- `jobs.start` (marks assignment active) — decrement `pending`, increment `active`

**Impact:** Namespace sidebar subscription reads N namespace documents instead of N namespaces + M assignments. Completely decoupled from assignment/job changes. Only re-executes when a namespace document itself changes.

**Migration:** Backfill counts for existing namespaces. One-time script that queries assignments per namespace and patches the counts.

### 2. Thread Sidebar Badges — Per-Assignment Subscription

**Problem:** ChatPanel subscribes to the entire namespace's assignment graph just to show `status` and `alignmentStatus` badges on ~5-15 thread items.

**Solution:** Each thread that has an `assignmentId` subscribes to `assignments.get({ id })` individually.

**This query already exists** (`assignments.ts:37-43`). It reads exactly one document. Each subscription only re-executes when that specific assignment document changes.

**UI change:** Replace the single `useQuery(api.scheduler.getAllAssignments)` in ChatPanel with:
- A new small component/hook per thread that calls `useQuery(api.assignments.get, { id: thread.assignmentId })` when `assignmentId` is present
- The `assignments` map passed to ChatSidebar/ThreadList is built from these individual subscriptions

**Impact:** 5-15 single-document subscriptions instead of one subscription that reads the entire namespace graph. A metric tick on a running job does NOT trigger re-execution of these subscriptions (metric ticks touch the `jobs` table, not `assignments`).

### 3. Job Chain Pane — Chain Structure Query

**Problem:** The AssignmentPane needs the group chain for the selected assignment. Currently pulled from the monolithic `getAllAssignments` subscription.

**Solution:** Subscribe to `assignments.getWithGroups({ id })` for the ONE selected assignment.

**This query already exists** (`assignments.ts:46-72`). It reads: 1 assignment + G groups + G×J jobs.

**UI change:** In ChatPanel/ChatView, when `selectedThread.assignmentId` exists, subscribe to `assignments.getWithGroups({ id: selectedThread.assignmentId })`. Pass the result to AssignmentPane.

**Impact:** Only one assignment's chain is subscribed at a time. When the user switches threads, the old subscription is dropped and a new one created for the new assignment.

**Note:** This query still walks the chain and reads all jobs, which means it re-executes on any job change within the assignment (including metric ticks). This is addressed in item 4.

### 4. Job Detail — Per-Job Subscription

**Problem:** When a job is running, metric ticks update the `jobs` table every 60s. The chain query from item 3 reads all jobs, so metric ticks on ANY job in the chain cause the entire chain query to re-execute.

**Solution:** Split chain structure from job detail:

**New query: `assignments.getChainStructure`**
```
Returns: assignment + groups (with job _id, jobType, harness, status only)
Reads: 1 assignment + G groups + G×J jobs (but only structural fields)
```

Wait — Convex tracks dependencies at the document level, not the field level. Reading a job's `status` field creates a dependency on the entire job document. So even a "light" read of job status still triggers on metric ticks.

**Revised approach:** The chain query should read groups but NOT read individual job documents. Instead:

**New query: `assignments.getGroupChain`**
```typescript
// Returns: assignment + groups (no job data)
// Reads: 1 assignment + G groups
assignments.getGroupChain({ id }) → {
  ...assignment,
  groups: [{ _id, status, nextGroupId, createdAt }]
}
```

**New query: `jobs.listByGroup`** (already exists as `jobs.list({ groupId })`)
```typescript
// Returns: all jobs in a specific group
// Reads: only jobs in that one group
jobs.list({ groupId }) → Job[]
```

The UI subscribes to:
1. `assignments.getGroupChain({ id })` — one subscription, reads assignment + groups only. Re-executes when group status changes (rare: only on group start/complete transitions).
2. Per-group `jobs.list({ groupId })` — one subscription per visible group. Only re-executes when jobs in THAT group change.

For the **currently running group**, metric ticks trigger re-execution of only that group's job subscription — not the whole chain.

For the **job detail modal**, the UI already has the job object from the group subscription. If live metric updates are desired in the modal, subscribe to `jobs.get({ id })` for the one selected job.

**Impact:** Metric ticks affect exactly one subscription (the running group's jobs) instead of the entire chain.

### 5. Chat Typing Indicator — Indexed Status Lookup

**Problem:** `chatJobs.getActiveForThread` fetches ALL chatJobs for a thread and filters client-side. This is a legacy pattern from before session resume was implemented. For a long-lived thread, this reads an unbounded number of documents.

**Solution:** Add a compound index and use it directly.

**Schema change:**
```
chatJobs: {
  ...existing indexes,
  .index("by_thread_status", ["threadId", "status"])   // new
}
```

**Query change:** Replace the body of `getActiveForThread`:
```typescript
// Check pending first, then running. At most 2 indexed lookups.
const pending = await ctx.db
  .query("chatJobs")
  .withIndex("by_thread_status", q =>
    q.eq("threadId", args.threadId).eq("status", "pending"))
  .first();
if (pending) return pending;

const running = await ctx.db
  .query("chatJobs")
  .withIndex("by_thread_status", q =>
    q.eq("threadId", args.threadId).eq("status", "running"))
  .first();
return running ?? null;
```

**Impact:** Reads at most 2 documents instead of N (all historical chatJobs). The subscription only depends on chatJobs matching the thread+status, so completed/failed jobs don't trigger re-execution.

### 6. Runner — Short-Circuit + Index Usage

**Problem:** `getReadyJobs` fetches all assignments via `by_namespace` (ignoring the existing `by_namespace_status` compound index), then chain-walks every non-complete assignment. When a job is running, it walks the entire chain and returns `[]`.

**Solution (two parts):**

**6a. Use the compound index.** Replace:
```typescript
// Current: fetch ALL, filter client-side
const assignments = await ctx.db
  .query("assignments")
  .withIndex("by_namespace", q => q.eq("namespaceId", args.namespaceId))
  .collect();
const workable = assignments.filter(a => a.status !== "complete" && a.status !== "blocked");
```
With two indexed queries:
```typescript
const active = await ctx.db
  .query("assignments")
  .withIndex("by_namespace_status", q =>
    q.eq("namespaceId", args.namespaceId).eq("status", "active"))
  .collect();
const pending = await ctx.db
  .query("assignments")
  .withIndex("by_namespace_status", q =>
    q.eq("namespaceId", args.namespaceId).eq("status", "pending"))
  .collect();
const workable = [...active, ...pending];
```

This eliminates reads of completed and blocked assignments from the dependency set. Completed assignments changing (which shouldn't happen, but defensive) no longer trigger re-execution.

**6b. Short-circuit on running groups.** Before chain-walking an assignment, check if it has a running group:
```typescript
const runningGroup = await ctx.db
  .query("jobGroups")
  .withIndex("by_assignment", q => q.eq("assignmentId", assignment._id))
  .filter(q => q.eq(q.field("status"), "running"))
  .first();

if (runningGroup) return []; // Nothing to dispatch
```

This avoids walking the chain (and reading every job document) during the 95% of time when a job is running. The dependency set is: the assignment document + group documents for that assignment. Metric ticks on jobs do NOT trigger re-execution because no job documents were read.

**6c. PM context walk is preserved.** The chain-walk for accumulating `accumulatedResults` / `previousNonPmGroupResults` / `r1GroupResults` only happens when a PM group is the next pending group. This is once per PM run (infrequent). No optimization needed — it's already outside the hot path after 6b.

**Impact:** During normal execution (job running), `getReadyJobs` reads: active/pending assignments + their groups. No job documents read. Re-executes only on group status changes (rare).

---

## Summary: Before and After

### Before (one metric tick, one running job)

| Query | Doc reads | Trigger? |
|---|---|---|
| `scheduler.getReadyJobs` | ~320 | Yes (reads the job) |
| `scheduler.getAllAssignments` | ~320 | Yes (reads the job) |
| `scheduler.getAllNamespaces` | ~100 | Yes (reads assignments) |
| `chatJobs.getActiveForThread` | ~20 | No |
| **Total** | **~760** | |

### After (one metric tick, one running job)

| Query | Doc reads | Trigger? |
|---|---|---|
| `scheduler.getReadyJobs` | ~10 (assignments + groups) | **No** (doesn't read jobs) |
| `namespaces.list` | ~3 (namespace docs only) | **No** (doesn't read assignments) |
| `assignments.get` × 10 | 10 (one each) | **No** (doesn't read jobs) |
| `assignments.getGroupChain` × 1 | ~6 (assignment + groups) | **No** (doesn't read jobs) |
| `jobs.list({ groupId })` × 1 | ~3 (running group's jobs) | **Yes** (this is the only trigger) |
| `chatJobs.getActiveForThread` | 1-2 (indexed lookup) | **No** |
| **Total triggered reads** | **~3** | |

Estimated reduction: **~99% fewer document reads per metric tick.**

---

## Implementation Order

1. **Schema + indexes** — Add `assignmentCounts` to namespaces, add `by_thread_status` to chatJobs
2. **Namespace denormalization** — Update assignment mutations to maintain counts, backfill existing data
3. **`getActiveForThread` fix** — Swap to indexed lookup (smallest, most isolated change)
4. **Runner short-circuit (6a + 6b)** — Compound index + running group check
5. **UI: Thread sidebar badges** — Replace `getAllAssignments` with per-assignment `get` subscriptions
6. **UI: Job chain decomposition** — New `getGroupChain` query + per-group job subscriptions
7. **Retire dead queries** — Remove `getAllAssignments`, `getAllNamespaces`, `watchQueue`, `getQueueStatus` from scheduler.ts

Steps 1-4 are backend-only. Steps 5-6 are UI changes. Step 7 is cleanup after the UI is migrated.

---

## Acceptance Criteria

- [ ] No UI or runner code subscribes to `scheduler.getAllAssignments`, `scheduler.getAllNamespaces`, `scheduler.watchQueue`, or `scheduler.getQueueStatus`
- [ ] Namespace sidebar shows correct `{pending, active, blocked, complete}` counts sourced from denormalized fields on the namespace document
- [ ] Thread sidebar shows correct `status` and `alignmentStatus` badges via per-assignment subscriptions
- [ ] Job chain pane renders correctly for the selected assignment via `getGroupChain` + per-group job subscriptions
- [ ] A metric tick on a running job triggers re-execution of at most ONE subscription (the running group's `jobs.list`)
- [ ] Runner `getReadyJobs` uses `by_namespace_status` index and short-circuits on running groups
- [ ] `chatJobs.getActiveForThread` uses `by_thread_status` compound index
- [ ] All existing functionality preserved: job dispatch, PM context, guardian evaluation, chat, typing indicator

## Out of Scope

- Linked list → flat structure migration (Approach E from notes)
- Hot/cold table split (Approach D from notes)
- Runner subscription segmentation into multiple managed subscriptions (Approach B — deferred; the short-circuit from 6b achieves most of the benefit)
- Changes to `chatJobs.trigger` message loading (separate concern)
- Metric heartbeat interval tuning (already changed 10s → 60s)
