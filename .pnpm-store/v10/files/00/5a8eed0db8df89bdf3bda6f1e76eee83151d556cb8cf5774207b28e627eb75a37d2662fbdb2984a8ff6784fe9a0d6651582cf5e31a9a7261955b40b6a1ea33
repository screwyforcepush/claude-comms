import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Annotated Feedback - Standalone Convex Schema
 *
 * Isolated feedback collection schema supporting:
 * - Visual annotations via Excalidraw
 * - Screenshot storage
 * - Multi-project support
 * - Status workflow management
 */
export default defineSchema({
  feedback: defineTable({
    // Core fields
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
    createdAt: v.number(),

    // Universal widget fields (all optional for backward compatibility)
    route: v.optional(v.string()),        // App route (e.g., "/dashboard")
    releaseId: v.optional(v.string()),    // Git SHA or version tag
    env: v.optional(v.string()),          // Environment ("staging" | "dev" | "review")
    userHash: v.optional(v.string()),     // K-anonymized user identifier
    flags: v.optional(v.array(v.string())), // Active feature flags
    project: v.optional(v.string()),      // Project identifier

    // Status tracking fields (optional for backward compatibility)
    status: v.optional(v.union(
      v.literal("pending"),   // New feedback, awaiting action
      v.literal("active"),    // Currently being worked on
      v.literal("review"),    // Implemented/addressed, ready for UAT
      v.literal("resolved"),  // UAT approved
      v.literal("rejected")   // User rejected
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
  })
    .index("by_path", ["path"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_route", ["route"])
    .index("by_project", ["project"])
    .index("by_release", ["releaseId"])
    .index("by_env", ["env"]),
});
