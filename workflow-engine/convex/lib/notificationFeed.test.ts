import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationTitle, postReadReceipt } from "./notificationFeed.js";

type Row = Record<string, unknown>;

function fixture(latest: Row | null, namespace: Row | null = { _id: "namespace", name: "Project" }) {
  const inserts: { table: string; row: Row }[] = [];
  const indexCalls: { index: string; threadId?: string; order?: string }[] = [];
  const ctx = {
    db: {
      get: async (id: string) => (id === "namespace" ? namespace : null),
      query: (table: string) => {
        assert.equal(table, "notifications");
        return {
          withIndex: (index: string, select: (q: { eq: (key: string, value: string) => void }) => void) => {
            const call: { index: string; threadId?: string; order?: string } = { index };
            select({ eq: (key, value) => {
              assert.equal(key, "threadId");
              call.threadId = value;
            } });
            indexCalls.push(call);
            return { order: (direction: string) => {
              call.order = direction;
              return { first: async () => latest };
            } };
          },
        };
      },
      insert: async (table: string, row: Row) => {
        inserts.push({ table, row });
        return "receipt";
      },
    },
  };
  return { ctx: ctx as unknown as Parameters<typeof postReadReceipt>[0], inserts, indexCalls };
}

const thread = {
  _id: "thread",
  namespaceId: "namespace",
  title: "Thread title",
} as unknown as Parameters<typeof postReadReceipt>[1];

describe("notificationTitle", () => {
  it("composes namespace · topic, falling back to the topic alone", () => {
    assert.equal(notificationTitle("Project", "Topic"), "Project · Topic");
    assert.equal(notificationTitle(undefined, "Topic"), "Topic");
  });
});

describe("postReadReceipt", () => {
  it("reads the newest feed row for the thread", async () => {
    const { ctx, indexCalls } = fixture(null);
    await postReadReceipt(ctx, thread);
    assert.deepEqual(indexCalls, [{ index: "by_thread", threadId: "thread", order: "desc" }]);
  });

  it("inserts nothing when the thread has never been notified", async () => {
    const { ctx, inserts } = fixture(null);
    assert.equal(await postReadReceipt(ctx, thread), null);
    assert.equal(inserts.length, 0);
  });

  it("inserts nothing when the newest row is already a read receipt", async () => {
    const { ctx, inserts } = fixture({ kind: "read" });
    assert.equal(await postReadReceipt(ctx, thread), null);
    assert.equal(inserts.length, 0);
  });

  it("posts one read receipt when the newest row is a message", async () => {
    const { ctx, inserts } = fixture({ body: "hello", deliveredAt: 5 });
    assert.equal(await postReadReceipt(ctx, thread), "receipt");
    assert.equal(inserts.length, 1);
    const { table, row } = inserts[0];
    assert.equal(table, "notifications");
    assert.equal(row.kind, "read");
    assert.equal(row.threadId, "thread");
    assert.equal(row.namespaceId, "namespace");
    assert.equal(row.title, "Project · Thread title");
    assert.equal(row.body, "");
    assert.equal(typeof row.createdAt, "number");
  });

  it("posts a receipt for an undelivered message so the shell can collapse the pair", async () => {
    const { ctx, inserts } = fixture({ body: "hello" });
    assert.equal(await postReadReceipt(ctx, thread), "receipt");
    assert.equal(inserts.length, 1);
  });
});
