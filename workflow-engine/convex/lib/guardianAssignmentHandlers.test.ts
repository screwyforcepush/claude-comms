import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as assignments from "../assignments.js";
import { trigger } from "../chatJobs.js";
import { getCompletionThread, getGuardianThread } from "../chatThreads.js";

const password = "guardian-cold-test-password";
const previousPassword = process.env.ADMIN_PASSWORD;
before(() => { process.env.ADMIN_PASSWORD = password; });
after(() => {
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
});

type Row = { _id: string; [key: string]: any };
// Convex exposes _handler at runtime but omits it from registered function types.
// Cast only this test boundary; call the real handler directly.
type ColdHandler = { _handler: (ctx: any, args: any) => Promise<any> };
const completeAssignment = (assignments.complete as unknown as ColdHandler)._handler;
const completionThread = (getCompletionThread as unknown as ColdHandler)._handler;
const guardianThread = (getGuardianThread as unknown as ColdHandler)._handler;
const triggerChatJob = (trigger as unknown as ColdHandler)._handler;

// The fake implements database operations only; production _handlers own all decisions.
function database(seed: Readonly<Record<string, readonly Row[]>> = {}) {
  const tables = structuredClone(seed);
  const reads: string[] = [];
  const queries: { table: string; index?: string; equals: [string, unknown][] }[] = [];
  const patches: { id: string; value: Record<string, unknown> }[] = [];
  const inserts: { table: string; value: Record<string, any> }[] = [];
  const ctx = {
    db: {
      async get(id: string) {
        reads.push(id);
        return structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null);
      },
      async patch(id: string, value: Record<string, unknown>) {
        patches.push({ id, value: structuredClone(value) });
        const row = Object.values(tables).flat().find(row => row._id === id);
        if (!row) throw new Error("Cannot patch missing row");
        Object.assign(row, value);
      },
      async insert(table: string, value: Record<string, any>) {
        inserts.push({ table, value: structuredClone(value) });
        return "new-chat-job";
      },
      query(table: string) {
        const call: typeof queries[number] = { table, equals: [] };
        queries.push(call);
        let predicates: ((row: Row) => boolean)[] = [];
        const expression = {
          field: (name: string) => (row: Row) => row[name],
          eq: (field: (row: Row) => unknown, value: unknown) => (row: Row) => field(row) === value,
          or: (...parts: ((row: Row) => boolean)[]) => (row: Row) => parts.some(part => part(row)),
        };
        const query = {
          withIndex(index: string, build: (q: any) => unknown) {
            call.index = index;
            const range = { eq(field: string, value: unknown) { call.equals.push([field, value]); return range; } };
            build(range);
            return query;
          },
          filter(build: (q: typeof expression) => (row: Row) => boolean) {
            predicates.push(build(expression));
            return query;
          },
          async collect() {
            return structuredClone((tables[table] ?? []).filter(row =>
              call.equals.every(([field, value]) => row[field] === value) && predicates.every(predicate => predicate(row))));
          },
          async first() { return (await query.collect())[0] ?? null; },
        };
        return query;
      },
    },
  };
  return { ctx: ctx as any, tables, reads, queries, patches, inserts };
}

function chainHandler() {
  const handler = (assignments as any).getChainShape?._handler;
  assert.equal(typeof handler, "function", "getChainShape must be a registered Convex query");
  return handler;
}

