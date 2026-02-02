#!/usr/bin/env npx tsx
/**
 * Workflow Runner Daemon
 *
 * Subscribes to Convex and executes jobs as they become ready.
 * Runs forever, reacting to database changes.
 *
 * Usage:
 *   npx tsx runner.ts
 *
 * Config via config.json in same directory.
 */

import { spawn, ChildProcess } from "child_process";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

// Prompt building (extracted module)
import {
  Assignment,
  Job,
  ChatJobContext,
  ChatMessage,
  AccumulatedJobResult,
  buildPrompt,
  buildChatPrompt,
  parseChatContext,
  isChatJob,
} from "./lib/prompts.js";

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
  defaultHarness: "claude" | "codex" | "gemini";
  timeoutMs: number;
  pmHarness: "claude" | "codex" | "gemini";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

// =============================================================================
// File-based job tracking (compatible with agent_monitor.py TUI)
// =============================================================================

interface FileJobStatus {
  job_id: string;
  harness: string;
  agent_id: string | null;
  pid: number | null;
  logs: string | null;
  status: "running" | "complete" | "error" | "timeout";
  status_reason: string | null;
  start_time: string | null;
  last_event_time: string | null;
  end_time: string | null;
  operations: number;
  completion: {
    messages: string[];
    final_message: string | null;
    tokens: {
      input: number | null;
      output: number | null;
      total: number | null;
    };
    duration_ms: number | null;
  };
}

function getJobsRoot(): string {
  if (process.env.AGENT_JOBS_ROOT) {
    return process.env.AGENT_JOBS_ROOT;
  }
  const user = process.env.USER || "unknown";
  return join(tmpdir(), "agent_jobs", user);
}

function utcNowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function createFileJobStatus(jobId: string, harness: string, pid: number): FileJobStatus {
  return {
    job_id: jobId,
    harness,
    agent_id: jobId,
    pid,
    logs: null, // Set after dir creation
    status: "running",
    status_reason: "initializing",
    start_time: utcNowIso(),
    last_event_time: utcNowIso(),
    end_time: null,
    operations: 0,
    completion: {
      messages: [],
      final_message: null,
      tokens: { input: null, output: null, total: null },
      duration_ms: null,
    },
  };
}

function getJobDir(jobId: string): string {
  return join(getJobsRoot(), jobId);
}

function ensureJobDir(jobId: string): { statusPath: string; logPath: string } {
  const jobDir = getJobDir(jobId);
  mkdirSync(jobDir, { recursive: true });
  return {
    statusPath: join(jobDir, "status.json"),
    logPath: join(jobDir, "agent.log"),
  };
}

function writeJobStatus(statusPath: string, status: FileJobStatus): void {
  const tmpPath = statusPath + ".tmp";
  writeFileSync(tmpPath, JSON.stringify(status, null, 2));
  // Atomic rename
  const { renameSync } = require("fs");
  renameSync(tmpPath, statusPath);
}

function appendToLog(logPath: string, line: string): void {
  appendFileSync(logPath, line + "\n");
}

// State
let client: ConvexClient | null = null;
let unsubscribeJobs: (() => void) | null = null;
let unsubscribeChatJobs: (() => void) | null = null;
const runningJobs = new Map<string, ChildProcess>();
const runningChatJobs = new Map<string, ChildProcess>();

