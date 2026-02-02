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
    // Guardian mode: if true, this is a PO evaluation of PM report
    isGuardianEvaluation: v.optional(v.boolean()),
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

    // For guardian evaluation, find the latest PM message
    // Otherwise, find the latest user message
    let latestMessage: string;
    if (args.isGuardianEvaluation) {
      const pmMessages = messages.filter((m) => m.role === "pm");
      const latestPmMessage = pmMessages[pmMessages.length - 1];
      if (!latestPmMessage) {
        throw new Error("No PM message found for guardian evaluation");
      }
      latestMessage = latestPmMessage.content;
    } else {
      const userMessages = messages.filter((m) => m.role === "user");
      const latestUserMessage = userMessages[userMessages.length - 1];
      if (!latestUserMessage) {
        throw new Error("No user message found");
      }
      latestMessage = latestUserMessage.content;
    }

    // 3. Build chat context (including session ID for resume)
    // Determine effective prompt mode (guardian uses cook for normal interactions)
    const effectivePromptMode = thread.mode === "guardian" ? "cook" : thread.mode;

    const chatContext = {
      threadId: args.threadId,
      namespaceId: thread.namespaceId,
      mode: thread.mode,
      // For differential prompting
      effectivePromptMode,
      lastPromptMode: thread.lastPromptMode,
      messages: messages.map((m) => ({
        _id: m._id,
        threadId: m.threadId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      latestUserMessage: latestMessage,
      claudeSessionId: thread.claudeSessionId,
      // Guardian mode fields
      assignmentId: thread.assignmentId,
      isGuardianEvaluation: args.isGuardianEvaluation ?? false,
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
  args: {
    id: v.id("chatJobs"),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "running",
      startedAt: Date.now(),
      prompt: args.prompt,
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

/**
 * Get active (pending or running) chat job for a thread
 * Used for showing typing indicator while job is processing
 */
export const getActiveForThread = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    // Get all chatJobs for this thread
    const jobs = await ctx.db
      .query("chatJobs")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Find any that are pending or running (most recent first)
    const activeJob = jobs
      .filter((job) => job.status === "pending" || job.status === "running")
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    return activeJob ?? null;
  },
});
