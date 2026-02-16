# 🧙‍♂️ Multi-Agent Orchestration for Claude Code

> *"Stay awhile and listen... Transform one Claude into an infinite swarm."*

**Run 10+ specialized agents in parallel. Build at the speed of thought.**

## The Ancient Knowledge

Transform one Claude into collaborative teams of specialized agents working in parallel:

**Model Diversity**: Claude and Codex agents collaborate seamlessly - each checking the other's work, bringing unique strengths to the team. Architects research while engineers build, consultants review while UAT validates, all communicating in real-time through the shared message bus.

**True Parallelism**: 10+ agents working simultaneously on independent tasks, broadcasting discoveries and coordinating through team messages. Support agents provide guidance while implementation agents build.

Watch your legion work through the real-time dashboard. Feel the power.

## Token Efficiency Mastery

Context-engineered for extended battles without bankruptcy:
- Minimal context per agent (they share memory through SQLite)
- File references, not contents (massive token savings)
- Agentic harness engineering reduced token burn by 45% (A/B tested methodology)
- **From the Maker**: I rarely hit my claude usage cap, even with 3-5 concurrent sessions running all day.


## 🚀 Quick Start
------------------------------------------------------------------
---- Clone this repo and prompt claude command: `/cc3-server` ----
------------------------------------------------------------------
Claude will sort you and and tell you what to do next.

