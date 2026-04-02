# Phase 12: Uncap Job Chain — Completion Summary

**Status:** Complete  
**Date:** 2026-04-02

## What Changed

Replaced the 20 hardcoded per-group `useQuery` subscriptions with a two-tier query architecture (Archive + Live Wire), removing the arbitrary group cap on the job chain visualization.

### Backend (Convex)

- **`assignments.ts`** — Added `getChainWithTerminalJobs` query. Walks the group linked list, includes job data for terminal (complete/failed) groups only. Existing `getGroupChain` retained for runner/CLI consumers.
- **`jobs.ts`** — Added `getActiveGroupsWithJobs` query. Fetches non-terminal groups via `by_assignment` index with client-side status filter, includes their jobs.

### Frontend

- **`AssignmentPane.js`** — Replaced `useGroupJobs` (20 hardcoded hooks) with `useGroupJobsTwoTier(assignmentId)`. Component now accepts `assignmentId` prop instead of `chainGroups`.
- **`ChatPanel.js`** — Removed `getGroupChain` subscription and `chainGroups` prop pipeline.
- **`ChatView.js`** — Passes `assignmentId` to AssignmentPane instead of `chainGroups`.
- **`JobChain.js`** — Line 1009 empty-group filter workaround removed (identity assignment `const validGroups = groups`).
- **`api.js`** — Registered `getChainWithTerminalJobs` and `getActiveGroupsWithJobs` query references.

## Acceptance Criteria Met

1. No hardcoded group cap — chains of any length render fully
2. Rollup metrics accurate across all groups
3. Exactly 2 Convex subscriptions per assignment pane (down from 20+)
4. Live subscriptions only for non-terminal groups
5. Seamless group completion transitions (live → archive)
6. Real-time chain growth (new groups appear without reload)
7. No visual regression (job cards, connectors, fan-in/fan-out preserved)
8. Line 1009 workaround removed

## Spec Accuracy

The implementation matches the spec (`spec-two-tier-subscriptions.md`) with no material divergences. All files, queries, and hook patterns were implemented as designed.

## Open Items Deferred

- Compound `by_assignment_status` index optimization — accepted as premature per spec rationale
- Empty pending group placeholder — not implemented (cosmetic, deferred)
- `assignments.get` subscription consolidation in ChatPanel — not pursued per spec guidance to avoid scope creep
