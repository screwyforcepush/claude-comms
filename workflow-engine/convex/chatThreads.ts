import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePassword } from "./auth";

// Queries

// List all threads cross-namespace, sorted by latestMessageAt desc (denormalized).
// No N+1 enrichment — latestMessageAt is written by chatMessages.add.
// After backfill, can switch to pure index query: .withIndex("by_latest_message").order("desc").take(limit)
export const listAll = query({
  args: { password: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    requirePassword(args);
    const limit = args.limit || 50;

    const threads = await ctx.db.query("chatThreads").collect();

    // Sort by denormalized latestMessageAt, fallback to updatedAt for pre-backfill threads
    threads.sort((a, b) => (b.latestMessageAt ?? b.updatedAt) - (a.latestMessageAt ?? a.updatedAt));

    return threads.slice(0, limit);
  },
});

// Backfill latestMessageAt for existing threads that predate denormalization.
// Run once, then all threads will have latestMessageAt set.
export const backfillLatestMessageAt = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    const threads = await ctx.db.query("chatThreads").collect();
    let updated = 0;

    for (const thread of threads) {
      if (thread.latestMessageAt) continue; // Already set

      const latestMessage = await ctx.db
        .query("chatMessages")
        .withIndex("by_thread_created", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .first();

      await ctx.db.patch(thread._id, {
        latestMessageAt: latestMessage?.createdAt ?? thread.createdAt,
      });
      updated++;
    }

    return { updated, total: threads.length };
  },
});

export const list = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_namespace_updated", (q) => q.eq("namespaceId", args.namespaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { password: v.string(), id: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

// Mutations

export const create = mutation({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces"),
    title: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("jam"), v.literal("cook"))),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    return await ctx.db.insert("chatThreads", {
      namespaceId: args.namespaceId,
      title: args.title || "New Chat",
      mode: args.mode || "jam", // Default to safe mode
      latestMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateMode = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    mode: v.union(v.literal("jam"), v.literal("cook"), v.literal("guardian")),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.id, {
      mode: args.mode,
      updatedAt: Date.now(),
    });
  },
});

export const linkAssignment = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const thread = await ctx.db.get(args.id);
    const existing = thread?.assignmentsCreated || [];
    const assignmentsCreated = existing.includes(args.assignmentId)
      ? existing
      : [...existing, args.assignmentId];
    await ctx.db.patch(args.id, {
      assignmentId: args.assignmentId,
      updatedAt: Date.now(),
      assignmentsCreated,
    });
  },
});

export const markRead = mutation({
  args: { password: v.string(), id: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.id, { lastReadAt: Date.now() });
  },
});

export const updateFocusAssignment = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const thread = await ctx.db.get(args.id);
    if (!thread) throw new Error("Thread not found");
    const assignments = thread.assignmentsCreated || [];
    if (!assignments.includes(args.assignmentId)) {
      throw new Error("Assignment not in thread's history");
    }
    await ctx.db.patch(args.id, {
      assignmentId: args.assignmentId,
      updatedAt: Date.now(),
    });
  },
});

// Query thread linked to an assignment in guardian mode
export const getGuardianThread = query({
  args: { password: v.string(), assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    requirePassword(args);
    // Use index to efficiently find thread by assignmentId
    const thread = await ctx.db
      .query("chatThreads")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .filter((q) => q.eq(q.field("mode"), "guardian"))
      .first();

    return thread ?? null;
  },
});

// Atomically enable guardian mode (link + align + mode change)
export const enableGuardianMode = mutation({
  args: {
    password: v.string(),
    threadId: v.id("chatThreads"),
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();
    // Read thread first to get existing assignmentsCreated
    const thread = await ctx.db.get(args.threadId);
    const existing = thread?.assignmentsCreated || [];
    const assignmentsCreated = existing.includes(args.assignmentId)
      ? existing
      : [...existing, args.assignmentId];
    // 1. Link assignment to thread (single atomic patch)
    await ctx.db.patch(args.threadId, {
      assignmentId: args.assignmentId,
      mode: "guardian",
      updatedAt: now,
      assignmentsCreated,
    });

    // 2. Set alignment status to aligned on assignment
    await ctx.db.patch(args.assignmentId, {
      alignmentStatus: "aligned",
      updatedAt: now,
    });

    return { success: true };
  },
});

export const updateTitle = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const updateSessionId = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.id, {
      claudeSessionId: args.sessionId,
      updatedAt: Date.now(),
    });
  },
});

// Update the last prompt mode sent (for differential prompting)
export const updateLastPromptMode = mutation({
  args: {
    password: v.string(),
    id: v.id("chatThreads"),
    lastPromptMode: v.union(v.literal("jam"), v.literal("cook")),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.id, {
      lastPromptMode: args.lastPromptMode,
      updatedAt: Date.now(),
    });
  },
});

// Bypass ID validation - for manual DB fixes
export const linkAssignmentRaw = mutation({
  args: {
    password: v.string(),
    threadId: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    await ctx.db.patch(args.threadId as any, {
      assignmentId: args.assignmentId as any,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { password: v.string(), id: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const thread = await ctx.db.get(args.id);
    if (!thread) return;

    // 1. Cascade delete linked assignments (current + history)
    const assignmentIds = new Set<string>();
    if (thread.assignmentId) assignmentIds.add(thread.assignmentId);
    if (thread.assignmentsCreated) {
      for (const id of thread.assignmentsCreated) assignmentIds.add(id);
    }

    for (const assignmentId of assignmentIds) {
      const assignment = await ctx.db.get(assignmentId as Id<"assignments">);
      if (!assignment) continue;

      // Adjust namespace assignment counts
      const ns = await ctx.db.get(assignment.namespaceId);
      if (ns) {
        const counts = ns.assignmentCounts || { pending: 0, active: 0, blocked: 0, complete: 0 };
        const key = assignment.status as string;
        if (key in counts) {
          (counts as any)[key] = Math.max(0, ((counts as any)[key] || 0) - 1);
        }
        await ctx.db.patch(assignment.namespaceId, { assignmentCounts: counts });
      }

      // Delete job groups and their jobs
      const groups = await ctx.db
        .query("jobGroups")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
        .collect();

      for (const group of groups) {
        const jobs = await ctx.db
          .query("jobs")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();
        for (const job of jobs) {
          await ctx.db.delete(job._id);
        }
        await ctx.db.delete(group._id);
      }

      // Delete the assignment
      await ctx.db.delete(assignment._id);
    }

    // 2. Delete all chat jobs for this thread
    const chatJobs = await ctx.db
      .query("chatJobs")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect();
    for (const cj of chatJobs) {
      await ctx.db.delete(cj._id);
    }

    // 3. Delete all chat messages for this thread
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // 4. Delete the thread
    await ctx.db.delete(args.id);
  },
});
