# Data Flow Analysis: Prompt/Response Capture Implementation

**Analyst**: MarcusCipher  
**Date**: 2025-08-14  
**Purpose**: Complete analysis of data flow for implementing prompt/response capture in agent Task() calls

## Current Data Flow Architecture

### 1. Hook System Architecture

Claude Code uses a comprehensive hook system with these event types:
- **PreToolUse**: Before tool execution (captures `tool_input`)
- **PostToolUse**: After tool execution (captures `tool_input`, `tool_response`, timing, usage)
- **UserPromptSubmit**: When user submits prompt
- **Notification**: System notifications
- **Stop**: Main agent completion
- **SubagentStop**: Subagent completion
- **PreCompact**: Before context compression
- **SessionStart**: Session initialization

### 2. Current Task() Call Processing

```mermaid
graph LR
A[Claude Code Task() Call] --> B[PreToolUse Hook]
B --> C[register_subagent.py]
B --> D[send_event.py]
C --> E[HTTP POST /subagents/register]
D --> F[HTTP POST /events]
E --> G[SQLite Database]
F --> G
G --> H[WebSocket Broadcast]
H --> I[Vue.js Frontend]
```

**Current Payload Structure (PreToolUse)**:
```json
{
  "session_id": "abc123",
  "tool_name": "Task",
  "tool_input": {
    "description": "JoseAsic: implement user authentication",
    "prompt": "Your name is JoseAsic. Implement user authentication...",
    "subagent_type": "engineer"
  },
  "hook_event_name": "PreToolUse"
}
```

**Current Payload Structure (PostToolUse)**:
```json
{
  "session_id": "abc123",
  "tool_name": "Task", 
  "tool_input": {
    "description": "JoseAsic: implement user authentication",
    "prompt": "Your name is JoseAsic. Implement user authentication...",
    "subagent_type": "engineer"
  },
  "tool_response": {
    "totalDurationMs": 45000,
    "totalTokens": 2500,
    "totalToolUseCount": 15,
    "usage": {
      "input_tokens": 1800,
      "output_tokens": 700,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 200
    }
  },
  "hook_event_name": "PostToolUse"
}
```

### 3. Database Schema (Current)

