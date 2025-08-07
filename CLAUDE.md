# Claude Code Multi-Agent Observability System

## Overview

This system provides comprehensive observability for Claude Code interactions through a sophisticated hooks architecture that captures, processes, and visualizes AI agent activities in real-time.

## Architecture Components

### 1. Hook System (`.claude/hooks/observability/`)

Python-based hooks intercept Claude Code events and are configured via `.claude/settings.json`:

- **PreToolUse**: Captures tool calls before execution
- **PostToolUse**: Captures tool results after execution  
- **UserPromptSubmit**: Logs user prompts
- **Stop**: Handles session completion, copies chat transcripts
- **SubagentStop**: Tracks subagent lifecycle
- **Notification**: System notifications
- **PreCompact**: Pre-compaction events

Each hook type executes two scripts:
1. Local processing hook (e.g., `pre_tool_use.py`) - logs locally
2. Event sender (`send_event.py`) - transmits to server with optional AI summarization

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

### 5. AI Summarization

Optional AI-powered event summarization using OpenAI's API:
- Generates concise one-sentence summaries
- Configured via `--summarize` flag in `send_event.py`
- Falls back gracefully on failure

### 6. Security Features

Built-in security validations (configurable):
- Dangerous command detection (`rm -rf` patterns)
- Sensitive file access prevention (`.env` files)
- Command pattern validation

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

### Hook Configuration
Currently hooks are commented out in `.claude/settings.json` due to directory change issues.

**To enable hooks with resilience:**
1. Uncomment the hooks in `.claude/settings.json`
2. Add `$CLAUDE_PROJECT_DIR` to all hook paths:
```json
"command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/observability/pre_tool_use.py"
```

## Local Logging

All events are logged locally in `/logs/[session-id]/`:
- `pre_tool_use.json`
- `post_tool_use.json`
- `user_prompt_submit.json`
- `stop.json`
- `chat.json`

## Environment Variables

- `OPENAI_API_KEY` - Required for AI summarization
- `ENGINEER_NAME` - Optional personalization

## Key Features

### Observability
- **Real-time Monitoring**: WebSocket-powered live updates
- **Multi-Agent Tracking**: Main agent and subagents
- **Resilient Design**: Never blocks Claude operations
- **Dual Storage**: Local + centralized logging
- **AI Summarization**: Intelligent event descriptions
- **Session Correlation**: All events linked by session ID
- **Complete Audit Trail**: Full interaction history

### Multi-Agent Communication
- **Agent Discovery**: Auto-registration via Task tool
- **Message Broadcasting**: Send to all agents
- **Unread Tracking**: Poll for new messages
- **Read Receipts**: Track message consumption
- **Session Isolation**: Messages scoped to sessions
- **Structured Messaging**: Support for typed messages

## Development

The system is designed for extensibility:
- Add new hook types in `.claude/settings.json`
- Extend server endpoints in `apps/server/src/index.ts`
- Customize dashboard in `apps/client/src/`
- Modify AI summarization in `utils/summarizer.py`

## Testing

### System Testing
```bash
# Full system test
./scripts/test-system.sh

# Test server
cd apps/server
bun test

# Test client
cd apps/client
npm run test
```

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