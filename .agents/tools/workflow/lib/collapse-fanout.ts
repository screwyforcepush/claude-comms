/**
 * Collapse self-fanned fan-out duplicates.
 *
 * A PM is meant to hand a single review job the *complete* brief and let the
 * namespace config fan it out to its configured harnesses. The observed failure
 * mode is the PM doing the fan-out by hand — inserting one entry per reviewer in
 * a single batch — which either double-fans (each entry re-expands) or pins the
 * reviewers to specific harnesses and piecemeals the brief across them.
 *
 * This guard repairs that shape at insert time, before expansion:
 *   - Detect jobTypes whose namespace config is an array (a fan-out target)
 *     that appear MORE THAN ONCE in the same batch (the tripwire).
 *   - Collapse those occurrences to a single entry at the first occurrence's
 *     position, dropping the rest.
 *   - De-harness and de-model the collapsed entry so normal expansion produces
 *     exactly the configured canonical fan-out.
 *   - Reassemble the brief: concat the occurrences' distinct contexts (in batch
 *     order, exact-duplicates deduped) so no reviewer loses scope.
 *
 * Counts are on INPUT entries (what the PM typed), not post-expansion siblings.
 * A single `{ review }` that fans to three is never "more than once".
 *
 * Everything else passes through untouched: single reviews (fanned or pinned),
 * duplicated non-fan-out job types, and any well-formed batch.
 */

import { HarnessDefaults, resolveJobType } from "./harness-defaults.js";

export interface CollapsibleJob {
  jobType: string;
  harness?: "claude" | "codex" | "gemini";
  model?: string;
  context?: string;
}

export interface CollapseNotice {
  jobType: string;
  /** How many input entries collapsed into one. */
  from: number;
  /** Fan-out size the collapsed entry will expand back to. */
  to: number;
}

export interface CollapseResult<T extends CollapsibleJob> {
  jobs: T[];
  notices: CollapseNotice[];
}

const CONTEXT_SEPARATOR = "\n\n---\n\n";

export function collapseFanOutDuplicates<T extends CollapsibleJob>(
  defaults: HarnessDefaults,
  jobs: T[],
): CollapseResult<T> {
  // Count input occurrences per jobType.
  const counts = new Map<string, number>();
  for (const job of jobs) {
    counts.set(job.jobType, (counts.get(job.jobType) ?? 0) + 1);
  }

  // Tripwire: fan-out target (config is an array) AND appears more than once.
  const targets = new Set<string>();
  for (const [jobType, count] of counts) {
    if (count > 1 && Array.isArray(resolveJobType(defaults, jobType))) {
      targets.add(jobType);
    }
  }

  if (targets.size === 0) {
    return { jobs, notices: [] };
  }

  const result: T[] = [];
  const emitted = new Set<string>();
  const notices: CollapseNotice[] = [];

  for (const job of jobs) {
    if (!targets.has(job.jobType)) {
      result.push(job);
      continue;
    }
    if (emitted.has(job.jobType)) {
      // Collapsed entry already emitted at first occurrence — drop this dup.
      continue;
    }
    emitted.add(job.jobType);

    // Reassemble the brief from every occurrence of this jobType, in batch
    // order, keeping distinct contexts and deduping exact repeats.
    const contexts: string[] = [];
    for (const j of jobs) {
      if (j.jobType !== job.jobType) continue;
      const ctx = j.context?.trim();
      if (ctx && !contexts.includes(ctx)) contexts.push(ctx);
    }
    const mergedContext =
      contexts.length === 0 ? undefined : contexts.join(CONTEXT_SEPARATOR);

    // De-harness, de-model. Preserve/repair context. Force canonical fan-out.
    result.push({ jobType: job.jobType, context: mergedContext } as T);

    const config = resolveJobType(defaults, job.jobType);
    notices.push({
      jobType: job.jobType,
      from: counts.get(job.jobType)!,
      to: Array.isArray(config) ? config.length : 1,
    });
  }

  return { jobs: result, notices };
}
