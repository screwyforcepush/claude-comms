# WP-4 + WP-5: Friction Points, Architectural Conflicts, and Anti-Recommendations

> Phase 11 — CC Harness Analysis
> Author: KaiObsidian (Research/Analysis)
> Date: 2026-04-02

---

## Part 1 — FRICTION POINTS

Where claude-comms works against CC's grain. Each friction point includes a severity assessment.

---

### F1. Context Loading Competition

**Severity: HIGH**

CC automatically loads a context chain at session start:

1. **System prompt** — CC's base system prompt (memoized via `systemPromptSection()` in `constants/systemPromptSections.ts`). Estimated ~8-12k tokens for a full CC session including tool descriptions, behavioral rules, and environment details.
2. **CLAUDE.md chain** — Loaded via `getUserContext()` in `runAgent.ts:381`. CC walks project directories up to `$HOME`, loading `.claude/CLAUDE.md` at each level. Our `CLAUDE.md` is ~1,474 bytes (~400 tokens).
3. **Memory (MEMORY.md)** — Auto-memory from `~/.claude/projects/<sanitized-path>/memory/MEMORY.md`. Our project memory is ~1,267 bytes (~350 tokens). CC caps this at 200 lines / 25KB (`MAX_ENTRYPOINT_LINES=200`, `MAX_ENTRYPOINT_BYTES=25_000` in `memdir/memdir.ts:37-38`).
4. **Tool descriptions** — All enabled tools contribute schema/prompt text. With hooks, MCP, skills, and base tools, this is substantial.

On top of this, our runner injects the full job template via `-p` flag:

| Template | Size (bytes) | Est. tokens |
|----------|-------------|-------------|
| implement.md | 4,438 | ~1,200 |
| pm.md | 5,802 | ~1,500 |
| product-owner.md | 9,809 | ~2,600 |
| plan.md | 2,434 | ~650 |
| review.md | 1,721 | ~460 |
| document.md | 1,492 | ~400 |
| uat.md | 3,212 | ~850 |
| PM modules (total) | 5,563 | ~1,500 |

**Combined context budget per assignment job:**
- CC overhead (system prompt + tools + CLAUDE.md + MEMORY.md): ~10-15k tokens
- Our template prompt: ~650-2,600 tokens
- Accumulated results from prior groups (for PM jobs): variable, potentially 5-20k+ tokens
- **Total before the agent writes a single character: ~12-20k tokens minimum**

**Friction mechanism:** CC's context loading is not optional for CLI-spawned processes. The `--dangerously-skip-permissions` flag does not suppress system prompt or context loading. There is no `--bare` flag equivalent for our spawned harnesses. The `CLAUDE_CODE_SIMPLE` env var exists but may strip too aggressively (disables auto-memory entirely per `paths.ts:42-44`).

**Phoenix-Usurp interaction:** This is directly relevant. The phoenix-usurp concept (`docs/project/features/phoenix-usurp.md`) monitors context pressure and self-initiates renewal when a threshold is crossed. The CC-imposed baseline of ~10-15k tokens means every fresh session already starts with a non-trivial context floor. For assignment jobs that are meant to be short-lived (plan, review), this floor is a significant fraction of useful context.

---

### F2. Hook Overhead

**Severity: MEDIUM**

Every tool call triggers hooks defined in `.claude/settings.json`. The current configuration fires:

**PreToolUse (per tool call):**
1. `intercept_session_id.py` — Only on Bash calls, checks for `getCurrentSessionId.sh` pattern. Fast reject for non-matching calls (5s timeout).
2. `register_subagent.py` — Only on Agent tool calls.
3. `send_event.py --event-type PreToolUse --summarize` — On ALL tool calls (empty matcher `""`). Sends HTTP POST to observability server with 5s timeout.

**PostToolUse (per tool call):**
1. `update_subagent_completion.py` — Only on Agent tool calls.
2. `send_event.py --event-type PostToolUse --summarize` — On ALL tool calls.

**Other hooks (per session):**
- `Notification`, `Stop`, `SubagentStop`, `PreCompact`, `UserPromptSubmit` — each fires `send_event.py`.

