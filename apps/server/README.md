# Multi-Agent Observability Server - Real-time Event Processing & Communication Hub

High-performance Bun TypeScript server that powers real-time observability and inter-agent communication for Claude Code multi-agent workflows. Handles event capture, SQLite storage, WebSocket broadcasting, and agent message routing.

## 🚀 Quick Start

**Goal**: Running server in 30 seconds
**Prerequisites**: [Bun runtime](https://bun.sh) installed

### Installation (3 commands max)
```bash
# 1. Install dependencies
bun install

# 2. Start development server with hot reload
bun run dev

# 3. Verify server is running
curl http://localhost:4000
```

**Expected Result**: Server responds with "Multi-Agent Observability Server" and logs show WebSocket endpoints ready

## 🎯 What This Does

### Core Capabilities
1. **Event Processing**: Captures and stores Claude Code hook events in real-time
2. **WebSocket Broadcasting**: Live event streaming to dashboard clients
3. **Agent Communication**: Inter-agent message routing and discovery
4. **Session Management**: Multi-session tracking with agent orchestration
5. **SQLite Storage**: Persistent event history with optimized queries

### Key Benefits
- Real-time observability for all Claude Code agent activity
- Zero-latency inter-agent communication via WebSocket
- Comprehensive API for dashboard integration
- Production-ready SQLite storage with transaction safety
- Multi-session support for parallel agent workflows

## 🏗️ Architecture Overview

```
Claude Agents → HTTP POST → Bun Server → SQLite Database
                    ↓              ↓
             WebSocket Broadcast → Vue Dashboard
                    ↓
           Agent Message Router → Communication APIs
```

**Tech Stack**: Bun, TypeScript, SQLite3, WebSocket
**Integration**: RESTful APIs with real-time WebSocket streaming

## 📦 Integration Guide

### Add to Your Project
```bash
# 1. Copy server to your workspace
cp -R apps/server /path/to/your/workspace/

# 2. Configure environment
cp .env.sample .env

# 3. Start monitoring
bun run dev
```

### Basic Configuration
```json
{
  "port": 4000,
  "cors": {
    "origin": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  },
  "database": {
    "file": "events.db",
    "pragma": ["journal_mode=WAL", "synchronous=NORMAL"]
  }
}
```

## 📚 Documentation Hub

### 🚀 Getting Started
→ [Development Setup](../../docs/project/guides/development.md) - Local development environment (5 min)
→ [API Reference](../../docs/project/guides/api-reference.md) - Complete endpoint documentation (10 min)
→ [Configuration](../../docs/project/guides/configuration.md) - Environment setup (3 min)

### 🔧 Technical Reference
→ [Architecture Overview](../../docs/project/guides/architecture/) - System design details
→ [Database Schema](src/db.ts) - SQLite table definitions and indexes
→ [WebSocket Events](src/types.ts) - Real-time message types and payloads

### 🛠️ Development
→ [Testing Guide](../../docs/project/guides/testing.md) - Test suites and validation
→ [Performance Tuning](../../docs/project/guides/performance-optimization.md) - Scaling considerations
→ [Troubleshooting](../../docs/project/guides/troubleshooting.md) - Common server issues

## 🛠️ Common Commands

| Task | Command | Time | Notes |
|------|---------|------|-------|
| Development | `bun run dev` | 5s | Hot reload enabled |
| Production | `bun run start` | 3s | Direct execution |
| Type Check | `bun run typecheck` | 10s | TypeScript validation |
| Tests | `bun test` | 15s | Full test suite |
| Test Watch | `bun test --watch` | - | Continuous testing |
| Coverage | `bun test --coverage` | 20s | Test coverage report |

## 🔌 Quick Reference

### Most-Used API Endpoints
- **POST /events**: Submit hook events from Claude Code agents
- **GET /events/recent**: Retrieve timeline data for dashboard
- **WS /stream**: Real-time event streaming for single sessions
- **WS /api/sessions/multi-stream**: Multi-session WebSocket for advanced UIs
- **POST /subagents/register**: Register new agent for communication
- **POST /subagents/message**: Send inter-agent messages

### Event Types Supported
- **UserPromptSubmit**: User input to Claude Code
- **PreToolUse**: Before tool execution (validation hooks)
- **PostToolUse**: After tool completion (result capture)
- **Notification**: User interactions and system alerts
- **SubagentStart/Complete**: Agent lifecycle events
- **Error**: Exception and error tracking

### WebSocket Message Types
- **event**: New hook event broadcast
- **subagent_registered**: Agent registration notification
- **subagent_message**: Inter-agent communication
- **agent_status_update**: Completion and metadata updates
- **session_event**: Session-specific event streaming

[Complete API Reference →](../../docs/project/guides/api-reference.md)

## 🔧 Key Files

### Core Implementation
- **`src/index.ts`**: Main server with HTTP/WebSocket handling
- **`src/db.ts`**: SQLite database operations and schema
- **`src/types.ts`**: TypeScript interfaces for all data structures
- **`index.ts`**: Entry point (legacy, redirects to src/index.ts)

### Database & Storage
- **`events.db`**: SQLite database file (auto-created)
- **`events.db-wal`**: Write-ahead log for concurrent access
- **`events.db-shm`**: Shared memory file for WAL mode

### Configuration
- **`package.json`**: Dependencies and scripts
- **`tsconfig.json`**: TypeScript compiler configuration
- **`bun.lockb`**: Locked dependency versions

### Testing
- **`__tests__/`**: Comprehensive test suite
- **`src/test-db-helper.ts`**: Database testing utilities
- **`src/db.test.ts`**: Database operation tests

## 🚀 Performance Features

### Database Optimization
- **WAL Mode**: Concurrent read/write operations
- **Prepared Statements**: SQL injection protection and performance
- **Indexes**: Optimized queries for timeline and session data
- **Connection Pooling**: Efficient resource utilization

### WebSocket Efficiency
- **Connection Management**: Automatic cleanup of dead connections
- **Selective Broadcasting**: Session-based message routing
- **Message Batching**: Reduced network overhead
- **Health Monitoring**: Connection health checks

### Memory Management
- **Streaming Responses**: Large dataset handling
- **Event Pagination**: Configurable result limits
- **Cache Headers**: Client-side caching optimization
- **Garbage Collection**: Automatic cleanup of stale data

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/server-enhancement`
3. Follow TypeScript best practices and existing patterns
4. Add tests for new functionality
5. Submit pull request with detailed description

**Development Standards**:
- TypeScript strict mode enabled
- Comprehensive error handling
- Input validation for all endpoints
- WebSocket connection management
- Database transaction safety

## 📄 License

MIT License - See [LICENSE](../../LICENSE) file for details

---

**📚 For comprehensive documentation, visit our [guides directory](../../docs/project/guides/).**
