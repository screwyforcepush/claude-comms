import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Queries

export const list = query({
  args: {
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
    if (args.assignmentId && args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_assignment_status", (q) =>
          q.eq("assignmentId", args.assignmentId!).eq("status", args.status!)
        )
        .collect();
    }
    if (args.assignmentId) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_assignment", (q) =>
          q.eq("assignmentId", args.assignmentId!)
        )
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
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWithAssignment = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) return null;

    const assignment = await ctx.db.get(job.assignmentId);
    return { ...job, assignment };
  },
});

// Get the previous job in the chain (for context passing)
export const getPrevious = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) return null;

    const assignment = await ctx.db.get(job.assignmentId);
    if (!assignment) return null;

    // Walk chain to find job before this one
    let currentJobId = assignment.headJobId;
    let prevJob = null;
    while (currentJobId) {
      if (currentJobId === args.id) {
        return prevJob;
      }
      const currentJob = await ctx.db.get(currentJobId);
      if (!currentJob) break;
      prevJob = currentJob;
      currentJobId = currentJob.nextJobId;
    }
    return null;
  },
});

// Mutations

export const create = mutation({
  args: {
    assignmentId: v.id("assignments"),
    jobType: v.string(),
    harness: v.union(
      v.literal("claude"),
      v.literal("codex"),
      v.literal("gemini")
    ),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      assignmentId: args.assignmentId,
      jobType: args.jobType,
      harness: args.harness,
      context: args.context,
      status: "pending",
      createdAt: now,
    });

    // If assignment has no head job, set this as head
    const assignment = await ctx.db.get(args.assignmentId);
    if (assignment && !assignment.headJobId) {
      await ctx.db.patch(args.assignmentId, {
        headJobId: jobId,
        updatedAt: now,
      });
    }

    return jobId;
  },
});

// Insert job after a specific job in the chain
export const insertAfter = mutation({
  args: {
    afterJobId: v.id("jobs"),
    jobType: v.string(),
    harness: v.union(
      v.literal("claude"),
      v.literal("codex"),
      v.literal("gemini")
    ),
    context: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const afterJob = await ctx.db.get(args.afterJobId);
    if (!afterJob) throw new Error("Job not found");

    const now = Date.now();

    // Create new job pointing to what afterJob was pointing to
    const newJobId = await ctx.db.insert("jobs", {
      assignmentId: afterJob.assignmentId,
      jobType: args.jobType,
      harness: args.harness,
      context: args.context,
      status: "pending",
      nextJobId: afterJob.nextJobId,
      createdAt: now,
    });

    // Update afterJob to point to new job
    await ctx.db.patch(args.afterJobId, {
      nextJobId: newJobId,
    });

    return newJobId;
  },
});

export const start = mutation({
  args: {
    id: v.id("jobs"),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "running",
      startedAt: now,
      prompt: args.prompt,
    });

    // Also mark assignment as active
    const job = await ctx.db.get(args.id);
    if (job) {
      await ctx.db.patch(job.assignmentId, {
        status: "active",
        updatedAt: now,
      });
    }
  },
});

export const complete = mutation({
  args: {
    id: v.id("jobs"),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "complete",
      result: args.result,
      completedAt: now,
    });
  },
});

export const fail = mutation({
  args: {
    id: v.id("jobs"),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "failed",
      result: args.result,
      completedAt: now,
    });
  },
});