**Overhead per tool call:** Two Python processes spawned (`uv run` + script), two HTTP POSTs. Each `uv run` has startup cost (~200-500ms for `uv` resolution + Python interpreter). With `--summarize` flag, the observability server may do additional processing.

**Quantified impact:** For a typical implement job that makes 20-50 tool calls, this adds 40-100 Python process spawns, 40-100 HTTP requests, and ~8-25 seconds of cumulative wall-clock overhead (assuming ~200ms per hook invocation, serialized per tool call by CC).

**Friction mechanism:** CC executes hooks synchronously before/after each tool use. The hook must exit before the tool call proceeds (PreToolUse) or before the next turn (PostToolUse). The `send_event.py` always exits 0 (`sys.exit(0)` at line 107) to avoid blocking, but the process spawn overhead is unavoidable.

---

### F3. Session Resume vs Fresh Sessions

**Severity: MEDIUM**

CC optimizes for session continuity through several mechanisms:

1. **Session ID tracking** — `ClaudeStreamHandler` captures `session_id` from result events (`streams.ts:89-91`). Our runner stores this for chat jobs via `saveSessionId()`.
2. **Prompt caching** — CC invests heavily in prompt cache stability (`CacheSafeParams` in `runAgent.ts:302-304`, `contentReplacementState` for re-replacing tool results). The system prompt is memoized via `systemPromptSection()` so it doesn't break caches across turns.
3. **File state cache** — Subagents either clone the parent's `readFileState` cache or create a fresh one (`runAgent.ts:375-378`). This caches file contents read during the session to avoid re-reading.

**Our approach:** Assignment jobs (plan, implement, review, pm) are always fresh sessions — no `--resume` flag is passed (`harness-executor.ts:367-369`, the `sessionId` is only set for chat jobs where `isChat && chatContext?.claudeSessionId`). This means:

- Every assignment job pays the full system prompt + context loading cost
- No prompt cache hits across job boundaries
- No accumulated file state knowledge

**Where this is correct:** Fresh sessions give clean context for each job, aligning with the single-responsibility principle. A plan job doesn't need an implement job's file cache.

**Where this creates friction:** PM jobs, which execute repeatedly in the assignment chain, must re-read artifacts and decisions each time. The PM could benefit from session continuity since it's essentially the same role resuming with new information. However, our architecture deliberately avoids this because accumulated context degrades PM decision quality (the phoenix-usurp insight).

---

### F4. Subagent Spawning Model

**Severity: MEDIUM-LOW**

CC's native Agent tool (`AgentTool.tsx`) spawns subagents within the session tree:

**What CC subagents inherit:**
- Parent's `readFileState` cache (cloned if fork, fresh if not — `runAgent.ts:375-378`)
- Parent's MCP server connections (additive — `runAgent.ts:95-218`)
- Parent's system context and user context (`runAgent.ts:380-383`)
- Parent's `toolUseContext` including permission mode, agent tracking
- CLAUDE.md (unless `omitClaudeMd` is set — `runAgent.ts:389-398`)
- Perfetto tracing hierarchy (`runAgent.ts:356-359`)

**What our runner-spawned processes get:**
- A completely independent `claude` CLI process with no inherited state
- Environment variables for job context (`WORKFLOW_ASSIGNMENT_ID`, `WORKFLOW_GROUP_ID`, `WORKFLOW_JOB_ID`)
- The full prompt passed via `-p` flag
- CC's standard context loading (CLAUDE.md, MEMORY.md, system prompt) — loaded fresh

**Context inheritance we miss:**
- File state cache from previous jobs (must re-read files)
- MCP server connection sharing
- Prompt cache continuity

**Context inheritance we intentionally avoid:**
- Accumulated conversation history (prevents context pollution between jobs)
- Parent permission state (we use `--dangerously-skip-permissions` universally)
- Tool use tracking across jobs (each job has independent metrics)

---

### F5. Permission Bypass

**Severity: LOW**

`--dangerously-skip-permissions` is used for all spawned harnesses (`streams.ts:260`). This flag:

- Bypasses all permission prompts for tool use
- Enables `getSessionBypassPermissionsMode()` in CC internals
- Required for unattended execution since no human is present to approve

