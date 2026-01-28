import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Queries

export const list = query({
  args: {
    namespaceId: v.id("namespaces"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("blocked"),
        v.literal("complete")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("assignments")
        .withIndex("by_namespace_status", (q) =>
          q.eq("namespaceId", args.namespaceId).eq("status", args.status!)
        )
        .collect();
    }
    return await ctx.db
      .query("assignments")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWithJobs = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.id);
    if (!assignment) return null;

    // Walk the job chain
    const jobs = [];
    let currentJobId = assignment.headJobId;
    while (currentJobId) {
      const job = await ctx.db.get(currentJobId);
      if (!job) break;
      jobs.push(job);
      currentJobId = job.nextJobId;
    }

    return { ...assignment, jobs };
  },
});

// Mutations

export const create = mutation({
  args: {
    namespaceId: v.id("namespaces"),
    northStar: v.string(),
    independent: v.optional(v.boolean()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("assignments", {
      namespaceId: args.namespaceId,
      northStar: args.northStar,
      status: "pending",
      independent: args.independent ?? false,
      priority: args.priority ?? 10,
      artifacts: "",
      decisions: "",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("assignments"),
    artifacts: v.optional(v.string()),
    decisions: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("blocked"),
        v.literal("complete")
      )
    ),
    blockedReason: v.optional(v.string()),
    headJobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "complete",
      updatedAt: Date.now(),
    });
  },
});

export const block = mutation({
  args: {
    id: v.id("assignments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "blocked",
      blockedReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

export const unblock = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "active",
      blockedReason: undefined,
      updatedAt: Date.now(),
    });
  },
});
