Get the harness runner going

Prerequisite: Initialise check `.agents/tools/workflow/config.json` is configured. if its not, its not yet initialised. Do:
- copy the example and use repo name as namespace, and ask the user for the convex URL and if the namespace is okay or wants a change.
- when you complete config then run command `cd .agents/tools/workflow && npx tsx init.ts` to initialise

Running the harness: check if there is already a runner process (we do not want 2 of them) and start/restart as needed `&& nohup npx tsx runner.ts > /tmp/runner.log 2>&1 &`
- when its running and the agents a cooking, the user (or you) can check in on them directly with TUI `uv run .agents/tools/agent-job/agent_monitor.py`