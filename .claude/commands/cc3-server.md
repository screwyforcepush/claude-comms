Start the Claude Comms servers for the user. Guide them through setup.

# System Architecture

The multi-agent system has two layers that work together:

```
                        SERVERS (one instance, this repo)
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  CC2: Subagent Comms & Observability        CC3: Workflow Engine│
  │  ┌───────────────┐  ┌──────────────┐   ┌───────────┐  ┌──────┐│
  │  │ Bun Server    │  │ Vue Dashboard│   │ Convex DB │  │  UI  ││
  │  │ :4000 (SQLite)│  │ :5173        │   │ cloud/local│  │:3500 ││
  │  │ events, comms │  │ read-only    │   │ jobs,chat │  │manage││
  │  └───────┬───────┘  └──────┬───────┘   └─────┬─────┘  └──┬───┘│
  │          │  WebSocket      │                  │  Convex    │    │
  └──────────┼─────────────────┼──────────────────┼────────────┼────┘
             │                 │                  │            │
  ┌──────────┼─────────────────┼──────────────────┼────────────┼────┐
  │          ▼                 ▼                  ▼            ▼    │
  │  CLIENTS (one per project repo, installed via npx claude-comms)│
  │  ┌────────────────────────────────────┐  ┌─────────────────┐   │
  │  │ .claude/hooks (Python)             │  │ runner.ts        │   │
  │  │ - sends events to CC2 server :4000 │  │ - polls Convex   │   │
  │  │ - inter-agent messaging            │  │ - spawns agents  │   │
  │  │ - subagent registration            │  │ - reports results│   │
  │  └────────────────────────────────────┘  └─────────────────┘   │
  │  Each project repo has its own client instance                  │
  └─────────────────────────────────────────────────────────────────┘
```

**CC2 (Subagent Comms & Observability):** SQLite-backed server + Vue dashboard. Captures all hook events (tool use, prompts, notifications), inter-agent messages, and subagent lifecycle. The dashboard at :5173 is a read-only observability view of all agents, their tool use, communications, and parallelisation. Subagents use CLI scripts and hooks to communicate.

**CC3 (Workflow Engine):** A Convex-powered orchestration layer that sits on top of CC2. It manages assignments (work objectives), job groups (parallel execution batches), and jobs (individual agent tasks). The UI lets users chat with a PO agent, create work, and monitor execution. The runner (client-side) polls for ready jobs and spawns agent sessions.

**Key point:** CC2 and CC3 servers only need ONE instance running. Multiple project repos each run their own client that connects back to these shared servers.

# Key files

- CC2 server + dashboard: `scripts/start-system.sh` (launches `apps/server` on :4000 and `apps/client` on :5173)
- CC3 Convex schema: `workflow-engine/convex/schema.ts`
- CC3 UI: `workflow-engine/ui/` (static site, no build step — Convex URL entered at login)
- CC3 Convex env: `workflow-engine/.env` (for cloud deploy)
- Client runner: `.agents/tools/workflow/runner.ts`
- Client config: `.agents/tools/workflow/config.json`
- Client setup command: `.claude/commands/cc3-client.md`
- Spec docs: `docs/project/spec/workflow-engine-spec.md`, `docs/project/spec/workflow-engine-ui-spec.md`

---

# Setup Steps

## Step 1: Start CC2 (Subagent Comms & Observability)

This launches the Bun backend (SQLite + WebSocket on :4000) and Vue dashboard (:5173).

```bash
nohup ./scripts/start-system.sh > /tmp/comms-server.log 2>&1 &
```

Verify it's running: `curl -s http://localhost:4000/events/recent | head -c 100`

Dashboard will be at http://localhost:5173

## Step 2: Start CC3 (Workflow Engine)

### 2a. Choose Convex backend: Cloud vs Local

Ask the user which approach they want:

**Convex Cloud (recommended for multi-machine/docker setups):**
- Backend is hosted, accessible from anywhere (docker containers, remote machines)
- Needs a Convex account and deployment URL
- For production deploy: needs `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` in `workflow-engine/.env`
- Get deployment URL from Convex dashboard after `npx convex deploy`

**Convex Local (simpler, single-machine only):**
- Run `cd workflow-engine && npx convex dev`
- Client and UI must be on the same machine (or use port forwarding)
- Good for trying things out

### 2b. Set the admin password

All Convex functions are protected by a password wall. Set `ADMIN_PASSWORD` as an environment variable in the Convex dashboard:

- **Convex Cloud:** Go to https://dashboard.convex.dev → your deployment → Settings → Environment Variables → Add `ADMIN_PASSWORD`
- **Convex Local:** Add `ADMIN_PASSWORD=<your-password>` to `workflow-engine/.env.local`

This same password must also be set in each client's `config.json` (see `/cc3-client`).

### 2c. Start the Workflow Engine UI

The UI is a static site — no config file needed. The Convex URL and admin password are entered on the login screen and persisted in browser storage (URL in localStorage, password in sessionStorage).

**Local dev:**
```bash
cd workflow-engine/ui && nohup npm start > /tmp/ui-server.log 2>&1 &
```
The UI will be available at http://localhost:3500

**Vercel (hosted):**
Deploy `workflow-engine/ui` as a static site — no build command, no env vars. Users enter the Convex URL and password on first visit.

## Step 3: Guide the user on next steps

Once servers are running, tell the user:

### Setting up a project (client)

For each project repo where the user wants to do work:

1. **Install the hooks and agent tooling:**
   ```bash
   npx claude-comms    # run in the target project root
   ```
   This copies `.claude/` hooks (for CC2 observability) and `.agents/` tooling (for CC3 workflow) into the project.

2. **Start Claude Code in that project and run `/cc3-client`** to configure and start the workflow runner. This will:
   - Set up `.agents/tools/workflow/config.json` with the same Convex URL
   - Initialise the namespace in Convex
   - Start the runner daemon that polls for and executes jobs

### Using the system

- **Workflow UI** (http://localhost:3500): Create namespaces, chat threads, send messages to the PO agent, switch between jam/cook/guardian modes
- **Observability Dashboard** (http://localhost:5173): Watch real-time agent activity, tool use, inter-agent messages