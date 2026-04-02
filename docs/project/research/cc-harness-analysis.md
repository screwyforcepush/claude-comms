# Claude Code Harness Source Analysis — Opportunity Report

> **Phase:** 11-CCHarnessAnalysis
> **Date:** 2026-04-02
> **Source:** Extracted CC harness at `_research/claude-code-harness/`
> **Scope:** Research only — no code changes

---

## 1. Executive Summary

Claude Code is one of three harnesses (alongside Codex and Gemini) that claude-comms orchestrates as stateless CLI processes. This analysis examines CC's source to identify where our integration creates unnecessary friction and where CC capabilities could improve our system — without compromising our harness-agnostic, fresh-session architecture.

**The single highest-impact finding:** Our custom inter-agent comms system costs ~2,620 tokens per agent per session in overhead (970 tokens of system prompt instructions + 1,650 tokens for inbox polling across 50 tool calls). Moving inbox polling from a model-driven Bash call to an infrastructure-level PostToolUse hook (R1) immediately eliminates ~1,650 tokens of polling overhead — a harness-agnostic change requiring no CC-specific adoption. An additional ~970 tokens of system prompt instructions become recoverable via R4 after R1 is validated in production.

**Secondary findings:**
- CC's context loading imposes a non-negotiable ~10–15k token floor per job before our templates load. This is the dominant cost for short-lived jobs (plan, review) and directly interacts with the phoenix-usurp concept.
- Hook overhead adds ~8–25 seconds of cumulative wall-clock time per job from Python process spawns on every tool call.
- A silent failure bug in `send_message.py` returns success on connection errors, masking message loss.
- Of 8 CC feature areas examined (Agent internals, Tasks, Skills, Bridge, Memory, Tool Registry, Plan Mode, ToolSearch), **none warrant adoption**. Two yield transferable patterns worth noting.

**Architectural validation:** Our design choices — Convex as state authority, prompt-as-control-surface, fresh sessions per job, independent process isolation — are confirmed as sound. Every CC feature we examined is tightly coupled to CC's in-process architecture (React components, AppState, tmux panes, file-system state). Adopting any would create hard CC lock-in that breaks our multi-harness model.

---

## 2. Subagent Communication Deep-Dive

### 2.1 Architecture Comparison

| Dimension | Our System | CC Native |
|---|---|---|
| **Transport** | HTTP POST to observability server | File-based JSON inboxes (`~/.claude/teams/{team}/inboxes/{name}.json`) |
| **Routing** | Broadcast-to-all (no `to` field) | Addressed (`to: "name"`) + broadcast (`to: "*"`) |
| **Delivery** | Model-driven: agent must batch `get_unread_messages.py` with every tool call | Infrastructure-driven: `useInboxPoller` React hook polls every 1 second, delivers as XML turns |
| **Message types** | Untyped strings (unused `--type` flag exists) | Discriminated union: `shutdown_request`, `shutdown_response`, `plan_approval_response` |
| **Read tracking** | Server-side per-agent tracking | Per-message `read` boolean with file locking (`proper-lockfile`, 10 retries) |
| **Failure mode** | `send_message.py` returns `True` on connection errors (silent loss) | File lock retry with backoff; filesystem is always available |
| **Cross-harness** | Yes — HTTP works for any harness | No — deeply coupled to CC's React/AppState model |

### 2.2 Token Cost Analysis

**Our system — per agent per session:**

| Cost Component | Tokens | Notes |
|---|---|---|
| TEAMWORK block in `engineer.md` (lines 70–112) | ~545 | Comms protocol instructions |
| Inbox batching rules in Concurrent Execution (lines 46–68) | ~275 | "EVERY Operation MUST be Batched with an Inbox Check" |
| Inbox references in WORKFLOW (lines 28–42) | ~150 | Workflow-level comms mentions |
| **System prompt subtotal** | **~970** | 67% of the entire `engineer.md` |
| Per-tool-call inbox check (empty inbox) × 50 calls | ~1,650 | Bash tool invocation + result: ~33 tokens each |
| Per-broadcast send × 10 messages | ~400+ | Bash call + message content |
| **Session total** | **~3,020** | Minimum, grows with tool call count |

