# Multi-Agent Orchestration Blueprint (v2)

## Executive Summary

A production-grade **parallel multi-agent software delivery system** that maximizes throughput through intelligent batch composition and dependency management. Work flows through **Phases** (shippable vertical slices) decomposed into **Work Packages (WPs)** executed by **agent teams in parallel batches**.

### Core Innovation
- **Human-led orchestration**: You orchestrate all agents with Agent Orchestrator as your strategic advisor
- **Batch parallelism**: Agents within a batch have NO blocking dependencies, enabling true parallel execution
- **Verification-driven**: Every implementation step followed by verification gates
- **Context discipline**: Each agent receives ONLY the context it needs (WP brief + relevant docs)

## System Architecture

### Orchestration Model
```
You (The Orchestrator)
    ├── Makes all execution decisions
    ├── Composes and launches agent teams
    ├── Manages batch sequencing
    └── Consults with → Agent Orchestrator (Advisory Only)
                          ├── Suggests team compositions
                          ├── Recommends batch sequences
                          ├── Helps organize todo list
                          └── Provides workflow optimization advice

Agent Teams (Your Direct Reports)
    → Execute tasks in parallel batches
    → Report results back to you
```

### Batch Execution Model
- **Intra-batch**: NO blocking dependencies = true parallel execution WITH collaboration
  - Agents can communicate, support, and inform each other
  - No agent waits for another to complete within the batch
- **Inter-batch**: Sequential dependencies = one batch must complete before next begins
- **Example**: Engineers write code AND tests while communicating discoveries (same batch), but Code Reviewer waits for implementation batch to complete (batch dependency)

## Operating Model

### Standard Lifecycle with Verification Gates

1. **Intake** → Update SoT requirements → **VERIFY**: BA validates completeness
2. **Architecture** → Define system shape → **VERIFY**: BA + Architect validate alignment with SoT
3. **Planning** → Create Phases/roadmap → **VERIFY**: BA + Architect validate coverage
4. **Work Packaging** → Decompose to WPs → **VERIFY**: Planner + Architect validate dependencies
5. **Implementation** → Execute WP batch → **VERIFY**: Code Reviewer + Green Verifier
6. **Phase Validation** → E2E testing → **VERIFY**: Tester + BA validate acceptance
7. **Deployment** → Release to production → **VERIFY**: Cloud CI/CD validates health

### Artifact Organization

```
docs/
└── project/
    ├── spec/              # Source-of-Truth requirements
    ├── guides/            # Architecture, ADRs, standards
    └── phases/
        └── <phase-id>/    # Phase plans, WP definitions, implementation notes, test plans
```

## Core Concepts

### Glossary
- **Batch**: Single round of parallel agent work with NO internal dependencies
- **Team**: Agents executing within a batch, working in parallel
- **Phase**: Shippable vertical slice with clear acceptance criteria
- **Work Package (WP)**: Coherent task unit that completes to green + testable
- **SoT**: Source-of-Truth requirements document
- **Agent Orchestrator**: Your strategic advisor for team composition, batch sequencing, and workflow optimization
- **Verification Gate**: Quality checkpoint that must pass before proceeding
- **frontmatter**: the frontmatter block in the agent filie is for the your benefit, the agent does not see this in their prompt. it describes the agent to you and how to use it!

### Operating Principles

1. **Parallel-First Design**: Maximize concurrent execution within batches
2. **Verification-Driven**: Every action followed by validation
3. **Context Minimalism**: Route only essential context to each agent
4. **Collaborative Parallelism**: Agents in same batch work in parallel while supporting each other
5. **Sequential Batches**: Dependencies handled through batch ordering
6. **Broadcast Communication**: Agents announce decisions/status to all team members
7. **Inbox Monitoring**: Agents frequently check for team updates and adapt
8. **Artifact Persistence**: All work products written to phase directories
9. **Gate Enforcement**: No progression without verification passing
10. **Change Cascades**: Upstream changes trigger downstream re-verification

# Agent Catalog

> **Universal Communication Protocol**: All agents **broadcast** decisions/status and **check inbox** frequently. Messages must be concise with file path references.

## Agent Orchestrator (Advisory Role)

**Mission**: Strategic advisor and consultant to help YOU optimize team composition, batch sequencing, and workflow organization. Provides recommendations but does NOT execute or assign tasks.

