import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MAX_FEED_LIMIT,
  composeNotificationBody,
  decodeNotificationFeedCursor,
  encodeNotificationFeedCursor,
  pageNotificationFeedRows,
} from "./notify-lib.js";

describe("composeNotificationBody", () => {
  it("ignores success telemetry hints", () => {
    assert.strictEqual(composeNotificationBody({ content: "Done.", hint: "Context Pressure: 72k" }), "Done.");
  });

  it("places a kill hint before a partial failure response", () => {
    assert.strictEqual(composeNotificationBody({ content: "Partial response", hint: "Killed by user.", failed: true }), "Killed by user.\n\nPartial response");
  });

  it("uses only the hint when a failure has no partial response", () => {
    assert.strictEqual(composeNotificationBody({ content: "", hint: "Agent stalled.", failed: true }), "Agent stalled.");
  });

  it("preserves successful markdown byte for byte", () => {
    const content = " \n# Result\n```ts\nconst x = 1;\n```\n[artifact](https://example.com)\n ";
    assert.strictEqual(composeNotificationBody({ content }), content);
  });

  it("does not truncate a 12k body in the runner", () => {
    const content = "x".repeat(12_000);
    assert.strictEqual(composeNotificationBody({ content }), content);
  });

  it("preserves empty success and whitespace in every branch", () => {
    assert.strictEqual(composeNotificationBody({ content: "", hint: "telemetry" }), "");
    assert.strictEqual(composeNotificationBody({ content: " \n\t " }), " \n\t ");
    assert.strictEqual(composeNotificationBody({ content: " \n", hint: " \t ", failed: true }), " \t \n\n \n");
  });

  it("preserves failure content when no hint is supplied", () => {
    assert.strictEqual(composeNotificationBody({ content: " partial \n", failed: true }), " partial \n");
    assert.strictEqual(composeNotificationBody({ content: " partial \n", hint: "", failed: true }), " partial \n");
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
