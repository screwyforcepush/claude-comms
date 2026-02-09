import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePassword } from "./auth";

// Helper: atomically adjust assignmentCounts on a namespace
type CountKey = "pending" | "active" | "blocked" | "complete";
async function adjustNamespaceCounts(
  ctx: { db: any },
  namespaceId: Id<"namespaces">,
  deltas: Partial<Record<CountKey, number>>
) {
  const ns = await ctx.db.get(namespaceId);
  if (!ns) return;
  const counts = ns.assignmentCounts || { pending: 0, active: 0, blocked: 0, complete: 0 };
  for (const [key, delta] of Object.entries(deltas)) {
    counts[key as CountKey] = Math.max(0, (counts[key as CountKey] || 0) + (delta as number));
  }
  await ctx.db.patch(namespaceId, { assignmentCounts: counts });
}

// Queries

export const list = query({
  args: {
    password: v.string(),
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
    requirePassword(args);
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
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

// Get assignment with its group chain and jobs
export const getWithGroups = query({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
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

// Get assignment with group chain (no job data) - lightweight for chain structure
export const getGroupChain = query({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (!assignment) return null;

    // Walk the group chain - read only group documents, not jobs
    const groups: Array<{ _id: any; status: string; nextGroupId?: any; createdAt: number; assignmentId: any }> = [];
    let currentGroupId = assignment.headGroupId;
    while (currentGroupId) {
      const group = await ctx.db.get(currentGroupId);
      if (!group) break;
      groups.push({
        _id: group._id,
        status: group.status,
        nextGroupId: group.nextGroupId,
        createdAt: group.createdAt,
        assignmentId: group.assignmentId,
      });
      currentGroupId = group.nextGroupId;
    }

    return { ...assignment, groups };
  },
});

// Mutations

export const create = mutation({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces"),
    northStar: v.string(),
    independent: v.optional(v.boolean()),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    const id = await ctx.db.insert("assignments", {
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
    await adjustNamespaceCounts(ctx, args.namespaceId, { pending: 1 });
    return id;
  },
});

export const update = mutation({
  args: {
    password: v.string(),
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
    requirePassword(args);
    const { id, password, ...updates } = args;

    // If status is changing, update namespace counts
    if (args.status !== undefined) {
      const assignment = await ctx.db.get(id);
      if (assignment && assignment.status !== args.status) {
        await adjustNamespaceCounts(ctx, assignment.namespaceId, {
          [assignment.status]: -1,
          [args.status]: 1,
        });
      }
    }

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
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (assignment && assignment.status !== "complete") {
      await adjustNamespaceCounts(ctx, assignment.namespaceId, {
        [assignment.status]: -1,
        complete: 1,
      });
    }
    await ctx.db.patch(args.id, {
      status: "complete",
      updatedAt: Date.now(),
    });
  },
});

export const block = mutation({
  args: {
    password: v.string(),
    id: v.id("assignments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (assignment && assignment.status !== "blocked") {
      await adjustNamespaceCounts(ctx, assignment.namespaceId, {
        [assignment.status]: -1,
        blocked: 1,
      });
    }
    await ctx.db.patch(args.id, {
      status: "blocked",
      blockedReason: args.reason,
      updatedAt: Date.now(),
    });
  },
});

export const unblock = mutation({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const assignment = await ctx.db.get(args.id);
    if (assignment && assignment.status !== "active") {
      await adjustNamespaceCounts(ctx, assignment.namespaceId, {
        [assignment.status]: -1,
        active: 1,
      });
    }
    await ctx.db.patch(args.id, {
      status: "active",
      blockedReason: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { password: v.string(), id: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    // Decrement namespace count for old status
    const assignment = await ctx.db.get(args.id);
    if (assignment) {
      await adjustNamespaceCounts(ctx, assignment.namespaceId, {
        [assignment.status]: -1,
      });
    }

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

// Backfill: recompute assignmentCounts for all namespaces from current assignments
export const backfillNamespaceCounts = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    const namespaces = await ctx.db.query("namespaces").collect();
    let updated = 0;
    for (const ns of namespaces) {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_namespace", (q: any) => q.eq("namespaceId", ns._id))
        .collect();
      const counts = { pending: 0, active: 0, blocked: 0, complete: 0 };
      for (const a of assignments) {
        if (a.status in counts) {
          counts[a.status as CountKey]++;
        }
      }
      await ctx.db.patch(ns._id, { assignmentCounts: counts });
      updated++;
    }
    return { updated };
  },
});
