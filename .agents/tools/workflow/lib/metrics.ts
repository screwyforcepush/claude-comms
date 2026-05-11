/**
 * Harness stream metric extraction.
 *
 * Keeps job/card telemetry parsing separate from runner orchestration so stream
 * format changes can be covered with small unit tests.
 */

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
  switch (harness) {
    case "claude": {
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
      if (type !== "tool_use") return { ids: [], hadToolUse: false };
      const toolId =
        (event.tool_id as string | undefined) ??
        (event.toolId as string | undefined) ??
        (event.toolID as string | undefined);
      return { ids: toolId ? [String(toolId)] : [], hadToolUse: true };
    }
    default:
      return { ids: [], hadToolUse: false };
  }
}

function extractSubagentInfo(
  harness: MetricsHarness,
  event: Record<string, unknown>
): { ids: string[]; hadSubagent: boolean } {
  const type = event.type as string | undefined;
  switch (harness) {
    case "claude": {
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
      if (type !== "tool_use") return { ids: [], hadSubagent: false };
      const toolName = event.tool_name as string | undefined;
      if (toolName !== "delegate_to_agent") return { ids: [], hadSubagent: false };
      const toolId =
        (event.tool_id as string | undefined) ??
        (event.toolId as string | undefined) ??
        (event.toolID as string | undefined);
      return { ids: toolId ? [String(toolId)] : [], hadSubagent: true };
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

  if (harness === "gemini" && type === "result") {
    const stats = event.stats as {
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    } | undefined;
    if (typeof stats?.total_tokens === "number") return stats.total_tokens;
    if (typeof stats?.input_tokens === "number" && typeof stats?.output_tokens === "number") {
      return stats.input_tokens + stats.output_tokens;
    }
  }

  return null;
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

  const contextPressure = extractContextPressure(harness, event);
  if (contextPressure !== null) {
    metrics.contextPressure = contextPressure;
  }
}
