import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  namespaces: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"]),

  assignments: defineTable({
    namespaceId: v.id("namespaces"),
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
    .index("by_namespace", ["namespaceId"])
    .index("by_namespace_status", ["namespaceId", "status"])
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

  chatThreads: defineTable({
    namespaceId: v.id("namespaces"),
    title: v.string(),
    mode: v.union(v.literal("jam"), v.literal("cook")),
    assignmentId: v.optional(v.id("assignments")),
    claudeSessionId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_namespace", ["namespaceId"])
    .index("by_namespace_updated", ["namespaceId", "updatedAt"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_thread_created", ["threadId", "createdAt"]),
});
