#!/usr/bin/env npx tsx
/**
 * Workflow Engine CLI
 *
 * Interface to the Convex backend for managing assignments and jobs.
 * Primary consumer: PM agent
 *
 * Usage:
 *   npx tsx cli.ts <command> [args]
 *
 * Commands:
 *   assignments [--status <status>]     List assignments
 *   assignment <id>                     Get assignment details with jobs
 *   jobs [--status <status>]            List jobs
 *   job <id>                            Get job details
 *   queue                               Show queue status
 *
 *   create <northStar> [--priority N] [--independent]   Create assignment
 *   insert-job <assignmentId> --type <type> --harness <harness> [--context <ctx>] [--after <jobId>]
 *   update-assignment <id> [--artifacts <str>] [--decisions <str>]
 *   complete <assignmentId>             Mark assignment complete
 *   block <assignmentId> --reason <str> Block assignment
 *   unblock <assignmentId>              Unblock assignment
 *
 *   start-job <jobId>                   Mark job as running
 *   complete-job <jobId> --result <str> Mark job as complete
 *   fail-job <jobId> [--result <str>]   Mark job as failed
 *
 * Chat Commands:
 *   chat-threads                        List chat threads
 *   chat-thread <threadId>              Get thread with messages
 *   chat-create [--title <title>]       Create a new chat thread
 *   chat-send <threadId> <message>      Send message and create chat job
 *   chat-mode <threadId> <jam|cook>     Change thread mode
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "./workflow-engine/convex/_generated/api.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

type Id<T extends string> = string & { __tableName: T };

// Load config
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

const client = new ConvexHttpClient(config.convexUrl);

// Argument parsing helpers
function parseArgs(args: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : "true";
      flags[key] = value;
      i += value === "true" ? 1 : 2;
    } else {
      positional.push(args[i]);
      i++;
    }
  }

  return { flags, positional };
}

function output(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function error(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

// Commands
async function listAssignments(status?: string) {
  const validStatuses = ["pending", "active", "blocked", "complete"];
  if (status && !validStatuses.includes(status)) {
    error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const result = await client.query(api.assignments.list, {
    namespace: config.namespace,
    status: status as any,
  });
  output(result);
}

async function getAssignment(id: string) {
  const result = await client.query(api.assignments.getWithJobs, {
    id: id as Id<"assignments">,
  });
  if (!result) error("Assignment not found");
  output(result);
}

async function listJobs(status?: string, assignmentId?: string) {
  const validStatuses = ["pending", "running", "complete", "failed"];
  if (status && !validStatuses.includes(status)) {
    error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const result = await client.query(api.jobs.list, {
    status: status as any,
    assignmentId: assignmentId as Id<"assignments"> | undefined,
  });
  output(result);
}

async function getJob(id: string) {
  const result = await client.query(api.jobs.getWithAssignment, {
    id: id as Id<"jobs">,
  });
  if (!result) error("Job not found");
  output(result);
}

async function getQueueStatus() {
  const result = await client.query(api.scheduler.getQueueStatus, {
    namespace: config.namespace,
  });
  output(result);
}

async function createAssignment(northStar: string, priority?: number, independent?: boolean) {
  const id = await client.mutation(api.assignments.create, {
    namespace: config.namespace,
    northStar,
    priority,
    independent,
  });
  output({ id, message: "Assignment created" });
}

async function insertJob(
  assignmentId: string,
  jobType: string,
  harness: string,
  context?: string,
  afterJobId?: string
) {
  const validHarnesses = ["claude", "codex", "gemini"];
  if (!validHarnesses.includes(harness)) {
    error(`Invalid harness. Must be one of: ${validHarnesses.join(", ")}`);
  }

  let id: string;
  if (afterJobId) {
    id = await client.mutation(api.jobs.insertAfter, {
      afterJobId: afterJobId as Id<"jobs">,
      jobType,
      harness: harness as "claude" | "codex" | "gemini",
      context,
    });
  } else {
    id = await client.mutation(api.jobs.create, {
      assignmentId: assignmentId as Id<"assignments">,
      jobType,
      harness: harness as "claude" | "codex" | "gemini",
      context,
    });
  }
  output({ id, message: "Job created" });
}

async function updateAssignment(id: string, artifacts?: string, decisions?: string) {
  await client.mutation(api.assignments.update, {
    id: id as Id<"assignments">,
    artifacts,
    decisions,
  });
  output({ message: "Assignment updated" });
}

async function completeAssignment(id: string) {
  await client.mutation(api.assignments.complete, {
    id: id as Id<"assignments">,
  });
  output({ message: "Assignment completed" });
}

async function blockAssignment(id: string, reason: string) {
  await client.mutation(api.assignments.block, {
    id: id as Id<"assignments">,
    reason,
  });
  output({ message: "Assignment blocked" });
}

async function unblockAssignment(id: string) {
  await client.mutation(api.assignments.unblock, {
    id: id as Id<"assignments">,
  });
  output({ message: "Assignment unblocked" });
}

async function startJob(id: string) {
  await client.mutation(api.jobs.start, {
    id: id as Id<"jobs">,
  });
  output({ message: "Job started" });
}

async function completeJob(id: string, result: string) {
  await client.mutation(api.jobs.complete, {
    id: id as Id<"jobs">,
    result,
  });
  output({ message: "Job completed" });
}

async function failJob(id: string, result?: string) {
  await client.mutation(api.jobs.fail, {
    id: id as Id<"jobs">,
    result,
  });
  output({ message: "Job failed" });
}

// Chat commands

async function listChatThreads() {
  const result = await client.query(api.chatThreads.list, {
    namespace: config.namespace,
  });
  output(result);
}

async function getChatThread(threadId: string) {
  const thread = await client.query(api.chatThreads.get, {
    id: threadId as Id<"chatThreads">,
  });
  if (!thread) error("Thread not found");

  const messages = await client.query(api.chatMessages.list, {
    threadId: threadId as Id<"chatThreads">,
  });

  output({ thread, messages });
}

async function createChatThread(title?: string) {
  const threadId = await client.mutation(api.chatThreads.create, {
    namespace: config.namespace,
    title,
    mode: "jam", // Default to safe mode
  });
  output({ threadId, message: "Chat thread created" });
}

async function changeChatMode(threadId: string, mode: string) {
  if (mode !== "jam" && mode !== "cook") {
    error("Mode must be 'jam' or 'cook'");
  }

  await client.mutation(api.chatThreads.updateMode, {
    id: threadId as Id<"chatThreads">,
    mode: mode as "jam" | "cook",
  });
  output({ message: `Thread mode changed to ${mode}` });
}

async function sendChatMessage(threadId: string, message: string, harness?: string) {
  // Get thread to check mode
  const thread = await client.query(api.chatThreads.get, {
    id: threadId as Id<"chatThreads">,
  });
  if (!thread) error("Thread not found");

  // Add user message to thread
  await client.mutation(api.chatMessages.add, {
    threadId: threadId as Id<"chatThreads">,
    role: "user",
    content: message,
  });

  // Get all messages for context
  const messages = await client.query(api.chatMessages.list, {
    threadId: threadId as Id<"chatThreads">,
  });

  // Create a hidden assignment for this thread if it doesn't exist
  // For simplicity, we create one per chat job (could be optimized to reuse)
  const assignmentId = await client.mutation(api.assignments.create, {
    namespace: config.namespace,
    northStar: `Chat thread: ${thread.title}`,
    independent: true, // Chat doesn't block other work
    priority: 0, // High priority for responsiveness
  });

  // Build chat context for the job
  const chatContext = {
    threadId,
    namespace: config.namespace,
    mode: thread.mode,
    messages,
    latestUserMessage: message,
  };

  // Create chat job
  const jobId = await client.mutation(api.jobs.create, {
    assignmentId: assignmentId as Id<"assignments">,
    jobType: "chat",
    harness: (harness || config.defaultHarness) as "claude" | "codex" | "gemini",
    context: JSON.stringify(chatContext),
  });

  output({
    threadId,
    assignmentId,
    jobId,
    mode: thread.mode,
    message: "Chat message sent, job created",
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    error("No command provided. Use --help for usage.");
  }

  const command = args[0];
  const { flags, positional } = parseArgs(args.slice(1));

  try {
    switch (command) {
      case "assignments":
        await listAssignments(flags.status);
        break;

      case "assignment":
        if (!positional[0]) error("Assignment ID required");
        await getAssignment(positional[0]);
        break;

      case "jobs":
        await listJobs(flags.status, flags.assignment);
        break;

      case "job":
        if (!positional[0]) error("Job ID required");
        await getJob(positional[0]);
        break;

      case "queue":
        await getQueueStatus();
        break;

      case "create":
        if (!positional[0]) error("North star text required");
        await createAssignment(
          positional[0],
          flags.priority ? parseInt(flags.priority) : undefined,
          flags.independent === "true"
        );
        break;

      case "insert-job":
        if (!positional[0]) error("Assignment ID required");
        if (!flags.type) error("--type required");
        await insertJob(
          positional[0],
          flags.type,
          flags.harness || config.defaultHarness,
          flags.context,
          flags.after
        );
        break;

      case "update-assignment":
        if (!positional[0]) error("Assignment ID required");
        await updateAssignment(positional[0], flags.artifacts, flags.decisions);
        break;

      case "complete":
        if (!positional[0]) error("Assignment ID required");
        await completeAssignment(positional[0]);
        break;

      case "block":
        if (!positional[0]) error("Assignment ID required");
        if (!flags.reason) error("--reason required");
        await blockAssignment(positional[0], flags.reason);
        break;

      case "unblock":
        if (!positional[0]) error("Assignment ID required");
        await unblockAssignment(positional[0]);
        break;

      case "start-job":
        if (!positional[0]) error("Job ID required");
        await startJob(positional[0]);
        break;

      case "complete-job":
        if (!positional[0]) error("Job ID required");
        if (!flags.result) error("--result required");
        await completeJob(positional[0], flags.result);
        break;

      case "fail-job":
        if (!positional[0]) error("Job ID required");
        await failJob(positional[0], flags.result);
        break;

      // Chat commands
      case "chat-threads":
        await listChatThreads();
        break;

      case "chat-thread":
        if (!positional[0]) error("Thread ID required");
        await getChatThread(positional[0]);
        break;

      case "chat-create":
        await createChatThread(flags.title);
        break;

      case "chat-send":
        if (!positional[0]) error("Thread ID required");
        if (!positional[1]) error("Message required");
        await sendChatMessage(positional[0], positional[1], flags.harness);
        break;

      case "chat-mode":
        if (!positional[0]) error("Thread ID required");
        if (!positional[1]) error("Mode required (jam or cook)");
        await changeChatMode(positional[0], positional[1]);
        break;

      default:
        error(`Unknown command: ${command}`);
    }
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
  }
}

main();
