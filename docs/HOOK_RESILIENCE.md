# Hook Resilience Guide

## Problem: Hooks Fail When Claude Changes Directory

When Claude Code executes `cd` commands during its workflow, hooks configured with relative paths fail because they execute from the changed directory rather than the project root.

### Example Failure Scenario
```json
// This configuration breaks when Claude changes directory:
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "command": "uv run .claude/hooks/observability/pre_tool_use.py"
      }]
    }]
  }
}
```

If Claude executes `cd apps/server`, the hook tries to run from `apps/server/.claude/hooks/...` which doesn't exist.

## Solution: Use CLAUDE_PROJECT_DIR Environment Variable

Claude Code provides the `$CLAUDE_PROJECT_DIR` environment variable that always points to your project root, regardless of the current working directory.

### Correct Configuration
```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/pre_tool_use.py"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type PreToolUse"
      }]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/post_tool_use.py"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type PostToolUse"
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/user_prompt_submit.py --log-only"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type UserPromptSubmit"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/stop.py --chat"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type Stop --add-chat"
      }]
    }],
    "SubagentStop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/subagent_stop.py"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type SubagentStop"
      }]
    }],
    "Notification": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/notification.py --notify"
      }, {
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type Notification"
      }]
    }],
    "PreCompact": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py --source-app my-app --event-type PreCompact"
      }]
    }]
  }
}
```

## Using CLAUDE_PROJECT_DIR in Python Scripts

Your Python hook scripts can also use this environment variable for file operations:

```python
import os
import json

# Get the project root directory
PROJECT_DIR = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())

# Use it for file paths
log_dir = os.path.join(PROJECT_DIR, 'logs')
config_file = os.path.join(PROJECT_DIR, '.claude', 'config.json')

# For the session log directory
session_id = input_data.get('session_id')
session_log_dir = os.path.join(PROJECT_DIR, 'logs', session_id)
```

## Alternative Solutions

### 1. Shell Script Wrappers
Create a wrapper script that ensures execution from the correct directory:

```bash
#!/bin/bash
# .claude/hooks/run-hook.sh
cd "$CLAUDE_PROJECT_DIR"
exec uv run "$CLAUDE_PROJECT_DIR/.claude/hooks/$1" "${@:2}"
```

Then use in settings.json:
```json
"command": "$CLAUDE_PROJECT_DIR/.claude/hooks/run-hook.sh observability/pre_tool_use.py"
```

### 2. Python Path Resolution
Within your Python scripts, dynamically resolve paths:

```python
import os
import sys

# Add project root to Python path
hook_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.abspath(os.path.join(hook_dir, '../../..'))
sys.path.insert(0, project_dir)

# Now imports and file access work from project root
```

## Why Not MCP Servers?

While MCP (Model Context Protocol) servers could solve the directory issue by running as persistent processes, they're overkill for most hook use cases:

**When MCP makes sense:**
- You need persistent state across Claude sessions
- Complex routing or message queue functionality
- You want to expose functionality back to Claude as tools
- Cross-project or cross-session coordination

**When hooks are better:**
- Simple event logging and observability
- Stateless operations
- Quick validation or blocking logic
- Minimal infrastructure overhead

For this multi-agent communication system, the hybrid approach works well:
- Hooks for observability (simple, stateless)
- HTTP server for message routing (already provides persistence)
- No need for additional MCP complexity

## Testing Hook Resilience

Test your hooks work regardless of directory:

```bash
# Test from project root
uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py \
  --source-app test --event-type Test

# Test after changing directory
cd apps/server
uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/send_event.py \
  --source-app test --event-type Test

# Both should work identically
```

## Migration Checklist

- [ ] Update all hook commands in `.claude/settings.json` to use `$CLAUDE_PROJECT_DIR`
- [ ] Update Python scripts to use `os.environ.get('CLAUDE_PROJECT_DIR')` for file paths
- [ ] Test hooks work when Claude changes directories
- [ ] Update any documentation or README files
- [ ] Commit the resilient configuration

## Summary

Always use `$CLAUDE_PROJECT_DIR` in your hook configurations to ensure they work regardless of Claude's current working directory. This simple change makes your hooks resilient and reliable without adding architectural complexity.