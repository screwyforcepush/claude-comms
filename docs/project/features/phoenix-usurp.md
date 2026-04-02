# PHOENIX — Self-Initiated Context Renewal

## Status: Ideation (locked concept, not yet specced for implementation)

## Origin
Cross product of `DECAY` (specialist relevancy decays unevenly) x `USURP` (fresh agent inherits dying agent's expertise). Emerged from Session Resurrection Ideation jam.

## Concept
An Outcome Navigator monitors its own context pressure. When a configurable threshold is crossed, it self-initiates usurp: spawns a fresh instance, briefs it with compressed essential context, and dies. The new instance starts with a clean context window and inherited expertise.

## Mechanism
- **Trigger:** Programmatic, on Outcome Navigator response cycle. Not self-reflection — a measurable threshold check.
- **Direction:** Push (USURP.PUSH). The dying agent initiates the handover.
- **Threshold:** Configurable via assignment or namespace config (e.g., token count, turn count, or context pressure heuristic).
- **Briefing:** The usurp payload is the design challenge — minimum viable context transfer that preserves navigational continuity without bloating the fresh window.

## Key Principles
- Aligns with Principle 1 (Value/Token Ratio): Fresh context = restored focus and signal quality.
- Agents that know when to die are more valuable than agents kept alive past their effectiveness.
- The briefing is NOT a full context dump. It's a compressed handover: current assignment state, key decisions made, what's in-flight, what to avoid.

## Open Questions
- What's the right threshold metric? Raw token estimate? Turn count? Time since session start?
- What belongs in the minimum viable briefing?
- Does the new instance resume the same thread (new session, same threadId) or fork?
- How does the UI surface usurp events? Should the user see "Navigator renewed" or is it invisible?

## Dependencies
- Session ID storage (exists)
- Chat job trigger mechanism (exists)
- Guardian session fork / per-assignment session isolation (exists — see `guardian-session-fork.md`)
- Context pressure measurement (needs design)
- Briefing format/protocol (needs design)
