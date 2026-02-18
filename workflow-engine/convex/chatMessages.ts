import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePassword } from "./auth";

// Queries

export const list = query({
  args: { password: v.string(), threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

export const getLatestTimestamp = query({
  args: { password: v.string(), threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const latest = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .first();
    return latest?.createdAt ?? null;
  },
});

// Mutations

export const add = mutation({
  args: {
    password: v.string(),
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("pm")),
    content: v.string(),
    hint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const now = Date.now();

    // Update thread's updatedAt + denormalized latestMessageAt
    await ctx.db.patch(args.threadId, { updatedAt: now, latestMessageAt: now });

    return await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      createdAt: now,
      ...(args.hint ? { hint: args.hint } : {}),
    });
  },
});
