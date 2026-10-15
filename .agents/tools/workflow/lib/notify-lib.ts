export const DEFAULT_FEED_LIMIT = 50;
// Mirrors MAX_FEED_LIMIT in workflow-engine/convex/notifications.ts (authoritative live feed path); kept in manual sync across the Convex bundle boundary per Decision D6.
export const MAX_FEED_LIMIT = 200;

export function composeNotificationBody({ content, hint, failed }: {
  content: string;
  hint?: string;
  failed?: boolean;
}): string {
  if (failed && hint) return content ? `${hint}\n\n${content}` : hint;
  return content;
}

export interface NotificationFeedRow {
  _creationTime: number;
  _id?: string;
  createdAt?: number;
}

export interface NotificationFeedPageOptions {
  cursor?: number | null;
  limit?: number;
}

export interface NotificationFeedPage<T extends NotificationFeedRow> {
  rows: T[];
  nextCursor: number | null;
}

export function encodeNotificationFeedCursor(row: NotificationFeedRow): number {
  return row._creationTime;
}

export function decodeNotificationFeedCursor(cursor: number | null | undefined): number | null {
  if (cursor == null) return null;
  return Number.isFinite(cursor) ? cursor : null;
}

export function pageNotificationFeedRows<T extends NotificationFeedRow>(
  rows: readonly T[],
  options: NotificationFeedPageOptions = {}
): NotificationFeedPage<T> {
  const cursor = decodeNotificationFeedCursor(options.cursor);
  const limit = normalizeLimit(options.limit);
  const ordered = [...rows].sort((a, b) => a._creationTime - b._creationTime);
  const afterCursor = cursor == null
    ? ordered
    : ordered.filter((row) => row._creationTime > cursor);
  const pageRows = afterCursor.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];

  return {
    rows: pageRows,
    nextCursor: lastRow ? encodeNotificationFeedCursor(lastRow) : null,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_FEED_LIMIT;
  return Math.min(MAX_FEED_LIMIT, Math.max(1, Math.floor(limit)));
}
