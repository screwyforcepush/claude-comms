# Project Mental Model

This document captures the user's evolving mental model of the system: the **why**, the conceptual structure, and how they think about the problem space. It should contain **no implementation details or code**.

## Purpose & Motivation

Claude Comms is a **workflow orchestration system** for AI agent coordination. It manages multi-agent job execution with real-time visibility into task progress, enabling a Product Owner to collaborate with AI agents through chat-based interfaces.

The **Workflow Engine UI** is the control terminal for this orchestration—where humans observe, interact with, and guide AI agent work.

## Core Concepts

### The Quake Aesthetic Philosophy
The system's visual identity draws from id Software's Quake (1996):
- **Nine Inch Nails palette** — copper, runic metal, industrial brown (American McGee's term)
- **Lovecraftian otherworldliness** — slipgates, elder dimensions, something ancient and industrial
- **256-color constrained feel** — deliberate palette limitation creates cohesion
- **Trent Reznor influence** — textures, ambiences, whirling machine noises translated to visual rhythm

This isn't nostalgia—it's a **flavor profile** that creates gravitas and distinctiveness. The UI should feel like a control terminal in a dimension you've slipped into.

### Brand as Flavor, Not Library
The brandkit (`docs/project/guides/styleguide/brandkit.jsx`) defines aesthetic DNA:
- **Q palette** — colors with semantic roles (void=background, copper=primary, torch=highlight, etc.)
- **T tokens** — spacing, typography, animation timing
- **FONT stack** — three typefaces for different content types
- **QIcon system** — stroke-based 24x24 icons with angular/miter joins (no rounded corners)

Components in the brandkit are **examples of the flavor applied**, not a library to port. Every UI surface should be infused with this DNA, adapted to its specific purpose.

### Iconography Philosophy
The brandkit includes a complete icon system (QIcon) that should be used consistently:
- Icons are stroke-based, angular, sharp — no rounded corners
- All icons share a 24x24 viewBox
- Icons have semantic meaning tied to Quake lore (slipgate, rune, axe, armor, etc.)
- **Exception**: Harness/provider logos (Anthropic, OpenAI, Google) remain as brand logos, not replaced by QIcons

### Functionality as the Line in the Sand
Visual transformation is unlimited. Functional behavior is immutable:
- Responsive breakpoints define how the UI adapts to screen sizes
- Drawer/collapse behaviors define how users access different areas
- Information display defines what users can see and when
- Business logic defines how data flows and updates

These are **not negotiable** in a visual refresh. The aesthetic wraps around functionality; it doesn't alter it.

## System Relationships & Flows

### User → UI → Agents
1. User interacts with Workflow Engine UI (chat, job monitoring, assignment management)
2. UI displays real-time state from Convex backend
3. Agents execute jobs and report progress
4. UI surfaces progress, status, artifacts back to user

### Visual Hierarchy
- **Void** — deepest background, the abyss
- **Stone** — surface containers, panels
- **Copper** — primary actions, emphasis
- **Torch** — highlights, attention
- **Fullbright accents** — status indicators (lava=danger, slime=success, teleport=special)

### Information Priority
What users need to see, in order:
1. Current job status (what's running, what's blocked)
2. Chat thread context (conversation with agents)
3. Assignment progress (overall work completion)
4. Detailed metrics (tokens, tool calls, durations) — available on demand

## User Perspective

### Primary Goals
- **Monitor agent work** — see what's happening at a glance
- **Intervene when needed** — catch problems, provide guidance
- **Feel in control** — the UI should feel like a command center, not a passive dashboard

### Expectations
- **Immersive but functional** — effects add atmosphere without impeding usability
- **Information density** — show more, not less, but with visual hierarchy
- **Responsive** — works on laptop, tablet, mobile equally well
- **Fast** — animations are ambient, not blocking

### Aesthetic Preferences
- Full effects suite (grain, scanline, flicker, pulses)
- AgentHUD-style job cards (riveted panels, stats layout)
- Three-font typography system
- Zero rounded corners (this is Quake)
- Consistent QIcon usage throughout (except harness logos)

### Job Card Mental Model (AgentHUD Pattern)
Job cards in the chain visualization should feel like Quake HUD status bars:
- **HP (Health)** = Duration — how long the job has been running. Bar counts DOWN from 1 hour max. Shows actual time, bar is visual countdown.
- **ARM (Armor)** = Idle time — how long since last activity. Bar counts DOWN from 10 min max. When complete, armor is "full" (job is protected/done).
- **FRAGS** = Tool calls — kill count analogy. How many tools the agent has used.
- **Tokens** = Can be DMG, AMMO, or similar — design judgment for fitting the theme.
- **Status Rune** = Job state mapped to brandkit StatusRune patterns.
- **Subagents** = Mini provider icons in the subhead area.

## Security Model

### Single-User Philosophy
This system is built for a single user (the Product Owner). Security needs are simple:
- **Stop bots and crawlers** from accessing data or triggering jobs
- **Stop casual snoops** from viewing the deployed UI
- **No complex auth** — OAuth, sessions, JWTs are overkill for single-user

### Trust Boundaries
The system has four entry points with different trust levels:

| Entry Point | Location | Trust Level | Protection |
|-------------|----------|-------------|------------|
| **UI** | Vercel (public URL) | Untrusted | Password wall |
| **Convex Backend** | Cloud | Untrusted | Password on all functions |
| **Runner** | Local machine | Trusted | Reads password from config |
| **CLI** | Local machine | Trusted | Reads password from config |

The Runner and CLI run on the user's machine — they're inside the perimeter. The password is just to authenticate them to Convex, not to protect them from the user.

### Why This Matters
The Runner executes jobs using the user's API tokens (Anthropic, OpenAI, Google). An unprotected Convex backend means anyone with the URL could:
- Read chat history and job results
- Trigger jobs that consume API credits
- Potentially exfiltrate sensitive context from prompts

A simple password wall stops this without adding complexity.

## UI Mental Model — Cross-Namespace Operations Center

### Thread Management
The user's primary workflow surface is the **thread list**. Key principles:
- **All-namespace view is the default** — Threads from all namespaces shown together, sorted by most recent activity (`updatedAt`). Active threads (new messages, mode changes, assignment links) naturally bubble to the top. The user manages work across many namespaces and needs a unified view.
- **Namespace filtering is secondary** — An accordion filter (collapsed by default) above the thread list lets the user toggle namespaces on/off. Multi-select (0 selected = all). No separate namespace drawer.
- **Thread items show namespace labels** — Since threads from different namespaces are mixed, each thread item needs a namespace badge for context.
- **Unread indicators** — Threads show an unread dot (Fullbright torch-colored pulse) when messages exist after `lastReadAt`. Binary indicator — no count. Tracked via `lastReadAt` timestamp on the thread and server-enriched `latestMessageAt` from `chatThreads.listAll`.

### Draft Persistence
When the user types in a chat pane and switches to another thread, the draft text must survive. Per-thread draft state stored client-side (localStorage or in-memory state keyed by threadId). This is critical for the user's multi-tasking workflow — they often start composing in one thread, jump to another for a quick message, and return.

### Assignment Navigation
A single thread may spawn multiple assignments over its lifetime (e.g., the Outcome Navigator creates assignment 1, then later assignment 2). The current `assignmentId` field is a "focus" pointer — it shows which assignment the UI is focused on. The `assignmentsCreated` array tracks all assignments ever linked from this thread. The user can click through them in the assignment pane to review history and switch focus.

### Agent Control
The user needs to be able to:
- **Change assignment status** from the UI (click status pill → dropdown → active/blocked/pending)
- **Kill running agents** — A button in the job detail modal sets `killRequested` on the job/chatJob. The runner (which owns the process) watches for this and terminates the agent.
- **Interrupt chat jobs** — Same kill mechanism, but the thread stays conversational so the user can send a follow-up message with more detail.

### Mid-Flight Assignment Modification

Assignments run autonomously through PM-driven job chains. But the user's understanding evolves faster than assignments complete. Two levers exist for injecting course correction without stopping or restarting work:

**PM Nudge** — A short-lived directive on the assignment, consumed by the next PM.
- Written by: the guardian (spotting gaps in PM reports), or the user directly via UI
- Read by: the next PM, at the start of their assessment
- Lifecycle: single string, overwrite semantics. PM clears after addressing. If PM can't address this round (e.g., launching review not implement), it persists for the next PM. Guardian checks before writing — clears stale, overwrites with new.
- Content: specific, verification-oriented instructions — not strategy documents. "Check that file X actually changed." "Ensure consumable resources exist, not just equipment."
- The nudge is a **communication channel into the execution loop**, not just a guardian tool. Anyone with authority can inject a directive into the next PM decision point.

**North Star Amendment** — Permanent scope modification, appended to the north star string.
- Written by: the Outcome Navigator, only under explicit user instruction
- Read by: every PM and every job for the rest of the assignment's lifetime
- Lifecycle: append-only string concatenation. The Outcome Navigator prefixes with "Amendment N:" for tracking.
- Use when: a nudge is too big for single consumption — scope changes, new requirements, direction shifts that every future PM needs to see.

The two levers differ in weight:
| | Nudge | North Star Amendment |
|---|---|---|
| Lifespan | Consumed once | Permanent |
| Scope | Tactical verification | Strategic direction |
| Visibility | Next PM only | Every PM + every job |

### Self-Modification Awareness
Claude Comms is its own upstream — changes here propagate to all client repos. The system must be careful about backward compatibility:
- Schema changes should be additive (optional fields)
- Runner-touching changes require manual runner restart by the user
- The UI and Convex backend deploy atomically, so UI-only or UI+backend changes are safe

## Session Context Isolation

### The Problem
A chat thread has a single Claude session that accumulates context over time. When guardian mode activates, PM evaluation prompts and user conversations would share that same session — guardian evaluations pollute the user's conversation context and vice versa. The PO's evaluative judgment and the user's collaborative discussion serve fundamentally different purposes and shouldn't interfere with each other.

### The Fork Model
When guardian mode activates for an assignment, the system **forks** the Claude session. The fork inherits all prior conversation context (the user's intent, spec discussions, design decisions) but diverges from that point:

- **OG session** (`claudeSessionId`) — the user's jam/cook conversation. Uncontaminated by guardian traffic.
- **Guardian fork** (`guardianSessions[assignmentId]`) — per-assignment evaluative context. Accumulates PM evaluation history, alignment judgments, pattern recognition across reports.

### Per-Assignment Isolation
Each assignment gets its own guardian fork. When the user switches focus assignment, the guardian session follows — different assignment = different fork = different accumulated evaluation context. This means the PO can build nuanced understanding of each assignment's trajectory independently.

### Session Routing
The system routes based on thread mode:
- Jam/cook mode → OG session (user conversation)
- Guardian mode → guardian fork for the focused assignment (all interactions — PM evals AND user messages — go through the fork)

Switching between modes is instant and non-destructive. Nothing is lost.

## Non-Goals / Out of Scope

- OAuth, BetterAuth, or complex authentication (single-user system)
- Mobile-specific redesigns (maintain existing responsive behavior)
- God-mode / cross-namespace agent interrogation (parked idea — revisit when use case is clearer)

### Subscription Efficiency Principle
Real-time Convex subscriptions should only be maintained for **mutable data** — jobs/groups that are still pending or running. Terminal data (complete/failed) is immutable and should be fetched via bulk queries that rarely invalidate, not per-entity live subscriptions. This principle applies broadly: don't pay the reactive cost for data that has stopped changing.

## Open Questions

*None currently.*
