# Multi-Agent Orchestration Guide

## Overview

This guide provides comprehensive patterns and practices for orchestrating multi-agent software delivery using the Claude Code Multi-Agent System. The system maximizes throughput through intelligent batch composition, parallel execution, and collaborative agent communication.

## Core Orchestration Principles

### 1. Parallel-First Architecture
- **Maximize Concurrent Execution**: Launch multiple agents simultaneously when they have no blocking dependencies
- **Collaborative Parallelism**: Agents in the same batch work in parallel while supporting each other through messaging
- **Independent Completion**: No agent waits for another within a batch - all complete their work simultaneously

### 2. Batch Composition Strategy
- **Intra-Batch**: TRUE parallelism with collaborative support via messaging
- **Inter-Batch**: Sequential dependencies where one batch must complete before the next begins
- **Verification Pattern**: Implementation batches always followed by verification batches

### 3. Context Discipline
- Provide agents with minimal but complete context
- Route only essential information to each agent
- Include phase-id when working at phase level
- Reference specific files and dependencies

## Agent Naming and Tasking Protocols

### Core Naming Convention

**CRITICAL**: Every agent MUST have a unique name format:

```
Format: FirstNameLastName (Unique human FirstName + Abstract obscure LastName)

Examples:
- JoseAsic: implement user authentication
- MariaZenith: validate payment flow
- DavidPulsar: review code quality
- SarahQuantum: test integration endpoints
```

**Rules**:
- NEVER reuse names in future batches
- Each agent exists for a single batch only
- Names must be unique across all current and past batches

### Agent Prompt Template

```
"Your name is [FirstNameLastName]. 
Your Team Role is [Primary implementer | Support advisor | Parallel worker]

SCOPE: [Project-level | Phase-level (phase-id: XX-Name)]

YOUR TASK:
[Specific task description]

CONSTRAINTS:
[Any dependencies, interfaces, or requirements]

SUCCESS CRITERIA:
[What constitutes completion]

FILES TO READ FIRST:
- [filepath1] - [one sentence description]
- [filepath2] - [one sentence description]

TEAM COLLABORATION:
- Leverage your Team for [what specific support]
- Support your Team with [what you provide]
- Coordinate with your Team on [shared concerns]

[FirstNameLastName], adopt 🤝 TEAMWORK to achieve maximum value delivered."
```

## Batch Parallelization Strategies

### Orchestration Decision Tree

#### ✅ When to Parallelize (Same Batch):
- Independent work packages with no functional dependencies
- Multiple similar tasks (e.g., multiple API endpoints)
- Design + Research happening simultaneously
- Test writing alongside implementation (different files)
- Multiple reviewers examining different aspects
- Support roles providing real-time guidance
- Multiple same-type agents with different focus areas
- **NO blocking dependencies between agents**
- **NO file editing conflicts** (only ONE agent edits each file)

#### ⚠️ When to Sequence (Different Batches):
- **Functional Dependencies**: Task B needs Task A's output
- **File Dependencies**: Tasks modifying same file CANNOT be in same batch
- **Verification Dependencies**: Gatekeepers ALWAYS follow implementation
- **Knowledge Dependencies**: Planner needs architecture/research to plan against

### Batch Size Optimization

#### Maximize Parallelization
- Break work into smallest parallelizable units
- Include 5-10 agents when possible (10 is maximum per batch)
- Add support roles for real-time guidance
- Prefer larger batches over smaller sequential ones

#### Example Large Batch (10 Agents):
```
Implementation Batch:
7 Engineers (each owns specific files/modules) +
2 Support (Architect, Deep-Researcher) +
1 Designer (UI assets and real-time guidance) =
10 agents working in parallel
```

## Standard Workflow Patterns

### New Feature Workflow
1. **Discovery Batch**: [Deep-Researcher, Architect, Business-Analyst, Designer]
2. **Planning Batch**: [Planner] - creates phase-id and WPs
3. **Consult**: Agent-orchestrator reviews plan
4. **Implementation Batch**: [5-10 Engineers with distinct focus + support agents]
5. **Verification Batch**: [1-3 Gatekeepers with different focus + agent-orchestrator]

