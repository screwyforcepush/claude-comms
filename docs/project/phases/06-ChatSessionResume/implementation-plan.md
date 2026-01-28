# Phase 06: Chat Session Resume Implementation Plan

## Assignment North Star
Refactor chat threads to use Claude session resume instead of isolated prompts - 1 thread = 1 session, store session_id on chatThreads table, remove assignment/queue infrastructure from chat.

---

## Current State Analysis

### Problem Summary
1. **No conversation memory**: Each chat message creates a new Claude invocation with no continuity
2. **Queue pollution**: Chat threads create assignment records just to reuse job queue infrastructure
3. **UI clutter**: Chat-related assignments appear in the Assignments tab
4. **Unnecessary overhead**: Chat doesn't need the job chain / PM review workflow

### Current Flow
```
User sends message → ChatPanel.handleSendMessage()
  → chatMessages.add() (stores user message)
  → chatJobs.trigger()
    → Creates assignment record (northStar: "Chat thread: {title}")
    → Creates job record (jobType: "product-owner")
    → Links job to assignment
  → Runner picks up job via scheduler.getReadyJobs
  → Runner executes: claude -p 'prompt' --output-format stream-json
  → Response saved to chatMessages
```

### Key Files Involved
| File | Current Role |
|------|--------------|
| `convex/schema.ts` | Defines chatThreads, chatMessages, assignments, jobs |
| `convex/chatJobs.ts` | Creates assignment + job for each chat trigger |
| `convex/scheduler.ts` | Returns ready jobs (including chat jobs) |
| `runner.ts` | Executes jobs via CLI, handles chat vs workflow jobs |
| `ui/js/api.js` | API references for mutations/queries |
| `ui/js/components/chat/ChatPanel.js` | Calls triggerChatJob mutation |

---

## Target State

### New Flow
```
User sends message → ChatPanel.handleSendMessage()
  → chatMessages.add() (stores user message)
  → chatJobs.sendMessage() (NEW mutation)
    → If thread has no session_id: executes claude -p 'msg' --output-format json
    → If thread has session_id: executes claude -p 'msg' --resume {session_id}
    → Parses response, extracts session_id from first message
    → Saves session_id to thread (if new)
    → Returns response text
  → chatMessages.add() (stores assistant response)
```

### Key Changes
1. **Schema**: Add `claudeSessionId: v.optional(v.string())` to chatThreads
2. **Execution**: Direct CLI execution in mutation (not via job queue)
3. **Session management**: Store and resume Claude sessions per thread
4. **No assignments**: Chat bypasses assignment/job infrastructure entirely

---

## Implementation Work Packages

### WP-1: Schema Migration
**Effort**: Small
**Dependencies**: None

**Tasks**:
1. Add `claudeSessionId: v.optional(v.string())` field to chatThreads in `convex/schema.ts`
2. Run `npx convex dev` to push schema changes

**Files Modified**:
- `workflow-engine/convex/schema.ts`

---

### WP-2: Create Chat Execution Action
**Effort**: Medium
**Dependencies**: WP-1

**Tasks**:
1. Create new file `convex/chatActions.ts` with a Convex action (not mutation) for chat execution
2. Implement `sendMessage` action that:
   - Reads thread to get existing `claudeSessionId`
   - Spawns Claude CLI with appropriate flags
   - Parses JSON output to extract session_id and response
   - Updates thread's `claudeSessionId` if new session created
   - Stores assistant response in chatMessages
   - Returns response to caller

**Claude CLI Commands**:
```bash
# First message (no session)
claude -p "message" --output-format json

# Subsequent messages (resume session)
claude -p "message" --resume {session_id} --output-format json
```

**JSON Output Parsing**:
- Extract `session_id` from init event
- Extract response text from result

**Files Modified**:
- NEW: `workflow-engine/convex/chatActions.ts`

---

### WP-3: Refactor chatJobs.ts
**Effort**: Small
**Dependencies**: WP-2

**Tasks**:
1. Remove the `trigger` mutation from `chatJobs.ts`
2. Either delete file or repurpose for "cook" mode assignment creation only
3. If keeping cook mode: rename to `convertToCookAssignment` or similar

**Decision Needed**: Should "cook" mode still create assignments, or should it be handled differently?

**Recommendation**: Keep "cook" mode as a separate explicit action that converts a chat thread into an assignment when user wants workflow execution.

**Files Modified**:
- `workflow-engine/convex/chatJobs.ts` (modify or delete)

---

