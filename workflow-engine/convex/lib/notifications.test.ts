import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { post } from "../notifications.js";

const handler = (post as unknown as {
  _handler: (ctx: unknown, args: { password: string; threadId: string; body: string }) => Promise<unknown>;
})._handler;

function fixture(value?: string) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const reads: string[] = [];
  const ctx = {
    db: {
      get: async (id: string) => {
        reads.push(id);
        if (id === "thread") return { _id: "thread", namespaceId: "namespace", title: "Thread title" };
        if (id === "namespace") return { _id: "namespace", name: "Project" };
        return null;
      },
      query: (table: string) => {
        assert.equal(table, "settings");
        return {
          withIndex: (index: string, select: (q: { eq: (key: string, value: string) => void }) => void) => {
            assert.equal(index, "by_key");
            select({ eq: (key, settingKey) => {
              assert.equal(key, "key");
              assert.equal(settingKey, "audioNotifications");
            } });
            return { order: (direction: string) => {
              assert.equal(direction, "desc");
              return { first: async () => value === undefined ? null : { value } };
            } };
          },
        };
      },
      insert: async (table: string, row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return "notification";
      },
    },
  };
  return { ctx, inserts, reads };
}

describe("notifications.post cold handler", () => {
  let previousPassword: string | undefined;
  before(() => {
    previousPassword = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "test-password";
  });
  after(() => {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  });

  for (const [name, value] of [
    ["absent", undefined], ["false", "false"], ["malformed", "{oops"],
    ["string true", '"true"'], ["number", "1"], ["null", "null"],
  ] as const) {
    it(`returns null and inserts nothing when the toggle is ${name}`, async () => {
      const { ctx, inserts } = fixture(value);
      assert.equal(await handler(ctx, { password: "test-password", threadId: "thread", body: "Message" }), null);
      assert.deepEqual(inserts, []);
    });
  }

  for (const [name, body] of [
    ["empty", ""], ["whitespace", " \n\t "],
    ["markdown", "\n# Result\n```ts\nconst x = 1;\n```\n[link](https://example.com)\n "],
    ["exactly 5000", "x".repeat(5000)], ["over 5000", " x".repeat(3000)],
  ]) {
    it(`inserts one row with the exact slice for a ${name} body`, async () => {
      const { ctx, inserts } = fixture("true");
      const beforePost = Date.now();
      assert.equal(await handler(ctx, { password: "test-password", threadId: "thread", body }), "notification");
      assert.equal(inserts.length, 1);
      const { createdAt, ...fields } = inserts[0].row;
      assert.deepEqual({ table: inserts[0].table, row: fields }, {
        table: "notifications",
        row: { namespaceId: "namespace", threadId: "thread", title: "Project · Thread title", body: body.slice(0, 5000) },
      });
      assert.ok(typeof createdAt === "number" && createdAt >= beforePost && createdAt <= Date.now());
    });
  }

  it("rejects unauthorized requests before reading data", async () => {
    const { ctx, inserts, reads } = fixture("true");
    await assert.rejects(handler(ctx, { password: "wrong", threadId: "thread", body: "Message" }), /Unauthorized/);
    assert.deepEqual(reads, []);
    assert.deepEqual(inserts, []);
  });

  it("validates the thread even with the toggle off", async () => {
    const { ctx, inserts } = fixture("false");
    await assert.rejects(handler(ctx, { password: "test-password", threadId: "missing", body: "Message" }), /Thread not found/);
    assert.deepEqual(inserts, []);
  });
});
