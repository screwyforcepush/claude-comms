# WP-3: Capability Gap Inventory

**Phase:** 11-CCHarnessAnalysis
**Author:** MiraLattice (Research/Analysis)
**Date:** 2026-04-02

---

## Quick Reference Table

| # | CC Feature | What It Does | Relevance | Opportunity |
|---|-----------|--------------|-----------|-------------|
| 1 | Agent Tool Internals (tool filtering, model overrides, worktree isolation) | Subagent spawning with fine-grained tool allowlists, model selection, git worktree isolation, fork-based context sharing | **Low** | Worktree isolation pattern is conceptually interesting but CC-specific |
| 2 | Task System (TaskCreate/Get/List/Update) | File-based task tracking with status, ownership, blocking, hooks | **Low** | We already have richer Convex-based state; file-based tasks add nothing |
| 3 | Skills System | Markdown-with-frontmatter skill definitions, loaded from disk directories, invoked via SkillTool | **Medium** | The skill-as-prompt-template pattern mirrors our template system; MCP skill bridge is notable |
| 4 | Bridge/Remote Architecture | Long-polling bridge connects local CC to cloud environments for remote sessions | **Low** | Our runner daemon already handles remote execution; bridge is CC-to-cloud, not our pattern |
| 5 | Memory System (memdir) | File-based persistent memory with MEMORY.md index, per-agent scoping, relevance search via sideQuery | **Medium** | Our Convex artifacts/decisions serve similar purpose; the relevance-search pattern is worth noting |
| 6 | Tool Registry & Feature Flags | Conditional tool loading via `feature()` gates and env vars; tool deny/allow rules | **Low** | We control tool exposure via prompt templates, not tool registries |
| 7 | Plan Mode | Agent proposes plan, user approves before execution | **Low** | Our PM->job chain already handles plan-then-execute with richer orchestration |
| 8 | ToolSearch / Deferred Tools | Lazy schema loading; tools registered with `shouldDefer: true` only have full schema fetched on demand | **Low** | Interesting optimization but irrelevant to our headless, template-driven approach |

---

## Detailed Analysis

### 1. Agent Tool Internals

**What it does:**

The AgentTool (`AgentTool.tsx`, `runAgent.ts`, `forkSubagent.ts`) is the CC subagent spawning system. Key capabilities:

- **Tool filtering:** Agents receive a filtered tool pool. `ALL_AGENT_DISALLOWED_TOOLS` (in `constants/tools.ts`) strips TaskOutput, PlanMode, AskUserQuestion, and TaskStop from subagents. `ASYNC_AGENT_ALLOWED_TOOLS` defines a positive allowlist for background agents. The `allowedTools` parameter on agent definitions scopes tool permissions per-agent, and `resolveAgentTools()` applies the filtering at spawn time. Custom agents can declare `tools: ['Read', 'Grep', 'Bash']` in frontmatter.

- **Model overrides:** The `model` parameter on Agent tool input accepts `sonnet | opus | haiku`. Agent definitions can set a default model in frontmatter. Resolution chain: explicit call param > agent definition > parent model. Handled by `getAgentModel()` in `runAgent.ts:340-345`.

- **Worktree isolation:** `isolation: 'worktree'` creates a temporary git worktree via `createAgentWorktree()`, giving the subagent an isolated working copy of the repo. The child gets a `buildWorktreeNotice()` telling it to translate paths. On completion, `hasWorktreeChanges()` checks for work, and `removeAgentWorktree()` cleans up. This prevents file conflicts between parallel agents.

- **Fork subagent:** Feature-gated (`FORK_SUBAGENT`). When `subagent_type` is omitted, the child inherits the parent's full conversation context and system prompt for cache-identical API prefixes. `buildForkedMessages()` clones the parent's assistant message with placeholder tool_results, maximizing prompt cache hits across siblings. Anti-recursion guard via `isInForkChild()` message scan.

- **Background tasks:** `run_in_background: true` or agent definition `background: true` runs the agent asynchronously. Async agents get their own AbortController, auto-deny permission prompts, and communicate results via `<task-notification>` messages.

- **MCP server initialization per agent:** `initializeAgentMcpServers()` in `runAgent.ts` allows agents to declare their own MCP servers in frontmatter, additive to the parent's.

**Relevance: Low**

Our architecture spawns fresh harness processes (`HarnessExecutor.execute()`) for each job, controlled entirely by prompt templates. We don't need in-process tool filtering because each harness invocation is a clean slate with its own tool surface. Model selection is handled at the runner config level (`config.harnessDefaults`). Worktree isolation is interesting but we don't run parallel file-editing agents on the same repo simultaneously -- our job groups are sequenced by the PM.

