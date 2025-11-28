# Agent Job Adapter

Self-contained `uv` Python scripts that turn verbose CLI agent runs (Codex, Gemini CLI) into **file-backed jobs** with stable IDs and cheap status checks.

## Quick Start

```bash
# Spawn a new job (returns immediately)
uv run agent_job.py spawn --harness codex -- "your assignment here"
# Output: Agent running. Check status with: `uv run agent_job.py status <job_id>`

# Check job status
uv run agent_job.py status <job_id>

# List all jobs
uv run agent_job.py list

# Monitor jobs with TUI
uv run agent_monitor.py
```

## Commands

### `spawn`

Starts a new agent job with the specified harness. Returns immediately after initialization.

```bash
uv run agent_job.py spawn --harness <gemini|codex> -- "<assignment>"
```

**Output:**
```
Agent running. Check status with: `uv run agent_job.py status 019abd9d-8cb2-7e81-bae9-2a8fe5be04fa`
```

### `status`

Get current status of a job with computed runtime metrics.

```bash
uv run agent_job.py status <job_id>
```

**Running job output:**
```json
{
  "job_id": "019abd9d-8cb2-7e81-bae9-2a8fe5be04fa",
  "harness": "codex",
  "pid": 12345,
  "logs": "/path/to/agent.log",
  "status": "running",
  "status_reason": "command_execution",
  "start_time": "2025-11-25T08:10:06.262Z",
  "last_event_time": "2025-11-25T08:10:29.337Z",
  "runtime_sec": 23.1,
  "idle_sec": 4.0,
  "operations": 18
}
```

**Completed job output:**
```json
{
  "job_id": "019abd9d-8cb2-7e81-bae9-2a8fe5be04fa",
  "harness": "codex",
  "pid": 12345,
  "logs": "/path/to/agent.log",
  "status": "complete",
  "status_reason": "completed",
  "start_time": "2025-11-25T08:10:06.262Z",
  "last_event_time": "2025-11-25T08:10:29.337Z",
  "runtime_sec": 23.1,
  "operations": 18,
  "end_time": "2025-11-25T08:10:29.340Z",
  "completion": {
    "messages": ["Task completed successfully."],
    "tokens": { "input": 7288, "output": 84, "total": 7372 },
    "duration_ms": 13845
  }
}
```

### `list`

List all jobs with full status information.

```bash
uv run agent_job.py list
```

## Monitor TUI

Real-time terminal UI for monitoring agent jobs, similar to `top`.

```bash
uv run agent_monitor.py              # Default 2s refresh
uv run agent_monitor.py --interval 5 # Custom refresh interval
```

**Features:**
- Color-coded status indicators:
  - `●` Yellow = running
  - `✓` Green = complete
  - `✗` Red = error
  - `⏱` Red = timeout
- Columns: Status, Harness, Job ID, Status Reason, Started, Runtime, Operations
- Scrollable log viewer

**Keyboard Controls:**

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate job list |
| `Enter` | View job log |
| `r` | Refresh / reload log |
| `q` | Quit |

**Log View Controls:**

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Scroll line by line |
| `PgUp/PgDn` | Scroll by page |
| `Home/End` | Jump to start/end |
| `r` | Reload log file |
| `ESC` | Back to job list |

## Job Status

| Status | Description |
|--------|-------------|
| `running` | Job is currently executing |
| `complete` | Job finished successfully |
| `error` | Job failed (see `status_reason`) |
| `timeout` | Job killed due to idle timeout |

## Status Reason

The `status_reason` field shows current activity while running:

**Codex:**
- `initializing` - Job starting up
- `thinking` - Turn started
- `reasoning` - Agent reasoning
- `command_execution` - Running shell command
- `todo_list` - Managing todos
- `agent_message` - Generating response
- `completed` - Finished

**Gemini:**
- `initializing` - Job starting up
- `run_shell_command` - Running command
- `write_file` / `read_file` - File operations
- `write_todos` - Managing todos
- `responding` - Generating response
- `completed` - Finished

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `AGENT_JOBS_ROOT` | `$TMPDIR/agent_jobs/$USER` | Root directory for job files |
| `IDLE_TIMEOUT_SEC` | `300` | Seconds of inactivity before killing job |

## File Structure

Each job creates a directory under `AGENT_JOBS_ROOT`:

```
<jobs_root>/<job_id>/
    status.json    # Current job state (updated on each event)
    agent.log      # Raw harness output (appended in real-time)
```

## Supported Harnesses

### Codex

Uses `codex --yolo e "<assignment>" --json`

Events handled:
- `thread.started` - Extracts job ID (thread_id)
- `turn.started` - Sets status_reason to "thinking"
- `item.started/completed` - Updates status_reason with item type
- `turn.completed` - Extracts token usage

### Gemini CLI

Uses `gemini --yolo -s -m gemini-3-pro-preview --output-format stream-json "<assignment>"`

Events handled:
- `init` - Extracts session ID as job ID
- `tool_use` - Updates status_reason with tool name
- `message` (assistant) - Accumulates response text
- `result` - Extracts token stats and duration

## Babysitter Pattern

For autonomous monitoring:

1. **Spawn** the job - returns immediately with job ID
2. **Poll** status periodically
3. **React** based on status:
   - `running` - Check `idle_sec`, continue monitoring
   - `complete` - Read `completion.messages`
   - `timeout` - Report idle timeout exceeded
   - `error` - Check `status_reason` and logs
