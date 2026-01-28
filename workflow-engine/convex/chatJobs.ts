import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Chat Jobs - Separate from assignment-based jobs
 *
 * Chat jobs are processed by the runner but don't create assignments.
 * They use session resume for conversation continuity within a thread.
 */

/**
 * Trigger a chat job for a thread
 */
export const trigger = mutation({
  args: {
    threadId: v.id("chatThreads"),
    harness: v.optional(
      v.union(v.literal("claude"), v.literal("codex"), v.literal("gemini"))
    ),
  },
  handler: async (ctx, args) => {
    const harness = args.harness ?? "claude";
    const now = Date.now();

    // 1. Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // 2. Get all messages for context
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .collect();

    if (messages.length === 0) {
      throw new Error("No messages in thread");
    }

    // Get the latest user message
    const userMessages = messages.filter((m) => m.role === "user");
    const latestUserMessage = userMessages[userMessages.length - 1];
    if (!latestUserMessage) {
      throw new Error("No user message found");
    }

    // 3. Build chat context (including session ID for resume)
    const chatContext = {
      threadId: args.threadId,
      namespaceId: thread.namespaceId,
      mode: thread.mode,
      messages: messages.map((m) => ({
        _id: m._id,
        threadId: m.threadId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      latestUserMessage: latestUserMessage.content,
      claudeSessionId: thread.claudeSessionId,
    };

    // 4. Create chat job (no assignment!)
    const jobId = await ctx.db.insert("chatJobs", {
      threadId: args.threadId,
      namespaceId: thread.namespaceId,
      harness,
      context: JSON.stringify(chatContext),
      status: "pending",
      createdAt: now,
    });

    return { jobId, mode: thread.mode };
  },
});

/**
 * Mark a chat job as running
 */
export const start = mutation({
  args: { id: v.id("chatJobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "running",
      startedAt: Date.now(),
    });
  },
});

/**
 * Mark a chat job as complete
 */
export const complete = mutation({
  args: {
    id: v.id("chatJobs"),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "complete",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

/**
 * Mark a chat job as failed
 */
export const fail = mutation({
  args: {
    id: v.id("chatJobs"),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "failed",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

/**
 * Get pending chat jobs for a namespace
 */
export const getPending = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatJobs")
      .withIndex("by_namespace_status", (q) =>
        q.eq("namespaceId", args.namespaceId).eq("status", "pending")
      )
      .collect();
  },
});

/**
 * Get a chat job by ID
 */
export const get = query({
  args: { id: v.id("chatJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
