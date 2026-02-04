#!/usr/bin/env npx tsx
/**
 * Workflow Runner Daemon
 *
 * Subscribes to Convex and executes jobs as they become ready.
 * Runs forever, reacting to database changes.
 *
 * Supports parallel job execution within groups:
 * - Scheduler returns ALL pending jobs in a ready group
 * - Runner executes them in parallel
 * - When group completes, aggregated results go to PM
 *
 * Usage:
 *   nohup npx tsx runner.ts > /tmp/runner.log 2>&1 &
 *
 * Config via config.json in same directory.
 */

import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Prompt building (extracted module)
import {
  Assignment,
  Job,
  JobGroup,
  ChatJobContext,
  AccumulatedJobResult,
  buildPrompt,
  buildChatPrompt,
  parseChatContext,
  isChatJob,
  determinePromptType,
} from "./lib/prompts.js";

// Harness executor (file-based event streaming for crash resilience)
import { HarnessExecutor, Harness } from "./lib/harness-executor.js";

// Use anyApi for dynamic function references (works with ConvexClient)
const api = anyApi;

// Chat job from chatJobs table (separate from assignment jobs)
interface ChatJob {
  _id: string;
  _creationTime: number;
  threadId: string;
  namespaceId: string;
  harness: "claude" | "codex" | "gemini";
  context: string;
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

// Config
interface Config {
  convexUrl: string;
  namespace: string;
  timeoutMs: number;
  idleTimeoutMs?: number;
  harnessDefaults: {
    default: Harness;
    [jobType: string]: Harness;
  };
}

/**
 * Get the harness for a job type from config
 */
function getHarnessForJobType(jobType: string): Harness {
  return config.harnessDefaults[jobType] || config.harnessDefaults.default;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

// Project root is 3 levels up from .agents/tools/workflow
const projectRoot = join(__dirname, "..", "..", "..");

// State
let client: ConvexClient | null = null;
let unsubscribeJobs: (() => void) | null = null;
let unsubscribeChatJobs: (() => void) | null = null;

// Harness executor (handles process spawning, file-based event streaming, orphan recovery)
const executor = new HarnessExecutor({
  timeoutMs: config.timeoutMs,
  idleTimeoutMs: config.idleTimeoutMs,
  cwd: projectRoot,
});

const METRICS_HEARTBEAT_MS = 10_000;
const CODEX_TOOL_ITEM_TYPES = new Set([
  "command_execution",
  "tool_call",
  "tool_use",
  "function_call",
]);

interface MetricsState {
  toolCallCount: number;
  subagentCount: number;
  totalTokens: number | null;
  lastEventAt: number | null;
  lastFlushedToolCallCount: number;
  lastFlushedSubagentCount: number;
  lastFlushedEventAt: number | null;
  heartbeat: NodeJS.Timeout | null;
  seenToolIds: Set<string>;
  seenSubagentIds: Set<string>;
}

function createMetricsState(): MetricsState {
  return {
    toolCallCount: 0,
    subagentCount: 0,
    totalTokens: null,
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
  harness: Harness,
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
  harness: Harness,
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
        if (block?.type === "tool_use" && block.name === "Task") {
          hadSubagent = true;
          if (block.id) ids.push(String(block.id));
        }
      }
      return { ids, hadSubagent };
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
    case "codex":
    default:
      return { ids: [], hadSubagent: false };
  }
}

function extractTotalTokens(
  harness: Harness,
  event: Record<string, unknown>
): number | null {
  const type = event.type as string | undefined;
  if (harness === "claude" && type === "result") {
    const usage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (typeof usage?.input_tokens === "number" && typeof usage?.output_tokens === "number") {
      return usage.input_tokens + usage.output_tokens;
    }
  }

  if (harness === "codex" && type === "turn.completed") {
    const usage = event.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (typeof usage?.input_tokens === "number" && typeof usage?.output_tokens === "number") {
      return usage.input_tokens + usage.output_tokens;
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

function recordMetricsEvent(
  harness: Harness,
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
}

// Save assistant response to chat thread
async function saveChatResponse(threadId: string, content: string): Promise<void> {
  try {
    await client!.mutation(api.chatMessages.add, {
      threadId: threadId as any,
      role: "assistant",
      content,
    });
    console.log(`[Chat] Saved assistant response to thread ${threadId}`);
  } catch (e) {
    console.error(`[Chat] Failed to save response:`, e);
  }
}

// Save Claude session_id to thread for session resume
async function saveSessionId(threadId: string, sessionId: string): Promise<void> {
  try {
    await client!.mutation(api.chatThreads.updateSessionId, {
      id: threadId as any,
      sessionId,
    });
    console.log(`[Chat] Saved session_id ${sessionId} to thread ${threadId}`);
  } catch (e) {
    console.error(`[Chat] Failed to save session_id:`, e);
  }
}

// Save lastPromptMode to thread for differential prompting
async function saveLastPromptMode(
  threadId: string,
  mode: "jam" | "cook"
): Promise<void> {
  try {
    await client!.mutation(api.chatThreads.updateLastPromptMode, {
      id: threadId as any,
      lastPromptMode: mode,
    });
    console.log(`[Chat] Saved lastPromptMode ${mode} to thread ${threadId}`);
  } catch (e) {
    console.error(`[Chat] Failed to save lastPromptMode:`, e);
  }
}

// Guardian Mode: Trigger PO evaluation when PM completes
interface ChatThread {
  _id: string;
  mode: "jam" | "cook" | "guardian";
  assignmentId?: string;
  claudeSessionId?: string;
  namespaceId: string;
}

async function triggerGuardianEvaluation(
  assignment: Assignment,
  pmResult: string
): Promise<void> {
  try {
    const guardianThread: ChatThread | null = await client!.query(
      api.chatThreads.getGuardianThread,
      { assignmentId: assignment._id as any }
    );

    if (!guardianThread) {
      console.log(`[Guardian] No guardian thread for assignment ${assignment._id}`);
      return;
    }

    console.log(`[Guardian] Found guardian thread ${guardianThread._id}, triggering evaluation`);

    try {
      await client!.mutation(api.chatMessages.add, {
        threadId: guardianThread._id as any,
        role: "pm",
        content: pmResult,
      });
      console.log(`[Guardian] Inserted PM response as message in thread`);
    } catch (msgError) {
      console.error(`[Guardian] Failed to insert PM message:`, msgError);
      throw new Error(`Guardian PM message insert failed: ${msgError}`);
    }

    try {
      await client!.mutation(api.chatJobs.trigger, {
        threadId: guardianThread._id as any,
        harness: getHarnessForJobType("chat"),
        isGuardianEvaluation: true,
      });
      console.log(`[Guardian] Triggered PO evaluation chatJob`);
    } catch (triggerError) {
      console.error(`[Guardian] Failed to trigger evaluation job:`, triggerError);
      throw new Error(`Guardian evaluation trigger failed: ${triggerError}`);
    }
  } catch (e) {
    console.error(`[Guardian] Evaluation failed for assignment ${assignment._id}:`, e);
  }
}

// Job execution (uses HarnessExecutor for crash-resilient file-based streaming)
async function executeJob(
  job: Job,
  group: JobGroup,
  assignment: Assignment,
  accumulatedResults: AccumulatedJobResult[],
  previousNonPmGroupResults: AccumulatedJobResult[],
  r1GroupResults: AccumulatedJobResult[]
): Promise<void> {
  const jobId = job._id;
  const isChat = isChatJob(job);
  let chatContext: ChatJobContext | null = null;

  console.log(`[${jobId}] Starting ${job.jobType} job (${job.harness})${isChat ? ' [CHAT]' : ''}`);

  // Build prompt FIRST (before marking as running, so we can save it)
  let prompt: string;

  if (isChat) {
    chatContext = parseChatContext(job.context || "{}");
    if (!chatContext) {
      console.error(`[${jobId}] Invalid chat context, failing job`);
      await client!.mutation(api.jobs.fail, {
        id: jobId,
        result: "Invalid chat context provided",
      });
      return;
    }
    prompt = buildChatPrompt(chatContext, config.namespace);
    const resumeInfo = chatContext.claudeSessionId
      ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
      : ' (new session)';
    console.log(`[${jobId}] Chat mode: ${chatContext.mode}, thread: ${chatContext.threadId}${resumeInfo}`);
  } else {
    prompt = buildPrompt(
      group,
      assignment,
      job,
      accumulatedResults,
      previousNonPmGroupResults,
      r1GroupResults
    );
  }

  // Mark job as running with prompt for visibility
  await client!.mutation(api.jobs.start, { id: jobId, prompt });

  const metrics = createMetricsState();

  const flushMetrics = async (): Promise<void> => {
    if (!client) return;
    const update: {
      id: string;
      toolCallCount?: number;
      subagentCount?: number;
      lastEventAt?: number;
    } = { id: jobId };
    let changed = false;

    if (metrics.toolCallCount !== metrics.lastFlushedToolCallCount) {
      update.toolCallCount = metrics.toolCallCount;
      metrics.lastFlushedToolCallCount = metrics.toolCallCount;
      changed = true;
    }

    if (metrics.subagentCount !== metrics.lastFlushedSubagentCount) {
      update.subagentCount = metrics.subagentCount;
      metrics.lastFlushedSubagentCount = metrics.subagentCount;
      changed = true;
    }

    if (metrics.lastEventAt !== metrics.lastFlushedEventAt) {
      update.lastEventAt = metrics.lastEventAt ?? undefined;
      metrics.lastFlushedEventAt = metrics.lastEventAt;
      changed = true;
    }

    if (!changed) return;

    try {
      await client!.mutation(api.jobs.updateMetrics, update);
    } catch (e) {
      console.error(`[${jobId}] Failed to update job metrics:`, e);
    }
  };

  const ensureHeartbeat = (): void => {
    if (metrics.heartbeat) return;
    metrics.heartbeat = setInterval(() => {
      void flushMetrics();
    }, METRICS_HEARTBEAT_MS);
  };

  const stopHeartbeat = (): void => {
    if (!metrics.heartbeat) return;
    clearInterval(metrics.heartbeat);
    metrics.heartbeat = null;
  };

  // Execute via HarnessExecutor (file-based streaming, crash-resilient)
  const env: Record<string, string> = {
    WORKFLOW_ASSIGNMENT_ID: assignment._id,
    WORKFLOW_GROUP_ID: group._id,
    WORKFLOW_JOB_ID: job._id,
  };
  if (job.jobType === "pm") {
    env.WORKFLOW_ARTIFACTS = assignment.artifacts || "";
    env.WORKFLOW_DECISIONS = assignment.decisions || "";
  }

  executor.execute(
    {
      jobId,
      harness: job.harness as Harness,
      prompt,
      sessionId: isChat && chatContext?.claudeSessionId ? chatContext.claudeSessionId : undefined,
      env,
    },
    {
      onEvent: (event) => {
        recordMetricsEvent(job.harness as Harness, event, metrics);
        ensureHeartbeat();
      },
      onComplete: async (result, sessionId) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.jobs.complete, {
            id: jobId,
            result,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId, result);
            if (sessionId) {
              await saveSessionId(chatContext.threadId, sessionId);
            }
          } else {
            await handleGroupCompletion(group, assignment, false);
          }
        } catch (e) {
          console.error(`[${jobId}] Error in onComplete:`, e);
        }
      },
      onFail: async (reason, partialResult) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.jobs.fail, {
            id: jobId,
            result: partialResult || reason,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId,
              `I encountered an issue while processing your request. Please try again or rephrase your question.\n\nError details: ${partialResult || reason}`
            );
          } else {
            await handleGroupCompletion(group, assignment, true);
          }
        } catch (e) {
          console.error(`[${jobId}] Error in onFail:`, e);
        }
      },
      onTimeout: async (partialResult) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.jobs.fail, {
            id: jobId,
            result: `Timeout after ${config.timeoutMs}ms. Partial result:\n${partialResult}`,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId,
              `I apologize, but I ran into a timeout. Here's what I was able to process:\n\n${partialResult || "(no output)"}`
            );
          } else {
            await handleGroupCompletion(group, assignment, true);
          }
        } catch (e) {
          console.error(`[${jobId}] Error in onTimeout:`, e);
        }
      },
    }
  );
}

