# Claude Code Multi-Agent Observability System

[IMPORTANT]
SUBAGENT PROTOCOL & ORCHESTRATION GUIDELINES

## Core Naming Protocol
When you Task() agents with your Task tool, it is critical that you ALWAYS include a wildly unique/random AgentName in the `description` and `prompt` params. 
Address the agent by their AgentName throughout the prompt as you instruct them.

Format:
    - description: "<AgentName>: " + short description of task
    - prompt: "Your name is <AgentName>. full task instruction and context"
    - subagent_type: Select from available agents based on task requirements

Example Task tool usage:
    - description: "JostCuttingham: clean up docs"
    - prompt: "Your AgentName is JostCuttingham. Your task is to update readme files and documentation in ./docs because ... JostCuttingham, make sure you understand the current state of .src/server/ and relationship with ..."
    - subagent_type: "general-purpose"

## Batch Parallelization Principles

### Intra-Batch Execution (True Parallelism)
- Launch multiple agents SIMULTANEOUSLY using multiple Task() invocations in a single message
- Agents within a batch have NO blocking dependencies - they work in parallel
- Agents CAN communicate and support each other through the messaging system
- All agents in a batch complete independently without waiting for others

### Inter-Batch Sequencing (Dependencies)
- Wait for ALL agents in current batch to complete before launching next batch
- Use verification batches after implementation batches
- Cascade changes through re-verification when upstream modifications occur

### Batch Composition Patterns

**Pattern 1: Parallel Implementation → Verification**
```
Batch 1: [Engineer-1, Engineer-2, Engineer-3, Tester] (all work simultaneously)
Wait for completion
Batch 2: [Code-Reviewer, Green-Verifier] (verify all Batch 1 work)
```

**Pattern 2: Design + Research → Implementation**
```
Batch 1: [Architect, Deep-Researcher, Designer] (parallel discovery)
Wait for completion
Batch 2: [Engineer-1, Engineer-2, Engineer-3] (implement based on Batch 1 outputs)
```

**Pattern 3: Planning → Decomposed Execution**
```
Batch 1: [Planner, Business-Analyst] (define work packages)
Wait for completion
Batch 2: [Multiple Engineers based on WP count] (one per independent WP)
```

## Team Composition Examples

### Small Feature (3-5 agents)
```
Batch 1: Planning
- BobSmith: Architect - Define interfaces
- SarahJones: Planner - Create work packages

Batch 2: Implementation  
- MikeChang: Engineer - Implement backend
- LisaWong: Engineer - Implement frontend
- TomBrown: Tester - Write tests

Batch 3: Verification
- AmyLee: Code-Reviewer - Review all changes
- JohnDoe: Green-Verifier - Validate build/tests
```

### Large Feature (8-12 agents)
```
Batch 1: Discovery & Design (4 agents parallel)
- RobertKim: Architect - System design
- NancyPark: Deep-Researcher - Best practices research  
- DavidLiu: Designer - UI components
- EmilyChen: Business-Analyst - Requirements validation

Batch 2: Massive Parallel Implementation (8 agents)
- JamesTaylor: Engineer - API endpoints
- MariaSilva: Engineer - Database layer
- KevinWang: Engineer - Business logic
- RachelGreen: Engineer - Frontend components
- SteveMartin: Engineer - Integration layer
- JenniferLee: Tester - Unit tests
- MichaelScott: Tester - E2E tests
- PaulAllen: Engineer - Documentation

Batch 3: Comprehensive Verification (4 agents)
- ChrisEvans: Code-Reviewer - Backend review
- DianaPrice: Code-Reviewer - Frontend review
- GeorgeKing: Green-Verifier - All checks
- HelenCarter: Business-Analyst - Acceptance validation
```

### Bug Fix Workflow
```
Batch 1: Investigation
- AlexJohnson: Engineer - Reproduce and diagnose

Batch 2: Fix & Test (parallel)
- BrianMiller: Engineer - Implement fix
- CarolWhite: Tester - Write regression test

Batch 3: Verification
- DanielBrown: Code-Reviewer - Validate approach
- EvaGarcia: Green-Verifier - Confirm all green
```

## Verification Gates & Quality Checkpoints

