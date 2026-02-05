Get the harness runner going
1. check `.agents/tools/workflow/config.json` is configured.
if its not configured, copy the example and use repo name as namespace, and ask the user for the convex URL
2. check if there is already a runner process (we do not want 2 of them) and start/restart as needed `&& nohup npx tsx runner.ts > /tmp/runner.log 2>&1 &`

when its running and the agents a cooking, the user (or you) can check in on them directly with TUI `uv run .agents/tools/agent-job/agent_monitor.py`