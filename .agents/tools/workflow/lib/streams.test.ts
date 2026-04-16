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
});

// ============================================================================
// CodexStreamHandler tests
// ============================================================================

describe("CodexStreamHandler", () => {
  it("extracts agent_message text and marks complete on turn.completed", () => {
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

    assert.ok(handler.getResult().includes("First message"));
    assert.ok(handler.getResult().includes("Second message"));
    assert.strictEqual(handler.isComplete(), true);
  });

  it("ignores non-agent_message items", () => {
    const handler = new CodexStreamHandler();

    handler.onEvent({
      type: "item.completed",
      item: { type: "reasoning", text: "Thinking..." },
    });

    assert.strictEqual(handler.getResult(), "");
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

    const gemini = buildCommand("gemini", "test");
    assert.strictEqual(gemini.cmd, "gemini");
    assert.ok(gemini.args.includes("stream-json"));
  });

  it("throws for unknown harness", () => {
    assert.throws(() => buildCommand("unknown", "test"), /Unknown harness/);
  });
});
