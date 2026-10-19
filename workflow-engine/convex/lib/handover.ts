/**
 * Steward handover — fresh head, same scrollback.
 *
 * The complement of a thread fork: a fork carries the agent's memory and leaves
 * the transcript behind; a handover carries the transcript (by pointer) and
 * deliberately leaves the memory behind. The new Steward reads the source thread
 * and plays back its understanding of intent before anything is built on it.
 *
 * The wrapper is composed here, server-side, so one place owns the sentence and
 * the stored message is exactly what the Steward received. It stays a *user*
 * message in the user's voice: the playback is the user's ask, not a system
 * directive.
 *
 * @see docs/project/spec/mental-model.md — Session Context Isolation / Steward Handover
 */

/** Provisional title prefix until the new Steward sets its own via chat-title. */
export const HANDOVER_TITLE_GLYPH = "↦";

/**
 * Compose the handover message. `topic` is the user's own focus text and must be
 * non-empty — the empty case was deliberately dropped (the user always names a
 * focus subset). Trailing sentence punctuation on the topic is respected so the
 * wrapper never produces "..".
 */
export function composeHandoverMessage(topic: string, sourceThreadId: string): string {
  const focus = topic.trim();
  if (!focus) {
    throw new Error("Handover needs a topic: the user names the focus for the fresh session");
  }
  const sentenceEnd = /[.!?]$/.test(focus) ? "" : ".";
  return (
    `Lets Jam on the topic of ${focus}${sentenceEnd}\n` +
    `I touched on this topic in a previous Steward session. Read the messages from thread ${sourceThreadId} for context, and play back to me your understanding of my intent before shaping anything.`
  );
}

/** Provisional thread title for a handover of `sourceTitle`. */
export function handoverTitle(sourceTitle: string): string {
  return `${HANDOVER_TITLE_GLYPH} ${sourceTitle}`;
}