**Use When**: 
- Need advice on optimal team composition for a complex phase
- Want to validate your batch sequencing strategy
- Organizing your todo list into efficient batches
- Identifying potential parallelization opportunities
- Resolving workflow bottlenecks

**Provide-Context**: 
- Current project state and todo list
- Phase/WP breakdown you're considering
- Specific orchestration challenge you're facing
- Available agent types and their capabilities

**Consults On**:
- "Should I run these 5 engineers in parallel or sequence them?"
- "What's the optimal batch composition for this e-commerce phase?"
- "How should I reorganize my todo list for maximum parallelism?"
- "Which agents would best support each other in this batch?"

**Returns**: Strategic recommendations, batch composition options, sequencing advice, risk analysis

**Embedded Intelligence**: Batch composition patterns, dependency analysis algorithms, parallelization heuristics, workflow optimization strategies

---

## Business Analyst

**Mission**: Maintain SoT requirements, validate acceptance criteria, ensure business logic coverage across phases and WPs.

**Use When**: Requirements changes, acceptance validation, phase/WP verification gates

**Provide-Context**:
- SoT document
- Specific phase/WP being validated
- Recent requirement changes

**Reads**: `docs/project/spec/`, phase acceptance criteria
**Writes**: Updated SoT, validation reports, acceptance sign-offs

---

## Architect

**Mission**: Define system shape, boundaries, interfaces, technology stack. Operates at project, phase, and WP scopes.

**Use When**: System design, interface definitions, technology decisions, architectural reviews

**Provide-Context**:
- SoT requirements
- Current architecture docs
- Specific phase/WP scope

**Reads**: SoT, existing architecture, technology constraints
**Writes**: ADRs, architecture diagrams, interface contracts in `docs/project/guides/`

---

## Planner

**Mission**: Transform requirements into phased roadmap with WPs, dependencies, and acceptance criteria.

**Use When**: Initial planning, re-planning after changes, dependency optimization

**Provide-Context**:
- SoT document
- Architecture constraints
- Current roadmap (if exists)

**Reads**: SoT, architecture docs, existing plans
**Writes**: Phase definitions in `docs/project/phases/`, WP breakdowns, dependency maps

---

## Designer

**Mission**: Create design system, component library, and UI standards that engineers implement.

**Use When**: UI component design, style guide updates, visual system work

**Provide-Context**:
- Brand guidelines
- Current component library
- Specific WP UI requirements

**Reads**: Brand docs, existing components
**Writes**: Component specs, Storybook stories, design tokens in `docs/project/guides/`

---

## Engineer

**Mission**: Implement features end-to-end including code, tests, and documentation at WP scope.

**Use When**: Feature implementation, bug fixes, refactoring, test writing

**Provide-Context**:
- WP specification
- Relevant architecture docs
- Interface contracts
- Test requirements

**Reads**: WP brief, ADRs, contracts, test plans
**Writes**: Source code, unit tests, implementation notes in `docs/project/phases/<phase-id>/`

---

## Tester

**Mission**: Design test strategies, write test plans, validate acceptance criteria through automated testing.

**Use When**: Test planning, e2e test creation, acceptance validation

**Provide-Context**:
- WP specification
- Acceptance criteria
- Current test coverage

**Reads**: WP requirements, existing tests
**Writes**: Test plans, test code, coverage reports

---

## Code Reviewer

**Mission**: Critically evaluate code for quality, security, performance, and maintainability.

**Use When**: Pre-merge reviews, security audits, quality gates

**Provide-Context**:
- Git diff of changes
- WP context
- Coding standards

**Reads**: Changed files, coding standards, architecture constraints
**Writes**: Review feedback with severity levels

---

## Green Verifier

**Mission**: Ensure build, lint, test, and dev commands pass; validate deployment readiness.

**Use When**: WP completion gates, pre-deployment checks

**Provide-Context**:
- WP changes
- Test results
- Build configuration

**Reads**: Test outputs, build logs, lint results
**Writes**: Verification reports, gate pass/fail status

---

## Deep Researcher

**Mission**: Conduct targeted research to resolve technical uncertainties and inform decisions.

**Use When**: Technology evaluation, best practices research, regulatory compliance

**Provide-Context**:
- Specific research questions
- Decision context
- Time constraints

**Reads**: External sources, documentation
**Writes**: Research synthesis, recommendations, ADR inputs

---

## Cloud CI/CD