**Implications from CC internals:**
- The flag is session-wide — it cannot be scoped per-tool or per-operation
- CC's permission system includes deny rules from `settings.json` (via `getDenyRuleForTool` in `tools.ts`), which are still respected even with `--dangerously-skip-permissions`
- In coordinator mode and swarm mode, permissions propagate to spawned teammates. Our bypassed sessions don't create this propagation chain.
- The flag does not suppress hooks — our `PreToolUse`/`PostToolUse` hooks still fire

**No significant friction** since we need unattended execution and the deny rules in settings.json provide guardrails.

---

### F6. Slash Command Disable

**Severity: LOW**

Our harness passes `--disable-slash-commands` (`streams.ts:264`). This prevents the spawned agent from using `/commands` or `/skills`, but the skill tools may still be available through the tool registry. CC's `SkillTool` is still in the tool pool unless explicitly filtered.

Potential minor friction: if CC's system prompt references slash commands, those instructions consume tokens for features the agent cannot use.

---

### F7. Verbose + Stream-JSON Output

**Severity: LOW**

We use `--verbose --output-format stream-json` (`streams.ts:261-263`). The `--verbose` flag increases event detail in the output stream, which we parse for metrics (tool calls, subagents, tokens). This is necessary for our monitoring but means:

- More I/O to the log file (larger files for orphan recovery)
- More JSON parsing in the LogTailer
- CC may emit events we don't consume (wasted I/O)

---

## Part 2 — ARCHITECTURAL CONFLICTS

Where design assumptions fundamentally clash.

---

### AC1. State Authority: Convex vs Filesystem

**Our model:** Convex is the authoritative state store. Job status, assignment status, group chains, chat threads, and session IDs all live in Convex. The runner daemon subscribes reactively to Convex queries and writes mutations back.

**CC's model:** CC assumes filesystem as the state authority:
- **Task system** (`Task.ts`) — Tasks are in-memory objects with filesystem output (`getTaskOutputPath(id)`, line 36). `TaskStateBase` tracks `outputFile` and `outputOffset`. Task state lives in `AppState` (in-process memory), not a database.
- **Memory/memdir** (`memdir/memdir.ts`, `paths.ts`) — MEMORY.md and topic files are filesystem artifacts. The auto-memory system reads/writes files under `~/.claude/projects/<slug>/memory/`.
- **Session storage** — `writeAgentMetadata()` writes to filesystem. Transcripts are `.jsonl` files.
- **Team files** — `readTeamFileAsync()`, `writeTeamFileAsync()` in `spawnMultiAgent.ts` use filesystem for team coordination.

**Tension points:**
1. **Job tracking:** CC's `TaskCreate`/`TaskGet`/`TaskUpdate`/`TaskList` tools write to a filesystem-based task list. Our jobs are Convex documents. If an agent uses CC's TaskCreate during a job, that task exists only locally and is lost when the process exits. This is not currently a problem because our agents don't use these tools, but it means CC features like TodoWrite are invisible to our orchestration.
2. **Session persistence:** CC writes session transcripts to `~/.claude/sessions/`. Our fresh-session model means these accumulate as orphaned files. Each assignment job creates a new session directory that is never resumed.
3. **Metrics:** CC tracks metrics internally (via `AppState`). We extract metrics from the stream output. These are parallel, non-conflicting systems, but CC's internal metrics are richer (e.g., prompt cache hit rates, token usage breakdowns).

---

### AC2. Session Lifecycle: Accumulated Value vs Intentional Discard

**What CC invests in per session:**
1. **Prompt cache** — CC carefully constructs system prompts to maximize prompt cache hits. `CacheSafeParams` (`runAgent.ts:302`) captures the exact state needed to fork a conversation with cache-preserving parameters. The `contentReplacementState` ensures tool results are re-replaced identically for cache stability.
2. **File state cache** — `readFileState` caches file contents read during the session (`runAgent.ts:375-378`). Size-limited to `READ_FILE_STATE_CACHE_SIZE`.
3. **MCP connections** — Agent-specific MCP servers are connected, tools fetched, and connections pooled (`initializeAgentMcpServers` in `runAgent.ts:95-218`).
4. **Conversation history** — Each turn adds to the conversation, building up context about what was tried, what failed, what the codebase looks like.
5. **Hook state** — Session-scoped hooks registered via frontmatter (`registerFrontmatterHooks` in `runAgent.ts:56`), cleared on session end (`clearSessionHooks`).
6. **Agent tracking** — Perfetto tracing, analytics events, subagent hierarchies.