**CC native — per agent per session:**

| Cost Component | Tokens | Notes |
|---|---|---|
| SendMessage tool description | ~400 | Standard tool prompt, injected by infrastructure |
| TeamCreate prompt (team leads only) | ~1,075 | Includes team workflow docs |
| Per-tool-call polling | **0** | Infrastructure-level React hook, zero model involvement |
| **Session total** | **~1,475** | Just tool descriptions — no polling overhead |

**Delta: ~1,545 tokens saved per agent per session.** Over a 4-agent team: ~6,180 tokens. Over a 200-tool-call session: our inbox polling alone costs 6,600+ tokens.

The key insight: the majority of our overhead is the **per-tool-call polling** (1,650 tokens for 50 calls), not the system prompt instructions (970 tokens). This is because polling is implemented as an explicit Bash tool call that the model must remember to include with every action.

**Methodology note:** Token estimates are order-of-magnitude approximations based on line counts x ~11 tokens/line for formatted markdown. All figures should be treated as directional, not precise. Actual tokenization validation is recommended before using these estimates as implementation decision criteria.

### 2.3 The Delivery Mechanism Problem

Our comms reliability depends entirely on the model's compliance with prompt instructions:

```
EVERY Operation MUST be Batched with an Inbox Check
```

**Failure modes:**
1. Agent forgets to include inbox check (no infrastructure enforcement)
2. Agent under token pressure drops the batched call
3. After context compaction, comms instructions may be summarized away
4. Each check spawns a Python process + HTTP request (~200ms)

CC solves this at the infrastructure level — `useInboxPoller` runs as a React hook with zero model involvement. Messages queue automatically during active turns and deliver at turn boundaries.

### 2.4 Critical Bug: Silent Message Loss

`send_message.py` lines 44–54 return `True` (success) on all error paths, including `ConnectionError`:

```python
except requests.exceptions.ConnectionError:
    print(f"Error: Could not connect...", file=sys.stderr)
    return True  # Agent believes message was sent
```

Agents believe messages were delivered when the observability server is unreachable. This is a data integrity bug that should be fixed regardless of other comms changes.

### 2.5 Recommendations (Harness-Agnostic)

**R1. Move inbox polling to a PostToolUse hook** — Eliminates ~1,650 tokens of polling overhead per session per agent immediately. The hook fires on every tool call automatically via CC's hook system. Implementation: a PostToolUse hook (matching `""` for all tools) that calls `get_unread_messages.py` and returns messages as structured JSON hook output. Note: plain stdout from hook scripts is NOT injected into model context. The hook must output the required JSON format: `{"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": "<inbox messages here>"}}`. This changes implementation from a trivial shell script to one that constructs structured JSON, but effort remains Low. The model sees messages without calling any tool. An additional ~970 tokens of system prompt instructions become recoverable via R4 after R1 is validated in production. This pattern also works for Codex/Gemini if they support similar hook mechanisms.

**R2. Fix silent failure in `send_message.py`** — Return `False` on connection errors so agents know messages weren't delivered.

**R3. Add addressed messaging** — Add `--to` parameter to `send_message.py`. Server filters by recipient. Default to broadcast for backward compatibility. Reduces context noise proportional to team size.

**R4. Strip comms instructions from agent definitions** — **Depends on R1 being validated in production first.** Once inbox polling via PostToolUse hook is proven reliable over 1–2 cycles, the TEAMWORK block (545 tokens), inbox batching rules (275 tokens), and WORKFLOW inbox references (150 tokens) can be removed from `engineer.md`. The agent definition shrinks from ~1,450 to ~480 tokens, freeing space for richer engineering instructions. Phased rollout recommended: deploy R1 → monitor for 1–2 cycles → if reliable, then strip instructions via R4.