### WP-4: Update ChatPanel UI
**Effort**: Small
**Dependencies**: WP-2, WP-3

**Tasks**:
1. Replace `triggerChatJob` mutation call with new action call
2. Update loading/error states for synchronous-ish execution
3. Keep existing message display (chatMessages subscription still works)

**Files Modified**:
- `workflow-engine/ui/js/api.js` (update API references)
- `workflow-engine/ui/js/components/chat/ChatPanel.js` (call new action)

---

### WP-5: Session Recovery Handling
**Effort**: Small
**Dependencies**: WP-2

**Tasks**:
1. Handle case where `--resume` fails (invalid/expired session)
2. Detect error, clear `claudeSessionId`, start new session
3. Optionally notify user that session was reset

**Error Detection**:
- Check exit code and stderr for session-related errors
- Pattern: "session not found" or similar

**Files Modified**:
- `workflow-engine/convex/chatActions.ts` (add recovery logic)

---

### WP-6: Remove Runner Chat Handling
**Effort**: Small
**Dependencies**: WP-4 (verify chat works without runner)

**Tasks**:
1. Remove `isChatJob()` function and chat-specific code from `runner.ts`
2. Remove `ChatJobContext` interface and related types
3. Remove `buildChatPrompt()`, `buildChatHistory()`, `parseChatContext()`
4. Remove `saveChatResponse()` function
5. Clean up any dead code paths

**Files Modified**:
- `.agents/tools/workflow/runner.ts`

---

### WP-7: Cleanup and Verification
**Effort**: Small
**Dependencies**: WP-6

**Tasks**:
1. Verify no chat assignments appear in Assignments tab
2. Verify chat threads maintain conversation context
3. Verify "cook" mode still works as expected (if preserved)
4. Clean up any orphaned chat assignments from testing

---

## Dependency Graph

```
WP-1 (Schema)
    ↓
WP-2 (Chat Action) ──────┬─────────────────┐
    ↓                    ↓                 ↓
WP-3 (chatJobs)      WP-5 (Recovery)   WP-4 (UI)
    ↓                    ↓                 ↓
    └────────────────────┴─────────────────┘
                         ↓
                 WP-6 (Runner Cleanup)
                         ↓
                 WP-7 (Verification)
```

---

## Ambiguities & Decisions Needed

### Decision 1: Cook Mode Behavior
**Question**: Should "cook" mode continue to create assignments?

**Options**:
- A) Keep cook mode creating assignments (useful for complex tasks needing workflow)
- B) Remove cook mode entirely (simplify, all chat is direct)
- C) Make cook mode an explicit "Convert to Assignment" action

**Recommendation**: Option C - explicit conversion. Chat stays direct, user can explicitly convert a thread to an assignment when needed.

### Decision 2: Message History Display
**Question**: Should we still inject message history into prompts for context display, or rely entirely on `--resume`?

**Answer**: Rely on `--resume`. Claude session resume handles context. We only store messages for UI display, not for prompt injection.

### Decision 3: Convex Action vs HTTP Endpoint
**Question**: Should chat execution be a Convex action (spawns subprocess) or external HTTP call?

**Answer**: Convex action. This keeps the architecture contained within Convex, though actions have time limits (10 min default). For long-running chat responses, may need to consider action timeout configuration.

---

## Recommended Job Sequence

1. **Implement Batch** (WP-1 + WP-2): Schema + Core Action
2. **Refine Batch** (WP-3 + WP-4 + WP-5): Integration + UI + Recovery
3. **Cleanup Batch** (WP-6): Runner cleanup
4. **UAT Batch** (WP-7): Verification

---

## Success Criteria

- [ ] Chat messages within a thread maintain conversation context via `--resume`
- [ ] No assignment records created for chat interactions
- [ ] Assignments tab shows only workflow assignments
- [ ] Chat UI continues to render message history
- [ ] First message creates session, subsequent messages resume it
- [ ] Session recovery works when session expires
- [ ] "Cook" mode (if preserved) works for explicit workflow conversion

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Convex action timeout | Medium | Medium | Configure longer timeout, consider chunked responses |
| Claude session expiration | Low | Low | Session recovery logic (WP-5) |
| Breaking existing chat | Medium | High | Thorough UAT testing |
| Cook mode regression | Low | Medium | Explicit testing of cook→assignment flow |

---

## Artifacts

This plan creates:
- Phase directory: `docs/project/phases/06-ChatSessionResume/`
- Implementation plan: `implementation-plan.md` (this file)
- No code artifacts yet (implementation phase creates those)
