import type { PaginationOptions } from "convex/server";

/** Hard cap for one indexed page or one site snapshot. */
export const MAX_PAGE = 50;

/** History is one replaced document per generator per window, not per poll. */
export const BUCKET_MS = 15 * 60 * 1000;

/** Bucket documents older than this are eligible for the prune mutation. */
export const BUCKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export function boundedPage(opts: PaginationOptions): PaginationOptions {
  const requested = Number.isFinite(opts.numItems) ? Math.floor(opts.numItems) : 1;
  return {
    ...opts,
    numItems: Math.min(Math.max(requested, 1), MAX_PAGE),
  };
}
