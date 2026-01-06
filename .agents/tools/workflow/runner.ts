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
import { api } from "./workflow-engine/convex/_generated/api.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Type definitions
interface Assignment {
  _id: string;
  _creationTime: number;
  namespace: string;
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
let unsubscribe: (() => void) | null = null;
const runningJobs = new Map<string, ChildProcess>();

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

// Prompt building
function buildPrompt(
  jobType: string,
  assignment: Assignment,
  job: Job,
  previousResult: string | null
): string {
  const template = loadTemplate(jobType);

  return template
    .replace("{{NORTH_STAR}}", assignment.northStar)
    .replace("{{ARTIFACTS}}", assignment.artifacts || "(none)")
    .replace("{{DECISIONS}}", assignment.decisions || "(none)")
    .replace("{{CONTEXT}}", job.context || "(no specific context)")
    .replace("{{PREVIOUS_RESULT}}", previousResult || "(no previous result)");
}

// Harness command building
function buildCommand(harness: string, prompt: string): { cmd: string; args: string[] } {
  switch (harness) {
    case "claude":
      return {
        cmd: "claude",
        args: [
          "--dangerously-skip-permissions",
          "--verbose",
          "--output-format",
          "stream-json",
          "-p",
          prompt,
        ],
      };
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
}

class ClaudeStreamHandler implements StreamHandler {
  private textChunks: string[] = [];
  private finalResult: string | null = null;
  private complete = false;
  private success = false;

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

    // Capture final result
    if (type === "result") {
      this.complete = true;
      this.success = event.subtype === "success";
      if (event.result) {
        this.finalResult = String(event.result);
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
  previousResult: string | null
): Promise<void> {
  const jobId = job._id;
  console.log(`[${jobId}] Starting ${job.jobType} job (${job.harness})`);

  // Mark job as running
  await client!.mutation(api.jobs.start, { id: jobId });

  const prompt = buildPrompt(job.jobType, assignment, job, previousResult);
  const { cmd, args } = buildCommand(job.harness, prompt);

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
        // Trigger retrospect
        await triggerPMJob(job, assignment, true);
      } else if (code === 0 && handler.isComplete()) {
        await client!.mutation(api.jobs.complete, {
          id: jobId,
          result,
        });
        // Trigger PM review (unless this was a PM job)
        if (job.jobType !== "pm") {
          await triggerPMJob(job, assignment, false);
        }
      } else {
        await client!.mutation(api.jobs.fail, {
          id: jobId,
          result: result || `Process exited with code ${code}`,
        });
        // Trigger retrospect
        await triggerPMJob(job, assignment, true);
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

async function processQueue(readyJobs: ReadyJob[]): Promise<void> {
  if (readyJobs.length === 0) return;

  // Filter out jobs we're already running
  const newJobs = readyJobs.filter((r) => !runningJobs.has(r.job._id));
  if (newJobs.length === 0) return;

  // Check parallelism rules
  const independentJobs = newJobs.filter((r) => r.assignment.independent);
  const sequentialJobs = newJobs.filter((r) => !r.assignment.independent);

  // Run all independent jobs
  for (const { job, assignment, previousResult } of independentJobs) {
    executeJob(job, assignment, previousResult).catch((e) => {
      console.error(`Error executing job ${job._id}:`, e);
    });
  }

  // Run at most one sequential job (if no sequential is already running)
  const hasRunningSequential = Array.from(runningJobs.keys()).some((id) => {
    // Check if this running job is from a non-independent assignment
    // For simplicity, we'll just run one sequential at a time
    return true; // TODO: track which jobs are sequential
  });

  if (sequentialJobs.length > 0 && runningJobs.size === independentJobs.length) {
    const { job, assignment, previousResult } = sequentialJobs[0];
    executeJob(job, assignment, previousResult).catch((e) => {
      console.error(`Error executing job ${job._id}:`, e);
    });
  }
}

// Main
function startRunner() {
  console.log(`Workflow runner starting for namespace: ${config.namespace}`);
  console.log(`Convex URL: ${config.convexUrl}`);

  client = new ConvexClient(config.convexUrl);

  unsubscribe = client.onUpdate(
    api.scheduler.getReadyJobs,
    { namespace: config.namespace },
    (readyJobs: ReadyJob[]) => {
      console.log(`Queue update: ${readyJobs.length} ready jobs`);
      processQueue(readyJobs).catch((e) => {
        console.error("Error processing queue:", e);
      });
    },
    (error: Error) => {
      console.error("Subscription error:", error);
      // Restart after delay
      cleanup();
      setTimeout(startRunner, 5000);
    }
  );
}

function cleanup() {
  unsubscribe?.();
  unsubscribe = null;

  // Kill running jobs
  for (const [id, child] of runningJobs) {
    console.log(`Killing job ${id}`);
    child.kill("SIGTERM");
  }
  runningJobs.clear();

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
