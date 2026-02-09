#!/usr/bin/env npx tsx
/**
 * Workflow Engine CLI
 *
 * Interface to the Convex backend for managing assignments and job groups.
 * Primary consumers: PM agent, PO agent
 *
 * Environment Variables (auto-set by runner):
 *   WORKFLOW_ASSIGNMENT_ID   Current assignment (used as default for assignment commands)
 *   WORKFLOW_GROUP_ID        Current group (used as default --after for insert-job)
 *   WORKFLOW_JOB_ID          Current job
 *   WORKFLOW_THREAD_ID       Current chat thread (used for auto-linking assignments)
 *   WORKFLOW_ARTIFACTS       Current artifacts (append base for PM updates)
 *   WORKFLOW_DECISIONS       Current decisions (append base for PM updates)
 *
 * Usage:
 *   npx tsx cli.ts <command> [args]
 *
 * Commands:
 *   assignments [--status <status>]     List assignments
 *   assignment <id>                     Get assignment details with groups
 *   groups [--status <status>]          List job groups
 *   group <id>                          Get group details with jobs
 *   jobs [--status <status>]            List jobs
 *   job <id>                            Get job details
 *   queue                               Show queue status
 *
 *   create <northStar> [--priority N] [--independent] [--thread <threadId>]   Create assignment
 *   insert-job [assignmentId] [--type <type>] [--jobs <json>] [--harness <harness>] [--context <ctx>] [--after <groupId>] [--append]
 *              assignmentId defaults to WORKFLOW_ASSIGNMENT_ID
 *              --jobs: JSON array of job definitions: [{"jobType":"review"},{"jobType":"implement","harness":"codex"}]
 *                      Jobs in the same group run in parallel and share a groupId
 *              --type: single job type (shorthand for --jobs with one entry)
 *              --after defaults to WORKFLOW_GROUP_ID (auto-links in job context)
 *              --append finds tail group and links there (for PO adding to existing chain)
 *   update-assignment [id] [--artifacts <str>] [--decisions <str>] [--alignment <aligned|uncertain|misaligned>]
 *   complete [assignmentId]             Mark assignment complete
 *   block [assignmentId] --reason <str> Block assignment
 *   unblock [assignmentId]              Unblock assignment
 *   delete-assignment <id>              Delete assignment and all its groups/jobs
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
import { anyApi } from "convex/server";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Use anyApi for portability (same as runner.ts)
const api = anyApi;

type Id<T extends string> = string & { __tableName: T };

// Load config
type Harness = "claude" | "codex" | "gemini";

interface Config {
  convexUrl: string;
  namespace: string;
  password: string;
  timeoutMs: number;
  harnessDefaults: {
    default: Harness;
    [jobType: string]: Harness;
  };
}

// Auto-expansion config: job types that automatically fan out to multiple harnesses
// CLI expands these before sending to Convex (not in Convex mutations)
const AUTO_EXPAND_CONFIG: Record<string, Harness[]> = {
  review: ["claude", "codex", "gemini"],
  "architecture-review": ["claude", "codex", "gemini"],
  "spec-review": ["claude", "codex", "gemini"],
};

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
    password: config.password,
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
    password: config.password,
    namespaceId: nsId,
    status: status as any,
  });
  output(result);
}

async function getAssignment(id: string) {
  const result = await client.query(api.assignments.getWithGroups, {
    password: config.password,
    id: id as Id<"assignments">,
  });
  if (!result) error("Assignment not found");
  output(result);
}

async function listGroups(status?: string, assignmentId?: string) {
  const validStatuses = ["pending", "running", "complete", "failed"];
  if (status && !validStatuses.includes(status)) {
    error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const result = await client.query(api.jobs.listGroups, {
    password: config.password,
    status: status as any,
    assignmentId: assignmentId as Id<"assignments"> | undefined,
  });
  output(result);
}

async function getGroup(id: string) {
  const result = await client.query(api.jobs.getGroupWithJobs, {
    password: config.password,
    id: id as Id<"jobGroups">,
  });
  if (!result) error("Group not found");
  output(result);
}

async function listJobs(status?: string, groupId?: string) {
  const validStatuses = ["pending", "running", "complete", "failed"];
  if (status && !validStatuses.includes(status)) {
    error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const result = await client.query(api.jobs.list, {
    password: config.password,
    status: status as any,
    groupId: groupId as Id<"jobGroups"> | undefined,
  });
  output(result);
}

async function getJob(id: string) {
  const result = await client.query(api.jobs.getWithGroup, {
    password: config.password,
    id: id as Id<"jobs">,
  });
  if (!result) error("Job not found");
  output(result);
}

async function getQueueStatus() {
  const nsId = await getNamespaceId();
  // Use namespace's denormalized counts instead of removed scheduler.getQueueStatus
  const ns = await client.query(api.namespaces.get, {
    password: config.password,
    id: nsId,
  });
  if (!ns) error("Namespace not found");
  const counts = ns.assignmentCounts || { pending: 0, active: 0, blocked: 0, complete: 0 };
  output({
    totalAssignments: counts.pending + counts.active + counts.blocked + counts.complete,
    pendingAssignments: counts.pending,
    activeAssignments: counts.active,
    blockedAssignments: counts.blocked,
    completeAssignments: counts.complete,
  });
}

async function createAssignment(
  northStar: string,
  priority?: number,
  independent?: boolean,
  threadId?: string
) {
  const nsId = await getNamespaceId();
  const id = await client.mutation(api.assignments.create, {
    password: config.password,
    namespaceId: nsId,
    northStar,
    priority,
    independent,
  });

  // Link to thread if provided, or use env var (set by runner for chat jobs)
  const effectiveThreadId = threadId || process.env.WORKFLOW_THREAD_ID;
  if (effectiveThreadId) {
    await client.mutation(api.chatThreads.linkAssignment, {
      password: config.password,
      id: effectiveThreadId as Id<"chatThreads">,
      assignmentId: id as Id<"assignments">,
    });
    const source = threadId ? "explicit" : "env";
    output({ id, threadId: effectiveThreadId, message: `Assignment created and linked to thread (${source})` });
  } else {
    output({ id, message: "Assignment created" });
  }
}

// Find the tail group of an assignment (for --append)
async function findTailGroup(assignmentId: string): Promise<string | null> {
  const assignment = await client.query(api.assignments.get, {
    password: config.password,
    id: assignmentId as Id<"assignments">,
  });
  if (!assignment || !assignment.headGroupId) return null;

  // Walk the chain to find the tail
  let currentGroupId: string | undefined = assignment.headGroupId;
  let tailGroupId: string = assignment.headGroupId;

  while (currentGroupId) {
    const group = await client.query(api.jobs.getGroup, {
      password: config.password,
      id: currentGroupId as Id<"jobGroups">,
    });
    if (!group) break;
    tailGroupId = group._id;
    currentGroupId = group.nextGroupId;
  }

  return tailGroupId;
}

// Job definition for CLI input (before expansion)
interface JobDefInput {
  jobType: string;
  harness?: "claude" | "codex" | "gemini"; // Optional - will use default or expand
  context?: string;
}

// Job definition after expansion (ready for mutation)
interface JobDef {
  jobType: string;
  harness: "claude" | "codex" | "gemini";
  context?: string;
}

/**
 * Expand jobs using AUTO_EXPAND_CONFIG
 * e.g., { jobType: "review" } -> 3 jobs with different harnesses
 */
