import { describe, it } from "node:test";
import assert from "node:assert";
import { buildClaudeForkArgs } from "./fork-args.js";

describe("buildClaudeForkArgs", () => {
  it("builds the Claude fork args with resume/fork/print last", () => {
    assert.deepStrictEqual(buildClaudeForkArgs({ sessionId: "session_123" }), [
      "--dangerously-skip-permissions",
      "--verbose",
      "--output-format",
      "stream-json",
      "--disable-slash-commands",
      "--resume",
      "session_123",
      "--fork-session",
      "-p",
    ]);
  });

  it("inserts model before resume when present", () => {
    assert.deepStrictEqual(
      buildClaudeForkArgs({ sessionId: "session_123", model: "claude-opus-4-6" }),
      [
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format",
        "stream-json",
        "--disable-slash-commands",
        "--model",
        "claude-opus-4-6",
        "--resume",
        "session_123",
        "--fork-session",
        "-p",
      ]
    );
  });

  it("omits model and disallowed tools unless explicitly supplied by a caller", () => {
    const args = buildClaudeForkArgs({ sessionId: "session_123" });

    assert.ok(!args.includes("--model"));
    assert.ok(!args.includes("--disallowedTools"));
  });
});
