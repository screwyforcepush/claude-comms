import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_MESSAGE_LENGTH = 20000;

function normalizePosition(position: number | undefined): number {
  if (position === undefined) return 0;
  if (!Number.isFinite(position) || position < 0) {
    throw new Error("after must be a non-negative number");
  }
  return Math.floor(position);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("limit must be a positive number");
  }
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function normalizeGroupId(groupId: string): string {
  const trimmed = groupId.trim();
  if (!trimmed) {
    throw new Error("groupId is required");
  }
  return trimmed;
}

function normalizeInstance(instance: string | undefined): string | undefined {
  const trimmed = instance?.trim();
  return trimmed || undefined;
}

function normalizeMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("message is required");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`message must be ${MAX_MESSAGE_LENGTH} characters or less`);
  }
  return trimmed;
}

async function getUnread(
  ctx: QueryCtx | MutationCtx,
  groupId: string,
  after: number,
  limit: number,
  instance: string | undefined
) {
  const scanned = await ctx.db
    .query("agentComms")
    .withIndex("by_group_position", (q) =>
      q.eq("groupId", groupId).gt("position", after)
    )
    .order("asc")
    .take(limit);

  return {
    scannedThrough:
      scanned.length > 0 ? scanned[scanned.length - 1].position : after,
    messages: scanned.filter((message) => message.instance !== instance),
  };
}

async function getLatestPosition(
  ctx: QueryCtx | MutationCtx,
  groupId: string
): Promise<number> {
  const latest = await ctx.db
    .query("agentComms")
    .withIndex("by_group_position", (q) => q.eq("groupId", groupId))
    .order("desc")
    .first();
  return latest?.position ?? 0;
}

export const read = query({
  args: {
    groupId: v.string(),
    instance: v.optional(v.string()),
    after: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const groupId = normalizeGroupId(args.groupId);
    const instance = normalizeInstance(args.instance);
    const after = normalizePosition(args.after);
    const limit = normalizeLimit(args.limit);
    const { messages, scannedThrough } = await getUnread(
      ctx,
      groupId,
      after,
      limit,
      instance
    );

    return {
      groupId,
      position: scannedThrough,
      messages: messages.map((message) => ({
        position: message.position,
        instance: message.instance,
        message: message.message,
        createdAt: message.createdAt,
      })),
    };
  },
});

export const send = mutation({
  args: {
    groupId: v.string(),
    instance: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const groupId = normalizeGroupId(args.groupId);
    const instance = normalizeInstance(args.instance);
    const text = normalizeMessage(args.message);

    const previousPosition = await getLatestPosition(ctx, groupId);
    const position = previousPosition + 1;
    const createdAt = Date.now();

    await ctx.db.insert("agentComms", {
      groupId,
      position,
      ...(instance ? { instance } : {}),
      message: text,
      createdAt,
    });

    return {
      groupId,
      position,
      sent: {
        position,
        ...(instance ? { instance } : {}),
        message: text,
        createdAt,
      },
    };
  },
});
