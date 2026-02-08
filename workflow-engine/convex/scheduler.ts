import { v } from "convex/values";
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePassword } from "./auth";

// Ready job info returned to runner
interface ReadyJob {
  job: Doc<"jobs">;
  group: Doc<"jobGroups">;
  assignment: Doc<"assignments">;
  // For PM jobs: accumulated results from all groups since last PM
  accumulatedResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }>;
  // For non-PM jobs: results from the most recent non-PM group
  previousNonPmGroupResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }>;
  // For PM post-review decision: group before the latest review group (non-PM)
  r1GroupResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }>;
}

// Chat job (separate from assignments)
interface ReadyChatJob {
  chatJob: Doc<"chatJobs">;
}

// ============================================================================
// Group-based chain navigation
// ============================================================================

// Find all ready jobs for an assignment by walking the group chain
async function findReadyJobs(
  ctx: { db: any },
  assignment: Doc<"assignments">
): Promise<ReadyJob[]> {
  if (!assignment.headGroupId) return [];

  let currentGroupId: Id<"jobGroups"> | undefined = assignment.headGroupId;

  // Track accumulated results from completed groups (for PM context)
  const accumulatedResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }> = [];
  let lastNonPmGroupResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }> = [];
  let r1GroupResults: Array<{
    jobType: string;
    harness: string;
    result: string;
    groupId: Id<"jobGroups">;
    groupIndex: number;
  }> = [];
  let groupIndex = 0;

  const isReviewJobType = (jobType: string): boolean =>
    jobType === "review" || jobType.endsWith("review");

  while (currentGroupId) {
    const groupId = currentGroupId as Id<"jobGroups">;
    const group: Doc<"jobGroups"> | null = await ctx.db.get(groupId);
    if (!group) break;

    // Get all jobs in this group
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
      .collect();

    // Check group status
    const pendingJobs = jobs.filter((j: Doc<"jobs">) => j.status === "pending");
    const runningJobs = jobs.filter((j: Doc<"jobs">) => j.status === "running");
    const allTerminal = jobs.every(
      (j: Doc<"jobs">) => j.status === "complete" || j.status === "failed"
    );

    if (pendingJobs.length > 0 && runningJobs.length === 0) {
      // Group is ready - return ALL pending jobs for parallel execution
      return pendingJobs.map((job: Doc<"jobs">) => ({
        job,
        group,
        assignment,
        accumulatedResults: [...accumulatedResults],
        previousNonPmGroupResults: [...lastNonPmGroupResults],
        r1GroupResults: [...r1GroupResults],
      }));
    }

    if (runningJobs.length > 0) {
      // Group is in progress - wait for it to complete
      return [];
    }

    if (allTerminal) {
      // Group is done - accumulate results and move to next
      const hasPMJob = jobs.some((j: Doc<"jobs">) => j.jobType === "pm");
      const hasReviewJob = jobs.some((j: Doc<"jobs">) => isReviewJobType(j.jobType));

      const groupResults = jobs.flatMap((job: Doc<"jobs">) => {
        if (!job.result) return [];
        return [{
          jobType: job.jobType,
          harness: job.harness,
          result: job.result,
          groupId,
          groupIndex,
        }];
      });

      if (hasPMJob) {
        // PM groups should not pollute downstream context.
        accumulatedResults.length = 0;
        groupIndex = 0;
      } else {
        if (hasReviewJob) {
          // Capture the non-PM group immediately before the review group.
          r1GroupResults = [...lastNonPmGroupResults];
        }

        if (groupResults.length > 0) {
          accumulatedResults.push(...groupResults);
        }
        lastNonPmGroupResults = groupResults;
        groupIndex += 1;
      }

      currentGroupId = group.nextGroupId;
    }
  }

  return [];
}

// ============================================================================
// Public Queries
// ============================================================================