// Note: Template loading, prompt building, and chat context parsing
// have been extracted to ./lib/prompts.ts

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
    // Use dedicated query to find guardian thread for this assignment
    const guardianThread: ChatThread | null = await client!.query(
      api.chatThreads.getGuardianThread,
      { assignmentId: assignment._id as any }
    );

    if (!guardianThread) {
      // No guardian thread - this is normal for non-guardian assignments
      console.log(`[Guardian] No guardian thread for assignment ${assignment._id}`);
      return;
    }

    console.log(`[Guardian] Found guardian thread ${guardianThread._id}, triggering evaluation`);

    // 1. Insert PM response as chatMessage (role: 'pm')
    // This must succeed before triggering evaluation
    try {
      await client!.mutation(api.chatMessages.add, {
        threadId: guardianThread._id as any,
        role: "pm",
        content: pmResult,
      });
      console.log(`[Guardian] Inserted PM response as message in thread`);
    } catch (msgError) {
      console.error(`[Guardian] Failed to insert PM message:`, msgError);
      // Don't trigger evaluation if message insert failed
      throw new Error(`Guardian PM message insert failed: ${msgError}`);
    }

    // 2. Trigger chatJob for PO evaluation (with guardian evaluation flag)
    try {
      await client!.mutation(api.chatJobs.trigger, {
        threadId: guardianThread._id as any,
        harness: config.pmHarness,
        isGuardianEvaluation: true,
      });
      console.log(`[Guardian] Triggered PO evaluation chatJob`);
    } catch (triggerError) {
      console.error(`[Guardian] Failed to trigger evaluation job:`, triggerError);
      // PM message is in thread but evaluation didn't trigger
      // This is logged but not fatal - user can see PM message in thread
      throw new Error(`Guardian evaluation trigger failed: ${triggerError}`);
    }
  } catch (e) {
    // Log with assignment context for debugging
    console.error(`[Guardian] Evaluation failed for assignment ${assignment._id}:`, e);
    // Don't rethrow - guardian failure shouldn't block assignment completion
    // But the error is now clearly logged with context
  }
}

// Harness command building
interface CommandOptions {
  sessionId?: string; // For Claude session resume
}

function buildCommand(harness: string, prompt: string, options: CommandOptions = {}): { cmd: string; args: string[] } {
  switch (harness) {
    case "claude": {
      const args = [
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format",
        "stream-json",
      ];

      // Add --resume flag for session continuity
      if (options.sessionId) {
        args.push("--resume", options.sessionId);
      }

      args.push("-p", prompt);
      return { cmd: "claude", args };
    }
    case "codex":
      return {
        cmd: "codex",
        args: ["--yolo", "e", prompt, "--json"],
      };
    case "gemini":
      return {
        cmd: "gemini",
        args: ["--yolo", "-m", "gemini-2.5-pro", "--output-format", "stream-json", prompt],
      };
    default:
      throw new Error(`Unknown harness: ${harness}`);
  }
}

// JSON stream parsing for different harnesses
interface StreamHandler {
  onEvent(event: Record<string, unknown>): void;
  getResult(): string;
  isComplete(): boolean;
  getSessionId(): string | null; // For Claude session resume
}

class ClaudeStreamHandler implements StreamHandler {
  private textChunks: string[] = [];
  private finalResult: string | null = null;
  private complete = false;
  private success = false;
  private sessionId: string | null = null;

  onEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    // Capture assistant text messages
    if (type === "assistant" && event.message) {
      const msg = event.message as { content?: Array<{ type?: string; text?: string }> };
      if (msg.content) {
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            this.textChunks.push(block.text);
          }
        }
      }
    }

    // Capture final result and session_id
    if (type === "result") {
      this.complete = true;
      this.success = event.subtype === "success";
      if (event.result) {
        this.finalResult = String(event.result);
      }
      // Capture session_id for resume functionality
      if (event.session_id) {
        this.sessionId = String(event.session_id);
      }
    }
  }

  getResult(): string {
    // Prefer the final result field, fall back to accumulated text
    return this.finalResult || this.textChunks.join("\n\n");
  }

  isComplete(): boolean {
    return this.complete && this.success;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}

class CodexStreamHandler implements StreamHandler {
  private messages: string[] = [];
  private complete = false;

  onEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    if (type === "item.completed") {
      const item = event.item as { type?: string; text?: string } | undefined;
      if (item?.type === "agent_message" && item.text) {
        this.messages.push(item.text);
      }
    }

    if (type === "turn.completed") {
      this.complete = true;
    }
  }

  getResult(): string {
    return this.messages.join("\n\n");
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return null; // Codex doesn't support session resume
  }
}

class GeminiStreamHandler implements StreamHandler {
  private buffer = "";
  private complete = false;