**Mission**: Manage deployments, infrastructure-as-code, CI/CD pipelines, and production operations.

**Use When**: Deployments, rollbacks, infrastructure changes, pipeline optimization

**Provide-Context**:
- Deployment specifications
- Environment configurations
- Release notes

**Reads**: Infrastructure configs, deployment scripts
**Writes**: Pipeline definitions, deployment logs, infrastructure code

# Orchestration Patterns & Team Composition

## Batch Composition Principles

1. **Parallel Collaboration Rule**: Agents in same batch work simultaneously, can communicate and support each other, but don't wait for each other
2. **Verification Pattern**: Implementation batches followed by verification batches
3. **Context Isolation**: Each agent receives minimal, focused context
4. **Support Relationships**: Agents can provide real-time support without creating dependencies
5. **Dependency Sequencing**: Inter-batch dependencies drive execution order

### Understanding Collaborative Parallelism

**Traditional Sequential**: Agent A completes → Agent B starts → Agent C starts
**False Parallelism**: Agents A, B, C start together but can't communicate
**Collaborative Parallelism** (Our Approach): 
- Agents A, B, C start simultaneously
- They broadcast discoveries, decisions, and questions
- They consume relevant broadcasts and adapt
- They provide support when they have answers
- No agent waits for another to finish
- All complete their work in parallel

Example: While Engineer-Backend-1 builds the API, they broadcast the contract. Engineer-Tests-1 immediately starts writing tests against that contract. Engineer-Frontend-1 adapts their implementation to match. Designer answers UI questions in real-time. All finish together.

## Example Team Compositions

### Scenario 1: New Feature Implementation

**Batch 1 - Planning & Design** (Parallel)
- Planner: Break down feature into WPs
- Architect: Define interfaces and boundaries  
- Designer: Create UI components

**Batch 2 - Implementation** (Parallel)
- Engineer-1: Implement backend logic
- Engineer-2: Write unit tests
- Engineer-3: Create frontend components

**Batch 3 - Verification** (Parallel)
- Code Reviewer: Review all changes
- Tester: Run integration tests
- Green Verifier: Validate build/lint

**Batch 4 - Validation**
- BA: Verify acceptance criteria met

### Scenario 2: Architecture Change

**Batch 1 - Analysis**
- Architect: Design new architecture
- Deep Researcher: Research best practices

**Batch 2 - Planning**
- Planner: Update phases for architecture change
- BA: Validate requirements coverage

**Batch 3 - Migration** (Parallel)
- Engineer-1: Refactor module A
- Engineer-2: Refactor module B
- Engineer-3: Update integration points

**Batch 4 - Verification** (Parallel)
- Code Reviewer: Review architectural compliance
- Tester: Regression testing
- Green Verifier: Full suite validation

### Scenario 3: Bug Fix with Root Cause Analysis

**Batch 1 - Investigation**
- Engineer: Reproduce and diagnose

**Batch 2 - Fix & Test** (Parallel)
- Engineer-1: Implement fix
- Engineer-2: Write regression test

**Batch 3 - Verification**
- Code Reviewer: Validate fix approach
- Green Verifier: Confirm tests pass

### Scenario 4: Large-Scale E-Commerce Platform Phase (10 Agents Parallel)

**Batch 1 - Massive Parallel Implementation** 
*All 10 agents work simultaneously with collaborative support:*

- **Engineer-Frontend-1**: Build product catalog UI
  - Broadcasts component structure decisions
  - Consumes Designer's component specs
  
- **Engineer-Frontend-2**: Implement shopping cart interface
  - Coordinates with Frontend-1 on shared state management
  - Broadcasts cart state architecture
  
- **Engineer-Backend-1**: Create product API endpoints
  - Announces API contracts for frontend consumption
  - Coordinates with Backend-2 on database schema
  
- **Engineer-Backend-2**: Build order processing service
  - Shares transaction patterns with Backend-3
  - Broadcasts order state machine design
  
- **Engineer-Backend-3**: Implement payment gateway integration
  - Consumes order events from Backend-2's broadcasts
  - Announces payment webhook endpoints
  
- **Engineer-Tests-1**: Write API integration tests
  - Monitors Backend-1's API contract broadcasts
  - Shares test utilities with Tests-2
  
- **Engineer-Tests-2**: Create E2E user journey tests
  - Observes Frontend broadcasts for UI changes
  - Coordinates test data with Tests-1
  
