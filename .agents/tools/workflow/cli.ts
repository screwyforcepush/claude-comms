#!/usr/bin/env npx tsx
/**
 * Workflow Engine CLI
 *
 * Interface to the Convex backend for managing assignments and jobs.
 * Primary consumers: PM agent, PO agent
 *
 * Environment Variables (auto-set by runner):
 *   WORKFLOW_ASSIGNMENT_ID   Current assignment (used as default for assignment commands)
 *   WORKFLOW_JOB_ID          Current job (used as default --after for insert-job)
 *   WORKFLOW_THREAD_ID       Current chat thread (used for auto-linking assignments)
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
 *   create <northStar> [--priority N] [--independent] [--thread <threadId>]   Create assignment
 *   insert-job [assignmentId] --type <type> [--harness <harness>] [--context <ctx>] [--after <jobId>] [--append]
 *              assignmentId defaults to WORKFLOW_ASSIGNMENT_ID
 *              --after defaults to WORKFLOW_JOB_ID (auto-links in job context)
 *              --append finds tail job and links there (for PO adding to existing chain)
 *   update-assignment [id] [--artifacts <str>] [--decisions <str>] [--alignment <aligned|uncertain|misaligned>]
 *   complete [assignmentId]             Mark assignment complete
 *   block [assignmentId] --reason <str> Block assignment
 *   unblock [assignmentId]              Unblock assignment
 *   delete-assignment <id>              Delete assignment and all its jobs
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
 *   chat-mode <threadId> <jam|cook|guardian>  Change thread mode
 *   chat-title <threadId> <title>       Update thread title
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "./workflow-engine/convex/_generated/api.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

type Id<T extends string> = string & { __tableName: T };

// Load config
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
 * Resolution order: config.harnessDefaults[jobType] -> config.harnessDefaults.default
 */
