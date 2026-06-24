#!/usr/bin/env bash
# Antigravity hook receiver for the workflow runner.
#
# Hooks are configured globally under ~/.gemini/config/hooks.json. This script is
# intentionally inert unless AGY_HOOK_EVENTS_FILE is present in the agy process
# environment, so unrelated Antigravity sessions are not logged by the runner.
set -u

EVENT_NAME="${1:-unknown}"
EVENTS_FILE="${AGY_HOOK_EVENTS_FILE:-}"
payload="$(cat)"

if [ -n "$EVENTS_FILE" ]; then
  mkdir -p "$(dirname "$EVENTS_FILE")" 2>/dev/null || true
  record="$(
    node -e '
const fs = require("fs");
const eventName = process.argv[1];
const payload = fs.readFileSync(0, "utf8");

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readFinalPlannerResponse(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  const rows = fs.readFileSync(transcriptPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(parseJsonLine)
    .filter(Boolean);

  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (
      row &&
      row.type === "PLANNER_RESPONSE" &&
      row.source === "MODEL" &&
      typeof row.content === "string"
    ) {
      return {
        result: row.content,
        final_response_step_index: row.step_index,
      };
    }
  }
  return null;
}

let parsed;
try {
  parsed = JSON.parse(payload || "{}");
} catch (error) {
  parsed = { parse_error: String(error), raw: payload };
}

const record = {
  hook_event_name: eventName,
  captured_at: new Date().toISOString(),
  ...parsed,
};

if (eventName === "Stop") {
  const final = readFinalPlannerResponse(parsed.transcriptPath);
  if (final) Object.assign(record, final);
}

process.stdout.write(JSON.stringify(record));
' "$EVENT_NAME" <<<"$payload" 2>/dev/null
  )" || record=""

  if [ -n "$record" ]; then
    {
      flock -x 9
      printf '%s\n' "$record" >&9
    } 9>>"$EVENTS_FILE" 2>/dev/null || true
  fi
fi

case "$EVENT_NAME" in
  PreToolUse)
    printf '{"decision":"allow"}\n'
    ;;
  Stop)
    printf '{"decision":"allow"}\n'
    ;;
  PreInvocation|PostInvocation)
    printf '{"injectSteps":[],"terminationBehavior":""}\n'
    ;;
  *)
    printf '{}\n'
    ;;
esac
