import type { PaginationOptions } from "convex/server";

/** Hard cap for one indexed page or one site snapshot. */
export const MAX_PAGE = 50;

/** One export reads at most this many rows, then stops. */
export const MAX_EXPORT = 200;

/** Stored export files stay under Convex response and storage pressure. */
export const MAX_EXPORT_BYTES = 700_000;

/** Delivery attempts for one message, including the first. */
export const MAX_ATTEMPTS = 3;

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
