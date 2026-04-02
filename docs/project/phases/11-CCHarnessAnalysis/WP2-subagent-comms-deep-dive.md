# WP-2: Subagent Communication Deep-Dive

**Author**: SilasVortex (Research/Analysis)
**Phase**: 11-CCHarnessAnalysis
**Date**: 2026-04-02

---

## Executive Summary

Claude Code's native multi-agent comms (SendMessage + file-based mailboxes + useInboxPoller) is a mature, infrastructure-level system that eliminates the per-agent prompt overhead our custom HTTP system requires. Our system costs approximately **1,100 tokens per agent** in system prompt instructions alone, plus **~50-80 tokens per tool call** for inbox check commands. CC's native system injects zero prompt-level comms instructions -- it is all handled by tool descriptions and infrastructure hooks. However, CC's system is tightly coupled to its own process model (tmux panes, in-process teammates, React state), making it unsuitable as a direct replacement given the harness-agnostic principle.

---

## Axis 1: Message Routing Architecture

### Our System: Broadcast-to-All via HTTP Server

**Architecture**: Centralized HTTP server with broadcast semantics.

- `send_message.py` POSTs to `{server}/subagents/message` with `{sender, message}` -- every message is a broadcast visible to all agents.
- `get_unread_messages.py` POSTs to `{server}/subagents/unread` with `{subagent_name}` -- server tracks read/unread per-agent.
- No addressing: there is no `to` field. Every message goes to every agent.

```python
# send_message.py line 31-36
response = requests.post(
    f'{get_server_url()}/subagents/message',
    json={
        'sender': sender_name,
        'message': message
    },
    timeout=5
)
```

**Implication**: An agent working on frontend sees backend agents' messages about database schemas. In a 4-agent team, each agent processes 3x the messages it needs. This creates noise in the context window and wastes tokens on irrelevant information.

### CC's System: Addressed Messaging via File-Based Inboxes

**Architecture**: Per-agent JSON inbox files with explicit addressing.

- SendMessageTool accepts `{to: "name" | "*", message: string, summary: string}`.
- Directed messages (`to: "researcher"`) write only to that agent's inbox file at `~/.claude/teams/{team}/inboxes/{name}.json`.
- Broadcast (`to: "*"`) iterates team members and writes to each inbox individually, excluding sender.
- Messages include sender color, summary, and timestamp metadata.

```typescript
// SendMessageTool.ts line 161-168 (handleMessage)
await writeToMailbox(
  recipientName,
  {
    from: senderName,
    text: content,
    summary,
    timestamp: new Date().toISOString(),
    color: senderColor,
  },
  teamName,
)
```

**Tradeoffs**:
| Dimension | Our System | CC Native |
|---|---|---|
| Addressing | Broadcast-only | Directed + broadcast |
| Noise per agent | O(team_size) messages | O(relevant) messages |
| Server dependency | HTTP server must be running | Filesystem only |
| Cross-harness | Works for any harness | CC-only |

**Recommendation**: Adopt addressed messaging semantics (`--to` flag) in our HTTP system. This is harness-agnostic -- the server simply filters messages by recipient. Broadcast remains the default for backward compatibility, but directed messages reduce context noise proportional to team size.

---

## Axis 2: Delivery Mechanism

### Our System: Explicit Polling via Bash Tool Calls

Every agent is instructed to batch an inbox check with **every** tool call:

```bash
uv run .claude/hooks/comms/get_unread_messages.py --name "YourAgentName"
```

This is a **model-driven** polling pattern -- the LLM must remember to include this Bash call in every batch. The system relies on prompt engineering in `engineer.md`:

```
EVERY Operation MUST be Batched with an Inbox Check
```

**Failure modes**:
1. Agent forgets to include inbox check (no infrastructure enforcement).
2. Agent under token pressure drops the batched call.
3. After context compaction, the comms instructions may be summarized away.
4. Each inbox check is a full Bash tool invocation: spawn Python, HTTP request, parse response.

### CC's System: Infrastructure-Level 1-Second Polling

`useInboxPoller` is a React hook running at 1-second intervals in the REPL process:

```typescript
// useInboxPoller.ts line 107
const INBOX_POLL_INTERVAL_MS = 1000
```

Key characteristics:
- **Zero model involvement**: The model never calls a polling tool. Messages arrive as XML turns injected into the conversation.
- **Idle delivery**: When the agent is idle (between turns), messages submit immediately as new turns via `onSubmitTeammateMessage`.
- **Busy queuing**: When the agent is mid-turn, messages queue in `AppState.inbox` and deliver when the turn ends.
- **Message format**: Delivered as `<teammate_message teammate_id="name" color="blue" summary="...">\n{content}\n</teammate_message>`.
- **Rich message classification**: The poller classifies messages into 10+ categories (permission requests, shutdown requests, plan approvals, mode changes, sandbox requests) and handles each with specialized logic before passing regular messages to the model.

