import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { trigger } from "../chatJobs.js";
import { getCompletionThread } from "../chatThreads.js";

const password = "block-assessment-cold-test-password";
const previousPassword = process.env.ADMIN_PASSWORD;
before(() => { process.env.ADMIN_PASSWORD = password; });
after(() => {
  if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = previousPassword;
});

// Convex exposes these registration hooks at runtime, outside its public types.
type ColdHandler = { _handler: (ctx: any, args: any) => Promise<any> };
const triggerChatJob = (trigger as unknown as ColdHandler)._handler;
const completionThread = (getCompletionThread as unknown as ColdHandler)._handler;

type Row = { _id: string; [key: string]: any };
function fixture(threads: Row[], report: string) {
  const tables = structuredClone({
    chatThreads: threads,
    chatMessages: [{ _id: "pm-message", content: report, role: "pm" }],
  });
  const reads: string[] = [];
  const inserts: { table: string; row: Record<string, any> }[] = [];
  const queries: { table: string; index: string; fields: [string, unknown][] }[] = [];
  const ctx = {
    db: {
      async get(id: string) {
        reads.push(id);
        return structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null);
      },
      async insert(table: string, row: Record<string, any>) {
        inserts.push({ table, row: structuredClone(row) });
        return "new-chat-job";
      },
      query(table: string) {
        assert.equal(table, "chatThreads");
        return {
          withIndex(index: string, select: (q: any) => unknown) {
            const fields: [string, unknown][] = [];
            const range = { eq(field: string, value: unknown) { fields.push([field, value]); return range; } };
            select(range);
            queries.push({ table, index, fields });
            return { collect: async () => structuredClone(tables.chatThreads.filter(row =>
              fields.every(([field, value]) => row[field] === value))) };
          },
        };
      },
    },
  };
  return { ctx, tables, reads, inserts, queries };
}

const assignmentId = "j57b3dahvkvk19bz4bgfgqmgb58gan7t";
const report = "\n# PM blocked\nNeed the owner's decision: $& $$ $` $'\n```text\nKeep this report verbatim.\n```\n ";
const blockedReason = "\nUser decision required: $& $$ $` $' — choose A or B.\n ";