// Get all jobs that are ready to run for a namespace
export const getReadyJobs = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args): Promise<ReadyJob[]> => {
    requirePassword(args);
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
      const jobs = await findReadyJobs(ctx, assignment);
      readyJobs.push(...jobs);
    }

    // Sequential assignments: only ONE can be active at a time
    const activeSequential = sequentialAssignments.find((a) => a.status === "active");

    if (activeSequential) {
      // Try to get ready jobs from the active sequential assignment
      const jobs = await findReadyJobs(ctx, activeSequential);
      readyJobs.push(...jobs);
    } else {
      // No active sequential - pick the first pending one (by priority, then creation time)
      const pendingSequential = sequentialAssignments
        .filter((a) => a.status === "pending")
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.createdAt - b.createdAt;
        });

      if (pendingSequential.length > 0) {
        const jobs = await findReadyJobs(ctx, pendingSequential[0]);
        readyJobs.push(...jobs);
      }
    }

    return readyJobs;
  },
});

// Get the queue status for a namespace
export const getQueueStatus = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const runningJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    // Filter running jobs to this namespace (via group -> assignment)
    const namespaceRunningJobs = [];
    for (const job of runningJobs) {
      const group = await ctx.db.get(job.groupId);
      if (!group) continue;
      const assignment = await ctx.db.get(group.assignmentId);
      if (assignment?.namespaceId === args.namespaceId) {
        namespaceRunningJobs.push({ job, group, assignment });
      }
    }

    const hasActiveNonIndependent = assignments.some(
      (a) => a.status === "active" && !a.independent
    );

    return {
      totalAssignments: assignments.length,
      pendingAssignments: assignments.filter((a) => a.status === "pending").length,
      activeAssignments: assignments.filter((a) => a.status === "active").length,
      blockedAssignments: assignments.filter((a) => a.status === "blocked").length,
      completeAssignments: assignments.filter((a) => a.status === "complete").length,
      runningJobs: namespaceRunningJobs.length,
      hasActiveNonIndependent,
    };
  },
});

// Get all namespaces with aggregated stats
export const getAllNamespaces = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    const namespaces = await ctx.db.query("namespaces").collect();

    const result = [];

    for (const ns of namespaces) {
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

      const lastActivity =
        assignments.length > 0
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

// Subscription-friendly: get all active/pending assignments with their group chains
export const watchQueue = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const result = [];

    for (const assignment of assignments) {
      if (assignment.status === "complete") continue;

      // Walk the group chain
      const groups: Array<Doc<"jobGroups"> & { jobs: Doc<"jobs">[] }> = [];
      let currentGroupId = assignment.headGroupId;

      while (currentGroupId) {
        const group = await ctx.db.get(currentGroupId);
        if (!group) break;

        const jobs = await ctx.db
          .query("jobs")
          .withIndex("by_group", (q) => q.eq("groupId", currentGroupId as Id<"jobGroups">))
          .collect();

        groups.push({ ...group, jobs });
        currentGroupId = group.nextGroupId;
      }

      const hasRunningJob = groups.some((g) =>
        g.jobs.some((j) => j.status === "running")
      );
      const nextPendingGroup = groups.find((g) => g.status === "pending") ?? null;

      result.push({
        assignment,
        groups,
        hasRunningJob,
        nextPendingGroup,
      });
    }

    return result;
  },
});

// Get ALL assignments for a namespace (including complete) with their group chains
export const getAllAssignments = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const result = [];

    for (const assignment of assignments) {
      // Walk the group chain
      const groups: Array<Doc<"jobGroups"> & { jobs: Doc<"jobs">[] }> = [];
      let currentGroupId = assignment.headGroupId;

      while (currentGroupId) {
        const group = await ctx.db.get(currentGroupId as Id<"jobGroups">);
        if (!group) break;

        const jobs = await ctx.db
          .query("jobs")
          .withIndex("by_group", (q) => q.eq("groupId", currentGroupId as Id<"jobGroups">))
          .collect();

        groups.push({ ...group, jobs });
        currentGroupId = group.nextGroupId;
      }

      const hasRunningJob = groups.some((g) =>
        g.jobs.some((j) => j.status === "running")
      );
      const nextPendingGroup = groups.find((g) => g.status === "pending") ?? null;

      result.push({
        assignment,
        groups,
        hasRunningJob,
        nextPendingGroup,
      });
    }

    return result;
  },
});

// Get all pending chat jobs for a namespace (separate from assignment jobs)
export const getReadyChatJobs = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args): Promise<ReadyChatJob[]> => {
    requirePassword(args);
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
