import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Row presence wins, including an empty prompt; legacy is loaded only on a miss. */
export async function resolveJobPrompt(
  row: { prompt: string } | null,
  loadLegacy: () => Promise<string | undefined>,
): Promise<string | null> {
  if (row !== null) return row.prompt;
  return (await loadLegacy()) ?? null;
}

/**
 * Keep the job document out of the read set when a prompt row exists, so metric
 * ticks do not invalidate a prompt subscription. Callers holding the job can
 * supply its legacy prompt without another document read.
 * @see docs/project/spec/mental-model.md#mm-prompt-is-visibility-artefact
 */
export async function readJobPrompt(
  ctx: Pick<QueryCtx, "db">,
  jobId: Id<"jobs">,
  loadLegacy?: () => Promise<string | undefined>,
): Promise<string | null> {
  const row = await ctx.db
    .query("jobPrompts")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .first();
  return resolveJobPrompt(row, loadLegacy ?? (async () => (await ctx.db.get(jobId))?.prompt));
}

/** Insert or overwrite the prompt for this start; createdAt tracks this write. */
export async function upsertJobPrompt(
  ctx: Pick<MutationCtx, "db">,
  jobId: Id<"jobs">,
  prompt: string,
  now: number,
): Promise<void> {
  const row = await ctx.db
    .query("jobPrompts")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .first();
  if (row) {
    await ctx.db.patch(row._id, { prompt, createdAt: now });
  } else {
    await ctx.db.insert("jobPrompts", { jobId, prompt, createdAt: now });
  }
}

/** The single job-delete path: remove every prompt row before removing the job. */
export async function deleteJob(
  ctx: Pick<MutationCtx, "db">,
  jobId: Id<"jobs">,
): Promise<void> {
  const rows = await ctx.db
    .query("jobPrompts")
    .withIndex("by_job", (q) => q.eq("jobId", jobId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
  await ctx.db.delete(jobId);
}
