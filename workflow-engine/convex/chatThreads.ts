import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Queries

// Debug: list all without index
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("chatThreads").collect();
  },
});

export const list = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_namespace_updated", (q) => q.eq("namespaceId", args.namespaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("chatThreads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutations

export const create = mutation({
  args: {
    namespaceId: v.id("namespaces"),
    title: v.optional(v.string()),
    mode: v.optional(v.union(v.literal("jam"), v.literal("cook"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("chatThreads", {
      namespaceId: args.namespaceId,
      title: args.title || "New Chat",
      mode: args.mode || "jam", // Default to safe mode
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateMode = mutation({
  args: {
    id: v.id("chatThreads"),
    mode: v.union(v.literal("jam"), v.literal("cook"), v.literal("guardian")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      mode: args.mode,
      updatedAt: Date.now(),
    });
  },
});

export const linkAssignment = mutation({
  args: {
    id: v.id("chatThreads"),
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      assignmentId: args.assignmentId,
      updatedAt: Date.now(),
    });
  },
});

// Query thread linked to an assignment in guardian mode
export const getGuardianThread = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
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
    threadId: v.id("chatThreads"),
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // 1. Link assignment to thread
    await ctx.db.patch(args.threadId, {
      assignmentId: args.assignmentId,
      mode: "guardian",
      updatedAt: now,
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
    id: v.id("chatThreads"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const updateSessionId = mutation({
  args: {
    id: v.id("chatThreads"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      claudeSessionId: args.sessionId,
      updatedAt: Date.now(),
    });
  },
});

// Update the last prompt mode sent (for differential prompting)
export const updateLastPromptMode = mutation({
  args: {
    id: v.id("chatThreads"),
    lastPromptMode: v.union(v.literal("jam"), v.literal("cook")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastPromptMode: args.lastPromptMode,
      updatedAt: Date.now(),
    });
  },
});

// Bypass ID validation - for manual DB fixes
export const linkAssignmentRaw = mutation({
  args: {
    threadId: v.string(),
    assignmentId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId as any, {
      assignmentId: args.assignmentId as any,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("chatThreads") },
  handler: async (ctx, args) => {
    // Delete all messages in the thread first
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the thread
    await ctx.db.delete(args.id);
  },
});
