# Workflow Engine

Job queue system for orchestrating sequential Claude/Codex/Gemini headless runs.

## Architecture

```
Convex Backend (workflow-engine/)
        ↑
        │ WebSocket subscription
        │
Runner Daemon (runner.ts)
        │
        │ spawns
        ↓
Claude/Codex/Gemini headless processes
```

## Quick Start

### 1. Configure

Copy the example config and edit:

```bash
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "convexUrl": "https://utmost-vulture-618.convex.cloud",
  "namespace": "your-repo-name",
  "defaultHarness": "claude",
  "timeoutMs": 600000,
  "pmHarness": "claude"
}
```

### 2. Start the Runner

```bash
npx tsx .agents/tools/workflow/runner.ts
```

The runner subscribes to Convex and executes jobs as they become ready.

### 3. Create an Assignment

```bash
npx tsx .agents/tools/workflow/cli.ts create "Build user authentication feature"
```

### 4. Add Jobs

```bash
npx tsx .agents/tools/workflow/cli.ts insert-job <assignment_id> \
  --type plan \
  --harness claude \
  --context "Create implementation plan"
```

## CLI Reference

### Queries

```bash
# List assignments
cli.ts assignments [--status pending|active|blocked|complete]

# Get assignment with jobs
cli.ts assignment <id>

# List jobs
cli.ts jobs [--status pending|running|complete|failed]

# Get job details
cli.ts job <id>

# Queue status
cli.ts queue
```

### Mutations

```bash
# Create assignment
cli.ts create "<north_star>" [--priority N] [--independent]

# Insert job
cli.ts insert-job <assignment_id> \
  --type <plan|implement|refine|uat|verify|research> \
  --harness <claude|codex|gemini> \
  [--context "instructions"] \
  [--after <job_id>]

# Update assignment metadata
cli.ts update-assignment <id> \
  [--artifacts "filepath:description"] \
  [--decisions "decision text"]

# Complete assignment
cli.ts complete <assignment_id>

# Block assignment
cli.ts block <assignment_id> --reason "why"

# Unblock assignment
cli.ts unblock <assignment_id>

# Job status updates (typically used by runner)
cli.ts start-job <job_id>
cli.ts complete-job <job_id> --result "output"
cli.ts fail-job <job_id> [--result "error"]
```

## Job Types

| Type | Purpose |
|------|---------|
| `plan` | Break down assignment into tasks |
| `implement` | Write code for specific task |
| `refine` | Review and improve implementation |
| `uat` | User acceptance testing |
| `verify` | Final verification against north star |
| `research` | Investigation and information gathering |
| `pm` | (Shadow job) Review result, decide next |
| `retrospect` | Analyze failures, determine recovery |

## How It Works

1. **Assignment created** with north star (human intent)
2. **Jobs added** to assignment's linked list
3. **Runner picks up** ready jobs (pending + predecessor complete)
4. **Job executes** via Claude/Codex/Gemini headless
5. **PM job triggers** automatically after each completion
6. **PM decides**: insert more jobs, complete, or block
7. **Loop** until assignment complete or blocked

## Parallelism Rules

- Jobs within an assignment run **sequentially** (linked list)
- Independent assignments can run **in parallel**
- Non-independent assignments run **one at a time**
- Priority: oldest first, then lowest priority number

## Templates

Prompt templates live in `templates/`:
- `plan.md`
- `implement.md`
- `refine.md`
- `uat.md`
- `verify.md`
- `research.md`
- `pm.md`
- `retrospect.md`

Templates use placeholders:
- `{{NORTH_STAR}}` - Assignment goal
- `{{ARTIFACTS}}` - Files produced
- `{{DECISIONS}}` - Decision record
- `{{CONTEXT}}` - Job-specific instructions
- `{{PREVIOUS_RESULT}}` - Prior job output
