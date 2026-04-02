# Phase 11 — Claude Code Harness Source Analysis

> **Status:** Complete
> **Date:** 2026-04-02
> **Type:** Research only — no code changes
> **Deliverable:** [`docs/project/research/cc-harness-analysis.md`](../../research/cc-harness-analysis.md)

## Summary

Deep-dive analysis of extracted Claude Code harness source (`_research/claude-code-harness/`) against our production orchestration system. Goal: identify actionable integration opportunities, friction points, and architectural insights — while respecting our harness-agnostic, fresh-session architecture.

## Key Findings

1. **Comms overhead is the biggest win.** Our custom inter-agent comms costs ~2,620 tokens/session/agent (970 tokens system prompt + 1,650 tokens polling across 50 tool calls). Moving inbox polling to a PostToolUse hook (R1) immediately eliminates ~1,650 tokens of polling overhead. An additional ~970 tokens become recoverable via R4 after R1 is validated in production.

2. **CC imposes a ~10–15k token context floor** per job before our templates load. This is the dominant cost for short-lived jobs and directly interacts with the phoenix-usurp concept.

3. **Hook overhead adds ~8–25 seconds** cumulative wall-clock time per job from Python process spawns on every tool call.

4. **Silent failure bug** in `send_message.py` — returns success on connection errors, masking message loss.

5. **Architectural validation** — our design choices (Convex state authority, fresh sessions, independent processes, prompt-as-control-surface) are confirmed sound. All CC features examined are tightly coupled to CC's in-process model; adopting any would create hard lock-in.

## Top 3 Recommendations (by priority)

| Rank | ID | Recommendation | Effort | Impact |
|------|-----|----------------|--------|--------|
| 1 | R1 | Move inbox polling to PostToolUse hook (structured JSON output) | Low | High — saves ~1,650 tokens/session immediately, guarantees delivery |
| 2 | R2 | Fix `send_message.py` silent failure bug | Trivial | Medium — prevents silent message loss |
| 3 | R4 | Strip comms instructions from `engineer.md` (after R1 validated) | Low | Medium — recovers 970 tokens of prompt budget per agent |

## Phase Artifacts

| Artifact | Purpose |
|----------|---------|
| [`cc-harness-research-spec.md`](cc-harness-research-spec.md) | Research spec with WP breakdown and critical files map |
| [`WP2-subagent-comms-deep-dive.md`](WP2-subagent-comms-deep-dive.md) | Working notes — subagent communication analysis |
| [`WP3-capability-gap-inventory.md`](WP3-capability-gap-inventory.md) | Working notes — CC capability gap assessment |
| [`wp4-wp5-friction-conflicts-antirec.md`](wp4-wp5-friction-conflicts-antirec.md) | Working notes — friction points and anti-recommendations |
| [**cc-harness-analysis.md**](../../research/cc-harness-analysis.md) | **Primary deliverable** — full research report |

## Anti-Recommendations (Critical)

The report identifies 7 things that look appealing but would be wrong for our architecture. Key theme: CC features assume interactive, single-session, co-resident agents — our system is batch, multi-session, independent-process. See report Section 6.
