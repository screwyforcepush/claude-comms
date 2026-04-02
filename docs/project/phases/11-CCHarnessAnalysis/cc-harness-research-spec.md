# CC Harness Source Analysis — Research Spec

## Purpose

Given access to Claude Code's extracted source code (`_research/claude-code-harness/`), analyze the integration surface between claude-comms and CC to surface actionable opportunities that reduce friction, lower token overhead, and leverage native capabilities — while respecting our harness-agnostic, fresh-session architecture.

## Overview

This is a **research-only** phase. No code changes. The deliverable is `docs/project/research/cc-harness-analysis.md` — a comprehensive report structured as specified in the North Star.

---

## Architecture Design

### Research Methodology

The analysis follows a compare-and-contrast approach across four dimensions:

```
┌─────────────────────────────────────────────────────────────┐
│  DIMENSION 1: Subagent Communication (PRIMARY)              │
│    Our custom comms ←→ CC native SendMessage + Mailbox      │
│                                                              │
│  DIMENSION 2: Capability Gaps                                │
│    CC features we don't use ←→ relevance to our architecture │
│                                                              │
│  DIMENSION 3: Friction Points                                │
│    Where our system fights CC's defaults                     │
│                                                              │
│  DIMENSION 4: Architectural Conflicts                        │
│    Design assumptions that clash                             │
└─────────────────────────────────────────────────────────────┘
```

### Critical Files Map

**Our System (read and understood):**
| File | Role | Key Insight |
|------|------|-------------|
| `harness-executor.ts` | Spawns CLI processes, file-based streaming | Harness-agnostic: `buildCommand()` switches on harness type |
| `streams.ts` | Parses JSON output per harness | Three handlers: Claude/Codex/Gemini, each with different event schemas |
| `prompts.ts` | Template loading, differential prompting | Templates are `.md` files with `{{PLACEHOLDER}}` substitution |
| `runner.ts` | Daemon: subscribes to Convex, dispatches jobs | Orchestrates via reactive subscriptions, env vars for job context |
| `templates/*.md` | Job prompts (plan, implement, review, pm, etc.) | Harness-agnostic by design, no CC-specific features used |
| `engineer.md` | CC agent definition with TEAMWORK protocol | ~1000 tokens of comms instructions batched with every tool call |
| `comms/send_message.py` | HTTP POST to observability server | Broadcast-to-all model, no addressed routing |
| `comms/get_unread_messages.py` | HTTP POST to fetch unread | Agent polls by name, server tracks read state |
| `.claude/settings.json` | Hook configuration | PreToolUse/PostToolUse hooks for observability + comms |

**CC Source (analyzed):**
| File | Role | Key Insight |
|------|------|-------------|
| `SendMessageTool.ts` | Native addressed messaging | Supports `to: name`, `to: *` broadcast, structured messages (shutdown, plan approval) |
| `teammateMailbox.ts` | File-based inbox per agent | JSON files at `.claude/teams/{team}/inboxes/{name}.json`, file-locked writes |
| `useInboxPoller.ts` | 1-second polling for inbox | React hook, delivers messages as XML-tagged turns when session is idle |
| `AgentTool.tsx` | Subagent spawning | Supports worktrees, background tasks, model overrides, agent definitions |
| `spawnMultiAgent.ts` | Teammate process creation | tmux panes or in-process, team file management |
| `Task.ts` | Task types and lifecycle | Types: local_bash, local_agent, remote_agent, in_process_teammate, etc. |
| `TaskCreateTool.ts` | Task coordination | Subject/description/metadata/status tracking via file system |
| `tools.ts` | Tool registry with feature flags | Conditional tool loading, deny rules, tool presets |
| `runAgent.ts` | Agent execution loop | System prompt assembly, tool pool filtering, MCP integration |

---

## Dependency Map

This is a research phase — no implementation dependencies. The report feeds future decision-making.

```
[Read Our System Files] ──┐
                           ├──▶ [Analyze & Compare] ──▶ [Write Report]
[Read CC Source Files]  ───┘
```

All reading is parallelizable. Analysis is synthesis. Report is the sole output.

---

## Work Package Breakdown

### WP-1: Deep System Read (Research)

