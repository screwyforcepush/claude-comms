# Guardian Mode Specification

> PO as alignment guardian for autonomous assignment execution

**Version:** 1.2
**Last Updated:** 2026-10-15
**Status:** Active (Phase 22 convergence checkpoints)

---

## Objective

Enable alignment monitoring at convergence checkpoints during autonomous assignment execution, where the Product Owner (PO) acts as the user's proxy/advocate - evaluating whether work trajectory aligns with original intent established during the jam session.

## Problem Statement

1. **Context loss**: Rich context from jam sessions (nuances, implicit constraints, the "why behind the why") gets distilled into a thin north star. Downstream agents lack the full picture.

2. **Drift detection**: Assignments can drift from intent over multiple job cycles. By the time a user checks in, significant misaligned work may have occurred.

3. **Incremental reports hide patterns**: Individual PM reports are too incremental to expose repeated completion-review knock-backs. The guardian needs a checkpoint view of convergence rather than a stream of routine updates.

## Solution: Guardian Mode

A third thread mode (alongside jam and cook) where:
- PO evaluates every third completion-review knock-back for convergence and alignment with original intent
- PO has jam context and checkpoint history via a per-assignment session fork
- The final PM report triggers an executive assessment, preferring the guardian thread, otherwise the linked jam/cook thread
- PM reports between checkpoints never reach the guardian fork
- PO acts as user's advocate, flagging drift before it compounds
- User can engage PO to discuss and resolve uncertainty

---

## Design

### Thread Modes

| Mode | Description |
|------|-------------|
| `jam` | Read-only ideation. PO helps refine requirements. Cannot create assignments. |
| `cook` | Full autonomy. PO creates assignments, inserts jobs. No oversight. |
| `guardian` | Cook + checkpoint alignment monitoring and final executive assessment. Requires linked assignment; routine PM reports are not injected. |

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

On PM-group completion:
5. PM response stored in jobs.result
6. System reads the linked chain shape and decides final → checkpoint → none
7. Final (PM is chain tail): check all groups terminal, then atomically complete
   unless blocked/missing; on success, surface final PM report in guardian thread
   if present, otherwise linked jam/cook thread, and trigger completion_summary
8. Checkpoint: PM immediately follows a review+document group, has a next group,
   and the completion-review count through its predecessor is 3, 6, 9, ...
9. At checkpoint only, if guardian thread exists: insert PM chatMessage and trigger
   guardian_eval with metadata; resume the per-assignment fork
   (fork jam session on first use)
10. PO evaluates convergence/alignment and responds; updates alignmentStatus if needed
11. If misaligned: PO blocks assignment
12. None: no PM chatMessage and no guardian chatJob; report stays in jobs.result

