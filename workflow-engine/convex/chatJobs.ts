import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Chat Jobs - Triggers Product Owner agent for chat threads
 *
 * Creates an assignment+job for each chat message to be processed
 * by the workflow runner. Uses session resume for conversation continuity.
 */

/**
 * Trigger a Product Owner job for a chat thread
 *
 * Creates assignment and job records for workflow processing.
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

    // 1. Get thread to check mode and namespace
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

    // 3. Create hidden assignment for this chat job
    // Independent: true means it won't block other work
    // Priority: 0 for high priority (responsiveness)
    const assignmentId = await ctx.db.insert("assignments", {
      namespaceId: thread.namespaceId,
      northStar: `Chat thread: ${thread.title}`,
      status: "pending",
      independent: true,
      priority: 0,
      artifacts: "",
      decisions: "",
      createdAt: now,
      updatedAt: now,
    });

    // 4. Build chat context for the job (including session ID for resume)
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
      claudeSessionId: thread.claudeSessionId, // For session resume
    };

    // 5. Create PO job with chat context
    // Using "product-owner" job type for the richer template with COOK_MODE conditionals
    const jobId = await ctx.db.insert("jobs", {
      assignmentId,
      jobType: "product-owner",
      harness,
      context: JSON.stringify(chatContext),
      status: "pending",
      createdAt: now,
    });

    // Link job to assignment
    await ctx.db.patch(assignmentId, {
      headJobId: jobId,
      updatedAt: now,
    });

    return {
      jobId,
      assignmentId,
      mode: thread.mode,
    };
  },
});