### Standard Verification Sequence
1. Implementation batch completes
2. Launch verification batch with Code-Reviewer + Green-Verifier + Tester
3. ALL must pass for gate approval
4. If ANY fail → Create fix batch with engineers

### Gate Hierarchy
- **WP Gates**: Code complete, tests pass, review approved
- **Phase Gates**: All WPs verified, E2E tests pass, BA sign-off
- **Release Gates**: Deployed to staging, smoke tests pass, monitoring confirmed

## Context Management for Agents

### Minimal Context Principle
Each agent receives ONLY what they need:
- WP specification or specific task description
- Relevant file paths or search patterns
- Dependencies or interfaces they must respect
- Acceptance criteria for their specific task

### Context Examples
```
Engineer Context:
"Your name is SamWilson. Implement the user authentication feature based on WP-123 specification. 
Read docs/project/phases/phase-1/wp-123.md for requirements. 
The API contract is defined in docs/api/auth.yaml. 
Ensure all tests pass. SamWilson, broadcast your progress to the team."

Tester Context:
"Your name is JuliaDavis. Create comprehensive tests for the authentication feature.
Read the implementation in src/auth/ directory.
Acceptance criteria in docs/project/phases/phase-1/wp-123.md.
JuliaDavis, ensure 80% code coverage minimum."

Code-Reviewer Context:
"Your name is MarkJohnson. Review all changes in the current git diff.
Focus on security vulnerabilities in authentication code.
Check compliance with coding standards in docs/project/guides/standards.md.
MarkJohnson, provide severity-graded feedback."
```

## Orchestration Decision Tree

When to parallelize:
- ✅ Independent work packages
- ✅ Multiple similar tasks (e.g., multiple API endpoints)
- ✅ Design + Research simultaneously
- ✅ Test writing alongside implementation
- ✅ Multiple reviewers for large changes

When to sequence:
- ⚠️ Clear dependency chain exists
- ⚠️ Verification must follow implementation
- ⚠️ Planning must precede execution
- ⚠️ Deployment after all checks pass

## Performance Optimization Tips

1. **Maximize Batch Size**: Include as many parallel agents as have independent work
2. **Preemptive Support Agents**: Include Architect/Researcher in implementation batches for real-time guidance
3. **Early Testing**: Include Testers in implementation batches for immediate test creation
4. **Parallel Reviews**: Multiple reviewers can examine different aspects simultaneously
5. **Broadcast Coordination**: Agents should announce decisions/discoveries immediately

## Monitoring & Coordination

### During Batch Execution
- Agents broadcast status updates and discoveries
- Monitor for blocker alerts from any agent
- Agents can provide mutual support without blocking
- Track completion status of each agent

### Between Batches
- Verify all agents in current batch have completed
- Assess if any failures require re-work
- Determine next batch composition based on results
- Cascade any changes through verification

## Example Full Workflow Orchestration

```
Task: Implement shopping cart feature

ORCHESTRATION PLAN:

Batch 1 - Discovery (2 agents, parallel):
  Launch simultaneously:
  - KarenSmith: Architect - Design cart architecture
  - BobJones: Deep-Researcher - Research cart best practices

Batch 2 - Planning (2 agents, parallel):
  Launch simultaneously:
  - MikeB: Planner - Break into work packages
  - SarahL: Business-Analyst - Validate requirements

Batch 3 - Implementation (5 agents, parallel):
  Launch simultaneously:
  - JohnDoe: Engineer - Cart API endpoints
  - JaneSmith: Engineer - Cart state management
  - TomW: Engineer - Cart UI components
  - LisaK: Tester - Cart API tests
  - DaveM: Tester - Cart UI tests

Batch 4 - Verification (3 agents, parallel):
  Launch simultaneously:
  - AmyC: Code-Reviewer - Review all cart code
  - SteveP: Green-Verifier - Run all checks
  - NancyR: Business-Analyst - Validate acceptance

Batch 5 - Deployment (1 agent):
  - ChrisG: Cloud-CICD - Deploy to staging
```

Remember: The key to effective orchestration is understanding which work can truly happen in parallel and launching those agents together, while respecting sequential dependencies between batches.

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