function expandJobs(jobs: JobDefInput[]): JobDef[] {
  const expanded: JobDef[] = [];

  for (const job of jobs) {
    const expandHarnesses = AUTO_EXPAND_CONFIG[job.jobType];

    if (expandHarnesses && !job.harness) {
      // Auto-expand to multiple harnesses
      for (const harness of expandHarnesses) {
        expanded.push({
          jobType: job.jobType,
          harness,
          context: job.context,
        });
      }
    } else {
      // Single job - use specified harness or default
      expanded.push({
        jobType: job.jobType,
        harness: job.harness || getHarnessForJobType(job.jobType),
        context: job.context,
      });
    }
  }

  return expanded;
}

async function insertJobs(
  assignmentId: string,
  jobs: JobDefInput[],
  afterGroupId?: string,
  append?: boolean
) {
  if (jobs.length === 0) {
    error("At least one job required");
  }

  // Expand jobs (auto-expansion happens here, not in Convex)
  const expandedJobs = expandJobs(jobs);

  const validHarnesses = ["claude", "codex", "gemini"];
  for (const job of expandedJobs) {
    if (!validHarnesses.includes(job.harness)) {
      error(`Invalid harness "${job.harness}". Must be one of: ${validHarnesses.join(", ")}`);
    }
  }

  // Determine effective afterGroupId
  let effectiveAfterGroupId = afterGroupId;

  if (append && !effectiveAfterGroupId) {
    // --append: find tail group and insert after it
    effectiveAfterGroupId = await findTailGroup(assignmentId) || undefined;
  }

  let result: { groupId: string; jobIds: string[] };
  let linkInfo: string;

  if (effectiveAfterGroupId) {
    result = await client.mutation(api.jobs.insertGroupAfter, {
      password: config.password,
      afterGroupId: effectiveAfterGroupId as Id<"jobGroups">,
      jobs: expandedJobs as any,
    });
    linkInfo = `linked after group ${effectiveAfterGroupId.slice(-8)}`;
  } else {
    result = await client.mutation(api.jobs.createGroup, {
      password: config.password,
      assignmentId: assignmentId as Id<"assignments">,
      jobs: expandedJobs as any,
    });
    linkInfo = "created as head group";
  }

  output({
    groupId: result.groupId,
    jobIds: result.jobIds,
    jobs: expandedJobs.map(j => ({ jobType: j.jobType, harness: j.harness })),
    message: `Group ${linkInfo} with ${result.jobIds.length} job(s)`,
  });
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

  const appendField = (base: string | undefined, addition?: string): string | undefined => {
    if (addition === undefined) return undefined;
    if (!base) return addition;
    if (!addition) return base;
    return `${base}\n${addition}`;
  };

  const baseArtifacts = process.env.WORKFLOW_ARTIFACTS;
  const baseDecisions = process.env.WORKFLOW_DECISIONS;

  await client.mutation(api.assignments.update, {
    password: config.password,
    id: id as Id<"assignments">,
    artifacts: appendField(baseArtifacts, artifacts),
    decisions: appendField(baseDecisions, decisions),
    alignmentStatus: alignment as "aligned" | "uncertain" | "misaligned" | undefined,
  });
  output({ message: "Assignment updated" });
}

