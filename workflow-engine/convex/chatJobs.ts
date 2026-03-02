import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePassword } from "./auth";

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
    password: v.string(),
    threadId: v.id("chatThreads"),
    triggerMessageId: v.id("chatMessages"),
    harness: v.optional(
      v.union(v.literal("claude"), v.literal("codex"), v.literal("gemini"))
    ),
    // Guardian mode: if true, this is a PO evaluation of PM report
    isGuardianEvaluation: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const harness = args.harness ?? "claude";
    const now = Date.now();

    // 1. Get thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread) {
      throw new Error("Thread not found");
    }

    // 2. Get the trigger message directly — no need to query all messages
    const triggerMessage = await ctx.db.get(args.triggerMessageId);
    if (!triggerMessage) {
      throw new Error("Trigger message not found");
    }

    // 3. Build chat context (including session ID for resume)
    // Determine effective prompt mode (guardian uses cook for normal interactions)
    const effectivePromptMode = thread.mode === "guardian" ? "cook" : thread.mode;

    // Session resolution: guardian mode uses per-assignment forked sessions
    let resolvedSessionId = thread.claudeSessionId;
    let forkSession = false;
    if (thread.mode === "guardian" && thread.assignmentId) {
      const guardianSessions = thread.guardianSessions ?? {};
      const guardianSessionId = guardianSessions[thread.assignmentId];
      if (guardianSessionId) {
        // Existing guardian fork — resume it
        resolvedSessionId = guardianSessionId;
      } else if (thread.claudeSessionId) {
        // No guardian fork yet — fork from OG session
        resolvedSessionId = thread.claudeSessionId;
        forkSession = true;
      }
      // else: no OG session either — new session (resolvedSessionId stays undefined)
    }

    const chatContext = {
      threadId: args.threadId,
      namespaceId: thread.namespaceId,
      mode: thread.mode,
      // For differential prompting
      effectivePromptMode,
      lastPromptMode: thread.lastPromptMode,
      latestUserMessage: triggerMessage.content,
      claudeSessionId: resolvedSessionId,
      // Guardian session fork
      forkSession,
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
    password: v.string(),
    id: v.id("chatJobs"),
    prompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
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
    password: v.string(),
    id: v.id("chatJobs"),
    result: v.string(),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
    exitForced: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const update: Record<string, any> = {
      status: "complete",
      result: args.result,
      completedAt: Date.now(),
    };
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    if (args.exitForced !== undefined) update.exitForced = args.exitForced;
    await ctx.db.patch(args.id, update);
  },
});

/**
 * Mark a chat job as failed
 */
export const fail = mutation({
  args: {
    password: v.string(),
    id: v.id("chatJobs"),
    result: v.optional(v.string()),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
    exitForced: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const update: Record<string, any> = {
      status: "failed",
      result: args.result,
      completedAt: Date.now(),
    };
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    if (args.exitForced !== undefined) update.exitForced = args.exitForced;
    await ctx.db.patch(args.id, update);
  },
});

export const updateMetrics = mutation({
  args: {
    password: v.string(),
    id: v.id("chatJobs"),
    toolCallCount: v.optional(v.number()),
    subagentCount: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    lastEventAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const update: Record<string, any> = {};
    if (args.toolCallCount !== undefined) update.toolCallCount = args.toolCallCount;
    if (args.subagentCount !== undefined) update.subagentCount = args.subagentCount;
    if (args.totalTokens !== undefined) update.totalTokens = args.totalTokens;
    if (args.lastEventAt !== undefined) update.lastEventAt = args.lastEventAt;
    if (Object.keys(update).length === 0) return;
    await ctx.db.patch(args.id, update);
  },
});

/**
 * Request kill for a running or pending chat job
 */
export const requestKill = mutation({
  args: { password: v.string(), id: v.id("chatJobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Chat job not found");
    if (job.status !== "running" && job.status !== "pending") {
      throw new Error("Can only kill running or pending chat jobs");
    }
    await ctx.db.patch(args.id, { killRequested: true });
  },
});

/**
 * Get pending chat jobs for a namespace
 */
export const getPending = query({
  args: { password: v.string(), namespaceId: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
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
  args: { password: v.string(), id: v.id("chatJobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

/**
 * Get active (pending or running) chat job for a thread
 * Used for showing typing indicator while job is processing
 */
export const getActiveForThread = query({
  args: { password: v.string(), threadId: v.id("chatThreads") },
  handler: async (ctx, args) => {
    requirePassword(args);
    // Check pending first, then running. At most 2 indexed lookups.
    const pending = await ctx.db
      .query("chatJobs")
      .withIndex("by_thread_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "pending"))
      .first();
    if (pending) return pending;

    const running = await ctx.db
      .query("chatJobs")
      .withIndex("by_thread_status", (q) =>
        q.eq("threadId", args.threadId).eq("status", "running"))
      .first();
    return running ?? null;
  },
});
