---
name: cc3 update
description: Use only if specifically requested by user. Update existing cc3 client.
---
Update the workflow runner client with latest changes from upstream.

## Step 1: Stop the runner

Kill the wrapper and runner processes. SIGTERM does not reliably kill the `npm exec → tsx → node` tree (npm exec doesn't propagate signals, and runner.ts may trap SIGTERM for graceful shutdown and hang), so try SIGTERM first, then escalate to SIGKILL for any survivors. Any job agents the runner spawned are orphaned and keep running; that is expected.

One character of each pattern is bracketed on purpose: an agent's shell runs this command via `bash -c '...'`, so a plain `pkill -f 'runner.ts'` also matches, and kills, the agent's own shell.

```bash
pkill -TERM -f 'run-runne[r].sh' 2>/dev/null; pkill -TERM -f 'runner[.]ts' 2>/dev/null
sleep 3
pkill -KILL -f 'run-runne[r].sh' 2>/dev/null; pkill -KILL -f 'runner[.]ts' 2>/dev/null
sleep 1
```

Verify they're stopped (should print only `---done---`):
```bash
ps aux | grep -E 'runner\.ts|run-runner\.sh' | grep -v grep; echo '---done---'
```

If any processes remain after the SIGKILL pass, something external is respawning them — investigate before proceeding.

## Step 2: Pull latest changes

```bash
npx claude-comms
```

This pulls the latest client files from upstream.

## Step 3: Sync Codex custom agents

Regenerate Codex custom agent TOML files from Claude agent definitions:

```bash
node .agents/tools/workflow/sync-codex-agents.mjs
```

## Step 4: Update global CLI tools

Update the same Node/npm install the runner uses. Run npm as the current user first; use sudo only if the global prefix is not writable by you. Under NVM, bare `sudo npm` usually resolves to a different Node and prefix, so it updates a copy the runner never runs.

```bash
node --version
npm config get prefix          # must contain the `claude` that `command -v claude` shows
npm install -g @openai/codex@latest @anthropic-ai/claude-code@latest
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

## Step 5: Restart the runner

Verify that PATH selects the updated Claude and that it supports the runner's required flag before starting the runner. `claude --version` short-circuits argument parsing and passes on any binary, so check the help text instead. Stop and repair the install if this fails.

```bash
command -v claude
claude --version
claude --help | grep -q -- '--permission-prompts' || { echo 'claude too old for runner (no --permission-prompts)'; exit 1; }
```

```bash
nohup bash .agents/tools/workflow/run-runner.sh > /dev/null 2>&1 &
```

Verify it started: `tail -20 /tmp/runner.log`

## Step 6: Commit the client update

The update has likely changed files in the working tree — typically `.agents/` (including the regenerated Codex agent TOMLs from Step 3), `.claude/commands/`, and `CLAUDE.md`. Review `git status` and commit everything the update touched.

For the commit message, read `engineVersion` from `.agents/engine-manifest.json` and reference it, e.g. `chore: update claude-comms client to <engineVersion>`.

Tell the user the client has been updated and the runner is back online.
