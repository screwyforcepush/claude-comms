/**
 * Harness stream metric extraction.
 *
 * Keeps job/card telemetry parsing separate from runner orchestration so stream
 * format changes can be covered with small unit tests.
 */

import { existsSync, readFileSync } from "fs";

export type MetricsHarness = "claude" | "codex" | "gemini";

export const METRICS_HEARTBEAT_MS = 60_000;

const CODEX_TOOL_ITEM_TYPES = new Set([
  "command_execution",
  "tool_call",
  "tool_use",
  "function_call",
  "collab_tool_call",
]);

export interface MetricsState {
  toolCallCount: number;
  subagentCount: number;
  totalTokens: number | null;
  contextPressure: number | null;
  lastEventAt: number | null;
  lastFlushedToolCallCount: number;
  lastFlushedSubagentCount: number;
  lastFlushedEventAt: number | null;
  heartbeat: NodeJS.Timeout | null;
  seenToolIds: Set<string>;
  seenSubagentIds: Set<string>;
}

export function createMetricsState(): MetricsState {
  return {
    toolCallCount: 0,
    subagentCount: 0,
    totalTokens: null,
    contextPressure: null,
    lastEventAt: null,
    lastFlushedToolCallCount: 0,
    lastFlushedSubagentCount: 0,
    lastFlushedEventAt: null,
    heartbeat: null,
    seenToolIds: new Set(),
    seenSubagentIds: new Set(),
  };
}

function extractToolCallInfo(
  harness: MetricsHarness,
  event: Record<string, unknown>
): { ids: string[]; hadToolUse: boolean } {
  const type = event.type as string | undefined;
  const hookEventName = event.hook_event_name as string | undefined;
  switch (harness) {
    case "claude": {
      if (hookEventName === "PreToolUse") {
        const toolName = event.tool_name as string | undefined;
        if (!toolName) return { ids: [], hadToolUse: false };
        const toolUseId = event.tool_use_id as string | undefined;
        return { ids: toolUseId ? [String(toolUseId)] : [], hadToolUse: true };
      }

      if (type !== "assistant") return { ids: [], hadToolUse: false };
      const message = event.message as { content?: Array<{ type?: string; id?: string }> } | undefined;
      if (!message?.content) return { ids: [], hadToolUse: false };
      const ids: string[] = [];
      let hadToolUse = false;
      for (const block of message.content) {
        if (block?.type === "tool_use") {
          hadToolUse = true;
          if (block.id) ids.push(String(block.id));
        }
      }
      return { ids, hadToolUse };
    }
    case "codex": {
      if (type !== "item.started" && type !== "item.completed") {
        return { ids: [], hadToolUse: false };
      }
      const item = event.item as { type?: string; id?: string } | undefined;
      if (!item?.type || !CODEX_TOOL_ITEM_TYPES.has(item.type)) {
        return { ids: [], hadToolUse: false };
      }
      const ids = item.id ? [String(item.id)] : [];
      return { ids, hadToolUse: true };
    }
    case "gemini": {
      // agy stream-json: a tool call is a `tool` (or `subagent`, for
      // invoke_subagent) step. ACTIVE and DONE share a step_index, so the
      // conversation:step pair dedupes the pair to one call.
      const step = agyStep(event);
      if (!step || (step.step_type !== "tool" && step.step_type !== "subagent")) {
        return { ids: [], hadToolUse: false };
      }
      const id = agyStepId(step);
      return { ids: id ? [id] : [], hadToolUse: true };
    }
    default:
      return { ids: [], hadToolUse: false };
  }
}

interface AgyStepUpdate {
  conversation_id?: string;
  step_index?: number;
  state?: string;
  step_type?: string;
  usage?: { input_tokens?: number; cache_read_tokens?: number };
  subagent_info?: { subagents?: Array<{ conversation_id?: string }> };
}

