#!/usr/bin/env bash
# Auto-restarting wrapper for the workflow runner daemon.
# Usage: nohup bash .agents/tools/workflow/run-runner.sh > /dev/null 2>&1 &

cd "$(dirname "$0")"

while true; do
  echo "[$(date)] Runner starting..." >> /tmp/runner.log
  npx tsx runner.ts >> /tmp/runner.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Runner exited with code $EXIT_CODE, restarting in 5s..." >> /tmp/runner.log
  sleep 5
done