describe("assignments.getChainShape cold handler", () => {
  it("walks links despite creation order, preserves job order, and returns only ids/types", async () => {
    const db = database({
      assignments: [{ _id: "a", headGroupId: "head", northStar: "private" }],
      jobGroups: [
        { _id: "head", createdAt: 1, nextGroupId: "inserted", status: "complete", aggregatedResult: "large" },
        { _id: "successor", createdAt: 2, status: "pending" },
        { _id: "inserted", createdAt: 3, nextGroupId: "successor", status: "running" },
        { _id: "unlinked", createdAt: 4 },
      ],
      jobs: [
        { _id: "j1", groupId: "head", jobType: "plan", result: "large" },
        { _id: "j2", groupId: "inserted", jobType: "document", status: "pending" },
        { _id: "j3", groupId: "inserted", jobType: "review", status: "running" },
        { _id: "j4", groupId: "successor", jobType: "pm" },
        { _id: "other", groupId: "unlinked", jobType: "implement" },
      ],
    });
    assert.deepEqual(await chainHandler()(db.ctx, { password, id: "a" }), [
      { _id: "head", jobTypes: ["plan"] },
      { _id: "inserted", jobTypes: ["document", "review"] },
      { _id: "successor", jobTypes: ["pm"] },
    ]);
    assert.deepEqual(db.reads, ["a", "head", "inserted", "successor"]);
    assert.deepEqual(db.queries, ["head", "inserted", "successor"].map(id => ({
      table: "jobs", index: "by_group", equals: [["groupId", id]],
    })));
  });

  it("stops before revisiting a cycle and includes empty job groups", async () => {
    const db = database({ assignments: [{ _id: "a", headGroupId: "g1" }], jobGroups: [
      { _id: "g1", nextGroupId: "g2" }, { _id: "g2", nextGroupId: "g1" },
    ] });
    assert.deepEqual(await chainHandler()(db.ctx, { password, id: "a" }), [
      { _id: "g1", jobTypes: [] }, { _id: "g2", jobTypes: [] },
    ]);
    assert.deepEqual(db.reads, ["a", "g1", "g2"]);
  });

  for (const [label, seed] of [
    ["missing assignment", {}],
    ["headless assignment", { assignments: [{ _id: "a" }] }],
    ["missing head", { assignments: [{ _id: "a", headGroupId: "gone" }] }],
  ] as const) {
    it(`returns an empty shape for ${label}`, async () => {
      const db = database(seed);
      assert.deepEqual(await chainHandler()(db.ctx, { password, id: "a" }), []);
      assert.deepEqual(db.queries, []);
    });
  }

  it("returns the existing prefix when a later link is missing", async () => {
    const db = database({ assignments: [{ _id: "a", headGroupId: "g" }], jobGroups: [{ _id: "g", nextGroupId: "gone" }] });
    assert.deepEqual(await chainHandler()(db.ctx, { password, id: "a" }), [{ _id: "g", jobTypes: [] }]);
    assert.equal(db.queries.length, 1);
  });

  it("rejects unauthorized reads before accessing the database", async () => {
    const db = database();
    await assert.rejects(() => chainHandler()(db.ctx, { password: "wrong", id: "a" }), /Unauthorized/);
    assert.deepEqual(db.reads, []);
  });
});

describe("assignments.complete cold handler", () => {
  const counts = { pending: 2, active: 3, blocked: 1, complete: 4 };
  for (const status of ["blocked", "active", "pending", "complete"] as const) {
    it(`${status}: returns the outcome and preserves the correct count/timestamp behavior`, async () => {
      const assignment = { _id: "a", namespaceId: "ns", status, updatedAt: 1, blockedReason: "user decision" };
      const db = database({ assignments: [assignment], namespaces: [{ _id: "ns", assignmentCounts: counts }] });
      const result = await completeAssignment(db.ctx, { password, id: "a" as any });
      if (status === "blocked") {
        assert.deepEqual(result, { completed: false, status: "blocked" });
        assert.deepEqual(db.tables.assignments, [assignment]);
        assert.deepEqual(db.tables.namespaces[0].assignmentCounts, counts);
        assert.deepEqual(db.patches, []);
        assert.deepEqual(db.reads, ["a"]);
      } else {
        assert.deepEqual(result, { completed: true });
        assert.equal(db.tables.assignments[0].status, "complete");
        assert.ok(db.tables.assignments[0].updatedAt > 1);
        const expected = { ...counts };
        if (status !== "complete") { expected[status]--; expected.complete++; }
        assert.deepEqual(db.tables.namespaces[0].assignmentCounts, expected);
        assert.equal(db.patches.filter(p => p.id === "ns").length, status === "complete" ? 0 : 1);
        assert.equal(db.patches.filter(p => p.id === "a").length, 1);
        if (status === "complete") assert.deepEqual(db.reads, ["a"]);
      }
    });
  }

  it("returns missing without attempting any patch or count adjustment", async () => {
    const db = database();
    assert.deepEqual(await completeAssignment(db.ctx, { password, id: "gone" as any }), { completed: false, status: null });
    assert.deepEqual(db.reads, ["gone"]);
    assert.deepEqual(db.patches, []);
  });

  it("rejects unauthorized completion before any reads or writes", async () => {
    const db = database();
    await assert.rejects(() => completeAssignment(db.ctx, { password: "wrong", id: "a" as any }), /Unauthorized/);
    assert.deepEqual(db.reads, []);
    assert.deepEqual(db.patches, []);
  });
});