  onEvent(event: Record<string, unknown>) {
    const type = event.type as string;

    if (type === "message" && event.role === "assistant") {
      const content = event.content as string | undefined;
      if (content) this.buffer += content;
    }

    if (type === "result") {
      this.complete = true;
    }
  }

  getResult(): string {
    return this.buffer;
  }

  isComplete(): boolean {
    return this.complete;
  }

  getSessionId(): string | null {
    return null; // Gemini doesn't support session resume
  }
}

function createStreamHandler(harness: string): StreamHandler {
  switch (harness) {
    case "claude":
      return new ClaudeStreamHandler();
    case "codex":
      return new CodexStreamHandler();
    case "gemini":
      return new GeminiStreamHandler();
    default:
      return new ClaudeStreamHandler();
  }
}

// Job execution
async function executeJob(
  job: Job,
  assignment: Assignment,
  previousResult: string | null,
  accumulatedResults: AccumulatedJobResult[]
): Promise<void> {
  const jobId = job._id;
  const isChat = isChatJob(job);
  let chatContext: ChatJobContext | null = null;

  console.log(`[${jobId}] Starting ${job.jobType} job (${job.harness})${isChat ? ' [CHAT]' : ''}`);

  // Build prompt FIRST (before marking as running, so we can save it)
  let prompt: string;

  if (isChat) {
    // Chat job: parse context and build chat-specific prompt
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
    // Regular job: use standard prompt building
    prompt = buildPrompt(job.jobType, assignment, job, previousResult, accumulatedResults);
  }

  // Mark job as running with prompt for visibility
  await client!.mutation(api.jobs.start, { id: jobId, prompt });

  // Build command with optional session resume for chat jobs
  const commandOptions: CommandOptions = {};
  if (isChat && chatContext?.claudeSessionId && job.harness === "claude") {
    commandOptions.sessionId = chatContext.claudeSessionId;
  }
  const { cmd, args } = buildCommand(job.harness, prompt, commandOptions);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Pass assignment and job context so CLI can auto-link
        WORKFLOW_ASSIGNMENT_ID: assignment._id,
        WORKFLOW_JOB_ID: job._id,
      },
    });

    runningJobs.set(jobId, child);

    const handler = createStreamHandler(job.harness);
    let buffer = "";
    let timedOut = false;

    // Timeout
    const timeout = setTimeout(async () => {
      timedOut = true;
      console.log(`[${jobId}] Timeout after ${config.timeoutMs}ms`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, config.timeoutMs);

    // Parse stdout
    child.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          handler.onEvent(event);
        } catch {
          // Not JSON, ignore
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${jobId}] stderr: ${data.toString()}`);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      runningJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      try {
        if (timedOut) {
          await client!.mutation(api.jobs.fail, {
            id: jobId,
            result: `Timeout after ${config.timeoutMs}ms. Partial result:\n${result}`,
          });
          // Chat jobs: save error to thread, no PM trigger
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId,
              `I apologize, but I ran into a timeout. Here's what I was able to process:\n\n${result || "(no output)"}`
            );
          } else {
            // Regular jobs: trigger retrospect
            await triggerPMJob(job, assignment, true);
          }
        } else if (code === 0 && handler.isComplete()) {
          await client!.mutation(api.jobs.complete, {
            id: jobId,
            result,
          });
          // Chat jobs: save response to thread and session_id, no PM trigger
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId, result);
            // Save session_id for future resume (Claude only)
            const newSessionId = handler.getSessionId();
            if (newSessionId) {
              await saveSessionId(chatContext.threadId, newSessionId);
            }
          } else {
            // Check if this job should trigger PM review
            // Re-fetch job to check if nextJobId was added during execution
            const updatedJob = await client!.query(api.jobs.get, { id: jobId });
            const hasNextJob = updatedJob?.nextJobId != null;

            if (job.jobType === "pm") {
              // PM job completed - ALWAYS trigger guardian evaluation (if applicable)
              await triggerGuardianEvaluation(assignment, result);
              // Then check if assignment is done (only if no next job)
              if (!hasNextJob) {
                await checkAndCompleteAssignment(assignment._id, jobId);
              }
            } else if (!hasNextJob && job.jobType !== "retrospect") {
              // Regular job with no successor - trigger PM review
              await triggerPMJob(job, assignment, false);
            } else if (!hasNextJob) {
              // retrospect with no successor - check if ALL jobs in assignment are done
              await checkAndCompleteAssignment(assignment._id, jobId);
            }
            // If hasNextJob, the next job will be picked up by the scheduler
          }
        } else {
          await client!.mutation(api.jobs.fail, {
            id: jobId,
            result: result || `Process exited with code ${code}`,
          });
          // Chat jobs: save error to thread, no PM trigger
          if (isChat && chatContext) {
            await saveChatResponse(chatContext.threadId,
              `I encountered an issue while processing your request. Please try again or rephrase your question.\n\nError details: ${result || `Exit code ${code}`}`
            );
          } else {
            // Regular jobs: trigger retrospect
            await triggerPMJob(job, assignment, true);
          }
        }
      } catch (e) {
        console.error(`[${jobId}] Error completing job:`, e);
        // Don't crash - log and continue
      }

      resolve();
    });
  });
}

