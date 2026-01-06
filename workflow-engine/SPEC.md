# Workflow Engine Specification

## Overview

A job queue system for orchestrating sequential Claude/Codex/Gemini headless runs. Assignments create linked-list job chains. A PM agent reviews after each job and decides next steps.

**Core insight**: Claude gets "checkbox brain" in monolithic prompts. This system enforces focused, single-purpose runs with fresh PM review between each.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CONVEX BACKEND                                             │
│  - assignments table                                        │
│  - jobs table                                               │
│  - Real-time subscriptions                                  │
└─────────────────────────────────────────────────────────────┘
              ▲
              │ WebSocket subscription
              │
┌─────────────────────────────────────────────────────────────┐
│  RUNNER DAEMON (Node)                                       │
│  - Subscribes to job state changes                          │
│  - Schedules ready jobs                                     │
│  - Builds prompts from templates                            │
│  - Executes harness (claude/codex/gemini)                   │
│  - Parses JSON stream, updates job status                   │
│  - Triggers PM shadow job on completion                     │
└─────────────────────────────────────────────────────────────┘
              │
              │ spawns
              ▼
┌─────────────────────────────────────────────────────────────┐
│  HARNESS PROCESS                                            │
│  claude --dangerously-skip-permissions --verbose \          │
│         --output-format stream-json -p "<prompt>"           │
└─────────────────────────────────────────────────────────────┘
```

---

## Convex Schema

### assignments

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | string | Repo identifier (from config) |
| `northStar` | string | Full assignment text, immutable |
| `status` | "pending" \| "active" \| "blocked" \| "complete" | Current state |
| `blockedReason` | string? | Why blocked (for human) |
| `independent` | boolean | Can run parallel with other assignments |
| `priority` | number | Default 10, lower = higher priority |
| `artifacts` | string | Blob: `filepath:description\n...` |
| `decisions` | string | Blob: PM appends decision record |
| `headJobId` | Id<"jobs">? | First job in linked list |
| `createdAt` | number | Timestamp |
| `updatedAt` | number | Timestamp |

### jobs

| Field | Type | Description |
|-------|------|-------------|
| `assignmentId` | Id<"assignments"> | Parent assignment |
| `jobType` | string | Template key: "plan", "implement", "refine", "uat", "verify", "research", "pm", "retrospect" |
| `harness` | "claude" \| "codex" \| "gemini" | Which CLI to run |
| `context` | string? | PM instruction for this specific job |
| `status` | "pending" \| "running" \| "complete" \| "failed" | Current state |
| `result` | string? | Final message output from harness |
| `nextJobId` | Id<"jobs">? | Linked list pointer |
| `startedAt` | number? | Timestamp |
| `completedAt` | number? | Timestamp |
| `createdAt` | number | Timestamp |

---

## Job Types → Templates

```
.agents/tools/workflow/templates/
├── plan.md          # Break down assignment into tasks
├── implement.md     # Write code for specific task
├── refine.md        # Review and improve implementation
├── uat.md           # Manual testing, user flow validation
├── verify.md        # Final verification against north star
├── research.md      # Investigation, codebase exploration
├── pm.md            # Shadow job: review result, decide next
└── retrospect.md    # Failure analysis, determine recovery
```

---

## Prompt Builder

Each job prompt is assembled from:

```
┌─────────────────────────────────────────────────────────────┐
│  TEMPLATE (from jobType)                                    │
│  Contains placeholders:                                     │
│    {{NORTH_STAR}}                                           │
│    {{ARTIFACTS}}                                            │
│    {{DECISIONS}}                                            │
│    {{CONTEXT}}                                              │
│    {{PREVIOUS_RESULT}}                                      │
└─────────────────────────────────────────────────────────────┘
```

**Resolution:**

| Placeholder | Source |
|-------------|--------|
| `{{NORTH_STAR}}` | `assignment.northStar` |
| `{{ARTIFACTS}}` | `assignment.artifacts` |
| `{{DECISIONS}}` | `assignment.decisions` |
| `{{CONTEXT}}` | `job.context` (PM wrote this) |
| `{{PREVIOUS_RESULT}}` | Previous job in chain's `result` |

---

## Execution Flow

### Scheduler Logic

```
on convex subscription update:

  1. Get all assignments where namespace = CONFIG.namespace
     AND status IN ("pending", "active")

  2. For each assignment, walk job chain from headJobId
     Find first job where status = "pending" AND
       (is head OR previous job status = "complete")
     This is the "ready" job for that assignment

  3. Partition ready jobs:
     - independent_ready: assignment.independent = true
     - sequential_ready: assignment.independent = false

  4. For sequential_ready:
     - If any non-independent assignment has status = "active", skip all
     - Else, pick oldest assignment (createdAt), then lowest priority

  5. For independent_ready:
     - Run all immediately (parallel)

  6. Execute selected jobs
