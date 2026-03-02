# Guardian Session Fork

## Status: Implementing

## Problem

Chat threads have a single `claudeSessionId` used for all Claude interactions. In guardian mode, PM evaluation prompts and user conversations both resume the same session, meaning:

1. Guardian evaluations pollute the user's jam/cook conversation context
2. User messages pollute the guardian's evaluative context
3. The PO cannot accumulate assignment-specific oversight history independently

## Solution

Fork the Claude session when guardian mode activates. Route interactions based on thread mode:

- **jam/cook** → resume the original `claudeSessionId` (unchanged behavior)
- **guardian** → resume a per-assignment forked session from `guardianSessions` map

## Mechanism

### Fork primitive

Claude Code CLI supports session forking:

```
claude --resume <session-id> --fork-session
```

This creates a new session branching from the original. The original session is untouched. Both sessions diverge independently from the fork point.

### Session resolution

```
resolveSessionId(thread):
  if mode is jam or cook:
    return thread.claudeSessionId
  if mode is guardian:
    guardianId = thread.guardianSessions[thread.assignmentId]
    if guardianId exists:
      return guardianId          # resume existing guardian fork
    else:
      return thread.claudeSessionId  # fork point — will use --fork-session
```

### Lifecycle

1. User builds conversation in jam/cook → `claudeSessionId` accumulates context
2. User enables guardian mode, links assignment
3. First guardian eval triggers — no `guardianSessions[assignmentId]` exists
4. Runner spawns Claude with `--resume <OG session> --fork-session`
5. Claude returns a **new** session ID for the fork
6. Runner saves new ID to `guardianSessions[assignmentId]`
7. Subsequent guardian evals → `--resume <guardian session>` (no fork)
8. User messages while in guardian mode → also use guardian session
9. User switches to jam → back to `claudeSessionId`, completely isolated

### Per-assignment isolation

`guardianSessions` is a map keyed by assignment ID. Each assignment gets its own guardian fork. When the user switches focus assignment (via `updateFocusAssignment`), the guardian session follows automatically — different assignment = different fork = different accumulated evaluation context.

## Data model

### Schema addition (additive, backward-compatible)

```typescript
// chatThreads table
guardianSessions: v.optional(v.record(v.string(), v.string()))
// key: assignmentId (string), value: Claude session ID
```

## Files changed

| File | Change |
|------|--------|
| `workflow-engine/convex/schema.ts` | Add `guardianSessions` field to chatThreads |
| `workflow-engine/convex/chatThreads.ts` | Add `updateGuardianSessionId` mutation |
| `workflow-engine/convex/chatJobs.ts` | Session resolution logic in `trigger` |
| `.agents/tools/workflow/lib/streams.ts` | `forkSession` in `CommandOptions` + `buildCommand` |
| `.agents/tools/workflow/lib/harness-executor.ts` | `forkSession` passthrough in `ExecuteOptions` |
| `.agents/tools/workflow/lib/prompts.ts` | `forkSession` on `ChatJobContext` interface |
| `.agents/tools/workflow/runner.ts` | Fork flag passthrough + session save routing |

## What doesn't change

- `enableGuardianMode` mutation — unchanged
- `getGuardianThread` query — unchanged
- `triggerGuardianEvaluation` in runner — unchanged (delegates to `chatJobs.trigger`)
- UI — no changes (backend routing only)
- CLI — no changes
