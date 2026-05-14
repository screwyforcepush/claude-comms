import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePassword } from "./auth";

const harnessValidator = v.union(
  v.literal("claude"),
  v.literal("codex"),
  v.literal("gemini")
);

const windowArgs = {
  since: v.optional(v.number()),
  until: v.optional(v.number()),
  last: v.optional(v.number()),
};

type Harness = "claude" | "codex" | "gemini";
type WindowMode =
  | { kind: "last"; count: number }
  | { kind: "range"; since: number; until: number };

const REFLECTABLE_HARNESSES = new Set<Harness>(["claude", "codex", "gemini"]);

function isTerminal(status: string): boolean {
  return status === "complete" || status === "failed";
}

function isReflectableHarness(harness: Harness): boolean {
  return REFLECTABLE_HARNESSES.has(harness);
}

function validateWindow(args: {
  since?: number;
  until?: number;
  last?: number;
}): WindowMode {
  if (args.last !== undefined && (args.since !== undefined || args.until !== undefined)) {
    throw new Error("Use either last or since/until, not both");
  }
  if (args.until !== undefined && args.since === undefined) {
    throw new Error("until requires since");
  }
  if (args.last !== undefined) {
    if (!Number.isInteger(args.last) || args.last <= 0) {
      throw new Error("last must be a positive integer");
    }
    return { kind: "last", count: Math.min(args.last, 1000) };
  }
  if (args.since !== undefined) {
    if (args.until !== undefined && args.until < args.since) {
      throw new Error("until must be greater than or equal to since");
    }
    return { kind: "range", since: args.since, until: args.until ?? Date.now() };
  }
  return { kind: "last", count: 100 };
}

function durationMs(job: Doc<"jobs">): number | undefined {
  if (job.startedAt === undefined || job.completedAt === undefined) return undefined;
  return Math.max(0, job.completedAt - job.startedAt);
}

async function getReflectedJobIds(
  ctx: { db: any },
  jobs: Array<Doc<"jobs">>
): Promise<Set<Id<"jobs">>> {
  const reflected = new Set<Id<"jobs">>();
  for (const job of jobs) {
    const row = await ctx.db
      .query("reflectionsV2")
      .withIndex("by_job", (q: any) => q.eq("jobId", job._id))
      .order("desc")
      .first();
    if (row) reflected.add(job._id);
  }
  return reflected;
}