### Level Up
1. **Model Diversity**: Install [Codex CLI](https://github.com/openai/codex) and [Gemini CLI](https://github.com/google-gemini/gemini-cli) for multi-model orchestration. The system can spawn Codex and Gemini consultants alongside Claude agents—different models checking each other's work, diverse perspectives on research tasks. See [Consultant Paradigm Guide](docs/project/guides/consultant-paradigm-guide.md).

2. Visual Feedback Loop - Add the feedback widget to your app for human-in-the-loop UI refinement:
- `/install-feedback-widget` - Installs annotated feedback widget in your project
- `/feedback` - Review and action UI feedback (requires widget installation first)

3. MCPs. Only one is worth the context fee - Web Research to make your claude code cap last 20% longer:
`claude mcp add perplexity-ask -- env PERPLEXITY_API_KEY=pplx-xxxx npx -y server-perplexity-ask` I've used $5 in a month and I'm a HEAVY user.
Note: Browser automation is built-in via browsertools wrapper - you get Chrome DevTools benefits without the context bloat (progressive disclosure principle)!

4. In this project prompt claude with `/learn`
My man Deckard Cain will teach you everything I know.


## 🏗️ Architecture Overview

The system has two layers that work together:

```
                        SERVERS (one instance, this repo)
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  CC2: Subagent Comms & Observability        CC3: Workflow Engine│
  │  ┌───────────────┐  ┌──────────────┐   ┌───────────┐  ┌──────┐│
  │  │ Bun Server    │  │ Vue Dashboard│   │ Convex DB │  │  UI  ││
  │  │ :4000 (SQLite)│  │ :5173        │   │ cloud/local│  │:3500 ││
  │  │ events, comms │  │ read-only    │   │ jobs,chat │  │manage││
  │  └───────┬───────┘  └──────┬───────┘   └─────┬─────┘  └──┬───┘│
  │          │  WebSocket      │                  │  Convex    │    │
  └──────────┼─────────────────┼──────────────────┼────────────┼────┘
             │                 │                  │            │
  ┌──────────┼─────────────────┼──────────────────┼────────────┼────┐
  │          ▼                 ▼                  ▼            ▼    │
  │  CLIENTS (one per project repo)                                 │
  │  ┌────────────────────────────────────┐  ┌─────────────────┐   │
  │  │ .claude/hooks (Python)             │  │ runner.ts        │   │
  │  │ - sends events to CC2 server :4000 │  │ - subscribes to  │   │
  │  │ - inter-agent messaging            │  │   Convex backend │   │
  │  │ - subagent registration            │  │ - spawns agents  │   │
  │  └────────────────────────────────────┘  │ - reports results│   │
  │                                          └─────────────────┘   │
  │  Each project repo has its own client instance                  │
  └─────────────────────────────────────────────────────────────────┘
```

**CC2 (Subagent Comms & Observability):** SQLite-backed Bun server + Vue dashboard. Captures all hook events (tool use, prompts, notifications), inter-agent messages, and subagent lifecycle. The dashboard at `:5173` is a read-only observability view. Subagents communicate via Python hook scripts.

**CC3 (Workflow Engine):** Convex-powered orchestration layer on top of CC2. Manages assignments (work objectives), job groups (parallel execution batches), and jobs (individual agent tasks). A chat-based UI lets users interact with a Product Owner agent, create work, and monitor execution. The runner daemon (client-side) subscribes to Convex for ready jobs and spawns Claude/Codex/Gemini sessions.

**Tech Stack**: Bun, Convex, React, Vue 3, TypeScript, SQLite, WebSocket, Python hooks

![Agent Data Flow Animation](images/AgentDataFlowV2.gif)

## 📦 Core Components

### CC3: Workflow Engine

#### Chat Interface & Modes
The primary user interface is a chat-based system with three modes:

| Mode | Description |
|------|-------------|
| **Jam** | Read-only ideation. PO helps refine requirements. Cannot create assignments. |
| **Cook** | Full autonomy. PO creates assignments, inserts jobs. No oversight. |
| **Guardian** | Cook + alignment monitoring. PO evaluates every PM report. Flags drift. |

#### Assignments & Job Chain
- **Assignments**: Work objectives with a "north star" description, priority, and independence flag
- **Job Groups**: Parallel execution containers. Multiple jobs in a group run simultaneously
- **Jobs**: Individual agent tasks (plan, implement, review, UAT, document) executed by Claude, Codex, or Gemini
- **PM Shadow Jobs**: After each job group completes, a PM agent reviews results and decides next steps (insert more jobs, complete, or block for human input)

```
Assignment
  └── Group 1 (parallel)        → PM Group (auto)
        ├── review (claude)           └── pm (claude)
        ├── review (codex)                  ↓ decides next
        └── review (gemini)     → Group 2 (parallel)      → PM Group → ...
                                      └── implement (claude)
```

#### Runner Daemon
A long-lived Node process per project that:
- Subscribes to Convex via WebSocket for instant reaction to DB changes
- Schedules ready jobs (independent assignments run in parallel, sequential ones queue)
- Spawns harness processes (`claude`, `codex`, or `gemini` CLI)
- Streams JSON output, tracks metrics (tool calls, tokens, subagents)
- Triggers PM review on group completion
- File-based event streaming for crash resilience and orphan recovery

#### Workflow CLI
PM-ergonomic CLI for managing assignments and jobs:
```bash
npx tsx cli.ts create "Build auth system"          # Create assignment
npx tsx cli.ts insert-job <id> --type implement    # Add job to chain
npx tsx cli.ts insert-job <id> --jobs '[{"jobType":"review"}]'  # Parallel group
npx tsx cli.ts update-assignment <id> --artifacts "..." --decisions "..."
npx tsx cli.ts queue                               # Show queue status
npx tsx cli.ts chat-send <threadId> "message"      # Send chat message
```

### CC2: Observability & Subagent Comms

#### Observability System
- **Hook Events**: Pre/Post tool use, notifications, user prompts
- **Real-time Capture**: SQLite storage with WebSocket broadcasting
- **Timeline View**: Visual event stream with filtering and search

#### Multi-Agent Communication
- **Agent Registry**: Automatic discovery and session tracking
- **Message Queue**: Inter-agent messaging with read receipts
- **Dashboard Views**: Live communication monitoring

### Integration
- **Copy `.claude` directory** to any project for CC2 observability
- **Copy `.agents` directory** for CC3 workflow engine client
- **Or run `npx claude-comms`** in the target project to install both
- **Start monitoring** - no code changes required

## 🛠️ Quick Commands

| Command | Description |
|---------|-------------|
| `/cc3-server` | Setup and start both CC2 + CC3 servers (guided) |
| `/cc3-client` | Setup and start the workflow runner in a project |
| `./scripts/start-system.sh` | Launch CC2 server and dashboard |
| `./scripts/reset-system.sh` | Clean shutdown and reset |
| `./scripts/test-system.sh` | System validation |

## 📚 Documentation Hub

### Getting Started
- [Setup Guide](docs/project/guides/setup-guide.md) - Installation and quick start
- [Integration Guide](docs/project/guides/integration-guide.md) - Adding to your projects

### Technical Reference
- [Architecture Guide](docs/project/guides/architecture-guide.md) - System design and components
- [Workflow Engine Spec](workflow-engine/SPEC.md) - CC3 job queue specification
- [Guardian Mode Spec](docs/project/spec/guardian-mode-spec.md) - PO alignment monitoring
- [API Reference](docs/project/guides/api-reference.md) - Complete endpoint documentation
- [Design System Guide](docs/project/guides/design-system-guide.md) - UI components and patterns

### Multi-Agent Development
- [Orchestration Guide](docs/project/guides/orchestration-guide.md) - Multi-agent coordination patterns
- [Consultant Paradigm Guide](docs/project/guides/consultant-paradigm-guide.md) - Codex & Gemini model diversity
- [Parallel Job Groups](docs/project/guides/parallel-job-groups-architecture.md) - Group-based parallel execution
- [Development Guide](docs/project/guides/development-guide.md) - Contributing and local setup
- [Troubleshooting Guide](docs/project/guides/troubleshooting-guide.md) - Common issues and solutions

### Archive
- [Legacy Documentation](docs/project/guides-archive/) - Archived guides and historical documentation

## 🔌 API Quick Reference

### CC2 Endpoints (Bun Server :4000)
```bash
# Observability
POST /events              # Submit hook events
GET  /events/recent       # Retrieve event timeline
WS   /stream              # Real-time event stream

# Multi-Agent Communication
POST /subagents/register  # Register new agent
POST /subagents/message   # Send inter-agent message
POST /subagents/unread    # Get unread messages
```

### CC3 Convex Functions (Workflow Engine)
```bash
# Assignments
assignments.create        # Create work objective
assignments.list          # List by namespace/status
assignments.update        # Update artifacts, decisions, status

# Job Groups & Jobs
jobs.createGroup          # Create parallel job group
jobs.insertGroupAfter     # Chain a new group after existing
scheduler.getReadyJobs    # Get jobs ready for execution

# Chat
chatThreads.create        # Create chat thread (jam/cook/guardian)
chatMessages.add          # Add message to thread
chatJobs.trigger          # Trigger PO agent response
```

### Hook Commands
```bash
# Send message between agents
uv run .claude/hooks/comms/send_message.py --sender "AgentName" --message "Hello"

# Check for unread messages
uv run .claude/hooks/comms/get_unread_messages.py --name "AgentName"
```

[Full API Reference →](docs/project/guides/api-reference.md)

## 🧪 Testing & Validation

```bash
# System validation
./scripts/test-system.sh

# CC2 manual event test
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app": "test", "session_id": "test-123", "hook_event_type": "PreToolUse"}'

# CC2 multi-agent communication test
python3 .claude/hooks/comms/send_message.py --sender "Agent-Alpha" --message "Test message"

# CC3 workflow CLI
cd .agents/tools/workflow && npx tsx cli.ts queue
```

## ⚙️ System Requirements

### Prerequisites
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI (required)
- **[Astral uv](https://docs.astral.sh/uv/)** - Python package manager for hooks
- **[Bun](https://bun.sh/)** - JavaScript runtime for CC2 server
- **[Convex](https://www.convex.dev/)** - Backend for CC3 workflow engine (cloud or local)
- **[Codex CLI](https://github.com/openai/codex)** - Optional, for multi-model job execution
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** - Optional, for multi-model job execution

### Server Ports
- **CC2 Server**: `localhost:4000` (Bun HTTP/WebSocket - events & agent comms)
- **CC2 Dashboard**: `localhost:5173` (Vue dev server - observability)
- **CC3 UI**: `localhost:3500` (Workflow Engine - chat, assignments, job monitoring)
- **CC3 Backend**: Convex (cloud-hosted or `npx convex dev` for local)

## 📊 Key Features

### 🎮 Chat-Driven Workflow
- **Jam Mode**: Brainstorm with the PO agent. Refine requirements before committing to work
- **Cook Mode**: PO autonomously creates assignments, schedules jobs, and manages execution
- **Guardian Mode**: PO monitors every PM decision for alignment with original intent. Flags drift before it compounds
- **Session Resume**: Chat threads maintain Claude session continuity across messages

### 🔥 Parallel Execution at Scale
- **Job Groups**: Multiple jobs in a group run simultaneously (e.g., 3-model review)
- **Independent Assignments**: Flagged assignments execute in parallel with each other
- **Auto-Expansion**: Review jobs automatically fan out to Claude + Codex + Gemini
- **PM Shadow Jobs**: Automatic PM review after each group, deciding next steps

### 💰 Token Efficiency Mastery
- **Focused Single-Purpose Runs**: Each job gets a fresh context with only what it needs
- **Template-Based Prompts**: Placeholders (north star, artifacts, decisions, previous results) minimize redundancy
- **File References Over Contents**: Massive token savings through intelligent reference passing
- **Strategic Research Offloading**: Perplexity MCP integration extends Claude budget by ~20%

### 🧠 Zero-Code Integration
- **Copy `.claude` + `.agents` Directories**: Instant observability + workflow for any project
- **Hook-Based Architecture**: No code modifications required
- **Automatic Agent Discovery**: Self-registering agents with session tracking
- **Per-Project Namespaces**: Each repo gets its own namespace in the shared backend

### 🔍 Complete Observability
| Event Type | Capture Point | Power Unlock |
|------------|---------------|--------------|
| **PreToolUse** | Before execution | Block dangerous operations, validate inputs |
| **PostToolUse** | After completion | Track results, measure performance |
| **UserPromptSubmit** | Prompt entry | Session analysis, requirement capture |
| **Notification** | User interactions | UX monitoring, workflow insights |
| **SubagentStop** | Agent completion | Orchestration state, handoff timing |

### 🎯 Advanced Communication Bus
- **Inter-Agent Messaging**: Agents broadcast discoveries, ask questions, coordinate work
- **Message Queue with Receipts**: Guaranteed delivery with read tracking
- **Shared Knowledge Base**: SQLite-backed memory accessible to entire swarm
- **Real-Time Routing**: WebSocket-based instant message delivery

### 📺 Dual Dashboard System
- **CC3 Workflow UI**: Chat interface, assignment management, job chain visualization with Quake-inspired AgentHUD cards, real-time job metrics (tool calls, tokens, duration)
- **CC2 Observability Dashboard**: Live event timeline, session visualization, agent communications, advanced filtering and search

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic Claude Code Team** - For the fantastic hooks system
- **[Convex](https://www.convex.dev/)** - Real-time backend powering the workflow engine
- **Contributors** - Community feedback and improvements
- **Open Source Dependencies** - Vue, Bun, React, and ecosystem tools

---

**For comprehensive documentation and advanced features, explore our [complete guides](docs/project/guides/).**
