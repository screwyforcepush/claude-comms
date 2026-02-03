# Guardian Mode Specification

> PO as alignment guardian for autonomous assignment execution

**Version:** 1.1
**Last Updated:** 2026-02-02
**Status:** Active (Schema implemented, runner integration pending)

---

## Objective

Enable continuous alignment monitoring during autonomous assignment execution, where the Product Owner (PO) acts as the user's proxy/advocate - evaluating whether work trajectory aligns with original intent established during the jam session.

## Problem Statement

1. **Context loss**: Rich context from jam sessions (nuances, implicit constraints, the "why behind the why") gets distilled into a thin north star. Downstream agents lack the full picture.

2. **Drift detection**: Assignments can drift from intent over multiple job cycles. By the time a user checks in, significant misaligned work may have occurred.

3. **PM responses are orphaned**: PM job results are stored but never consumed programmatically. They communicate trajectory but no one is listening.

## Solution: Guardian Mode

A third thread mode (alongside jam and cook) where:
- PO monitors every PM response for alignment with original intent
- PO has full context via resume-session pattern
- PO acts as user's advocate, flagging drift before it compounds
- User can engage PO to discuss and resolve uncertainty

---

## Design

### Thread Modes

| Mode | Description |
|------|-------------|
| `jam` | Read-only ideation. PO helps refine requirements. Cannot create assignments. |
| `cook` | Full autonomy. PO creates assignments, inserts jobs. No oversight. |
| `guardian` | Cook + alignment monitoring. PO evaluates every PM report. Requires linked assignment. |

### Alignment Status

Stored on `assignments` table:

| Status | Meaning | PO Response |
|--------|---------|-------------|
| `aligned` | Trajectory matches intent | 🟢 (just emoji, no rationale) |
| `uncertain` | Potential drift, user awareness needed | 🟠 + brief rationale |
| `misaligned` | Clear departure from intent | 🔴 + rationale, blocks assignment |

Default: `aligned` when guardian mode activated.

### Flow

```
1. User jams with PO, refines requirements
2. User switches to guardian mode
3. PO creates assignment (linked to thread via FK)
4. Assignment executes: job → PM → job → PM → ...

On each PM completion:
5. PM response stored in jobs.result
6. System inserts chatMessage (role: 'pm', content: PM response)
7. System triggers chatJob for PO guardian evaluation
8. PO runs with resume-session (has full jam context)
9. PO evaluates trajectory alignment
10. PO responds with traffic light (+ rationale if not green)
11. PO updates alignmentStatus if changed
12. If misaligned: PO blocks assignment

On misalignment:
13. User sees red status, discusses with PO in thread
14. User confirms resolution direction
15. PO unblocks assignment
16. Work continues
```

### Async Execution

- Assignment continues running next job while PO evaluates
- Accepted trade-off: 1 additional job may run in misaligned scenario before block takes effect
- No latency impact on assignment throughput

---

## Schema Changes

### assignments table

```typescript
// Add field
alignmentStatus: v.optional(v.union(
  v.literal("aligned"),
  v.literal("uncertain"),
  v.literal("misaligned")
))
```

### chatThreads table

```typescript
// Expand mode union
mode: v.union(
  v.literal("jam"),
  v.literal("cook"),
  v.literal("guardian")
)

// Existing FK for linked assignment
assignmentId: v.optional(v.id("assignments"))
```

### chatMessages table

```typescript
// Expand role to include PM system messages
role: v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("pm")  // NEW: PM reports surfaced in thread
)
```

---

## CLI Changes

### update-assignment

Add `--alignment` flag:

```bash
npx tsx .agents/tools/workflow/cli.ts update-assignment <id> \
  --alignment <aligned|uncertain|misaligned>
```

---

## PO Prompt Module: Guardian Mode

Add to `product-owner.md`:

