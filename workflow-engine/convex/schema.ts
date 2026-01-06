import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  assignments: defineTable({
    namespace: v.string(),
    northStar: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("blocked"),
      v.literal("complete")
    ),
    blockedReason: v.optional(v.string()),
    independent: v.boolean(),
    priority: v.number(),
    artifacts: v.string(),
    decisions: v.string(),
    headJobId: v.optional(v.id("jobs")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_namespace", ["namespace"])
    .index("by_namespace_status", ["namespace", "status"])
    .index("by_status", ["status"]),

  jobs: defineTable({
    assignmentId: v.id("assignments"),
    jobType: v.string(),
    harness: v.union(
      v.literal("claude"),
      v.literal("codex"),
      v.literal("gemini")
    ),
    context: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("failed")
    ),
    result: v.optional(v.string()),
    nextJobId: v.optional(v.id("jobs")),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_status", ["status"])
    .index("by_assignment_status", ["assignmentId", "status"]),
});