// Check if all jobs in assignment are done, if so mark complete
async function checkAndCompleteAssignment(assignmentId: string, completedJobId: string): Promise<void> {
  // Fetch all jobs for this assignment
  const jobs = await client!.query(api.jobs.list, { assignmentId: assignmentId as any });

  // Check if any job is still pending or running
  const hasIncompleteJobs = jobs.some(
    (j: Job) => j.status === "pending" || j.status === "running"
  );

  if (hasIncompleteJobs) {
    console.log(`[${completedJobId}] Assignment ${assignmentId} still has incomplete jobs, not marking complete`);
    return;
  }

  // All jobs are complete or failed - mark assignment complete
  console.log(`[${completedJobId}] All jobs done, marking assignment ${assignmentId} as complete`);
  await client!.mutation(api.assignments.complete, {
    id: assignmentId,
  });
}

// PM job triggering
async function triggerPMJob(
  completedJob: Job,
  assignment: Assignment,
  failed: boolean
): Promise<void> {
  const jobType = failed ? "retrospect" : "pm";
  const context = failed
    ? `Previous job (${completedJob.jobType}) failed. Analyze and determine recovery path.`
    : undefined;

  console.log(`[${completedJob._id}] Triggering ${jobType} job`);

  await client!.mutation(api.jobs.insertAfter, {
    afterJobId: completedJob._id,
    jobType,
    harness: config.pmHarness,
    context,
  });
}

// Scheduler
interface ReadyJob {
  job: Job;
  assignment: Assignment;
  previousResult: string | null;
  accumulatedResults: AccumulatedJobResult[];
}

interface ReadyChatJob {
  chatJob: ChatJob;
}

async function processQueue(readyJobs: ReadyJob[]): Promise<void> {
  if (readyJobs.length === 0) return;

  // Filter out jobs we're already running
  const newJobs = readyJobs.filter((r) => !runningJobs.has(r.job._id));
  if (newJobs.length === 0) return;

  // The scheduler handles sequential vs independent logic - just run what it returns
  for (const { job, assignment, previousResult, accumulatedResults } of newJobs) {
    // Double-check assignment status before executing (handles race with blocking)
    const currentAssignment = await client!.query(api.assignments.get, {
      id: assignment._id,
    });
    if (currentAssignment?.status === "blocked") {
      console.log(`[${job._id}] Assignment ${assignment._id} is blocked, skipping`);
      continue;
    }

    executeJob(job, assignment, previousResult, accumulatedResults).catch((e) => {
      console.error(`Error executing job ${job._id}:`, e);
    });
  }
}