// Handle group completion - check if all jobs done, trigger PM if needed
async function handleGroupCompletion(
  group: JobGroup,
  assignment: Assignment,
  anyFailed: boolean
): Promise<void> {
  // Re-fetch group with jobs to get current status
  const currentGroup = await client!.query(api.jobs.getGroupWithJobs, { id: group._id });
  if (!currentGroup) {
    console.error(`[${group._id}] Group not found`);
    return;
  }

  // If group not yet complete, another job is still running
  if (currentGroup.status !== "complete" && currentGroup.status !== "failed") {
    console.log(`[${group._id}] Group still in progress (status: ${currentGroup.status})`);
    return;
  }

  console.log(`[${group._id}] Group completed (status: ${currentGroup.status})`);

  // Check job types in this group to determine behavior
  const jobs = currentGroup.jobs || [];
  const hasPMJob = jobs.some((j: Job) => j.jobType === "pm");

  // PM groups: always trigger guardian evaluation (even if PM inserted next job)
  if (hasPMJob) {
    // PM completed - trigger guardian evaluation if applicable
    // Find the PM job's result (not aggregatedResult with headers)
    const pmJob = jobs.find((j: Job) => j.jobType === "pm" && j.result);
    const pmResult = pmJob?.result || "";
    await triggerGuardianEvaluation(assignment, pmResult);
    // If PM didn't insert a next job, check if assignment is done
    if (!currentGroup.nextGroupId) {
      await checkAndCompleteAssignment(assignment._id, group._id);
    }
    return;
  }

  // Regular group: if next group exists, let scheduler handle it
  if (currentGroup.nextGroupId) {
    console.log(`[${group._id}] Next group exists, scheduler will pick it up`);
    return;
  }

  // No next group and not PM/document - trigger PM review
  const failed = currentGroup.status === "failed";
  await triggerPMGroup(group, assignment, failed);
}