function getHarnessForJobType(jobType: string): Harness {
  return config.harnessDefaults[jobType] || config.harnessDefaults.default;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");
const config: Config = JSON.parse(readFileSync(configPath, "utf-8"));

const client = new ConvexHttpClient(config.convexUrl);

// Cached namespace ID (resolved at runtime)
let namespaceId: Id<"namespaces"> | null = null;

async function getNamespaceId(): Promise<Id<"namespaces">> {
  if (namespaceId) return namespaceId;

  const namespace = await client.query(api.namespaces.getByName, {
    name: config.namespace,
  });

  if (!namespace) {
    error(`Namespace "${config.namespace}" not found. Run 'npx tsx init.ts' first.`);
  }

  namespaceId = namespace._id as Id<"namespaces">;
  return namespaceId;
}

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

  const nsId = await getNamespaceId();
  const result = await client.query(api.assignments.list, {
    namespaceId: nsId,
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
  const nsId = await getNamespaceId();
  const result = await client.query(api.scheduler.getQueueStatus, {
    namespaceId: nsId,
  });
  output(result);
}

async function createAssignment(
  northStar: string,
  priority?: number,
  independent?: boolean,
  threadId?: string
) {
  const nsId = await getNamespaceId();
  const id = await client.mutation(api.assignments.create, {
    namespaceId: nsId,
    northStar,
    priority,
    independent,
  });

  // Link to thread if provided, or use env var (set by runner for chat jobs)
  const effectiveThreadId = threadId || process.env.WORKFLOW_THREAD_ID;
  if (effectiveThreadId) {
    await client.mutation(api.chatThreads.linkAssignment, {
      id: effectiveThreadId as Id<"chatThreads">,
      assignmentId: id as Id<"assignments">,
    });
    const source = threadId ? "explicit" : "env";
    output({ id, threadId: effectiveThreadId, message: `Assignment created and linked to thread (${source})` });
  } else {
    output({ id, message: "Assignment created" });
  }
}

// Find the tail job of an assignment (for --append)
async function findTailJob(assignmentId: string): Promise<string | null> {
  const assignment = await client.query(api.assignments.get, {
    id: assignmentId as Id<"assignments">,
  });
  if (!assignment || !assignment.headJobId) return null;

  // Walk the chain to find the tail
  let currentJobId: string | undefined = assignment.headJobId;
  let tailJobId: string = assignment.headJobId;

  while (currentJobId) {
    const job = await client.query(api.jobs.get, {
      id: currentJobId as Id<"jobs">,
    });
    if (!job) break;
    tailJobId = job._id;
    currentJobId = job.nextJobId;
  }

  return tailJobId;
}

async function insertJob(
  assignmentId: string,
  jobType: string,
  harness: string,
  context?: string,
  afterJobId?: string,
  append?: boolean
) {
  const validHarnesses = ["claude", "codex", "gemini"];
  if (!validHarnesses.includes(harness)) {
    error(`Invalid harness. Must be one of: ${validHarnesses.join(", ")}`);
  }

  // Determine effective afterJobId
  let effectiveAfterJobId = afterJobId;

  if (append && !effectiveAfterJobId) {
    // --append: find tail job and insert after it
    effectiveAfterJobId = await findTailJob(assignmentId) || undefined;
  }

  let id: string;
  let linkInfo: string;

  if (effectiveAfterJobId) {
    id = await client.mutation(api.jobs.insertAfter, {
      afterJobId: effectiveAfterJobId as Id<"jobs">,
      jobType,
      harness: harness as "claude" | "codex" | "gemini",
      context,
    });
    linkInfo = `linked after ${effectiveAfterJobId.slice(-8)}`;
  } else {
    id = await client.mutation(api.jobs.create, {
      assignmentId: assignmentId as Id<"assignments">,
      jobType,
      harness: harness as "claude" | "codex" | "gemini",
      context,
    });
    linkInfo = "created as head";
  }
  output({ id, message: `Job ${linkInfo}` });
}

async function updateAssignment(
  id: string,
  artifacts?: string,
  decisions?: string,
  alignment?: string
) {
  const validAlignments = ["aligned", "uncertain", "misaligned"];
  if (alignment && !validAlignments.includes(alignment)) {
    error(`Invalid alignment status. Must be one of: ${validAlignments.join(", ")}`);
  }

  await client.mutation(api.assignments.update, {
    id: id as Id<"assignments">,
    artifacts,
    decisions,
    alignmentStatus: alignment as "aligned" | "uncertain" | "misaligned" | undefined,
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

async function deleteAssignment(id: string) {
  const result = await client.mutation(api.assignments.remove, {
    id: id as Id<"assignments">,
  });
  output({ message: `Assignment deleted (${result.jobsDeleted} jobs removed)` });
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
  const nsId = await getNamespaceId();
  const result = await client.query(api.chatThreads.list, {
    namespaceId: nsId,
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
  const nsId = await getNamespaceId();
  const threadId = await client.mutation(api.chatThreads.create, {
    namespaceId: nsId,
    title,
    mode: "jam", // Default to safe mode
  });
  output({ threadId, message: "Chat thread created" });
}

async function changeChatMode(threadId: string, mode: string, assignmentId?: string) {
  if (mode !== "jam" && mode !== "cook" && mode !== "guardian") {
    error("Mode must be 'jam', 'cook', or 'guardian'");
  }

  // Guardian mode requires an assignment link and uses atomic mutation
  if (mode === "guardian") {
    if (!assignmentId) {
      error("Guardian mode requires --assignment <id> to link to an assignment");
    }
    // Use atomic mutation to link, set alignment, and change mode
    await client.mutation(api.chatThreads.enableGuardianMode, {
      threadId: threadId as Id<"chatThreads">,
      assignmentId: assignmentId as Id<"assignments">,
    });
    output({ message: `Thread mode changed to guardian, linked to assignment ${assignmentId}` });
    return;
  }

  await client.mutation(api.chatThreads.updateMode, {
    id: threadId as Id<"chatThreads">,
    mode: mode as "jam" | "cook",
  });
  output({ message: `Thread mode changed to ${mode}` });
}

async function updateChatTitle(threadId: string, title: string) {
  await client.mutation(api.chatThreads.updateTitle, {
    id: threadId as Id<"chatThreads">,
    title,
  });
  output({ message: `Thread title updated to "${title}"` });
}

async function sendChatMessage(threadId: string, message: string, harness?: string) {
  const nsId = await getNamespaceId();

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
    namespaceId: nsId,
    northStar: `Chat thread: ${thread.title}`,
    independent: true, // Chat doesn't block other work
    priority: 0, // High priority for responsiveness
  });

  // Build chat context for the job
  const chatContext = {
    threadId,
    namespaceId: nsId,
    mode: thread.mode,
    messages,
    latestUserMessage: message,
  };

  // Create chat job
  const jobId = await client.mutation(api.jobs.create, {
    assignmentId: assignmentId as Id<"assignments">,
    jobType: "chat",
    harness: (harness || getHarnessForJobType("chat")) as Harness,
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
          flags.independent === "true",
          flags.thread
        );
        break;

      case "insert-job": {
        // Assignment ID: positional arg > env var
        const assignmentId = positional[0] || process.env.WORKFLOW_ASSIGNMENT_ID;
        if (!assignmentId) error("Assignment ID required (or set WORKFLOW_ASSIGNMENT_ID)");
        if (!flags.type) error("--type required");

        // After job ID: --after flag > env var (auto-link in job context)
        const afterJobId = flags.after || process.env.WORKFLOW_JOB_ID;

        // Harness: explicit flag > config per-job-type default > config default
        const harness = flags.harness || getHarnessForJobType(flags.type);

        await insertJob(
          assignmentId,
          flags.type,
          harness,
          flags.context,
          afterJobId,
          flags.append === "true"
        );
        break;
      }

      case "update-assignment": {
        const assignmentId = positional[0] || process.env.WORKFLOW_ASSIGNMENT_ID;
        if (!assignmentId) error("Assignment ID required (or set WORKFLOW_ASSIGNMENT_ID)");
        await updateAssignment(assignmentId, flags.artifacts, flags.decisions, flags.alignment);
        break;
      }

      case "complete": {
        const assignmentId = positional[0] || process.env.WORKFLOW_ASSIGNMENT_ID;
        if (!assignmentId) error("Assignment ID required (or set WORKFLOW_ASSIGNMENT_ID)");
        await completeAssignment(assignmentId);
        break;
      }

      case "block": {
        const assignmentId = positional[0] || process.env.WORKFLOW_ASSIGNMENT_ID;
        if (!assignmentId) error("Assignment ID required (or set WORKFLOW_ASSIGNMENT_ID)");
        if (!flags.reason) error("--reason required");
        await blockAssignment(assignmentId, flags.reason);
        break;
      }

      case "unblock": {
        const assignmentId = positional[0] || process.env.WORKFLOW_ASSIGNMENT_ID;
        if (!assignmentId) error("Assignment ID required (or set WORKFLOW_ASSIGNMENT_ID)");
        await unblockAssignment(assignmentId);
        break;
      }

      case "delete-assignment": {
        if (!positional[0]) error("Assignment ID required");
        await deleteAssignment(positional[0]);
        break;
      }

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
        if (!positional[1]) error("Mode required (jam, cook, or guardian)");
        await changeChatMode(positional[0], positional[1], flags.assignment);
        break;

      case "chat-title":
        if (!positional[0]) error("Thread ID required");
        if (!positional[1]) error("Title required");
        await updateChatTitle(positional[0], positional[1]);
        break;

      default:
        error(`Unknown command: ${command}`);
    }
  } catch (e) {
    error(e instanceof Error ? e.message : String(e));
  }
}

main();