### Bug Fix Workflow
1. **Investigation Batch**: [Engineer, Architect] - diagnose collaboratively
2. **Planning Batch**: [Planner] - uses existing phase or creates new
3. **Fix Batch**: [Engineer-Fix, Engineer-Tests] - parallel, different files
4. **Verification Batch**: [Gatekeeper] - validates fix

### Architecture Change Workflow
1. **Research Batch**: [Deep-Researcher, Architect]
2. **Planning Batch**: [Planner, Business-Analyst]
3. **Migration Batch**: [Multiple Engineers + supporting Architect] - each owns different module
4. **Verification Batch**: [Multiple Gatekeepers] - compliance check

### Complex E-Commerce Feature (10 Agent Example)
**Implementation Batch** (All 10 agents simultaneously):

**Core Implementers**:
- **AlexFrontend**: Product catalog UI + broadcasts component decisions
- **SarahCart**: Shopping cart interface + coordinates state management
- **DavidBackend**: Product API endpoints + announces contracts
- **MariaOrders**: Order processing service + shares transaction patterns
- **JosePayment**: Payment gateway + consumes order events

**Quality & Testing**:
- **LinaTests**: API integration tests + monitors contract broadcasts
- **TomE2E**: User journey tests + observes UI changes

**Support Roles**:
- **EvaDesigner**: Component library refinement + real-time UI guidance
- **RyanResearcher**: Payment compliance + regulatory constraints
- **ZenithArchitect**: Design decisions + pattern guidance

**Verification Batch** (After implementation complete):
- **GatekeeperCode**: Code quality review
- **GatekeeperUI**: Visual inspection and UX compliance
- **GatekeeperSecurity**: Security and compliance validation

## Communication Protocols

### Message Types and Triggers

#### 1. Status Broadcasts
**When**: Task completion, milestone reached
**Format**: "WP-123 implementation complete, ready for review"

#### 2. Decision Broadcasts
**When**: Architectural or design decisions made
**Format**: "Using PostgreSQL for persistence layer per ADR-45"

#### 3. Discovery Broadcasts
**When**: Finding existing code, patterns, or constraints
**Format**: "Found existing auth module at src/auth/, reusing interfaces"

#### 4. Question Broadcasts
**When**: Need input or clarification from team
**Format**: "API endpoint naming: /orders vs /order-processing? Need architect input"

#### 5. Blocker Alerts
**When**: Cannot proceed without dependency
**Format**: "Blocked: Missing API specification for payment integration"

### Communication Rules

- **Frequency**: Check inbox at each major step
- **Brevity**: Maximum 2 sentences per message
- **File References**: Always include specific file paths or identifiers
- **Real-time Support**: Provide answers without blocking own work
- **Adaptation**: Consume broadcasts and adapt approach without waiting

### Within-Batch Collaboration Dynamics

**Collaborative Parallelism Example**:
1. Engineer-Backend broadcasts API contract
2. Engineer-Frontend immediately adapts implementation
3. Engineer-Tests starts writing tests against broadcast contract
4. Designer answers UI questions in real-time
5. Architect provides pattern guidance when conflicts arise
6. All agents complete simultaneously without blocking

## Team Composition Patterns

### Implementation Team Patterns

#### Single Feature Implementation
```
Batch: [Engineer-Core, Engineer-Tests, Designer] (3 agents)
- Engineer-Core: Main feature implementation
- Engineer-Tests: Test suite (different files)
- Designer: UI components and guidance
```

#### Multi-Module Feature
```
Batch: [Engineer-Frontend, Engineer-Backend, Engineer-Integration, 
        Engineer-Tests, Architect] (5 agents)
- Each engineer owns different module/files
- Architect provides real-time design decisions
- Tests engineer coordinates across all modules
```

#### Large-Scale Implementation
```
Batch: [7 Engineers + 2 Support + 1 Designer] (10 agents max)
- Engineers: Each owns specific files/components
- Support: Architect + Deep-Researcher for guidance
- Designer: Real-time UI/UX support
```

### Verification Team Patterns

#### Standard Verification
```
Batch: [Gatekeeper-Code, Gatekeeper-Build] (2 agents)
- Gatekeeper-Code: Quality, security, patterns
- Gatekeeper-Build: Tests, lint, build validation
```

