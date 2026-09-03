import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePassword } from "./auth";

const MAX_BODY_CHARS = 5000;
const DEFAULT_FEED_LIMIT = 50;
const MAX_FEED_LIMIT = 200;

function prepareBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("body must be non-empty");
  }
  return trimmed.length > MAX_BODY_CHARS
    ? trimmed.slice(0, MAX_BODY_CHARS)
    : trimmed;
}

function feedLimit(limit?: number): number {
  if (limit === undefined) return DEFAULT_FEED_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer");
  }
  return Math.min(limit, MAX_FEED_LIMIT);
}

export const post = mutation({
  args: {
    password: v.string(),
    threadId: v.id("chatThreads"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    requirePassword(args);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");

    const namespace = await ctx.db.get(thread.namespaceId);
    if (!namespace) throw new Error("Namespace not found");

    const now = Date.now();
    return await ctx.db.insert("notifications", {
      namespaceId: thread.namespaceId,
      threadId: thread._id,
      title: `${namespace.name} · ${thread.title}`,
      body: prepareBody(args.body),
      createdAt: now,
    });
  },
});

export const feed = query({
  args: {
    password: v.string(),
    cursor: v.optional(v.union(v.number(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);

    const limit = feedLimit(args.limit);
    // Shell consumers store nextCursor locally and pass it back unchanged.
    // The cursor is the last seen row's Convex _creationTime, not createdAt.
    const cursor = args.cursor;
    const rows = cursor == null
      ? await ctx.db
        .query("notifications")
        .withIndex("by_creation_time")
        .order("asc")
        .take(limit)
      : await ctx.db
        .query("notifications")
        .withIndex("by_creation_time", (q) => q.gt("_creationTime", cursor))
        .order("asc")
        .take(limit);

    const last = rows[rows.length - 1];
    return {
      rows,
      nextCursor: last ? last._creationTime : null,
    };
  },
});

export const markDelivered = mutation({
  args: {
    password: v.string(),
    ids: v.array(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    requirePassword(args);

    const deliveredAt = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, { deliveredAt });
    }

    return { updated: args.ids.length, deliveredAt };
  },
});
