# Parallel Job Groups Architecture

> Architecture Decision Record for enabling parallel job execution within assignments

**Status:** Implemented
**Author:** RileyMendel (Architect)
**Date:** 2026-02-02
**Last Updated:** 2026-02-02

---

## Problem Statement

The workflow engine needs to support:

1. **Parallel job execution** - Multiple jobs run simultaneously within a group
2. **Heterogeneous groups** - Jobs in a group can have different types, harnesses, and contexts
3. **Auto-expansion** - Certain job types (like "review") expand to multiple harnesses
4. **Result aggregation** - PM receives combined results when group completes

### Previous Architecture

```
Assignment
  └── headJobId ──→ Job1 ──nextJobId──→ Job2 ──nextJobId──→ Job3 ──→ ...
```

- Sequential-only execution
- No concept of parallel work

---

## Solution

**Group-level chaining with job-level flexibility**

Groups are containers that hold parallel jobs. The chain is between groups, not jobs. Each job within a group is self-contained with its own type, harness, and context.

### Key Insight

> "Groups are just containers. Jobs have their own identity."

---

## Schema Design

### jobGroups - Parallel Execution Containers

```typescript
jobGroups: defineTable({
  assignmentId: v.id("assignments"),
  nextGroupId: v.optional(v.id("jobGroups")), // Chain link
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("complete"),
    v.literal("failed")
  ),
  aggregatedResult: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_assignment", ["assignmentId"])
  .index("by_status", ["status"])
```

**Note:** Groups have NO `jobType` or `context` - they're just containers.

### jobs - Self-Contained Work Units

```typescript
jobs: defineTable({
  groupId: v.id("jobGroups"),
  jobType: v.string(),                    // Each job has its own type
  harness: v.union("claude", "codex", "gemini"),
  context: v.optional(v.string()),        // Each job has its own context
  prompt: v.optional(v.string()),
  status: v.union("pending", "running", "complete", "failed"),
  result: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_group", ["groupId"])
  .index("by_group_status", ["groupId", "status"])
  .index("by_status", ["status"])
```

---

## Visual Model

```
Assignment
  └── headGroupId
          │
          ▼
    ┌─────────────────────────────────────┐     nextGroupId
    │           JobGroup 1                │ ─────────────────→ ...
    │                                     │
    │  ┌──────────────────────────────┐   │
    │  │ Job: type=review, claude     │   │  ←── All jobs run
    │  ├──────────────────────────────┤   │      in parallel
    │  │ Job: type=review, codex      │   │
    │  ├──────────────────────────────┤   │
    │  │ Job: type=review, gemini     │   │
    │  ├──────────────────────────────┤   │
    │  │ Job: type=uat, claude        │   │  ←── Different type,
    │  │      context="Test login"    │   │      same group!
    │  └──────────────────────────────┘   │
    └─────────────────────────────────────┘
                    │
         (waits for ALL 4 to complete)
                    │
                    ▼
    ┌─────────────────────────────────────┐
    │           JobGroup 2                │
    │                                     │
    │  ┌──────────────────────────────┐   │
    │  │ Job: type=pm, claude         │   │
    │  │      Receives aggregated     │   │
    │  │      results from Group 1    │   │
    │  └──────────────────────────────┘   │
    └─────────────────────────────────────┘
```

---

## Auto-Expansion

Auto-expansion happens in the **CLI**, not in Convex mutations.

### Configuration (cli.ts)

```typescript
const AUTO_EXPAND_CONFIG: Record<string, Harness[]> = {
  review: ["claude", "codex", "gemini"],
  "architecture-review": ["claude", "codex", "gemini"],
  "spec-review": ["claude", "codex", "gemini"],
};
```

### Expansion Logic

```typescript
function expandJobs(jobs: JobDefInput[]): JobDef[] {
  const expanded: JobDef[] = [];

  for (const job of jobs) {
    const expandHarnesses = AUTO_EXPAND_CONFIG[job.jobType];

    if (expandHarnesses && !job.harness) {
      // Auto-expand to multiple harnesses
      for (const harness of expandHarnesses) {
        expanded.push({
          jobType: job.jobType,
          harness,
          context: job.context,
        });
      }
    } else {
      // Single job
      expanded.push({
        jobType: job.jobType,
        harness: job.harness || getHarnessForJobType(job.jobType),
        context: job.context,
      });
    }
  }

  return expanded;
}
```

### CLI Usage

```bash
# Auto-expands review to 3 jobs (no harness specified)
--type review

# Single job with explicit harness
--type review --harness claude

# Mixed group: review×3 + uat×1 = 4 jobs
--jobs '[{"jobType":"review"},{"jobType":"uat","harness":"claude","context":"Test login"}]'
```

