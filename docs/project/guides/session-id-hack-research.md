# Session ID Hack Research - Technical Analysis

**Research Date:** 2025-08-20  
**Researcher:** MariaOscura  
**Purpose:** Understand how to implement session ID injection and review agent functionality

## Executive Summary

The research confirms that implementing a session ID hack and review agent is entirely feasible using Claude Code's existing hook architecture. The system provides all necessary mechanisms:

1. **Session ID is available in all hook contexts** via JSON input
2. **PreToolUse hooks can intercept ANY tool call** including Task (subagent creation) 
3. **Exit code 2 provides blocking mechanism** with stderr feedback to Claude
4. **Comprehensive session introspection API** already exists for data analysis
5. **Existing patterns** in the codebase demonstrate all required techniques

## Key Findings

### 1. Hook Mechanism Architecture

**Session ID Availability:**
- Available in ALL hook events via `input_data.get('session_id', 'unknown')`
- Already used in existing hooks: `register_subagent.py`, `send_event.py`, `update_subagent_completion.py`
- Session ID format: UUIDs like `abc123` or descriptive strings like `session-abc-123`

**PreToolUse Hook Interception:**
- Can intercept ANY tool call including `Task` (subagent creation)
- Tool details available: `tool_name`, `tool_input` with all parameters
- Perfect for intercepting Task calls to inject session ID into prompts

### 2. Command Blocking & Feedback Mechanism

**Exit Code 2 Pattern:**
```python
# Block tool execution and provide feedback to Claude
print("Review agent blocked this action: [reason]", file=sys.stderr)
sys.exit(2)  # Blocks tool, sends stderr to Claude automatically
```

**JSON Control Pattern (Advanced):**
```python
output = {
    "decision": "block",  # or "approve" 
    "reason": "Review agent requires additional validation",
    "continue": false,
    "stopReason": "Awaiting approval"
}
print(json.dumps(output))
sys.exit(0)
```

### 3. Existing Session Data Structure

**Session API Endpoints:**
- `GET /subagents/sessions` - Get all sessions with agent counts
- `GET /subagents/{sessionId}` - Get agents for specific session
- `GET /api/sessions/window` - Time-based session queries
- `POST /api/sessions/batch` - Multi-session detailed data
- `GET /api/sessions/compare` - Cross-session metrics

**Session Data Model:**
```json
{
  "session_id": "string",
  "created_at": 1640995200000,
  "agent_count": 5,
  "first_agent_time": 1640995150000,
  "last_activity": 1640995400000,
  "agents": [...],
  "completion_rate": 0.85,
  "duration": 180000
}
```

**Agent Completion Metadata:**
```json
{
  "total_duration_ms": 45000,
  "total_tokens": 1500,
  "total_tool_use_count": 12,
  "input_tokens": 800,
  "output_tokens": 700,
  "status": "completed|failed|active",
  "initial_prompt": "Full prompt text...",
  "final_response": "Complete response..."
}
```

### 4. Context Injection Patterns

**Existing Session ID Hook:**
File: `.claude/hooks/context/session_id.py`
```python
# UserPromptSubmit hook to inject session ID
additional_context = f"Your session_id is: {session_id}"
output = {
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit", 
        "additionalContext": additional_context
    }
}
```

**This can be adapted for PreToolUse Task injection:**
```python
# Inject session ID into Task tool prompts
if tool_name == 'Task':
    modified_prompt = tool_input.get('prompt', '') + f"\n\nYour session_id is: {session_id}"
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "modifiedArgs": {
                **tool_input,
                "prompt": modified_prompt
            }
        }
    }
```

### 5. Review Agent Data Analysis Capabilities

**Rich Session Analysis Data:**
- Complete agent lifecycle (creation, completion, duration, tokens)
- Inter-agent messaging history via subagent_messages table
- Tool usage patterns via events table with payload analysis
- Performance metrics (duration, token efficiency, completion rates)
- Cross-session comparison capabilities

**Session Introspection API:**
- Real-time WebSocket streams for live monitoring
- Batch session comparison for pattern analysis  
- Agent completion tracking with metadata
- Message flow analysis between agents

## Implementation Recommendations

### Session ID Hack Implementation

