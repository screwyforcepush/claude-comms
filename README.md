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
Clone this repo and prompt claude command: `/cc3-server`
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

```
Claude Agents → Hook Scripts → HTTP POST → Bun Server → SQLite → WebSocket → Vue Dashboard
                     ↓                          ↓
              Communication Hooks        Message Routing
                     ↓                          ↓
               Inter-Agent Messages      Subagent Registry
```

**Tech Stack**: Vue 3, Bun, TypeScript, SQLite, WebSocket, Python hooks

![Agent Data Flow Animation](images/AgentDataFlowV2.gif)

## 📦 Core Components

### Observability System
- **Hook Events**: Pre/Post tool use, notifications, user prompts
- **Real-time Capture**: SQLite storage with WebSocket broadcasting  
- **Timeline View**: Visual event stream with filtering and search

### Multi-Agent Communication
- **Agent Registry**: Automatic discovery and session tracking
- **Message Queue**: Inter-agent messaging with read receipts
- **Dashboard Views**: Live communication monitoring

### Integration
- **Copy `.claude` directory** to any project for instant observability
- **Configure `settings.json`** with your project name
- **Start monitoring** - no code changes required

## 🛠️ Quick Commands

| Command | Description |
|---------|-------------|
| `./scripts/start-system.sh` | Launch server and dashboard |
| `./scripts/reset-system.sh` | Clean shutdown and reset |
| `./scripts/test-system.sh` | System validation |

## 📚 Documentation Hub

### Getting Started
- [Setup Guide](docs/project/guides/setup-guide.md) - Installation and quick start (< 5 minutes)
- [Integration Guide](docs/project/guides/integration-guide.md) - Adding to your projects

### Technical Reference
- [Architecture Guide](docs/project/guides/architecture-guide.md) - System design and components
- [API Reference](docs/project/guides/api-reference.md) - Complete endpoint documentation
- [Design System Guide](docs/project/guides/design-system-guide.md) - UI components and patterns

### Multi-Agent Development
- [Orchestration Guide](docs/project/guides/orchestration-guide.md) - Multi-agent coordination patterns
- [Consultant Paradigm Guide](docs/project/guides/consultant-paradigm-guide.md) - Codex & Gemini model diversity
- [Development Guide](docs/project/guides/development-guide.md) - Contributing and local setup
- [Troubleshooting Guide](docs/project/guides/troubleshooting-guide.md) - Common issues and solutions

### Archive
- [Legacy Documentation](docs/project/guides-archive/) - Archived guides and historical technical documentation

## 🔌 API Quick Reference

### Core Endpoints
```bash
# Observability
POST /events              # Submit hook events
GET /events/recent        # Retrieve event timeline
WS /stream               # Real-time event stream

# Multi-Agent Communication  
POST /subagents/register  # Register new agent
POST /subagents/message   # Send inter-agent message
POST /subagents/unread    # Get unread messages
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

# Manual event test
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app": "test", "session_id": "test-123", "hook_event_type": "PreToolUse"}'

# Multi-agent communication test
python3 .claude/hooks/comms/send_message.py --sender "Agent-Alpha" --message "Test message"
```

## ⚙️ System Requirements

### Prerequisites
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[Astral uv](https://docs.astral.sh/uv/)** - Python package manager for hooks
- **[Bun](https://bun.sh/)** or npm/yarn - JavaScript runtime


### Server Ports
- **Server**: `localhost:4000` (HTTP/WebSocket)
- **Dashboard**: `localhost:5173` (Vite dev server)

## 📊 Key Features

### 🔥 Parallel Execution at Scale
- **10+ Agents Simultaneously**: Launch engineers, architects, researchers, and gatekeepers in a single command
- **True Concurrency**: Independent agents working different modules without blocking
- **Recursive Orchestration**: Orchestrators managing orchestrators managing squads - infinite depth
- **Smart Batch Composition**: Automatic detection of parallelizable vs sequential work

### 💰 Token Efficiency Mastery
- **Minimal Context per Agent**: SQLite-backed shared memory eliminates redundant context
- **File References Over Contents**: Massive token savings through intelligent reference passing
- **Real-World Economics**: Creator runs 3-5 concurrent sessions all day without hitting usage caps
- **Strategic Research Offloading**: Perplexity MCP integration extends Claude budget by ~20%

### 🧠 Zero-Code Integration
- **Copy `.claude` Directory**: Instant observability for any project
- **Hook-Based Architecture**: No code modifications required
- **Automatic Agent Discovery**: Self-registering agents with session tracking
- **Universal Compatibility**: Works with any Claude Code project

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
- **Team Collaboration**: Support roles (Architect, Researcher) provide real-time guidance during parallel execution

### 📺 Dashboard Command Center
- **Live Event Stream**: Real-time timeline with auto-scroll and filtering
- **Session Visualization**: Pulse charts showing agent activity patterns
- **Chat Transcripts**: Complete conversation history with AI-powered summaries
- **Agent Communications**: Monitor inter-agent message flow
- **Advanced Filtering**: By app, session, event type, time range, agent name
- **Search & Analytics**: Full-text search across all events and messages

### 🎮 Recursive Clone Capability
- **Orchestrator Spawns Orchestrator**: Meta-orchestration for complex multi-phase projects
- **Infinite Delegation**: Each orchestrator manages their squad autonomously
- **Hierarchical Coordination**: Top-level strategy cascades through orchestration layers
- **Emergent Intelligence**: Swarm behavior emerges from simple coordination protocols


## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic Claude Code Team** - For the fantastic hooks system
- **Contributors** - Community feedback and improvements
- **Open Source Dependencies** - Vue, Bun, and ecosystem tools

---

**For comprehensive documentation and advanced features, explore our [complete guides](docs/project/guides/).**
