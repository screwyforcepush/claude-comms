# Multi-Agent Orchestration for Claude Code

> *"Stay awhile and listen... Transform one Claude into an infinite swarm."*

**Run 10+ specialized agents in parallel. Build at the speed of thought.**

## The Ancient Knowledge

Transform one Claude into collaborative teams of specialized agents working in parallel:

**Model Diversity**: Claude and Codex agents collaborate seamlessly - each checking the other's work, bringing unique strengths to the team. Architects research while engineers build, consultants review while UAT validates, all communicating in real-time through the shared message bus.

**True Parallelism**: 10+ agents working simultaneously on independent tasks, broadcasting discoveries and coordinating through team messages. Support agents provide guidance while implementation agents build.

Watch your legion work through the Workflow Engine UI. Feel the power.

## Token Efficiency Mastery

Context-engineered for extended battles without bankruptcy:
- Minimal context per agent (they share state through Convex)
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

```
                        SERVER (one instance, this repo)
  ┌─────────────────────────────────────────────────────────────────┐
  │                          Workflow Engine                         │
  │  ┌───────────┐  ┌──────┐                                       │
  │  │ Convex DB │  │  UI  │                                       │
  │  │ cloud/local│  │:3500 │                                       │
  │  │ jobs,chat │  │manage│                                       │
  │  └─────┬─────┘  └──┬───┘                                       │
  │        │  Convex    │                                           │
  └────────┼────────────┼───────────────────────────────────────────┘
           │            │
  ┌────────┼────────────┼───────────────────────────────────────────┐
  │        ▼            ▼                                           │
  │  CLIENTS (one per project repo, installed via npx claude-comms) │
  │  ┌─────────────────┐                                           │
  │  │ runner.ts        │                                           │
  │  │ - subscribes to  │                                           │
  │  │   Convex backend │                                           │
  │  │ - spawns agents  │                                           │
  │  │ - reports results│                                           │
  │  └─────────────────┘                                           │
  │  Each project repo has its own client instance                  │
  └─────────────────────────────────────────────────────────────────┘
```

**Workflow Engine:** Convex-powered orchestration that manages assignments (work objectives), job groups (parallel execution batches), and jobs (individual agent tasks). A chat-based UI lets users interact with a Product Owner agent, create work, and monitor execution. The runner daemon (client-side) subscribes to Convex for ready jobs and spawns Claude/Codex/Gemini sessions.

**Tech Stack**: Convex, React, TypeScript, Node.js

See [System Diagram](docs/project/guides/system-diagram.md) for the full architecture reference.

![Agent Data Flow Animation](images/AgentDataFlowV2.gif)

## 📦 Core Components

### Workflow Engine

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

### Integration
- **Copy `.agents` directory** to any project for workflow engine client
- **Or run `npx claude-comms`** in the target project to install the client tooling
- **Start the runner** - `/cc3-client` guides you through configuration

## 🛠️ Quick Commands

| Command | Description |
|---------|-------------|
| `/cc3-server` | Setup and start the workflow engine server (guided) |
| `/cc3-client` | Setup and start the workflow runner in a project |
| `/cc3-client-update` | Update client with latest upstream changes |

## 📚 Documentation Hub

### Getting Started

### Technical Reference
- [Workflow Engine Spec](docs/project/spec/workflow-engine-spec.md) - Job queue specification
- [Guardian Mode Spec](docs/project/spec/guardian-mode-spec.md) - PO alignment monitoring
- [System Diagram](docs/project/guides/system-diagram.md) - Architecture overview

### Multi-Agent Development
- [Orchestration Guide](docs/project/guides/orchestration-guide.md) - Multi-agent coordination patterns
- [Consultant Paradigm Guide](docs/project/guides/consultant-paradigm-guide.md) - Codex & Gemini model diversity
- [Parallel Job Groups](docs/project/guides/parallel-job-groups-architecture.md) - Group-based parallel execution

## 🔌 API Quick Reference

### Convex Functions (Workflow Engine)
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

### Peer-Comms CLI
```bash
# Send message between agents
node .agents/tools/workflow/agent-comms.mjs post --message "discovery" --namespace my-project

# Sync messages
node .agents/tools/workflow/agent-comms.mjs sync --namespace my-project
```

## 🧪 Testing & Validation

```bash
# Workflow CLI
cd .agents/tools/workflow && npx tsx cli.ts queue
```

## ⚙️ System Requirements

### Prerequisites
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI (required)
- **[Convex](https://www.convex.dev/)** - Backend for workflow engine (cloud or local)
- **[Codex CLI](https://github.com/openai/codex)** - Optional, for multi-model job execution
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** - Optional, for multi-model job execution

### Server Ports
- **Workflow Engine UI**: `localhost:3500` (Chat, assignments, job monitoring)
- **Workflow Engine Backend**: Convex (cloud-hosted or `npx convex dev` for local)

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

### 🔧 Easy Integration
- **Copy `.agents` Directory**: Instant workflow engine client for any project
- **Per-Project Namespaces**: Each repo gets its own namespace in the shared backend
- **`npx claude-comms`**: One-command client installation

### 🔍 Job-Level Observability
The workflow engine tracks job lifecycle, tool call counts, token usage, duration, and agent reflections. Job results, PM decisions, and alignment status are surfaced through the Workflow Engine UI. See [Reflection Feedback Spec](docs/project/spec/reflection-feedback-spec.md) for the agent reflection telemetry system.

### 🎯 Peer-to-Peer Agent Comms
- **Convex-Backed Messaging**: Agents communicate through `.agents/tools/workflow/agent-comms.mjs`
- **Cursor-Tracked Reads**: Each agent tracks its own read position -- no message loss
- **Namespace-Aware**: Messages scoped per project namespace

### 📺 Workflow Engine UI
- **Chat Interface**: Jam, Cook, and Guardian modes for PO interaction
- **Assignment Management**: Create, prioritize, and monitor work objectives
- **Job Chain Visualization**: Quake-inspired AgentHUD cards with real-time metrics (tool calls, tokens, duration)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic Claude Code Team** - For the fantastic hooks system
- **[Convex](https://www.convex.dev/)** - Real-time backend powering the workflow engine
- **Contributors** - Community feedback and improvements
- **Open Source Dependencies** - React, Convex, and ecosystem tools

---

**For comprehensive documentation and advanced features, explore our [complete guides](docs/project/guides/).**