#### Comprehensive Review
```
Batch: [Gatekeeper-Code, Gatekeeper-UI, Gatekeeper-Security, 
        Agent-Orchestrator] (4 agents)
- Different gatekeepers for different aspects
- Agent-orchestrator provides strategic validation
```

### Support Role Integration

#### Research and Architecture Support
```
Implementation Batch: [Engineers + Architect + Deep-Researcher]
- Architect: Real-time design decisions
- Deep-Researcher: Technical guidance and best practices
- Engineers: Implementation with immediate expert support
```

#### Design Integration
```
Implementation Batch: [Frontend-Engineers + Designer]
- Designer: Component specs and real-time UI guidance
- Frontend Engineers: Implementation with design feedback loop
```

## Advanced Orchestration Patterns

### Dependency Mapping and Resolution

#### File Dependency Analysis
Before batching, identify:
- Which files each agent will modify
- Shared dependencies between components
- Integration points requiring coordination

**Rule**: Only ONE agent per file per batch

#### Functional Dependency Chains
Map dependencies:
```
Research → Architecture → Planning → Implementation → Verification
    ↓         ↓           ↓            ↓             ↓
  Batch-1   Batch-1    Batch-2      Batch-3     Batch-4
```

#### Knowledge Dependencies
Ensure agents have required context:
- Planner needs architecture before creating WPs
- Implementers need contracts before coding
- Reviewers need implementation before validation

### Performance Optimization Strategies

#### Preemptive Support Inclusion
Include support roles in implementation batches:
- Architect answers questions immediately
- Designer provides real-time feedback
- Deep-Researcher offers guidance when needed

#### Parallel Verification
Multiple reviewers examine different aspects:
- Code quality reviewer
- Security compliance reviewer
- UI/UX compliance reviewer
- Build/test validation reviewer

#### Early Testing Integration
Include test-focused engineers in implementation batches:
- Write tests as interfaces emerge
- Validate assumptions in real-time
- Catch integration issues early

### Agent-Orchestrator Consultation Pattern

#### When to Consult
- After user provides assignment
- After every batch completion
- When discovering dependency conflicts
- Before planning phase transitions
- When batch composition is unclear

#### What to Provide
- Original user assignment
- Current todos with batch history
- Agent responses from last batch
- Created/modified artifacts list
- Specific orchestration challenges

#### How to Apply Recommendations
1. THINK HARD about dependencies identified
2. Refine todos based on sequencing advice
3. Adjust batch composition per suggestions
4. Iterate until advisor approves plan

## Phase Management Integration

### Phase Detection Patterns

#### New Feature Detection
**Indicators**: 
- User describes new functionality
- No existing phase context
- Major feature request

**Action**: Create phase-id format `XX-DescriptiveName`

#### Continuation Detection
**Indicators**:
- Bug fix or refinement
- Existing thread context
- Minor adjustment

**Action**: Use most recent related phase or create new

#### Multi-Phase Complexity
**Indicators**:
- Sweeping refactor
- Multi-module impact
- Core business requirement change

**Action**: Work at project level, iterate through phases

### Documentation Hierarchy

#### Three-Tier Structure
1. **Source of Truth Specs** (`docs/project/spec/`)
   - Requirements that don't change unless user updates
   - Only Business-Analyst updates these

2. **Project-Level Gold Docs** (`docs/project/guides/`)
   - Living documentation: roadmap, architecture, ADRs
   - ALWAYS update existing docs rather than creating new

3. **Phase-Level Working Docs** (`docs/project/phases/<phase-id>/`)
   - WP definitions, implementation notes, test plans
   - Working documents for agent batches

## Quality Gates and Verification

### Gate Hierarchy

#### WP-Level Gates
- ✓ Code complete
- ✓ Tests written and passing
- ✓ Documentation updated
- ✓ Code review approved
- ✓ Build/lint/test green
- ✓ Acceptance criteria met

#### Phase-Level Gates
- ✓ All WPs complete
- ✓ E2E tests passing
- ✓ Performance benchmarks met
- ✓ Security scan clean
- ✓ Business Analyst acceptance
- ✓ Deployment ready

### Verification Workflows

#### Standard Verification Sequence
1. Implementation complete → Trigger verification batch
2. Code Review + Testing + Build Verify (parallel)
3. All pass → Proceed to next batch
4. Any fail → Re-work required

