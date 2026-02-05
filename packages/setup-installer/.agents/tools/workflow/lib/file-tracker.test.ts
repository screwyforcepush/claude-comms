/**
 * Tests for file-based job tracking module
 *
 * Run with: npx tsx --test lib/file-tracker.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JobTracker } from "./file-tracker.js";

// ============================================================================
// JobTracker tests - the high-level API that matters
// ============================================================================

describe("JobTracker", () => {
  const TEST_ROOT = join(tmpdir(), "agent_jobs_test_" + Date.now());

  before(() => {
    process.env.AGENT_JOBS_ROOT = TEST_ROOT;
  });

  after(() => {
    delete process.env.AGENT_JOBS_ROOT;
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  });

  it("creates status.json with correct initial state", () => {
    const tracker = new JobTracker("init-test", "claude", 12345);
    const status = tracker.getStatus();

    assert.strictEqual(status.job_id, "init-test");
    assert.strictEqual(status.harness, "claude");
    assert.strictEqual(status.pid, 12345);
    assert.strictEqual(status.status, "running");
    assert.ok(status.logs?.endsWith("agent.log"));
  });

  it("records events with operations count and status reason", () => {
    const tracker = new JobTracker("events-test", "codex", 99999);

    tracker.recordEvent("assistant");
    tracker.recordEvent("tool_use");
    tracker.recordEvent();

    const status = tracker.getStatus();
    assert.strictEqual(status.operations, 3);
    assert.strictEqual(status.status_reason, "tool_use"); // last explicit
  });

  it("logs lines to agent.log", () => {
    const tracker = new JobTracker("log-test", "gemini", 11111);

    tracker.logLine('{"type":"init"}');
    tracker.logLine('{"type":"result"}');

    const content = readFileSync(tracker.getLogPath(), "utf-8");
    assert.ok(content.includes("init"));
    assert.ok(content.includes("result"));
  });

  it("marks complete/fail/timeout with end_time", () => {
    const t1 = new JobTracker("complete-test", "claude", 1);
    t1.complete("Done");
    assert.strictEqual(t1.getStatus().status, "complete");
    assert.ok(t1.getStatus().end_time);

    const t2 = new JobTracker("fail-test", "claude", 2);
    t2.fail("exit_1");
    assert.strictEqual(t2.getStatus().status, "error");
    assert.strictEqual(t2.getStatus().status_reason, "exit_1");

    const t3 = new JobTracker("timeout-test", "claude", 3);
    t3.timeout();
    assert.strictEqual(t3.getStatus().status, "timeout");
  });
});
