# Claude Code Multi-Agent Observability System

[IMPORTANT]
SUBAGENT PROTOCOL
When you Task() agents with your Task tool, it is critical that you ALWAYS include a wildly unique/random AgentName in the `description` and `prompt` params. 
Address the agent by their AgentName throughout the prompt as you instruct them.

Format 
    - description: "<AgentName>: " + short description of task
    - prompt: Your name is <AgentName>. full task instruction and context

Example Task tool usage with parameters:
    - description: "JostCuttingham: clean up docs"
    - prompt: "Your AgentName is JostCuttingham. Your task is to update readme files and documentation in ./docs because ... JostCuttingham, make sure you understand the current state of .src/server/ and relationship with ..."
    - subagent_type: "general-purpose"

[/IMPORTANT]

## Overview

This system provides comprehensive observability for Claude Code interactions through a sophisticated hooks architecture that captures, processes, and visualizes AI agent activities in real-time.

## Architecture Components

### 1. Hook System (`.claude/hooks/`)

Python-based hooks intercept Claude Code events and are configured via `.claude/settings.json`:


### 2. Data Flows

#### Observability Flow
```
Claude Code Action
    ↓
Hook Triggered (.claude/settings.json)
    ↓
Local Hook Script + send_event.py
    ↓
HTTP POST to Bun Server (localhost:4000)
    ↓
SQLite Database Storage (events table)
    ↓
WebSocket Broadcast
    ↓
Real-time Dashboard Update
```

#### Communication Flow
```
Subagent A sends message
    ↓
send_message.py → HTTP POST
    ↓
Server stores in subagent_messages table
    ↓
Subagent B polls with get_unread_messages.py
    ↓
Server marks message as read for B
    ↓
Dashboard shows real-time message exchange
```

### 3. Bun Server (`apps/server/`)

TypeScript/Bun server providing:
- HTTP API for event ingestion
- WebSocket for real-time updates
- SQLite database for event storage
- CORS-enabled endpoints

**Key Endpoints:**

*Observability:*
- `POST /events` - Receive hook events
- `GET /events/recent` - Retrieve recent events
- `GET /events/filter-options` - Get filter options
- `WS /stream` - Real-time event stream

*Multi-Agent Communication:*
- `POST /subagents/register` - Register new subagent
- `POST /subagents/message` - Send inter-agent message
- `POST /subagents/unread` - Get unread messages
- `GET /subagents/messages` - Get all messages
- `GET /subagents/:sessionId` - List session agents

**Database Schema:**
```sql
-- Observability events
events (
  id, source_app, session_id, hook_event_type,
  payload, chat, summary, timestamp
)

-- Agent registry for discovery
subagent_registry (
  id, session_id, name, subagent_type, created_at
)

-- Inter-agent messaging
subagent_messages (
  id, sender, message, created_at, notified
)
```

### 4. Vue Dashboard (`apps/client/`)

Dual-purpose dashboard with two tabs:

**Event Timeline Tab:**
- Real-time event visualization
- Live WebSocket updates
- Advanced filtering (source, session, event type)
- Chat transcript viewer
- Interactive pulse charts

**Subagent Communications Tab:**
- Live agent registry per session
- Real-time message display
- Read receipt tracking
- Agent discovery and identification


## Running the System

### Prerequisites
- Bun runtime
- Python with `uv` package manager
- Node.js for client
- Claude Code CLI

### Quick Start
```bash
# Start entire system
./scripts/start-system.sh

# Access dashboard at http://localhost:5173
```

- `ENGINEER_NAME` - Optional personalization

## Development

The system is designed for extensibility:
- Add new hook types in `.claude/settings.json`
- Extend server endpoints in `apps/server/src/index.ts`
- Customize dashboard in `apps/client/src/`


### Multi-Agent Communication Testing
```bash
# Send test message
uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/send_message.py \
  --sender "TestAgent" \
  --message "Test message"

# Check for messages
uv run $CLAUDE_PROJECT_DIR/.claude/hooks/comms/get_unread_messages.py \
  --name "TestAgent" \
  --json
```

### Using Test Agents
The system includes `hook-test-dummy` agents for testing multi-agent communication.
In Claude Code, create parallel test agents to verify messaging functionality.