/**
 * Tests for group finalization decision logic.
 *
 * Run with: npx tsx --test workflow-engine/convex/lib/group-transition.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveGroupTransition } from "./group-transition.js";

describe("resolveGroupTransition", () => {
  it("does not flip while any job is still running", () => {
    const t = resolveGroupTransition("running", ["failed", "failed", "running"]);
    assert.strictEqual(t.shouldFlip, false);
  });

  it("does not flip while any job awaits retry", () => {
    const t = resolveGroupTransition("running", ["complete", "awaiting_retry"]);
    assert.strictEqual(t.shouldFlip, false);
  });

  it("flips to failed when all jobs failed", () => {
    const t = resolveGroupTransition("running", ["failed", "failed", "failed"]);
    assert.deepStrictEqual(t, { shouldFlip: true, newStatus: "failed" });
  });

  it("flips to complete when mixed outcomes include a success", () => {
    const t = resolveGroupTransition("running", ["complete", "failed"]);
    assert.deepStrictEqual(t, { shouldFlip: true, newStatus: "complete" });
  });

  it("refuses to flip an already-terminal group (exactly-once token)", () => {
    assert.strictEqual(
      resolveGroupTransition("failed", ["failed", "failed"]).shouldFlip,
      false
    );
    assert.strictEqual(
      resolveGroupTransition("complete", ["complete", "complete"]).shouldFlip,
      false
    );
  });

  it("re-arms after a retry reset (group back to pending)", () => {
    const t = resolveGroupTransition("pending", ["complete", "complete"]);
    assert.deepStrictEqual(t, { shouldFlip: true, newStatus: "complete" });
  });
});
