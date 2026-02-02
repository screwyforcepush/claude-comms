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
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

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
  determinePromptType,
} from "./lib/prompts.js";

// Stream handlers (extracted module)
import {
  StreamHandler,
  CommandOptions,
  createStreamHandler,
  buildCommand,
} from "./lib/streams.js";

// File-based job tracking (for agent_monitor.py TUI)
import { JobTracker } from "./lib/file-tracker.js";

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
type Harness = "claude" | "codex" | "gemini";

interface Config {
  convexUrl: string;
  namespace: string;
  timeoutMs: number;
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
        harness: getHarnessForJobType("chat"),
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

    // File-based tracking for agent_monitor.py TUI
    const tracker = new JobTracker(jobId, job.harness, child.pid || 0);

    // Timeout
    const timeout = setTimeout(async () => {
      timedOut = true;
      console.log(`[${jobId}] Timeout after ${config.timeoutMs}ms`);
      tracker.timeout();
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
        // Log raw JSON to file for debugging
        tracker.logLine(line);
        try {
          const event = JSON.parse(line);
          handler.onEvent(event);
          // Update tracker with event type as status reason
          const eventType = (event.type as string) || "event";
          tracker.recordEvent(eventType);
        } catch {
          // Not JSON, ignore
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${jobId}] stderr: ${data.toString()}`);
      tracker.logLine(`[stderr] ${data.toString()}`);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      runningJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      try {
        if (timedOut) {
          // tracker.timeout() already called in timeout handler
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
          tracker.complete(result);
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
          tracker.fail(`process_exit_${code}`);
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
        tracker.fail(`error: ${e}`);
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
    harness: getHarnessForJobType(jobType),
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

  // Build prompt with differential prompting
  const promptType = determinePromptType(chatContext);
  const prompt = buildChatPrompt(chatContext, config.namespace);
  const resumeInfo = chatContext.claudeSessionId
    ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
    : " (new session)";
  console.log(`[${jobId}] Chat mode: ${chatContext.mode}, prompt: ${promptType}, thread: ${chatContext.threadId}${resumeInfo}`);

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

    // File-based tracking for agent_monitor.py TUI
    const tracker = new JobTracker(jobId, chatJob.harness, child.pid || 0);

    // Timeout
    const timeout = setTimeout(async () => {
      timedOut = true;
      console.log(`[${jobId}] Timeout after ${config.timeoutMs}ms`);
      tracker.timeout();
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
        // Log raw JSON to file for debugging
        tracker.logLine(line);
        try {
          const event = JSON.parse(line);
          handler.onEvent(event);
          // Update tracker with event type as status reason
          const eventType = (event.type as string) || "event";
          tracker.recordEvent(eventType);
        } catch {
          // Not JSON, ignore
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`[${jobId}] stderr: ${data.toString()}`);
      tracker.logLine(`[stderr] ${data.toString()}`);
    });

    child.on("close", async (code) => {
      clearTimeout(timeout);
      runningChatJobs.delete(jobId);

      const result = handler.getResult();
      console.log(`[${jobId}] Exited with code ${code}`);

      try {
        if (timedOut) {
          // tracker.timeout() already called in timeout handler
          await client!.mutation(api.chatJobs.fail, {
            id: jobId,
            result: `Timeout after ${config.timeoutMs}ms. Partial result:\n${result}`,
          });
          await saveChatResponse(chatContext.threadId,
            `I apologize, but I ran into a timeout. Here's what I was able to process:\n\n${result || "(no output)"}`
          );
        } else if (code === 0 && handler.isComplete()) {
          tracker.complete(result);
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
          // Save lastPromptMode for differential prompting (skip for guardian eval)
          if (!chatContext.isGuardianEvaluation) {
            await saveLastPromptMode(chatContext.threadId, chatContext.effectivePromptMode);
          }
        } else {
          tracker.fail(`process_exit_${code}`);
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
        tracker.fail(`error: ${e}`);
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