// Chat job execution (separate from assignment jobs)
async function executeChatJob(chatJob: ChatJob): Promise<void> {
  const jobId = chatJob._id;
  console.log(`[${jobId}] Starting chat job (${chatJob.harness})`);

  // Parse chat context FIRST
  const chatContext = parseChatContext(chatJob.context);
  if (!chatContext) {
    console.error(`[${jobId}] Invalid chat context, failing job`);
    await client!.mutation(api.chatJobs.fail, {
      id: jobId,
      result: "Invalid chat context provided",
    });
    return;
  }

  // Build prompt
  const prompt = buildChatPrompt(chatContext, config.namespace);
  const resumeInfo = chatContext.claudeSessionId
    ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
    : " (new session)";
  console.log(`[${jobId}] Chat mode: ${chatContext.mode}, thread: ${chatContext.threadId}${resumeInfo}`);

  // Mark job as running with prompt for visibility
  await client!.mutation(api.chatJobs.start, { id: jobId, prompt });

  // Build command with optional session resume
  const commandOptions: CommandOptions = {};
  if (chatContext.claudeSessionId && chatJob.harness === "claude") {
    commandOptions.sessionId = chatContext.claudeSessionId;
  }
  const { cmd, args } = buildCommand(chatJob.harness, prompt, commandOptions);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        // Pass thread ID so CLI can auto-link assignments
        WORKFLOW_THREAD_ID: chatContext.threadId,
        WORKFLOW_NAMESPACE_ID: chatContext.namespaceId,
      },
    });

    runningChatJobs.set(jobId, child);

    const handler = createStreamHandler(chatJob.harness);
    let buffer = "";
    let timedOut = false;

    // Timeout
    const timeout = setTimeout(async () => {
      timedOut = true;
      console.log(`[${jobId}] Timeout after ${config.timeoutMs}ms`);
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
    }, config.timeoutMs);

    // Parse stdout
    child.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          handler.onEvent(event);
        } catch {
          // Not JSON, ignore
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${jobId}] stderr: ${data.toString()}`);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      runningChatJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      try {
        if (timedOut) {
          await client!.mutation(api.chatJobs.fail, {
            id: jobId,
            result: `Timeout after ${config.timeoutMs}ms. Partial result:\n${result}`,
          });
          await saveChatResponse(chatContext.threadId,
            `I apologize, but I ran into a timeout. Here's what I was able to process:\n\n${result || "(no output)"}`
          );
        } else if (code === 0 && handler.isComplete()) {
          await client!.mutation(api.chatJobs.complete, {
            id: jobId,
            result,
          });
          await saveChatResponse(chatContext.threadId, result);
          // Save session_id for future resume (Claude only)
          const newSessionId = handler.getSessionId();
          if (newSessionId) {
            await saveSessionId(chatContext.threadId, newSessionId);
          }
        } else {
          await client!.mutation(api.chatJobs.fail, {
            id: jobId,
            result: result || `Process exited with code ${code}`,
          });
          await saveChatResponse(chatContext.threadId,
            `I encountered an issue while processing your request. Please try again or rephrase your question.\n\nError details: ${result || `Exit code ${code}`}`
          );
        }
      } catch (e) {
        console.error(`[${jobId}] Error completing chat job:`, e);
        // Try to save error response to thread even if job update failed
        try {
          await saveChatResponse(chatContext.threadId,
            `I completed processing but encountered a system error saving the result. Please check the logs.`
          );
        } catch {
          // Ignore - best effort
        }
      }

      resolve();
    });
  });
}

async function processChatQueue(readyChatJobs: ReadyChatJob[]): Promise<void> {
  if (readyChatJobs.length === 0) return;

  // Filter out jobs we're already running
  const newJobs = readyChatJobs.filter((r) => !runningChatJobs.has(r.chatJob._id));
  if (newJobs.length === 0) return;

  // Chat jobs are always independent - run them all
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

  // Look up namespace ID by name
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

  // Kill running assignment jobs
  for (const [id, child] of runningJobs) {
    console.log(`Killing job ${id}`);
    child.kill("SIGTERM");
  }
  runningJobs.clear();

  // Kill running chat jobs
  for (const [id, child] of runningChatJobs) {
    console.log(`Killing chat job ${id}`);
    child.kill("SIGTERM");
  }
  runningChatJobs.clear();

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