**Opportunity:** The worktree isolation pattern could matter if we ever evolve toward parallel implementation jobs editing the same repo. Currently our `implement` jobs run one at a time within a group, so there's no conflict. If we wanted to parallelize implementation, we'd need something like worktrees -- but we'd implement it at the runner level with `git worktree add`, not through CC internals.

---

### 2. Task System (TaskCreate/Get/List/Update)

**What it does:**

CC's Task system (`TaskCreateTool.ts`, `TaskUpdateTool.ts`, `Task.ts`) is a file-based task tracker that replaces the older TodoWrite tool. Key details:

- **Task lifecycle:** Tasks have status `pending | in_progress | completed | failed | deleted` with subject, description, owner, blocking relationships (`addBlocks`, `addBlockedBy`), and arbitrary metadata.

- **File storage:** Tasks are stored as individual files in a task list directory. `createTask()`, `updateTask()`, `deleteTask()`, `listTasks()` operate on these files via `getTaskListId()`.

- **Hook integration:** `TaskCreateTool` fires `executeTaskCreatedHooks()`, `TaskUpdateTool` fires `executeTaskCompletedHooks()`. Hooks can block task creation/completion.

- **Verification nudge:** When the last task is completed and no verification task exists, `TaskUpdateTool` appends a nudge to spawn a verification agent (feature-gated on `VERIFICATION_AGENT`).

- **Team integration:** When agent swarms are enabled, tasks auto-set owner to the teammate name, and ownership changes trigger mailbox notifications.

- **Task types in Task.ts:** `TaskType` includes `local_bash`, `local_agent`, `remote_agent`, `in_process_teammate`, `local_workflow`, `monitor_mcp`, `dream`. These are CC's internal process types, not user-facing task items.

**Relevance: Low**

Our Convex backend (`assignments`, `jobGroups`, `jobs`) provides a far richer coordination layer than CC's file-based tasks. We have:
- Server-side scheduling with reactive subscriptions
- PM-driven job orchestration with group sequencing
- Accumulated results flowing between groups
- Assignment-level artifacts and decisions persistence

CC's Task system is designed for within-session coordination (a single CC instance tracking its own subtasks). Our coordination is cross-session and cross-harness -- the runner daemon, not the AI agent, owns the job lifecycle.

**Opportunity:** None. The file-based approach is strictly less capable than Convex for our use case. The verification-nudge pattern is interesting as a concept (automatic QA spawning) but we already have dedicated `review` and `uat` job types orchestrated by the PM.

---

### 3. Skills System

**What it does:**

Skills (`loadSkillsDir.ts`, `bundledSkills.ts`) are markdown files with YAML frontmatter that define reusable prompt templates invoked via the SkillTool. Key aspects:

- **Loading:** Skills are loaded from multiple directories with priority ordering: `policySettings`, `userSettings` (`~/.claude/skills/`), `projectSettings` (`.claude/skills/`), `plugin`, and `bundled` (compiled into CC binary). Each is a `.md` file with frontmatter fields: `name`, `description`, `whenToUse`, `allowedTools`, `model`, `hooks`, `paths`, `context` (`inline | fork`), `agent`, `shell`.

- **Frontmatter fields** (from `parseSkillFrontmatterFields`): `allowedTools` restricts which tools the skill can use. `model` overrides the model. `disableModelInvocation` prevents the model from auto-invoking the skill. `paths` scopes the skill to specific file patterns. `shell` allows shell commands embedded in the prompt that execute at invocation time. `effort` controls reasoning depth.

- **Bundled skills** (`bundledSkills.ts`): Registered programmatically via `registerBundledSkill()`. Each has a `getPromptForCommand()` function returning content blocks. Can include reference `files` that are extracted to a temp directory on first invocation. Skills like `simplify`, `loop`, `schedule`, `claude-api` are bundled.

- **MCP skill bridge** (`mcpSkillBuilders.ts`): MCP servers can expose skills via the skill protocol, bridging external tool servers into the skill system.

- **Invocation:** SkillTool receives the skill name, looks up the command, calls `getPromptForCommand()`, and injects the prompt content into the conversation. `context: 'fork'` runs the skill in a subagent; `context: 'inline'` injects into the current conversation.

**Relevance: Medium**

Our template system (`lib/prompts.ts` + `templates/*.md`) is architecturally similar -- markdown templates with variable substitution (`{{NORTH_STAR}}`, `{{CONTEXT}}`, etc.) loaded at job execution time. The key differences:

