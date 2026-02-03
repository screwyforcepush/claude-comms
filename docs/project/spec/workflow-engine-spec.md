# Workflow Engine Specification

> Convex-based job orchestration for multi-agent workflows

**Version:** 2.0
**Last Updated:** 2026-02-02
**Status:** Active

---

## Overview

The Workflow Engine is a Convex-powered job orchestration system that manages assignments, job groups, and individual jobs across multiple AI harnesses (Claude, Codex, Gemini). It supports parallel job execution within groups, automatic job expansion, and integration with a chat-based user interface.

### Key Capabilities

- **Multi-namespace isolation** - Separate workspaces for different projects/contexts
- **Assignment-based work tracking** - North star objectives with priority and status
- **Parallel job execution** - Jobs within a group run concurrently
- **Auto-expansion** - Certain job types automatically expand to multiple harnesses
- **Chain navigation** - Groups form a linked chain; scheduler advances when groups complete
- **Chat integration** - PO/PM communication via threaded chat with mode switching
- **Guardian mode** - Alignment monitoring for autonomous execution

---

## Architecture

### Data Flow

```
Namespace
  └── Assignments (work units with north star objective)
        └── JobGroups (execution units, chained via nextGroupId)
              └── Jobs (individual work items, run in parallel within group)

Namespace
  └── ChatThreads (user-agent conversations)
        └── ChatMessages (conversation history)
        └── ChatJobs (async responses, separate from assignments)
```

### Component Relationships

| Component | Relationship |
|-----------|--------------|
| Namespace → Assignments | 1:N - Namespace contains many assignments |
| Assignment → JobGroups | 1:N - Assignment has chain of groups via `headGroupId` |
| JobGroup → Jobs | 1:N - Group contains parallel jobs |
| JobGroup → JobGroup | 1:1 - Chain via `nextGroupId` |
| Namespace → ChatThreads | 1:N - Namespace contains chat threads |
| ChatThread → ChatMessages | 1:N - Thread contains messages |
| ChatThread → Assignment | 0:1 - Optional link for guardian mode |

---

## Schema

### namespaces

Isolated workspaces for organizing work.

```typescript
namespaces: defineTable({
  name: v.string(),                    // Unique identifier
  description: v.optional(v.string()), // Human-readable description
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_name", ["name"])
```

### assignments

High-level work units with objectives.

```typescript
assignments: defineTable({
  namespaceId: v.id("namespaces"),
  northStar: v.string(),               // The objective/goal
  status: v.union(
    v.literal("pending"),              // Not started
    v.literal("active"),               // In progress
    v.literal("blocked"),              // Waiting on user
    v.literal("complete")              // Finished
  ),
  blockedReason: v.optional(v.string()),
  alignmentStatus: v.optional(v.union( // Guardian mode
    v.literal("aligned"),
    v.literal("uncertain"),
    v.literal("misaligned")
  )),
  independent: v.boolean(),            // Can run parallel to other assignments
  priority: v.number(),                // Lower = higher priority
  artifacts: v.string(),               // Accumulated outputs
  decisions: v.string(),               // Key decisions made
  headGroupId: v.optional(v.id("jobGroups")), // Chain entry point
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_namespace", ["namespaceId"])
  .index("by_namespace_status", ["namespaceId", "status"])
  .index("by_status", ["status"])
```

**Status Transitions:**
- `pending` → `active` (when first job starts)
- `active` → `blocked` (user intervention needed)
- `blocked` → `active` (user unblocks)
- `active` → `complete` (all work done)

### jobGroups

Parallel execution containers. Groups form a singly-linked chain.

```typescript
jobGroups: defineTable({
  assignmentId: v.id("assignments"),
  nextGroupId: v.optional(v.id("jobGroups")), // Chain link
  status: v.union(
    v.literal("pending"),              // No jobs started
    v.literal("running"),              // At least one job running
    v.literal("complete"),             // All terminal, at least one succeeded
    v.literal("failed")                // All terminal, all failed
  ),
  aggregatedResult: v.optional(v.string()), // Combined job results
  createdAt: v.number(),
})
  .index("by_assignment", ["assignmentId"])
  .index("by_status", ["status"])
```

**Note:** Groups are just containers - they have NO `jobType` or `context`. Each job has its own type/context.

**Status Rules:**
- `complete` if ALL jobs are terminal AND at least one succeeded
- `failed` if ALL jobs are terminal AND all failed
- Jobs can fail individually without failing the group

### jobs

Individual work items. Each job has its own type, harness, and context.

```typescript
jobs: defineTable({
  groupId: v.id("jobGroups"),          // Parent group
  jobType: v.string(),                 // e.g., "review", "pm", "implement", "uat"
  harness: v.union(
    v.literal("claude"),
    v.literal("codex"),
    v.literal("gemini")
  ),
  context: v.optional(v.string()),     // Job-specific context
  prompt: v.optional(v.string()),      // Full prompt sent to agent
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("complete"),
    v.literal("failed")
  ),
  result: v.optional(v.string()),      // Agent output
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_group", ["groupId"])
  .index("by_group_status", ["groupId", "status"])
  .index("by_status", ["status"])
```

