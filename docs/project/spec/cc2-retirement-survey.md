# CC2 Retirement Survey

**Status:** Recommendation — for user review. No retirement action is taken in this assignment; a separate follow-on assignment will execute against the conclusions you sign off on.
**Author:** Planning Architect
**Date:** 2026-05-13

---

## What CC2 was, what replaced it

**CC2** ("Subagent Comms & Observability") was a SQLite-backed Bun event hub at `apps/server/` (HTTP+WS on `localhost:4000`) paired with a Vue 3 observability dashboard at `apps/client/` (`localhost:5173`). Claude Code agents fed it via Python hook scripts in `.claude/hooks/` — `observability/send_event.py` captured every PreToolUse / PostToolUse / Notification / Stop / SubagentStop / UserPromptSubmit hook to the server, and `comms/{send_message,get_unread_messages,register_subagent,update_subagent_completion}.py` ran inter-agent broadcast comms through that same server. The whole stack was wired together by the `.claude/settings.json` hook config and brought up via `scripts/start-system.sh` / `scripts/reset-system.sh` / `scripts/test-system.sh`. **CC2 has been functionally replaced** by the peer-comms CLI at `.agents/tools/workflow/agent-comms.mjs` (Convex-backed, cursor-tracked, namespace-aware) for inter-agent messaging, and by the Convex workflow engine (`workflow-engine/` + `convex/`) plus its UI at `:3500` for orchestration and observability. Nothing in `.agents/`, `workflow-engine/`, or `convex/` depends on CC2.

## Current state (evidence of dormancy)

- **`.claude/settings.json` is already deleted in the working tree** (`git status --short` shows ` D .claude/settings.json` — working-tree deletion, not yet staged). HEAD shows it was the wiring that invoked every `.claude/hooks/` script on every PreToolUse / PostToolUse / Notification / Stop / SubagentStop / PreCompact / UserPromptSubmit event. With it removed from disk, the entire `.claude/hooks/` tree is **dormant** — the Python scripts still exist on disk but are no longer invoked by the harness.
- `apps/server/` is not started by anything in `.agents/`, `workflow-engine/`, or `convex/`. Its only invokers are `scripts/start-system.sh` and the `cc3-server` slash command.
- `apps/client/` is similarly unreferenced by the new system. Its only inbound runtime dependency is `apps/server/`.

This means the four bucket recommendations below are about cleaning up **inert** code and **stale** docs — there is no live wiring left to unplug first.

---

## Section 1 — Delete

Files/directories that are pure CC2 with no salvageable content. After deletion, the listed inbound references will need their sweep entries (Section 4) addressed in the same change.

### 1.1 `.claude/hooks/` (entire directory)

All nine Python scripts plus `__pycache__`. Dormant since `.claude/settings.json` deletion was staged.

| Path | Rationale |
|---|---|
| `.claude/hooks/comms/send_message.py` | Inter-agent broadcast over CC2 HTTP. Replaced by `agent-comms.mjs post`. |
| `.claude/hooks/comms/get_unread_messages.py` | Inbox polling against CC2. Replaced by `agent-comms.mjs sync`. |
| `.claude/hooks/comms/register_subagent.py` | Pre-Task hook to register subagent. Convex peer-comms has no equivalent — replaced by `--name` flag convention. |
| `.claude/hooks/comms/update_subagent_completion.py` | Post-Task hook to mark subagent complete. Same — no longer needed. |
| `.claude/hooks/observability/send_event.py` | Pumped every hook event into the SQLite store. Convex job records + reflections cover the same need. |
| `.claude/hooks/session-data/intercept_session_id.py` | Captured session IDs at PreToolUse for observability correlation. Convex `jobs.sessionId` is now stamped by the runner directly. |
| `.claude/hooks/session-data/get_session_data.py` | Reader for the session-data files. Same — runner-side. |
| `.claude/hooks/context/session_id.py` | Utility for hook-side session-ID lookup. Dead with the rest. |
| `.claude/hooks/utils/server_config.py` | Resolved `localhost:4000` for the other hooks. Dead with the rest. |
| `.claude/.gitignore` | Only entry is `hooks/utils/__pycache__/` — gone with the hooks. |

**Inbound references** (will become broken links / dangling invocations on deletion — fix in the same change via Sweep/Refresh entries below):
- `.claude/commands/cc3-client.md` — line 125: instructs user to "update `.claude/settings.json` with the same namespace replace ‘claude-comms’ in the sections `--source-app claude-comms`". **(Refresh — see 2.2.)**
- `.claude/commands/cc3-server.md` — entire "Step 1: Start CC2" section. **(Refresh — see 2.1.)**
- `README.md` — `## 🛠️ Quick Commands` table references `.claude` directory copy, hook commands; `🔌 API Quick Reference` includes hook commands. **(Refresh — see 2.3.)**
- `.agents/tools/agent-job/consultant_template.txt` — lines 43, 62 instruct agents to invoke `uv run .claude/hooks/comms/get_unread_messages.py` / `send_message.py`. **(Out of scope per user `.agents/` exclusion — flagged in §5.)**
- `docs/project/archive/agents/{architect,designer,planner,uat}.md`, `archive/agents/util/{meta-agent-builder,session-review}.md` — same hook commands, in archived agent prompts. **(Historical — see §3.)**
- `docs/project/research/cc-harness-analysis.md`, `docs/project/phases/11-CCHarnessAnalysis/*` — hook commands cited as the system-under-analysis. **(Historical — see §3.)**
- `packages/setup-installer/.claude/hooks/...` — bundled copy of hooks shipped by the installer. **(Out of scope — flagged in §5.)**

