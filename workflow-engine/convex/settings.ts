import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requirePassword } from "./auth";

const AUDIO_NOTIFICATIONS_KEY = "audioNotifications";

function parseBooleanSetting(value: string): boolean {
  try {
    return JSON.parse(value) === true;
  } catch {
    return false;
  }
}

export async function readAudioNotifications(ctx: Pick<QueryCtx, "db">): Promise<boolean> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", AUDIO_NOTIFICATIONS_KEY))
    .order("desc")
    .first();

  return row ? parseBooleanSetting(row.value) : false;
}

export const getAudioNotifications = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);

    return await readAudioNotifications(ctx);
  },
});

export const setAudioNotifications = mutation({
  args: { password: v.string(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    requirePassword(args);

    const now = Date.now();
    const value = JSON.stringify(args.enabled);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", AUDIO_NOTIFICATIONS_KEY))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("settings", {
      key: AUDIO_NOTIFICATIONS_KEY,
      value,
      updatedAt: now,
    });
  },
});
