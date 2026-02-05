Set up and start the workflow runner client in this project repo.

# What is the client?

This project repo is a **client** in the multi-agent orchestration system. The servers (CC2 + CC3) run elsewhere as a single shared instance. This client:

```
  Servers (shared, already running)          This Project (client)
  ┌────────────────────────────────┐         ┌──────────────────────────────┐
  │ CC2: localhost:4000            │◄────────│ .claude/hooks (Python)       │
  │   SQLite events, agent comms   │  events │   hook events, agent comms   │
  │                                │         │                              │
  │ CC3: Convex (cloud or local)   │◄────────│ .agents/tools/workflow/      │
  │   jobs, assignments, chat      │  poll   │   runner.ts (daemon)         │
  └────────────────────────────────┘  +write │   - polls for ready jobs     │
                                             │   - spawns claude/codex/     │
                                             │     gemini agent sessions    │
                                             │   - reports results back     │
                                             │   config.json (connection)   │
                                             └──────────────────────────────┘
```

The **runner** is a long-lived daemon that subscribes to the Convex backend, picks up ready jobs for this project's namespace, spawns the appropriate agent CLI (`claude`, `codex`, or `gemini`), streams their output, and writes results back. Multiple project repos can each run their own runner against the same Convex backend.

# Key files

- Runner daemon: `.agents/tools/workflow/runner.ts`
- Config: `.agents/tools/workflow/config.json` (created from `config.example.json`)
- Init script: `.agents/tools/workflow/init.ts` (creates namespace in Convex)
- Harness executor: `.agents/tools/workflow/lib/harness-executor.ts`
- Stream handlers: `.agents/tools/workflow/lib/streams.ts`
- Job monitor TUI: `.agents/tools/agent-job/agent_monitor.py`
- Spec: `docs/project/spec/workflow-engine-spec.md`

# How agents are spawned

The runner spawns CLI processes per harness:

- **Claude:** `claude --dangerously-skip-permissions --verbose --output-format stream-json -p "<prompt>"`
- **Codex:** `codex --yolo e "<prompt>" --json`
- **Gemini:** `gemini --yolo -m gemini-2.5-pro --output-format stream-json "<prompt>"`

Each job gets environment variables: `WORKFLOW_ASSIGNMENT_ID`, `WORKFLOW_GROUP_ID`, `WORKFLOW_JOB_ID`.

---

# Setup Steps

## Step 1: Verify harness CLIs are available

Before configuring, check which agent CLIs are installed. Claude is required, Codex and Gemini are optional but enable multi-model orchestration (different models reviewing each other's work).

### Claude (required)
```bash
claude --version
```

### Codex (optional - OpenAI)
```bash
codex --version
```
If not installed, `npm install -g @openai/codex` and ask the user to codex -> auth in terminal

### Gemini (optional - Google)
```bash
gemini --version
```
If not installed, `npm install -g @google/gemini-cli@latest` and ask the user to gemini -> auth in terminal

Tell the user which harnesses are available. If user only wants claude and none/one of the others this system will still work, just not as good quality outcomes.

## Step 2: Configure the client

Check if `.agents/tools/workflow/config.json` exists. If not, create it from the example:

```json
{
  "convexUrl": "<ask the user for their Convex URL - same one used in server setup>",
  "namespace": "<suggest the repo/directory name, ask user to confirm or change>",
  "timeoutMs": 3600000,
  "idleTimeoutMs": 600000,
  "harnessDefaults": {
    "default": "claude",
    "plan": "claude",
    "implement": "claude",
    "review": "claude",
    "uat": "claude",
    "document": "claude",
    "pm": "claude",
    "chat": "claude"
  }
}
```

**Fields to ask the user about:**
- `convexUrl`: The Convex deployment URL (cloud: `https://your-deployment.convex.cloud`, local: whatever `npx convex dev` outputs)
- `namespace`: Identifies this project in the workflow engine. Suggest the current directory name. Must match what they'll use in the Workflow Engine UI.

update `.claude/settings.json` with the same namespace replace "claude-comms" in the sections `--source-app claude-comms`

## Step 3: Initialise the namespace

This creates the namespace in the Convex database if it doesn't already exist:

```bash
cd .agents/tools/workflow && npx tsx init.ts
```

## Step 4: Start the runner

Check if a runner is already running first (we do NOT want duplicates):

```bash
ps aux | grep 'runner.ts' | grep -v grep
```

If one exists, ask the user if they want to restart it. Kill the old one first if so.

Start the runner:

```bash
cd .agents/tools/workflow && nohup npx tsx runner.ts > /tmp/runner.log 2>&1 &
```

Verify it started: `tail -20 /tmp/runner.log`

## Step 5: Tell the user they're ready

The client is now running and listening for jobs in the `<namespace>` namespace.

**How to use it:**
- Open the **Workflow Engine UI** (where the servers are running) to create threads, chat with the PO, and kick off work
- Use `/cook <objective>` in Claude Code to start orchestrated work
- Monitor agent execution with the TUI: `uv run .agents/tools/agent-job/agent_monitor.py`
- Watch real-time observability at the **CC2 Dashboard** (http://localhost:5173)
- Check runner logs: `tail -f /tmp/runner.log`
