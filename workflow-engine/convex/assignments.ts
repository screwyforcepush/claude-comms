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

// Get assignment with its group chain and jobs
export const getWithGroups = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.id);
    if (!assignment) return null;

    // Walk the group chain
    const groups = [];
    let currentGroupId = assignment.headGroupId;
    while (currentGroupId) {
      const group = await ctx.db.get(currentGroupId);
      if (!group) break;

      // Get all jobs in this group
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_group", (q) => q.eq("groupId", currentGroupId!))
        .collect();

      groups.push({ ...group, jobs });
      currentGroupId = group.nextGroupId;
    }

    return { ...assignment, groups };
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
    headGroupId: v.optional(v.id("jobGroups")),
    alignmentStatus: v.optional(
      v.union(
        v.literal("aligned"),
        v.literal("uncertain"),
        v.literal("misaligned")
      )
    ),
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

export const remove = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    // Delete all groups and their jobs for this assignment
    const groups = await ctx.db
      .query("jobGroups")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.id))
      .collect();

    let jobsDeleted = 0;
    for (const group of groups) {
      // Delete jobs in this group
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .collect();

      for (const job of jobs) {
        await ctx.db.delete(job._id);
        jobsDeleted++;
      }

      // Delete the group
      await ctx.db.delete(group._id);
    }

    // Unlink from any chat threads
    const threads = await ctx.db
      .query("chatThreads")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.id))
      .collect();

    for (const thread of threads) {
      await ctx.db.patch(thread._id, {
        assignmentId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete the assignment
    await ctx.db.delete(args.id);

    return { deleted: true, groupsDeleted: groups.length, jobsDeleted };
  },
});