---

## 3. Capability Gap Inventory

### 3.1 Summary Table

| CC Feature | Relevance | Assessment |
|---|---|---|
| **Agent Tool Internals** (tool filtering, model overrides, worktree isolation, fork subagent) | Low | All tightly coupled to CC's in-process model. Worktree isolation is conceptually interesting for parallel impl jobs but CC-specific. |
| **Task System** (TaskCreate/Get/List/Update) | Low | File-based, session-scoped. Our Convex state is authoritative, persistent, reactive. CC tasks die with the process. |
| **Skills System** (markdown + frontmatter, MCP bridge) | Medium | Mirrors our template system. The `shell` frontmatter (pre-execution dynamic context gathering) and MCP skill bridge are notable patterns. |
| **Bridge/Remote** (long-polling to cloud sessions) | Low | Designed for interactive cloud-to-local connections. Our runner daemon already handles remote execution via Convex subscriptions. |
| **Memory System** (memdir, MEMORY.md, relevance search) | Medium | The sideQuery pattern (cheap model selects relevant context before injecting into expensive prompt) is transferable to our accumulated results if they grow large. |
| **Tool Registry & Feature Flags** | Low | We control tools via prompt templates, not registries. Feature flags hint at CC roadmap but don't affect our integration. |
| **Plan Mode** (propose → approve → execute) | Low | Our PM→job chain is a more rigorous version: separate processes, explicit job creation, structured review. |
| **ToolSearch / Deferred Tools** (lazy schema loading) | Low | Reduces prompt tokens in interactive sessions. Not relevant to our headless, single-job execution. |

### 3.2 Transferable Patterns (Worth Noting, Not Adopting)

**Pattern 1: Relevance-search for context injection** (from `memdir/findRelevantMemories.ts`)
CC uses a Sonnet sideQuery to select up to 5 relevant memory files from a larger corpus before injecting them into the main prompt. If our accumulated PM results grow large across many cycles, a similar sideQuery could select only relevant prior results for the current PM prompt — implemented as a Convex-side optimization, not a CC feature.

**Pattern 2: Git worktree isolation** (from `AgentTool.tsx`, `bridge/`)
`git worktree add` creates isolated working copies for parallel agents. Currently irrelevant (our parallel jobs are read-only reviewers), but noted for if we ever parallelize implementation jobs. Would be implemented at the runner level, not through CC.

**Pattern 3: Auto-background settling** (from `AgentTool.tsx`)
CC can auto-background agents after 120 seconds. If CC evolves to automatically spawn background work after the "result" event, our settling-timer-based completion detection (2-minute window) may need tuning.

---

## 4. Friction Inventory

### 4.1 Friction Points by Severity

#### F1. Context Loading Competition — HIGH

Every job pays ~10–15k tokens of CC overhead before our template loads:

| Component | Est. Tokens |
|---|---|
| CC system prompt (behavioral rules, environment, tool descriptions) | ~8–12k |
| CLAUDE.md chain (walked from cwd to `$HOME`) | ~400 |
| MEMORY.md (auto-memory index) | ~350 |
| **CC baseline before template** | **~10–15k** |
| Our job template (varies by type) | 400–2,600 |
| Accumulated results (PM jobs) | 5–20k+ |
| **Total before agent writes a character** | **~12–20k minimum** |

CC's context loading can be significantly reduced via the `--bare` flag, which sets `CLAUDE_CODE_SIMPLE=1` internally. `--bare` skips: hooks, LSP initialization, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery. This is an explicit tradeoff path that substantially reduces the context floor for CLI-spawned processes. However, `--bare` is incompatible with our current architecture: it disables hooks (which would prevent the R1 PostToolUse inbox hook from firing) and skips CLAUDE.md auto-discovery (our agent definitions load via this mechanism). For short-lived jobs (plan, review), `--bare` could be viable IF configuration is moved to explicit flags (`--system-prompt-file`, `--settings`, `--agents`) rather than auto-discovery — but this requires validating that those flags provide equivalent behavior.

