/**
 * Tests for stream handlers module
 *
 * Run with: npx tsx --test lib/streams.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AgyStreamHandler,
  ClaudeStreamHandler,
  CodexStreamHandler,
  buildCommand,
  buildInteractiveClaudeCommand,
  parseCodexUsageLimitReset,
} from "./streams.js";

// ============================================================================
// ClaudeStreamHandler tests
// ============================================================================

describe("ClaudeStreamHandler", () => {
  it("extracts text and captures session_id on success", () => {
    const handler = new ClaudeStreamHandler();

    // Simulate event stream
    handler.onEvent({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello" }] },
    });
    handler.onEvent({
      type: "result",
      subtype: "success",
      result: "Final result",
      session_id: "session_123",
    });

    assert.strictEqual(handler.getResult(), "Final result");
    assert.strictEqual(handler.isComplete(), true);
    assert.strictEqual(handler.getSessionId(), "session_123");
  });

  it("does not mark complete on failure", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({ type: "result", subtype: "error" });

    assert.strictEqual(handler.isComplete(), false);
  });

  it("captures rate_limit_event info on rejected rate limit", () => {
    const handler = new ClaudeStreamHandler();

    // Exact sequence from Anthropic rate-limit response
    handler.onEvent({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "rejected",
        resetsAt: 1776243600,
        rateLimitType: "five_hour",
        overageStatus: "rejected",
        overageDisabledReason: "org_level_disabled",
        isUsingOverage: false,
      },
    });
    handler.onEvent({
      type: "assistant",
      message: {
        model: "<synthetic>",
        content: [{ type: "text", text: "You've hit your limit · resets 9am (UTC)" }],
      },
      error: "rate_limit",
    });
    handler.onEvent({
      type: "result",
      subtype: "success",
      is_error: true,
      result: "You've hit your limit · resets 9am (UTC)",
      session_id: "d00aa306-932f-4486-aace-223dad74378a",
    });

    // Terminal but not complete (is_error = true)
    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(handler.getFailureReason(), "claude_result_success");

    // Rate-limit info captured
    const info = handler.getRateLimitInfo();
    assert.ok(info, "getRateLimitInfo should return non-null");
    assert.strictEqual(info!.resetsAt, 1776243600);
    assert.strictEqual(info!.rateLimitType, "five_hour");
  });

  it("captures rate-limit info from a 529 Overloaded terminal result", () => {
    const handler = new ClaudeStreamHandler();

    // Verbatim shape captured from a client repo's 529 death (2026-08-13):
    // synthetic assistant message followed by the terminal result event.
    handler.onEvent({
      type: "assistant",
      message: {
        id: "eb26451b-dfdd-4e44-ab23-b7855f264871",
        model: "<synthetic>",
        role: "assistant",
        stop_reason: "stop_sequence",
        content: [
          {
            type: "text",
            text: "API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment. If it persists, check https://status.claude.com.",
          },
        ],
      },
      error: "server_error",
      session_id: "3f49273e-f23f-4cf6-87cb-dc829d217115",
    });
    const before = Math.floor(Date.now() / 1000);
    handler.onEvent({
      type: "result",
      subtype: "success",
      is_error: true,
      api_error_status: 529,
      duration_ms: 205813,
      num_turns: 1,
      result: "API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment. If it persists, check https://status.claude.com.",
      stop_reason: "stop_sequence",
      session_id: "3f49273e-f23f-4cf6-87cb-dc829d217115",
      terminal_reason: "completed",
    });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);

    const info = handler.getRateLimitInfo();
    assert.ok(info, "getRateLimitInfo should return non-null");
    assert.strictEqual(info!.rateLimitType, "api_error_529");
    // No reset time on server errors: resetsAt = now, so jobs.rateLimited's
    // 60s clamp + backoff schedule drive the retry cadence.
    assert.ok(info!.resetsAt >= before);
    assert.ok(info!.resetsAt <= Math.floor(Date.now() / 1000));
  });

  it("does not retry deterministic 4xx request errors", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({
      type: "result",
      subtype: "success",
      is_error: true,
      api_error_status: 400,
      result: "API Error: 400 prompt is too long",
    });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.getRateLimitInfo(), null);
  });

  it("keeps rate_limit_event reset time over the terminal result's status code", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "rejected",
        resetsAt: 1776243600,
        rateLimitType: "five_hour",
      },
    });
    handler.onEvent({
      type: "result",
      subtype: "success",
      is_error: true,
      api_error_status: 429,
      result: "You've hit your limit",
    });

    const info = handler.getRateLimitInfo();
    assert.ok(info, "getRateLimitInfo should return non-null");
    assert.strictEqual(info!.rateLimitType, "five_hour");
    assert.strictEqual(info!.resetsAt, 1776243600);
  });

  it("does not capture rate_limit_event when status is not rejected", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({
      type: "rate_limit_event",
      rate_limit_info: {
        status: "accepted",
        resetsAt: 1776243600,
        rateLimitType: "five_hour",
      },
    });

    assert.strictEqual(handler.getRateLimitInfo(), null);
  });

  it("parses interactive Stop hook events as successful results", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({
      hook_event_name: "SessionStart",
      session_id: "parent-session",
      source: "resume",
    });
    handler.onEvent({
      hook_event_name: "UserPromptSubmit",
      session_id: "fork-session",
      prompt: "hello",
    });
    handler.onEvent({
      hook_event_name: "Stop",
      session_id: "fork-session",
      last_assistant_message: "done",
    });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), true);
    assert.strictEqual(handler.getResult(), "done");
    assert.strictEqual(handler.getSessionId(), "fork-session");
  });

  it("parses interactive StopFailure hook events defensively", () => {
    const handler = new ClaudeStreamHandler();

    handler.onEvent({
      hook_event_name: "SessionStart",
      session_id: "s123",
    });
    handler.onEvent({
      hook_event_name: "StopFailure",
      session_id: "s123",
      error: "invalid_request",
      last_assistant_message: "bad model",
    });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(handler.getResult(), "bad model");
    assert.strictEqual(handler.getFailureReason(), "claude_stop_failure_invalid_request");
  });
});

// ============================================================================
// CodexStreamHandler tests
// ============================================================================

describe("CodexStreamHandler", () => {
  it("extracts final agent_message text and marks complete on turn.completed", () => {
    const handler = new CodexStreamHandler();

    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "First message" },
    });
    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "Second message" },
    });
    handler.onEvent({ type: "turn.completed" });

    assert.strictEqual(handler.getResult(), "Second message");
    assert.strictEqual(handler.isComplete(), true);
  });

  it("captures thread_id from thread.started for resume", () => {
    const handler = new CodexStreamHandler();

    handler.onEvent({
      type: "thread.started",
      thread_id: "019e1662-7864-7d91-b3f7-663ced63e87d",
    });

    assert.strictEqual(handler.getSessionId(), "019e1662-7864-7d91-b3f7-663ced63e87d");
  });

  it("ignores non-agent_message items", () => {
    const handler = new CodexStreamHandler();

    handler.onEvent({
      type: "item.completed",
      item: { type: "reasoning", text: "Thinking..." },
    });

    assert.strictEqual(handler.getResult(), "");
  });

  it("returns full accumulated trail when no turn.completed (timeout case)", () => {
    const handler = new CodexStreamHandler();

    // Simulate the example: multiple intermediate agent_messages, no turn.completed
    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "Spawning two subagents in parallel." },
    });
    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "Both subagents are started; waiting." },
    });
    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "Ohm: hello world\nMill: hello world" },
    });
    // No turn.completed — simulates a timeout kill

    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(
      handler.getResult(),
      "Spawning two subagents in parallel.\n\nBoth subagents are started; waiting.\n\nOhm: hello world\nMill: hello world"
    );
  });

  it("captures rate-limit info from a usage-limit error/turn.failed sequence", () => {
    const handler = new CodexStreamHandler();

    // Exact sequence from a codex --json run that hit the usage limit
    const limitMessage =
      "You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at Aug 8th, 2026 5:04 AM.";
    handler.onEvent({
      type: "thread.started",
      thread_id: "019fd356-59aa-7681-8606-c28ca627521d",
    });
    handler.onEvent({ type: "turn.started" });
    handler.onEvent({ type: "error", message: limitMessage });
    handler.onEvent({ type: "turn.failed", error: { message: limitMessage } });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);

    const info = handler.getRateLimitInfo();
    assert.ok(info, "getRateLimitInfo should return non-null");
    assert.strictEqual(info!.rateLimitType, "codex_usage");
    // Same local-timezone parse the handler performs
    assert.strictEqual(
      info!.resetsAt,
      Math.floor(new Date("Aug 8, 2026 5:04 AM").getTime() / 1000)
    );
  });

  it("falls back to a now-based reset when the limit message has no timestamp", () => {
    const handler = new CodexStreamHandler();
    const before = Math.floor(Date.now() / 1000);

    handler.onEvent({
      type: "turn.failed",
      error: {
        message:
          "You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits.",
      },
    });

    const info = handler.getRateLimitInfo();
    assert.ok(info, "getRateLimitInfo should return non-null");
    assert.strictEqual(info!.rateLimitType, "codex_usage");
    assert.ok(info!.resetsAt >= before);
  });

  it("marks turn.failed terminal with a failure reason for non-limit errors", () => {
    const handler = new CodexStreamHandler();

    handler.onEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "partial work" },
    });
    handler.onEvent({
      type: "turn.failed",
      error: { message: "stream disconnected" },
    });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(handler.getRateLimitInfo(), null);
    assert.strictEqual(handler.getFailureReason(), "codex_turn_failed: stream disconnected");
    assert.strictEqual(handler.getResult(), "partial work");
  });
});

// ============================================================================
// parseCodexUsageLimitReset tests
// ============================================================================

describe("parseCodexUsageLimitReset", () => {
  it("parses ordinal dates from the try-again clause", () => {
    const cases: Array<[string, string]> = [
      ["try again at Aug 8th, 2026 5:04 AM.", "Aug 8, 2026 5:04 AM"],
      ["try again at Dec 1st, 2026 11:30 PM.", "Dec 1, 2026 11:30 PM"],
      ["try again at Jan 22nd, 2027 12:00 PM.", "Jan 22, 2027 12:00 PM"],
      ["try again at Mar 23rd, 2027 9:15 AM.", "Mar 23, 2027 9:15 AM"],
    ];
    for (const [suffix, expected] of cases) {
      assert.strictEqual(
        parseCodexUsageLimitReset(`You've hit your usage limit. ${suffix}`),
        Math.floor(new Date(expected).getTime() / 1000),
        suffix
      );
    }
  });

  it("returns null when there is no try-again clause", () => {
    assert.strictEqual(
      parseCodexUsageLimitReset(
        "You've hit your usage limit. Visit https://chatgpt.com/codex/settings/usage to purchase more credits."
      ),
      null
    );
  });

  it("returns null for unparseable timestamps", () => {
    assert.strictEqual(
      parseCodexUsageLimitReset("You've hit your usage limit. Please try again at half past never."),
      null
    );
  });
});

// ============================================================================
// AgyStreamHandler tests — replay real `agy --output-format stream-json`
// captures from lib/fixtures/agy/
// ============================================================================

const AGY_FIXTURES = fileURLToPath(new URL("./fixtures/agy/", import.meta.url));

function loadAgyStdout(name: string): Record<string, unknown>[] {
  return readFileSync(join(AGY_FIXTURES, `${name}.stdout.jsonl`), "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function loadAgyStderr(name: string): string {
  return readFileSync(join(AGY_FIXTURES, `${name}.stderr.txt`), "utf-8");
}

function replayAgy(name: string, opts: { stderr?: boolean; stderrChunk?: number } = {}): AgyStreamHandler {
  const handler = new AgyStreamHandler();
  for (const event of loadAgyStdout(name)) handler.onEvent(event);
  if (opts.stderr) {
    const text = loadAgyStderr(name);
    const size = opts.stderrChunk ?? text.length;
    for (let i = 0; i < text.length; i += size) handler.onStderr(text.slice(i, i + size));
  }
  return handler;
}

describe("AgyStreamHandler", () => {
  it("completes on result SUCCESS with the response text and init conversation id", () => {
    const handler = replayAgy("success-describe-repo-tools");

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), true);
    assert.strictEqual(handler.getSessionId(), "2215b561-14fa-4994-b30f-95a91cf5a59a");
    assert.ok(handler.getResult().startsWith("[claude-comms]"));
    assert.strictEqual(handler.getFailureReason(), null);
    assert.strictEqual(handler.getRateLimitInfo(), null);
  });

  it("keeps the resumed conversation id across a --conversation run", () => {
    const handler = replayAgy("success-resume-conversation");

    assert.strictEqual(handler.isComplete(), true);
    assert.strictEqual(handler.getSessionId(), "1cfb10b0-a668-4810-aa0f-591f5b1d31e8");
    assert.match(handler.getResult(), /Greeting Agent 1/);
  });

  it("prefers result.response over accumulated text deltas", () => {
    const handler = replayAgy("success-two-subagents");
    // text deltas are streamed before result; result.response is the complete text
    assert.strictEqual(handler.isComplete(), true);
    assert.ok(handler.getResult().length > 0);
  });

  it("falls back to joined text deltas when no result arrived (timeout case)", () => {
    const handler = new AgyStreamHandler();
    for (const event of loadAgyStdout("success-describe-repo-tools")) {
      if (event.event === "result") break;
      handler.onEvent(event);
    }

    assert.strictEqual(handler.isTerminal(), false);
    assert.strictEqual(handler.isComplete(), false);
    assert.match(handler.getResult(), /claude-comms/);
  });

  it("fails fast on a quota wall: rate_limited reason, legible result, NO rate-limit info", () => {
    const handler = replayAgy("quota-exhausted", { stderr: true });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(handler.getSessionId(), "689d74e5-57a8-4a76-9045-4f9ac0b05d88");
    assert.strictEqual(handler.getFailureReason(), "rate_limited:RESOURCE_EXHAUSTED");
    // Hardcoded: agy never enters the awaiting_retry pause path
    assert.strictEqual(handler.getRateLimitInfo(), null);
    assert.deepStrictEqual(handler.getAgyError()?.error_code, 429);

    const result = handler.getResult();
    assert.match(result, /quota exhausted/);
    assert.match(result, /produced no output/);
    assert.match(result, /Resets in 99h45m50s/);
    assert.match(result, /absent agent, not a verdict/);
  });

  it("parses the AGY_ERROR line when stderr arrives in arbitrary chunks", () => {
    const handler = replayAgy("quota-exhausted", { stderr: true, stderrChunk: 7 });

    assert.strictEqual(handler.getFailureReason(), "rate_limited:RESOURCE_EXHAUSTED");
    assert.strictEqual(handler.getRateLimitInfo(), null);
  });

  it("parses an AGY_ERROR line with no trailing newline", () => {
    const handler = new AgyStreamHandler();
    handler.onStderr('error: something\nAGY_ERROR: {"status":"RESOURCE_EXHAUSTED","error_code":429,"retryable":true}');

    assert.strictEqual(handler.getFailureReason(), "rate_limited:RESOURCE_EXHAUSTED");
  });

  it("fails fast on non-quota provider errors too, with the status in the reason", () => {
    const handler = new AgyStreamHandler();
    handler.onEvent({ event: "init", conversation_id: "c1" });
    handler.onEvent({ event: "result", result: { conversation_id: "c1", status: "ERROR", response: "", error: "boom" } });
    handler.onStderr('AGY_ERROR: {"short_error":"INTERNAL (code 500): boom","status":"INTERNAL","error_code":500,"retryable":true}\n');

    assert.strictEqual(handler.isComplete(), false);
    assert.strictEqual(handler.getFailureReason(), "agy_error:INTERNAL");
    assert.strictEqual(handler.getRateLimitInfo(), null);
    assert.match(handler.getResult(), /provider error/);
    assert.match(handler.getResult(), /INTERNAL 500/);
  });

  it("reports a startup rejection (invalid model) from the stdout result alone", () => {
    const handler = replayAgy("invalid-model", { stderr: true });

    assert.strictEqual(handler.isTerminal(), true);
    assert.strictEqual(handler.isComplete(), false);
    // empty conversation_id → no session to resume
    assert.strictEqual(handler.getSessionId(), null);
    assert.match(handler.getFailureReason() ?? "", /^agy_result_error: invalid model selection/);
    assert.strictEqual(handler.getRateLimitInfo(), null);
    assert.strictEqual(handler.getAgyError(), null);
  });

  it("ignores stderr noise that is not an AGY_ERROR line", () => {
    const handler = new AgyStreamHandler();
    handler.onStderr("warning: print timeout\nAGY_ERROR: not json\n");

    assert.strictEqual(handler.getAgyError(), null);
    assert.strictEqual(handler.getFailureReason(), null);
  });
});


// ============================================================================
// buildCommand tests
// ============================================================================

describe("buildCommand", () => {
  it("builds claude command with bare -p for stdin prompt delivery", () => {
    const basic = buildCommand("claude");
    assert.strictEqual(basic.cmd, "claude");
    assert.ok(basic.args.includes("--output-format"));
    assert.ok(!basic.args.includes("--resume"));
    // Prompt is piped to stdin; bare -p must be the final arg
    assert.strictEqual(basic.args[basic.args.length - 1], "-p");

    const withSession = buildCommand("claude", { sessionId: "s123" });
    assert.ok(withSession.args.includes("--resume"));
    assert.ok(withSession.args.includes("s123"));
    assert.strictEqual(withSession.args[withSession.args.length - 1], "-p");
  });

  it("builds codex command with stdin sentinel", () => {
    const codex = buildCommand("codex");
    assert.strictEqual(codex.cmd, "codex");
    assert.ok(codex.args.includes("--json"));
    assert.ok(codex.args.includes("-"));
    assert.ok(!codex.args.includes("resume"));
  });

  it("builds codex resume command when sessionId is provided", () => {
    const codex = buildCommand("codex", {
      sessionId: "019e1662-7864-7d91-b3f7-663ced63e87d",
      model: "gpt-5.5",
    });

    assert.deepStrictEqual(codex.args, [
      "--yolo",
      "e",
      "resume",
      "-m",
      "gpt-5.5",
      "019e1662-7864-7d91-b3f7-663ced63e87d",
      "-",
      "--json",
    ]);
  });

  it("builds agy stream-json command for the gemini harness with stdin prompt delivery", () => {
    const agy = buildCommand("gemini");

    assert.strictEqual(agy.cmd, "agy");
    // No -p: agy reads the prompt from stdin when it is not a TTY.
    // No --print-timeout: an expired agy timeout exits 0 with truncated output;
    // the executor max-duration kill is the honest timeout.
    assert.deepStrictEqual(agy.args, [
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
      "--output-format",
      "stream-json",
    ]);
  });

  it("builds agy command with model and conversation resume", () => {
    const agy = buildCommand("gemini", {
      sessionId: "915d455b-c502-4f48-829e-a3858cd370f8",
      model: "gemini-3.8-flash-high",
    });

    assert.deepStrictEqual(agy.args, [
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
      "--output-format",
      "stream-json",
      "--model",
      "gemini-3.8-flash-high",
      "--conversation",
      "915d455b-c502-4f48-829e-a3858cd370f8",
    ]);
    assert.ok(!agy.args.includes("--print-timeout"));
  });

  it("throws for unknown harness", () => {
    assert.throws(() => buildCommand("unknown"), /Unknown harness/);
    assert.throws(() => buildCommand("agy"), /Unknown harness/);
  });

  it("builds interactive claude command without print or stream-json", () => {
    const command = buildInteractiveClaudeCommand({
      model: "sonnet",
      sessionId: "s123",
      forkSession: true,
      settingsPath: "/tmp/hooks.json",
    });

    assert.strictEqual(command.cmd, "claude");
    assert.ok(command.args.includes("--settings"));
    assert.ok(command.args.includes("/tmp/hooks.json"));
    assert.ok(command.args.includes("--resume"));
    assert.ok(command.args.includes("s123"));
    assert.ok(command.args.includes("--fork-session"));
    assert.ok(!command.args.includes("-p"));
    assert.ok(!command.args.includes("--output-format"));
    assert.ok(!command.args.includes("stream-json"));
  });
});