**events table**:
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  hook_event_type TEXT NOT NULL,
  payload TEXT NOT NULL,         -- JSON stringified hook data
  chat TEXT,                     -- Optional chat transcript
  summary TEXT,                  -- AI-generated summary
  timestamp INTEGER NOT NULL
);
```

**subagent_registry table**:
```sql
CREATE TABLE subagent_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subagent_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT DEFAULT 'active',
  total_duration_ms INTEGER,
  total_tokens INTEGER,
  total_tool_use_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  cache_read_input_tokens INTEGER
);
```

### 4. Current Data Flow Steps

1. **Registration Phase** (PreToolUse):
   - Claude Code triggers PreToolUse hook with Task() tool data
   - `register_subagent.py` extracts agent name from description
   - HTTP POST to `/subagents/register` creates registry entry
   - `send_event.py` captures full event payload
   - HTTP POST to `/events` stores comprehensive hook data
   - WebSocket broadcast notifies frontend of new agent

2. **Completion Phase** (PostToolUse):  
   - Claude Code triggers PostToolUse with response data
   - `update_subagent_completion.py` extracts performance metrics
   - HTTP POST to `/subagents/update-completion` updates registry
   - `send_event.py` captures completion event
   - WebSocket broadcast notifies frontend of completion

3. **Frontend Display**:
   - Real-time WebSocket updates show agent timeline
   - Agent status, timing, and performance metrics displayed
   - Session comparison and multi-session support

## Missing: Prompt/Response Content Capture

### Current Limitations

The system currently captures **metadata** about Task() calls but **NOT the actual conversational content**:

- ❌ **Agent's initial prompt** (the full prompt sent to subagent)
- ❌ **Agent's response content** (the actual conversation response)
- ❌ **Tool call details** within agent conversation
- ❌ **Reasoning and thought process** of agents
- ❌ **Inter-agent communication details**

### What IS Currently Captured

- ✅ Agent registration (name, type, session)
- ✅ Performance metrics (duration, tokens, tool usage)
- ✅ Completion status
- ✅ Session tracking
- ✅ Inter-agent messaging system

## Required Modifications for Full Prompt/Response Capture

### 1. Database Schema Extensions

**New table: `agent_conversations`**:
```sql
CREATE TABLE agent_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,           -- Links to subagent_registry.id
  session_id TEXT NOT NULL,
  conversation_start_time INTEGER NOT NULL,
  initial_prompt TEXT NOT NULL,        -- Full prompt sent to agent
  final_response TEXT,                 -- Agent's complete response
  tool_calls_json TEXT,               -- JSON array of tool calls made
  conversation_transcript TEXT,        -- Full conversational exchange
  reasoning_trace TEXT,               -- Agent's thought process
  status TEXT DEFAULT 'in_progress',
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (agent_id) REFERENCES subagent_registry (id)
);
```

**Extended events table** (optional enhancement):
```sql
ALTER TABLE events ADD COLUMN agent_conversation_id INTEGER;
ALTER TABLE events ADD COLUMN conversation_phase TEXT; -- 'start', 'progress', 'complete'
```

### 2. New Hook Points Required

**Additional hooks needed** for comprehensive capture:

1. **Task Response Streaming**: Capture incremental responses
2. **Tool Call Within Agent**: Capture each tool use by subagent
3. **Agent Reasoning**: Capture decision-making process

### 3. Hook Implementation Changes

**Enhanced register_subagent.py**:
```python
# Extract and store initial prompt
initial_prompt = tool_input.get('prompt', '')
conversation_id = store_conversation_start(session_id, agent_id, initial_prompt)
```

**Enhanced update_subagent_completion.py**:
```python
# Extract final response from tool_response 
final_response = extract_agent_response(tool_response)
tool_calls = extract_tool_calls(tool_response)
update_conversation_completion(agent_id, final_response, tool_calls)
```

### 4. API Endpoints Extensions

**New endpoints needed**:
- `GET /agents/{id}/conversation` - Retrieve full conversation
- `GET /agents/{id}/tool-calls` - Get tool usage details
- `GET /sessions/{id}/conversations` - All conversations in session
- `POST /agents/{id}/conversation/stream` - Real-time conversation updates

### 5. Frontend Components

**New UI components needed**:
- Conversation viewer/modal
- Tool call timeline within agent
- Reasoning trace display
- Agent prompt/response diff viewer

## Implementation Priority & Dependencies

### Phase 1: Core Infrastructure
1. **SarahQuantum**: Database schema changes (agent_conversations table)
2. **JuanNebula**: API endpoints for conversation retrieval
3. **MarcusCipher**: Hook payload structure design

### Phase 2: Data Capture Enhancement  
1. **Hook modifications**: Enhanced capture scripts
2. **WebSocket streaming**: Real-time conversation updates
3. **Storage optimization**: Efficient large text storage

### Phase 3: Frontend Integration
1. **EmilyVector**: Conversation viewer components
2. **Timeline integration**: Agent conversation display
3. **Search/filter**: Conversation content search

## Payload Structure Recommendations

### Enhanced PreToolUse Payload:
```json
{
  "session_id": "abc123",
  "tool_name": "Task",
  "tool_input": {
    "description": "JoseAsic: implement user authentication", 
    "prompt": "Your name is JoseAsic. [FULL PROMPT TEXT...]",
    "subagent_type": "engineer"
  },
  "conversation_tracking": {
    "capture_response": true,
    "capture_tool_calls": true,
    "capture_reasoning": false  
  }
}
```

### Enhanced PostToolUse Payload:
```json
{
  "session_id": "abc123",
  "tool_name": "Task",
  "tool_response": {
    "totalDurationMs": 45000,
    "totalTokens": 2500,
    "conversation_content": {
      "final_response": "[AGENT'S COMPLETE RESPONSE...]",
      "tool_calls": [
        {
          "tool": "Read",
          "input": {"file_path": "/auth.js"},
          "response": {"content": "..."},
          "timestamp": 1692123456789
        }
      ],
      "reasoning_trace": "[AGENT THOUGHT PROCESS...]"
    }
  }
}
```

## Risk Assessment & Considerations

### Storage Impact
- **Large text storage**: Agent conversations can be substantial
- **Database growth**: Exponential growth with conversation capture
- **Performance**: Query performance on large text fields

### Privacy & Security
- **Sensitive data**: Agent conversations may contain credentials/secrets
- **Data retention**: How long to store conversation data
- **Access control**: Who can view agent conversations

### Implementation Complexity
- **Claude Code integration**: May require Claude Code core changes
- **Backward compatibility**: Ensure existing functionality continues
- **Error handling**: Robust failure modes for capture failures

## Next Steps & Coordination

### Immediate Actions:
1. **SarahQuantum**: Database schema review and optimization suggestions
2. **JuanNebula**: API endpoint design validation
3. **EmilyVector**: UI/UX requirements for conversation display
4. **Team sync**: Architecture decisions and implementation sequencing

### Dependencies:
- Claude Code hook system capabilities (research needed)
- Performance testing with large conversation storage
- Frontend real-time rendering performance

---

**Status**: Analysis Complete - Ready for Team Review & Implementation Planning