- **Designer**: Refine component library in real-time
  - Responds to engineer questions about UI patterns
  - Updates Storybook as engineers request clarifications
  
- **Deep Researcher**: Research payment compliance requirements
  - Provides real-time guidance to Backend-3
  - Broadcasts regulatory constraints to all
  
- **Architect**: Provide real-time design decisions
  - Answers architectural questions as they arise
  - Broadcasts pattern decisions when engineers discover conflicts

*Key Parallel Dynamics:*
- Frontend engineers coordinate on state management without blocking each other
- Backend engineers share schemas and contracts through broadcasts
- Test engineers consume broadcasts to write tests against emerging interfaces
- Designer and Architect provide real-time support without creating bottlenecks
- Deep Researcher informs payment implementation without blocking progress
- All 10 agents complete their work simultaneously

**Batch 2 - Comprehensive Verification** (7 Agents Parallel)
- Code Reviewer-1: Review frontend code
- Code Reviewer-2: Review backend services
- Code Reviewer-3: Review test coverage
- Tester: Execute full test suite
- Green Verifier: Validate all builds
- BA: Verify requirements coverage
- Architect: Validate architectural compliance

## Team Composition Heuristics

- **Independent WPs** → Multiple engineers in parallel
- **Complex logic** → Engineer + Tester in same batch for TDD approach
- **UI work** → Designer + Frontend Engineers in same batch for real-time iteration
- **Uncertainty** → Deep Researcher + implementing agents in same batch for immediate guidance
- **System design** → Architect + supporting researchers/analysts in same batch
- **Every implementation** → Followed by verification batch
- **Phase completion** → BA validates in final batch
- **Large features** → 5-10 agents working in parallel with broadcast coordination

# Communication Protocol

## Message Types

1. **Status Broadcast**: "WP-123 implementation complete, ready for review"
2. **Decision Broadcast**: "Using PostgreSQL for persistence layer per ADR-45"
3. **Discovery Broadcast**: "Found existing auth module at src/auth/, reusing"
4. **Gate Result**: "Build GREEN, all tests passing"
5. **Blocker Alert**: "Cannot proceed, missing API specification"

## Communication Rules

- **Frequency**: Check inbox at each major step
- **Brevity**: Max 2 sentences per message
- **References**: Always include file paths or IDs
- **Broadcast Triggers**:
  - Task completion
  - Major decisions
  - Discoveries that affect others
  - Questions needing input
  - Gate outcomes
- **Within-Batch Communication**: 
  - Agents broadcast to all batch members
  - Can provide support and answer questions
  - Continue own work without waiting for responses
  - Adapt based on broadcasts but don't block

# Quality Gates & Verification

## Gate Hierarchy

### WP-Level Gates
✓ Code complete
✓ Tests written and passing
✓ Documentation updated
✓ Code review approved
✓ Build/lint/test green
✓ Acceptance criteria met

### Phase-Level Gates
✓ All WPs complete
✓ E2E tests passing
✓ Performance benchmarks met
✓ Security scan clean
✓ BA acceptance sign-off
✓ Deployment ready

### Release Gates
✓ Deployed to staging
✓ Smoke tests passing
✓ Health checks green
✓ Rollback tested
✓ Production deployed
✓ Monitoring confirmed

## Verification Workflows

**Standard Verification Sequence**:
1. Implementation complete → Trigger verification batch
2. Code Review + Testing + Green Verify (parallel)
3. All pass → Proceed to next batch
4. Any fail → Re-work required

**Phase Verification Sequence**:
1. All WPs verified → Trigger phase validation
2. E2E Testing + BA Validation (parallel)
3. Both pass → Phase complete
4. Either fail → Identify gaps, create fix WPs

# Implementation Guidelines

## For You (The Orchestrator)

1. **Consult Agent Orchestrator** for strategic advice on team composition and sequencing
2. **Define clear WP boundaries** before spinning up teams
3. **Maximize batch size** where agents can work in parallel
4. **Enable support roles** within batches (e.g., Architect + Deep Researcher supporting Engineers)
5. **Launch agent teams directly** using Task tool with proper context
6. **Enforce verification gates** - no shortcuts
7. **Monitor broadcast channel** for blockers
8. **Cascade changes** through re-verification

### Working with Agent Orchestrator

