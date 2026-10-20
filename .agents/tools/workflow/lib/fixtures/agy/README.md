# agy `--output-format stream-json` captures

Real captures from agy 1.4.2 (2026-10-20). `streams.test.ts` and `metrics.test.ts`
replay these through `AgyStreamHandler` and `recordMetricsEvent("gemini", ...)`.
Prompt was piped on stdin.

Command shape used for the captures (the runner omits `--print-timeout`; its own
max-duration kill is the honest timeout):

```
echo "<prompt>" | agy --dangerously-skip-permissions --disable-slash-commands \
  [--model <slug>] [--conversation <id>] --output-format stream-json --print-timeout 240s
```

| Capture | Exit | What it shows |
|---|---|---|
| `success-resume-conversation.*` | 0 | `--conversation <id>` resume of run 2 under stream-json. Same `conversation_id` in `init` and `result`; the agent recalled both subagent roles. |
| `success-two-subagents.*` | 0 | Full happy path. Prompt: "simple test: spawn two parallel subagents, both to just respond hello world... that is all". Model `gemini-3.8-flash-high`. Run from an empty `/tmp` dir. |
| `success-two-subagents-run2.*` | 0 | Same prompt, second run. Differs in subagent event shape: both spawns surface as `tool ACTIVE` then `subagent DONE` (run 1 had one `subagent ACTIVE`). |
| `success-describe-repo-tools.*` | 0 | Prompt: "describe this repo in one sentence", run from the repo root. 8 real tool calls (`run_command`, `read_file`) with `ACTIVE`/`DONE` pairs and `tool_info.output`. ~105k input tokens. |
| `quota-exhausted.*` | 3 | Individual quota wall. stdout still emits `init` → `step_update(error_message)` → `result{status:"ERROR"}`; stderr carries the `AGY_ERROR: {...}` JSON line with `status`, `error_code`, `retryable`. |
| `invalid-model.*` | 1 | `--model auto-gemini-3` (the old harness default) is rejected at startup. stdout emits only a `result{status:"ERROR"}` with empty `conversation_id`; stderr lists valid models. |

Event vocabulary observed:

- `init`: `conversation_id`, `init.{model, cwd, tools[], permission_mode}`
- `step_update.step_type`: `user_input`, `agent_response` (many `ACTIVE` text deltas then one `DONE` with `usage`), `tool` (`tool_info.{name, parameters}`), `subagent` (`subagent_info.subagents[].{type_name, role, initial_prompt, conversation_id, log_uri, workspace_uris}`), `system_message`, `error_message`
- `result`: `conversation_id`, `status` (`SUCCESS` | `ERROR`), `response`, `error`, `duration_seconds`, `num_turns`, `usage.{input_tokens, output_tokens, thinking_tokens, cache_read_tokens, total_tokens}`

Session id for `--conversation` resume is `init.conversation_id`. Subagent count is the
number of distinct `subagent_info.subagents[].conversation_id` values.

Parser notes from the captures:

- The `ACTIVE` event for a subagent spawn is sometimes `step_type: tool` and sometimes
  `step_type: subagent`; the `DONE` event is always `subagent` with `subagent_info`.
  Key subagents on `subagent_info`, not on step type.
- Tool calls use the same `step_index` for their `ACTIVE` and `DONE` events. Count a tool
  call once per `DONE`.
- `tool_info.output` is the tool's model-facing result: `run_command` carries the full
  command output, `read_file` carries only a summary such as `264 lines, 14974 bytes`.
- `agent_response` `ACTIVE` events are text deltas and dominate the stream (roughly
  three quarters of events). `result.response` holds the complete final text.
- `usage` appears on each `agent_response` `DONE` and aggregated on `result`.