**Phoenix-Usurp interaction:** This baseline directly affects the context renewal concept. Every fresh session starts with a non-trivial context floor. For short-lived jobs (plan at ~650 template tokens, review at ~460), CC's overhead is 15–30× the template payload.

#### F2. Hook Overhead — MEDIUM

Every tool call fires 2+ Python processes:
- **PreToolUse:** `send_event.py --event-type PreToolUse --summarize` on ALL tool calls
- **PostToolUse:** `send_event.py --event-type PostToolUse --summarize` on ALL tool calls
- Plus conditional hooks: `intercept_session_id.py`, `register_subagent.py`, `update_subagent_completion.py`

Each `uv run` + Python startup costs ~200–500ms. For a 20–50 tool call job: 40–100 process spawns, ~8–25 seconds cumulative wall-clock overhead. Hooks exit 0 to avoid blocking but process spawn cost is unavoidable.

**Mitigation opportunity:** A long-lived sidecar process (persistent Python/Node daemon) could receive events via Unix socket instead of spawning per-call. Or batch events and flush periodically.

#### F3. Fresh Sessions Discard Accumulated Value — MEDIUM

CC invests per session in: prompt cache stability (`CacheSafeParams`, `contentReplacementState`), file state cache (`readFileState`), MCP connection pools, and conversation history. Our fresh-session model discards all of this per job.

**This is intentional and correct** — clean context prevents PM bias, review contamination, and accumulated bad assumptions. The cost (2–5 seconds startup + no prompt cache hits across jobs) is the price of decision quality. Aligns with phoenix-usurp philosophy.

#### F4. Independent Process Model — MEDIUM-LOW

Our runner-spawned processes miss CC's context inheritance: file state cache, MCP connection sharing, prompt cache continuity, Perfetto tracing hierarchy. Each job re-reads files, re-establishes connections, re-pays the prompt cache cost.

**Intentionally avoided:** accumulated conversation history (context pollution), parent permission state (we use `--dangerously-skip-permissions`), tool use tracking across jobs.

#### F5–F7. Minor Friction — LOW

- **F5:** `--dangerously-skip-permissions` works correctly; CC deny rules in `settings.json` still respected.
- **F6:** `--disable-slash-commands` may leave dead instructions in CC's system prompt consuming tokens.
- **F7:** `--verbose --output-format stream-json` increases I/O for monitoring at marginal cost.

### 4.2 Architectural Conflicts

| Conflict | Our Design | CC's Assumption | Tension |
|---|---|---|---|
| **State Authority** | Convex (database, reactive subscriptions) | Filesystem (tasks, mailbox, memdir, sessions) | CC features that write to filesystem are invisible to our orchestration |
| **Session Lifecycle** | Intentional discard per job | Accumulated value (cache, state, history) | We pay startup cost repeatedly; CC invests in continuity we throw away |
| **Tool Ecosystem** | Independent processes, no shared state | Single-session context (TodoWrite, SendMessage, Worktree assume shared AppState) | CC tools that need cross-agent coordination don't work across our process boundaries |
| **Team Model** | Runner daemon coordinates via Convex | Co-resident teammates (tmux, mailbox files, team files) | If agents use TeamCreate or SendMessage, they create state the runner doesn't manage |

These conflicts are **features, not bugs**. Our architecture deliberately diverges from CC's single-session model to achieve multi-harness support, process isolation, and crash recovery.

---

## 5. Stack-Ranked Opportunity Recommendations

