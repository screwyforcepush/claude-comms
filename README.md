# 🧙‍♂️ Multi-Agent Orchestration for Claude Code

> *"Stay awhile and listen... Transform one Claude into an infinite swarm."*

**Run 10+ specialized agents in parallel. Build at the speed of thought.**

## The Ancient Knowledge

You've been using Claude Code like a single warrior. This system awakens the **swarm**:

- **Engineers** building different modules simultaneously
- **Architects** designing while others implement
- **Researchers** gathering wisdom as code flows
- **Gatekeepers** ensuring perfection in parallel
- **Recursive Orchestration**: Infinite orchestrators managing infinite squads

Watch your legion work through the real-time dashboard. Feel the power.

## Token Efficiency Mastery

Context-engineered for extended battles without bankruptcy:
- Minimal context per agent (they share memory through SQLite)
- File references, not contents (massive token savings)
- **From the Maker**: I rarely hit my claude usage cap, even with 3-5 concurrent sessions running all day.


## 🚀 Quick Start

```bash
# 1. Clone this repo and start the system
./scripts/start-system.sh
# If this fails you probably need to bun install or whatever. Just ask claude code to sort it out.


# 2. Use it in your project
npx claude-comms # in your project root.
# or copy CLAUDE.md and .claude directory to your projects

# 3. Launch claude code in your project. --dangerously-skip-permissions if you like.

# 4. prompt claude to get cookin: /cook <what you want to build, requirements spec, etc>
"/cook make a dashboard that for the real time event stream but style it like the matrix and populate the matrix characters with the event stream data"
```

### Level Up
1. Observe `http://localhost:5173/`
./scripts/restart-system.sh restarts everything and can clear the db

2. Install perplexity mcp. it will make your claude code cap last 20% longer. I've used $5 in a month and I'm a HEAVY user.
`claude mcp add perplexity-ask -- env PERPLEXITY_API_KEY=pplx-xxxx npx -y server-perplexity-ask`
You can still be a wizzard without this, but its the difference between being Dumbledore and being Gandalf.

3. In this project prompt claude with `/learn`
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
- **API Keys** - Anthropic (required), OpenAI/ElevenLabs (optional)

### Environment Setup
```bash
# Copy environment template
cp .env.sample .env

# Configure API keys in .env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=optional_key
ELEVEN_API_KEY=optional_key
```

### Server Ports
- **Server**: `localhost:4000` (HTTP/WebSocket)
- **Dashboard**: `localhost:5173` (Vite dev server)

## 📊 Key Features

### Event Types Captured
| Event | Description | Use Case |
|-------|-------------|----------|
| PreToolUse | Before tool execution | Validation & blocking |
| PostToolUse | After tool completion | Result tracking |
| UserPromptSubmit | User prompt submission | Session analysis |
| Notification | User interactions | UX monitoring |
| SubagentStop | Agent completion | Orchestration tracking |

### Dashboard Capabilities
- **Real-time Timeline**: Live event stream with auto-scroll
- **Advanced Filtering**: By app, session, event type, time range
- **Chat Transcripts**: Full conversation history with AI summaries
- **Agent Communications**: Live inter-agent message display
- **Visual Analytics**: Pulse charts and session visualization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the [Contributing Guide](CONTRIBUTING.md)
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic Claude Code Team** - For the fantastic hooks system
- **Contributors** - Community feedback and improvements
- **Open Source Dependencies** - Vue, Bun, and ecosystem tools

---

**For comprehensive documentation and advanced features, explore our [complete guides](docs/project/guides/).**
