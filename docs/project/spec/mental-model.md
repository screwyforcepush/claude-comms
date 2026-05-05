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

### Execution Records vs. Filesystem State
Job execution records (groups, jobs, results, aggregated decisions, artifacts, PM messages) are a **log of how the system got here** — not the source of truth about what exists. The real state is the code on disk. This matters most for **retry semantics**: when a job group is retried, downstream execution records are cascade-deleted, but stale decisions, artifacts, and PM chat messages from earlier groups are preserved. They still accurately describe what happened and what the filesystem now reflects. The execution record is history; the code is state.

### Rate-Limit Resilience
External provider rate limits (Anthropic's 5-hour and 7-day usage windows) are an operational reality that the workflow engine must handle gracefully. The core principle: **a rate limit is not a failure — it's a pause.**

When a Claude job hits a rate limit:
- The job enters `awaiting_retry` status — a non-terminal state that freezes the group in place
- No PM auto-spawns (the group never completes, so the cascade never starts)
- A server-side timer retries the job when the rate-limit window resets
- If the window hasn't cleared, exponential backoff kicks in (capped at 30 minutes)
- The user sees a countdown timer on the job card in the UI

This design keeps retry coordination state minimal — just `retryCount` on the job record. The Convex scheduled function handles the timer server-side (independent of runner uptime). The runner has zero retry state.

**Emergency brake:** Setting the assignment to `blocked` prevents the runner from picking up retried jobs. The Convex timer still fires and flips the job to `pending`, but the runner skips blocked assignments.

**Scope:** Claude harness only. Assignment jobs only (chat jobs fail normally — the user can re-send). No cap on total retries — keeps going at 30m intervals until the window clears.

### Harness Model Configuration

The workflow engine supports three AI harnesses: Claude, Codex, and Gemini. Each harness is a different CLI binary with its own stream format, but they all accept a `--model` flag to select which model to use.

**Core principle:** The user configures which harness + model combination runs for each job type, per namespace. This is stored in Convex on the namespace record — not in local file config.

**Config shape** — Object notation. Single entry = one job. Array = fan-out to parallel jobs in a group. Model is optional — omit to use the harness's own default:
```json
{
  "default": { "harness": "claude" },
  "implement": { "harness": "claude" },
  "review": [
    { "harness": "claude" },
    { "harness": "codex" },
    { "harness": "gemini", "model": "auto-gemini-3" }
  ],
  "pm": { "harness": "claude" },
  "chat": { "harness": "claude" }
}
```
The user configures specific models when they choose to via the UI settings modal (e.g., `{ "harness": "claude", "model": "claude-opus-4-6" }`).

**Key design decisions:**
- **Model string is exact CLI argument** — passed verbatim to `--model` / `-m`. No aliases, no mapping layer. The user types what the harness CLI expects.
- **Fan-out is fully flexible** — an array can contain any mix of harness+model entries, including multiple entries for the same harness with different models (e.g., three Claude models at different tiers for capability-diverse review).
- **Resolution order:** job type key → `default` key → config error.
- **Stamped at insert time** — when a job is created, `harness` and `model` are resolved from config and written onto the job record. The job is a complete execution spec. The runner doesn't need to look up config.
- **Review result anonymity** — fan-out review results are deliberately unattributed by harness/model to prevent bias in PM evaluation.
- **Namespace-scoped, not assignment-scoped** — config applies to all assignments in the namespace.
- **Convex-only** — no file-based fallback. The local `config.json` retains only connection params and timeouts.
- **UI settings modal** — namespace harness config is viewable and editable from the Workflow Engine UI.
- **Bootstrap** — default harnessDefaults are seeded during namespace init (client setup).

## Job Type Catalog

The workflow engine has a fixed set of job types, each backed by a prompt template in `.agents/tools/workflow/templates/`:

- **plan** — design work; produces an implementation plan
- **implement** — execution; writes code/changes against a plan
- **review** — independent evaluation of changes; often fan-out across harnesses
- **uat** — user-acceptance testing; manual/exploratory verification
- **pm** — product manager; assesses group output, decides next group
- **chat** — interactive conversation, not bounded by a single deliverable

Job types are referenced in the harness config (per-namespace) and stamped onto job records at insert time.

## Agent Reflection Feedback Loop

A planned telemetry layer that captures **the agent's operating experience**, not its output. The premise: every job is also a usability test of its own tooling and workflow, and that signal is currently invisible.

### Two Distinct Products
- **Ergonomics reflection (v1)** — outcome-blind. About *how* the agent operated: tool friction, environment issues, repetition, mistakes, suggested improvements. Fires after every non-chat job.
- **Workflow effectiveness reflection (later)** — outcome-aware. About *what* the agent produced and whether it landed. Different lens, different timing, different downstream questions.

The two are separate features. v1 is ergonomics-only.

### Loop Shape
- A job completes (success or failure); the runner spawns a fire-and-forget reflection wrapper as a background task and moves on.
- The wrapper resurrects the agent via the captured `sessionId` using `claude --resume <sessionId> --fork-session` — the forked session is throwaway, so the original session record stays clean.
- The agent is directed to a CLI script (`reflect.ts`) that mirrors the existing assignment toolkit pattern: `--help` to learn the interface, then a single invocation with structured input. No MCP, no custom tool registration.
- The CLI validates input, denormalises job-weight metadata (namespace, harness, jobtype, tokens, duration, tool calls) onto the row at write time, and writes one record to Convex linked by `jobId`.
- No response parsing. No retry. No failure handling. The agent runs the CLI, exits.

### Reflection Content
- A 1-line description (debugging convenience — the only "what" field; everything else is "how")
- Critique of operating environment, tool friction, mistakes and their causes
- Alternative approach in hindsight
- Suggested improvements for future agents
- A **flexible boolean rubric** — a key/value map of yes/no questions about operating experience. Keys are not typed at the schema level so the question set can evolve without migrations; the v1 question list ships as a draft, expected to evolve based on real reflection data. Field omission is itself signal ("the agent had no opinion on this dimension")
- Free-form keywords (no taxonomy at v1; normalize later if needed)
- Captured automatically: `reflectionCliVersion` (const in the CLI source, bumped per push), `clientGitSha` (the consuming repo's HEAD), `engineGitSha` (the runner-side workflow engine's HEAD)

### Job Types That Reflect
plan, implement, review, uat, pm, document. **Not chat** — chat reflection is on-demand by user request only.

Fan-out review groups: each member reflects independently, peer-blind. Reflection is job-level.

Failed jobs reflect too — failure is exactly when friction signal is highest. Failed-but-no-`sessionId` jobs (immediate harness crash) skip silently and surface in the coverage metric.

### Self-Diagnostic
Coverage rate is the health metric: terminal jobs without paired reflection records flag pipeline issues (harness crash, unresumable session, agent skipped the tool). The metric is exposed both as a single number and broken down by harness — the by-harness breakdown makes the non-Claude expected-zero visible at a glance, which prevents the headline number from being misread.

The coverage denominator starts at reflection integration time. New assignment jobs carry a denormalized optional `jobs.namespaceId`, and only terminal jobs with that field present are counted. Historical jobs are not backfilled and are not treated as missed reflections.

### Analysis Surface
The Outcome Steward (Product Owner agent, per-namespace) is the meta-reflector. The same Convex query functions that drive the reflection dashboard also power the Steward's analysis toolkit — DRY across human-facing UI and agent-facing introspection. Each project's Steward sees only its own namespace's data; cross-namespace analysis is out of scope.

## Open Questions

*None currently.*