function agyStep(event: Record<string, unknown>): AgyStepUpdate | null {
  if (event.event !== "step_update") return null;
  const step = event.step_update;
  return step && typeof step === "object" ? (step as AgyStepUpdate) : null;
}

function agyStepId(step: AgyStepUpdate): string | undefined {
  return step.conversation_id && step.step_index !== undefined
    ? `${step.conversation_id}:${step.step_index}`
    : undefined;
}

function extractSubagentInfo(
  harness: MetricsHarness,
  event: Record<string, unknown>
): { ids: string[]; hadSubagent: boolean } {
  const type = event.type as string | undefined;
  const hookEventName = event.hook_event_name as string | undefined;
  switch (harness) {
    case "claude": {
      if (hookEventName === "PreToolUse") {
        const toolName = event.tool_name as string | undefined;
        if (toolName !== "Agent" && toolName !== "Task") {
          return { ids: [], hadSubagent: false };
        }
        const toolUseId = event.tool_use_id as string | undefined;
        return { ids: toolUseId ? [String(toolUseId)] : [], hadSubagent: true };
      }

      if (type !== "assistant") return { ids: [], hadSubagent: false };
      const message = event.message as { content?: Array<{ type?: string; id?: string; name?: string }> } | undefined;
      if (!message?.content) return { ids: [], hadSubagent: false };
      const ids: string[] = [];
      let hadSubagent = false;
      for (const block of message.content) {
        if (block?.type === "tool_use" && (block.name === "Task" || block.name === "Agent")) {
          hadSubagent = true;
          if (block.id) ids.push(String(block.id));
        }
      }
      return { ids, hadSubagent };
    }
    case "codex": {
      if (type !== "item.completed") return { ids: [], hadSubagent: false };
      const item = event.item as {
        id?: string;
        type?: string;
        tool?: string;
        receiver_thread_ids?: unknown;
      } | undefined;
      if (item?.type !== "collab_tool_call" || item.tool !== "spawn_agent") {
        return { ids: [], hadSubagent: false };
      }

      const receiverThreadIds = Array.isArray(item.receiver_thread_ids)
        ? item.receiver_thread_ids.map((id) => String(id)).filter(Boolean)
        : [];
      const ids = receiverThreadIds.length > 0
        ? receiverThreadIds
        : item.id
          ? [String(item.id)]
          : [];

      return { ids, hadSubagent: true };
    }
    case "gemini": {
      // agy stream-json: key on subagent_info, not step_type. A spawn's ACTIVE
      // event is sometimes `tool` and sometimes `subagent`; the DONE event is
      // always `subagent` and always carries subagent_info. Each subagent has
      // its own conversation_id, which dedupes ACTIVE/DONE to one count.
      const step = agyStep(event);
      const subagents = step?.subagent_info?.subagents;
      if (!Array.isArray(subagents) || subagents.length === 0) {
        return { ids: [], hadSubagent: false };
      }
      const ids = subagents
        .map((s) => (s?.conversation_id ? String(s.conversation_id) : ""))
        .filter(Boolean);
      return { ids, hadSubagent: true };
    }
    default:
      return { ids: [], hadSubagent: false };
  }
}

