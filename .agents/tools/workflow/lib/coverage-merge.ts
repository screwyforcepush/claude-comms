/**
 * Client-side reducers for cursor-batched reflection coverage reads.
 *
 * `reflectionsV2.coverageRate` / `gaps` in since/until mode load every terminal
 * job doc in the window; on busy namespaces a multi-day window exceeds Convex's
 * per-execution read limit. The queries therefore page when given a cursor, and
 * the caller reduces the pages here. Rates are recomputed from summed counts so
 * a per-batch rate is never averaged.
 */

export interface HarnessCounts {
  terminal: number;
  reflected: number;
}

export interface CoverageBatch {
  terminalJobs: number;
  reflectedJobs: number;
  byHarness: Record<string, HarnessCounts>;
}

export interface CoverageTotals extends CoverageBatch {
  rate: number;
  batches: number;
}

export function mergeCoverage(batches: CoverageBatch[]): CoverageTotals {
  const byHarness: Record<string, HarnessCounts> = {};
  let terminalJobs = 0;
  let reflectedJobs = 0;
  for (const batch of batches) {
    terminalJobs += batch.terminalJobs;
    reflectedJobs += batch.reflectedJobs;
    for (const [harness, counts] of Object.entries(batch.byHarness ?? {})) {
      const slot = byHarness[harness] ?? { terminal: 0, reflected: 0 };
      slot.terminal += counts.terminal;
      slot.reflected += counts.reflected;
      byHarness[harness] = slot;
    }
  }
  return {
    terminalJobs,
    reflectedJobs,
    rate: terminalJobs === 0 ? 0 : reflectedJobs / terminalJobs,
    byHarness,
    batches: batches.length,
  };
}

export interface GapRow {
  skipReason: string;
  jobType: string;
  harness: string;
}

export interface GapSummary {
  total: number;
  bySkipReason: Record<string, number>;
  byJobType: Record<string, number>;
}

export function summarizeGaps(gaps: GapRow[]): GapSummary {
  const bySkipReason: Record<string, number> = {};
  const byJobType: Record<string, number> = {};
  for (const gap of gaps) {
    bySkipReason[gap.skipReason] = (bySkipReason[gap.skipReason] ?? 0) + 1;
    byJobType[gap.jobType] = (byJobType[gap.jobType] ?? 0) + 1;
  }
  return { total: gaps.length, bySkipReason, byJobType };
}

/** Parse `--since` / `--until` values: epoch milliseconds or anything Date can parse. */
export function parseTimeArg(value: string, name: string): number {
  if (/^\d{10,}$/.test(value)) return Number(value);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`--${name} must be epoch milliseconds or an ISO date, got "${value}"`);
  }
  return parsed;
}