On misalignment:
13. User sees red status, discusses with PO in thread
14. User confirms resolution direction
15. PO unblocks assignment
16. Work continues
```

A completion-review group contains both exact job types `review` and `document`; fan-out reviews count as one group, and an accompanying `uat` does not affect the count. Review-only, review+uat, and document-only groups do not count. The reacting PM must immediately follow a qualifying group and have a successor: the knock-back is recognized when it schedules more work. Finality wins even at count 3, 6, or 9, so the final report triggers only the completion prompt.

Checkpoint context is `{ round, completionReviews, chainShape }`: round is count / 3, count includes qualifying groups before the reacting PM, and shape covers the prefix through that PM, excluding its newly inserted next group. Groups are in linked-list order, joined by spaces; jobs retain stored order, joined by `+`. Letters are `plan=P`, `pm=M`, `implement=I`, `review=R`, `uat=U`, `document=D` (unknown types use their uppercased first character). Example round 1, count 3:

```text
P M I M R+R+R+D M I M R+R+R+D M I M R+R+R+D M
```

The final assessment uses `completion_summary`, even in guardian mode, rather than `guardian_eval`. Guardian checkpoint evaluations, final assessments, and user messages all use the assignment's guardian fork; jam/cook uses the original session. Without an existing fork or original session, a guardian interaction starts fresh and saves its returned session to the guardian map.

### Async Execution

- Assignment continues running next job while PO evaluates
- Accepted trade-off: the next group may already be running before a guardian block takes effect
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

The guardian-evaluation module in `product-owner.md` receives the checkpoint PM report plus `{{CHECKPOINT_ROUND}}`, `{{COMPLETION_REVIEWS}}`, and `{{CHAIN_SHAPE}}`. Missing checkpoint metadata renders `(n/a)` for compatibility with old queued contexts and direct triggers. Completion assessments select the separate completion module. The response illustration below does not replace the owner's tuned production prompt prose:

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

After the existing `res.groupCompleted` gate, the PM-group branch queries the lean chain shape once and delegates cadence to the pure decision module:

```typescript
const chain = await query(assignments.getChainShape, { id: assignment._id });
const wake = decideGuardianWake(chain, group._id);
switch (wake.kind) {
  case 'final':
    // Checks pending/running groups, calls assignments.complete, and stops
    // if completed:false. Otherwise queues isCompletionSummary:true in the
    // preferred guardian thread, falling back to a linked jam/cook thread.
    await checkAndCompleteAssignment(assignment._id, group._id, assignment, pmResult);
    break;
  case 'checkpoint':
    // Looks up guardian thread; if present, inserts role:'pm' and triggers
    // isGuardianEvaluation:true with checkpoint: wake.checkpoint.
    await triggerGuardianEvaluation(assignment, pmResult, wake.checkpoint);
    break;
  case 'none':
    // Log only; warn if the completed PM group is missing from the chain.
    break;
}
```

**Note:** The relationship is `chatThread.assignmentId` → `assignment._id` (thread points to assignment, not reverse). Use the `by_assignment` index on `chatThreads` to find the linked thread.

`getChainShape` walks `headGroupId` → `nextGroupId`, with a visited-id guard, and returns only `{ _id, jobTypes }` per group. It does not use the archive query or creation-time order. Query errors reach the existing callback catch; no fallback restores per-PM evaluation.

`assignments.complete` refuses blocked or missing assignments inside its transaction, before any write or namespace-count adjustment, returning `{ completed: false, status: 'blocked' | null }`. The runner then skips the summary. Already-complete assignments return `{ completed: true }` without recounting, so a PM's earlier status update does not suppress the terminal callback's summary. The existing group-finalization token owns these side effects; this is not a durable delivery guarantee.

### Notifications

After any assistant response is successfully saved, `saveChatResponse` attempts `notifications.post` in a separate catch. This includes success, failure, kill, and timeout in any mode or harness, including guardian checkpoint responses and final assessments. PM-role reports and user messages do not push. If the chat save fails there is no post; notification failure does not affect the chat save and is not retried.

Successful responses post `content` verbatim, excluding telemetry hints. Failure/kill/timeout posts use `hint + "\n\n" + partial content`, or just the hint when content is empty; without a hint, content stays verbatim. The completion-error fallback already supplies its whole error message as content. The server checks the global audio toggle: off returns `null` without inserting; on stores `body.slice(0, 5000)`, preserving markdown, whitespace, and empty bodies. There is no notification session fork, prompt, or agent run.

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
- Query linked chain shape and dispatch final → checkpoint → none
- At every third qualifying knock-back, surface the PM report and trigger guardian evaluation with checkpoint metadata
- At finality, atomically refuse blocked completion; otherwise trigger the executive assessment in guardian, falling back to jam/cook
- Leave reports between checkpoints outside the fork

### Phase 3: PO Prompt Module
- Add `{{#if GUARDIAN_MODE}}` section to product-owner.md
- Render checkpoint round, completion-review count and prefix shape; retain the owner's production prose
- Use the completion module for final assessment, including in guardian mode
- Token-efficient response format (emoji-only for aligned)

### Phase 4: UI Indicators
- Thread selector: alignment + assignment status
- Chat panel: PM message styling
- Dedicated design pass for space-constrained selector

---

## Token Economy

Guardian mode adds one PO evaluation per third completion-review knock-back, plus the final executive assessment. Routine PM cycles add no guardian message or agent run. Other cost controls:

1. **Aligned = emoji only**: No rationale when trajectory is good
2. **Resume-session**: No message history in prompt, Claude maintains context
3. **Focused prompt**: Guardian module is concise, evaluation-specific
4. **Async**: No blocking, assignment continues during evaluation
5. **Verbatim notifications**: Assistant saves post directly; no second agent run re-authors the response

---

## Success Criteria

1. User can switch thread to guardian mode when linked to assignment
2. Only checkpoint interim PM reports surface in the guardian thread; reports between checkpoints never reach its fork
3. PO evaluates knock-backs at counts 3, 6, 9, ... with correct round/count/prefix shape; non-qualifying groups do not advance the count
4. User can see alignment status at a glance in thread selector
5. Misalignment blocks assignment until user confirms resolution
6. Full jam context preserved for accurate alignment evaluation
7. Finality takes precedence over a checkpoint; one completion assessment prefers guardian, otherwise linked jam/cook, using the completion prompt
8. Blocked completion is refused atomically, with no status/count writes or executive assessment
9. Every saved assistant response can notify in any mode/harness when the server toggle is on; stored bodies follow the verbatim slice-to-5000 contract, and PM/user messages never push