**Scope:** Read and internalize all Critical Files from both our system and CC source.

**Success Criteria:**
- All files listed in Critical Files Map have been read
- Understanding verified by ability to describe data flows end-to-end for both systems

### WP-2: Subagent Communication Deep-Dive (PRIMARY)

**Scope:** The core analysis. Compare our custom HTTP-based broadcast comms with CC's native SendMessage + file-based mailbox system.

**Analysis Axes:**

1. **Message Routing Architecture**
   - Our model: broadcast-to-all via HTTP server → all agents see all messages
   - CC model: addressed messaging (`to: name` or `to: *`) via file-based inboxes
   - Tradeoff: our broadcast is simpler but noisier; CC's addressed routing reduces irrelevant traffic

2. **Delivery Mechanism**
   - Our model: agent explicitly calls `get_unread_messages.py` (batched with every tool call per engineer.md instructions)
   - CC model: `useInboxPoller` polls every 1s, delivers as XML-tagged turns when idle, queues when busy
   - Key difference: our polling burns a Bash tool call per check; CC's is infrastructure-level (React hook, not a tool call)

3. **Token Cost Analysis**
   - Our TEAMWORK protocol in engineer.md: ~1000 tokens of instructions
   - Every tool call batches an inbox check: `uv run get_unread_messages.py --name "X"` ≈ additional Bash tool use
   - CC native: SendMessage tool prompt is injected by the system, inbox delivery is automatic (no tool call overhead)
   - Estimate: our approach costs ~200-500 tokens per tool round (Bash call + result parsing) × N tool calls per job

4. **Structured Message Types**
   - CC supports: `shutdown_request`, `shutdown_response`, `plan_approval_response`
   - Our system: untyped string messages only
   - Relevance: shutdown/plan approval are CC-native concepts; our lifecycle is managed by Convex, not agent negotiation

5. **Read/Unread Tracking**
   - CC: per-message `read` boolean in JSON, `markMessagesAsRead()` with file locking
   - Our system: server-side tracking via HTTP endpoint
   - Both are adequate; CC's is more resilient (no server dependency)

6. **Context Overhead**
   - Our comms instructions dominate the engineer.md agent definition
   - Removing comms overhead would save ~1000 tokens of system prompt + eliminate per-tool-call Bash overhead
   - But: comms instructions are harness-agnostic — they work for Codex/Gemini agents too

**Key Finding (anticipated):** The primary optimization opportunity is NOT switching to CC's native comms (that would be CC-lock-in), but rather reducing the polling overhead. The explicit "batch inbox check with every tool call" pattern is the most expensive aspect, and it's expensive because it's implemented as a Bash tool call rather than infrastructure.

### WP-3: Capability Gap Inventory

**Scope:** Catalog CC features we don't use, assess relevance.

**Areas:**
| CC Feature | What It Does | Relevance to claude-comms |
|---|---|---|
| Agent tool filtering (`allowed_tools`) | Restricts tools available to subagents | Medium — we could reduce subagent scope but engineer.md already scopes via instructions |
| Task system (TaskCreate/Get/List/Update) | File-based task tracking with statuses | Low — our task tracking is in Convex (authoritative), CC tasks are session-scoped |
| Skills system | Composable prompt injection via slash commands | Low — our templates serve the same purpose, harness-agnostically |
| Worktree isolation | Git worktree per agent | Medium — could reduce merge conflicts in parallel impl jobs |
| Background tasks | Auto-background after 120s | Low — our runner manages lifecycle externally |
| Plan mode | Agent proposes plan, lead approves before execution | Low — our PM→job chain is the equivalent orchestration |
| Bridge/Remote | Cross-machine agent communication | Low — our Convex backend already provides cross-machine coordination |
| ToolSearch/deferred tools | Lazy-load tool schemas | Low — interesting but CC-specific optimization |
| Agent memory (memdir) | Persistent file-based memory | Low — our persistence is in Convex artifacts/decisions |

### WP-4: Friction Point Inventory

**Scope:** Where our system fights CC's defaults.