// Check if all groups in assignment are done, if so mark complete
async function checkAndCompleteAssignment(assignmentId: string, completedGroupId: string): Promise<void> {
  const groups = await client!.query(api.jobs.listGroups, { assignmentId: assignmentId as any });

  const hasIncompleteGroups = groups.some(
    (g: JobGroup) => g.status === "pending" || g.status === "running"
  );

  if (hasIncompleteGroups) {
    console.log(`[${completedGroupId}] Assignment ${assignmentId} still has incomplete groups`);
    return;
  }

  console.log(`[${completedGroupId}] All groups done, marking assignment ${assignmentId} as complete`);
  await client!.mutation(api.assignments.complete, {
    id: assignmentId,
  });
}

// PM group triggering
async function triggerPMGroup(
  completedGroup: JobGroup,
  assignment: Assignment,
  failed: boolean
): Promise<void> {
  const jobType = "pm";
  const context = failed
    ? `Previous group failed. Diagnose issues, decide recovery, and choose next job(s).`
    : undefined;

  console.log(`[${completedGroup._id}] Triggering ${jobType} group`);

  await client!.mutation(api.jobs.insertGroupAfter, {
    afterGroupId: completedGroup._id,
    jobs: [{
      jobType,
      harness: getHarnessForJobType(jobType),
      context,
    }],
  });
}