| Rank | Recommendation | Effort | Impact | Harness-Agnostic? |
|---|---|---|---|---|
| **1** | **Move inbox polling to PostToolUse hook** — Eliminates ~1,650 tokens of polling overhead per session per agent immediately. Hook fires automatically on every tool call; must output structured JSON (`hookSpecificOutput`) — plain stdout is not injected. No model cooperation needed. Unlocks stripping comms instructions (rank 3) after validation. | Low (add one hook entry in `settings.json`, write hook script outputting structured JSON) | **High** (saves thousands of tokens per session, guarantees delivery) | Yes — hook mechanism works for any harness with hook support |
| **2** | **Fix `send_message.py` silent failure** — Return `False` on connection errors. | Trivial (change 2 lines) | **Medium** (prevents silent message loss) | Yes |
| **3** | **Strip comms instructions from `engineer.md`** — Remove TEAMWORK block, inbox batching rules, WORKFLOW inbox references. **Depends on R1 being validated in production** (1–2 cycles). The ~970 token recovery is only safe after hook-based polling is proven reliable. | Low (edit one file) | **Medium** (recovers 970 tokens of prompt budget per agent) | Yes — agent definitions are template content |
| **4** | **Add addressed messaging** — `--to` parameter on `send_message.py`, server-side filtering. | Low (add CLI arg, server endpoint change) | **Medium** (reduces context noise proportional to team size) | Yes |
| **5** | **Investigate hook overhead reduction** — Long-lived sidecar instead of per-call Python process spawns. | Medium (architecture change for observability hooks) | **Medium** (saves ~8–25 seconds wall-clock per job) | Yes |
| **6** | **Investigate `--bare` mode for short-lived jobs** — The `--bare` flag (sets `CLAUDE_CODE_SIMPLE=1`) skips hooks, LSP, auto-memory, and CLAUDE.md auto-discovery. Could reduce CC's context floor for plan/review jobs, but requires moving config to explicit flags (`--system-prompt-file`, `--settings`) since auto-discovery is disabled. Incompatible with R1 hook approach — evaluate independently. | Medium (testing + understanding side effects, flag migration) | **Medium** (could reduce ~10–15k baseline by significant fraction) | No (CC-specific, but only affects CC harness config) |
| **7** | **Relevance-search for accumulated results** — Use a cheap model sideQuery to select relevant prior results for PM prompts. | Medium (Convex-side implementation) | **Low–Medium** (only matters when accumulated results are large) | Yes — Convex-side optimization |

---

## 6. Anti-Recommendations

Things that look appealing but would be wrong for our architecture. Each shares a common theme: CC's features are designed for interactive, single-session, co-resident agent coordination. Our system is designed for batch, multi-session, independent-process orchestration.

### AR1. Don't Convert Templates to CC Skills

**Why it looks appealing:** Our templates are already markdown files. CC skills offer discoverability, tool filtering, and MCP bridging.

**Why it's wrong:** Our templates are injected as the `-p` prompt argument (the initial user message). CC skills are loaded mid-conversation when invoked by the model. Different injection path, different variable substitution (`{{NORTH_STAR}}` vs CC's `substituteArguments()`), and skills are CC-only — breaks Codex/Gemini support.

### AR2. Don't Use CC's Task System for Job Tracking

**Why it looks appealing:** CC has built-in task creation, status tracking, and blocking relationships.

**Why it's wrong:** CC tasks are in-memory + filesystem, session-scoped, and die with the process. Our Convex state is persistent, reactive, and powers group completion flows, PM auto-insertion, and guardian evaluation. A CC task completing doesn't trigger anything in our orchestration pipeline. No orphan recovery either — if the process crashes, CC tasks vanish.

### AR3. Don't Adopt CC's SendMessage for Inter-Job Communication

**Why it looks appealing:** CC already has addressed messaging, structured types, and a working mailbox system.

**Why it's wrong:** SendMessage resolves recipients via team files and in-process teammate tasks. Our jobs are independent processes with no shared team registry. Mailbox files are node-local (ties us to single-machine). And Convex already provides inter-job communication: PM nudge, aggregated results, guardian evaluation triggers. Adding a second channel creates consistency problems.

### AR4. Don't Remove Fresh Sessions for Assignment Jobs

