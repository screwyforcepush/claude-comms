/**
 * Tests for the headless Claude runtime levers.
 *
 * Run with: npx tsx --test lib/claude-runtime.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BASH_CEILING_IDLE_MARGIN_MS,
  buildClaudeHeadlessEnv,
  resolveClaudeBashTimeoutMs,
} from "./claude-runtime.js";

describe("buildClaudeHeadlessEnv", () => {
  it("always removes the affordances a headless run cannot honour", () => {
    const env = buildClaudeHeadlessEnv();
    assert.deepStrictEqual(env, {
      CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1",
      CLAUDE_CODE_DISABLE_CRON: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      CLAUDE_CODE_DISABLE_TERMINAL_TITLE: "1",
    });
  });

  it("emits the Bash ceiling as both default and max from one number", () => {
    const env = buildClaudeHeadlessEnv({ bashTimeoutMs: 840_000 });
    assert.strictEqual(env.BASH_DEFAULT_TIMEOUT_MS, "840000");
    assert.strictEqual(env.BASH_MAX_TIMEOUT_MS, "840000");
    assert.ok(!("CLAUDE_CODE_RETRY_WATCHDOG" in env));
  });

  it("enables the retry watchdog only when a bound is given (crew, not chat)", () => {
    const crew = buildClaudeHeadlessEnv({ retryWatchdogMaxWaitMs: 900_000 });
    assert.strictEqual(crew.CLAUDE_CODE_RETRY_WATCHDOG, "1");
    assert.strictEqual(crew.CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS, "900000");

    const chat = buildClaudeHeadlessEnv({ bashTimeoutMs: 840_000 });
    assert.ok(!("CLAUDE_CODE_RETRY_WATCHDOG" in chat));
    assert.ok(!("CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS" in chat));
  });

  it("never touches the auto-memory switch; that stays the caller's", () => {
    const env = buildClaudeHeadlessEnv({ bashTimeoutMs: 1, retryWatchdogMaxWaitMs: 1 });
    assert.ok(!("CLAUDE_CODE_DISABLE_AUTO_MEMORY" in env));
  });
});

describe("resolveClaudeBashTimeoutMs", () => {
  it("accepts an explicit ceiling below the idle timer", () => {
    assert.strictEqual(
      resolveClaudeBashTimeoutMs({ idleTimeoutMs: 900_000, claudeBashTimeoutMs: 840_000 }),
      840_000
    );
  });

  it("refuses an explicit ceiling at or above the idle timer", () => {
    assert.throws(
      () => resolveClaudeBashTimeoutMs({ idleTimeoutMs: 900_000, claudeBashTimeoutMs: 900_000 }),
      /must be below idleTimeoutMs/
    );
    assert.throws(
      () => resolveClaudeBashTimeoutMs({ idleTimeoutMs: 600_000, claudeBashTimeoutMs: 840_000 }),
      /must be below idleTimeoutMs/
    );
  });

  it("refuses a non-positive explicit ceiling", () => {
    assert.throws(() => resolveClaudeBashTimeoutMs({ claudeBashTimeoutMs: 0 }), /positive/);
  });

  it("derives idle minus the margin when no ceiling is configured", () => {
    assert.strictEqual(
      resolveClaudeBashTimeoutMs({ idleTimeoutMs: 600_000 }),
      600_000 - BASH_CEILING_IDLE_MARGIN_MS
    );
  });

  it("leaves the harness defaults when neither is configured or idle is too small to derive from", () => {
    assert.strictEqual(resolveClaudeBashTimeoutMs({}), undefined);
    assert.strictEqual(resolveClaudeBashTimeoutMs({ idleTimeoutMs: BASH_CEILING_IDLE_MARGIN_MS }), undefined);
  });

  it("accepts an explicit ceiling with no idle timer configured", () => {
    assert.strictEqual(resolveClaudeBashTimeoutMs({ claudeBashTimeoutMs: 840_000 }), 840_000);
  });
});
