/**
 * Tests for stream handlers module
 *
 * Run with: npx tsx --test lib/streams.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AgyStreamHandler,
  ClaudeStreamHandler,
  CodexStreamHandler,
  GeminiStreamHandler,
  buildAgyCommand,
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
// GeminiStreamHandler tests
// ============================================================================

describe("GeminiStreamHandler", () => {
  it("accumulates assistant content and marks complete on result", () => {
    const handler = new GeminiStreamHandler();

    handler.onEvent({ type: "message", role: "assistant", content: "Hello " });
    handler.onEvent({ type: "message", role: "assistant", content: "world" });
    handler.onEvent({ type: "result" });

    assert.strictEqual(handler.getResult(), "Hello world");
    assert.strictEqual(handler.isComplete(), true);
  });

  it("ignores non-assistant messages", () => {
    const handler = new GeminiStreamHandler();

    handler.onEvent({ type: "message", role: "user", content: "User input" });
    handler.onEvent({ type: "tool_use", tool_name: "shell" });

    assert.strictEqual(handler.getResult(), "");
  });

  it("captures session_id from init for resume", () => {
    const handler = new GeminiStreamHandler();

    handler.onEvent({
      type: "init",
      session_id: "915d455b-c502-4f48-829e-a3858cd370f8",
    });

    assert.strictEqual(handler.getSessionId(), "915d455b-c502-4f48-829e-a3858cd370f8");
  });
});

// ============================================================================
// AgyStreamHandler tests
// ============================================================================

describe("AgyStreamHandler", () => {
  it("captures root conversation id and final Stop result", () => {
    const handler = new AgyStreamHandler();

    handler.onEvent({
      hook_event_name: "PreInvocation",
      conversationId: "root-session",
      invocationNum: 0,
    });
    handler.onEvent({
      hook_event_name: "Stop",
      conversationId: "root-session",
      terminationReason: "NO_TOOL_CALL",
      fullyIdle: true,
      error: "",
      result: "line one\nline two",
    });

    assert.strictEqual(handler.getSessionId(), "root-session");
    assert.strictEqual(handler.getResult(), "line one\nline two");
    assert.strictEqual(handler.isComplete(), true);
  });

  it("ignores non-idle root Stop events and subagent Stop events", () => {
    const handler = new AgyStreamHandler();

    handler.onEvent({
      hook_event_name: "PreInvocation",
      conversationId: "root-session",
    });
    handler.onEvent({
      hook_event_name: "Stop",
      conversationId: "root-session",
      fullyIdle: false,
      result: "not done",
    });
    handler.onEvent({
      hook_event_name: "Stop",
      conversationId: "subagent-session",
      fullyIdle: true,
      result: "subagent done",
    });

    assert.strictEqual(handler.isTerminal(), false);
    assert.strictEqual(handler.getResult(), "");
  });

  it("falls back to transcript final planner response", () => {
    const dir = mkdtempSync(join(tmpdir(), "agy-stream-"));
    const transcriptPath = join(dir, "transcript_full.jsonl");
    writeFileSync(transcriptPath, [
      JSON.stringify({ type: "PLANNER_RESPONSE", source: "MODEL", content: "old" }),
      JSON.stringify({ type: "PLANNER_RESPONSE", source: "MODEL", content: "final\nanswer" }),
    ].join("\n") + "\n");

    const handler = new AgyStreamHandler();
    handler.onEvent({
      hook_event_name: "PreInvocation",
      conversationId: "root-session",
    });
    handler.onEvent({
      hook_event_name: "Stop",
      conversationId: "root-session",
      fullyIdle: true,
      terminationReason: "NO_TOOL_CALL",
      error: "",
      transcriptPath,
    });

    assert.strictEqual(handler.getResult(), "final\nanswer");
    assert.strictEqual(handler.isComplete(), true);
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

  it("builds agy command with conversation resume and print timeout", () => {
    const agy = buildAgyCommand({
      sessionId: "915d455b-c502-4f48-829e-a3858cd370f8",
      model: "gemini-3.5-flash",
      printTimeoutMs: 3600000,
    });

    // No -p: agy reads the prompt from stdin when it is not a TTY
    assert.deepStrictEqual(agy.args, [
      "--dangerously-skip-permissions",
      "--conversation",
      "915d455b-c502-4f48-829e-a3858cd370f8",
      "--model",
      "gemini-3.5-flash",
      "--print-timeout",
      "3600s",
    ]);
  });

  it("throws for unknown harness, including removed gemini CLI", () => {
    assert.throws(() => buildCommand("unknown"), /Unknown harness/);
    assert.throws(() => buildCommand("gemini"), /Unknown harness/);
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
