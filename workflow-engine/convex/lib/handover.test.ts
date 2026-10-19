/**
 * Tests for the Steward handover wrapper.
 *
 * Run with: npx tsx --test workflow-engine/convex/lib/handover.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  HANDOVER_TITLE_GLYPH,
  composeHandoverMessage,
  handoverTitle,
} from "./handover";

const THREAD = "jh7eaka3ses36pyqhsghak5emh8ggd37";

describe("composeHandoverMessage", () => {
  it("wraps the topic in the fixed two-line handover ask", () => {
    const msg = composeHandoverMessage("steward handover to new session", THREAD);
    assert.strictEqual(
      msg,
      "Lets Jam on the topic of steward handover to new session.\n" +
        `I touched on this topic in a previous Steward session. Read the messages from thread ${THREAD} for context, and play back to me your understanding of my intent before shaping anything.`
    );
  });

  it("points the new Steward at the source thread id", () => {
    const msg = composeHandoverMessage("anything", THREAD);
    assert.ok(msg.includes(`from thread ${THREAD} `));
  });

  it("asks for the playback before shaping (the handshake clause)", () => {
    const msg = composeHandoverMessage("anything", THREAD);
    assert.ok(/play back to me your understanding of my intent before shaping anything\.$/.test(msg));
  });

  it("trims surrounding whitespace from the topic", () => {
    const msg = composeHandoverMessage("  voice loop latency \n", THREAD);
    assert.ok(msg.startsWith("Lets Jam on the topic of voice loop latency.\n"));
  });

  it("does not double up sentence punctuation the user already supplied", () => {
    assert.ok(composeHandoverMessage("the fork banner.", THREAD).startsWith("Lets Jam on the topic of the fork banner.\n"));
    assert.ok(composeHandoverMessage("why did it thrash?", THREAD).startsWith("Lets Jam on the topic of why did it thrash?\n"));
    assert.ok(composeHandoverMessage("ship it!", THREAD).startsWith("Lets Jam on the topic of ship it!\n"));
  });

  it("keeps a multi-line topic verbatim inside the wrapper", () => {
    const msg = composeHandoverMessage("two things:\n- a\n- b", THREAD);
    assert.ok(msg.startsWith("Lets Jam on the topic of two things:\n- a\n- b.\n"));
  });

  it("rejects an empty topic: the empty case is dropped by design", () => {
    assert.throws(() => composeHandoverMessage("", THREAD), /needs a topic/);
    assert.throws(() => composeHandoverMessage("   \n", THREAD), /needs a topic/);
  });
});

describe("handoverTitle", () => {
  it("prefixes the source title with the handover glyph, distinct from the fork glyph", () => {
    assert.strictEqual(handoverTitle("Steward Session Handover"), `${HANDOVER_TITLE_GLYPH} Steward Session Handover`);
    assert.notStrictEqual(HANDOVER_TITLE_GLYPH, "⑂");
  });
});