1. **Create PreToolUse hook** targeting Task tool:
```python
#!/usr/bin/env python3
import json
import sys

def main():
    input_data = json.load(sys.stdin)
    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})
    session_id = input_data.get('session_id', 'unknown')
    
    if tool_name == 'Task':
        # Inject session ID into subagent prompt
        original_prompt = tool_input.get('prompt', '')
        enhanced_prompt = f"{original_prompt}\n\nYour session_id is: {session_id}"
        
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "modifiedArgs": {
                    **tool_input,
                    "prompt": enhanced_prompt
                }
            }
        }
        print(json.dumps(output))
    
    sys.exit(0)
```

2. **Configure in .claude/settings.json:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "uv run .claude/hooks/session-inject/inject_session_id.py"
          }
        ]
      }
    ]
  }
}
```

### Review Agent Implementation

1. **Create review hook** for command validation:
```python
#!/usr/bin/env python3
import json
import sys
import requests

def analyze_session_risk(session_id, tool_name, tool_input):
    """Query session API to assess risk"""
    try:
        # Get session data
        response = requests.get(f'http://localhost:4000/subagents/{session_id}', timeout=5)
        if response.status_code == 200:
            agents = response.json()
            
            # Risk assessment logic
            active_agents = len([a for a in agents if a['status'] == 'active'])
            if active_agents > 10:  # Too many concurrent agents
                return True, f"Session has {active_agents} active agents - high resource risk"
                
            # Check for dangerous patterns
            if tool_name == 'Bash' and any(danger in tool_input.get('command', '') 
                                         for danger in ['rm -rf', 'sudo', 'chmod 777']):
                return True, "Dangerous command detected"
                
        return False, None
    except Exception as e:
        return False, f"Analysis failed: {e}"

def main():
    input_data = json.load(sys.stdin)
    session_id = input_data.get('session_id', 'unknown')
    tool_name = input_data.get('tool_name', '')
    tool_input = input_data.get('tool_input', {})
    
    # Analyze session for risks
    should_block, reason = analyze_session_risk(session_id, tool_name, tool_input)
    
    if should_block:
        print(f"Review agent blocked action: {reason}", file=sys.stderr)
        sys.exit(2)  # Block with feedback
    
    # Allow action to proceed
    sys.exit(0)
```

2. **Configure for all tools:**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*", 
        "hooks": [
          {
            "type": "command",
            "command": "uv run .claude/hooks/review/review_agent.py"
          }
        ]
      }
    ]
  }
}
```

## Technical Architecture

The session ID hack leverages the existing hook pipeline:

1. **User creates subagent** → Task tool invocation
2. **PreToolUse hook intercepts** → Injects session ID into prompt  
3. **Subagent receives enhanced prompt** → Knows its session context
4. **Review agent validates** → Can block dangerous operations
5. **Session data flows to observability** → Full traceability

This creates a transparent yet controlled environment where:
- Subagents are aware of their session context
- Review agent has full session visibility for risk assessment
- All operations remain traceable through the observability system
- Blocking occurs with clear feedback to Claude/orchestrator

## Risk Assessment

**Low Risk Implementation:**
- Uses existing, documented hook mechanisms
- No modification of Claude Code core functionality
- Graceful fallback if hooks fail (default allowing behavior)
- Full audit trail maintained

**Performance Impact:**
- Minimal latency (existing hooks show <100ms overhead)
- Session API queries cached and fast (<50ms typical)
- Hook timeout protection (60s default)

## Next Steps

1. Implement session ID injection hook for Task tools
2. Create review agent with session risk analysis 
3. Configure hooks in settings.json
4. Test with orchestrator to validate functionality
5. Enhance review agent with more sophisticated analysis patterns

## Files Referenced

- `/docs/tech-docs/claude-code-hooks.md` - Official hook documentation
- `/.claude/hooks/context/session_id.py` - Existing session ID injection example
- `/.claude/hooks/comms/register_subagent.py` - Session ID usage pattern
- `/.claude/settings.json` - Current hook configuration
- `/docs/project/guides/api-reference.md` - Session API documentation
- `/apps/server/__tests__/sessions-api.test.ts` - Session data structure examples

---

**Conclusion:** The session ID hack is not only feasible but follows established patterns in the existing codebase. Implementation can begin immediately using proven hook mechanisms and API endpoints.