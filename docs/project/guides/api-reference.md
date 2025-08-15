# API Reference

The Multi-Agent Observability & Communication System provides comprehensive REST APIs, WebSocket endpoints, and hook system integration for monitoring and coordinating Claude Code agents.

## Table of Contents

- [Server Configuration](#server-configuration)
- [Observability API](#observability-api)
- [Multi-Agent Communication API](#multi-agent-communication-api)
- [Session Management API](#session-management-api)
- [WebSocket APIs](#websocket-apis)
- [Hook System API](#hook-system-api)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Testing Examples](#testing-examples)

## Server Configuration

**Base URL**: `http://localhost:4000`
**WebSocket URLs**: 
- `ws://localhost:4000/stream` (single-session events)
- `ws://localhost:4000/api/sessions/multi-stream` (multi-session management)

All endpoints support CORS and return JSON responses unless otherwise noted.

## Observability API

### Submit Event

**POST** `/events`

Submit hook events from Claude Code agents to the observability system.

#### Request Body
```json
{
  "source_app": "string",      // Required: Project identifier
  "session_id": "string",      // Required: Claude session ID
  "hook_event_type": "string", // Required: Event type (see Event Types)
  "payload": {},               // Required: Event-specific data
  "chat": [],                  // Optional: Chat history array
  "summary": "string"          // Optional: AI-generated summary
}
```

#### Response
```json
{
  "id": 123,
  "source_app": "my-project",
  "session_id": "session-abc-123",
  "hook_event_type": "PreToolUse",
  "payload": { "tool_name": "Bash", "tool_input": { "command": "ls" } },
  "timestamp": 1640995200000
}
```

#### Event Types
| Type | Description | Payload Structure |
|------|-------------|-------------------|
| `PreToolUse` | Before tool execution | `{ "tool_name": "string", "tool_input": {} }` |
| `PostToolUse` | After tool completion | `{ "tool_name": "string", "result": "string" }` |
| `Notification` | User interactions | `{ "message": "string", "type": "info\|warning\|error" }` |
| `UserPromptSubmit` | User prompt submission | `{ "prompt": "string", "metadata": {} }` |
| `Stop` | Response completion | `{ "summary": "string", "token_count": number }` |
| `SubagentStop` | Subagent completion | `{ "agent_name": "string", "status": "completed\|failed" }` |
| `PreCompact` | Context compaction | `{ "before_size": number, "after_size": number }` |

### Get Recent Events

**GET** `/events/recent`

Retrieve recent events with optional limiting.

#### Query Parameters
- `limit` (optional): Maximum events to return (default: 100)

#### Response
```json
[
  {
    "id": 123,
    "source_app": "my-project",
    "session_id": "session-abc-123",
    "hook_event_type": "PreToolUse",
    "payload": { "tool_name": "Bash" },
    "timestamp": 1640995200000
  }
]
```

### Get Filter Options

**GET** `/events/filter-options`

Get available filter values for events.

#### Response
```json
{
  "source_apps": ["project-1", "project-2"],
  "session_ids": ["session-abc", "session-def"],
  "hook_event_types": ["PreToolUse", "PostToolUse", "Notification"]
}
```

### Get Session Events

**GET** `/events/session/{sessionId}`

Get all events for a specific session with optional event type filtering.

#### Path Parameters
- `sessionId`: The session ID to filter by

#### Query Parameters
- `types` (optional): Comma-separated list of event types to include

#### Response
```json
{
  "sessionId": "session-abc-123",
  "eventTypes": ["UserPromptSubmit", "ToolUse"],
  "events": [...],
  "count": 15
}
```

## Multi-Agent Communication API

### Register Subagent

**POST** `/subagents/register`

Register a new subagent for communication and tracking.

#### Request Body
```json
{
  "session_id": "string",      // Required: Session identifier
  "name": "string",            // Required: Unique agent name
  "subagent_type": "string"    // Required: Agent type/role
}
```

#### Response
```json
{
  "success": true,
  "id": 456
}
```

### Send Message

**POST** `/subagents/message`

Send a message from one subagent to others.

#### Request Body
```json
{
  "sender": "string",          // Required: Sender agent name
  "message": "string|object"   // Required: Message content
}
```

#### Message Structure Examples
```json
// Simple string message
{
  "sender": "Agent-Alpha",
  "message": "Task completed successfully"
}

// Structured message
{
  "sender": "Agent-Beta", 
  "message": {
    "type": "status_update",
    "data": { "progress": 75, "status": "processing" },
    "priority": "high"
  }
}
```

#### Response
```json
{
  "success": true,
  "id": 789
}
```

### Get Unread Messages

**POST** `/subagents/unread`

Retrieve unread messages for a specific subagent.

#### Request Body
```json
{
  "subagent_name": "string"    // Required: Agent name
}
```

#### Response
```json
{
  "messages": [
    {
      "sender": "Agent-Alpha",
      "message": "Hello from Alpha!",
      "created_at": 1640995200000
    }
  ]
}
```

### Get All Messages

**GET** `/subagents/messages`

Get all messages in the system (for debugging/monitoring).

#### Response
```json
[
  {
    "sender": "Agent-Alpha",
    "message": { "type": "update", "data": {} },
    "created_at": 1640995200000,
    "notified": ["Agent-Beta", "Agent-Gamma"]
  }
]
```

### Get Session Agents

**GET** `/subagents/{sessionId}`

Get all registered agents for a specific session.

#### Path Parameters
- `sessionId`: Session to query

#### Response
```json
[
  {
    "id": 1,
    "session_id": "session-abc-123",
    "name": "Agent-Alpha",
    "subagent_type": "engineer",
    "created_at": 1640995200000,
    "status": "active",
    "completed_at": null
  }
]
```

### Update Agent Completion

**POST** `/subagents/update-completion`

Update an agent's completion status and metadata.

#### Request Body
```json
{
  "session_id": "string",
  "name": "string",
  "status": "completed|failed|terminated",
  "completed_at": 1640995300000,
  "total_duration_ms": 45000,
  "total_tokens": 1500,
  "total_tool_use_count": 8,
  "input_tokens": 800,
  "output_tokens": 700,
  "initial_prompt": "Your role is...",
  "final_response": "Task completed..."
}
```

### Get Agent Full Data

**GET** `/subagents/{sessionId}/{agentName}/full`

Get complete agent data including large text fields (prompts/responses).

#### Response
```json
{
  "id": 1,
  "name": "Agent-Alpha",
  "session_id": "session-abc-123",
  "initial_prompt": "Your full prompt text...",
  "final_response": "Complete response...",
  "prompt_length": 2400,
  "response_length": 1800,
  "has_prompt": true,
  "has_response": true,
  "created_at": 1640995200000,
  "completed_at": 1640995300000
}
```

### Update Agent Data

**PATCH** `/subagents/{sessionId}/{agentName}`

Update agent prompt, response, or metadata.

#### Request Body
```json
{
  "initial_prompt": "Updated prompt text...",
  "final_response": "Updated response text...",
  "metadata": { "custom": "data" }
}
```

#### Response
```json
{
  "success": true,
  "updated_fields": ["initial_prompt", "final_response"],
  "message": "Updated 2 field(s) for agent Agent-Alpha"
}
```

## Session Management API

### Get Sessions Overview

**GET** `/subagents/sessions`

Get all sessions with agent counts.

#### Response
```json
[
  {
    "session_id": "session-abc-123",
    "created_at": 1640995200000,
    "agent_count": 5
  }
]
```

### Get Sessions in Time Window

**GET** `/api/sessions/window`

Fetch sessions within a specific time range.

#### Query Parameters
- `start`: Unix timestamp (required)
- `end`: Unix timestamp (required)
- `limit`: Max sessions to return (default: 50)

#### Response
```json
[
  {
    "session_id": "session-abc-123",
    "created_at": 1640995200000,
    "agent_count": 3,
    "first_agent_time": 1640995150000,
    "last_activity": 1640995400000
  }
]
```

### Batch Fetch Session Details

**POST** `/api/sessions/batch`

Get detailed information for multiple sessions.

#### Request Body
```json
{
  "sessionIds": ["session-1", "session-2"],
  "includeAgents": true,
  "includeMessages": false
}
```

#### Response
```json
[
  {
    "session_id": "session-1",
    "agent_count": 3,
    "created_at": 1640995200000,
    "status": "completed",
    "duration": 180000,
    "agents": [...],
    "last_activity": 1640995380000
  }
]
```

### Compare Sessions

**GET** `/api/sessions/compare`

Compare metrics across multiple sessions.

#### Query Parameters
- `sessionIds`: Comma-separated session IDs (1-10 sessions)

#### Response
```json
{
  "sessions": [
    {
      "session_id": "session-1",
      "agent_count": 3,
      "message_count": 12,
      "duration": 180000,
      "status": "completed",
      "completion_rate": 1.0
    }
  ],
  "metrics": {
    "total_sessions": 2,
    "total_agents": 7,
    "total_messages": 25,
    "average_duration": 150000,
    "completion_rate": 0.85
  }
}
```

## WebSocket APIs

### Single-Session Event Stream

**WebSocket** `ws://localhost:4000/stream`

Real-time event updates for all sessions.

#### Client Messages
No special messages required - connection automatically receives events.

#### Server Messages
```json
// Initial connection - recent events
{
  "type": "initial",
  "data": [...events...]
}

// New event
{
  "type": "event",
  "data": {
    "id": 123,
    "source_app": "my-project",
    "hook_event_type": "PreToolUse",
    "timestamp": 1640995200000
  }
}

// Agent registered
{
  "type": "subagent_registered",
  "data": {
    "session_id": "session-abc",
    "name": "Agent-Alpha",
    "subagent_type": "engineer"
  }
}

// Agent message
{
  "type": "subagent_message",
  "data": {
    "sender": "Agent-Alpha",
    "message": "Hello team!"
  }
}
```

### Multi-Session Management Stream

**WebSocket** `ws://localhost:4000/api/sessions/multi-stream`

Subscribe to specific sessions for targeted updates.

#### Client Messages
```json
// Subscribe to sessions
{
  "action": "subscribe",
  "sessionIds": ["session-1", "session-2"]
}

// Subscribe to single session
{
  "action": "subscribe", 
  "sessionId": "session-abc"
}

// Unsubscribe
{
  "action": "unsubscribe",
  "sessionIds": ["session-1"]
}
```

#### Server Messages
```json
// Subscription confirmed
{
  "type": "subscription_confirmed",
  "sessionIds": ["session-1", "session-2"]
}

// Session event (for subscribed sessions only)
{
  "type": "session_event",
  "sessionId": "session-1",
  "data": {...event...}
}

// Agent registered in subscribed session
{
  "type": "agent_registered",
  "sessionId": "session-1", 
  "data": {...agent...}
}

// Agent status update
{
  "type": "agent_status_update",
  "sessionId": "session-1",
  "data": {...completion_data...}
}

// Agent data updated (prompt/response)
{
  "type": "agent_data_updated",
  "sessionId": "session-1", 
  "agentName": "Agent-Alpha",
  "updatedFields": ["initial_prompt"],
  "timestamp": 1640995200000
}
```

## Hook System API

The hook system provides Python scripts for integration with Claude Code.

### Configuration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [
        {
          "type": "command",
          "command": "uv run .claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse --summarize"
        }
      ]
    }],
    "PostToolUse": [{
      "matcher": "",
      "hooks": [
        {
          "type": "command", 
          "command": "uv run .claude/hooks/observability/send_event.py --source-app YOUR_PROJECT_NAME --event-type PostToolUse --summarize"
        }
      ]
    }]
  }
}
```

### Hook Scripts

#### Send Event

```bash
# Basic event
uv run .claude/hooks/observability/send_event.py \
  --source-app "my-project" \
  --event-type "PreToolUse" \
  --payload '{"tool_name": "Bash", "command": "ls"}'

# With AI summary
uv run .claude/hooks/observability/send_event.py \
  --source-app "my-project" \
  --event-type "PostToolUse" \
  --summarize \
  --add-chat
```

#### Send Message

```bash
# Simple message
uv run .claude/hooks/comms/send_message.py \
  --sender "Agent-Alpha" \
  --message "Task completed"

# Structured message
uv run .claude/hooks/comms/send_message.py \
  --sender "Agent-Beta" \
  --type "status_update" \
  --message "Processing files" \
  --data '{"progress": 75}'
```

#### Get Messages

```bash
# Human readable
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "Agent-Alpha"

# JSON output
uv run .claude/hooks/comms/get_unread_messages.py \
  --name "Agent-Alpha" \
  --json
```

#### Register Agent

```bash
uv run .claude/hooks/comms/register_subagent.py \
  --session-id "session-abc-123" \
  --name "Agent-Alpha" \
  --type "engineer"
```

#### Update Completion

```bash
uv run .claude/hooks/comms/update_subagent_completion.py \
  --session-id "session-abc-123" \
  --name "Agent-Alpha" \
  --status "completed" \
  --total-tokens 1500
```

## Database Schema

The system uses SQLite with three main tables:

### events
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,           -- Project identifier
  session_id TEXT NOT NULL,           -- Claude session ID
  hook_event_type TEXT NOT NULL,      -- Type of hook event
  payload TEXT NOT NULL,              -- JSON event data
  chat TEXT,                          -- JSON chat history
  summary TEXT,                       -- AI-generated summary
  timestamp INTEGER NOT NULL         -- Unix timestamp
);
```

### subagent_registry
```sql
CREATE TABLE subagent_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,           -- Session identifier
  name TEXT NOT NULL,                 -- Agent name/nickname
  subagent_type TEXT NOT NULL,        -- Agent type/role
  created_at INTEGER NOT NULL,        -- Registration timestamp
  completed_at INTEGER,               -- Completion timestamp
  status TEXT DEFAULT 'active',       -- active|completed|failed|terminated
  total_duration_ms INTEGER,          -- Total execution time
  total_tokens INTEGER,               -- Token usage
  total_tool_use_count INTEGER,       -- Number of tools used
  input_tokens INTEGER,               -- Input token count
  output_tokens INTEGER,              -- Output token count
  cache_creation_input_tokens INTEGER, -- Cache creation tokens
  cache_read_input_tokens INTEGER,    -- Cache read tokens
  initial_prompt TEXT,                -- Full prompt sent to agent
  final_response TEXT                 -- Final agent response
);
```

### subagent_messages
```sql
CREATE TABLE subagent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,               -- Sending agent name
  message TEXT NOT NULL,              -- JSON message content
  created_at INTEGER NOT NULL,        -- Message timestamp
  notified TEXT                       -- JSON array of notified agents
);
```

### Indexes

Performance-optimized indexes on:
- `events`: source_app, session_id, hook_event_type, timestamp
- `subagent_registry`: session_id, name, created_at, status, completed_at
- `subagent_messages`: sender, created_at

## Error Handling

### Standard Error Response
```json
{
  "error": "Description of the error",
  "details": "Additional error information"
}
```

### Common Status Codes
- **200**: Success
- **400**: Bad Request (missing required fields, invalid JSON)
- **404**: Resource not found (agent, session)
- **500**: Internal server error

### Validation Errors
```json
{
  "error": "Validation failed",
  "validation_errors": [
    {
      "field": "initial_prompt",
      "message": "Prompt exceeds maximum size of 1048576 characters", 
      "code": "TEXT_TOO_LONG"
    }
  ]
}
```

### Connection Errors
- **Hook Scripts**: Automatically handle connection failures and timeouts
- **WebSocket**: Implement reconnection logic with exponential backoff
- **HTTP Clients**: Use appropriate timeout values (5-10 seconds recommended)

## Testing Examples

### Manual Event Testing

```bash
# Test event submission
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test-project",
    "session_id": "test-session-123", 
    "hook_event_type": "PreToolUse",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {"command": "echo hello"}
    }
  }'

# Test message sending
curl -X POST http://localhost:4000/subagents/message \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "TestAgent",
    "message": "Hello from curl!"
  }'
```

### System Validation

```bash
# Run comprehensive system tests
./scripts/test-system.sh

# Test WebSocket connection
wscat -c ws://localhost:4000/stream

# Test multi-session WebSocket
wscat -c ws://localhost:4000/api/sessions/multi-stream
```

### Load Testing

```bash
# Generate test events
for i in {1..100}; do
  curl -X POST http://localhost:4000/events \
    -H "Content-Type: application/json" \
    -d "{\"source_app\":\"load-test\",\"session_id\":\"session-$i\",\"hook_event_type\":\"PreToolUse\",\"payload\":{\"test\":true}}"
done
```

### Multi-Agent Communication Testing

```bash
# Register test agents
uv run .claude/hooks/comms/register_subagent.py \
  --session-id "test-session" \
  --name "Agent-1" \
  --type "engineer"

uv run .claude/hooks/comms/register_subagent.py \
  --session-id "test-session" \
  --name "Agent-2" \
  --type "reviewer"

# Send messages between agents
uv run .claude/hooks/comms/send_message.py \
  --sender "Agent-1" \
  --message "Starting work on feature X"

uv run .claude/hooks/comms/get_unread_messages.py \
  --name "Agent-2" \
  --json

# Test completion updates
uv run .claude/hooks/comms/update_subagent_completion.py \
  --session-id "test-session" \
  --name "Agent-1" \
  --status "completed" \
  --total-tokens 1200
```

## Rate Limits and Performance

- **Event ingestion**: No enforced limits, but SQLite performance degrades with >10,000 events/minute
- **WebSocket connections**: No limit on concurrent connections
- **Message polling**: Recommended maximum 1 request/second per agent
- **Session batch queries**: Maximum 20 sessions per request
- **Text field limits**: 1MB maximum for initial_prompt and final_response fields
- **Database**: Uses WAL mode for better concurrent performance

## Security Considerations

- **Local development only**: Server binds to localhost:4000
- **No authentication**: Designed for development environments
- **Input validation**: Basic JSON schema validation on all endpoints
- **SQL injection protection**: Uses parameterized queries
- **CORS enabled**: Allows cross-origin requests for development

---

For implementation examples and integration guides, see:
- [Installation Guide](installation.md)
- [Hook System Documentation](hook-events.md)
- [Agent Communication Guide](agent-communication.md)
- [Development Setup](development.md)