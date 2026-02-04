/**
 * Storybook Feedback Widget - Convex Database Layer
 * WP-01: Database layer for capturing and retrieving feedback
 *
 * This module provides storage and retrieval functions for the Storybook feedback widget.
 * It is isolated from the main application tables and handles screenshot uploads and metadata.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * 5-State Status Model (Streamlined)
 * - pending: New feedback, awaiting action
 * - active: Currently being worked on
 * - review: Implemented/addressed, ready for UAT
 * - resolved: UAT approved
 * - rejected: User rejected
 */
type FeedbackStatus = "pending" | "active" | "review" | "resolved" | "rejected";

const statusFilterValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("review"),
  v.literal("resolved"),
  v.literal("rejected"),
);

const feedbackResponseValidator = v.object({
  _id: v.id("feedback"),
  _creationTime: v.number(),
  url: v.string(),
  path: v.string(),
  note: v.optional(v.string()),
  overlayJSON: v.string(),
  screenshot: v.id("_storage"),
  screenshotUrl: v.union(v.string(), v.null()),
  ua: v.string(),
  viewport: v.object({
    width: v.number(),
    height: v.number(),
  }),
  createdAt: v.number(),
  route: v.optional(v.string()),
  releaseId: v.optional(v.string()),
  env: v.optional(v.string()),
  userHash: v.optional(v.string()),
  flags: v.optional(v.array(v.string())),
  project: v.optional(v.string()),
  status: v.optional(
    v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("review"),
      v.literal("resolved"),
      v.literal("rejected"),
    ),
  ),
  priority: v.optional(
    v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
  ),
  assignedTo: v.optional(v.string()),
  resolvedAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

type FeedbackFilters = {
  status?: FeedbackStatus;
  project?: string;
  route?: string;
  env?: string;
};

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const resolveLimit = (limit?: number | null) => {
  if (limit === undefined || limit === null || limit <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(limit, MAX_LIMIT);
};

// No normalization needed - schema enforces correct values

const buildFeedbackQuery = (ctx: QueryCtx, filters: FeedbackFilters) => {
  let builder: any = ctx.db.query("feedback");

  if (filters.status) {
    builder = builder.withIndex("by_status", (q: any) => q.eq("status", filters.status));
  } else if (filters.project) {
    builder = builder.withIndex("by_project", (q: any) => q.eq("project", filters.project));
  } else if (filters.route) {
    builder = builder.withIndex("by_route", (q: any) => q.eq("route", filters.route));
  } else if (filters.env) {
    builder = builder.withIndex("by_env", (q: any) => q.eq("env", filters.env));
  }

  if (filters.project) {
    builder = builder.filter((q: any) => q.eq(q.field("project"), filters.project));
  }

  if (filters.route) {
    builder = builder.filter((q: any) => q.eq(q.field("route"), filters.route));
  }

  if (filters.env) {
    builder = builder.filter((q: any) => q.eq(q.field("env"), filters.env));
  }

  return builder;
};

const enrichFeedbackRecords = async (
  ctx: QueryCtx,
  records: Doc<"feedback">[],
) => {
  return Promise.all(
    records.map(async (record) => {
      const screenshotUrl = await ctx.storage.getUrl(record.screenshot);
      return {
        ...record,
        screenshotUrl,
      };
    }),
  );
};

/**
 * Generate a signed upload URL for screenshot storage.
 *
 * This mutation returns a URL that the client can use to upload a screenshot PNG.
 * The upload returns a storageId which should be passed to the submit mutation.
 *
 * @returns Upload URL string for posting the screenshot
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Submit feedback with screenshot and metadata.
 *
 * Creates a new feedback record linking the uploaded screenshot with:
 * - URL of the Storybook instance
 * - Story path (extracted from ?path=/story/... or #path=...)
 * - Optional note from the user
 * - Excalidraw overlay JSON (drawings/annotations)
 * - Screenshot storage ID
 * - User agent string
 * - Viewport dimensions
 *
 * @param url - Full URL of the Storybook page
 * @param path - Story path identifier (e.g., "button--primary")
 * @param note - Optional user-provided note
 * @param overlayJSON - Excalidraw JSON representation of drawings
 * @param screenshot - Convex storage ID of the uploaded screenshot
 * @param ua - User agent string
 * @param viewport - Browser viewport dimensions
 * @returns ID of the created feedback record
 */
export const submit = mutation({
  args: {
    url: v.string(),
    path: v.string(),
    note: v.optional(v.string()),
    overlayJSON: v.string(),
    screenshot: v.id("_storage"),
    ua: v.string(),
    viewport: v.object({
      width: v.number(),
      height: v.number(),
    }),
    // Universal widget fields (all optional for backward compatibility)
    route: v.optional(v.string()),
    releaseId: v.optional(v.string()),
    env: v.optional(v.string()),
    userHash: v.optional(v.string()),
    flags: v.optional(v.array(v.string())),
    project: v.optional(v.string()),
  },
  returns: v.id("feedback"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("feedback", {
      url: args.url,
      path: args.path,
      note: args.note,
      overlayJSON: args.overlayJSON,
      screenshot: args.screenshot,
      ua: args.ua,
      viewport: args.viewport,
      createdAt: now,
      route: args.route,
      releaseId: args.releaseId,
      env: args.env,
      userHash: args.userHash,
      flags: args.flags,
      project: args.project,
      status: "pending",
      updatedAt: now,
    });
  },
});

/**
 * List feedback records with screenshots.
 *
 * Retrieves feedback records optionally filtered by story path, ordered by creation time (newest first).
 * Returns signed URLs for screenshots via storage.getUrl() for direct access.
 *
 * @param path - Optional story path filter (e.g., "button--primary")
 * @param limit - Optional maximum number of records to return (default: 100)
 * @returns Array of feedback records with screenshotUrl field
 */
export const list = query({
  args: {
    path: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("feedback"),
      _creationTime: v.number(),
      url: v.string(),
      path: v.string(),
      note: v.optional(v.string()),
      overlayJSON: v.string(),
      screenshot: v.id("_storage"),
      screenshotUrl: v.union(v.string(), v.null()),
      ua: v.string(),
      viewport: v.object({
        width: v.number(),
        height: v.number(),
      }),
      createdAt: v.number(),
      // Universal widget fields
      route: v.optional(v.string()),
      releaseId: v.optional(v.string()),
      env: v.optional(v.string()),
      userHash: v.optional(v.string()),
      flags: v.optional(v.array(v.string())),
      project: v.optional(v.string()),
      // Status tracking fields
      status: v.optional(v.union(
        v.literal("pending"),
        v.literal("active"),
        v.literal("review"),
        v.literal("resolved"),
        v.literal("rejected")
      )),
      priority: v.optional(v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      )),
      assignedTo: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const limitValue = args.limit ?? 100;

    // Query feedback records with optional path filter
    let feedbackRecords: Doc<"feedback">[];

    if (args.path !== undefined) {
      // Use index when path is specified
      const pathValue: string = args.path;
      feedbackRecords = await ctx.db
        .query("feedback")
        .withIndex("by_path", (q) => q.eq("path", pathValue))
        .order("desc")
        .take(limitValue);
    } else {
      // Full table scan when no path specified
      feedbackRecords = await ctx.db.query("feedback").order("desc").take(limitValue);
    }

    // Enrich with screenshot URLs
    const enrichedRecords = await Promise.all(
      feedbackRecords.map(async (record) => {
        const screenshotUrl = await ctx.storage.getUrl(record.screenshot);
        return {
          ...record,
          screenshotUrl,
        };
      }),
    );

    return enrichedRecords;
  },
});

/**
 * Get aggregated counts by story path.
 *
 * Returns an array of all unique story paths with the count of feedback submissions
 * for each path. Useful for discovering which stories have feedback and prioritizing review.
 *
 * @returns Array of { path: string, count: number } objects
 */
export const pathsWithCounts = query({
  args: {},
  returns: v.array(
    v.object({
      path: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx) => {
    // Fetch all feedback records
    const allFeedback = await ctx.db.query("feedback").collect();

    // Group by path and count
    const pathCountMap = new Map<string, number>();

    for (const record of allFeedback) {
      const currentCount = pathCountMap.get(record.path) ?? 0;
      pathCountMap.set(record.path, currentCount + 1);
    }

    // Convert to array and sort by count descending
    const pathsWithCounts = Array.from(pathCountMap.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);

    return pathsWithCounts;
  },
});

/**
 * Update the status and metadata of a feedback record.
 *
 * This mutation allows updating the status, priority, assignment, and resolution
 * fields of existing feedback entries. Useful for triaging and tracking feedback
 * through its lifecycle.
 *
 * @param feedbackId - ID of the feedback record to update
 * @param status - New status value
 * @param priority - Optional priority level
 * @param assignedTo - Optional assignee name/email
 * @returns Null on success
 */
export const updateStatus = mutation({
  args: {
    feedbackId: v.id("feedback"),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("review"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    assignedTo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    const updates: Partial<Doc<"feedback">> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    // Set priority if provided
    if (args.priority !== undefined) {
      updates.priority = args.priority;
    }

    // Set assignedTo if provided
    if (args.assignedTo !== undefined) {
      updates.assignedTo = args.assignedTo;
    }

    // Set resolvedAt timestamp if status is resolved
    if (args.status === "resolved" && !feedback.resolvedAt) {
      updates.resolvedAt = Date.now();
    }

    await ctx.db.patch(args.feedbackId, updates);
    return null;
  },
});

/**
 * List feedback records filtered by optional status, project, route, and environment.
 *
 * Supports MCP tooling with server-side filtering to avoid client-side scans.
 */
export const listByFilters = query({
  args: {
    status: v.optional(statusFilterValidator),
    project: v.optional(v.string()),
    route: v.optional(v.string()),
    env: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(feedbackResponseValidator),
  handler: async (ctx, args) => {
    const limitValue = resolveLimit(args.limit);
    const filters: FeedbackFilters = {
      status: args.status ?? undefined,
      project: args.project ?? undefined,
      route: args.route ?? undefined,
      env: args.env ?? undefined,
    };

    const records = await buildFeedbackQuery(ctx, filters)
      .order("desc")
      .take(limitValue);

    return enrichFeedbackRecords(ctx, records);
  },
});

/**
 * List feedback records filtered by status.
 *
 * Retrieves feedback records filtered by status, ordered by creation time (newest first).
 * Returns signed URLs for screenshots via storage.getUrl() for direct access.
 *
 * @param status - Status filter (pending, review, resolved, rejected) plus legacy aliases
 * @param project - Optional project identifier filter
 * @param route - Optional route filter
 * @param env - Optional environment filter
 * @param limit - Optional maximum number of records to return (default: 100, max 500)
 * @returns Array of feedback records with screenshotUrl field
 */
export const listByStatus = query({
  args: {
    status: statusFilterValidator,
    project: v.optional(v.string()),
    route: v.optional(v.string()),
    env: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(feedbackResponseValidator),
  handler: async (ctx, args) => {
    // Status validated by statusFilterValidator - no normalization needed
    const limitValue = resolveLimit(args.limit);
    const filters: FeedbackFilters = {
      status: args.status as FeedbackStatus,
      project: args.project ?? undefined,
      route: args.route ?? undefined,
      env: args.env ?? undefined,
    };

    const records = await buildFeedbackQuery(ctx, filters)
      .order("desc")
      .take(limitValue);

    return enrichFeedbackRecords(ctx, records);
  },
});

/**
 * Get a single feedback record by ID.
 *
 * Retrieves a specific feedback record with its screenshot URL.
 *
 * @param feedbackId - ID of the feedback record to retrieve
 * @returns Feedback record with screenshotUrl field, or null if not found
 */
export const get = query({
  args: {
    feedbackId: v.id("feedback"),
  },
  returns: v.union(feedbackResponseValidator, v.null()),
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.feedbackId);

    if (!record) {
      return null;
    }

    const screenshotUrl = await ctx.storage.getUrl(record.screenshot);
    return {
      ...record,
      screenshotUrl,
    };
  },
});