Jobs in a group can have **different types, harnesses, and contexts**. Example group:
```
Group contains:
├── Job: type=review, harness=claude, context="Review auth"
├── Job: type=review, harness=codex, context="Review auth"
├── Job: type=review, harness=gemini, context="Review auth"
└── Job: type=uat, harness=claude, context="Test login"
```

### chatThreads

User-agent conversation containers.

```typescript
chatThreads: defineTable({
  namespaceId: v.id("namespaces"),
  title: v.string(),
  mode: v.union(
    v.literal("jam"),                  // Read-only ideation
    v.literal("cook"),                 // Full autonomy
    v.literal("guardian")              // Cook + alignment monitoring
  ),
  lastPromptMode: v.optional(v.union(  // For differential prompting
    v.literal("jam"),
    v.literal("cook")
  )),
  assignmentId: v.optional(v.id("assignments")), // Guardian mode link
  claudeSessionId: v.optional(v.string()),       // Session resume
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_namespace", ["namespaceId"])
  .index("by_namespace_updated", ["namespaceId", "updatedAt"])
  .index("by_assignment", ["assignmentId"])
```

### chatMessages

Conversation history within threads.

```typescript
chatMessages: defineTable({
  threadId: v.id("chatThreads"),
  role: v.union(
    v.literal("user"),
    v.literal("assistant"),
    v.literal("pm")                    // PM reports in guardian mode
  ),
  content: v.string(),
  createdAt: v.number(),
})
  .index("by_thread", ["threadId"])
  .index("by_thread_created", ["threadId", "createdAt"])
```

### chatJobs

Async chat responses (separate from assignment jobs).

```typescript
chatJobs: defineTable({
  threadId: v.id("chatThreads"),
  namespaceId: v.id("namespaces"),
  harness: v.union(
    v.literal("claude"),
    v.literal("codex"),
    v.literal("gemini")
  ),
  context: v.string(),                 // JSON with thread info
  prompt: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("running"),
    v.literal("complete"),
    v.literal("failed")
  ),
  result: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_namespace", ["namespaceId"])
  .index("by_status", ["status"])
  .index("by_namespace_status", ["namespaceId", "status"])
  .index("by_thread", ["threadId"])
```

---

## Scheduler Logic

### Chain Navigation

The scheduler walks the group chain to find ready jobs:

```
1. Start at assignment.headGroupId
2. For each group in chain:
   - If pending + no running jobs: return ALL pending jobs (parallel dispatch)
   - If any jobs running: wait (return empty)
   - If all terminal: accumulate results, advance to nextGroupId
3. Reset accumulated results at PM groups
```

### Ready Job Selection

```typescript
interface ReadyJob {
  job: Doc<"jobs">;
  group: Doc<"jobGroups">;
  assignment: Doc<"assignments">;
  accumulatedResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }>;
}
```

**Key Rules:**
- Returns ALL pending jobs in a ready group (parallel execution)
- Returns empty if any job in the current group is running
- Accumulated results provide context for PM jobs

### Assignment Scheduling

| Assignment Type | Behavior |
|-----------------|----------|
| `independent: true` | Always eligible for scheduling (parallel with others) |
| `independent: false` | Only ONE non-independent assignment active at a time |

Sequential assignment priority:
1. Active sequential assignment (if exists)
2. Pending sequential by priority (lower = higher)
3. Pending sequential by creation time (oldest first)

---

## Auto-Expansion

Certain job types automatically expand to multiple harnesses. **This happens in the CLI, not in Convex mutations.**

### Configuration (in CLI)

```typescript
const AUTO_EXPAND_CONFIG: Record<string, Harness[]> = {
  review: ["claude", "codex", "gemini"],
  "architecture-review": ["claude", "codex", "gemini"],
  "spec-review": ["claude", "codex", "gemini"],
};
```

### Behavior

When inserting a job via CLI with an auto-expand type and no explicit harness:
1. CLI looks up `AUTO_EXPAND_CONFIG[jobType]`
2. If found, CLI expands to multiple job definitions (one per harness)
3. The expanded jobs array is sent to the Convex mutation
4. All jobs share the same `groupId` and run in parallel
5. PM receives aggregated results from all jobs

**Example:** `--type review` (without `--harness`) creates 3 jobs:
```json
[
  {"jobType": "review", "harness": "claude"},
  {"jobType": "review", "harness": "codex"},
  {"jobType": "review", "harness": "gemini"}
]
```

**Mixing types:** You can include expanded and non-expanded jobs in one group:
```bash
--jobs '[{"jobType":"review"},{"jobType":"uat","harness":"claude"}]'
# Results in 4 jobs: review×3 + uat×1
```

---

