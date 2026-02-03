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

Components in the brandkit are **examples of the flavor applied**, not a library to port. Every UI surface should be infused with this DNA, adapted to its specific purpose.

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

## Non-Goals / Out of Scope

- Backend changes (Convex, data schemas, APIs)
- Business logic modifications
- New features or capabilities
- Changes to data contracts or information architecture
- Mobile-specific redesigns (maintain existing responsive behavior)

## Open Questions

*None currently — the transformation scope is well-defined.*