1. CC skills are user-extensible at runtime (drop a `.md` file in `.claude/skills/`). Our templates are developer-managed in the repo.
2. CC skills have frontmatter-driven tool filtering. We control tools via harness selection (claude vs codex vs gemini) and the prompt itself.
3. CC skills integrate with MCP servers. We don't use MCP.

**Opportunity:** The `shell` frontmatter feature (embedding executable shell commands in prompts that run before the AI sees them) is a pattern worth noting. We could hypothetically add a pre-execution phase to our templates that gathers dynamic context (e.g., `git log`, current branch, test results) before prompt injection. Currently our templates are static text with variable substitution from Convex state. The `paths` scoping is also interesting -- skills that only activate for certain file patterns.

---

### 4. Bridge/Remote Architecture

**What it does:**

The bridge system (`bridgeMain.ts`, `types.ts`, `createSession.ts`) enables `claude remote-control` -- a persistent local process that connects to Anthropic's cloud infrastructure to serve remote Claude Code sessions.

- **Architecture:** A local bridge process registers an "environment" with the Anthropic API, then long-polls for work items. When a session request arrives (from claude.ai or similar), the bridge spawns a local CC child process connected via SDK URL/JWT.

- **Spawn modes** (`SpawnMode`): `single-session` (one session, bridge tears down after), `worktree` (each session gets isolated git worktree), `same-dir` (sessions share cwd).

- **Session lifecycle:** `BridgeConfig` defines machine name, branch, git repo URL, max sessions, sandbox mode. `SessionHandle` tracks sessionId, done promise, kill/forceKill, activities, access tokens. `WorkSecret` carries session ingress tokens, API URLs, git source info, auth tokens, MCP config, and env vars.

- **Session creation** (`createSession.ts`): Creates sessions on bridge environments via `POST /v1/sessions` with git context, model selection, permission mode, and pre-populated conversation events.

- **Heartbeat/reconnect:** The bridge maintains lease heartbeats, handles token refresh, reconnects after sleep/wake cycles, and manages stale session cleanup.

**Relevance: Low**

Our runner daemon (`runner.ts`) is fundamentally different -- it's a Convex subscriber that spawns harness processes locally based on database state changes. The bridge is designed for the opposite direction: making a local machine available to cloud-initiated sessions. Our architecture is pull-based (runner subscribes to Convex, pulls jobs) vs bridge's push-based (cloud pushes sessions to local machine).

**Opportunity:** The worktree-per-session pattern appears here too (and in the Agent tool). If we ever need parallel runner instances or horizontal scaling, the bridge's multi-session management (session count tracking, spawn mode toggling) offers patterns for managing concurrent processes. But our current single-runner-daemon model works fine.

---

### 5. Memory System (memdir)

**What it does:**

The memory system (`memdir.ts`, `paths.ts`, `agentMemory.ts`, `findRelevantMemories.ts`) provides persistent, file-based memory across sessions.

- **Directory structure:** Memory lives in `~/.claude/projects/<sanitized-git-root>/memory/` by default. `MEMORY.md` is the index file (loaded into system prompt, capped at 200 lines / 25KB). Topic files contain actual memories with YAML frontmatter (type, name, description).

- **Memory types:** Four types: user preferences, feedback, project context, reference. Content derivable from code is explicitly excluded.

- **Agent memory** (`agentMemory.ts`): Separate memory scope for agents. Three levels: `user` scope (`~/.claude/agent-memory/`), `project` scope (`.claude/agent-memory/`), `local` scope (`.claude/agent-memory-local/`). Each agent type gets its own subdirectory.

- **Relevance search** (`findRelevantMemories.ts`): Uses a Sonnet sideQuery to select up to 5 relevant memory files based on query content. Scans memory file headers, formats a manifest, asks Sonnet to select the most relevant ones. Excludes recently-used tool documentation to avoid noise.

- **Auto-extraction:** Feature-gated background process (`isExtractModeActive()`) that analyzes conversation to auto-extract memories.

- **Kairos daily log:** For long-lived assistant sessions, memories are appended to date-named log files (`logs/YYYY/MM/YYYY-MM-DD.md`) instead of maintaining MEMORY.md as a live index. A nightly `/dream` skill distills logs into topic files.

- **Team memory:** Feature-gated (`TEAMMEM`) shared memory directory for team collaboration.

**Relevance: Medium**

Our Convex `artifacts` and `decisions` fields on assignments serve a similar but narrower purpose -- they capture project-level decisions and outputs that flow between PM cycles. The differences:

1. CC memory persists across sessions and projects. Our artifacts/decisions are scoped to a single assignment.
2. CC memory is AI-managed (the model decides what to save). Our artifacts/decisions are updated by the PM agent as explicit deliverables.
3. CC uses relevance search (sideQuery to Sonnet) to surface memories. We inject all artifacts/decisions directly into the PM prompt.

**Opportunity:** The relevance-search pattern (using a cheap model to select which context to inject) is genuinely useful and applicable beyond CC. If our accumulated results grow large across many PM cycles, we could use a similar sideQuery to select only the most relevant prior results for the current PM prompt, rather than injecting everything. This would be a Convex-side optimization, not a CC feature adoption.

The per-agent-type memory scoping is also interesting. If we wanted our `implement` agents to learn repo-specific patterns across assignments (e.g., "this project uses X testing framework"), agent-type-scoped memory files could help. But this would break our fresh-session principle -- each harness invocation would need to know about prior sessions, which contradicts our stateless-by-design approach.

---

### 6. Tool Registry & Feature Flags

**What it does:**

The tool registry (`tools.ts`, `Tool.ts`) conditionally assembles the tool pool at startup:

- **Feature gates:** `feature('FORK_SUBAGENT')`, `feature('COORDINATOR_MODE')`, `feature('KAIROS')`, `feature('AGENT_TRIGGERS')`, `feature('MONITOR_TOOL')`, `feature('WEB_BROWSER_TOOL')`, `feature('HISTORY_SNIP')`, `feature('UDS_INBOX')`, `feature('WORKFLOW_SCRIPTS')`, `feature('CONTEXT_COLLAPSE')`, `feature('TERMINAL_PANEL')`, `feature('OVERFLOW_TEST_TOOL')` -- these are compile-time flags from `bun:bundle` that enable dead code elimination.

- **Runtime gates:** `process.env.USER_TYPE === 'ant'` (internal Anthropic users), `isEnvTruthy(process.env.ENABLE_LSP_TOOL)`, `isWorktreeModeEnabled()`, `isAgentSwarmsEnabled()`, `isTodoV2Enabled()`, `isToolSearchEnabledOptimistic()`, `isReplModeEnabled()`.

- **Deny rules:** `filterToolsByDenyRules()` removes tools that match blanket deny rules from the permission context. This includes MCP server prefix matching (`mcp__server` strips all tools from that server).

- **Tool pool assembly:** `assembleToolPool()` combines built-in tools with MCP tools, deduplicates by name (built-ins win), and sorts for prompt-cache stability (built-ins as contiguous prefix, MCP tools sorted separately to avoid cache invalidation).

- **Simple mode:** `CLAUDE_CODE_SIMPLE` reduces tools to just Bash, Read, Edit.

- **Tool abstraction** (`Tool.ts`): Rich interface with `isEnabled()`, `isReadOnly()`, `isDestructive()`, `isConcurrencySafe()`, `shouldDefer`, `alwaysLoad`, `checkPermissions()`, `validateInput()`, `maxResultSizeChars`, `searchHint`, `interruptBehavior()`, etc.

**Relevance: Low**

We don't interact with CC's tool registry at all. Our harness processes (`claude --print`, `codex`, `gemini`) get whatever tools the harness provides by default. We control what the AI can do through prompt instructions, not tool filtering. The `--allowedTools` SDK flag and permission contexts are CC-internal concerns.

**Opportunity:** Understanding the feature flag system helps us predict which CC capabilities might appear or disappear across versions. The flags we see (`FORK_SUBAGENT`, `COORDINATOR_MODE`, `KAIROS`, `WORKFLOW_SCRIPTS`) hint at CC's roadmap directions. None directly affect our integration surface since we invoke CC as a black-box process.

---

### 7. Plan Mode

**What it does:**

Plan Mode is invoked via `EnterPlanModeTool` and exited via `ExitPlanModeV2Tool`. When active:

- The agent proposes a plan (text output describing intended changes)
- Tool permissions shift to a read-only subset (the agent cannot write files or execute destructive commands)
- The user reviews and either approves (exiting plan mode) or provides feedback
- On approval, the agent executes the plan with full tool access

The `prePlanMode` field in `ToolPermissionContext` stores the permission mode before entering plan mode, so it can be restored on exit. Plan mode is stripped from subagents (`ALL_AGENT_DISALLOWED_TOOLS` includes both Enter and Exit plan mode tools).

The `CLAUDE_CODE_VERIFY_PLAN` env var gates `VerifyPlanExecutionTool`, which checks post-execution whether the plan was followed.

**Relevance: Low**