### 1.2 `apps/server/` (entire directory)

The CC2 Bun + SQLite event hub. Includes:
- `apps/server/index.ts`, `apps/server/src/{db,index,types,test-db-helper}.ts`, `apps/server/src/__tests__/`, `apps/server/__tests__/`
- `apps/server/README.md` (titled "Multi-Agent Observability Server — Real-time Event Processing & Communication Hub")
- `apps/server/CLAUDE.md` (Bun usage notes scoped to apps/server)
- `apps/server/package.json`, `tsconfig.json`, `bun.lock`

**Inbound references:**
- `README.md` — multiple architecture diagram blocks naming "Bun Server :4000 (SQLite)", the CC2 endpoint table, `🛠️ Quick Commands`, `🔌 API Quick Reference / CC2 Endpoints`. **(Refresh — see 2.3.)**
- `scripts/start-system.sh`, `scripts/test-system.sh`, `scripts/reset-system.sh`, `scripts/README.md` — these scripts launch/stop/test it. **(Delete — see 1.4.)**
- `.claude/commands/cc3-server.md` — Step 1 starts it. **(Refresh — see 2.1.)**
- `.claude/commands/cc3-client.md` — final user-facing instruction "Watch real-time observability at the CC2 Dashboard (http://localhost:5173)". **(Refresh — see 2.2.)**
- `.gitignore` (root) — lines 200–206 ignore `apps/server/events.db*` and `apps/server/observability.db*`. **(Sweep — see 4.4.)**
- `apps/client/*` — runtime consumer (HTTP/WS client). **(Delete — see 1.3.)**
- `docs/project/guides/{api-reference,architecture-guide,development-guide,integration-guide,design-system-guide}.md` — document its endpoints, schemas, hooks. **(Delete — see 1.5.)**
- `docs/project/spec/sessions-tab-{requirements,traceability-matrix}.md` — sessions tab requirements against this server. **(Delete — see 1.6.)**

### 1.3 `apps/client/` (entire directory, with one caveat)

The CC2 Vue 3 dashboard at `:5173`. Includes:
- `apps/client/src/{App.vue,main.ts,types.ts,style.css}` plus components, composables, services, styles
- `apps/client/src/components/{EventTimeline,InteractiveSessionsTimeline,AgentDetailPane,SessionsView,ChatTranscript,SubagentComms,FilterPanel,MultiSessionTimeline,PerformanceMonitor,...}` — Vue 3 components against CC2 data shapes
- `apps/client/{index.html,public/,scripts/,tests/,playwright.config.ts,vite.config.ts,vitest.config.ts,tailwind.config.js,postcss.config.js,test-setup.ts,vitest.setup.ts,tsconfig*.json}`
- `apps/client/README.md` (titled "Multi-Agent Observability Dashboard — Interactive Vue 3 Real-time Analytics")
- `apps/client/console-validation-report.md` (validation report for the CC2 dashboard)
- `apps/client/playwright-report/`, `apps/client/screenshots/`, `apps/client/test-results/`

**Caveat — feedback widget tension:** `apps/client/FEEDBACK_WIDGET_SETUP.md` and `apps/client/src/components/FeedbackWidget.vue` are explicitly **out of scope** per user clarification (separate concern, not CC2). But the widget was integrated **into the CC2 dashboard's** Vue app — `vite.config.ts` has dual Vue/React plugin wiring for it, `App.vue` mounts it. **Deleting `apps/client/` therefore also deletes the only place the feedback widget is currently hosted.** Surfaced for review; not catalogued here. See §5.

**Inbound references:**
- `README.md` — "Vue Dashboard :5173" in the architecture diagram, dashboard description in CC2 section, "CC2 Dashboard" links in `📺 Dual Dashboard System`. **(Refresh — see 2.3.)**
- `.claude/commands/cc3-server.md` — Step 1 brings it up via `scripts/start-system.sh`. **(Refresh — see 2.1.)**
- `.claude/commands/cc3-client.md` — "CC2 Dashboard (http://localhost:5173)". **(Refresh — see 2.2.)**
- `scripts/start-system.sh`, `scripts/capture/*`, `scripts/tests/*` — drive / screenshot / test it. **(Delete — see 1.4.)**
- `.agents/tools/README.md` — uses `localhost:5173` as an example URL for the browser tool. **(Out of scope per `.agents/` exclusion — flagged in §5.)**
- `.agents/tools/chrome-devtools/README.md` — same. **(Out of scope.)**

### 1.4 `scripts/` (entire directory)

All CC2 lifecycle, test-data, screenshot, and Playwright scripts. None are referenced by the new system (`.agents/`, `workflow-engine/`, `convex/`).

| Path | Rationale |
|---|---|
| `scripts/start-system.sh` | Brings up `apps/server` (:4000) and `apps/client` (:5173). |
| `scripts/reset-system.sh` | Kills :4000/:5173, cleans SQLite WAL. |
| `scripts/test-system.sh` | Integration test against CC2 endpoints. |
| `scripts/test-event-indicators.js` | Playwright test for CC2 event-indicator UI. |
| `scripts/populate-test-agents.ts` | Seeds CC2 SQLite with test agents/events. |
| `scripts/verify-test-data.ts` | Verifies CC2 seed data. |
| `scripts/performance-regression-testing.ts` | Perf harness for CC2. |
| `scripts/README.md` | Documents the CC2 script suite (titled "🚀 Scripts Documentation - Multi-Agent Observability System"). |
| `scripts/capture/capture-timeline.js` | Screenshot capture of CC2 dashboard. |
| `scripts/capture/capture-sessions-timeline.js` | Same — sessions view. |
| `scripts/tests/test-batch-spacing.js` | CC2 UI test. |
| `scripts/tests/test-prompt-capture.js` | CC2 hook capture test. |
| `scripts/tests/test-prompt-response-ui.js` | CC2 prompt/response UI test. |
| `scripts/tests/test-websocket-realtime.js` | CC2 WS load test. |
| `scripts/tests/html/test-event-indicators.html` | CC2 manual test page. |
| `scripts/tests/html/test-websocket-simple.html` | CC2 manual WS test page. |
| `scripts/tests/playwright/playwright-ui-test.js` | CC2 dashboard E2E. |
| `scripts/tests/playwright/playwright-visual-test.js` | CC2 visual regression. |
| `scripts/tests/playwright/quality-gate-visual-test.js` | CC2 visual gate. |
| `scripts/tests/playwright/test-event-indicators-playwright.js` | CC2 event indicators. |

