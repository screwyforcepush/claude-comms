# Implementation Plan: Wire Chat UI to Product Owner Agent

## Assignment North Star
Wire up Chat UI to Product Owner agent. Replace the fake setTimeout response in ChatPanel.js with a real flow that:
1. On user message, creates a PO job via the runner
2. PO agent uses jam/cook mode from thread to determine behavior
3. PO response is written back to chatMessages

## Architecture Analysis

### Current State
- **ChatPanel.js:89-126** - `handleSendMessage` uses a fake `setTimeout` (1.5s delay) to simulate PO responses
- **CLI chat-send** (cli.ts:280-330) - Already implements the full pattern: creates hidden assignment + chat job
- **Runner** (runner.ts:197-214) - Has `isChatJob()`, `saveChatResponse()` functions ready
- **product-owner.md** template - Full Handlebars template with COOK_MODE conditionals

### Key Discovery
The CLI already has the complete implementation. The UI just needs to replicate the CLI's `chat-send` flow via Convex mutations.

## Implementation Tasks

### Task 1: Add `triggerChatJob` Mutation to Convex
**File:** `workflow-engine/convex/chatJobs.ts` (new)

Create a new Convex mutation that encapsulates the CLI pattern:
```typescript
export const trigger = mutation({
  args: {
    threadId: v.id("chatThreads"),
    harness: v.optional(v.union(v.literal("claude"), v.literal("codex"), v.literal("gemini"))),
  },
  handler: async (ctx, args) => {
    // 1. Get thread and messages
    // 2. Create hidden assignment (independent: true, priority: 0)
    // 3. Build chat context JSON
    // 4. Create job with jobType: "product-owner", context: JSON.stringify(chatContext)
    // Return jobId
  }
});
```

**Why "product-owner" not "chat":** Runner's `isChatJob()` accepts both, but "product-owner" maps to the richer template.

**Dependencies:** None

---

### Task 2: Expose `chatJobs.trigger` in UI API
**File:** `workflow-engine/ui/js/api.js`

Add to exports:
```javascript
chatJobs: {
  trigger: "chatJobs:trigger"
}
```

**Dependencies:** Task 1

---

### Task 3: Replace setTimeout in ChatPanel.js
**File:** `workflow-engine/ui/js/components/chat/ChatPanel.js`

Modify `handleSendMessage`:

```javascript
const triggerChatJob = useMutation(api.chatJobs.trigger);

const handleSendMessage = useCallback(async (content) => {
  if (!selectedThreadId || sending) return;

  setSending(true);
  try {
    // Add user message
    await addMessage({
      threadId: selectedThreadId,
      role: 'user',
      content: content
    });

    // Trigger PO job - runner will save assistant response
    await triggerChatJob({
      threadId: selectedThreadId,
      harness: 'claude' // or make configurable
    });

  } catch (err) {
    console.error('Failed to send message:', err);
  } finally {
    setSending(false);
  }
}, [selectedThreadId, sending, addMessage, triggerChatJob]);
```

**Key Change:** Remove setTimeout entirely. The runner's `saveChatResponse()` writes the assistant message directly to `chatMessages` table. Since ChatPanel uses `useQuery(api.chatMessages.list, {threadId})`, Convex's real-time subscription will automatically show the response when the runner writes it.

**Dependencies:** Task 2

---

### Task 4: Add Pending Indicator While Job Runs
**File:** `workflow-engine/ui/js/components/chat/ChatView.js`

Since there's no longer a fake response, we need to show the user their message was received and processing is happening. Options:

A) **Keep `sending` state active until assistant message appears** - UI already handles this via the reactive query
B) **Add typing indicator** - Show "PO is thinking..." while `sending === true` and last message is from user

Recommend Option B - better UX. The `sending` state can be set to `false` immediately after job trigger succeeds, and a new "pending response" indicator watches for `messages[messages.length-1]?.role === 'user'` condition.

**Dependencies:** Task 3

---

### Task 5: Handle Job Failures Gracefully
**File:** `workflow-engine/ui/js/components/chat/ChatPanel.js`

The runner already handles failures by writing error messages to chat:
```typescript
await saveChatResponse(chatContext.threadId,
  `I encountered an issue while processing your request...`
);
```

So no additional error handling needed in UI - failures appear as assistant messages naturally.

**Dependencies:** Task 3 (validation only)

---

## Decision Points

### Decision 1: Which job type?
**Options:**
- `"chat"` - Simpler, but less rich template
- `"product-owner"` - Full featured template with COOK_MODE conditionals

**Recommendation:** `"product-owner"` - leverages the existing rich template

### Decision 2: Where to create the hidden assignment?
**Options:**
- **A) Per-message** (current CLI approach) - Creates new assignment for each chat message
- **B) Per-thread** - Reuse existing `chatThreads.assignmentId` field

**Recommendation:** **Option A (per-message)** for MVP
- Simpler, mirrors proven CLI pattern
- Assignments are lightweight (independent: true)
- Can optimize to per-thread later if needed

### Decision 3: Default harness
**Options:**
- Hard-code `"claude"` in mutation
- Make it configurable via UI
- Use runner's `config.defaultHarness`

**Recommendation:** Hard-code `"claude"` for MVP, add harness picker later

---

## Job Sequence

1. **Implement** (Tasks 1-3) - Core wiring
2. **Refine** (Task 4) - UX polish with typing indicator
3. **UAT** - Manual testing of jam/cook modes, error scenarios
4. **Verify** - End-to-end flow confirmation

---

## Files to Modify

| File | Change |
|------|--------|
| `workflow-engine/convex/chatJobs.ts` | NEW - trigger mutation |
| `workflow-engine/ui/js/api.js` | Add chatJobs reference |
| `workflow-engine/ui/js/components/chat/ChatPanel.js` | Replace setTimeout with real job trigger |
| `workflow-engine/ui/js/components/chat/ChatView.js` | Add typing indicator |

---

## Verification Criteria

1. User sends message → PO job appears in queue → response appears in chat
2. Jam mode → PO responds in ideation mode (no CLI commands)
3. Cook mode → PO can take action (may use CLI commands)
4. Job failure → Error message appears as assistant response
5. Real-time: message appears immediately when runner completes (Convex subscription)

---

## Ambiguities Flagged

1. **Thread reuse of assignments**: Current implementation creates new assignment per message. Should we reuse thread's assignmentId for job chaining? (Deferred - works fine as-is)

2. **Harness selection**: Should user be able to pick which model (Claude/Codex/Gemini) responds? (Deferred - use Claude default)

3. **Assignment cleanup**: Hidden chat assignments will accumulate. Need periodic cleanup? (Deferred - not blocking MVP)
