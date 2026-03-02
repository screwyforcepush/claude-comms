# Workflow Engine — System Diagram

> ASCII architecture diagram of the claude-comms workflow engine.
> For detailed specs see `workflow-engine-spec.md`, `parallel-job-groups-architecture.md`, and `orchestration-guide.md`.

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
  │  │  lastReadAt: (unread track) │   │  independent: bool (parallel vs sequential)   │ │
  │  │  assignmentId ─ ─ ─ ─ ─ ─ ─┼──▶│  artifacts: accumulated output               │ │
  │  │  assignmentsCreated: [...]  │   │  decisions: PM decisions log                  │ │
  │  │  lastPromptMode: jam|cook   │   │  alignmentStatus: aligned|uncertain|misalign  │ │
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
  │  │     claude  → claude --print --output-format stream-json               │           │
  │  │     codex   → codex --json                                             │           │
  │  │     gemini  → gemini-cli                                               │           │
  │  │                                                                         │           │
  │  │   Events → Metrics (toolCallCount, subagentCount, totalTokens)         │           │
  │  │   File-based logging for orphan recovery on crash                       │           │
  │  │   Idle timeout + max duration timeout                                   │           │
  │  └─────────────────────────────────────────────────────────────────────────┘           │
  │                                                                                        │
  │  ASSIGNMENT JOB LIFECYCLE:                                                             │
  │                                                                                        │
  │    Job pending ──▶ start ──▶ running ──▶ complete ──▶ done                            │
  │                                  │                                                     │
  │                                  └──▶ fail    ──▶ failed                              │
  │                                  └──▶ timeout ──▶ failed                              │
  │                                                                                        │
  │  GROUP COMPLETION FLOW:                                                                │
  │                                                                                        │
  │    All jobs in group terminal?                                                         │
  │      │                                                                                 │
  │      ├── Group has PM job ──▶ Trigger Guardian eval (if thread in guardian mode)       │
  │      │                        If no nextGroup, check assignment completion              │
  │      │                                                                                 │
  │      ├── Has nextGroup ──▶ Scheduler picks up next group automatically                │
  │      │                                                                                 │
  │      └── No nextGroup, not PM ──▶ Auto-insert PM group after ──▶ PM reviews results   │
  │                                                                                        │
  │  CHAT JOB LIFECYCLE:                                                                   │
  │                                                                                        │
  │    User sends message ──▶ chatJobs.trigger ──▶ pending ──▶ Runner picks up            │
  │      ──▶ running ──▶ complete ──▶ save response as assistant message                  │
  │                                   save sessionId for resume                            │
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ CLI  (.agents/tools/workflow/cli.ts)                                                   │
  │                                                                                        │
  │  Agents (PM, PO, Engineer) call CLI during their execution:                            │
  │                                                                                        │
  │    cli.ts create "North Star"         →  Creates assignment, links to thread           │
  │    cli.ts insert-job <id> --type impl →  Adds group+job to chain tail                 │
  │    cli.ts update-assignment --status  →  Change status, artifacts, decisions            │
  │    cli.ts chat-send <thread> <msg>    →  Send message, trigger chatJob                │
  │    cli.ts chat-mode <thread> cook     →  Switch thread mode                            │
  │                                                                                        │
  │  Auto-expansion: "review" jobs fan out to claude+codex+gemini (3 parallel jobs)       │
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
  └────────────────────────────────────────────────────────────────────────────────────────┘


  ┌────────────────────────────────────────────────────────────────────────────────────────┐
  │ TYPICAL ASSIGNMENT FLOW (end-to-end)                                                   │
  │                                                                                        │
  │  User in COOK thread ──▶ PO agent creates assignment ──▶ PM inserts first job(s)      │
  │                                                                                        │
  │  ┌─────┐  next  ┌─────────┐  next  ┌────┐  next  ┌───────┐  next  ┌────┐             │
  │  │plan │──────▶│review    │──────▶│ PM │──────▶│impl   │──────▶│ PM │             │
  │  │     │       │A(cl)B(cx)│       │    │       │claude │       │    │             │
  │  │     │       │C(gem)    │       │    │       │       │       │    │             │
  │  └─────┘       └──────────┘       └────┘       └───────┘       └────┘             │
  │                                     │                            │                     │
  │                              PM decides next              PM decides next              │
  │                              job(s) or done               job(s) or done               │
  │                                                                                        │
  │  Guardian thread watching ◄── PM result injected as "pm" message ──▶ PO evaluates     │
  │                                 sets alignmentStatus on assignment                      │
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
