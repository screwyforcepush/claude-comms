// Run with: npx tsx --test workflow-engine/convex/lib/jobPrompts.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteJob, readJobPrompt, resolveJobPrompt, upsertJobPrompt } from "./jobPrompts.js";

type Row = { _id: string; jobId: string; prompt: string; createdAt: number };
type Values = Record<string, unknown>;
const jobId = "job" as Parameters<typeof readJobPrompt>[1];

function fixture(rows: Row[] = [], job: { prompt?: string } | null = null) {
  const stored = rows.map((row) => ({ ...row }));
  const gets: string[] = [];
  const indexes: { index: string; key: string; value: string }[] = [];
  const inserts: { table: string; values: Values }[] = [];
  const patches: { id: string; values: Values }[] = [];
  const deletes: string[] = [];
  const reads: string[] = [];
  const ctx = {
    db: {
      query: (table: string) => {
        assert.equal(table, "jobPrompts");
        return {
          withIndex: (index: string, select: (q: { eq: (key: string, value: string) => void }) => void) => {
            let selectedJobId: string | undefined;
            select({ eq: (key, value) => {
              indexes.push({ index, key, value });
              assert.equal(index, "by_job");
              assert.equal(key, "jobId");
              selectedJobId = value;
            } });
            return {
              first: async () => {
                reads.push("first");
                return stored.find((row) => row.jobId === selectedJobId) ?? null;
              },
              collect: async () => {
                reads.push("collect");
                return stored.filter((row) => row.jobId === selectedJobId);
              },
            };
          },
        };
      },
      get: async (id: string) => {
        gets.push(id);
        assert.equal(id, jobId);
        return job;
      },
      insert: async (table: string, values: Values) => {
        inserts.push({ table, values });
        stored.push({ _id: "inserted", ...values } as Row);
        return "inserted";
      },
      patch: async (id: string, values: Values) => {
        patches.push({ id, values });
        const row = stored.find((candidate) => candidate._id === id);
        assert.ok(row);
        Object.assign(row, values);
      },
      delete: async (id: string) => {
        deletes.push(id);
        const index = stored.findIndex((row) => row._id === id);
        if (index !== -1) stored.splice(index, 1);
      },
    },
  };
  return {
    ctx: ctx as unknown as Parameters<typeof upsertJobPrompt>[0],
    stored, gets, indexes, inserts, patches, deletes, reads,
  };
}

function promptRow(prompt = "side prompt", id = "prompt", owner = "job"): Row {
  return { _id: id, jobId: owner, prompt, createdAt: 10 };
}

describe("resolveJobPrompt", () => {
  it("returns a present row without invoking the legacy loader", async () => {
    let calls = 0;
    assert.equal(await resolveJobPrompt({ prompt: "side prompt" }, async () => {
      calls++;
      throw new Error("Legacy loader must stay lazy");
    }), "side prompt");
    assert.equal(calls, 0);
  });

  it("prefers a row over an available legacy prompt", async () => {
    let calls = 0;
    assert.equal(await resolveJobPrompt({ prompt: "current" }, async () => {
      calls++;
      return "legacy";
    }), "current");
    assert.equal(calls, 0);
  });

  it("preserves an empty row prompt without loading legacy", async () => {
    let calls = 0;
    assert.equal(await resolveJobPrompt({ prompt: "" }, async () => {
      calls++;
      return "legacy";
    }), "");
    assert.equal(calls, 0);
  });

  it("loads legacy once when the row is absent", async () => {
    let calls = 0;
    assert.equal(await resolveJobPrompt(null, async () => {
      calls++;
      return "legacy";
    }), "legacy");
    assert.equal(calls, 1);
  });

  it("maps an absent legacy prompt to null and preserves an empty one", async () => {
    assert.equal(await resolveJobPrompt(null, async () => undefined), null);
    assert.equal(await resolveJobPrompt(null, async () => ""), "");
  });
});

