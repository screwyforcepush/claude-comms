import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePassword } from "./auth";

// ============================================================================
// Queries
// ============================================================================

export const list = query({
  args: {
    password: v.string(),
    groupId: v.optional(v.id("jobGroups")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    if (args.groupId && args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_group_status", (q) =>
          q.eq("groupId", args.groupId!).eq("status", args.status!)
        )
        .collect();
    }
    if (args.groupId) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId!))
        .collect();
    }
    if (args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("jobs").collect();
  },
});

export const get = query({
  args: { password: v.string(), id: v.id("jobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

export const getWithGroup = query({
  args: { password: v.string(), id: v.id("jobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const job = await ctx.db.get(args.id);
    if (!job) return null;

    const group = await ctx.db.get(job.groupId);
    if (!group) return null;

    const assignment = await ctx.db.get(group.assignmentId);
    return { ...job, group, assignment };
  },
});

// ============================================================================
// Group Queries
// ============================================================================

export const getGroup = query({
  args: { password: v.string(), id: v.id("jobGroups") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

export const getGroupWithJobs = query({
  args: { password: v.string(), id: v.id("jobGroups") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const group = await ctx.db.get(args.id);
    if (!group) return null;

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_group", (q) => q.eq("groupId", args.id))
      .collect();

    const assignment = await ctx.db.get(group.assignmentId);
    return { ...group, jobs, assignment };
  },
});

export const listGroups = query({
  args: {
    password: v.string(),
    assignmentId: v.optional(v.id("assignments")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    if (args.assignmentId) {
      const groups = await ctx.db
        .query("jobGroups")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId!))
        .collect();
      if (args.status) {
        return groups.filter((g) => g.status === args.status);
      }
      return groups;
    }
    if (args.status) {
      return await ctx.db
        .query("jobGroups")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("jobGroups").collect();
  },
});

// ============================================================================
// Mutations - Group Creation
// ============================================================================

// Job definition for creating groups
const jobDefValidator = v.object({
  jobType: v.string(),
  harness: v.union(
    v.literal("claude"),
    v.literal("codex"),
    v.literal("gemini")
  ),
  context: v.optional(v.string()),
});

// Create a new group with jobs
// Accepts array of job definitions - all jobs run in parallel within the group
// Auto-expansion (e.g., review -> 3 harnesses) should be handled by CLI before calling
export const createGroup = mutation({
  args: {
    password: v.string(),
    assignmentId: v.id("assignments"),
    jobs: v.array(jobDefValidator),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    if (args.jobs.length === 0) {
      throw new Error("At least one job required");
    }

    const now = Date.now();

    // Create the group (just a container - no jobType/context)
    const groupId = await ctx.db.insert("jobGroups", {
      assignmentId: args.assignmentId,
      status: "pending",
      createdAt: now,
    });

    // Insert jobs as-is (each job has its own type/harness/context)
    const jobIds: Id<"jobs">[] = [];

    for (const jobDef of args.jobs) {
      const jobId = await ctx.db.insert("jobs", {
        groupId,
        jobType: jobDef.jobType,
        harness: jobDef.harness,
        context: jobDef.context,
        status: "pending",
        createdAt: now,
      });
      jobIds.push(jobId);
    }

    // If assignment has no head group, set this as head
    const assignment = await ctx.db.get(args.assignmentId);
    if (assignment && !assignment.headGroupId) {
      await ctx.db.patch(args.assignmentId, {
        headGroupId: groupId,
        updatedAt: now,
      });
    }

    return { groupId, jobIds };
  },
});

// Insert a new group after an existing group in the chain
// Accepts array of job definitions - all jobs run in parallel within the group
// Auto-expansion should be handled by CLI before calling
export const insertGroupAfter = mutation({
  args: {
    password: v.string(),
    afterGroupId: v.id("jobGroups"),
    jobs: v.array(jobDefValidator),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    if (args.jobs.length === 0) {
      throw new Error("At least one job required");
    }

    const afterGroup = await ctx.db.get(args.afterGroupId);
    if (!afterGroup) throw new Error("Group not found");

    const now = Date.now();

    // Create new group pointing to what afterGroup was pointing to
    const groupId = await ctx.db.insert("jobGroups", {
      assignmentId: afterGroup.assignmentId,
      nextGroupId: afterGroup.nextGroupId,
      status: "pending",
      createdAt: now,
    });

    // Insert jobs as-is
    const jobIds: Id<"jobs">[] = [];

    for (const jobDef of args.jobs) {
      const jobId = await ctx.db.insert("jobs", {
        groupId,
        jobType: jobDef.jobType,
        harness: jobDef.harness,
        context: jobDef.context,
        status: "pending",
        createdAt: now,
      });
      jobIds.push(jobId);
    }

    // Update afterGroup to point to new group
    await ctx.db.patch(args.afterGroupId, {
      nextGroupId: groupId,
    });

    return { groupId, jobIds };
  },
});

// ============================================================================
// Mutations - Job Lifecycle
// ============================================================================

export const start = mutation({
  args: {
    password: v.string(),
    id: v.id("jobs"),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "running",
      startedAt: now,
      prompt: args.prompt,
    });

    // Update group status to running
    const job = await ctx.db.get(args.id);
    if (job) {
      await ctx.db.patch(job.groupId, {
        status: "running",
      });

      // Also mark assignment as active + update namespace counts
      const group = await ctx.db.get(job.groupId);
      if (group) {
        const assignment = await ctx.db.get(group.assignmentId);
        if (assignment && assignment.status !== "active") {
          // Update namespace counts: decrement old status, increment active
          const ns = await ctx.db.get(assignment.namespaceId);
          if (ns) {
            const counts = ns.assignmentCounts || { pending: 0, active: 0, blocked: 0, complete: 0 };
            counts[assignment.status as keyof typeof counts] = Math.max(0, (counts[assignment.status as keyof typeof counts] || 0) - 1);
            counts.active = (counts.active || 0) + 1;
            await ctx.db.patch(assignment.namespaceId, { assignmentCounts: counts });
          }
        }
        await ctx.db.patch(group.assignmentId, {
          status: "active",
          updatedAt: now,
        });
      }
    }
  },
});

export const complete = mutation({
  args: {
    password: v.string(),
    id: v.id("jobs"),
    result: v.string(),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    const update: Record<string, any> = {
      status: "complete",
      result: args.result,
      completedAt: now,
    };
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    await ctx.db.patch(args.id, update);

    // Check if group is done and update status
    const job = await ctx.db.get(args.id);
    if (job) {
      await updateGroupStatus(ctx, job.groupId);
    }
  },
});

export const fail = mutation({
  args: {
    password: v.string(),
    id: v.id("jobs"),
    result: v.optional(v.string()),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    const update: Record<string, any> = {
      status: "failed",
      result: args.result,
      completedAt: now,
    };
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    await ctx.db.patch(args.id, update);

    // Check if group is done and update status
    const job = await ctx.db.get(args.id);
    if (job) {
      await updateGroupStatus(ctx, job.groupId);
    }
  },
});

export const updateMetrics = mutation({
  args: {
    password: v.string(),
    id: v.id("jobs"),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const update: Record<string, any> = {};
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    if (Object.keys(update).length === 0) return;
    await ctx.db.patch(args.id, update);
  },
});

// ============================================================================
// Internal Helpers
// ============================================================================

// Update group status based on member job statuses
// Returns true if group just completed (for triggering next steps)
async function updateGroupStatus(
  ctx: { db: any },
  groupId: Id<"jobGroups">
): Promise<boolean> {
  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_group", (q: any) => q.eq("groupId", groupId))
    .collect();

  const statuses = jobs.map((j: any) => j.status);
  const allTerminal = statuses.every(
    (s: string) => s === "complete" || s === "failed"
  );

  if (!allTerminal) {
    // Group still in progress
    return false;
  }

  // All jobs are terminal - determine group status
  const anySucceeded = statuses.some((s: string) => s === "complete");
  const newStatus = anySucceeded ? "complete" : "failed";

  // Aggregate results with minimal jobType labels
  // Format: "review A", "review B", "review C", "uat" etc.
  const jobsWithResults = jobs.filter((j: any) => j.result);

  // Count occurrences of each jobType to determine if we need A/B/C suffixes
  const typeCounts: Record<string, number> = {};
  for (const j of jobsWithResults) {
    typeCounts[j.jobType] = (typeCounts[j.jobType] || 0) + 1;
  }

  // Track current index per jobType for labeling
  const typeIndex: Record<string, number> = {};
  const results = jobsWithResults
    .map((j: any) => {
      const count = typeCounts[j.jobType];
      let label: string;
      if (count === 1) {
        // Single job of this type - no suffix needed
        label = j.jobType;
      } else {
        // Multiple jobs of same type - add A/B/C suffix
        typeIndex[j.jobType] = (typeIndex[j.jobType] || 0);
        const suffix = String.fromCharCode(65 + typeIndex[j.jobType]); // A, B, C...
        typeIndex[j.jobType]++;
        label = `${j.jobType} ${suffix}`;
      }
      return `## ${label}\n${j.result}`;
    })
    .join("\n\n---\n\n");

  await ctx.db.patch(groupId, {
    status: newStatus,
    aggregatedResult: results || undefined,
  });

  return true;
}

// ============================================================================
// Runner Support
// ============================================================================

// Get job with its group and assignment (for runner)
export const getWithAssignment = query({
  args: { password: v.string(), id: v.id("jobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const job = await ctx.db.get(args.id);
    if (!job) return null;

    const group = await ctx.db.get(job.groupId);
    if (!group) return null;

    const assignment = await ctx.db.get(group.assignmentId);
    return {
      ...job,
      assignmentId: group.assignmentId,
      assignment,
      group,
    };
  },
});