## CLI Interface

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WORKFLOW_ASSIGNMENT_ID` | Default assignment for commands |
| `WORKFLOW_GROUP_ID` | Default `--after` for insert-job |
| `WORKFLOW_JOB_ID` | Current job ID |
| `WORKFLOW_THREAD_ID` | Auto-link assignments to thread |

### Commands

#### Queries

```bash
# List/get assignments
workflow assignments [--status <status>]
workflow assignment <id>

# List/get groups
workflow groups [--status <status>] [--assignment <id>]
workflow group <id>

# List/get jobs
workflow jobs [--status <status>] [--group <id>]
workflow job <id>

# Queue status
workflow queue
```

#### Assignment Mutations

```bash
# Create assignment
workflow create "<northStar>" [--priority N] [--independent] [--thread <id>]

# Insert job(s) into assignment
workflow insert-job [assignmentId] --type <type> [--harness <h>] [--context <c>]
workflow insert-job [assignmentId] --jobs '[{"jobType":"review"},{"jobType":"implement"}]'
#   --after <groupId>  Link after specific group
#   --append           Find tail group and link there

# Update assignment
workflow update-assignment [id] [--artifacts <s>] [--decisions <s>] [--alignment <status>]

# Status changes
workflow complete [assignmentId]
workflow block [assignmentId] --reason "<reason>"
workflow unblock [assignmentId]
workflow delete-assignment <id>
```

#### Job Mutations

```bash
workflow start-job <jobId>
workflow complete-job <jobId> --result "<result>"
workflow fail-job <jobId> [--result "<result>"]
```

#### Chat Commands

```bash
workflow chat-threads
workflow chat-thread <threadId>
workflow chat-create [--title <title>]
workflow chat-send <threadId> "<message>" [--harness <h>]
workflow chat-mode <threadId> <jam|cook|guardian> [--assignment <id>]
workflow chat-title <threadId> "<title>"
```

---

## Thread Modes

| Mode | Description | Capabilities |
|------|-------------|--------------|
| `jam` | Read-only ideation | PO helps refine requirements. Cannot create assignments. |
| `cook` | Full autonomy | PO creates assignments, inserts jobs. No oversight. |
| `guardian` | Cook + monitoring | PO evaluates PM reports for alignment. Requires linked assignment. |

### Guardian Mode Flow

```
1. User jams with PO, refines requirements
2. User switches to guardian mode (links assignment)
3. Assignment executes: job → PM → job → PM → ...
4. On PM completion:
   - PM response inserted as chatMessage (role: 'pm')
   - System triggers PO evaluation chatJob
   - PO responds with alignment indicator (🟢/🟠/🔴)
   - PO may block assignment if misaligned
5. User can discuss concerns and unblock
```

---

## Result Aggregation

When a group completes, job results are aggregated with minimal jobType labels:

```
## review A
{result from first review job}

---

## review B
{result from second review job}

---

## review C
{result from third review job}

---

## uat
{result from uat job}
```

- Multiple jobs of the same type get A/B/C suffixes
- Single jobs of a type get no suffix
- No harness names in headers (not needed)

This aggregated result is:
1. Stored on `group.aggregatedResult`
2. Included in `accumulatedResults` for subsequent PM jobs (reads from individual job results)
3. Reset when PM jobs complete (prevents duplicate context)

---

## Known Issues and Considerations

### From Code Review (2026-02-02)

1. **Sequential queue stall risk** - Assignments set to `active` on job start but not auto-completed. May block other sequential work.

2. **Partial parallel dispatch** - If a group has both pending and running jobs, returns empty (waits for running to complete). This prevents starvation but may delay dispatch.

3. **No job timeout** - Hung jobs block the group indefinitely. Consider adding timeout mechanism.

4. **Mixed job arrays** - When inserting multiple jobs, group `jobType` comes from first job. Other job types are not stored at group level.

5. **Failed job results excluded** - Accumulated results only include successful jobs. PM does not see failed job output.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Chain at group level | Cleaner mental model - "groups complete, chain advances" |
| "Succeeds if any" policy | Appropriate for diverse-perspective reviews |
| Config-driven expansion | Easy to modify without code changes |
| Aggregated results as markdown | Human-readable, PM can parse naturally |

---

## File Locations

| Component | Path |
|-----------|------|
| Schema | `workflow-engine/convex/schema.ts` |
| Assignments | `workflow-engine/convex/assignments.ts` |
| Jobs & Groups | `workflow-engine/convex/jobs.ts` |
| Scheduler | `workflow-engine/convex/scheduler.ts` |
| Chat Threads | `workflow-engine/convex/chatThreads.ts` |
| Chat Messages | `workflow-engine/convex/chatMessages.ts` |
| Chat Jobs | `workflow-engine/convex/chatJobs.ts` |
| CLI | `.agents/tools/workflow/cli.ts` |
| Runner | `.agents/tools/workflow/runner.ts` |
| Config | `.agents/tools/workflow/config.json` |
