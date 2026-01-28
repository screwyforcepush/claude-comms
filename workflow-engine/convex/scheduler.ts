import { v } from "convex/values";
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

interface ReadyJob {
  job: Doc<"jobs">;
  assignment: Doc<"assignments">;
  previousResult: string | null;
}

// Get all jobs that are ready to run for a namespace
export const getReadyJobs = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args): Promise<ReadyJob[]> => {
    // Get all non-complete assignments for this namespace
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const activeAssignments = assignments.filter(
      (a) => a.status !== "complete" && a.status !== "blocked"
    );

    const readyJobs: ReadyJob[] = [];

    for (const assignment of activeAssignments) {
      if (!assignment.headJobId) continue;

      // Walk the job chain to find the first pending job
      // whose predecessor (if any) is complete
      let currentJobId: Id<"jobs"> | undefined = assignment.headJobId;
      let prevJob: Doc<"jobs"> | null = null;

      while (currentJobId) {
        const job: Doc<"jobs"> | null = await ctx.db.get(currentJobId);
        if (!job) break;

        if (job.status === "pending") {
          // This job is ready if:
          // - It's the head (no predecessor), OR
          // - Previous job is complete or failed (allows recovery)
          const isHead = currentJobId === assignment.headJobId;
          const prevDone = prevJob?.status === "complete" || prevJob?.status === "failed";

          if (isHead || prevDone) {
            readyJobs.push({
              job,
              assignment,
              previousResult: prevJob?.result ?? null,
            });
          }
          break; // Only one ready job per assignment
        }

        if (job.status === "running") {
          // Assignment already has a running job, skip
          break;
        }

        prevJob = job;
        currentJobId = job.nextJobId;
      }
    }

    // Sort: oldest createdAt first, then lowest priority
    readyJobs.sort((a, b) => {
      const aTime = a.assignment.createdAt;
      const bTime = b.assignment.createdAt;
      if (aTime !== bTime) return aTime - bTime;
      return a.assignment.priority - b.assignment.priority;
    });

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