async function completeAssignment(id: string) {
  await client.mutation(api.assignments.complete, {
    password: config.password,
    id: id as Id<"assignments">,
  });
  output({ message: "Assignment completed" });
}

async function blockAssignment(id: string, reason: string) {
  await client.mutation(api.assignments.block, {
    password: config.password,
    id: id as Id<"assignments">,
    reason,
  });
  output({ message: "Assignment blocked" });
}

async function unblockAssignment(id: string) {
  await client.mutation(api.assignments.unblock, {
    password: config.password,
    id: id as Id<"assignments">,
  });
  output({ message: "Assignment unblocked" });
}

async function deleteAssignment(id: string) {
  const result = await client.mutation(api.assignments.remove, {
    password: config.password,
    id: id as Id<"assignments">,
  });
  output({ message: `Assignment deleted (${result.groupsDeleted} groups, ${result.jobsDeleted} jobs removed)` });
}

async function startJob(id: string) {
  await client.mutation(api.jobs.start, {
    password: config.password,
    id: id as Id<"jobs">,
  });
  output({ message: "Job started" });
}

async function completeJob(id: string, result: string) {
  await client.mutation(api.jobs.complete, {
    password: config.password,
    id: id as Id<"jobs">,
    result,
  });
  output({ message: "Job completed" });
}