describe("guardian completion-thread lookup cold handlers", () => {
  for (const mode of ["jam", "cook"]) {
    it(`prefers guardian even when ${mode} comes first, using one indexed lookup`, async () => {
      const guardian = { _id: "guardian", assignmentId: "a", mode: "guardian" };
      const db = database({ chatThreads: [
        { _id: "wrong-assignment", assignmentId: "other", mode: "guardian" },
        { _id: "ordinary", assignmentId: "a", mode }, guardian,
      ] });
      assert.deepEqual(await completionThread(db.ctx, { password, assignmentId: "a" as any }), guardian);
      assert.deepEqual(db.queries, [{ table: "chatThreads", index: "by_assignment", equals: [["assignmentId", "a"]] }]);
    });

    it(`falls back to ${mode} at completion and has no checkpoint guardian`, async () => {
      const thread = { _id: "ordinary", assignmentId: "a", mode };
      const db = database({ chatThreads: [thread] });
      assert.deepEqual(await completionThread(db.ctx, { password, assignmentId: "a" as any }), thread);
      assert.equal(await guardianThread(db.ctx, { password, assignmentId: "a" as any }), null);
    });
  }

  it("returns null when no eligible linked thread exists", async () => {
    const db = database({ chatThreads: [{ _id: "other", assignmentId: "other", mode: "guardian" }] });
    assert.equal(await completionThread(db.ctx, { password, assignmentId: "a" as any }), null);
  });
});

describe("chatJobs.trigger guardian context cold handler", () => {
  const checkpoint = { round: 2, completionReviews: 6, chainShape: "P M R+R+R+D M" };
  const scenarios = [
    { name: "existing assignment fork", thread: { claudeSessionId: "og", guardianSessions: { a: "fork", other: "unrelated" } }, session: "fork", fork: false },
    { name: "first fork", thread: { claudeSessionId: "og", guardianSessions: { other: "unrelated" } }, session: "og", fork: true },
    { name: "no sessions", thread: {}, session: undefined, fork: false },
  ];
  for (const scenario of scenarios) {
    for (const completion of [false, true]) {
      it(`stores ${completion ? "completion" : "checkpoint"} context with ${scenario.name}`, async () => {
        const thread = { _id: "thread", namespaceId: "ns", assignmentId: "a", mode: "guardian", lastPromptMode: "cook", ...scenario.thread };
        const db = database({ chatThreads: [thread], chatMessages: [{ _id: "message", content: "PM report" }] });
        const args = { password, threadId: "thread", triggerMessageId: "message", harness: "claude", model: "test-model",
          ...(completion ? { isCompletionSummary: true } : { isGuardianEvaluation: true, checkpoint }) };
        assert.deepEqual(await triggerChatJob(db.ctx, args as any), { jobId: "new-chat-job", mode: "guardian" });
        assert.equal(db.inserts.length, 1);
        const row = db.inserts[0];
        assert.equal(row.table, "chatJobs");
        assert.equal(row.value.status, "pending");
        assert.equal(row.value.model, "test-model");
        assert.deepEqual(JSON.parse(row.value.context), {
          threadId: "thread", namespaceId: "ns", mode: "guardian", effectivePromptMode: "cook", lastPromptMode: "cook",
          latestUserMessage: "PM report", ...(scenario.session ? { claudeSessionId: scenario.session } : {}),
          forkSession: scenario.fork, assignmentId: "a", isGuardianEvaluation: !completion, isCompletionSummary: completion, isBlockAssessment: false,
          ...(!completion ? { checkpoint } : {}),
        });
        assert.deepEqual(db.tables.chatThreads, [thread]);
        assert.deepEqual(db.patches, []);
      });
    }
  }

  for (const mode of ["jam", "cook"]) {
    it(`preserves the OG session and absent checkpoint for ordinary ${mode} replies`, async () => {
      const db = database({ chatThreads: [{ _id: "thread", namespaceId: "ns", mode, assignmentId: "a", claudeSessionId: "og", guardianSessions: { a: "fork" } }],
        chatMessages: [{ _id: "message", content: "User message" }] });
      await triggerChatJob(db.ctx, { password, threadId: "thread", triggerMessageId: "message", harness: "claude" } as any);
      const context = JSON.parse(db.inserts[0].value.context);
      assert.equal(context.claudeSessionId, "og");
      assert.equal(context.forkSession, false);
      assert.equal(context.effectivePromptMode, mode);
      assert.equal(Object.prototype.hasOwnProperty.call(context, "checkpoint"), false);
    });
  }
});
