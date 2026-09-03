export const MAX_BODY_CHARS = 5000;
export const DEFAULT_FEED_LIMIT = 50;
// Mirrors MAX_FEED_LIMIT in workflow-engine/convex/notifications.ts (authoritative live feed path); kept in manual sync across the Convex bundle boundary per Decision D6.
export const MAX_FEED_LIMIT = 200;

export interface ShouldNotifyInput {
  sessionId?: string | null;
  harness?: string | null;
  mode?: string | null;
  isCompletionSummary?: boolean;
}

export type PreparedBody =
  | { ok: true; body: string }
  | { ok: false; error: string };

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

export function shouldNotify(input: ShouldNotifyInput): boolean {
  if (typeof input.sessionId !== "string" || input.sessionId.trim() === "") {
    return false;
  }
  if (input.harness !== "claude") return false;
  return input.mode === "jam" || input.mode === "cook";
}

// Cap counts UTF-16 code units (JS string.length) — the same unit Android trims
// notification CharSequences at (5120), not bytes. Overlong bodies are rejected,
// never clipped: the fork compresses deliberately instead of losing an unauthored
// tail. The server-side truncate in convex/notifications.ts stays as a storage
// invariant for non-CLI callers only.
export function prepareBody(rawBody: string): PreparedBody {
  const body = rawBody.trim();
  if (body === "") {
    return { ok: false, error: "body is empty" };
  }
  if (body.length > MAX_BODY_CHARS) {
    return {
      ok: false,
      error: `body is ${body.length} chars of max ${MAX_BODY_CHARS}. Nothing was posted. Shorten the rendition and re-invoke.`,
    };
  }
  return { ok: true, body };
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
