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

  // 6b: Short-circuit on running groups - check group statuses WITHOUT reading jobs
  const runningGroup = await ctx.db
    .query("jobGroups")
    .withIndex("by_assignment", (q: any) => q.eq("assignmentId", assignment._id))
    .filter((q: any) => q.eq(q.field("status"), "running"))
    .first();

  if (runningGroup) return []; // A group is running, nothing to dispatch

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
    // 6a: Use compound index to fetch only active and pending assignments
    const active = await ctx.db
      .query("assignments")
      .withIndex("by_namespace_status", (q) =>
        q.eq("namespaceId", args.namespaceId).eq("status", "active"))
      .collect();
    const pending = await ctx.db
      .query("assignments")
      .withIndex("by_namespace_status", (q) =>
        q.eq("namespaceId", args.namespaceId).eq("status", "pending"))
      .collect();
    const workableAssignments = [...active, ...pending];

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