```markdown
{{#if GUARDIAN_MODE}}
## GUARDIAN MODE ACTIVE

You are monitoring assignment alignment. A PM has reported on work progress.

**Your role:** Evaluate whether the assignment's trajectory aligns with the original intent from your jam session with the user. You have full context from that conversation.

**What you're evaluating:** Progress and trajectory of the assignment. The PM is the messenger - decisions reported may have been made by any agent (implementer, architect, etc).

### PM Progress Report
{{LATEST_MESSAGE}}

### Alignment Response

Respond with ONE of:

**🟢** - Trajectory aligned with intent. Just the emoji, nothing else.

**🟠** - Uncertain. Include 2-3 sentence rationale explaining the concern.

**🔴** - Misaligned. Include rationale and block the assignment.

### CLI Commands (only if status changes)

```bash
# Update alignment status
npx tsx .agents/tools/workflow/cli.ts update-assignment <id> --alignment <aligned|uncertain|misaligned>

# Block assignment (required for misaligned)
npx tsx .agents/tools/workflow/cli.ts block <id> --reason "..."

# Unblock assignment (after user confirms resolution)
npx tsx .agents/tools/workflow/cli.ts unblock <id>
```

### Conversation

If user responds to discuss alignment concerns:
- Engage naturally to understand their perspective
- Clarify your concerns or acknowledge resolution
- Update alignment status based on conversation outcome
- Unblock assignment if user confirms direction
{{/if}}
```

---

## Runner Changes

When PM job completes, check if there's a thread linked to this assignment in guardian mode:

```typescript
// In runner.ts, after PM job completion
// Note: Thread links TO assignment via chatThread.assignmentId (not vice versa)
const linkedThread = await getThreadByAssignment(assignment._id);
if (linkedThread && linkedThread.mode === 'guardian') {
  // 1. Insert PM response as chatMessage
  await insertChatMessage({
    threadId: linkedThread._id,
    role: 'pm',
    content: pmJobResult,
    createdAt: Date.now()
  });

  // 2. Trigger PO evaluation via chatJob
  await createChatJob({
    threadId: linkedThread._id,
    namespaceId: linkedThread.namespaceId,
    harness: 'claude'
  });
}
```

**Note:** The relationship is `chatThread.assignmentId` → `assignment._id` (thread points to assignment, not reverse). Use the `by_assignment` index on `chatThreads` to find the linked thread.

---

## UI Changes

### Thread Selector

Thread selector already displays mode indicator. Additionally show:

1. **Alignment status** (guardian mode only): 🟢 / 🟠 / 🔴
2. **Assignment status** (if linked): pending / active / blocked / complete

Design consideration: Space is limited. Defer detailed UI design to focused agent.

### Chat Panel

- PM messages (`role: 'pm'`) visually distinct from user/assistant
- PO guardian responses visually distinct (evaluation context)

---

## Implementation Phases

### Phase 1: Schema + CLI
- Add `alignmentStatus` to assignments schema
- Add `guardian` to thread mode enum
- Add `pm` to chatMessage role enum
- Add `--alignment` flag to CLI

### Phase 2: Runner Integration
- Detect guardian mode on PM completion
- Insert PM response as chatMessage
- Trigger PO evaluation chatJob

### Phase 3: PO Prompt Module
- Add `{{#if GUARDIAN_MODE}}` section to product-owner.md
- Token-efficient response format (emoji-only for aligned)

### Phase 4: UI Indicators
- Thread selector: alignment + assignment status
- Chat panel: PM message styling
- Dedicated design pass for space-constrained selector

---

## Token Economy

Guardian mode adds PO evaluation on every PM cycle. Mitigations:

1. **Aligned = emoji only**: No rationale when trajectory is good
2. **Resume-session**: No message history in prompt, Claude maintains context
3. **Focused prompt**: Guardian module is concise, evaluation-specific
4. **Async**: No blocking, assignment continues during evaluation

---

## Success Criteria

1. User can switch thread to guardian mode when linked to assignment
2. PM responses appear in chat thread as they complete
3. PO evaluates each PM response and indicates alignment
4. User can see alignment status at a glance in thread selector
5. Misalignment blocks assignment until user confirms resolution
6. Full jam context preserved for accurate alignment evaluation