async function failJob(id: string, result?: string) {
  await client.mutation(api.jobs.fail, {
    password: config.password,
    id: id as Id<"jobs">,
    result,
  });
  output({ message: "Job failed" });
}

// Chat commands

async function listChatThreads() {
  const nsId = await getNamespaceId();
  const result = await client.query(api.chatThreads.list, {
    password: config.password,
    namespaceId: nsId,
  });
  output(result);
}

async function getChatThread(threadId: string) {
  const thread = await client.query(api.chatThreads.get, {
    password: config.password,
    id: threadId as Id<"chatThreads">,
  });
  if (!thread) error("Thread not found");

  const messages = await client.query(api.chatMessages.list, {
    password: config.password,
    threadId: threadId as Id<"chatThreads">,
  });

  output({ thread, messages });
}

async function createChatThread(title?: string) {
  const nsId = await getNamespaceId();
  const threadId = await client.mutation(api.chatThreads.create, {
    password: config.password,
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
      password: config.password,
      threadId: threadId as Id<"chatThreads">,
      assignmentId: assignmentId as Id<"assignments">,
    });
    output({ message: `Thread mode changed to guardian, linked to assignment ${assignmentId}` });
    return;
  }

  await client.mutation(api.chatThreads.updateMode, {
    password: config.password,
    id: threadId as Id<"chatThreads">,
    mode: mode as "jam" | "cook",
  });
  output({ message: `Thread mode changed to ${mode}` });
}

async function updateChatTitle(threadId: string, title: string) {
  await client.mutation(api.chatThreads.updateTitle, {
    password: config.password,
    id: threadId as Id<"chatThreads">,
    title,
  });
  output({ message: `Thread title updated to "${title}"` });
}

async function sendChatMessage(threadId: string, message: string, harness?: string) {
  // Get thread to check it exists
  const thread = await client.query(api.chatThreads.get, {
    password: config.password,
    id: threadId as Id<"chatThreads">,
  });
  if (!thread) error("Thread not found");

  // Add user message to thread
  await client.mutation(api.chatMessages.add, {
    password: config.password,
    threadId: threadId as Id<"chatThreads">,
    role: "user",
    content: message,
  });

  // Trigger chat job (uses chatJobs table, not assignments/jobs)
  // The trigger mutation builds context internally
  const result = await client.mutation(api.chatJobs.trigger, {
    password: config.password,
    threadId: threadId as Id<"chatThreads">,
    harness: (harness || getHarnessForJobType("chat")) as Harness,
  });

  output({
    threadId,
    jobId: result.jobId,
    mode: result.mode,
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

      case "groups":
        await listGroups(flags.status, flags.assignment);
        break;

      case "group":
        if (!positional[0]) error("Group ID required");
        await getGroup(positional[0]);
        break;

      case "jobs":
        await listJobs(flags.status, flags.group);
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

        // After group ID: --after flag > env var (auto-link in job context)
        const afterGroupId = flags.after || process.env.WORKFLOW_GROUP_ID;

        // Build jobs array - either from --jobs JSON or from --type (single job)
        // Keep harness undefined to allow expandJobs() to handle auto-expansion
        let jobs: JobDefInput[];

        if (flags.jobs) {
          // Parse JSON array of jobs: [{"jobType":"review","harness":"claude"},...]
          try {
            const parsed = JSON.parse(flags.jobs);
            if (!Array.isArray(parsed)) {
              error("--jobs must be a JSON array");
            }
            jobs = parsed.map((j: any) => ({
              jobType: j.jobType,
              harness: j.harness, // Don't apply default - let expandJobs handle it
              context: j.context,
            }));
          } catch (e) {
            error(`Invalid --jobs JSON: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else if (flags.type) {
          // Single job via --type (backward compatible)
          jobs = [{
            jobType: flags.type,
            harness: flags.harness as "claude" | "codex" | "gemini" | undefined,
            context: flags.context,
          }];
        } else {
          error("Either --jobs (JSON array) or --type required");
        }

        await insertJobs(
          assignmentId,
          jobs,
          afterGroupId,
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
