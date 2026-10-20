import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const READ_RECEIPT_KIND = "read" as const;

export function notificationTitle(namespaceName: string | undefined, threadTitle: string): string {
  return namespaceName ? `${namespaceName} · ${threadTitle}` : threadTitle;
}

/**
 * Retire a thread's shade notification once the thread has been read.
 *
 * A notification is a pointer to an unread message, so it lives exactly as long as
 * the thread is unread: reading it anywhere (phone or desk) posts a "read" row on the
 * same feed the shell already subscribes to, and the shell cancels by thread tag.
 * Emitted only when the newest feed row for the thread is still a message row, so
 * the UI's per-render markRead never floods the feed.
 *
 * @see docs/project/spec/mental-model.md#mm-hands-free-voice-loop
 */
export async function postReadReceipt(
  ctx: Pick<MutationCtx, "db">,
  thread: Doc<"chatThreads">,
): Promise<Id<"notifications"> | null> {
  const latest = await ctx.db
    .query("notifications")
    .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
    .order("desc")
    .first();
  if (!latest || latest.kind === READ_RECEIPT_KIND) return null;

  const namespace = await ctx.db.get(thread.namespaceId);
  return await ctx.db.insert("notifications", {
    namespaceId: thread.namespaceId,
    threadId: thread._id,
    title: notificationTitle(namespace?.name, thread.title),
    body: "",
    kind: READ_RECEIPT_KIND,
    createdAt: Date.now(),
  });
}