describe("chatJobs.trigger block-assessment cold handler", () => {
  it("registers optional boolean/string block arguments for Convex callers", () => {
    const registered = trigger as unknown as { exportArgs: () => string };
    const args = JSON.parse(registered.exportArgs()).value;
    assert.deepEqual(args.isBlockAssessment, { fieldType: { type: "boolean" }, optional: true });
    assert.deepEqual(args.blockedReason, { fieldType: { type: "string" }, optional: true });
  });

  const routes = [
    { name: "guardian existing assignment session", mode: "guardian", sessions: { claudeSessionId: "original", guardianSessions: { [assignmentId]: "assignment-fork", other: "other-fork" } }, session: "assignment-fork", fork: false },
    { name: "guardian first-use fork", mode: "guardian", sessions: { claudeSessionId: "original", guardianSessions: { other: "other-fork" } }, session: "original", fork: true },
    { name: "guardian fresh session", mode: "guardian", sessions: {}, session: undefined, fork: false },
    { name: "jam original session", mode: "jam", sessions: { claudeSessionId: "original", guardianSessions: { [assignmentId]: "assignment-fork" } }, session: "original", fork: false },
    { name: "cook original session", mode: "cook", sessions: { claudeSessionId: "original", guardianSessions: { [assignmentId]: "assignment-fork" } }, session: "original", fork: false },
  ];
  for (const route of routes) {
    it(`preserves report/reason and routes block context through ${route.name}`, async () => {
      const thread = { _id: "selected", namespaceId: "namespace", assignmentId, mode: route.mode, lastPromptMode: "jam", ...route.sessions };
      const otherThreads = [
        { _id: "wrong-assignment", assignmentId: "other", mode: "guardian" },
        ...(route.mode === "guardian" ? [{ _id: "ordinary-first", assignmentId, mode: "cook" }] : []),
      ];
      const db = fixture([...otherThreads, thread], report);
      const originalTables = structuredClone(db.tables);
      const selected = await completionThread(db.ctx, { password, assignmentId });
      assert.equal(selected._id, "selected");
      const beforeTrigger = Date.now();
      assert.deepEqual(await triggerChatJob(db.ctx, {
        password, threadId: selected._id, triggerMessageId: "pm-message", harness: "claude", model: "test-model",
        isBlockAssessment: true, blockedReason,
      }), { jobId: "new-chat-job", mode: route.mode });
      assert.equal(db.inserts.length, 1);
      const { context, createdAt, ...fields } = db.inserts[0].row;
      assert.equal(db.inserts[0].table, "chatJobs");
      assert.deepEqual(fields, { threadId: "selected", namespaceId: "namespace", harness: "claude", model: "test-model", status: "pending" });
      assert.ok(createdAt >= beforeTrigger && createdAt <= Date.now());
      assert.deepEqual(JSON.parse(context), {
        threadId: "selected", namespaceId: "namespace", mode: route.mode,
        effectivePromptMode: route.mode === "guardian" ? "cook" : route.mode,
        lastPromptMode: "jam", latestUserMessage: report,
        ...(route.session === undefined ? {} : { claudeSessionId: route.session }),
        forkSession: route.fork, assignmentId,
        isGuardianEvaluation: false, isCompletionSummary: false, isBlockAssessment: true, blockedReason,
      });
      assert.deepEqual(db.tables, originalTables);
      assert.deepEqual(db.reads, ["selected", "pm-message"]);
      assert.deepEqual(db.queries, [{ table: "chatThreads", index: "by_assignment", fields: [["assignmentId", assignmentId]] }]);
    });
  }

  for (const reason of ["", " \n\t ", undefined]) {
    it(`preserves a ${reason === undefined ? "missing" : reason === "" ? "blank" : "whitespace"} blocked reason`, async () => {
      const db = fixture([{ _id: "thread", namespaceId: "namespace", mode: "cook", assignmentId }], report);
      await triggerChatJob(db.ctx, { password, threadId: "thread", triggerMessageId: "pm-message", harness: "claude", isBlockAssessment: true,
        ...(reason === undefined ? {} : { blockedReason: reason }) });
      const context = JSON.parse(db.inserts[0].row.context);
      assert.equal(context.isBlockAssessment, true);
      assert.equal(context.latestUserMessage, report);
      assert.equal(context.blockedReason, reason);
      assert.equal(Object.prototype.hasOwnProperty.call(context, "blockedReason"), reason !== undefined);
    });
  }

  for (const mode of ["guardian", "jam", "cook"]) {
    for (const flag of [undefined, false]) {
      it(`defaults ordinary ${mode} triggers to false with ${flag === undefined ? "omitted" : "explicit false"} block flag`, async () => {
        const db = fixture([{ _id: "thread", namespaceId: "namespace", mode, assignmentId, claudeSessionId: "original" }], "User message");
        await triggerChatJob(db.ctx, { password, threadId: "thread", triggerMessageId: "pm-message", harness: "claude",
          ...(flag === undefined ? {} : { isBlockAssessment: flag }) });
        const context = JSON.parse(db.inserts[0].row.context);
        assert.equal(context.isBlockAssessment, false);
        assert.equal(context.isCompletionSummary, false);
        assert.equal(context.isGuardianEvaluation, false);
        assert.equal(context.latestUserMessage, "User message");
        assert.equal(Object.prototype.hasOwnProperty.call(context, "blockedReason"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(context, "checkpoint"), false);
      });
    }
  }

  it("rejects an unauthorized block trigger before any database access", async () => {
    const db = fixture([], report);
    await assert.rejects(() => triggerChatJob(db.ctx, { password: "wrong", threadId: "thread", triggerMessageId: "pm-message", isBlockAssessment: true, blockedReason }), /Unauthorized/);
    assert.deepEqual(db.reads, []);
    assert.deepEqual(db.inserts, []);
  });
});
