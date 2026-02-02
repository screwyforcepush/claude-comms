import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Queries

export const list = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// Mutations

export const add = mutation({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("pm")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Update thread's updatedAt
    await ctx.db.patch(args.threadId, { updatedAt: now });

    return await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      createdAt: now,
    });
  },
});