```

### Job Execution

```
execute(job):
  1. Update job.status = "running", job.startedAt = now
  2. Update assignment.status = "active"

  3. Build prompt:
     - Load template from templates/{job.jobType}.md
     - Resolve placeholders
     - Get previous job result if exists

  4. Spawn harness:
     claude --dangerously-skip-permissions --verbose \
            --output-format stream-json -p "<prompt>"

     OR for codex/gemini, use existing agent_job.py patterns

  5. Parse JSON stream:
     - Track status_reason (thinking, tool use, etc)
     - Capture final message as result
     - Handle timeout (configurable, default 10min)

  6. On completion:
     - Update job.status = "complete", job.result = final_message
     - Update job.completedAt = now

  7. Trigger PM shadow job (unless job.jobType = "pm")
```

### PM Shadow Job

After each non-PM job completes:

```
trigger_pm(completed_job):
  1. Create new job:
     {
       assignmentId: completed_job.assignmentId,
       jobType: "pm",
       harness: "claude",  // or configurable
       context: null,      // PM doesn't need extra context
       status: "pending",
       nextJobId: completed_job.nextJobId  // inherit chain position
     }

  2. Update completed_job.nextJobId = new_pm_job.id
     (PM inserts itself into chain)

  3. PM job runs, reviews result, decides:
     - Insert new job(s) after itself
     - Update assignment.artifacts
     - Append to assignment.decisions
     - Mark assignment.status = "complete"
     - Mark assignment.status = "blocked" with reason
```

### Failure Flow

```
on job timeout or harness crash:
  1. Update job.status = "failed"

  2. Create retrospect job:
     {
       jobType: "retrospect",
       context: "Previous job failed: {failure_reason}"
     }

  3. Retrospect analyzes, PM follows to determine recovery
```

---

## Runner Daemon

Node process, pattern from `watch-feedback.ts`:

```typescript
// .agents/tools/workflow/runner.ts

interface Config {
  convexUrl: string;
  namespace: string;
}

// Load config from .agents/tools/workflow/config.json
// Subscribe to Convex
// On update: run scheduler logic
// Spawn harness processes detached
// Parse JSON streams
// Update Convex on completion
```

**Key behaviors:**
- Runs forever (no exit code concept)
- WebSocket subscription = instant reaction to DB changes
- Detached child processes for harness runs
- Parallel execution for independent assignments
- Self-healing on disconnect (like watch-feedback.ts)

---

## CLI Interface

PM-ergonomic. Primary consumer is the PM agent.

```bash
# Query
workflow jobs [--status pending|running|complete|failed]
workflow job <job_id>
workflow assignments [--status pending|active|blocked|complete]
workflow assignment <assignment_id>

# Mutations (PM uses these)
workflow insert-job <assignment_id> \
  --type <job_type> \
  --harness <claude|codex|gemini> \
  --context "Specific instruction" \
  --after <job_id>

workflow update-assignment <assignment_id> \
  --artifacts "filepath:description" \
  --decisions "Decision rationale"

workflow complete <assignment_id>
workflow block <assignment_id> --reason "Need human input on X"

# Human operations
workflow create "Assignment north star text" [--priority 5] [--independent]
workflow unblock <assignment_id>
workflow queue  # Show what's pending/running
```

---

## Config

Per-repo config file:

```json
// .agents/tools/workflow/config.json
{
  "convexUrl": "https://your-project.convex.cloud",
  "namespace": "claude-code-hooks-multi-agent-observability",
  "defaultHarness": "claude",
  "timeoutMs": 600000,
  "pmHarness": "claude"
}
```

---

## Template Example: pm.md

```markdown
You are the PM Agent reviewing a completed job.

## Assignment North Star
{{NORTH_STAR}}

## Artifacts Produced So Far
{{ARTIFACTS}}

## Decision Record
{{DECISIONS}}

## Just-Completed Job Result
{{PREVIOUS_RESULT}}

---

## Your Task

Review the completed job output against the north star.

Decide ONE of:
1. **Insert next job** - Work continues. Specify job type, harness, and context.
2. **Complete assignment** - North star fully achieved.
3. **Block assignment** - Critical decision needed from human. Specify reason.

Use the workflow CLI to execute your decision:
- `workflow insert-job <assignment_id> --type <type> --harness <harness> --context "..."`
- `workflow complete <assignment_id>`
- `workflow block <assignment_id> --reason "..."`

Also update artifacts and decisions as needed:
- `workflow update-assignment <assignment_id> --artifacts "..." --decisions "..."`
```

---

## Open Questions

1. **PM model**: Use haiku for speed? Or same model as job?
2. **Parallel limit**: Max concurrent independent jobs?
3. **Job timeout**: Per-job-type config? Or global?
4. **Result truncation**: If harness output is huge, truncate for PM?

---

## Implementation Order

1. Convex schema + basic queries/mutations
2. CLI scaffold (thin wrapper over Convex calls)
3. Prompt builder (template loading + placeholder resolution)
4. Runner daemon (subscription + scheduler)
5. Harness execution (claude JSON stream parsing)
6. PM shadow job trigger
7. Templates (plan, implement, refine, uat, verify, pm)
8. Retrospect flow
