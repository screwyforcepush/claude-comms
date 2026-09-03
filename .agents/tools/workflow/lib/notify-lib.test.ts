import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MAX_BODY_CHARS,
  MAX_FEED_LIMIT,
  decodeNotificationFeedCursor,
  encodeNotificationFeedCursor,
  pageNotificationFeedRows,
  prepareBody,
  shouldNotify,
} from "./notify-lib.js";

describe("shouldNotify", () => {
  it("allows jam and cook Claude chat responses", () => {
    assert.strictEqual(
      shouldNotify({ sessionId: "session_123", harness: "claude", mode: "jam" }),
      true
    );
    assert.strictEqual(
      shouldNotify({ sessionId: "session_123", harness: "claude", mode: "cook" }),
      true
    );
  });

  it("allows completion summaries in jam or cook mode", () => {
    assert.strictEqual(
      shouldNotify({
        sessionId: "session_123",
        harness: "claude",
        mode: "jam",
        isCompletionSummary: true,
      }),
      true
    );
    assert.strictEqual(
      shouldNotify({
        sessionId: "session_123",
        harness: "claude",
        mode: "cook",
        isCompletionSummary: true,
      }),
      true
    );
  });

  it("gates guardian mode, missing session ids, and non-Claude harnesses", () => {
    assert.strictEqual(
      shouldNotify({ sessionId: "session_123", harness: "claude", mode: "guardian" }),
      false
    );
    assert.strictEqual(
      shouldNotify({ sessionId: undefined, harness: "claude", mode: "jam" }),
      false
    );
    assert.strictEqual(
      shouldNotify({ sessionId: "session_123", harness: "codex", mode: "jam" }),
      false
    );
  });
});

describe("prepareBody", () => {
  it("trims surrounding whitespace", () => {
    assert.deepStrictEqual(prepareBody("\n  Listen to this.  \t"), {
      ok: true,
      body: "Listen to this.",
      truncated: false,
    });
  });

  it("rejects empty and whitespace-only bodies", () => {
    assert.deepStrictEqual(prepareBody(" \n\t "), {
      ok: false,
      error: "body is empty",
    });
  });

  it("leaves an exactly 5000 character body untouched", () => {
    const body = "x".repeat(MAX_BODY_CHARS);

    assert.deepStrictEqual(prepareBody(body), {
      ok: true,
      body,
      truncated: false,
    });
  });

  it("truncates a 5001 character body to the notification cap", () => {
    const result = prepareBody("x".repeat(MAX_BODY_CHARS + 1));

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.truncated, true);
    assert.strictEqual(result.body.length, MAX_BODY_CHARS);
  });
});

describe("notification feed cursor helpers", () => {
  const rows = [
    { _id: "n1", _creationTime: 100, createdAt: 10 },
    { _id: "n2", _creationTime: 200, createdAt: 20 },
    { _id: "n3", _creationTime: 300, createdAt: 20 },
    { _id: "n4", _creationTime: 400, createdAt: 30 },
  ];

  it("starts from the beginning when cursor is empty or undefined", () => {
    assert.deepStrictEqual(
      pageNotificationFeedRows(rows, { limit: 2 }).rows.map((row) => row._id),
      ["n1", "n2"]
    );
    assert.deepStrictEqual(
      pageNotificationFeedRows(rows, { cursor: null, limit: 2 }).rows.map((row) => row._id),
      ["n1", "n2"]
    );
  });

  it("round-trips the numeric _creationTime cursor", () => {
    const cursor = encodeNotificationFeedCursor(rows[1]);

    assert.strictEqual(cursor, 200);
    assert.strictEqual(decodeNotificationFeedCursor(cursor), 200);
  });

  it("does not drop rows when createdAt collides across a page boundary", () => {
    const first = pageNotificationFeedRows(rows, { limit: 2 });
    const second = pageNotificationFeedRows(rows, {
      cursor: first.nextCursor,
      limit: 2,
    });

    assert.deepStrictEqual(first.rows.map((row) => row._id), ["n1", "n2"]);
    assert.deepStrictEqual(first.rows.map((row) => row.createdAt), [10, 20]);
    assert.deepStrictEqual(second.rows.map((row) => row._id), ["n3", "n4"]);
    assert.deepStrictEqual(second.rows.map((row) => row.createdAt), [20, 30]);
  });

  it("caps requested feed limits at the authoritative live feed maximum", () => {
    const manyRows = Array.from({ length: 250 }, (_, index) => ({
      _id: `n${index}`,
      _creationTime: index + 1,
    }));

    assert.strictEqual(MAX_FEED_LIMIT, 200);
    assert.strictEqual(
      pageNotificationFeedRows(manyRows, { limit: 1000 }).rows.length,
      200
    );
  });
});
