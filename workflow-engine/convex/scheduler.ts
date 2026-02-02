import { v } from "convex/values";
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Assignment-based job (work items)
interface ReadyJob {
  job: Doc<"jobs">;
  assignment: Doc<"assignments">;
  previousResult: string | null;
  // For PM jobs: accumulated results from all jobs since last PM
  accumulatedResults: Array<{ jobType: string; result: string }>;
}

// Chat job (separate from assignments)
interface ReadyChatJob {
  chatJob: Doc<"chatJobs">;
}

// Helper: find the next ready job for an assignment (if any)
async function findReadyJob(
  ctx: { db: { get: (id: Id<"jobs">) => Promise<Doc<"jobs"> | null> } },
  assignment: Doc<"assignments">
): Promise<ReadyJob | null> {
  if (!assignment.headJobId) return null;

  let currentJobId: Id<"jobs"> | undefined = assignment.headJobId;
  let prevJob: Doc<"jobs"> | null = null;

  // Track all completed jobs since the last PM (for accumulated results)
  const jobsSinceLastPM: Array<{ jobType: string; result: string }> = [];

  while (currentJobId) {
    const job = await ctx.db.get(currentJobId);
    if (!job) break;

    if (job.status === "pending") {
      // This job is ready if:
      // - It's the head (no predecessor), OR
      // - Previous job is complete or failed (allows recovery)
      const isHead = currentJobId === assignment.headJobId;
      const prevDone = prevJob?.status === "complete" || prevJob?.status === "failed";

      if (isHead || prevDone) {
        return {
          job,
          assignment,
          previousResult: prevJob?.result ?? null,
          accumulatedResults: jobsSinceLastPM,
        };
      }
      break;
    }

    if (job.status === "running") {
      // Assignment already has a running job
      break;
    }

    // Track completed jobs for accumulation
    if (job.status === "complete" && job.result) {
      // Reset accumulator when we hit a PM job (PM already saw previous results)
      if (job.jobType === "pm" || job.jobType === "retrospect") {
        jobsSinceLastPM.length = 0;
      } else {
        jobsSinceLastPM.push({ jobType: job.jobType, result: job.result });
      }
    }

    prevJob = job;
    currentJobId = job.nextJobId;
  }

  return null;
}

// Get all jobs that are ready to run for a namespace
export const getReadyJobs = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args): Promise<ReadyJob[]> => {
    // Get all non-complete, non-blocked assignments for this namespace
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const workableAssignments = assignments.filter(
      (a) => a.status !== "complete" && a.status !== "blocked"
    );

    // Separate independent vs non-independent (sequential) assignments
    const independentAssignments = workableAssignments.filter((a) => a.independent);
    const sequentialAssignments = workableAssignments.filter((a) => !a.independent);

    const readyJobs: ReadyJob[] = [];

    // Independent assignments: always include their ready jobs (can run in parallel)
    for (const assignment of independentAssignments) {
      const readyJob = await findReadyJob(ctx, assignment);
      if (readyJob) {
        readyJobs.push(readyJob);
      }
    }

    // Sequential assignments: only ONE can be active at a time
    // Check if any sequential assignment is currently active
    const activeSequential = sequentialAssignments.find((a) => a.status === "active");

    if (activeSequential) {
      // Try to get a ready job from the active sequential assignment
      const readyJob = await findReadyJob(ctx, activeSequential);
      if (readyJob) {
        readyJobs.push(readyJob);
      }
      // If no ready job (all jobs done), this assignment is effectively complete
      // but we don't pick up a new one until it's explicitly marked complete
      // This prevents race conditions - the assignment should be marked complete
      // by the final job handler
    } else {
      // No active sequential - pick the first pending one (by priority, then creation time)
      const pendingSequential = sequentialAssignments
        .filter((a) => a.status === "pending")
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.createdAt - b.createdAt;
        });

      if (pendingSequential.length > 0) {
        const readyJob = await findReadyJob(ctx, pendingSequential[0]);
        if (readyJob) {
          readyJobs.push(readyJob);
        }
      }
    }

    return readyJobs;
  },
});