**Tradeoffs**:
| Dimension | Our System | CC Native |
|---|---|---|
| Polling reliability | Model-dependent (can forget) | Infrastructure-guaranteed |
| Latency | Variable (tool-call cadence) | Fixed 1-second |
| Token cost per poll | ~50-80 tokens (Bash call + result) | 0 tokens (no model involvement) |
| Mid-turn delivery | Only when model batches check | Queues automatically, delivers at turn boundary |
| Harness coupling | None | Deep CC React integration |

**Recommendation**: The delivery mechanism is the single highest-impact difference. Even within a harness-agnostic design, we should move inbox polling to a hook (PreToolUse or PostToolUse) rather than relying on the model. Claude Code's `settings.json` hooks already fire on every tool use -- a PostToolUse hook that checks the inbox and injects results as hook output would be transparent to the model and work across harnesses. This would eliminate the ~50-80 token per-call overhead and guarantee delivery without model cooperation.

---

## Axis 3: Token Cost Analysis

### Our System: Prompt Overhead

The TEAMWORK section in `engineer.md` (lines 70-112) contains the comms protocol instructions. Character count:

```
[TEAMWORK] section: lines 70-112 = ~43 lines of instruction text
```

Measured character counts:
- **TEAMWORK block** (lines 70-112): approximately 2,180 characters = **~545 tokens**
- **Concurrent Execution Rules referencing inbox** (lines 46-68): approximately 1,100 characters = **~275 tokens**
- **WORKFLOW section referencing inbox** (lines 28-42): approximately 600 characters = **~150 tokens**
- **Total comms-related prompt overhead**: ~3,880 characters = **~970 tokens per agent**

Per-tool-call overhead (inbox check):
- Bash tool call structure: `{"tool": "Bash", "command": "uv run .claude/hooks/comms/get_unread_messages.py --name \"AgentName\""}` = ~110 characters = **~28 tokens** (request)
- Typical empty response: `"No unread messages"` = ~20 characters = **~5 tokens**
- Typical response with 1 message: `"Found 1 unread message(s):\n--\nFrom: ...\nTime: ...\nMessage: ..."` = ~200-500 characters = **~50-125 tokens**
- **Per-tool-call cost (empty inbox)**: ~33 tokens
- **Per-tool-call cost (1 message)**: ~53-153 tokens

Per-tool-call overhead (broadcast):
- Bash tool call: `{"tool": "Bash", "command": "uv run .claude/hooks/comms/send_message.py --sender \"AgentName\" --message \"...\"}` = ~130 + message chars
- Response: `"Message sent successfully"` = ~26 characters = **~7 tokens**
- **Per-broadcast cost**: ~40 tokens + message content tokens

**Estimated total for a 50-tool-call session per agent**:
- System prompt: 970 tokens (one-time, but survives compaction as system prompt)
- Inbox checks: 50 x 33 = 1,650 tokens (assuming mostly empty)
- Broadcasts (assume 10): 10 x 40 = 400 tokens + content
- **Total overhead per agent session: ~3,020 tokens minimum**

### CC's System: Prompt Overhead

CC injects comms capability through:

1. **SendMessage tool description** (`prompt.ts`): ~1,600 characters = **~400 tokens** (injected as tool prompt, standard for any tool)
2. **TeamCreate prompt** (`TeamCreateTool/prompt.ts`): ~4,300 characters = **~1,075 tokens** (includes team workflow, task coordination, idle state docs)
3. **No per-call inbox instructions**: 0 tokens -- polling is infrastructure
4. **Message delivery**: Messages arrive as XML user turns, cost is proportional to message content only

**Per-tool-call cost**: 0 additional tokens for comms infrastructure.

**Estimated total for equivalent session**:
- Tool prompts: ~1,475 tokens (SendMessage + TeamCreate, but these are standard tool docs, not extra prompt overhead)
- Inbox checks: 0 tokens
- Message sends: ~35 tokens per SendMessage tool call (tool invocation JSON)
- **Total comms overhead per agent session: ~1,475 tokens** (just tool descriptions, no polling overhead)

### Comparative Summary

| Cost Category | Our System | CC Native | Delta |
|---|---|---|---|
| System prompt comms instructions | ~970 tokens | 0 (handled by tool prompts) | -970 tokens |
| Tool descriptions (inherent) | 0 (inline in prompt) | ~1,475 tokens | +1,475 tokens |
| Per inbox check (x50) | 1,650 tokens | 0 tokens | -1,650 tokens |
| Per broadcast (x10) | 400+ tokens | 350 tokens | -50 tokens |
| **Total session overhead** | **~3,020 tokens** | **~1,475 tokens** | **-1,545 tokens** |