function extractTotalTokens(
  harness: MetricsHarness,
  event: Record<string, unknown>
): number | null {
  const type = event.type as string | undefined;
  const hookEventName = event.hook_event_name as string | undefined;

  if (harness === "claude" && hookEventName === "Stop") {
    return extractClaudeHookStopTotalTokens(event);
  }

  if (harness === "claude" && type === "assistant") {
    const message = event.message as {
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    } | undefined;
    const usage = message?.usage;
    if (usage) {
      return (usage.input_tokens ?? 0)
        + (usage.cache_creation_input_tokens ?? 0)
        + (usage.cache_read_input_tokens ?? 0);
    }
  }

  if (harness === "codex" && type === "turn.completed") {
    const usage = event.usage as { input_tokens?: number; output_tokens?: number; cached_input_tokens?: number } | undefined;
    if (typeof usage?.input_tokens === "number" && typeof usage?.output_tokens === "number") {
      return usage.input_tokens + usage.output_tokens - (usage.cached_input_tokens ?? 0);
    }
  }

  if (harness === "gemini") {
    // agy stream-json: each agent_response DONE carries that step's usage;
    // its input_tokens (+ cache reads) is the live context size, which is the
    // same context-pressure semantics Claude's per-message usage gives. The
    // terminal result's usage is the run aggregate and would overstate it.
    const step = agyStep(event);
    if (step?.step_type === "agent_response" && step.state === "DONE" && step.usage) {
      if (typeof step.usage.input_tokens === "number") {
        return step.usage.input_tokens + (step.usage.cache_read_tokens ?? 0);
      }
    }
  }

  return null;
}

function usageContextTokens(usage: {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}): number {
  return (usage.input_tokens ?? 0)
    + (usage.cache_creation_input_tokens ?? 0)
    + (usage.cache_read_input_tokens ?? 0);
}

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const typedBlock = block as { type?: string; text?: string };
      return typedBlock.type === "text" && typeof typedBlock.text === "string"
        ? typedBlock.text
        : "";
    })
    .join("");
}

function extractClaudeHookStopTotalTokens(event: Record<string, unknown>): number | null {
  const transcriptPath = event.transcript_path as string | undefined;
  if (!transcriptPath || !existsSync(transcriptPath)) return null;

  const finalMessage =
    typeof event.last_assistant_message === "string"
      ? event.last_assistant_message.trim()
      : "";

  try {
    const lines = readFileSync(transcriptPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim());

    let fallbackUsage: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(lines[i]) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (parsed.type !== "assistant") continue;
      const message = parsed.message as {
        content?: unknown;
        usage?: {
          input_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      } | undefined;
      if (!message?.usage) continue;

      const text = extractTextContent(message.content).trim();
      if (!text) continue;

      fallbackUsage ??= message.usage;
      if (finalMessage && text === finalMessage) {
        return usageContextTokens(message.usage);
      }
    }

    return fallbackUsage ? usageContextTokens(fallbackUsage) : null;
  } catch {
    return null;
  }
}

function extractContextPressure(
  harness: MetricsHarness,
  event: Record<string, unknown>
): number | null {
  return extractTotalTokens(harness, event);
}

export function formatContextPressure(tokens: number): string {
  return `Context Pressure: ${Math.round(tokens / 1000)}k`;
}

export function recordMetricsEvent(
  harness: MetricsHarness,
  event: Record<string, unknown>,
  metrics: MetricsState
): void {
  metrics.lastEventAt = Date.now();

  const toolInfo = extractToolCallInfo(harness, event);
  if (toolInfo.hadToolUse) {
    if (toolInfo.ids.length === 0) {
      metrics.toolCallCount += 1;
    } else {
      for (const id of toolInfo.ids) {
        if (metrics.seenToolIds.has(id)) continue;
        metrics.seenToolIds.add(id);
        metrics.toolCallCount += 1;
      }
    }
  }

  const subagentInfo = extractSubagentInfo(harness, event);
  if (subagentInfo.hadSubagent) {
    if (subagentInfo.ids.length === 0) {
      metrics.subagentCount += 1;
    } else {
      for (const id of subagentInfo.ids) {
        if (metrics.seenSubagentIds.has(id)) continue;
        metrics.seenSubagentIds.add(id);
        metrics.subagentCount += 1;
      }
    }
  }

  const totalTokens = extractTotalTokens(harness, event);
  if (totalTokens !== null) {
    metrics.totalTokens = totalTokens;
  }

  const contextPressure = totalTokens ?? extractContextPressure(harness, event);
  if (contextPressure !== null) {
    metrics.contextPressure = contextPressure;
  }
}
