/**
 * Tests for stream handlers module
 *
 * Run with: npx tsx --test lib/streams.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  ClaudeStreamHandler,
  CodexStreamHandler,
  GeminiStreamHandler,
  buildCommand,
  buildInteractiveClaudeCommand,
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
// buildCommand tests
// ============================================================================

describe("buildCommand", () => {
  it("builds claude command with optional session resume", () => {
    const basic = buildCommand("claude", "test");
    assert.strictEqual(basic.cmd, "claude");
    assert.ok(basic.args.includes("--output-format"));
    assert.ok(!basic.args.includes("--resume"));

    const withSession = buildCommand("claude", "test", { sessionId: "s123" });
    assert.ok(withSession.args.includes("--resume"));
    assert.ok(withSession.args.includes("s123"));
  });

  it("builds codex and gemini commands", () => {
    const codex = buildCommand("codex", "test");
    assert.strictEqual(codex.cmd, "codex");
    assert.ok(codex.args.includes("--json"));
    assert.ok(!codex.args.includes("resume"));

    const gemini = buildCommand("gemini", "test");
    assert.strictEqual(gemini.cmd, "gemini");
    assert.ok(gemini.args.includes("stream-json"));
    assert.ok(!gemini.args.includes("--resume"));
  });

  it("builds codex resume command when sessionId is provided", () => {
    const codex = buildCommand("codex", "test", {
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
      "test",
      "--json",
    ]);
  });

  it("builds gemini resume command when sessionId is provided", () => {
    const gemini = buildCommand("gemini", "test", {
      sessionId: "915d455b-c502-4f48-829e-a3858cd370f8",
      model: "auto-gemini-3",
    });

    assert.deepStrictEqual(gemini.args, [
      "--yolo",
      "--resume",
      "915d455b-c502-4f48-829e-a3858cd370f8",
      "-m",
      "auto-gemini-3",
      "--output-format",
      "stream-json",
      "-p",
      "test",
    ]);
  });

  it("throws for unknown harness", () => {
    assert.throws(() => buildCommand("unknown", "test"), /Unknown harness/);
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