The real savings are in the per-call overhead. Over a long session with 200+ tool calls, our system burns 6,600+ tokens just on empty inbox checks.

---

## Axis 4: Structured Message Types

### Our System: Untyped Strings

`send_message.py` accepts `--message` as a free-form string and optional `--type` flag:

```python
# send_message.py lines 66-76
if args.type:
    message = {
        'type': args.type,
        'content': args.message
    }
```

In practice, `--type` is never used in the engineer.md instructions. All messages are untyped strings. There is no schema validation, no structured lifecycle management.

### CC's System: Discriminated Union with Lifecycle Types

CC defines a `StructuredMessage` Zod schema with three variants:

```typescript
// SendMessageTool.ts lines 47-65
z.discriminatedUnion('type', [
  z.object({ type: z.literal('shutdown_request'), reason: z.string().optional() }),
  z.object({ type: z.literal('shutdown_response'), request_id: z.string(), approve: semanticBoolean(), reason: z.string().optional() }),
  z.object({ type: z.literal('plan_approval_response'), request_id: z.string(), approve: semanticBoolean(), feedback: z.string().optional() }),
])
```

The `useInboxPoller` further classifies messages into 10+ types: `permissionRequest`, `permissionResponse`, `sandboxPermissionRequest/Response`, `shutdownRequest`, `shutdownApproved`, `teamPermissionUpdate`, `modeSetRequest`, `planApprovalRequest/Response`, and regular messages.

### Relevance to Our Architecture

Our lifecycle management is handled by Convex, not by agent-to-agent messaging:
- **Agent spawning/completion**: Managed by `harness-executor.ts` callbacks (`onComplete`, `onFail`, `onTimeout`).
- **Shutdown**: Handled by process signals (SIGTERM/SIGKILL) from the executor, not by cooperative messaging.
- **Plan approval**: Not applicable -- our agents don't have a "plan mode".

**Assessment**: CC's structured types solve problems we don't have because our orchestration layer (Convex + harness-executor) handles lifecycle externally. The `shutdown_request`/`shutdown_response` dance is necessary in CC because teammates are autonomous processes that must cooperate for graceful shutdown. In our system, the runner simply kills the process.

**Recommendation**: No action needed. Our Convex-managed lifecycle is superior for our use case because it provides centralized, authoritative control. If we ever need structured inter-agent protocols (e.g., "I need file X, please don't touch it"), we should define them in our HTTP server, not replicate CC's approach.

---

## Axis 5: Read/Unread Tracking

### Our System: Server-Side HTTP Tracking

Read/unread state is managed entirely on the observability server:
- `get_unread_messages.py` calls `POST /subagents/unread` with `{subagent_name}`.
- The server marks messages as read upon retrieval.
- No file locking needed -- single HTTP server handles concurrency.
- Failure mode: if the server is down, `get_unread_messages.py` silently returns `[]` (lines 37-45).

```python
# get_unread_messages.py lines 37-44
except requests.exceptions.ConnectionError:
    print(f"Error: Could not connect...", file=sys.stderr)
    return []
```

**Critical observation**: Error handling in `send_message.py` returns `True` (success) even on failure (lines 44-54). This means the agent thinks messages were sent even when the server is unreachable. Silent message loss.

### CC's System: Per-Message JSON with File Locking

Each inbox is a JSON array in `~/.claude/teams/{team}/inboxes/{name}.json`:
- Each message has a `read: boolean` field.
- Writing uses `proper-lockfile` with retry/backoff:
  ```typescript
  // teammateMailbox.ts lines 35-41
  const LOCK_OPTIONS = {
    retries: { retries: 10, minTimeout: 5, maxTimeout: 100 },
  }
  ```
- `writeToMailbox` acquires a file lock, reads the array, appends, writes back.
- `markMessagesAsRead` acquires the same lock, sets `read: true` on all unread messages.
- **Atomicity**: File locking prevents concurrent write corruption when multiple agents message the same recipient.

**Tradeoffs**:
| Dimension | Our System | CC Native |
|---|---|---|
| Concurrency control | HTTP server (single process) | File locking (multi-process) |
| Server dependency | Server must be running | Filesystem only |
| Failure behavior | Silent message loss (returns True on error) | Lock retry with backoff |
| Scalability | Centralized bottleneck | Per-recipient files |

**Recommendation**: Fix the silent failure bug in `send_message.py` -- it should not return `True` on connection errors. The HTTP-based tracking is actually cleaner than file locking for our use case since we already have the observability server. The server-side approach avoids the complexity of file locks across multiple processes.

