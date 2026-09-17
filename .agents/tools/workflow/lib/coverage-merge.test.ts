/**
 * Tests for the client-side reducers behind `cli.ts reflections coverage`.
 *
 * Run with: npx tsx --test .agents/tools/workflow/lib/coverage-merge.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { mergeCoverage, parseTimeArg, summarizeGaps } from "./coverage-merge.js";

describe("mergeCoverage", () => {
  it("sums batches and recomputes the rate from totals, not per-batch rates", () => {
    const totals = mergeCoverage([
      {
        terminalJobs: 10,
        reflectedJobs: 10,
        byHarness: { claude: { terminal: 10, reflected: 10 } },
      },
      {
        terminalJobs: 30,
        reflectedJobs: 0,
        byHarness: { claude: { terminal: 20, reflected: 0 }, codex: { terminal: 10, reflected: 0 } },
      },
    ]);
    assert.strictEqual(totals.terminalJobs, 40);
    assert.strictEqual(totals.reflectedJobs, 10);
    assert.strictEqual(totals.rate, 0.25);
    assert.deepStrictEqual(totals.byHarness, {
      claude: { terminal: 30, reflected: 10 },
      codex: { terminal: 10, reflected: 0 },
    });
    assert.strictEqual(totals.batches, 2);
  });

  it("returns a zero rate for an empty window instead of NaN", () => {
    const totals = mergeCoverage([]);
    assert.strictEqual(totals.terminalJobs, 0);
    assert.strictEqual(totals.rate, 0);
    assert.strictEqual(totals.batches, 0);
  });
});

describe("summarizeGaps", () => {
  it("counts gaps by skip reason and by job type", () => {
    const summary = summarizeGaps([
      { skipReason: "reflection_disabled", jobType: "review", harness: "claude" },
      { skipReason: "reflection_disabled", jobType: "pm", harness: "claude" },
      { skipReason: "reflection_missing", jobType: "review", harness: "codex" },
    ]);
    assert.strictEqual(summary.total, 3);
    assert.deepStrictEqual(summary.bySkipReason, { reflection_disabled: 2, reflection_missing: 1 });
    assert.deepStrictEqual(summary.byJobType, { review: 2, pm: 1 });
  });
});

describe("parseTimeArg", () => {
  it("accepts epoch milliseconds verbatim", () => {
    assert.strictEqual(parseTimeArg("1786060800000", "since"), 1786060800000);
  });

  it("accepts ISO dates", () => {
    assert.strictEqual(parseTimeArg("2026-08-07", "since"), Date.UTC(2026, 7, 7));
  });

  it("rejects garbage with the flag name in the message", () => {
    assert.throws(() => parseTimeArg("yesterday-ish", "until"), /--until/);
  });
});
