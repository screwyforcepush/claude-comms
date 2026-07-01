/**
 * Tests for fan-out duplicate collapse.
 *
 * Run with: npx tsx --test lib/collapse-fanout.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { collapseFanOutDuplicates, CollapsibleJob } from "./collapse-fanout.js";
import { HarnessDefaults } from "./harness-defaults.js";

const DEFAULTS: HarnessDefaults = {
  default: { harness: "claude" },
  implement: { harness: "claude" },
  review: [
    { harness: "claude" },
    { harness: "codex" },
    { harness: "gemini", model: "auto-gemini-3" },
  ],
  pm: { harness: "claude" },
};

describe("collapseFanOutDuplicates — tripwire arms", () => {
  it("collapses bare duplicate fan-out entries to a single de-harnessed entry", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "review" },
      { jobType: "review" },
      { jobType: "review" },
    ];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, [{ jobType: "review", context: undefined }]);
    assert.deepStrictEqual(notices, [{ jobType: "review", from: 3, to: 3 }]);
  });

  it("collapses hand-pinned per-harness entries and strips harness + model", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "review", harness: "claude" },
      { jobType: "review", harness: "codex" },
      { jobType: "review", harness: "gemini", model: "auto-gemini-3" },
    ];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, [{ jobType: "review", context: undefined }]);
    assert.strictEqual(out[0].harness, undefined);
    assert.strictEqual(out[0].model, undefined);
    assert.deepStrictEqual(notices, [{ jobType: "review", from: 3, to: 3 }]);
  });

  it("concats distinct piecemeal contexts in batch order", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "review", harness: "claude", context: "check the API" },
      { jobType: "review", harness: "codex", context: "check the UI" },
      { jobType: "review", harness: "gemini", context: "check the tests" },
    ];
    const { jobs: out } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(
      out[0].context,
      "check the API\n\n---\n\ncheck the UI\n\n---\n\ncheck the tests",
    );
  });

  it("dedupes identical contexts rather than repeating them", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "review", harness: "claude", context: "review the whole change" },
      { jobType: "review", harness: "codex", context: "review the whole change" },
    ];
    const { jobs: out } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.strictEqual(out[0].context, "review the whole change");
  });

  it("ignores empty/whitespace contexts when reassembling", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "review", context: "  " },
      { jobType: "review", context: "real brief" },
    ];
    const { jobs: out } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.strictEqual(out[0].context, "real brief");
  });

  it("preserves first-occurrence position among other job types", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "implement" },
      { jobType: "review", harness: "claude" },
      { jobType: "pm" },
      { jobType: "review", harness: "codex" },
    ];
    const { jobs: out } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out.map((j) => j.jobType), [
      "implement",
      "review",
      "pm",
    ]);
  });
});

describe("collapseFanOutDuplicates — dormant", () => {
  it("leaves a single bare fan-out entry untouched (healthy path)", () => {
    const jobs: CollapsibleJob[] = [{ jobType: "review" }];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.strictEqual(out, jobs); // same reference — no work done
    assert.deepStrictEqual(notices, []);
  });

  it("leaves a single hand-pinned review untouched", () => {
    const jobs: CollapsibleJob[] = [{ jobType: "review", harness: "claude" }];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, jobs);
    assert.deepStrictEqual(notices, []);
  });

  it("does not collapse duplicated non-fan-out job types", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "implement" },
      { jobType: "implement" },
    ];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, jobs);
    assert.deepStrictEqual(notices, []);
  });

  it("does not collapse duplicated types that resolve to default (single entry)", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "mystery" },
      { jobType: "mystery" },
    ];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, jobs);
    assert.deepStrictEqual(notices, []);
  });

  it("collapses only the offending fan-out type in a mixed batch", () => {
    const jobs: CollapsibleJob[] = [
      { jobType: "implement" },
      { jobType: "review", harness: "claude" },
      { jobType: "review", harness: "codex" },
    ];
    const { jobs: out, notices } = collapseFanOutDuplicates(DEFAULTS, jobs);
    assert.deepStrictEqual(out, [
      { jobType: "implement" },
      { jobType: "review", context: undefined },
    ]);
    assert.deepStrictEqual(notices, [{ jobType: "review", from: 2, to: 3 }]);
  });
});