// Scheduler interfaces
interface ReadyJob {
  job: Job;
  group: JobGroup;
  assignment: Assignment;
  accumulatedResults: AccumulatedJobResult[];
  previousNonPmGroupResults: AccumulatedJobResult[];
  r1GroupResults: AccumulatedJobResult[];
}

interface ReadyChatJob {
  chatJob: ChatJob;
}

async function processQueue(readyJobs: ReadyJob[]): Promise<void> {
  if (readyJobs.length === 0) return;

  // Filter out jobs we're already running (tracked by executor)
  const newJobs = readyJobs.filter((r) => !executor.isTracking(r.job._id));
  if (newJobs.length === 0) return;

  console.log(`[Queue] ${newJobs.length} new jobs to execute (parallel if same group)`);

  // Execute all ready jobs - scheduler already handles group logic
  for (const {
    job,
    group,
    assignment,
    accumulatedResults,
    previousNonPmGroupResults,
    r1GroupResults,
  } of newJobs) {
    // Double-check assignment status before executing
    const currentAssignment = await client!.query(api.assignments.get, {
      id: assignment._id,
    });
    if (currentAssignment?.status === "blocked") {
      console.log(`[${job._id}] Assignment ${assignment._id} is blocked, skipping`);
      continue;
    }

    executeJob(
      job,
      group,
      assignment,
      accumulatedResults,
      previousNonPmGroupResults,
      r1GroupResults
    ).catch((e) => {
      console.error(`Error executing job ${job._id}:`, e);
    });
  }
}