// Get the queue status for a namespace
export const getQueueStatus = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const runningJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    // Filter running jobs to this namespace
    const namespaceRunningJobs = [];
    for (const job of runningJobs) {
      const assignment = await ctx.db.get(job.assignmentId);
      if (assignment?.namespaceId === args.namespaceId) {
        namespaceRunningJobs.push({ job, assignment });
      }
    }

    // Check if any non-independent assignment is active
    const hasActiveNonIndependent = assignments.some(
      (a) => a.status === "active" && !a.independent
    );

    return {
      totalAssignments: assignments.length,
      pendingAssignments: assignments.filter((a) => a.status === "pending")
        .length,
      activeAssignments: assignments.filter((a) => a.status === "active")
        .length,
      blockedAssignments: assignments.filter((a) => a.status === "blocked")
        .length,
      completeAssignments: assignments.filter((a) => a.status === "complete")
        .length,
      runningJobs: namespaceRunningJobs.length,
      hasActiveNonIndependent,
    };
  },
});

// Get all namespaces with aggregated stats
export const getAllNamespaces = query({
  args: {},
  handler: async (ctx) => {
    // Get all namespaces from the namespaces table
    const namespaces = await ctx.db.query("namespaces").collect();

    const result = [];

    for (const ns of namespaces) {
      // Get assignments for this namespace
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_namespace", (q) => q.eq("namespaceId", ns._id))
        .collect();

      const counts = {
        pending: assignments.filter((a) => a.status === "pending").length,
        active: assignments.filter((a) => a.status === "active").length,
        blocked: assignments.filter((a) => a.status === "blocked").length,
        complete: assignments.filter((a) => a.status === "complete").length,
      };

      const lastActivity = assignments.length > 0
        ? Math.max(...assignments.map((a) => a.updatedAt))
        : ns.updatedAt;

      result.push({
        _id: ns._id,
        name: ns.name,
        description: ns.description,
        counts,
        lastActivity,
      });
    }

    return result;
  },
});

// Subscription-friendly: get all active/pending assignments with their job chains
export const watchQueue = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const result = [];

    for (const assignment of assignments) {
      if (assignment.status === "complete") continue;

      // Get all jobs for this assignment
      const jobs: Doc<"jobs">[] = [];
      let currentJobId = assignment.headJobId;
      while (currentJobId) {
        const job = await ctx.db.get(currentJobId);
        if (!job) break;
        jobs.push(job);
        currentJobId = job.nextJobId;
      }

      result.push({
        assignment,
        jobs,
        hasRunningJob: jobs.some((j) => j.status === "running"),
        nextPendingJob: jobs.find((j) => j.status === "pending") ?? null,
      });
    }

    return result;
  },
});

// Get ALL assignments for a namespace (including complete) with their job chains
export const getAllAssignments = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const result = [];

    for (const assignment of assignments) {
      // Get all jobs for this assignment
      const jobs: Doc<"jobs">[] = [];
      let currentJobId = assignment.headJobId;
      while (currentJobId) {
        const job = await ctx.db.get(currentJobId);
        if (!job) break;
        jobs.push(job);
        currentJobId = job.nextJobId;
      }

      result.push({
        assignment,
        jobs,
        hasRunningJob: jobs.some((j) => j.status === "running"),
        nextPendingJob: jobs.find((j) => j.status === "pending") ?? null,
      });
    }

    return result;
  },
});

// Get all pending chat jobs for a namespace (separate from assignment jobs)
// Chat jobs are always "independent" - they never block work assignments
export const getReadyChatJobs = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args): Promise<ReadyChatJob[]> => {
    const pendingChatJobs = await ctx.db
      .query("chatJobs")
      .withIndex("by_namespace_status", (q) =>
        q.eq("namespaceId", args.namespaceId).eq("status", "pending")
      )
      .collect();

    // Sort by creation time (oldest first)
    pendingChatJobs.sort((a, b) => a.createdAt - b.createdAt);

    return pendingChatJobs.map((chatJob) => ({ chatJob }));
  },
});