**Inbound references:**
- `README.md` — `🛠️ Quick Commands` references all three lifecycle scripts; `🧪 Testing & Validation` references `./scripts/test-system.sh`. **(Refresh — see 2.3.)**
- `.claude/commands/cc3-server.md` — Step 1 invokes `./scripts/start-system.sh`. **(Refresh — see 2.1.)**
- `docs/project/guides/{integration-guide,development-guide,api-reference}.md` — instructional references to `start-system.sh` etc. **(Delete — see 1.5.)**

### 1.5 `docs/project/guides/` — five CC2-only guides

These five guides are entirely about CC2 (Multi-Agent Observability). The new workflow-engine docs live at `docs/project/spec/workflow-engine-spec.md`, `docs/project/guides/parallel-job-groups-architecture.md`, `docs/project/guides/orchestration-guide.md`, `docs/project/guides/system-diagram.md` — those are untouched.

| Path | Rationale |
|---|---|
| `docs/project/guides/architecture-guide.md` | "Multi-Agent Observability System — Architecture Guide" (1207 lines). Has an "Archived" banner at top pointing readers to `workflow-engine-spec.md`, but the body remains live, indexed, and linked from current docs. |
| `docs/project/guides/api-reference.md` | "Multi-Agent Observability & Communication System" REST/WS reference. |
| `docs/project/guides/development-guide.md` | "Claude Code Multi-Agent Observability & Communication System" dev guide — covers Bun server / Vue client / Python hooks. |
| `docs/project/guides/integration-guide.md` | How to copy `.claude/` into a client project and wire `settings.json` to CC2. |
| `docs/project/guides/design-system-guide.md` | "Multi-Agent Observability Design System" — Vue 3 + Tailwind component library for `apps/client/`. The new workflow-engine UI is React with no JSX, and its visual identity is the Q palette / Quake brandkit in `docs/project/guides/styleguide/brandkit.jsx` — no patterns transfer. |
| `docs/project/guides/ARCHIVE-README.md` | Index of a "Legacy Documentation Archive" (the `docs/project/guides-archive/` directory referenced by it does **not** exist in the current tree — confirmed via `ls docs/project/`). The README itself relinks to the five guides above. Pure dead-link maintenance. |

**Inbound references** (will need fix in the same change):
- `README.md` — `📚 Documentation Hub` lists all five plus ARCHIVE-README. **(Refresh — see 2.3.)**
- `README.md` line 227 — `[Full API Reference →](docs/project/guides/api-reference.md)` bottom-of-section deep link to `api-reference.md`. **(Refresh — see 2.3.)**
- `apps/server/README.md` — multiple links. **(Delete with apps/server — see 1.2.)**
- `apps/client/README.md` — multiple links. **(Delete with apps/client — see 1.3.)**
- `scripts/README.md` — links into `architecture/`, `api-reference.md`, `development.md`. **(Delete with scripts — see 1.4.)**
- `docs/project/guides/api-reference.md` ↔ `development-guide.md` ↔ `integration-guide.md` ↔ `ARCHIVE-README.md` — cross-references between the five. **(Resolves naturally on deletion.)**
- `docs/project/guides/browsertools-guide.md` — line 657–659 lists Architecture / Development / Integration Guide as "Related Docs". **(Sweep — see 4.5.)**
- `docs/project/guides/prompt-architecture.md` — line 10–11 lists `architecture-guide.md` and `design-system-guide.md` in the Context Primer. **(Sweep — see 4.6.)**
- `.agents/tools/workflow/templates/document.md` — line 36–37 instructs the documenter to create/update `architecture-guide.md` and `design-system-guide.md`. **(Out of scope per `.agents/` exclusion — flagged in §5.)**

### 1.6 `docs/project/spec/` — two CC2 sessions-tab specs

| Path | Rationale |
|---|---|
| `docs/project/spec/sessions-tab-requirements.md` | "Sessions Tab Visualization Requirements Specification" for the CC2 dashboard — has its own "ARCHIVE NOTICE" banner at the top redirecting to `workflow-engine-spec.md`, but still indexes against the live CC2 system. |
| `docs/project/spec/sessions-tab-traceability-matrix.md` | Traceability matrix for the above. |

**Inbound references:** sessions-tab-traceability-matrix.md → sessions-tab-requirements.md (each other only). No outbound references from any current doc.

> `LICENSE` is **not** classified as Delete — the file stays; only the copyright-holder string is swapped. See §4.1 for the surgical wording.

---

## Section 2 — Refresh

Files that mix CC2 + new-system content, or whose skeleton is reusable with surgical edits. Each entry quotes the CC2 passages and proposes the replacement.

### 2.1 `.claude/commands/cc3-server.md`

