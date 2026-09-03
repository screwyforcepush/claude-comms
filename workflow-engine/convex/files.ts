import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePassword } from "./auth";

// One-off artifact hand-off (e.g. sideloadable APKs that are gitignored build
// outputs). Upload is password-gated; the returned download link is Convex's
// unguessable-but-public storage URL, so only share it for artifacts that
// carry no secrets.

export const generateUploadUrl = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getDownloadUrl = query({
  args: { password: v.string(), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.storage.getUrl(args.storageId);
  },
});
