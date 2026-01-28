import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Queries

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
    mode: v.union(v.literal("jam"), v.literal("cook")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      mode: args.mode,
      updatedAt: Date.now(),
    });
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