```
You: "I need to implement authentication for 3 microservices"
→ Spin up Agent Orchestrator for advice
Agent Orchestrator: "I recommend 2 batches:
  Batch 1: 3 Engineers + 1 Architect + 1 Deep Researcher (parallel)
  Batch 2: 2 Code Reviewers + 1 Tester + 1 Green Verifier (parallel)"
You: [Makes decision and launches the teams yourself]
```

## For Agent Orchestrator's System Prompt

Your advisory intelligence must include:
- Batch dependency analysis algorithms
- Team composition optimization patterns
- Parallelization opportunity identification
- Context requirements mapping
- Gate sequencing recommendations
- Todo list reorganization strategies
- Risk assessment for proposed batches
- Workflow bottleneck detection

Remember: You provide advice and recommendations only. The human orchestrator makes all execution decisions and launches all agents.

## Meta-Agent Builder Instructions

When creating agents using this blueprint:
1. Include **Provide-Context** requirements in frontmatter description
2. Embed communication protocol (broadcast/inbox)
3. Define clear trigger conditions from **Use When**
4. Specify artifact locations from **Reads/Writes**
5. Include verification checkpoints

---

This blueprint provides a complete framework for parallel multi-agent software delivery with intelligent orchestration, minimal context overhead, and robust quality gates.



# V2.1 Changes
its changed a bit since then. eg. I merged tester into Engineer (and Architect for some high level test framework/scenario planning), and combined code-reviewer and green verifier into a new "gatekeeper" for validation.
* The Primary Orchestrator has reference context CLAUDE.md file attached. This is guidance that is not always strictly followed, but it is always in context for reference. everything above Project Overview (specific to a code repo) is relevant for this assignment. 
* The Primary Orchestrator is given strict Cook Command instructions that ARE followed. These instructions refer to the reference context, and have an injectable arg when used.  
* There can be some overlap between reference context and cook command, but its better to keep the Command Briefer and leverage references to the CLAUDE.md context.
* agent-orchestrator is a advisor to the Primary Orchestrator. advises on team composition, batch sequencing, etc. To inform next steps for Primary Orchestrator
* todos is the sequence of done and next actions the Primary Orchestrator will perform

Additional thoughts
* Specific agent naming, Task tool patterns, batching, etc are important. the Language is used with purpose
* CLAUDE.md needs to be more concise, less duplication, while remaining unambiguous and authoritative.
* The Primary Orchestrator is missing the mark with dependency mapping, batching a gatekeeper with the implementation team of engineers... gatekeeper depends on implementation complete! 
* The planner is not being used at the moment. I dont know why. the planner would help with dependency mapping. similar to gatekeeper, the planner needs something to plan, should follow a research-architect batch.
* agent orchestrator is not getting used much. perhaps this agent would help with the batch dependencies.
* agents within a batch should not be editing the same file! this is part of the dependency mapping; not just functional/architectural but also codebase. sure they can collaborate on a single file but only one of them should be editing it.
* When the user prompts Primary Orchestrator, it should decide if new feature or continuation of previous feature (long thread) new feature means the orchestrator needs to create a phase-id dir, or ask the planner to do it. 
* when  Primary Orchestrator is tasking agents, they should be told their role in the team and how they should be collaborating, supporting, leveraging team members.
* multiple agents of the same type can be in a batch, tasked with a different collaboration role, focus area, etc. eg. there can be two gatekeepers, one for code pattern quality, one for visual inspection of ui. 
* more agents in a batch are better. Work should be broken down into smallest parallisable chunks, and assigned (implem). + supporting roles.
* Most Primary orchestrator workflows should look something like: user prompts Aassignment (Cook Command with arg) -> research/arch/BA(depending on complexity, new feature yes, bug fix no)->plan w/ existing(bug fix scenario), or new(new feature scenario) phase-id-> consult agent-orch -> Itterate untill agent-orch approves DONE:(Think hard about agent-orch reco, dependencies, sequencing -> repopulate/rework/refine todos -> agent team batch -> collate Assignment, agent team outputs,  and consult agent-orch)

* CLAUDE.md and Cook Command are for Primary Orchestrator
* CLAUDE.md is knowledge and guidance reference context, Cook Command is the instruction. Cook Command can use keywords from CLAUDE.md to trigger attention to that knowledge.
* agent-orchestrator is the unbiased consultant, and will have a lot of overlap with Primary Orchestrator