// Chat job execution (separate from assignment jobs, uses HarnessExecutor)
async function executeChatJob(chatJob: ChatJob): Promise<void> {
  const jobId = chatJob._id;
  console.log(`[${jobId}] Starting chat job (${chatJob.harness})`);

  const chatContext = parseChatContext(chatJob.context);
  if (!chatContext) {
    console.error(`[${jobId}] Invalid chat context, failing job`);
    await client!.mutation(api.chatJobs.fail, {
      id: jobId,
      result: "Invalid chat context provided",
    });
    return;
  }

  const promptType = determinePromptType(chatContext);
  const prompt = buildChatPrompt(chatContext, config.namespace);
  const resumeInfo = chatContext.claudeSessionId
    ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
    : " (new session)";
  console.log(`[${jobId}] Chat mode: ${chatContext.mode}, prompt: ${promptType}, thread: ${chatContext.threadId}${resumeInfo}`);

  await client!.mutation(api.chatJobs.start, { id: jobId, prompt });

  const metrics = createMetricsState();

  const flushMetrics = async (): Promise<void> => {
    if (!client) return;
    const update: {
      id: string;
      toolCallCount?: number;
      subagentCount?: number;
      lastEventAt?: number;
    } = { id: jobId };
    let changed = false;

    if (metrics.toolCallCount !== metrics.lastFlushedToolCallCount) {
      update.toolCallCount = metrics.toolCallCount;
      metrics.lastFlushedToolCallCount = metrics.toolCallCount;
      changed = true;
    }

    if (metrics.subagentCount !== metrics.lastFlushedSubagentCount) {
      update.subagentCount = metrics.subagentCount;
      metrics.lastFlushedSubagentCount = metrics.subagentCount;
      changed = true;
    }

    if (metrics.lastEventAt !== metrics.lastFlushedEventAt) {
      update.lastEventAt = metrics.lastEventAt ?? undefined;
      metrics.lastFlushedEventAt = metrics.lastEventAt;
      changed = true;
    }

    if (!changed) return;

    try {
      await client!.mutation(api.chatJobs.updateMetrics, update);
    } catch (e) {
      console.error(`[${jobId}] Failed to update chat job metrics:`, e);
    }
  };

  const ensureHeartbeat = (): void => {
    if (metrics.heartbeat) return;
    metrics.heartbeat = setInterval(() => {
      void flushMetrics();
    }, METRICS_HEARTBEAT_MS);
  };

  const stopHeartbeat = (): void => {
    if (!metrics.heartbeat) return;
    clearInterval(metrics.heartbeat);
    metrics.heartbeat = null;
  };

  // Execute via HarnessExecutor (file-based streaming, crash-resilient)
  executor.execute(
    {
      jobId,
      harness: chatJob.harness as Harness,
      prompt,
      sessionId: chatContext.claudeSessionId || undefined,
      env: {
        WORKFLOW_THREAD_ID: chatContext.threadId,
        WORKFLOW_NAMESPACE_ID: chatContext.namespaceId,
      },
    },
    {
      onEvent: (event) => {
        recordMetricsEvent(chatJob.harness as Harness, event, metrics);
        ensureHeartbeat();
      },
      onComplete: async (result, sessionId) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.chatJobs.complete, {
            id: jobId,
            result,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          await saveChatResponse(chatContext.threadId, result);
          if (sessionId) {
            await saveSessionId(chatContext.threadId, sessionId);
          }
          if (!chatContext.isGuardianEvaluation) {
            await saveLastPromptMode(chatContext.threadId, chatContext.effectivePromptMode);
          }
        } catch (e) {
          console.error(`[${jobId}] Error in onComplete:`, e);
          try {
            await saveChatResponse(chatContext.threadId,
              `I completed processing but encountered a system error saving the result. Please check the logs.`
            );
          } catch {
            // Ignore - best effort
          }
        }
      },
      onFail: async (reason, partialResult) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.chatJobs.fail, {
            id: jobId,
            result: partialResult || reason,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          await saveChatResponse(chatContext.threadId,
            `I encountered an issue while processing your request. Please try again or rephrase your question.\n\nError details: ${partialResult || reason}`
          );
        } catch (e) {
          console.error(`[${jobId}] Error in onFail:`, e);
        }
      },
      onTimeout: async (partialResult) => {
        stopHeartbeat();
        try {
          await client!.mutation(api.chatJobs.fail, {
            id: jobId,
            result: `Timeout after ${config.timeoutMs}ms. Partial result:\n${partialResult}`,
            toolCallCount: metrics.toolCallCount,
            subagentCount: metrics.subagentCount,
            totalTokens: metrics.totalTokens ?? undefined,
            lastEventAt: metrics.lastEventAt ?? undefined,
          });
          await saveChatResponse(chatContext.threadId,
            `I apologize, but I ran into a timeout. Here's what I was able to process:\n\n${partialResult || "(no output)"}`
          );
        } catch (e) {
          console.error(`[${jobId}] Error in onTimeout:`, e);
        }
      },
    }
  );
}

