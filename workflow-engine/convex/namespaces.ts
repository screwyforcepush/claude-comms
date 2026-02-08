import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePassword } from "./auth";

// Queries

export const list = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db
      .query("namespaces")
      .order("asc")
      .collect();
  },
});

export const get = query({
  args: { password: v.string(), id: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db.get(args.id);
  },
});

export const getByName = query({
  args: { password: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db
      .query("namespaces")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

// Mutations

export const create = mutation({
  args: {
    password: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    // Check if namespace already exists
    const existing = await ctx.db
      .query("namespaces")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      return existing._id; // Return existing ID instead of creating duplicate
    }

    const now = Date.now();
    return await ctx.db.insert("namespaces", {
      name: args.name,
      description: args.description,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    password: v.string(),
    id: v.id("namespaces"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const { id, password, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { password: v.string(), id: v.id("namespaces") },
  handler: async (ctx, args) => {
    requirePassword(args);
    // Note: This doesn't cascade delete - caller should handle that
    await ctx.db.delete(args.id);
  },
});
