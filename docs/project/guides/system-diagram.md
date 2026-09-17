# Workflow Engine — System Diagram

> ASCII architecture diagram of the claude-comms workflow engine.
> For detailed specs see [Workflow Engine Spec](../spec/workflow-engine-spec.md) and [Parallel Job Groups Architecture](parallel-job-groups-architecture.md).

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                        CLAUDE COMMS — WORKFLOW ENGINE SYSTEM                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝


  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │ CONVEX CLOUD                                                    password-protected  │
  │                                                                                     │
  │  ┌──────────────────────────────────────────────────────────────────────────────┐   │
  │  │ NAMESPACES                                                                   │   │
  │  │                                                                              │   │
  │  │  Each namespace = one client repo. Isolated workspace for assignments,       │   │
  │  │  threads, and jobs. Has denormalized assignmentCounts.                       │   │
  │  │                                                                              │   │
  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │   │
  │  │  │ claude-comms │  │ project-foo │  │ project-bar │  ...                     │   │
  │  │  └──────┬──────┘  └─────────────┘  └─────────────┘                         │   │
  │  │         │                                                                    │   │
  │  └─────────┼────────────────────────────────────────────────────────────────────┘   │
  │            │                                                                        │
  │            │ namespaceId                                                             │
  │            ├──────────────────────────────────┐                                     │
  │            │                                  │                                     │
  │            ▼                                  ▼                                     │
  │  ┌─────────────────────────────┐   ┌─────────────────────────────────────────────┐ │
  │  │ CHAT THREADS                │   │ ASSIGNMENTS                                  │ │
  │  │                             │   │                                               │ │
  │  │  mode: jam|cook|guardian    │   │  northStar: "Implement dark mode"             │ │
  │  │  title: "API Auth Design"  │   │  status: pending|active|blocked|complete      │ │
  │  │  claudeSessionId: "abc..."  │   │  priority: 1-99                               │ │
  │  │  guardianSessions: {id:sid} │   │                                               │ │
  │  │  lastReadAt: (unread track) │   │  independent: bool (parallel vs sequential)   │ │
  │  │  pinned: bool (float top)   │   │                                               │ │
  │  │  assignmentId ─ ─ ─ ─ ─ ─ ─┼──▶│  artifacts: accumulated output               │ │
  │  │  assignmentsCreated: [...]  │   │  decisions: PM decisions log                  │ │
  │  │  lastPromptMode: jam|cook   │   │  alignmentStatus: aligned|uncertain|misalign  │ │
  │  │                             │   │  pmNudge: (feed-forward to next PM)            │ │
  │  │                             │   │  headGroupId ──────────────────────┐           │ │
  │  └──────────┬──────────────────┘   └───────────────────────────────────┼───────────┘ │
  │             │                                                          │             │
  │             │ threadId                                                 │             │
  │             │                                                          ▼             │
  │  ┌──────────┴──────────────┐    ┌──────────────────────────────────────────────────┐ │
  │  │ CHAT MESSAGES           │    │ ASSIGNMENT JOB CHAIN (Group Linked List)          │ │
  │  │                         │    │                                                    │ │
  │  │  role: user|assistant|pm│    │  assignment.headGroupId                            │ │
  │  │  content: "..."         │    │          │                                         │ │
  │  │  hint: (metadata)       │    │          ▼                                         │ │
  │  │  createdAt: timestamp   │    │  ┌──────────────┐  next   ┌──────────────┐  next  │ │
  │  └─────────────────────────┘    │  │  JOB GROUP 1 │───────▶│  JOB GROUP 2 │──────▶ │ │
  │                                  │  │  (parallel)  │        │  (parallel)  │        │ │
  │  ┌─────────────────────────┐    │  │  status:     │        │  status:     │   ...  │ │
  │  │ CHAT JOBS               │    │  │   complete   │        │   running    │        │ │
  │  │                         │    │  └──────┬───────┘        └──────┬───────┘        │ │
  │  │  Separate from assign-  │    │         │ groupId               │ groupId        │ │
  │  │  ment jobs. Triggered   │    │         ▼                       ▼                │ │
  │  │  by chat messages.      │    │  ┌─────────────┐        ┌─────────────┐          │ │
  │  │                         │    │  │ JOB (impl)  │        │ JOB (review)│          │ │
  │  │  threadId -> chatThread │    │  │ claude      │        │ claude  (A) │          │ │
  │  │  harness: claude|codex| │    │  │ complete    │        │ running     │          │ │
  │  │           gemini        │    │  └─────────────┘        ├─────────────┤          │ │
  │  │  status: pending|       │    │                         │ JOB (review)│          │ │
  │  │    running|complete|    │    │                         │ codex   (B) │          │ │
  │  │    failed               │    │                         │ running     │          │ │
  │  │  killRequested: bool    │    │                         ├─────────────┤          │ │
  │  │  metrics: tools,tokens  │    │                         │ JOB (review)│          │ │
  │  └─────────────────────────┘    │                         │ gemini  (C) │          │ │
  │                                  │                         │ pending     │          │ │
  │                                  │                         └─────────────┘          │ │
  │                                  │                                                    │ │
  │                                  │  Groups execute SEQUENTIALLY (linked list).        │ │
  │                                  │  Jobs WITHIN a group execute in PARALLEL.          │ │
  │                                  │  PM group auto-appended after non-PM completes.   │ │
  │                                  └──────────────────────────────────────────────────┘ │
  │                                                                                        │
  │  ┌────────────────────────────────────────────────────────────────┐                    │
  │  │ SCHEDULER (Convex queries, reactive)                           │                    │
  │  │                                                                │                    │
  │  │  getReadyJobs(namespaceId)                                     │                    │
  │  │    - Walks each active/pending assignment's group chain         │                    │
  │  │    - Finds first pending group, returns ALL its pending jobs    │                    │
  │  │    - Sequential assignments: only 1 active at a time            │                    │
  │  │    - Independent assignments: all can run in parallel           │                    │
  │  │    - Accumulates prior results for PM context                   │                    │
  │  │                                                                │                    │
  │  │  getReadyChatJobs(namespaceId)                                  │                    │
  │  │    - Returns pending chatJobs, oldest first                    │                    │
  │  │                                                                │                    │
  │  │  getHitList()                                                   │                    │
  │  │    - Returns running jobs/chatJobs with killRequested=true      │                    │
  │  └────────────────────────────────────────────────────────────────┘                    │
  └────────────────────────────────────────────────────────────────────────────────────────┘

                           │                          ▲
           Reactive subscriptions (WebSocket)          │  Mutations (HTTP/WS)
                           │                          │
                           ▼                          │

  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ RUNNER DAEMON  (local machine, trusted)                                                │
  │                                                                                        │
  │  Subscribes to:                                                                        │
  │    1. scheduler.getReadyJobs     → processQueue()                                      │
  │    2. scheduler.getReadyChatJobs → processChatQueue()                                  │
  │    3. scheduler.getHitList       → processHitList() (kill signals)                     │
  │                                                                                        │
  │  ┌─────────────────────────────────────────────────────────────────────────┐           │
  │  │ HARNESS EXECUTOR (file-based event streaming, crash-resilient)          │           │
  │  │                                                                         │           │
  │  │   Spawns AI processes per job:                                          │           │
  │  │     claude  → headless: claude --print --output-format stream-json     │           │
  │  │             → interactive: PTY driver + explicit --settings hooks      │           │
  │  │     codex   → codex --json                                             │           │
  │  │     gemini  → gemini-cli                                               │           │
  │  │                                                                         │           │
  │  │   Events → Metrics (toolCallCount, subagentCount, context pressure)    │           │
  │  │   File-based logging for orphan recovery on crash                       │           │
  │  │   Idle timeout + max duration timeout                                   │           │
  │  └─────────────────────────────────────────────────────────────────────────┘           │
  │                                                                                        │
  │  ASSIGNMENT JOB LIFECYCLE:                                                             │
  │                                                                                        │
  │    Job pending ──▶ start ──▶ running ──▶ complete ──▶ done ──▶ spawn reflection fork  │
  │                                  │                                                     │
  │                                  ├──▶ fail    ──▶ failed  ──▶ spawn reflection fork   │
  │                                  ├──▶ timeout ──▶ failed  (idle or max-duration)      │
  │                                  └──▶ rate limit / 529 ──▶ awaiting_retry ──▶ pending │
  │                                       (server-side timer, backoff ≤30m, uncapped;     │
  │                                        group stays in progress — no PM spawn)         │
  │                                                                                        │
  │  GROUP COMPLETION FLOW:                                                                │
  │                                                                                        │
  │    All jobs in group terminal?                                                         │
  │      │                                                                                 │
  │      ├── Group has PM job ──▶ Trigger Guardian eval (if thread in guardian mode)       │
  │      │                        If no nextGroup, check assignment completion ──▶         │
  │      │                        post executive summary into originating jam/cook thread  │
  │      │                                                                                 │
  │      ├── Has nextGroup ──▶ Scheduler picks up next group automatically                │
  │      │                                                                                 │
  │      └── No nextGroup, not PM ──▶ Auto-insert PM group after ──▶ PM reviews results   │
  │                                                                                        │
  │  CHAT JOB LIFECYCLE:                                                                   │
  │                                                                                        │
  │    User sends message ──▶ chatJobs.trigger ──▶ pending ──▶ Runner picks up            │
  │      ──▶ running ──▶ complete ──▶ save response as assistant message                  │
  │                                   save sessionId (routed by mode):                     │
  │                                     jam/cook → claudeSessionId                         │
  │                                     guardian → guardianSessions[assignmentId]           │
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ CLI  (.agents/tools/workflow/cli.ts)                                                   │
  │                                                                                        │
  │  Agents (PM, PO, Engineer) call CLI during their execution:                            │
  │                                                                                        │
  │    cli.ts create "North Star"         →  Creates assignment, links to thread           │
  │    cli.ts insert-job <id> --type impl →  Adds group+job to chain tail                 │
  │    cli.ts update-assignment --status  →  Change status, artifacts, decisions            │
  │    cli.ts update-assignment --nudge   →  Set PM nudge (guardian/user)                  │
  │    cli.ts update-assignment --append-northstar → Amend north star mid-flight           │
  │    cli.ts assignment --nudge          →  PM reads nudge (lightweight, env var aware)   │
  │    cli.ts chat-send <thread> <msg>    →  Send message, trigger chatJob                │
  │    cli.ts chat-mode <thread> cook     →  Switch thread mode                            │
  │                                                                                        │
  │  Fan-out: job types whose namespace harnessDefaults entry is an array (e.g. review)   │
  │  expand to one job per entry at insert time; harness+model are stamped on the job.    │
  │  PM self-fanned duplicates collapse back to one canonical fan-out (contexts merged).  │
  │                                                                                        │
  │  ENV vars set by runner give context:                                                  │
  │    WORKFLOW_ASSIGNMENT_ID, WORKFLOW_GROUP_ID, WORKFLOW_JOB_ID, WORKFLOW_THREAD_ID      │
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ THREAD MODES (how human<>agent interaction works)                                      │
  │                                                                                        │
  │  ┌──────────┐    ┌──────────┐    ┌────────────┐                                       │
  │  │   JAM    │    │   COOK   │    │  GUARDIAN   │                                       │
  │  │          │    │          │    │             │                                       │
  │  │ Read-only│    │ Can make │    │ Watches an  │                                       │
  │  │ ideation │    │ assign-  │    │ assignment. │                                       │
  │  │ + spec.  │    │ ments &  │    │ PM results  │                                       │
  │  │ No side  │    │ jobs.    │    │ auto-inject │                                       │
  │  │ effects. │    │ Full CLI │    │ as messages.│                                       │
  │  │          │    │ access.  │    │ PO evaluates│                                       │
  │  └──────────┘    └──────────┘    │ alignment.  │                                       │
  │                                   └─────────────┘                                       │
  │                                                                                        │
  │  Differential Prompting:                                                               │
  │    - New session     → full system prompt + mode prompt                                │
  │    - Mode changed    → mode activation prompt only (session resumed)                   │
  │    - Same mode       → minimal (just user message, session resumed)                    │
  │    - Guardian eval   → special guardian prompt with PM report                           │
  │                                                                                        │
  │  Session Isolation (Guardian Fork):                                                    │
  │    - jam/cook        → resumes claudeSessionId (OG session)                            │
  │    - guardian         → resumes guardianSessions[assignmentId]                          │
  │      - First eval    → --resume <OG> --fork-session (creates branch)                   │
  │      - Subsequent    → --resume <guardian fork> (accumulates eval context)              │
  │    - Per-assignment  → each assignment gets its own guardian fork                       │
  │    - Mode switching  → instant, non-destructive (OG and forks coexist)                 │
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ THE OPERATING LOOP (humans + agents as one machine)                                    │
  │                                                                                        │
  │  ROLES — four agents and one human, each layer missing something on purpose:           │
  │                                                                                        │
  │    USER      intent, taste, priorities. Only the user resolves a Block.                │
  │    STEWARD   (PO agent, in the user's thread) authors intent as a north star;          │
  │              the pre-assignment structural pass + gap hunt happen HERE, in jam.        │
  │    PM        adjudicates ONE job run and Decides the next group. Stateless: sees       │
  │              north star + Artifacts/Decisions + latest run only. No cross-cycle memory.│
  │    CREW      plan / implement / review / uat / document. Execute the brief; never      │
  │              insert jobs or change status.                                             │
  │    GUARDIAN  the Steward's per-assignment fork. The only layer with memory across PM   │
  │              cycles → it is the drift detector AND the circuit breaker (ripcord=Block).│
  │                                                                                        │
  │  STAGES AND GATES:                                                                     │
  │                                                                                        │
  │    1 JAM      user thinks out loud ◄─▶ Steward reads mental-model.md, hunts gaps,      │
  │               drafts acceptance criteria. Gate: user says "cook it".                   │
  │    2 COOK     Steward `create` north star (one-liner + user rationale + cucumber +     │
  │               acceptance criteria + refs) ──▶ `insert-job` head job (usually plan).    │
  │               Steward updates mental-model.md with new intent. Gate: assignment exists.│
  │               (1-file tweaks: Steward does them in-thread, no assignment.)             │
  │    3 CHAIN    crew group ──▶ auto PM ──▶ crew group ──▶ auto PM ──▶ ...                │
  │               PM harvests Artifacts/Decisions, picks next group via pm-modules/*.md.   │
  │               Gate per cycle: PM Decides insert | complete | block.                    │
  │    4 WATCH    every PM result ──▶ guardian fork evaluates: aligned | hold (sense) |    │
  │               nudge (pmNudge, consumed by next PM) | block (ripcord → user).           │
  │               User can also nudge or amend the north star from the UI mid-flight.      │
  │    5 CLOSE    PM completes only after an approved COMPLETION REVIEW group              │
  │               (review + document + uat if UX). Runner posts an executive summary       │
  │               into the originating jam/cook thread.                                    │
  │    6 REFLECT  every non-chat job forks a throwaway session that writes an ergonomics   │
  │               reflection (sampled ~100/namespace/engine version). Aggregates are read  │
  │               in jam by user + Steward; edits to templates/AOP are authored there,     │
  │               never by an autonomous loop. Feeds stage 1 of the NEXT assignment.       │
  │                                                                                        │
  │  WHERE THINGS SURFACE:                                                                 │
  │    Block ──▶ assignment status pill + guardian thread; runner skips blocked assignments│
  │    Rate limit / 529 ──▶ awaiting_retry (a pause, not a failure; no PM spawn)           │
  │    Failed group ──▶ PM spawns with "diagnose and recover"; guardian sees the pattern   │
  │    Chat reply (audio toggle on) ──▶ notify fork ──▶ Slipgate push, inline reply        │
  │                                                                                        │
  │  TYPICAL CHAIN:                                                                        │
  │                                                                                        │
  │    ┌─────┐ next ┌─────────┐ next ┌────┐ next ┌──────┐ next ┌────┐ next ┌──────────┐    │
  │    │plan │─────▶│review   │─────▶│ PM │─────▶│impl  │─────▶│ PM │─────▶│review+uat│ ...│
  │    │     │      │A  B  C  │      │    │      │      │      │    │      │+document │    │
  │    └─────┘      └─────────┘      └────┘      └──────┘      └────┘      └──────────┘    │
  │    ▲ head job inserted by Steward      fan-out from namespace harnessDefaults;         │
  │      in cook mode                      results anonymised (review A/B/C)               │
  │                                                                                        │
  │  PM NUDGE FLOW:                                                                        │
  │    Guardian/User writes nudge ──▶ pmNudge field on assignment                          │
  │    Next PM starts ──▶ reads nudge via CLI ──▶ factors into decision                    │
  │    PM addresses nudge ──▶ clears via CLI   (or leaves for next PM if can't address)    │
  │                                                                                        │
  │  INDEPENDENT vs SEQUENTIAL:                                                            │
  │    Sequential assignments queue (one active per namespace). `independent` ones run     │
  │    concurrently in the SAME working tree — reserved for research/documentation work    │
  │    that touches no code, so there is nothing to collide on.                            │
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ DATA RELATIONSHIPS (Entity Map)                                                        │
  │                                                                                        │
  │  namespace ──1:N──▶ assignments ──1:N──▶ jobGroups ──1:N──▶ jobs                      │
  │      │                   ▲                    │                                         │
  │      │                   │ assignmentId        │ nextGroupId (linked list)              │
  │      │                   │                    ▼                                         │
  │      │              chatThread ◄── focus ptr ── assignmentsCreated[]                   │
  │      │                   │                                                             │
  │      ├──1:N──▶ chatThreads ──1:N──▶ chatMessages                                      │
  │      │                   │                                                             │
  │      └──1:N──▶ chatJobs ◄────────── threadId (1 thread : N chatJobs over time)        │
  │                                                                                        │
  │  chatJobs are INDEPENDENT from assignment jobs.                                        │
  │  chatJobs power the thread conversation.                                               │
  │  assignment jobs power the work execution chain.                                       │
  └────────────────────────────────────────────────────────────────────────────────────────┘
```