**Why it looks appealing:** Session resume would save startup overhead, enable prompt cache hits, and let PMs remember prior decisions.

**Why it's wrong:** A PM that remembers prior decisions is biased toward consistency over correctness. Phoenix-usurp is predicated on "agents that know when to die are more valuable than agents kept alive past their effectiveness." `--resume` is Claude-specific (breaks Codex/Gemini). Error blast radius increases — bad assumptions persist across jobs. Chat jobs already use resume correctly where continuity is the feature.

### AR5. Don't Use CC's Agent Tool as Runner Replacement

**Why it looks appealing:** CC's Agent tool offers subagent lifecycle management, context inheritance, prompt cache sharing, and progress tracking.

**Why it's wrong:** Single point of failure (orchestrator dies = all jobs die). Parent context window grows unboundedly with subagent dispatches. Agent tool only spawns CC subagents (breaks multi-harness). Our runner has crash recovery (`scanOrphans()`, `adoptOrphan()`) that in-process subagents cannot replicate.

### AR6. Don't Use CC Worktrees for Parallel Jobs

**Why it looks appealing:** Worktree isolation prevents file conflicts between parallel agents.

**Why it's wrong:** Our parallel jobs are read-only analysts (review jobs). They don't modify files. `createAgentWorktree()` is CC-specific — Codex and Gemini don't support it. Disk overhead for full working copies. Cleanup complexity for the runner.

### AR7. Don't Adopt CC's Bridge/Remote for Distribution

**Why it looks appealing:** Bridge enables horizontal scaling to remote cloud sessions.

**Why it's wrong:** Subscription-gated (requires claude.ai account + OAuth). Designed for interactive sessions, not headless batch jobs. Convex already handles distribution — multiple runner daemons subscribe to the same deployment. Bridge adds connection setup latency (JWT exchange, capacity checks) that headless jobs don't need.

---

## Appendix: Key Source References

### Our System
| File | Role |
|---|---|
| `.claude/agents/core/engineer.md` | Agent definition with TEAMWORK comms protocol |
| `.claude/hooks/comms/send_message.py` | Broadcast message sender (silent failure bug at lines 44–54) |
| `.claude/hooks/comms/get_unread_messages.py` | Inbox poller (model-driven) |
| `.claude/settings.json` | Hook configuration (PreToolUse/PostToolUse) |
| `.agents/tools/workflow/lib/harness-executor.ts` | Harness-agnostic process spawning |
| `.agents/tools/workflow/lib/streams.ts` | Harness output parsing (Claude/Codex/Gemini) |
| `.agents/tools/workflow/lib/prompts.ts` | Template loading and variable substitution |
| `.agents/tools/workflow/runner.ts` | Runner daemon (Convex subscriptions) |
| `docs/project/features/phoenix-usurp.md` | Context renewal concept |

### CC Source (at `_research/claude-code-harness/`)
| File | Role |
|---|---|
| `tools/SendMessageTool/SendMessageTool.ts` | Native addressed messaging with structured types |
| `context/mailbox.tsx` | `useInboxPoller` (1s React hook), `teammateMailbox.ts` (file-locked inboxes) |
| `tools/AgentTool/AgentTool.tsx` | Subagent spawning (worktrees, background, model overrides) |
| `tools/AgentTool/runAgent.ts` | Agent execution loop (tool filtering, context assembly, MCP init) |
| `tools/shared/spawnMultiAgent.ts` | Teammate process creation (tmux, team files) |
| `Task.ts` | Task types and lifecycle (`local_bash`, `remote_agent`, etc.) |
| `tools.ts` | Tool registry with feature flags (`FORK_SUBAGENT`, `COORDINATOR_MODE`, etc.) |
| `memdir/findRelevantMemories.ts` | Relevance-search pattern (sideQuery to Sonnet) |
| `skills/loadSkillsDir.ts` | Skill loading from markdown + frontmatter |
| `bridge/bridgeMain.ts` | Remote session management (long-polling to cloud) |