**What we throw away per job:**
- All of the above. Every assignment job is a fresh `claude` CLI process.

**Why this is intentional:**
- PM jobs must make decisions with clean context, not biased by prior implementation attempts
- Review jobs should evaluate code independently, not colored by the implementation context
- Plan jobs should start from the north star, not from accumulated assumptions

**The cost:** Approximately 2-5 seconds of startup overhead per job (CC initialization + context loading + tool registration). For a 5-group assignment chain (plan -> review -> PM -> implement -> PM), this is ~10-25 seconds of pure overhead. Plus the loss of prompt cache savings across the chain.

---

### AC3. Tool Ecosystem: Single-Session Assumptions

**CC tools that assume single-session context:**

1. **TodoWrite / TaskCreate / TaskUpdate / TaskList** — These manage a session-scoped task list (`isTodoV2Enabled()` gate in `TaskCreateTool.ts:69`). Tasks are created with `generateTaskId()` (`Task.ts:98`) using filesystem-based output paths. Multiple independent processes would create separate task lists that don't coordinate.

2. **SendMessage** — Requires teammates to be registered in the session's team file (`readTeamFileAsync()` in `spawnMultiAgent.ts:56`). Message routing uses in-process mailboxes (`writeToMailbox` in `SendMessageTool.ts:40`) or tmux pane targeting. Our independent processes have no shared mailbox or team registry.

3. **AgentTool (subagents)** — Subagents inherit their parent's `AppState` store (`toolUseContext.setAppState`, `rootSetAppState` in `runAgent.ts:336-338`). Our processes have no shared AppState. When a spawned agent uses CC's Agent tool internally, the subagent runs correctly within that single process tree, but cannot coordinate with agents in other process trees.

4. **EnterWorktree / ExitWorktree** — Creates git worktrees for agent isolation. Works within a single session. Multiple independent processes creating worktrees would need external coordination to avoid conflicts.

5. **MonitorTool / SleepTool** — Background monitoring assumes a persistent session. Our jobs are expected to complete and exit.

6. **SkillTool** — Skills are loaded from `.claude/skills/` and `~/.claude/skills/`. Skills that reference session state (e.g., skills that call other tools) assume a single active session.

---

### AC4. Team Model: Co-Resident vs Independent

**CC's team model** (from `spawnMultiAgent.ts`):
- Teammates are spawned within a tmux session (`SWARM_SESSION_NAME`)
- Team file tracks all teammates (`readTeamFileAsync()`, `writeTeamFileAsync()`)
- Each teammate gets a named pane (`createTeammatePaneInSwarmView`)
- Communication via mailbox files (`writeToMailbox`) or in-process message queuing (`queuePendingMessage`)
- Team lead coordinates and can send/receive from all teammates
- Backend detection: tmux panes, in-process runners, or remote CCR instances (`BackendType` in `swarm/backends/types.ts`)
- Model inheritance: teammates default to leader's model or configured fallback (`resolveTeammateModel`)

**Our model:**
- The runner daemon is the orchestrator, not a CC session
- Each job is an independent CLI process with no awareness of other running jobs
- Jobs within a group run in parallel but cannot communicate
- Inter-job communication happens only through Convex (aggregated results, PM decisions)
- No tmux, no team file, no mailbox

**Where this conflicts:**
- If an agent within a job tries to spawn a teammate (via TeamCreate), it would create a tmux session that the runner doesn't know about
- CC's coordinator mode (`coordinatorMode.ts`) assumes a single leader session. Our runner is not a CC session.
- The `ListPeers` tool (behind `UDS_INBOX` feature flag) discovers peers via Unix domain sockets. Our independent processes have no UDS coordination.

---

## Part 3 — ANTI-RECOMMENDATIONS

Things that look appealing but would be wrong for our architecture.

---

### AR1. Don't Convert Templates to CC Skills

