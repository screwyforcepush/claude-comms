import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Chat Actions Helpers - Internal queries and mutations for chat actions
 *
 * These helpers are used by the chatActions.ts action which runs in Node.js.
 * Since Node.js actions can't directly access the database, they need to
 * call these internal queries and mutations.
 *
 * Also includes legacy queries/mutations for backward compatibility with runner.
 */

// =============================================================================
// Internal helpers (used by chatActions.ts action)
// =============================================================================

/**
 * Internal query to get thread (needed because actions can't read DB directly)
 */
export const getThread = internalQuery({
  args: {
    threadId: v.id("chatThreads"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});

/**
 * Internal mutation to update thread's session ID
 */
export const updateSessionId = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      claudeSessionId: args.sessionId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to add a message to thread
 */
export const addMessage = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.threadId, { updatedAt: now });
    return await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      createdAt: now,
    });
  },
});

/**
 * Internal mutation to clear session ID (for recovery)
 */
export const clearSessionId = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      claudeSessionId: undefined,
      updatedAt: Date.now(),
    });
  },
});

// =============================================================================
// Legacy support queries/mutations (for backward compatibility with runner)
// =============================================================================

// Types for the runner (keeping for backward compatibility during transition)
export interface ChatRequest {
  threadId: Id<"chatThreads">;
  namespaceId: Id<"namespaces">;
  userMessage: string;
  existingSessionId: string | null;
}

/**
 * Query to get pending chat threads (kept for backward compatibility)
 * Runner can poll this to find threads needing responses
 */
export const getPendingChats = query({
  args: { namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    // Find threads that have a pending message (updatedAt > last assistant message)
    const threads = await ctx.db
      .query("chatThreads")
      .withIndex("by_namespace", (q) => q.eq("namespaceId", args.namespaceId))
      .collect();

    const pendingRequests: ChatRequest[] = [];

    for (const thread of threads) {
      // Get messages for this thread
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_thread_created", (q) => q.eq("threadId", thread._id))
        .order("desc")
        .take(1);

      // If the latest message is from user, this thread needs a response
      if (messages.length > 0 && messages[0].role === "user") {
        pendingRequests.push({
          threadId: thread._id,
          namespaceId: thread.namespaceId,
          userMessage: messages[0].content,
          existingSessionId: thread.claudeSessionId ?? null,
        });
      }
    }

    return pendingRequests;
  },
});

/**
 * Get a single thread's chat request info (kept for backward compatibility)
 */
export const getChatRequest = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    // Get the latest user message
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_created", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(1);

    if (messages.length === 0 || messages[0].role !== "user") {
      return null;
    }

    return {
      threadId: thread._id,
      namespaceId: thread.namespaceId,
      userMessage: messages[0].content,
      existingSessionId: thread.claudeSessionId ?? null,
    };
  },
});

/**
 * Save assistant response (kept for backward compatibility with runner)
 */
export const saveResponse = mutation({
  args: {
    threadId: v.id("chatThreads"),
    content: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    const now = Date.now();

    // Store assistant message
    const messageId = await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      role: "assistant",
      content: args.content,
      createdAt: now,
    });

    // Update session ID if provided (and different from existing)
    const updates: { updatedAt: number; claudeSessionId?: string } = {
      updatedAt: now,
    };

    if (args.sessionId && args.sessionId !== thread.claudeSessionId) {
      updates.claudeSessionId = args.sessionId;
    }

    await ctx.db.patch(args.threadId, updates);

    return { messageId };
  },
});

/**
 * Clear session (kept for backward compatibility with runner)
 */
export const clearSession = mutation({
  args: {
    threadId: v.id("chatThreads"),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(args.threadId, {
      claudeSessionId: undefined,
      updatedAt: Date.now(),
    });

    return { cleared: true };
  },
});
