Update the workflow runner client with latest changes from upstream.

## Step 1: Stop the runner

Kill the wrapper and runner processes:

```bash
pkill -f 'run-runner.sh' 2>/dev/null; pkill -f 'runner.ts' 2>/dev/null
```

Verify they're stopped:
```bash
ps aux | grep 'runner.ts\|run-runner.sh' | grep -v grep
```

## Step 2: Pull latest changes

```bash
npx claude-comms
```

This pulls the latest client files from upstream.

## Step 3: Restore settings

The previous step overrides `.claude/settings.json` with defaults. Restore the project's version:

```bash
git restore .claude/settings.json
```

## Step 4: Restart the runner

```bash
nohup bash .agents/tools/workflow/run-runner.sh > /dev/null 2>&1 &
```

Verify it started: `tail -20 /tmp/runner.log`

Tell the user the client has been updated and the runner is back online.