**What it is:** CC's skill system (`skills/loadSkillsDir.ts`) loads markdown files from `.claude/skills/` with frontmatter metadata. Skills are invoked via the SkillTool and get their content injected into the conversation.

**Why it looks appealing:** Our templates (`templates/*.md`) are already markdown files with metadata-like sections. Converting them to CC skills would integrate them into CC's native tool ecosystem, make them discoverable via ToolSearch, and potentially benefit from CC's skill caching.

**Why it's wrong:**
1. **Prompt injection path differs.** Our templates are injected as the `-p` prompt argument — the initial user message. CC skills are loaded as additional context when invoked by the model during execution. We need the template to be the first thing the agent sees, not something it discovers mid-task.
2. **Variable substitution.** Our templates use `{{NORTH_STAR}}`, `{{CONTEXT}}`, `{{PREVIOUS_RESULT}}` etc. (`prompts.ts:295-304`). CC skills use a different argument substitution system (`substituteArguments()` in `loadSkillsDir.ts:26`). We would need to rework our entire prompt-building pipeline.
3. **Harness agnosticism.** Our templates work with Claude, Codex, and Gemini. CC skills are CC-only. Converting to skills would break our multi-harness architecture.
4. **Token budget.** Skills are loaded lazily on invocation, but their frontmatter (name, description, whenToUse) is included in the system prompt for ToolSearch discovery. This adds to the baseline context overhead (F1).

---

### AR2. Don't Use CC's Native Task System for Job Tracking

**What it is:** CC's task system (`Task.ts`, `TaskCreateTool.ts`, etc.) provides in-session task creation, tracking, and querying. Tasks have IDs, statuses, descriptions, and filesystem-based output.

**Why it looks appealing:** We already have a job tracking concept. Using CC's native task system would give agents a built-in way to track sub-goals, report progress, and coordinate.

**Why it's wrong:**
1. **State authority conflict (AC1).** CC tasks live in `AppState` (in-memory) with filesystem output. Our authoritative state is Convex. A CC task completing doesn't trigger our group completion flow, PM auto-insertion, or guardian evaluation.
2. **Session-scoped.** CC tasks die with the process. Our jobs persist across process boundaries — a job can be started, the runner can crash, and on restart the orphan reconciliation system (`finalizeDeadOrphan` in `harness-executor.ts:615-690`) replays events and recovers state. CC tasks have no such resilience.
3. **No reactive subscriptions.** Our runner uses Convex's reactive `watch()` to detect state changes. CC tasks use in-process `setAppState` callbacks. There's no bridge between these models.

---

### AR3. Don't Adopt CC's SendMessage for Inter-Job Communication

**What it is:** CC's `SendMessageTool` (`SendMessageTool.ts`) sends messages between teammates via mailbox files or in-process message queues. Supports addressed routing (`to: "name"`), broadcast (`to: "*"`), structured messages (shutdown requests, plan approvals).

**Why it looks appealing:** Inter-job communication is a real need. When a review agent finds a critical issue, it would be useful to alert the PM immediately rather than waiting for group completion. CC already has a working message-passing system.

**Why it's wrong:**
1. **Co-residency assumption (AC4).** SendMessage resolves recipients via the team file (`readTeamFileAsync()`), in-process teammate tasks (`findTeammateTaskByAgentId()`), or tmux panes. Our jobs are independent processes with none of these coordination layers.
2. **Mailbox files are node-local.** `writeToMailbox()` writes to a filesystem path. Our runner and jobs are on the same machine today, but this ties us to single-node execution permanently.
3. **Convex already solves this.** Our PM nudge system (`assignment.pmNudge`), guardian evaluation triggers, and aggregated results already provide structured inter-job communication through Convex. Adding a second communication channel would create consistency problems.
4. **Message timing.** SendMessage delivers to running recipients. Our jobs may not overlap temporally (sequential groups). A message sent during a review job would need to be stored for the next PM job — which is exactly what Convex aggregated results already do.

---

### AR4. Don't Remove Fresh Sessions for Assignment Jobs

**What it is:** Switching from fresh `claude` CLI processes per job to session-resume (`--resume <sessionId>`) across the assignment chain, preserving context and prompt cache.

**Why it looks appealing:** The startup overhead is real (F3). Prompt cache savings could be significant. The PM could benefit from remembering prior decisions without re-reading them from the template.

