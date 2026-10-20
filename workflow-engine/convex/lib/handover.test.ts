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
const TAIL =
  `I want to focus on this with you now, but you can read the messages from my other Steward thread ${THREAD} for context. ` +
  `Play back to me your understanding of my intent.`;

describe("composeHandoverMessage", () => {
  it("leads with the topic as its own paragraph, then the pointer and playback ask", () => {
    const msg = composeHandoverMessage("steward handover to new session", THREAD);
    assert.strictEqual(msg, `steward handover to new session\n\n${TAIL}`);
  });

  it("points the new Steward at the source thread id", () => {
    const msg = composeHandoverMessage("anything", THREAD);
    assert.ok(msg.includes(`Steward thread ${THREAD} for context`));
  });

  it("asks for the playback of intent (the handshake clause)", () => {
    const msg = composeHandoverMessage("anything", THREAD);
    assert.ok(/Play back to me your understanding of my intent\.$/.test(msg));
  });

  it("separates the pointer and playback sentences with a space", () => {
    const msg = composeHandoverMessage("anything", THREAD);
    assert.ok(msg.includes("for context. Play back"));
  });

  it("trims surrounding whitespace from the topic", () => {
    const msg = composeHandoverMessage("  voice loop latency \n", THREAD);
    assert.ok(msg.startsWith("voice loop latency\n\n"));
  });

  it("keeps the user's own punctuation untouched", () => {
    assert.ok(composeHandoverMessage("the fork banner.", THREAD).startsWith("the fork banner.\n\n"));
    assert.ok(composeHandoverMessage("why did it thrash?", THREAD).startsWith("why did it thrash?\n\n"));
    assert.ok(composeHandoverMessage("no full stop", THREAD).startsWith("no full stop\n\n"));
  });

  it("keeps a multi-line topic verbatim", () => {
    const msg = composeHandoverMessage("two things:\n- a\n- b", THREAD);
    assert.ok(msg.startsWith("two things:\n- a\n- b\n\n"));
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
