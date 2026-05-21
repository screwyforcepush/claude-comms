#!/usr/bin/env bash
# Claude Code hook receiver for the workflow runner.
#
# Reads one hook JSON payload from stdin and appends it as one JSONL record to
# HOOK_EVENTS_FILE. Always exits 0 so hook delivery cannot block Claude.
set -u

EVENTS_FILE="${HOOK_EVENTS_FILE:-}"
if [ -z "$EVENTS_FILE" ]; then
  exit 0
fi

mkdir -p "$(dirname "$EVENTS_FILE")" 2>/dev/null || true
payload="$(cat)"

{
  flock -x 9
  printf '%s\n' "$payload" >&9
} 9>>"$EVENTS_FILE" 2>/dev/null || true

exit 0
