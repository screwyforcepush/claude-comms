# Workflow Engine Onboarding

## What We Built

A job queue system for orchestrating sequential Claude/Codex/Gemini headless runs. Solves the "checkbox brain" problem where Claude rushes through todos without quality gates.

### Architecture

```
Convex Backend (workflow-engine/)     ← Schema, queries, mutations
        ↑
        │ WebSocket subscription
        │
Runner Daemon (.agents/tools/workflow/runner.ts)  ← Executes jobs
        │
        │ spawns
        ↓
Claude/Codex/Gemini headless          ← Actual work
        │
        │ on complete
        ↓
PM Shadow Job                         ← Reviews, decides next step
```

### Key Concepts

- **Assignment**: User intent (north star). Has linked list of jobs.
- **Job**: Single Claude/Codex/Gemini run. Types: plan, implement, review, uat, document, pm.
- **PM Agent**: Runs after each job. Reviews result, inserts next job or completes/blocks assignment.
- **Namespace**: Isolates assignments per repo in shared Convex backend.

## Files Created

### Backend (`workflow-engine/`)
```
convex/
├── schema.ts         # assignments + jobs tables
├── assignments.ts    # CRUD
├── jobs.ts           # CRUD
└── scheduler.ts      # getReadyJobs, watchQueue
```

**Deployed to**: `https://utmost-vulture-618.convex.cloud`

### Consumer-facing (`.agents/tools/workflow/`)
```
├── workflow-engine/  # symlink → ../../../workflow-engine
├── cli.ts            # PM-ergonomic CLI
├── runner.ts         # WebSocket daemon
├── config.json       # namespace, convex URL
├── templates/        # Prompt templates (plan.md, implement.md, etc.)
├── README.md
├── CONSUMER_SETUP.md # Distribution notes for other repos
└── SPEC.md           # (in workflow-engine/)
```

## Current State

- ✅ Convex schema deployed
- ✅ CLI working (`npx tsx .agents/tools/workflow/cli.ts queue`)
- ✅ Templates created
- ✅ Runner daemon written
- ⏳ Runner not yet tested end-to-end
- ⏳ PM shadow job flow not tested

## What Needs Testing

### 1. Start the runner
```bash
npx tsx .agents/tools/workflow/runner.ts
```

### 2. Create a test assignment
```bash
npx tsx .agents/tools/workflow/cli.ts create "Create a hello world function in test-hello.ts"
```

### 3. Add initial job
```bash
npx tsx .agents/tools/workflow/cli.ts insert-job <assignment_id> \
  --type implement \
  --harness claude \
  --context "Create a simple hello world function that returns 'Hello, World!'"
```

### 4. Watch the runner
- Should pick up the job
- Execute Claude headless
- On completion, trigger PM job
- PM should review and decide next steps

### 5. Verify end state
```bash
npx tsx .agents/tools/workflow/cli.ts assignment <assignment_id>
```

## CLI Quick Reference

```bash
# Queries
cli.ts queue                          # Queue status
cli.ts assignments                    # List all
cli.ts assignment <id>                # Details with jobs
cli.ts jobs                           # List jobs
cli.ts job <id>                       # Job details

# Mutations
cli.ts create "<north_star>"          # New assignment
cli.ts insert-job <aid> --type X --harness Y --context "Z"
cli.ts update-assignment <aid> --status complete         # Mark done
cli.ts update-assignment <aid> --status blocked --reason "..."  # Escalate to human
cli.ts update-assignment <aid> --status active           # Resume
```

## Config

Copy `config.example.json` to `config.json` and edit:

```json
{
  "convexUrl": "https://your-project.convex.cloud",
  "namespace": "your-repo-name",
  "timeoutMs": 600000,
  "harnessDefaults": {
    "default": "claude",
    "plan": "claude",
    "implement": "claude",
    "review": "claude",
    "uat": "claude",
    "document": "claude",
    "pm": "claude",
    "chat": "claude"
  }
}
```

## Claude JSON Stream Format

```
{"type":"system","subtype":"init","session_id":"...","tools":[...],...}
{"type":"assistant","message":{"content":[{"type":"text","text":"..."}],...}}
{"type":"assistant","message":{"content":[{"type":"tool_use","name":"...","input":{...}}],...}}
{"type":"user","message":{"content":[{"type":"tool_result","content":"..."}]}}
{"type":"result","subtype":"success","result":"final output text","duration_ms":...}
```

**Key extraction:**
- Assistant text: `event.message.content[].text` where `type === "text"`
- Final result: `event.result` when `event.type === "result"`
- Success: `event.subtype === "success"`

## Known Issues / TODO

1. Consumer repo distribution strategy not finalized (see CONSUMER_SETUP.md)
2. Parallel job execution logic could be tightened
3. No retry logic for transient failures yet

## Session Context

We spec'd this collaboratively, iterating on:
- Entity model (Assignment → Jobs linked list)
- Parallelism (assignment-level, not job-level)
- PM as shadow job pattern
- Convex-first for real-time reactivity
- CLI ergonomics for PM agent consumption

The eng-cog metacognitive framework from `docs/options/eng-prompt.md` was used for initial framing but dropped during rapid iteration.