This slash command currently sets up **both** CC2 and CC3 servers. After CC2 retirement, it should set up only the Convex backend + workflow-engine UI. The bulk of Step 2 (Convex setup, admin password, UI startup) is already CC3-only and stays unchanged; residual CC2 mentions in Step 1, the architecture diagram, the Key files block, Step 3, and "Using the system" are listed below.

**Quote (current Step 1 — DELETE entirely):**
```
## Step 1: Start CC2 (Subagent Comms & Observability)

This launches the Bun backend (SQLite + WebSocket on :4000) and Vue dashboard (:5173).

```bash
nohup ./scripts/start-system.sh > /tmp/comms-server.log 2>&1 &
```

Verify it's running: `curl -s http://localhost:4000/events/recent | head -c 100`

Dashboard will be at http://localhost:5173

## Step 2: Start CC3 (Workflow Engine)
```

**Proposed:** Delete the entire "Step 1: Start CC2" block. Renumber: current Step 2 → Step 1, current Step 3 → Step 2.

**Quote (architecture diagram, lines 12–42 — REWRITE):**
The whole "CC2: Subagent Comms & Observability ┃ CC3: Workflow Engine" two-column ASCII diagram on lines 12–35 needs replacement. Currently:
```
│  CC2: Subagent Comms & Observability        CC3: Workflow Engine│
│  ┌───────────────┐  ┌──────────────┐   ┌───────────┐  ┌──────┐│
│  │ Bun Server    │  │ Vue Dashboard│   │ Convex DB │  │  UI  ││
│  │ :4000 (SQLite)│  │ :5173        │   │ cloud/local│  │:3500 ││
│  │ events, comms │  │ read-only    │   │ jobs,chat │  │manage││
...
**CC2 (Subagent Comms & Observability):** SQLite-backed server + Vue dashboard. Captures all hook events ...

**CC3 (Workflow Engine):** A Convex-powered orchestration layer that sits on top of CC2. ...

**Key point:** CC2 and CC3 servers only need ONE instance running. ...
```

**Proposed:** Replace the whole `# System Architecture` section with a single-column diagram of the workflow engine alone (Convex backend + UI + per-project runner) and drop the "two layers" framing. The system diagram in `docs/project/guides/system-diagram.md` is the canonical reference and can be the source of truth that this command links to.

**Quote (Key files block, line 46–47 — DELETE):**
```
- CC2 server + dashboard: `scripts/start-system.sh` (launches `apps/server` on :4000 and `apps/client` on :5173)
```

**Proposed:** Remove the line. The rest of the `Key files` block (CC3 schema, UI, env, runner, config, client setup command, spec) is correct.

**Quote (Step 3, line 122 — REWRITE):**
```
This copies `.claude/` hooks (for CC2 observability) and `.agents/` tooling (for CC3 workflow) into the project.
```

**Proposed:**
```
This copies `.agents/` tooling (for the workflow engine client) into the project.
```

**Quote (Using the system, line 132 — DELETE):**
```
- **Observability Dashboard** (http://localhost:5173): Watch real-time agent activity, tool use, inter-agent messages
```

**Proposed:** Delete the bullet entirely. The line above it already points users at the Workflow UI at `http://localhost:3500`; no second bullet is needed.

### 2.2 `.claude/commands/cc3-client.md`

The client-install slash command currently installs **both** `.claude/hooks` (for CC2) **and** `.agents/` (for CC3) into a target project. After retirement, it installs only `.agents/` and the workflow engine config.

**Quote (intro, line 9 — REWRITE):**
```
This project repo is a **client** in the multi-agent orchestration system. The servers (CC2 + CC3) run elsewhere as a single shared instance. This client:
```

**Proposed:**
```
This project repo is a **client** in the workflow engine. The Convex workflow engine runs elsewhere as a single shared instance. This client:
```

**Quote (architecture diagram, lines 11–25 — REWRITE):**
```
  Servers (shared, already running)          This Project (client)
  ┌────────────────────────────────┐         ┌──────────────────────────────┐
  │ CC2: localhost:4000            │◄────────│ .claude/hooks (Python)       │
  │   SQLite events, agent comms   │  events │   hook events, agent comms   │
  │                                │         │                              │
  │ CC3: Convex (cloud or local)   │◄────────│ .agents/tools/workflow/      │
  │   jobs, assignments, chat      │  poll   │   runner.ts (daemon)         │
  └────────────────────────────────┘  +write │   - polls for ready jobs     │
```

**Proposed:** Remove the CC2 lane entirely. The diagram becomes a single-server / single-client pair: Convex ↔ runner.ts.

**Quote (Step 2, line 125 — DELETE):**
```
update `.claude/settings.json` with the same namespace replace "claude-comms" in the sections `--source-app claude-comms`
```

**Proposed:** Remove this line. (`.claude/settings.json` is being deleted in 1.1.)

**Quote (Step 5, line 162 — DELETE):**
```
- Watch real-time observability at the **CC2 Dashboard** (http://localhost:5173)
```

**Proposed:** Remove the line. The line above it already points to the workflow monitor TUI (`agent_monitor.py`); the line below points to runner logs. No CC2 replacement needed — Convex job records + reflections cover observability.

### 2.3 `README.md` (root)

The root README is heavily dual-framed (CC2 + CC3 as "two layers"). Largest single Refresh target.

**Quote (Architecture Overview, lines 51–82 — REWRITE):**
The full ASCII diagram in `## 🏗️ Architecture Overview` paints CC2+CC3 as co-equal SERVERS. The two prose blocks below it ("**CC2 (Subagent Comms & Observability):** SQLite-backed Bun server + Vue dashboard..." and "**CC3 (Workflow Engine):** Convex-powered orchestration layer **on top of CC2**...") cement that framing.