---

## Axis 6: Context Overhead

### Quantifying Our Prompt Burden

The comms instructions in `engineer.md` represent a significant fraction of the agent's system prompt. Measuring the full file:

- Total `engineer.md`: approximately 5,800 characters = **~1,450 tokens**
- Comms-related content (TEAMWORK block + inbox references in WORKFLOW + Concurrent Execution Rules): ~3,880 characters = **~970 tokens**
- **Comms instructions are ~67% of the engineer.md system prompt**

This means two-thirds of our agent definition is devoted to telling the model how to communicate. The actual engineering instructions (TDD methodology, response format, quality metrics) occupy only ~33%.

### What CC Does Differently

CC's comms are invisible at the agent definition level:
- Agent definitions (`.claude/agents/*.md`) contain zero comms instructions.
- The SendMessage tool prompt (~400 tokens) is injected by infrastructure alongside other tool prompts.
- The useInboxPoller delivers messages as conversation turns -- no instructions needed.
- TeamCreate prompt (~1,075 tokens) covers team workflow but this is injected only for team leads, not every agent.

### Savings If Comms Were Infrastructure-Level

If we moved comms to infrastructure (hooks + server-side delivery):

| Component | Current Cost | Post-Migration Cost | Savings |
|---|---|---|---|
| TEAMWORK block in engineer.md | 545 tokens | 0 tokens | 545 tokens |
| Inbox check references in WORKFLOW | 150 tokens | 0 tokens | 150 tokens |
| Concurrent Execution inbox batching | 275 tokens | 0 tokens | 275 tokens |
| Per-call inbox check (50 calls) | 1,650 tokens | 0 tokens | 1,650 tokens |
| **Total per agent** | **2,620 tokens** | **0 tokens** | **2,620 tokens** |

For a 4-agent team over a full session: **~10,480 tokens saved** in comms overhead alone.

The engineer.md system prompt would shrink from ~1,450 tokens to ~480 tokens, allowing the reclaimed space for richer engineering instructions or additional context.

**Recommendation**: Migrate inbox polling to a PostToolUse hook that runs automatically. This is the single highest-ROI change:
1. Remove all comms instructions from agent definitions.
2. Implement a PostToolUse hook that checks the inbox and returns messages as hook output.
3. Keep SendMessage as an explicit tool call (the model needs to decide when/what to communicate).
4. The ~970 tokens of prompt overhead and ~33 tokens per tool call disappear entirely.

---

## Consolidated Recommendations

### High Priority (Immediate ROI, Harness-Agnostic)

1. **Move inbox polling to PostToolUse hook**: Eliminates ~2,620 tokens/session/agent overhead. The hook fires on every tool use automatically -- no model cooperation needed. Implementation: a PostToolUse hook that calls `get_unread_messages.py` and returns output if messages exist.

2. **Fix silent failure in send_message.py**: Lines 44-54 return `True` on all errors. The agent believes messages were sent when the server is unreachable. This is a data integrity bug.

3. **Add addressed messaging**: Add `--to` parameter to `send_message.py`. Default to broadcast for backward compatibility. The server filters by recipient. This is a simple HTTP API change.

### Medium Priority (Architectural Improvement)

4. **Strip comms instructions from agent definitions**: Once inbox polling is in hooks, the TEAMWORK block, inbox batching rules, and WORKFLOW inbox references can be removed entirely from engineer.md. Agent definitions should focus on the agent's actual role.

5. **Inject comms as a tool description**: If agents need to know how to send messages, provide it as a tool prompt (like CC's SendMessage prompt) rather than embedding it in the agent system prompt. This separates concerns.

### Low Priority (Future Consideration)

6. **Structured message types**: Only implement if we identify concrete inter-agent protocol needs beyond lifecycle management (which Convex handles). CC's types are solutions to CC-specific problems (tmux pane management, plan mode, permission delegation).

7. **File-based fallback**: Consider a filesystem-based messaging fallback for environments where the HTTP server is unavailable. This would provide CC-like resilience without CC coupling.

---

## Key Insight: The Abstraction Boundary

CC's comms system is deeply integrated into its process model -- React hooks, AppState, tmux pane management, in-process teammate runners. It cannot be extracted.

Our system's strength is that it is external and harness-agnostic. The HTTP server works regardless of whether the agent is Claude, Codex, or Gemini (as seen in `harness-executor.ts` supporting all three).

The optimal path is not to adopt CC's implementation but to adopt its **architectural principle**: comms should be infrastructure, not prompt engineering. We achieve this by moving polling to hooks and delivery to server-side logic, while keeping our HTTP transport that works across harnesses.
