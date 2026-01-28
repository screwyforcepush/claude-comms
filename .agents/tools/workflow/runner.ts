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

// Use anyApi for dynamic function references (works with ConvexClient)
const api = anyApi;
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Type definitions
interface Assignment {
  _id: string;
  _creationTime: number;
  namespaceId: string;
  northStar: string;
  status: "pending" | "active" | "blocked" | "complete";
  blockedReason?: string;
  independent: boolean;
  priority: number;
  artifacts: string;
  decisions: string;
  headJobId?: string;
  createdAt: number;
  updatedAt: number;
}

interface Job {
  _id: string;
  _creationTime: number;
  assignmentId: string;
  jobType: string;
  harness: "claude" | "codex" | "gemini";
  context?: string;
  status: "pending" | "running" | "complete" | "failed";
  result?: string;
  nextJobId?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

// Chat-specific types
interface ChatThread {
  _id: string;
  namespaceId: string;
  title: string;
  mode: "jam" | "cook";
  createdAt: number;
  updatedAt: number;
}

interface ChatMessage {
  _id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface ChatJobContext {
  threadId: string;
  namespaceId: string;
  mode: "jam" | "cook";
  messages: ChatMessage[];
  latestUserMessage: string;
  claudeSessionId?: string; // For session resume
}

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

// State
let client: ConvexClient | null = null;
let unsubscribeJobs: (() => void) | null = null;
let unsubscribeChatJobs: (() => void) | null = null;
const runningJobs = new Map<string, ChildProcess>();
const runningChatJobs = new Map<string, ChildProcess>();

// Template loading
function loadTemplate(jobType: string): string {
  const templatePath = join(__dirname, "templates", `${jobType}.md`);
  try {
    return readFileSync(templatePath, "utf-8");
  } catch {
    console.error(`Template not found: ${jobType}.md`);
    return "Execute the task as described.\n\n{{CONTEXT}}";
  }
}

// Build job history summary
function buildJobHistory(jobs: Job[]): string {
  if (!jobs || jobs.length === 0) return "(no previous jobs)";

  const lines = jobs.map((j, i) => {
    const status = j.status === 'complete' ? '✓' : j.status === 'failed' ? '✗' : '○';
    const duration = j.completedAt && j.startedAt
      ? `${Math.round((j.completedAt - j.startedAt) / 1000)}s`
      : '-';
    const resultPreview = j.result
      ? j.result.slice(0, 150).replace(/\n/g, ' ') + (j.result.length > 150 ? '...' : '')
      : '-';
    return `${i + 1}. [${status}] ${j.jobType} (${j.harness}) - ${j.status} - ${duration}\n   Result: ${resultPreview}`;
  });

  return lines.join('\n\n');
}

// Prompt building
function buildPrompt(
  jobType: string,
  assignment: Assignment,
  job: Job,
  previousResult: string | null,
  jobHistory: Job[] = []
): string {
  const template = loadTemplate(jobType);

  return template
    .replace(/\{\{NORTH_STAR\}\}/g, assignment.northStar)
    .replace(/\{\{ARTIFACTS\}\}/g, assignment.artifacts || "(none)")
    .replace(/\{\{DECISIONS\}\}/g, assignment.decisions || "(none)")
    .replace(/\{\{CONTEXT\}\}/g, job.context || "(no specific context)")
    .replace(/\{\{PREVIOUS_RESULT\}\}/g, previousResult || "(no previous result)")
    .replace(/\{\{ASSIGNMENT_ID\}\}/g, assignment._id)
    .replace(/\{\{CURRENT_JOB_ID\}\}/g, job._id)
    .replace(/\{\{JOB_HISTORY\}\}/g, buildJobHistory(jobHistory));
}

// Chat prompt building with Handlebars-style conditionals
// Note: Conversation history is handled by Claude session resume, not in the prompt
function buildChatPrompt(chatContext: ChatJobContext): string {
  const template = loadTemplate("product-owner");
  const isNewSession = !chatContext.claudeSessionId;

  // Process Handlebars-style conditionals
  let processed = template;

  // Handle {{#if COOK_MODE}}...{{else}}...{{/if}}
  const cookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(cookModeRegex, (_match, cookContent, jamContent) => {
    return chatContext.mode === "cook" ? cookContent : jamContent;
  });

  // Handle simple {{#if COOK_MODE}}...{{/if}} without else
  const simpleCookModeRegex = /\{\{#if COOK_MODE\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(simpleCookModeRegex, (_match, content) => {
    return chatContext.mode === "cook" ? content : "";
  });

  // Handle {{#if NEW_SESSION}}...{{/if}} for first message only
  const newSessionRegex = /\{\{#if NEW_SESSION\}\}([\s\S]*?)\{\{\/if\}\}/g;
  processed = processed.replace(newSessionRegex, (_match, content) => {
    return isNewSession ? content : "";
  });

  // Replace template variables
  // Note: {{MESSAGES}} removed - conversation history handled by Claude session resume
  // Use config.namespace for display (human-readable name) instead of namespaceId
  return processed
    .replace(/\{\{THREAD_ID\}\}/g, chatContext.threadId)
    .replace(/\{\{NAMESPACE\}\}/g, config.namespace)
    .replace(/\{\{MODE\}\}/g, chatContext.mode)
    .replace(/\{\{LATEST_MESSAGE\}\}/g, chatContext.latestUserMessage);
}

// Parse chat context from job context field
function parseChatContext(contextStr: string): ChatJobContext | null {
  try {
    return JSON.parse(contextStr) as ChatJobContext;
  } catch {
    console.error("Failed to parse chat context:", contextStr);
    return null;
  }
}

// Check if a job is a chat job
function isChatJob(job: Job): boolean {
  return job.jobType === "chat" || job.jobType === "product-owner";
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

// Fetch job history for an assignment
async function fetchJobHistory(assignmentId: string): Promise<Job[]> {
  try {
    const jobs = await client!.query(api.jobs.list, { assignmentId: assignmentId as any });
    // Sort by createdAt and filter out pending jobs
    return jobs
      .filter((j: Job) => j.status !== 'pending')
      .sort((a: Job, b: Job) => a.createdAt - b.createdAt);
  } catch (e) {
    console.error('Failed to fetch job history:', e);
    return [];
  }
}

// Job execution
async function executeJob(
  job: Job,
  assignment: Assignment,
  previousResult: string | null
): Promise<void> {
  const jobId = job._id;
  const isChat = isChatJob(job);
  let chatContext: ChatJobContext | null = null;

  console.log(`[${jobId}] Starting ${job.jobType} job (${job.harness})${isChat ? ' [CHAT]' : ''}`);

  // Mark job as running
  await client!.mutation(api.jobs.start, { id: jobId });

  // Build prompt based on job type
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
    prompt = buildChatPrompt(chatContext);
    const resumeInfo = chatContext.claudeSessionId
      ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
      : ' (new session)';
    console.log(`[${jobId}] Chat mode: ${chatContext.mode}, thread: ${chatContext.threadId}${resumeInfo}`);
  } else {
    // Regular job: use standard prompt building
    let jobHistory: Job[] = [];
    if (job.jobType === 'pm' || job.jobType === 'retrospect') {
      jobHistory = await fetchJobHistory(assignment._id);
    }
    prompt = buildPrompt(job.jobType, assignment, job, previousResult, jobHistory);
  }

  // Build command with optional session resume for chat jobs
  const commandOptions: CommandOptions = {};
  if (isChat && chatContext?.claudeSessionId && job.harness === "claude") {
    commandOptions.sessionId = chatContext.claudeSessionId;
  }
  const { cmd, args } = buildCommand(job.harness, prompt, commandOptions);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
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
          // Re-fetch job to check if nextJobId was added during execution
          const updatedJob = await client!.query(api.jobs.get, { id: jobId });
          const hasNextJob = updatedJob?.nextJobId != null;

          if (!hasNextJob && (job.jobType === "pm" || job.jobType === "retrospect" || job.jobType === "uat")) {
            // Terminal job types with no successor - mark assignment complete
            console.log(`[${jobId}] Final ${job.jobType} complete, marking assignment ${assignment._id} as complete`);
            await client!.mutation(api.assignments.complete, {
              id: assignment._id,
            });
          } else if (!hasNextJob) {
            // Non-terminal job with no successor - trigger PM review
            await triggerPMJob(job, assignment, false);
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

      resolve();
    });
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
  for (const { job, assignment, previousResult } of newJobs) {
    executeJob(job, assignment, previousResult).catch((e) => {
      console.error(`Error executing job ${job._id}:`, e);
    });
  }
}

// Chat job execution (separate from assignment jobs)
async function executeChatJob(chatJob: ChatJob): Promise<void> {
  const jobId = chatJob._id;
  console.log(`[${jobId}] Starting chat job (${chatJob.harness})`);

  // Mark job as running
  await client!.mutation(api.chatJobs.start, { id: jobId });

  // Parse chat context
  const chatContext = parseChatContext(chatJob.context);
  if (!chatContext) {
    console.error(`[${jobId}] Invalid chat context, failing job`);
    await client!.mutation(api.chatJobs.fail, {
      id: jobId,
      result: "Invalid chat context provided",
    });
    return;
  }

  const prompt = buildChatPrompt(chatContext);
  const resumeInfo = chatContext.claudeSessionId
    ? ` (resuming session ${chatContext.claudeSessionId.slice(0, 8)}...)`
    : " (new session)";
  console.log(`[${jobId}] Chat mode: ${chatContext.mode}, thread: ${chatContext.threadId}${resumeInfo}`);

  // Build command with optional session resume
  const commandOptions: CommandOptions = {};
  if (chatContext.claudeSessionId && chatJob.harness === "claude") {
    commandOptions.sessionId = chatContext.claudeSessionId;
  }
  const { cmd, args } = buildCommand(chatJob.harness, prompt, commandOptions);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
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