**Why it's wrong:**
1. **Context pollution is the primary risk.** A PM that remembers its prior decision is biased toward consistency rather than correctness. Fresh sessions force the PM to evaluate based on current evidence, not memory.
2. **Phoenix-Usurp exists for this reason.** The entire phoenix-usurp concept (`docs/project/features/phoenix-usurp.md`) is predicated on the principle that "agents that know when to die are more valuable than agents kept alive past their effectiveness." Resuming sessions is the opposite of this philosophy.
3. **Harness agnosticism breaks.** `--resume` is Claude-specific. Codex and Gemini have no equivalent. Adopting resume would create Claude-specific codepaths in the runner.
4. **Error blast radius increases.** If a session accumulates a bad assumption (e.g., incorrect file path), it persists across all subsequent jobs. Fresh sessions bound the blast radius to a single job.
5. **Chat jobs already use resume correctly.** The runner does use `--resume` for chat jobs (`harness-executor.ts:367-369`) where session continuity is the feature (ongoing conversation with the user). Assignment jobs are a fundamentally different use case.

---

### AR5. Don't Use CC's Agent Tool Instead of Runner-Spawned Processes

**What it is:** Instead of the runner spawning independent `claude` CLI processes, have a single long-lived CC session that uses the Agent tool to dispatch sub-tasks.

**Why it looks appealing:** This would give us CC's native subagent lifecycle management, context inheritance, prompt cache sharing, and the Agent tool's progress tracking (`emitTaskProgress`, `updateAsyncAgentProgress` in `agentToolUtils.js`).

**Why it's wrong:**
1. **Single point of failure.** If the orchestrator session dies, all in-flight jobs die with it. Our current model has process-level isolation — the runner can crash and recover (`scanOrphans()`, `adoptOrphan()` in `harness-executor.ts:589-900`).
2. **Context window of the orchestrator.** The parent session's context grows with every subagent dispatch and result. For long assignment chains, the orchestrator would hit context limits and need compaction, which loses subagent coordination context.
3. **Harness lock-in.** The Agent tool only spawns CC subagents. Our architecture dispatches to Claude, Codex, and Gemini (`createStreamHandler()` in `streams.ts:232-243`). Review jobs fan out to all three.
4. **Concurrency model mismatch.** CC's Agent tool supports background tasks (`run_in_background` parameter), but the parent session's token budget still pays for the system prompt and tool descriptions for each concurrent subagent. Our independent processes have their own token budgets.
5. **Permission propagation.** Agent tool subagents inherit the parent's permission mode and tool restrictions (`permissionMode` in `runAgent.ts:333`). Our jobs need `--dangerously-skip-permissions` universally, which is cleaner as a CLI flag than as inherited permission state.

---

### AR6. Don't Use CC's Worktree Isolation for Parallel Jobs

**What it is:** CC's `EnterWorktreeTool` creates git worktrees for agent isolation. Parallel review jobs (Claude + Codex + Gemini) could each get a worktree.

**Why it looks appealing:** Parallel jobs that modify files could step on each other. Worktree isolation prevents conflicts.

**Why it's wrong:**
1. **Our parallel jobs are read-only analysts.** Review jobs, which are our primary parallel pattern, read code and produce text reports. They don't modify files. Plan jobs are also read-heavy.
2. **Codex and Gemini don't support CC worktrees.** The worktree mechanism is CC-specific (`createAgentWorktree()` in `runAgent.ts`). Our multi-harness parallel pattern would break.
3. **Disk overhead.** Each worktree is a full copy of the working tree. For large repos, spawning 3 worktrees for a review group wastes significant disk.
4. **Cleanup complexity.** Orphan recovery would need to clean up abandoned worktrees. The runner already handles PID-level cleanup; adding worktree cleanup adds another failure mode.

---

### AR7. Don't Adopt CC's Bridge/Remote for Distribution

**What it is:** CC's bridge system (`bridge/bridgeMain.ts`, `bridgeEnabled.ts`) enables Remote Control — connecting local CC sessions to claude.ai or CCR (Claude Code Remote). Sessions can be spawned on remote infrastructure.