async function selectTerminalJobs(
  ctx: { db: any },
  args: {
    namespaceId: Id<"namespaces">;
    jobType?: string;
    harness?: Harness;
    since?: number;
    until?: number;
    last?: number;
  }
): Promise<Array<Doc<"jobs">>> {
  const window = validateWindow(args);

  let queryBuilder: any;
  if (window.kind === "range") {
    queryBuilder = ctx.db
      .query("jobs")
      .withIndex("by_namespace_completedAt", (q: any) =>
        q
          .eq("namespaceId", args.namespaceId)
          .gte("completedAt", window.since)
          .lte("completedAt", window.until)
      );
  } else {
    queryBuilder = ctx.db
      .query("jobs")
      .withIndex("by_namespace_completedAt", (q: any) =>
        q.eq("namespaceId", args.namespaceId)
      )
      .order("desc");
  }

  queryBuilder = queryBuilder.filter((q: any) =>
    q.or(
      q.eq(q.field("status"), "complete"),
      q.eq(q.field("status"), "failed")
    )
  );
  if (args.harness !== undefined) {
    queryBuilder = queryBuilder.filter((q: any) =>
      q.eq(q.field("harness"), args.harness)
    );
  }
  if (args.jobType !== undefined) {
    queryBuilder = queryBuilder.filter((q: any) =>
      q.eq(q.field("jobType"), args.jobType)
    );
  }

  const jobs = window.kind === "last"
    ? await queryBuilder.take(window.count)
    : await queryBuilder.collect();

  return jobs.filter((job: Doc<"jobs">) =>
    job.namespaceId === args.namespaceId && isTerminal(job.status)
  );
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

export const insert = mutation({
  args: {
    password: v.string(),
    jobId: v.id("jobs"),
    sessionId: v.string(),
    namespaceId: v.id("namespaces"),
    harness: harnessValidator,
    jobType: v.string(),
    totalTokens: v.optional(v.number()),
    toolCallCount: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    narrative: v.string(),
    items: v.array(v.object({
      keywords: v.array(v.string()),
      painPoint: v.string(),
      suggestion: v.string(),
    })),
    rubric: v.record(v.string(), v.boolean()),
    reflectionCliVersion: v.string(),
    clientGitSha: v.optional(v.string()),
    engineGitSha: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (!isTerminal(job.status)) throw new Error("Job must be terminal");
    if (!job.namespaceId) throw new Error("Job is not reflection-integrated");
    if (!job.sessionId) throw new Error("Job has no sessionId");
    if (job.namespaceId !== args.namespaceId) throw new Error("namespaceId mismatch");
    if (job.sessionId !== args.sessionId) throw new Error("sessionId mismatch");
    if (job.harness !== args.harness) throw new Error("harness mismatch");
    if (job.jobType !== args.jobType) throw new Error("jobType mismatch");

    // Validate narrative
    if (!args.narrative.trim()) throw new Error("narrative must be non-empty");

    // Validate items
    if (args.items.length < 1) throw new Error("items must contain at least one entry");
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      if (item.keywords.length < 1) {
        throw new Error("items[" + i + "].keywords must have at least 1 entry");
      }
      for (let j = 0; j < item.keywords.length; j++) {
        if (!item.keywords[j].trim()) {
          throw new Error("items[" + i + "].keywords[" + j + "] must be non-empty");
        }
      }
      if (!item.painPoint.trim()) {
        throw new Error("items[" + i + "].painPoint must be non-empty");
      }
      if (!item.suggestion.trim()) {
        throw new Error("items[" + i + "].suggestion must be non-empty");
      }
    }

    // Derive top-level keywords from items
    const keywords = [...new Set(args.items.flatMap(i => i.keywords))];

    return await ctx.db.insert("reflectionsV2", {
      jobId: args.jobId,
      sessionId: job.sessionId,
      namespaceId: job.namespaceId,
      harness: job.harness,
      jobType: job.jobType,
      totalTokens: job.totalTokens,
      toolCallCount: job.toolCallCount,
      durationMs: durationMs(job),
      narrative: args.narrative,
      items: args.items,
      keywords,
      rubric: args.rubric,
      reflectionCliVersion: args.reflectionCliVersion,
      clientGitSha: args.clientGitSha,
      engineGitSha: args.engineGitSha,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});

export const byJob = query({
  args: { password: v.string(), jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    requirePassword(args);
    return await ctx.db
      .query("reflectionsV2")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .first();
  },
});

export const coverageRate = query({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces"),
    jobType: v.optional(v.string()),
    harness: v.optional(harnessValidator),
    ...windowArgs,
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const jobs = await selectTerminalJobs(ctx, args);
    const reflected = await getReflectedJobIds(ctx, jobs);

    const byHarness: Record<Harness, { terminal: number; reflected: number }> = {
      claude: { terminal: 0, reflected: 0 },
      codex: { terminal: 0, reflected: 0 },
      gemini: { terminal: 0, reflected: 0 },
    };

    for (const job of jobs) {
      byHarness[job.harness].terminal += 1;
      if (reflected.has(job._id)) {
        byHarness[job.harness].reflected += 1;
      }
    }

    const terminalJobs = jobs.length;
    const reflectedJobs = reflected.size;
    let eligibleTerminal = 0;
    let eligibleReflected = 0;
    for (const harness of Object.keys(byHarness) as Harness[]) {
      if (!isReflectableHarness(harness)) continue;
      eligibleTerminal += byHarness[harness].terminal;
      eligibleReflected += byHarness[harness].reflected;
    }

    return {
      terminalJobs,
      reflectedJobs,
      rate: terminalJobs === 0 ? 0 : reflectedJobs / terminalJobs,
      byHarness,
      eligibleCoverage: eligibleTerminal === 0 ? 0 : eligibleReflected / eligibleTerminal,
    };
  },
});

export const recent = query({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces"),
    jobType: v.optional(v.string()),
    harness: v.optional(harnessValidator),
    paginationOpts: v.optional(paginationOptsValidator),
    ...windowArgs,
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const window = validateWindow(args);

    let queryBuilder: any;
    if (args.harness !== undefined) {
      queryBuilder = ctx.db
        .query("reflectionsV2")
        .withIndex("by_namespace_harness_created", (q: any) => {
          let indexed = q.eq("namespaceId", args.namespaceId).eq("harness", args.harness);
          if (window.kind === "range") {
            indexed = indexed.gte("createdAt", window.since).lte("createdAt", window.until);
          }
          return indexed;
        });
    } else {
      queryBuilder = ctx.db
        .query("reflectionsV2")
        .withIndex("by_namespace_created", (q: any) => {
          let indexed = q.eq("namespaceId", args.namespaceId);
          if (window.kind === "range") {
            indexed = indexed.gte("createdAt", window.since).lte("createdAt", window.until);
          }
          return indexed;
        });
    }

    queryBuilder = queryBuilder.order("desc");
    if (args.jobType !== undefined) {
      queryBuilder = queryBuilder.filter((q: any) =>
        q.eq(q.field("jobType"), args.jobType)
      );
    }

    if (window.kind === "last") {
      const reflections = await queryBuilder.take(window.count);
      return { page: reflections, isDone: true, continueCursor: null };
    }

    return await queryBuilder.paginate(
      args.paginationOpts ?? { numItems: 50, cursor: null }
    );
  },
});

export const normalizeKeywords = mutation({
  args: {
    password: v.string(),
    mapping: v.record(v.string(), v.string()),
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const all = await ctx.db.query("reflectionsV2").collect();
    let scanned = 0;
    let updated = 0;
    for (const row of all) {
      scanned += 1;
      const newItems = row.items.map((item: { keywords: string[]; painPoint: string; suggestion: string }) => ({
        ...item,
        keywords: [...new Set(item.keywords.map((k: string) => args.mapping[k] ?? k))],
      }));
      const newTopLevel = [...new Set(newItems.flatMap((i: { keywords: string[] }) => i.keywords))];
      const before = JSON.stringify({
        top: [...row.keywords].sort(),
        items: row.items.map((i: { keywords: string[] }) => [...i.keywords].sort()),
      });
      const after = JSON.stringify({
        top: [...newTopLevel].sort(),
        items: newItems.map((i: { keywords: string[] }) => [...i.keywords].sort()),
      });
      if (before !== after) {
        await ctx.db.patch(row._id, { items: newItems, keywords: newTopLevel });
        updated += 1;
      }
    }
    return { scanned, updated };
  },
});

export const gaps = query({
  args: {
    password: v.string(),
    namespaceId: v.id("namespaces"),
    jobType: v.optional(v.string()),
    harness: v.optional(harnessValidator),
    ...windowArgs,
  },
  handler: async (ctx, args) => {
    requirePassword(args);
    const jobs = await selectTerminalJobs(ctx, args);
    const reflected = await getReflectedJobIds(ctx, jobs);

    return jobs
      .filter((job) => !reflected.has(job._id))
      .map((job) => {
        let skipReason: string;
        if (!isReflectableHarness(job.harness)) {
          skipReason = "unsupported_harness";
        } else if (!job.sessionId) {
          skipReason = "missing_session_id";
        } else {
          skipReason = "reflection_missing";
        }

        return {
          jobId: job._id,
          jobType: job.jobType,
          harness: job.harness,
          status: job.status,
          completedAt: job.completedAt,
          sessionIdPresent: Boolean(job.sessionId),
          skipReason,
          resultPreview: (job.result ?? "").slice(0, 240),
        };
      });
  },
});