**Proposed:** Replace with a single-system diagram of the workflow engine (Convex + UI + runner). Drop the "CC2/CC3" naming convention from the README entirely — the new system is just **Claude Comms / the workflow engine**. The framing "CC3 sits on top of CC2" is now wrong: the workflow engine has no CC2 dependency.

**Quote (Core Components, lines 134–145 — DELETE):**
```
### CC2: Observability & Subagent Comms

#### Observability System
- **Hook Events**: Pre/Post tool use, notifications, user prompts
- **Real-time Capture**: SQLite storage with WebSocket broadcasting
- **Timeline View**: Visual event stream with filtering and search

#### Multi-Agent Communication
- **Agent Registry**: Automatic discovery and session tracking
- **Message Queue**: Inter-agent messaging with read receipts
- **Dashboard Views**: Live communication monitoring
```

**Proposed:** Delete the section. Optionally add a brief "Inter-agent comms" subsection under Core Components pointing to `.agents/tools/workflow/agent-comms.mjs` (one paragraph, links to its `--help`).

**Quote (Integration, lines 146–150 — REWRITE):**
```
### Integration
- **Copy `.claude` directory** to any project for CC2 observability
- **Copy `.agents` directory** for CC3 workflow engine client
- **Or run `npx claude-comms`** in the target project to install both
- **Start monitoring** - no code changes required
```

**Proposed:** Drop the "copy `.claude`" bullet. Keep `.agents` copy + `npx claude-comms` (with a note that `npx claude-comms` itself needs a corresponding update — see §5, packages/setup-installer).

**Quote (Quick Commands, lines 152–160 — REWRITE):**
```
| `/cc3-server` | Setup and start both CC2 + CC3 servers (guided) |
| `/cc3-client` | Setup and start the workflow runner in a project |
| `./scripts/start-system.sh` | Launch CC2 server and dashboard |
| `./scripts/reset-system.sh` | Clean shutdown and reset |
| `./scripts/test-system.sh` | System validation |
```

**Proposed:** Delete the three `./scripts/*` rows entirely. Rewrite the `/cc3-server` row's description to drop the "both CC2 + CC3 servers" wording — e.g. `Setup and start the workflow engine server (guided)`. Keep the `/cc3-client` row as-is (its description is already CC3-only). The two slash commands themselves are refreshed per 2.1 and 2.2. Consider renaming `cc3-*` → `setup-*` in a separate retire-CC2/CC3-naming pass; out of scope for this survey.

**Quote (Documentation Hub, lines 162–183 — PRUNE):**
```
### Technical Reference
- [Architecture Guide](docs/project/guides/architecture-guide.md) - System design and components
...
- [API Reference](docs/project/guides/api-reference.md) - Complete endpoint documentation
- [Design System Guide](docs/project/guides/design-system-guide.md) - UI components and patterns

### Multi-Agent Development
...
- [Development Guide](docs/project/guides/development-guide.md) - Contributing and local setup

### Archive
- [Legacy Documentation](docs/project/guides-archive/) - Archived guides and historical documentation
```

**Proposed:** Remove the 5 CC2 guide links (architecture-guide, api-reference, design-system-guide, development-guide, integration-guide) and the broken `guides-archive/` link (which points to a directory that no longer exists in the tree). **Also drop the `[Troubleshooting Guide](docs/project/guides/troubleshooting-guide.md)` line (line 180)** — verified that file does not exist on disk, so the link is broken regardless of CC2 retirement. Fix in the same pass.

**Quote (CC2 Endpoints, lines 187–198 — DELETE):**
```
### CC2 Endpoints (Bun Server :4000)
```bash
# Observability
POST /events              # Submit hook events
GET  /events/recent       # Retrieve event timeline
WS   /stream              # Real-time event stream

# Multi-Agent Communication
POST /subagents/register  # Register new agent
POST /subagents/message   # Send inter-agent message
POST /subagents/unread    # Get unread messages
```
```

**Proposed:** Delete the section entirely. Keep the CC3 Convex Functions section right below it. Optionally add a peer-comms CLI block (`agent-comms.mjs sync` / `agent-comms.mjs post`) in its place.

**Quote (Hook Commands, lines 218–225 — DELETE):**
```
### Hook Commands
```bash
# Send message between agents
uv run .claude/hooks/comms/send_message.py --sender "AgentName" --message "Hello"

# Check for unread messages
uv run .claude/hooks/comms/get_unread_messages.py --name "AgentName"
```
```

**Proposed:** Delete entirely.

**Quote (Testing & Validation, lines 229–246 — PRUNE):**
```
# System validation
./scripts/test-system.sh

# CC2 manual event test
curl -X POST http://localhost:4000/events ...

# CC2 multi-agent communication test
python3 .claude/hooks/comms/send_message.py --sender "Agent-Alpha" --message "Test message"
```

**Proposed:** Delete the three CC2 test invocations. Keep the CC3 workflow CLI test below.

**Quote (System Requirements, lines 247–262 — PRUNE):**
```
- **[Bun](https://bun.sh/)** - JavaScript runtime for CC2 server
...
### Server Ports
- **CC2 Server**: `localhost:4000` (Bun HTTP/WebSocket - events & agent comms)
- **CC2 Dashboard**: `localhost:5173` (Vue dev server - observability)
```

**Proposed:** Drop the Bun prerequisite (unless retained for `.agents/` tooling — verify; current `.agents/tools/workflow/agent-comms.mjs` runs under Node). Drop the two CC2 port entries from "Server Ports".