#### Cascade Verification
When upstream changes occur:
1. Identify affected downstream components
2. Trigger re-verification of impacted batches
3. Ensure no regressions introduced

## Best Practices and Anti-Patterns

### Best Practices

1. **Maximize Batch Size**: Include as many parallel agents as have independent work
2. **Include Support Roles**: Add architects and researchers for real-time guidance
3. **Clear Agent Roles**: Define specific collaboration expectations for each agent
4. **Broadcast Immediately**: Share decisions and discoveries as they happen
5. **Context Minimalism**: Provide only essential context to each agent
6. **Verification Gates**: Never skip quality checkpoints
7. **Dependency Mapping**: Identify all dependencies before batching

### Anti-Patterns to Avoid

1. **❌ Gatekeepers with Implementation**: Never batch reviewers with implementers
2. **❌ File Conflicts**: Multiple agents editing same file in same batch
3. **❌ Missing Context**: Agents without required information to complete tasks
4. **❌ Blocking Dependencies**: Agents waiting for others within same batch
5. **❌ Skipping Verification**: Moving to next phase without quality gates
6. **❌ Under-utilizing Batches**: Sequential work that could be parallel
7. **❌ Name Reuse**: Using same agent names across batches

### Common Orchestration Mistakes

#### Incorrect Batch Composition
```
❌ Wrong: [Engineer-Implementation, Gatekeeper-Review] (dependency conflict)
✅ Correct: 
   Batch-1: [Engineer-Implementation]
   Batch-2: [Gatekeeper-Review]
```

#### Missing Support Integration
```
❌ Wrong: [Engineer-Frontend] (working in isolation)
✅ Correct: [Engineer-Frontend, Designer, Architect] (real-time support)
```

#### Inadequate Dependency Analysis
```
❌ Wrong: [Engineer-A, Engineer-B] (both modifying same file)
✅ Correct: [Engineer-A] (file owner) + [Engineer-B] (different file)
```

## Implementation Guidelines

### For Primary Orchestrators

1. **Consult Agent-Orchestrator** for strategic advice on team composition
2. **Define Clear WP Boundaries** before spinning up teams
3. **Maximize Batch Size** where agents can work in parallel
4. **Enable Support Roles** within implementation batches
5. **Launch Agent Teams Directly** using Task tool with proper context
6. **Enforce Verification Gates** - no shortcuts allowed
7. **Monitor Broadcast Channel** for blockers and adaptations
8. **Cascade Changes** through re-verification when needed

### Todo Evolution Pattern

```
Initial Assignment → Agent-Orch Consultation → Refined/Resequenced → 
Batch Complete → Update → Next Consultation → Iterate
```

**Always**:
- Update todos immediately after each action
- Consult agent-orchestrator after significant changes
- Refine batch composition based on advisor feedback
- Think hard about dependencies before launching batches

### Working with Agent-Orchestrator

**Consultation Pattern**:
```
You: "Need to implement authentication for 3 microservices"
Agent-Orchestrator: "I recommend 2 batches:
  Batch 1: 3 Engineers + 1 Architect + 1 Deep-Researcher (parallel)
  Batch 2: 2 Gatekeepers + 1 Agent-Orchestrator (parallel verification)"
You: [Makes decision and launches teams]
```

**Strategic Advisor Role**:
- Provides batch composition recommendations
- Suggests optimal sequencing strategies
- Identifies parallelization opportunities
- Helps organize todos efficiently
- Does NOT execute or assign tasks directly

## Conclusion

Effective multi-agent orchestration requires understanding the balance between parallel execution and sequential dependencies. By following these patterns and principles, orchestrators can maximize throughput while maintaining quality and avoiding conflicts.

Key success factors:
- **Intelligent Batch Composition**: Right agents, right size, right dependencies
- **Clear Communication Protocols**: Broadcast decisions, check inbox frequently
- **Quality Gate Enforcement**: Never skip verification steps
- **Context Discipline**: Minimal but complete information for each agent
- **Support Integration**: Include guidance roles for real-time collaboration

The goal is to achieve true collaborative parallelism where agents work simultaneously, support each other through messaging, and complete their work without blocking dependencies.