---

## Convex Mutations

Mutations just insert jobs as-is. No auto-expansion logic.

### createGroup

```typescript
export const createGroup = mutation({
  args: {
    assignmentId: v.id("assignments"),
    jobs: v.array(v.object({
      jobType: v.string(),
      harness: v.union("claude", "codex", "gemini"),
      context: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    // Create group (just a container)
    const groupId = await ctx.db.insert("jobGroups", {
      assignmentId: args.assignmentId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Insert jobs as-is
    for (const jobDef of args.jobs) {
      await ctx.db.insert("jobs", {
        groupId,
        jobType: jobDef.jobType,
        harness: jobDef.harness,
        context: jobDef.context,
        status: "pending",
        createdAt: Date.now(),
      });
    }

    return { groupId, jobIds };
  },
});
```

---

## Scheduler Logic

The scheduler walks the group chain and returns ALL pending jobs in a ready group.

```typescript
async function findReadyJobs(ctx, assignment): Promise<ReadyJob[]> {
  let currentGroupId = assignment.headGroupId;
  const accumulatedResults = [];

  while (currentGroupId) {
    const group = await ctx.db.get(currentGroupId);
    const jobs = await ctx.db.query("jobs")
      .withIndex("by_group", q => q.eq("groupId", currentGroupId))
      .collect();

    const pendingJobs = jobs.filter(j => j.status === "pending");
    const runningJobs = jobs.filter(j => j.status === "running");
    const allTerminal = jobs.every(j =>
      j.status === "complete" || j.status === "failed"
    );

    if (pendingJobs.length > 0 && runningJobs.length === 0) {
      // Group ready - return ALL pending jobs
      return pendingJobs.map(job => ({
        job,
        group,
        assignment,
        accumulatedResults: [...accumulatedResults],
      }));
    }

    if (runningJobs.length > 0) {
      // Wait for running jobs to complete
      return [];
    }

    if (allTerminal) {
      // Accumulate results, reset on PM groups
      const hasPMJob = jobs.some(j => j.jobType === "pm");

      if (hasPMJob) {
        accumulatedResults.length = 0;
      } else {
        for (const job of jobs) {
          if (job.result) {
            accumulatedResults.push({
              jobType: job.jobType,
              harness: job.harness,
              result: job.result,
            });
          }
        }
      }
      currentGroupId = group.nextGroupId;
    }
  }

  return [];
}
```

---

## Result Aggregation

When a group completes, results are aggregated with minimal labels:

```
## review A
{result}

---

## review B
{result}

---

## review C
{result}

---

## uat
{result}
```

- Multiple jobs of same type: A/B/C suffix
- Single job of a type: no suffix
- No harness names in headers

---

## Group Status Rules

| Condition | Group Status |
|-----------|--------------|
| All jobs terminal, at least one complete | `complete` |
| All jobs terminal, all failed | `failed` |
| Any job running | `running` |
| All jobs pending | `pending` |

Jobs can fail individually without failing the group.

---

## Trade-offs

### Pros

| Benefit | Rationale |
|---------|-----------|
| **Flexible parallelism** | Jobs in a group can be completely different types |
| **Clean separation** | Groups = execution containers, Jobs = work units |
| **CLI handles expansion** | Convex mutations are simple, expansion is configurable |
| **Minimal result formatting** | No leaked harness names, just jobType labels |

### Cons

| Cost | Mitigation |
|------|------------|
| **CLI complexity** | Expansion logic is straightforward and testable |
| **No group-level type** | Query jobs if you need to know what's in a group |

---

## Implementation Status

- [x] Schema: Groups as containers, jobs self-contained
- [x] Mutations: Accept jobs array, no auto-expansion
- [x] CLI: Auto-expansion via `expandJobs()`
- [x] Scheduler: Returns all pending jobs in ready group
- [x] Runner: Uses `job.jobType`/`job.context`
- [x] Result aggregation: jobType A/B/C labels
- [x] PM message: Raw job result, no formatting
- [ ] Comprehensive testing

---

## File Locations

| Component | Path |
|-----------|------|
| Schema | `workflow-engine/convex/schema.ts` |
| Mutations | `workflow-engine/convex/jobs.ts` |
| Scheduler | `workflow-engine/convex/scheduler.ts` |
| CLI | `.agents/tools/workflow/cli.ts` |
| Runner | `.agents/tools/workflow/runner.ts` |
| Prompts | `.agents/tools/workflow/lib/prompts.ts` |
