/**
 * Fetch every V2 reflection row for a namespace by paging `reflectionsV2.recent`
 * in since/until mode.
 *
 * `recent` in `last` mode is capped at 1000 rows per call, which silently
 * truncated the dump and inventory CLIs once the busy namespaces outgrew it.
 * Range mode paginates, so the whole table is reachable page by page.
 */

import type { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;

export interface FetchAllOptions {
  since?: number;
  until?: number;
  numItems?: number;
  jobType?: string;
}

export async function fetchAllReflectionsV2<T = any>(
  client: ConvexHttpClient,
  password: string,
  namespaceId: string,
  opts: FetchAllOptions = {}
): Promise<T[]> {
  const rows: T[] = [];
  const until = opts.until ?? Date.now();
  let cursor: string | null = null;
  for (;;) {
    const result = await client.query(api.reflectionsV2.recent, {
      password,
      namespaceId,
      since: opts.since ?? 0,
      until,
      jobType: opts.jobType,
      paginationOpts: { numItems: opts.numItems ?? 200, cursor },
    });
    rows.push(...((result.page ?? []) as T[]));
    if (result.isDone || !result.continueCursor) break;
    cursor = result.continueCursor;
  }
  return rows;
}

/** Bounded variant for callers that explicitly want the most recent N rows. */
export async function fetchRecentReflectionsV2<T = any>(
  client: ConvexHttpClient,
  password: string,
  namespaceId: string,
  last: number
): Promise<T[]> {
  const result = await client.query(api.reflectionsV2.recent, {
    password,
    namespaceId,
    last,
  });
  return (result.page ?? []) as T[];
}
