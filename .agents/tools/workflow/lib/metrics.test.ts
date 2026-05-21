/**
 * Tests for harness stream metrics.
 *
 * Run with: npx tsx --test lib/metrics.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createMetricsState,
  formatContextPressure,
  recordMetricsEvent,
} from "./metrics.js";

describe("recordMetricsEvent", () => {
  it("counts Claude Task tool uses as subagents and deduplicates by tool id", () => {
    const metrics = createMetricsState();
    const event = {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: "toolu_1", name: "Task" },
          { type: "tool_use", id: "toolu_2", name: "Bash" },
        ],
      },
    };

    recordMetricsEvent("claude", event, metrics);
    recordMetricsEvent("claude", event, metrics);

    assert.strictEqual(metrics.toolCallCount, 2);
    assert.strictEqual(metrics.subagentCount, 1);
  });

  it("counts Claude hook Agent tool uses and ignores internal SubagentStop noise", () => {
    const metrics = createMetricsState();

    recordMetricsEvent("claude", {
      hook_event_name: "PreToolUse",
      tool_name: "Agent",
      tool_use_id: "toolu_1",
    }, metrics);
    recordMetricsEvent("claude", {
      hook_event_name: "SubagentStop",
      agent_id: "internal",
      agent_type: "",
      last_assistant_message: "now spawn three",
    }, metrics);
    recordMetricsEvent("claude", {
      hook_event_name: "PostToolUse",
      tool_name: "Agent",
      tool_use_id: "toolu_1",
      tool_response: { totalTokens: 8827 },
    }, metrics);

    assert.strictEqual(metrics.toolCallCount, 1);
    assert.strictEqual(metrics.subagentCount, 1);
    assert.strictEqual(metrics.totalTokens, null);
    assert.strictEqual(metrics.contextPressure, null);
  });

  it("extracts Claude hook Stop usage from transcript final assistant message", () => {
    const metrics = createMetricsState();
    const dir = mkdtempSync(join(tmpdir(), "claude-hook-metrics-"));
    const transcriptPath = join(dir, "session.jsonl");

    writeFileSync(transcriptPath, [
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "old" }],
          usage: {
            input_tokens: 1,
            cache_creation_input_tokens: 2,
            cache_read_input_tokens: 3,
            output_tokens: 4,
          },
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "final answer" }],
          usage: {
            input_tokens: 6,
            cache_creation_input_tokens: 68,
            cache_read_input_tokens: 41423,
            output_tokens: 376,
          },
        },
      }),
    ].join("\n") + "\n");

    recordMetricsEvent("claude", {
      hook_event_name: "Stop",
      transcript_path: transcriptPath,
      last_assistant_message: "final answer",
    }, metrics);

    assert.strictEqual(metrics.totalTokens, 41497);
    assert.strictEqual(metrics.contextPressure, 41497);
  });

  it("counts Codex completed spawn_agent collab tool calls by receiver thread id", () => {
    const metrics = createMetricsState();

    recordMetricsEvent("codex", {
      type: "item.started",
      item: {
        id: "item_1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: [],
        status: "in_progress",
      },
    }, metrics);

    recordMetricsEvent("codex", {
      type: "item.completed",
      item: {
        id: "item_1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["019dfb65-3b7a-72d3-a283-006012cf33ca"],
        status: "completed",
      },
    }, metrics);

    recordMetricsEvent("codex", {
      type: "item.completed",
      item: {
        id: "item_2",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["019dfb65-3b8b-7553-b599-2d01c174b987"],
        status: "completed",
      },
    }, metrics);

    recordMetricsEvent("codex", {
      type: "item.completed",
      item: {
        id: "item_3",
        type: "collab_tool_call",
        tool: "wait",
        receiver_thread_ids: [
          "019dfb65-3b7a-72d3-a283-006012cf33ca",
          "019dfb65-3b8b-7553-b599-2d01c174b987",
        ],
        status: "completed",
      },
    }, metrics);

    assert.strictEqual(metrics.subagentCount, 2);
    assert.strictEqual(metrics.toolCallCount, 3);
  });

  it("deduplicates repeated Codex spawn_agent completions for the same receiver thread", () => {
    const metrics = createMetricsState();
    const event = {
      type: "item.completed",
      item: {
        id: "item_1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: ["thread_a"],
        status: "completed",
      },
    };

    recordMetricsEvent("codex", event, metrics);
    recordMetricsEvent("codex", event, metrics);

    assert.strictEqual(metrics.subagentCount, 1);
  });

  it("uses Codex item id as a fallback when spawn_agent has no receiver thread ids", () => {
    const metrics = createMetricsState();

    recordMetricsEvent("codex", {
      type: "item.completed",
      item: {
        id: "item_1",
        type: "collab_tool_call",
        tool: "spawn_agent",
        receiver_thread_ids: [],
        status: "completed",
      },
    }, metrics);

    assert.strictEqual(metrics.subagentCount, 1);
  });

  it("extracts Codex turn.completed usage as total tokens minus cached input", () => {
    const metrics = createMetricsState();

    recordMetricsEvent("codex", {
      type: "turn.completed",
      usage: {
        input_tokens: 67412,
        cached_input_tokens: 57344,
        output_tokens: 492,
      },
    }, metrics);

    assert.strictEqual(metrics.totalTokens, 10560);
    assert.strictEqual(metrics.contextPressure, 10560);
  });
});

describe("formatContextPressure", () => {
  it("formats tokens as rounded thousands", () => {
    assert.strictEqual(formatContextPressure(10560), "Context Pressure: 11k");
  });
});