**Quote (Zero-Code Integration, lines 283–287 — REWRITE):**
```
### 🧠 Zero-Code Integration
- **Copy `.claude` + `.agents` Directories**: Instant observability + workflow for any project
- **Hook-Based Architecture**: No code modifications required
- **Automatic Agent Discovery**: Self-registering agents with session tracking
- **Per-Project Namespaces**: Each repo gets its own namespace in the shared backend
```

**Proposed:** Drop the "Copy `.claude`" bullet and the "Hook-Based Architecture" bullet (both are pure CC2). "Automatic Agent Discovery" no longer applies — agents are registered by `--name` convention through `agent-comms.mjs`, not auto-discovered; drop it. Keep "Per-Project Namespaces" — namespaces remain a workflow-engine concept. Consider retitling the section away from "Zero-Code Integration" — the workflow engine still requires copying `.agents/` and editing `config.json`, so the original framing was already aspirational.

**Quote (Advanced Communication Bus, lines 298–302 — REWRITE):**
```
### 🎯 Advanced Communication Bus
- **Inter-Agent Messaging**: Agents broadcast discoveries, ask questions, coordinate work
- **Message Queue with Receipts**: Guaranteed delivery with read tracking
- **Shared Knowledge Base**: SQLite-backed memory accessible to entire swarm
- **Real-Time Routing**: WebSocket-based instant message delivery
```

**Proposed:** Replace the four CC2 bullets with a single paragraph pointing to the peer-comms CLI at `.agents/tools/workflow/agent-comms.mjs` — Convex-backed, cursor-tracked inter-agent messaging, namespace-aware. Drop the SQLite / WebSocket framing entirely (neither applies to the new system).

**Quote (Dual Dashboard System, lines 304–306 — REWRITE):**
```
### 📺 Dual Dashboard System
- **CC3 Workflow UI**: Chat interface, assignment management, job chain visualization ...
- **CC2 Observability Dashboard**: Live event timeline, session visualization, agent communications, advanced filtering and search
```

**Proposed:** Retitle to "Workflow Engine UI" — single, not dual. Delete the CC2 bullet.

**Quote (Complete Observability table, lines 289–297 — PRUNE):**
The table relies on the CC2 PreToolUse / PostToolUse / UserPromptSubmit / Notification / SubagentStop capture pipeline. Without CC2, these events are no longer captured anywhere (Convex job records cover job-level metadata, not per-tool-call). Either delete the section or replace with a description of what the workflow engine *does* surface (job lifecycle, tool counts, token counts, reflections).

**Proposed:** Delete the table; replace with one paragraph on workflow-engine job-level observability (links to `docs/project/spec/reflection-feedback-spec.md`).

### 2.4 `docs/project/guides/browsertools-guide.md` (line 657–659)

Currently:
```
- Architecture Guide: `architecture-guide.md`
- Development Guide: `development-guide.md`
- Integration Guide: `integration-guide.md`
```

**Proposed:** Delete the three bullets (they point to CC2 guides being deleted). Surrounding "Related Docs" section can stay.

### 2.5 `docs/project/guides/prompt-architecture.md` (line 10–11)

Currently the Context Primer block tells templates to align with:
```
  - `docs/project/guides/architecture-guide.md`
  - `docs/project/guides/design-system-guide.md`
```

**Proposed:** Delete both lines. The Context Primer should align with `mental-model.md` (already listed on line 9), `system-diagram.md`, and `workflow-engine-spec.md` instead. Surgical replacement:
```
  - `docs/project/guides/system-diagram.md`
  - `docs/project/spec/workflow-engine-spec.md`
```

---

## Section 3 — Historical (Keep)

Phase docs, research docs, and archived agent prompts that mention CC2 as part of the project's recorded history. These **stay untouched** — they describe what existed at the time of writing, and that historical accuracy is the point.

