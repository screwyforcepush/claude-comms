---
name: setup cc3 server
description: Use only if specifically requested by user. Set up and run a new cc3 server.
---

Start the Claude Comms servers for the user. Guide them through setup.

# System Architecture

The workflow engine is a Convex-powered orchestration system:

```
                        SERVER (one instance, this repo)
  ┌─────────────────────────────────────────────────────────────────┐
  │                          Workflow Engine                         │
  │  ┌───────────┐  ┌──────┐                                       │
  │  │ Convex DB │  │  UI  │                                       │
  │  │ cloud/local│  │:3500 │                                       │
  │  │ jobs,chat │  │manage│                                       │
  │  └─────┬─────┘  └──┬───┘                                       │
  │        │  Convex    │                                           │
  └────────┼────────────┼───────────────────────────────────────────┘
           │            │
  ┌────────┼────────────┼───────────────────────────────────────────┐
  │        ▼            ▼                                           │
  │  CLIENTS (one per project repo, installed via npx claude-comms) │
  │  ┌─────────────────┐                                           │
  │  │ runner.ts        │                                           │
  │  │ - subscribes to  │                                           │
  │  │   Convex backend │                                           │
  │  │ - spawns agents  │                                           │
  │  │ - reports results│                                           │
  │  └─────────────────┘                                           │
  │  Each project repo has its own client instance                  │
  └─────────────────────────────────────────────────────────────────┘
```

**Workflow Engine:** Convex-powered orchestration that manages assignments (work objectives), job groups (parallel execution batches), and jobs (individual agent tasks). The UI lets users chat with a PO agent, create work, and monitor execution. The runner (client-side) subscribes for ready jobs and spawns Claude/Codex/Gemini sessions.

See [System Diagram](docs/project/guides/system-diagram.md) for the full architecture reference.

**Key point:** The workflow engine server only needs ONE instance running. Multiple project repos each run their own client (runner) that connects back to this shared server.

# Key files

- Convex schema: `workflow-engine/convex/schema.ts`
- UI: `workflow-engine/ui/` (static site, no build step — Convex URL entered at login)
- Convex env: `workflow-engine/.env` (for cloud deploy)
- Client runner: `.agents/tools/workflow/runner.ts`
- Client config: `.agents/tools/workflow/config.json`
- Client setup command: `.claude/commands/cc3-client.md`
- Spec docs: `docs/project/spec/workflow-engine-spec.md`, `docs/project/spec/workflow-engine-ui-spec.md`

---

# Setup Steps

## Step 1: Start the Workflow Engine

### 1a. Choose Convex backend: Cloud vs Local

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

### 1b. Set the admin password

All Convex functions are protected by a password wall. Set `ADMIN_PASSWORD` as an environment variable in the Convex dashboard:

- **Convex Cloud:** Go to https://dashboard.convex.dev → your deployment → Settings → Environment Variables → Add `ADMIN_PASSWORD`
- **Convex Local:** Add `ADMIN_PASSWORD=<your-password>` to `workflow-engine/.env.local`

This same password must also be set in each client's `config.json` (see `/cc3-client`).

### 1c. Start the Workflow Engine UI

The UI is a static site — no config file needed. The Convex URL and admin password are entered on the login screen and persisted in browser storage (URL in localStorage, password in sessionStorage).

**Local dev:**
```bash
cd workflow-engine/ui && nohup npm start > /tmp/ui-server.log 2>&1 &
```
The UI will be available at http://localhost:3500

**Vercel (hosted):**
Deploy `workflow-engine/ui` as a static site — no build command, no env vars. Users enter the Convex URL and password on first visit.

## Step 2: Guide the user on next steps

Once servers are running, tell the user:

### Setting up a project (client)

For each project repo where the user wants to do work:

1. **Install the agent tooling:**
   ```bash
   npx claude-comms    # run in the target project root
   ```
   This copies `.agents/` tooling (for the workflow engine client) into the project.

2. **Start Claude Code in that project and run `/cc3-client`** to configure and start the workflow runner. This will:
   - Set up `.agents/tools/workflow/config.json` with the same Convex URL
   - Initialise the namespace in Convex
   - Start the runner daemon that polls for and executes jobs

### Using the system

- **Workflow UI** (http://localhost:3500): Create namespaces, chat threads, send messages to the PO agent, switch between jam/cook/guardian modes