describe("readJobPrompt", () => {
  it("reads the by_job index with first and never gets the job when a row exists", async () => {
    const { ctx, gets, indexes, reads } = fixture([promptRow()], { prompt: "legacy" });
    assert.equal(await readJobPrompt(ctx, jobId), "side prompt");
    assert.deepEqual(indexes, [{ index: "by_job", key: "jobId", value: jobId }]);
    assert.deepEqual(reads, ["first"]);
    assert.deepEqual(gets, []);
  });

  it("does not invoke an injected loader or db.get for an empty row", async () => {
    const { ctx, gets } = fixture([promptRow("")]);
    let calls = 0;
    assert.equal(await readJobPrompt(ctx, jobId, async () => {
      calls++;
      return "legacy";
    }), "");
    assert.equal(calls, 0);
    assert.deepEqual(gets, []);
  });

  it("tolerates duplicate rows by reading the first without loading legacy", async () => {
    const { ctx, gets } = fixture([promptRow("first"), promptRow("second", "duplicate")]);
    assert.equal(await readJobPrompt(ctx, jobId), "first");
    assert.deepEqual(gets, []);
  });

  it("gets the job exactly once for legacy fallback", async () => {
    const { ctx, gets } = fixture([], { prompt: "legacy" });
    assert.equal(await readJobPrompt(ctx, jobId), "legacy");
    assert.deepEqual(gets, [jobId]);
  });

  it("returns null for a missing job or a job without a prompt", async () => {
    for (const job of [null, {}]) {
      const { ctx, gets } = fixture([], job);
      assert.equal(await readJobPrompt(ctx, jobId), null);
      assert.deepEqual(gets, [jobId]);
    }
  });

  it("preserves an empty legacy prompt", async () => {
    const { ctx } = fixture([], { prompt: "" });
    assert.equal(await readJobPrompt(ctx, jobId), "");
  });

  it("uses an injected legacy loader instead of fetching the job", async () => {
    const { ctx, gets } = fixture();
    let calls = 0;
    assert.equal(await readJobPrompt(ctx, jobId, async () => {
      calls++;
      return "already loaded";
    }), "already loaded");
    assert.equal(calls, 1);
    assert.deepEqual(gets, []);
  });

  it("maps missing injected legacy content to null without fetching the job", async () => {
    const { ctx, gets } = fixture();
    assert.equal(await readJobPrompt(ctx, jobId, async () => undefined), null);
    assert.deepEqual(gets, []);
  });
});

describe("upsertJobPrompt", () => {
  it("inserts the supplied prompt and timestamp when there is no row", async () => {
    const { ctx, inserts, patches, reads } = fixture();
    await upsertJobPrompt(ctx, jobId, "new prompt", 20);
    assert.deepEqual(inserts, [{ table: "jobPrompts", values: { jobId, prompt: "new prompt", createdAt: 20 } }]);
    assert.deepEqual(patches, []);
    assert.deepEqual(reads, ["first"]);
  });

  it("overwrites an existing row and refreshes createdAt without inserting", async () => {
    const { ctx, inserts, patches } = fixture([promptRow()]);
    await upsertJobPrompt(ctx, jobId, "replacement", 30);
    assert.deepEqual(patches, [{ id: "prompt", values: { prompt: "replacement", createdAt: 30 } }]);
    assert.deepEqual(inserts, []);
  });

  it("keeps one row across repeated starts, including an empty replacement", async () => {
    const { ctx, stored, inserts, patches } = fixture();
    await upsertJobPrompt(ctx, jobId, "initial", 20);
    await upsertJobPrompt(ctx, jobId, "", 30);
    assert.deepEqual(stored, [{ _id: "inserted", jobId, prompt: "", createdAt: 30 }]);
    assert.equal(inserts.length, 1);
    assert.equal(patches.length, 1);
  });
});

describe("deleteJob", () => {
  it("deletes all matching prompt rows before the job and leaves other ids untouched", async () => {
    const other = promptRow("other", "other-prompt", "other-job");
    const { ctx, deletes, stored, indexes, reads } = fixture([
      promptRow(), other, promptRow("duplicate", "duplicate"),
    ]);
    await deleteJob(ctx, jobId);
    assert.deepEqual(deletes, ["prompt", "duplicate", jobId]);
    assert.deepEqual(stored, [other]);
    assert.deepEqual(indexes, [{ index: "by_job", key: "jobId", value: jobId }]);
    assert.deepEqual(reads, ["collect"]);
  });

  it("deletes only the job when it has no prompt rows", async () => {
    const { ctx, deletes } = fixture();
    await deleteJob(ctx, jobId);
    assert.deepEqual(deletes, [jobId]);
  });
});