**Why it looks appealing:** Distributing jobs to remote CCR instances would enable horizontal scaling beyond the local machine. The `isolation: "remote"` option in the Agent tool already supports this.

**Why it's wrong:**
1. **Subscription-gated.** Bridge mode requires a claude.ai subscription and OAuth token (`isBridgeEnabled()` in `bridgeEnabled.ts:28-36`). This adds an authentication dependency to our system.
2. **Designed for interactive sessions.** The bridge connects a local terminal to a remote session. Our jobs are headless batch processes. The bridge's polling, JWT refresh, capacity wake, and session spawning are all designed for interactive use.
3. **Convex already handles distribution.** If we need to scale, multiple runner daemons can subscribe to the same Convex deployment. Each runner picks up ready jobs independently. This is simpler than adopting the bridge infrastructure.
4. **Latency.** Bridge sessions have connection setup overhead (JWT exchange, polling config, capacity checks). Our jobs need to start as fast as possible.

---

## Summary Matrix

| ID | Category | Severity | Summary |
|----|----------|----------|---------|
| F1 | Friction | HIGH | Context loading competition: ~10-15k token baseline per job from CC overhead |
| F2 | Friction | MEDIUM | Hook overhead: 2 Python processes per tool call, ~8-25s cumulative per job |
| F3 | Friction | MEDIUM | Fresh sessions discard prompt cache and file state investments |
| F4 | Friction | MED-LOW | Independent processes miss context inheritance (file cache, MCP pooling) |
| F5 | Friction | LOW | Permission bypass works correctly, no significant friction |
| F6 | Friction | LOW | Slash command disable may leave dead instructions in system prompt |
| F7 | Friction | LOW | Verbose output increases I/O for monitoring at marginal cost |
| AC1 | Conflict | — | State authority: Convex vs filesystem (task system, session storage) |
| AC2 | Conflict | — | Session lifecycle: CC invests in caches/state we intentionally discard |
| AC3 | Conflict | — | Tool ecosystem: Task, SendMessage, Worktree assume single session |
| AC4 | Conflict | — | Team model: co-resident teammates vs independent processes |
| AR1 | Anti-Rec | — | Don't convert templates to CC Skills (wrong injection path, breaks multi-harness) |
| AR2 | Anti-Rec | — | Don't use CC Task system (wrong state authority, session-scoped) |
| AR3 | Anti-Rec | — | Don't use SendMessage (co-residency assumption, Convex already solves this) |
| AR4 | Anti-Rec | — | Don't resume sessions for assignment jobs (context pollution, phoenix-usurp) |
| AR5 | Anti-Rec | — | Don't use Agent tool as orchestrator (SPOF, harness lock-in, no recovery) |
| AR6 | Anti-Rec | — | Don't use worktrees for parallel jobs (read-only pattern, multi-harness) |
| AR7 | Anti-Rec | — | Don't use Bridge/Remote for distribution (subscription-gated, interactive design) |

---

## Key Findings

1. **The highest-impact friction point is context loading competition (F1).** Every job pays ~10-15k tokens of CC overhead before our template content. Investigating `CLAUDE_CODE_SIMPLE` or a lighter startup mode could yield significant savings, but must be weighed against losing auto-memory and other features.

2. **Hook overhead (F2) is the most actionable friction.** The `send_event.py` hook fires on every tool call. Batching events, switching to a non-blocking fire-and-forget mechanism, or implementing a long-lived sidecar process instead of per-call Python spawns would reduce overhead.

3. **Our fresh-session model (F3) is philosophically correct but expensive.** The tradeoff is intentional and aligns with phoenix-usurp principles. The cost is real but the alternative (context pollution) is worse for our use case.

4. **The architectural conflicts (AC1-AC4) are all features, not bugs.** Our Convex-centric, process-isolated, multi-harness model is deliberately different from CC's single-session, filesystem-centric, teammate model. These conflicts only become problems if someone tries to adopt CC's native features without understanding the architectural reasoning.

5. **All 7 anti-recommendations share a common theme:** CC's features are designed for interactive, single-session, co-resident agent coordination. Our system is designed for batch, multi-session, independent-process orchestration. Adopting CC's features would require either abandoning our architecture or building complex bridges that create more problems than they solve.