**Areas:**
1. **Context loading competition** — CC loads CLAUDE.md chain, memdir, system prompts automatically. Our templates add on top. Combined context can be large.
2. **Hook overhead** — Every tool call triggers PreToolUse/PostToolUse hooks (observability + comms registration). These are shell commands with Python startup overhead.
3. **Session resume vs fresh sessions** — CC optimizes for session continuity (context accumulation). We intentionally start fresh per assignment job. The `--resume` flag is only used for chat jobs.
4. **Subagent spawning model** — CC's Agent tool spawns subagents within the same session tree. Our runner spawns top-level `claude` processes. CC's subagent context inheritance doesn't apply.
5. **`--dangerously-skip-permissions`** — Required for unattended execution. CC's permission system (ask/allow/deny) is designed for interactive use.

### WP-5: Architectural Conflicts & Anti-Recommendations

**Scope:** What looks appealing but would be wrong.

**Anti-Recommendations (preliminary):**
1. **Don't convert templates to CC Skills** — Skills are CC-specific; templates are harness-agnostic
2. **Don't use CC's native Task system for job tracking** — Our authoritative state is Convex; CC tasks are session-scoped and ephemeral
3. **Don't adopt CC's SendMessage for inter-job communication** — Our jobs are separate processes with no shared session; SendMessage requires team context
4. **Don't remove fresh sessions for assignment jobs** — Context pollution (checkbox brain) is a real problem; PM wisdom persists in Convex, not session context
5. **Don't use CC's Agent tool instead of runner-spawned processes** — Our runner needs harness-agnostic process management; CC's Agent tool is CC-only

### WP-6: Report Authoring

**Scope:** Synthesize WP 2-5 into the final report at `docs/project/research/cc-harness-analysis.md`.

**Report Structure:**
1. Executive Summary
2. Subagent Communication Deep-Dive (native vs custom — concrete tradeoffs)
3. Capability Gap Inventory (with relevance assessment)
4. Friction Inventory (where we fight the harness)
5. Stack-Ranked Opportunity Recommendations (effort vs impact)
6. Anti-Recommendations (things that look appealing but would be wrong)

**Success Criteria:**
- Report demonstrates genuine understanding of claude-comms architecture (traces data flows, not surface-level)
- Native vs custom comms comparison includes token cost estimates
- Recommendations respect harness-agnostic principle
- Each recommendation has effort/impact assessment
- Anti-recommendations section prevents future naive suggestions

---

## Assignment-Level Success Criteria

- [ ] Report at `docs/project/research/cc-harness-analysis.md` exists and follows the specified structure
- [ ] Report demonstrates genuine understanding of claude-comms architecture (not surface-level)
- [ ] Native vs custom comms comparison is concrete with token cost estimates and tradeoff analysis
- [ ] Recommendations respect the harness-agnostic principle (no suggestions that lock us into CC)
- [ ] Each recommendation includes effort/impact assessment
- [ ] Anti-recommendations section prevents future naive suggestions
- [ ] No code changes — research and documentation ONLY

---

## Ambiguities & Open Questions

1. **Token cost precision** — Exact token counts require running a tokenizer against the actual prompts. The report will use estimates based on character counts (÷4 approximation) rather than exact BPE counts. Is this sufficient?

2. **CC version drift** — The extracted source is a snapshot. CC evolves rapidly. Should the report note which CC build/version was analyzed, for future reference?

3. **Codex/Gemini comms** — Our comms system works across harnesses. Do Codex and Gemini have native inter-agent messaging? If so, should the report cover those too, or is CC the primary focus?

4. **Phoenix-Usurp interaction** — The context renewal concept (phoenix-usurp.md) could interact with comms overhead findings. Should the report address this, or is that a separate concern?

---

## Recommended Job Sequence

```
1. [implement] — Single research job. Agent reads all Critical Files,
                  performs analysis, writes report to docs/project/research/cc-harness-analysis.md
                  
2. [review]   — Multi-harness review of report for accuracy, completeness,
                  and adherence to harness-agnostic principle

3. [pm]       — PM evaluates alignment with North Star acceptance criteria
```

**Rationale:** This is a documentation-only deliverable. A single implement job with the full file list can perform the research and write the report. Review validates accuracy. No UAT needed (no code changes).

---

## Spec Doc Path

`docs/project/phases/11-CCHarnessAnalysis/cc-harness-research-spec.md`