async function processChatQueue(readyChatJobs: ReadyChatJob[]): Promise<void> {
  if (readyChatJobs.length === 0) return;

  // Filter out jobs we're already running (tracked by executor)
  const newJobs = readyChatJobs.filter((r) => !executor.isTracking(r.chatJob._id));
  if (newJobs.length === 0) return;

  for (const { chatJob } of newJobs) {
    executeChatJob(chatJob).catch((e) => {
      console.error(`Error executing chat job ${chatJob._id}:`, e);
    });
  }
}

// Main
async function startRunner() {
  console.log(`Workflow runner starting for namespace: ${config.namespace}`);
  console.log(`Convex URL: ${config.convexUrl}`);

  client = new ConvexClient(config.convexUrl);

  const namespace = await client.query(api.namespaces.getByName, {
    name: config.namespace,
  });

  if (!namespace) {
    console.error(`Error: Namespace "${config.namespace}" not found in database.`);
    console.error("Run 'npx tsx init.ts' to initialize the namespace first.");
    process.exit(1);
  }

  const namespaceId = namespace._id;
  console.log(`Found namespace ID: ${namespaceId}`);

  // Reconcile any orphaned jobs from previous runner crash
  await executor.reconcileOrphans(async (result) => {
    console.log(`[Reconcile] ${result.jobId}: ${result.finalStatus}`);
    // Note: We don't update Convex here because orphaned jobs may have already
    // been marked as failed/timed out by the scheduler. The file-based status
    // is the authoritative record for the TUI monitor.
  });

  // Subscribe to assignment-based jobs
  unsubscribeJobs = client.onUpdate(
    api.scheduler.getReadyJobs,
    { namespaceId },
    (readyJobs: ReadyJob[]) => {
      console.log(`Queue update: ${readyJobs.length} ready jobs`);
      processQueue(readyJobs).catch((e) => {
        console.error("Error processing queue:", e);
      });
    },
    (error: Error) => {
      console.error("Jobs subscription error:", error);
      cleanup();
      setTimeout(startRunner, 5000);
    }
  );

  // Subscribe to chat jobs (separate from assignments)
  unsubscribeChatJobs = client.onUpdate(
    api.scheduler.getReadyChatJobs,
    { namespaceId },
    (readyChatJobs: ReadyChatJob[]) => {
      if (readyChatJobs.length > 0) {
        console.log(`Chat queue update: ${readyChatJobs.length} ready chat jobs`);
      }
      processChatQueue(readyChatJobs).catch((e) => {
        console.error("Error processing chat queue:", e);
      });
    },
    (error: Error) => {
      console.error("Chat jobs subscription error:", error);
      cleanup();
      setTimeout(startRunner, 5000);
    }
  );
}

function cleanup() {
  unsubscribeJobs?.();
  unsubscribeJobs = null;
  unsubscribeChatJobs?.();
  unsubscribeChatJobs = null;

  // Kill all active jobs via executor
  executor.killAll();

  client?.close();
  client = null;
}

startRunner();

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nShutting down...");
  cleanup();
  process.exit(0);
});

// Keep alive
setInterval(() => {}, 1000);
