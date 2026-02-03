# Parallel Job Groups - Assessment (KaiPrismatic)

Date: 2026-02-02
Scope: workflow-engine parallel job execution within assignments

## Current Model Summary
- Assignments hold a singly-linked job chain via `headJobId` and `nextJobId`.
- Scheduler walks the chain to find the first pending job whose predecessor is done.
- Only one job per assignment runs at a time; PM review is injected after each non-PM job.
- Runner triggers PM based on job completion and chain position.

## Requirements Interpreted
1. Parallel job groups within an assignment (fan-out + join).
2. Auto-expansion: `review` logically becomes 3 jobs (claude/codex/gemini).
3. PM does not create groups explicitly; system handles expansion.
4. PM receives aggregated results from the entire group.
5. Group completion waits for all jobs; group succeeds if at least one succeeds.

## Recommendation (Decisive)
**Adopt Option B: a normalized `jobGroups` table that owns the chain.**
Use group-level navigation (`headGroupId` + `nextGroupId`), and make jobs belong to groups via `groupId`.

Why this is optimal:
- **Query clarity:** Scheduling is group-first; job IDs remain for execution/status updates.
- **Extensibility:** Group policies (auto-expansion, success criteria, aggregation) live in one place.
- **Lower risk:** Avoid redundant `nextGroupId` fields on every job and inconsistency hazards.
- **Better PM context:** Group-level aggregation maps cleanly to PM prompts.

## Proposed Data Model (Additive First)
### New table: `jobGroups`
- `assignmentId`
- `jobType` (logical step type for the group)
- `context?` (common context for group members)
- `nextGroupId?`
- `status` (pending | running | complete | failed)
- `aggregatedResult?` (combined results for PM)
- `createdAt`, `startedAt?`, `completedAt?`
- Optional: `expandTo?: [claude|codex|gemini]` (or config-driven rules)

### Jobs table (extend)
- `groupId` (FK)
- Keep `nextJobId` temporarily for migration compatibility.

### Assignments table (extend)
- `headGroupId` (preferred)
- Keep `headJobId` temporarily for migration compatibility.

## Core Logic Changes
### Scheduler (group-first)
- Walk group chain from `headGroupId`.
- Identify **first incomplete group**.
  - If group has any pending jobs, return **all pending jobs** in that group (even if some already running/complete).
  - Do **not** return jobs from later groups until current group is fully done.
- Accumulate **group-level** results since last PM group for PM prompts.

### Runner / Completion
- On job completion/failure, recompute group state:
  - Group is **complete** when all jobs are done and **at least one** is `complete`.
  - Group is **failed** only when **all** jobs are `failed`.
- When a group completes:
  - Build and store `aggregatedResult` (include harness + status per job).
  - Trigger `pm` group.
- Assignment completes only when **all groups** are terminal (complete/failed).

## Auto-Expansion (Transparent to PM)
- Intercept job creation (`create` / `insertAfter`) and map to group creation:
  - `review` => create group with jobs for claude/codex/gemini.
  - All other types => group with a single job (default harness).
- PM keeps using the same CLI commands; groups are created behind the scenes.

## Migration Strategy
1. **Phase 1 (Additive):** Add `jobGroups`, `headGroupId`, `groupId` fields + indexes; keep old chain.
2. **Phase 2 (Backfill):** For each assignment with `headJobId`, create 1:1 groups for each job in chain; set `headGroupId` and `groupId`.
3. **Phase 3 (Cutover):** Scheduler/runner prefer group chain; fallback to job chain if `headGroupId` missing.
4. **Phase 4 (Cleanup):** Deprecate `headJobId`/`nextJobId` once all data migrated.

## Notes / Impacts
- UI job chain visualization will need a **group view** (parallel lanes) but can still show job-level details.
- `jobs.insertAfter` should insert **after the job’s group** to preserve ordering semantics.
- Result aggregation should include both successes and failures so PM can compare harness outputs.

## Open Questions (for team)
- Should group `status` be derived on read or stored on write? (storing simplifies queries.)
- Should auto-expansion rules live in config (jobType => harnesses) or be hardcoded for `review`?
- How should group results be truncated/structured for PM prompt size limits?

---

## Review Notes (ZoeEthereal, 2026-02-02)
Scope: `convex/jobs.ts`, `convex/scheduler.ts`, `.agents/tools/workflow/cli.ts`

### Key Findings
- **Scheduler parallelism gap:** `findReadyJobs` blocks pending jobs when any job in the group is running, which can stall partial parallel dispatch if a runner only starts a subset. This diverges from the phase guidance that pending jobs in a running group should still be dispatched.
- **Assignment completion risk:** Assignments are marked `active` on job start but are never auto-marked `complete` when the last group finishes, which can stall sequential queues (an “active” assignment with no ready jobs prevents other pending sequential assignments from running).
- **Group creation orphan risk:** `createGroup` does not link into an existing chain unless the assignment has no head; CLI `insert-job` defaults to `createGroup` when `--after/--append` are absent, creating orphan groups in existing assignments.
- **Mixed jobDefs ambiguity:** Group `jobType` and `context` are derived from the first job; additional job definitions’ `jobType/context` are not stored, but are still allowed, which can silently mislabel group semantics.
- **Auto-expansion duplication hazard:** Auto-expansion is applied per job definition; if multiple jobDefs use an auto-expand jobType (e.g., `review`), the group can balloon with duplicate harness jobs.

### Suggestions
- Align scheduler behavior with the phase guidance: allow dispatch of pending jobs even when a group is already running, or enforce that the runner must start all pending jobs in a single pass.
- Introduce an explicit assignment completion update when the terminal group completes (or ensure the runner does so).
- Validate/createGroup chaining behavior in CLI by requiring `--after`/`--append` when the assignment already has a head.
- Enforce single jobType/context per group (or store jobType/context at the job level if heterogeneity is intended).