Our PM->job chain is a more structured version of the same concept:
1. PM agent analyzes current state and decides next steps (analogous to plan proposal)
2. PM creates job groups with specific job types and contexts (analogous to plan approval)
3. Worker agents execute jobs (analogous to post-approval execution)
4. Results flow back to PM for evaluation (analogous to plan verification)

Our approach is stronger because:
- The planning and execution are separate harness invocations (cannot circumvent)
- The PM explicitly defines what work to do, not just "approve" a vague plan
- Review/UAT jobs provide structured verification, not just a post-hoc check

**Opportunity:** None. Our architecture already provides a more rigorous plan-execute-verify cycle.

---

### 8. ToolSearch / Deferred Tools

**What it does:**

ToolSearch (`ToolSearchTool` in `tools.ts`, referenced via `isToolSearchEnabledOptimistic()`) enables lazy tool schema loading:

- Tools marked with `shouldDefer: true` (e.g., `TaskCreateTool`, `TaskUpdateTool`, `NotebookEditTool`, `WebFetchTool`) are sent to the API with `defer_loading: true` -- only their name appears in the initial prompt, not their full parameter schema.

- When the model needs a deferred tool, it first calls `ToolSearch` with a query. The tool matches against deferred tools by name/keyword (using `searchHint` on each tool) and returns the full JSON schema for matched tools. The tool then becomes callable.

- This reduces initial prompt token count when there are many tools (especially with MCP tools that can add dozens of schemas).

- `alwaysLoad` flag on tools prevents deferral (tool always has full schema in initial prompt, even when ToolSearch is enabled).

- The `searchHint` field (3-10 words, no trailing period) helps the model find tools via keyword search. E.g., NotebookEditTool has `searchHint: 'jupyter'`.

**Relevance: Low**

We don't construct tool pools for our harness invocations. Each `claude --print` call gets CC's full default tool set. The ToolSearch optimization is about reducing prompt tokens in interactive sessions with many MCP tools -- a concern that doesn't apply to our headless, single-job execution model.

**Opportunity:** None for our current architecture. If we ever integrate with the CC SDK programmatically (instead of spawning CLI processes), understanding deferred tools would help us set appropriate tool configurations.

---

## Cross-Cutting Observations

### 1. Our Harness-Agnostic Principle Is Correct

Every CC feature examined is deeply coupled to CC's in-process architecture (React components, AppState, ToolUseContext, feature flags). Adopting any of these would create hard CC lock-in. Our approach of treating CC as a black-box CLI process that receives a prompt and produces output is validated by this analysis.

### 2. The Prompt-as-Control-Surface Pattern

Where CC uses tool registries, permission contexts, and feature flags to control agent behavior, we use prompt templates. This is a deliberate and sound choice:
- Templates are harness-agnostic (same template works for claude, codex, gemini)
- Templates are version-controlled and auditable
- Templates are human-readable without understanding CC internals
- Templates compose with our Convex state (variable substitution from assignment/job data)

### 3. Patterns Worth Studying (Without Adopting)

- **Relevance-search for context injection** (from memdir): Using a cheap model to select relevant prior context before injecting it into an expensive main prompt. Applicable to our accumulated results if they grow large.
- **Worktree isolation** (from AgentTool/Bridge): If we ever parallelize implementation jobs, `git worktree add` is the right primitive.
- **Settling timer pattern** (from our own HarnessExecutor, but CC has similar): Wait for sustained silence after a terminal event before declaring completion. We already implement this.

### 4. CC Features That Could Cause Issues

- **Auto-background agents** (`getAutoBackgroundMs()`, fork subagent): If CC evolves to automatically background agent tasks, our settling-timer-based completion detection could be affected. Currently we detect the result event and wait for silence. If CC starts spawning background work after the "result" event, our 2-minute settling window may need tuning.
- **Memory writes**: CC agents may write to `.claude/agent-memory/` during execution. These files persist across our harness invocations but we never read them. Not harmful, but generates filesystem debris.

---

## Summary

Of the 8 CC feature areas examined, **none warrant adoption** into claude-comms. Two receive **Medium** relevance ratings for pattern interest (Skills system's template similarities, Memory system's relevance-search approach), but both are observations about transferable concepts, not features to integrate.

Our architecture's strengths -- Convex-based state management, harness-agnostic execution, prompt-as-control-surface, fresh-session isolation -- are validated by this analysis. The complexity CC invests in in-process coordination (tool filtering, permission contexts, feature flags, fork subagents) is complexity we avoid entirely by treating each harness invocation as a stateless, single-purpose execution.
