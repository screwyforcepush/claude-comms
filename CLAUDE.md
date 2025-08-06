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

### 2. Data Flow

```
Claude Code Action
    “
Hook Triggered (.claude/settings.json)
    “
Local Hook Script + send_event.py
    “
HTTP POST to Bun Server (localhost:4000)
    “
SQLite Database Storage
    “
WebSocket Broadcast
    “
Real-time Dashboard Update
```

### 3. Bun Server (`apps/server/`)

TypeScript/Bun server providing:
- HTTP API for event ingestion
- WebSocket for real-time updates
- SQLite database for event storage
- CORS-enabled endpoints

**Key Endpoints:**
- `POST /events` - Receive hook events
- `GET /events/recent` - Retrieve recent events
- `WS /stream` - Real-time event stream

**Database Schema:**
```sql
events (
  id, source_app, session_id, hook_event_type,
  payload, chat, summary, timestamp
)
```

### 4. Vue Dashboard (`apps/client/`)

Real-time observability dashboard with:
- Event timeline visualization
- Live WebSocket updates
- Advanced filtering (source, session, event type)
- Chat transcript viewer
- Interactive charts

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

### Server Setup
```bash
cd apps/server
bun install
bun run dev
```

### Client Setup
```bash
cd apps/client
npm install
npm run dev
```

### Hook Configuration
Hooks are automatically triggered by Claude Code based on `.claude/settings.json` configuration.

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

- **Real-time Monitoring**: WebSocket-powered live updates
- **Multi-Agent Support**: Tracks main agent and subagents
- **Resilient Design**: Never blocks Claude operations
- **Dual Storage**: Local + centralized logging
- **AI-Enhanced**: Intelligent event summarization
- **Session Correlation**: All events linked by session ID
- **Complete Audit Trail**: Full interaction history with timestamps

## Development

The system is designed for extensibility:
- Add new hook types in `.claude/settings.json`
- Extend server endpoints in `apps/server/src/index.ts`
- Customize dashboard in `apps/client/src/`
- Modify AI summarization in `utils/summarizer.py`

## Testing

When making changes to this codebase:
```bash
# Test server
cd apps/server
bun test

# Test client
cd apps/client
npm run test

# Lint and typecheck
bun run lint
bun run typecheck
```