| Path | Why historical, not stale |
|---|---|
| `docs/project/research/cc-harness-analysis.md` | 2026-04-02 research report comparing CC's native harness model to "Our System" (the CC2 HTTP comms + Python hooks). The whole point of the analysis is the CC2-as-it-stood baseline — rewriting it post-retirement would erase the comparison frame that justifies the architectural decisions that followed. |
| `docs/project/phases/11-CCHarnessAnalysis/README.md` | Phase entry doc for the same research effort. |
| `docs/project/phases/11-CCHarnessAnalysis/cc-harness-research-spec.md` | Research spec scoping the analysis. |
| `docs/project/phases/11-CCHarnessAnalysis/WP2-subagent-comms-deep-dive.md` | The subagent-comms deep dive that captured the ~2,620-token/agent CC2 cost (referenced in `mental-model.md` lineage). |
| `docs/project/phases/11-CCHarnessAnalysis/WP3-capability-gap-inventory.md` | Capability gap inventory pulled from CC source. |
| `docs/project/phases/11-CCHarnessAnalysis/wp4-wp5-friction-conflicts-antirec.md` | Friction/anti-recommendation analysis. |
| `docs/project/archive/agents/{architect,designer,planner,uat}.md`, `docs/project/archive/agents/util/{meta-agent-builder,session-review,feedback-executor}.md`, `docs/project/archive/agents/consultants/{codex,gemini}.md` | Archived multi-hat agent prompts. They invoke `.claude/hooks/comms/*` because that *was* the comms layer when these prompts were authored. The whole `docs/project/archive/` directory is labelled archive — its purpose is preserving the older system shape. |
| `docs/project/archive/prompts/{analyse-document,await-feedback,await-feedback-orchestrator,CLAUDE,cook,feedback,hello-world,uat-refine}.md` | Same. (Most don't reference CC2 directly, but they belong to the same archived era.) |
| `docs/project/phases/01-ProductOwnerChat/architecture-plan.md`, `01-WorkflowEngineTest/workflow-test-northstar.md`, `06-ParallelJobGroups/assessment.md`, `08-BrandkitTransformation/{spec,wp3-effects-layer-spec}.md`, `09-PasswordWall/spec.md`, `10-OperationsCenterUpgrade/spec.md`, `12-UncapJobChain/{completion-summary,spec-two-tier-subscriptions}.md`, `workflow-ui-rebuild/implementation-plan.md` | Phase docs without CC2 content. Listed for completeness — they're recorded history, leave alone. |
| `docs/project/features/{guardian-session-fork,phoenix-usurp}.md` | Feature design docs for the new system. No CC2 content; just inventoried. |
| `docs/spec/multi-agent-orchestration.md`, `docs/spec/principles.md` | Orchestration philosophy docs. No CC2 content. |
| `docs/tech-docs/{claude-code-hooks,claude-code-subagents,mcp}.md` | Anthropic vendor documentation copies. Not our system. |
| `docs/options/eng-prompt.md` | Engineer prompt sketch. No CC2 content. |

---

## Section 4 — Sweep

One-line incidental mentions to fix.

### 4.1 `LICENSE` (line 3)

**Current:** `Copyright (c) 2025 Claude Code Multi-Agent Observability & Communication System`
**Fix:** Replace string with the post-retirement project name (e.g. `Copyright (c) 2025-2026 Claude Comms`). User decides exact wording.

### 4.2 Root `package.json`

**Reviewed:** Contains only `convex` devDependency + `packageManager`. No CC2 references. **No change needed.**

### 4.3 Root `CLAUDE.md`

**Reviewed:** Only operating-environment notes for the Explore agent and Claude Code harness. No CC2 references. **No change needed.**

### 4.4 Root `.gitignore` (lines 200–206)

**Current:**
```
# Server database files
apps/server/events.db
apps/server/events.db-shm
apps/server/events.db-wal
apps/server/observability.db
apps/server/observability.db-shm
apps/server/observability.db-wal
```
**Fix:** Delete all 7 lines (section header + 6 paths) — `apps/server/` is going away. The generic `*.db`, `*.db-shm`, `*.db-wal` block earlier in the file (lines 167–169) already covers the pattern if a stray SQLite file appears anywhere else.

### 4.5 `docs/project/guides/browsertools-guide.md`

Covered in §2.4 (Refresh) — three "Related Docs" bullets to delete.

### 4.6 `docs/project/guides/prompt-architecture.md`

Covered in §2.5 (Refresh) — two Context Primer lines to swap.

### 4.7 `.claude/.gitignore`

**Current contents:** `hooks/utils/__pycache__/`
**Fix:** Deletes naturally when `.claude/hooks/` is removed (§1.1). The file itself can stay (empty) or be removed; either is fine.

### 4.8 `apps/server/CLAUDE.md` and `apps/client/console-validation-report.md`

Both live inside Delete targets (apps/server/, apps/client/) and disappear with them. Mentioned here only so they're not missed in a count.

---

## Section 5 — Out of scope, but checked

Items the surveyor explicitly considered, intentionally **did not catalog** in §1–§4, and is flagging for the reviewer's situational awareness.

### 5.1 Browser tools (`.agents/tools/chrome-devtools/`)
- Per user clarification: out of scope.
- `.agents/tools/chrome-devtools/README.md` uses `http://localhost:5173/` as an example URL because that *was* the CC2 dashboard. After CC2 retirement, that example URL refers to nothing. Not catalogued; flagged here in case the user wants a one-line example swap in a later pass.
- `.agents/tools/README.md` has the same example URL in its quick-start snippet.

### 5.2 Annotated feedback / feedback widget (`apps/client/FEEDBACK_WIDGET_SETUP.md`, `apps/client/src/components/FeedbackWidget.vue`, `install-feedback-widget` skill, `action-feedback-item` skill)
- Per user clarification: out of scope (separate concern, not CC2).
- **However**, the feedback widget was integrated **into the CC2 Vue dashboard at `apps/client/`** — `apps/client/vite.config.ts` carries Vue+React dual-plugin wiring for it, `apps/client/src/App.vue` mounts `FeedbackWidget.vue`, and `apps/client/.env` carries `VITE_CONVEX_URL` + `VITE_FEEDBACK_ENABLED`. **Deleting `apps/client/` (per §1.3) therefore deletes the only host currently serving the feedback widget.**
- This survey does **not** catalog FEEDBACK_WIDGET_SETUP.md or FeedbackWidget.vue under Delete. The reviewer needs to decide: (a) rehost the widget elsewhere before deleting `apps/client/`, (b) accept the widget going dormant alongside `apps/client/`, or (c) preserve `apps/client/` (or a stripped-down successor) as the widget's host.

### 5.3 `.agents/` peer-comms migration tail
- Per user clarification: `.agents/` is the new system; out of scope.
- Two files in `.agents/` still reference the CC2 hooks layer and will be effectively dangling references once `.claude/hooks/` is deleted in §1.1:
  - `.agents/tools/agent-job/consultant_template.txt` (lines 43, 62): instructs consultant agents to invoke `uv run .claude/hooks/comms/get_unread_messages.py --name "..."` and `uv run .claude/hooks/comms/send_message.py --sender "..." --message "..."`. After §1.1, these commands will fail. The functional replacement is `agent-comms.mjs sync` / `agent-comms.mjs post`.
  - `.agents/tools/workflow/templates/document.md` (lines 36–37): points the documenter at `docs/project/guides/architecture-guide.md` and `design-system-guide.md` (Delete targets in §1.5).
- Flagged so a separate retirement assignment can pick these up.

### 5.4 `workflow-engine/`, `convex/`, root `convex` symlink
- Per user clarification: this is the new system. Confirmed via grep: zero references to CC2, `apps/server`, `apps/client`, `scripts/start-system`, `localhost:4000`, `localhost:5173`, `send_event`, or `register_subagent` anywhere under `workflow-engine/` or `convex/`.
- The deploy symlink `convex -> workflow-engine/convex` at repo root is required for `npx convex deploy` per `MEMORY.md` — **untouched**.

### 5.5 `packages/setup-installer/` — published `npx claude-comms` installer
- Not in the user's stated CC2 surface (`.claude/hooks/`, `apps/server/`, `apps/client/`, `scripts/`) and not in the user's stated out-of-scope list either.
- This is the npm package that powers `npx claude-comms` (referenced in the root README). It currently **bundles a copy of CC2** — `packages/setup-installer/.claude/hooks/observability/send_event.py`, `packages/setup-installer/.claude/hooks/session-data/get_session_data.py`, `packages/setup-installer/.claude/settings.json`, plus templates, mocks, and tests that exercise the CC2 install path. So when a user runs `npx claude-comms` in a client repo, it **installs CC2 hooks**.
- This survey does **not** catalogue `packages/setup-installer/` in §1–§4 because (a) it's outside the user's stated CC2 surface and (b) the user has framed CC2 retirement as cleanup of *this* repo, not of the published installer's published surface.
- **Surfaced for review:** retiring CC2 in this repo without a corresponding update to the installer means new `npx claude-comms` runs will continue to install dead CC2 hook scripts into client repos. A separate "retire CC2 from the installer / re-publish" assignment is warranted.

### 5.6 `docs/project/spec/mental-model.md`
- Per user instruction: untouched. Confirmed via inspection: contains zero CC2 / Multi-Agent Observability references. CC2 is genuinely not in the mental model.

### 5.7 `_research/claude-code-harness/`
- Repo-wide grep for `localhost:4000` / `send_event` returns 3 hits in this tree: `_research/claude-code-harness/constants/product.ts:6`, `_research/claude-code-harness/constants/oauth.ts:145–154`, `_research/claude-code-harness/utils/teleport.tsx:1195`.
- These are **NOT CC2**. `_research/claude-code-harness/` is a forked/reverse-engineered copy of the upstream Claude Code harness, preserved for analysis. The `localhost:4000` string is the upstream Claude AI local-frontend port (different system, same port number by coincidence), and `send_event` is generic upstream terminology, not the `.claude/hooks/observability/send_event.py` script.
- **No change needed.** Listed here so the reviewer knows the grep was reconciled and this tree was checked.

---

## Recommendation summary

| Bucket | File count | Notes |
|---|---:|---|
| Delete | ~80 files across `.claude/hooks/` (10), `apps/server/` (~10), `apps/client/` (~50+ Vue components/tests/configs), `scripts/` (20), `docs/project/guides/` (6), `docs/project/spec/` (2 sessions-tab) | Five `.claude/hooks/` inbound references need Section 2/4 sweep first to avoid broken links / dead commands. |
| Refresh | 5 docs: root `README.md`, `.claude/commands/cc3-server.md`, `.claude/commands/cc3-client.md`, `docs/project/guides/browsertools-guide.md`, `docs/project/guides/prompt-architecture.md` | Specific quotes + proposed wording in §2. |
| Historical (keep) | All of `docs/project/phases/11-CCHarnessAnalysis/`, `docs/project/research/cc-harness-analysis.md`, all of `docs/project/archive/`, all non-CC2 phase docs, `docs/spec/`, `docs/tech-docs/`, `docs/project/features/` | These describe the project's recorded history; rewriting them erases the comparison frame for past decisions. |
| Sweep | `LICENSE` (1 line), root `.gitignore` (7 lines), `.claude/.gitignore` (deletes with hooks). `package.json` and root `CLAUDE.md` checked — no fixes needed. | Covered by Refresh edits where the line lives inside a Refresh target. |
| Out of scope, checked | Browser tools; feedback widget (with apps/client tension); two `.agents/` files that reference CC2; `workflow-engine/`/`convex/`; `packages/setup-installer/` (the installer that bundles CC2 — separately warrants retirement work). | Flagged in §5 so nothing is silently missed. |

The recommended retirement order, when the user is ready to authorize the follow-on assignment:

1. **Refresh edits first** (§2) — README, both `cc3-*` commands, browsertools-guide, prompt-architecture, LICENSE, root .gitignore. This removes all live references to the to-be-deleted CC2 surface so step 2's deletions don't break any inbound links.
2. **Resolve the feedback-widget tension** (§5.2) — user decides rehost / preserve / let-it-go before §3 fires.
3. **Bulk delete** (§1) — `.claude/hooks/`, `apps/server/`, `apps/client/`, `scripts/`, the six CC2 guides, the two sessions-tab specs.
4. **Verify** — `pnpm ts:check`, `pnpm build`, `vercel build --yes`, and a `grep -r "CC2\|Multi-Agent Observability\|localhost:4000\|localhost:5173\|\.claude/hooks\|apps/server\|apps/client\|scripts/start-system"` pass returning only Historical-bucket hits and the items explicitly preserved in §5.
5. **(Separately authorized)** Updates to `.agents/tools/agent-job/consultant_template.txt`, `.agents/tools/workflow/templates/document.md`, `packages/setup-installer/` — three out-of-scope items that should be picked up in a follow-on assignment so the dangling references don't outlive CC2.
