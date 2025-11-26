# Consultant Paradigm Guide

## Overview

The Consultant Paradigm brings **model diversity** to the multi-agent orchestration system. By wrapping OpenAI's Codex CLI and Google's Gemini CLI as "consultant" subagents, the system gains diverse perspectives without the Primary Orchestrator needing to know the underlying implementation.

This is a key application of the **Progressive Disclosure** principle: the orchestrator simply tasks a "consultant" and receives a response—completely unaware that the work was executed by Codex or Gemini rather than Claude.

## Architecture

```
Primary ⚙️Orchestrator
        │
        ├─► Task(consultant/codex) ─► Claude Proxy ─► agent_job.py ─► Codex CLI
        │                                   │
        │                              [monitors, waits]
        │                                   │
        │                              [returns verbatim]
        │
        └─► Task(consultant/gemini) ─► Claude Proxy ─► agent_job.py ─► Gemini CLI
                                            │
                                       [monitors, waits]
                                            │
                                       [returns verbatim]
```

### Component Breakdown

| Component | Location | Purpose |
|-----------|----------|---------|
| Codex Consultant | `.claude/agents/core/consultants/codex.md` | Claude proxy that spawns Codex jobs |
| Gemini Consultant | `.claude/agents/core/consultants/gemini.md` | Claude proxy that spawns Gemini jobs |
| Agent Job Adapter | `.agents/tools/agent-job/agent_job.py` | File-backed job manager for CLI harnesses |
| Consultant Template | `.agents/tools/agent-job/consultant_template.txt` | WORKFLOW + TEAMWORK injection |

## How It Works

### 1. Proxy Pattern

The consultant agents are **dumb pipes**. They do NOT:
- Read files
- Analyse requirements
- Make decisions
- Write documentation

They ONLY:
- Receive the user prompt (from orchestrator)
- Spawn the appropriate CLI harness via `agent_job.py`
- Poll for completion status
- Return the consultant's response verbatim

### 2. Job Lifecycle

```bash
# Spawn (called by proxy agent)
uv run .agents/tools/agent-job/agent_job.py spawn --harness codex --consultant -- "<prompt>"

# Status polling (60s interval)
uv run .agents/tools/agent-job/agent_job.py status <job_id>

# List all jobs
uv run .agents/tools/agent-job/agent_job.py list
```

The `--consultant` flag appends the `consultant_template.txt` which injects:
- **WORKFLOW**: The AOP procedures (CALIBRATE → IMPLEMENT/ASSESS → VALIDATE)
- **TEAMWORK**: Inter-agent communication protocols (Broadcast/Inbox Check)

### 3. Background Execution

The `agent_job.py` script:
1. Starts the CLI harness (Codex or Gemini)
2. Captures the native job/session ID
3. Forks to background (parent returns immediately)
4. Child process monitors output, updates `status.json`
5. Enforces idle timeout (300s default)
6. Captures completion stats (tokens, duration, messages)

## Benefits of Model Diversity

### 1. Cross-Model Verification
Different models have different strengths and blind spots:
- Claude checks Codex's work
- Codex checks Gemini's work
- Gemini checks Claude's work

This rotation catches errors that any single model might miss.

### 2. Diverse Perspectives on Research/Planning
When architecting or planning, spawn all three model types with identical instructions:
```
Batch: [Architect (Claude), Consultant-Codex, Consultant-Gemini]
```
Each provides independent analysis. The orchestrator merges perspectives.

### 3. Implementation Distribution
Split implementation work across model types:
```
Batch: [
  Engineer-Auth (Claude),
  Consultant-Codex (API endpoints),
  Consultant-Gemini (Database layer),
  Engineer-Tests (Claude)
]
```

### 4. Context Isolation
The orchestrator's context stays clean—it doesn't load Codex/Gemini tool definitions or output formatting quirks. All that complexity is encapsulated in the job adapter.

## Usage Patterns

### Research Batch with Diversity
```
Description: "MarcusHelion: research authentication patterns"
Subagent: architect

Description: "SophiaVektor: research authentication patterns"
Subagent: codex (consultant)

Description: "LucasNebula: research authentication patterns"
Subagent: gemini (consultant)
```
Same task, three perspectives, merged by orchestrator.

### Implementation with Mixed Models
```
Description: "AlexFrontend: implement product catalog UI"
Subagent: engineer (Claude)

Description: "JordanBackend: implement product API"
Subagent: codex (consultant)

Description: "RileyTests: write integration tests"
Subagent: gemini (consultant)
```

### Review+Refine with Cross-Check
After implementation batch, swap models for review:
```
# If Claude implemented, have Codex review
Description: "TaylorReview: review and refine product catalog"
Subagent: codex (consultant)  # Reviews Claude's work

# If Codex implemented, have Gemini review
Description: "CaseyReview: review and refine product API"
Subagent: gemini (consultant)  # Reviews Codex's work
```

## Job Status Reference

### Status Values
| Status | Meaning |
|--------|---------|
| `running` | Job in progress, actively producing output |
| `complete` | Job finished successfully |
| `error` | Job failed (check `status_reason`) |
| `timeout` | Job exceeded idle timeout |

### Status JSON Structure
```json
{
  "job_id": "thread_abc123",
  "harness": "codex",
  "status": "complete",
  "status_reason": "completed",
  "start_time": "2025-01-15T10:30:00.000Z",
  "end_time": "2025-01-15T10:45:23.456Z",
  "runtime_sec": 923.5,
  "operations": 47,
  "completion": {
    "messages": ["Final response text..."],
    "tokens": {
      "input": 12500,
      "output": 3200,
      "total": 15700
    },
    "duration_ms": 923456
  }
}
```

## Configuration

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `IDLE_TIMEOUT_SEC` | 300 | Seconds of inactivity before job timeout |
| `AGENT_JOBS_ROOT` | `$TMPDIR/agent_jobs/$USER` | Job storage directory |

### Harness Requirements
- **Codex**: `codex` CLI installed and authenticated
- **Gemini**: `gemini` CLI installed and authenticated

## Troubleshooting

### Job Not Starting
1. Verify CLI is installed: `which codex` or `which gemini`
2. Check authentication: run CLI directly with a simple prompt
3. Check logs: `cat $TMPDIR/agent_jobs/$USER/<job_id>/agent.log`

### Job Timing Out
- Default idle timeout is 300 seconds
- Increase via `IDLE_TIMEOUT_SEC=600 uv run agent_job.py spawn ...`
- Check if harness is actually producing output

### Proxy Agent Not Returning
- The proxy polls every 60 seconds
- Long-running jobs are expected—the proxy will wait
- Check job status manually: `uv run agent_job.py status <job_id>`

## Best Practices

1. **Use Consultants Liberally**: When batching multiple engineers, substitute some with Codex/Gemini consultants for diversity
2. **Cross-Check Pattern**: Have different model types review each other's work
3. **Research Diversity**: Spawn one of each for research/planning tasks, merge results
4. **Don't Over-Orchestrate**: The proxy handles everything—just task it like any other agent
5. **Monitor Jobs**: Use `agent_job.py list` to see all running/completed jobs
