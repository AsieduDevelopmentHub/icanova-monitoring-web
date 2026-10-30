import type { PaginationOptions } from "convex/server";

/** Hard cap for one indexed page or one site snapshot. */
export const MAX_PAGE = 50;

/** One export reads at most this many rows, then stops. */
export const MAX_EXPORT = 200;

/** Stored export files stay under Convex response and storage pressure. */
export const MAX_EXPORT_BYTES = 700_000;

/** Delivery attempts for one message, including the first. */
export const MAX_ATTEMPTS = 3;

/** A processing claim older than this may be reclaimed by another worker. */
export const DELIVERY_LEASE_MS = 60_000;

/**
 * History is one 15-minute aggregate per generator, not one document per poll.
 * telemetryCurrent is the live document and is not pruned.
 * Buckets older than BUCKET_RETENTION_MS are deleted by a resumable prune.
 * Each minute deletes up to PRUNE_ROUNDS batches. The index range is the cursor.
 * There is no raw-sample archive and no daily tier. A week is at most 672 buckets
 * per generator. NCU sample time is uptime, so buckets are keyed by server observedAt.
 */
export const BUCKET_MS = 15 * 60 * 1000;

/** Bucket documents older than this are eligible for the prune mutation. */
export const BUCKET_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** One chart query reads at most a week of 15-minute buckets, plus one to detect overflow. */
export const SERIES_READ = 673;

/** A chart combines contiguous buckets above this so the browser does not plot hundreds of points. */
export const CHART_POINTS = 160;

/** Expired buckets removed by one mutation. The index supplies the next batch. */
export const PRUNE_BATCH = 80;

/** Continuations after the per-minute cron tick. 10 * 80 * 60 = 48,000 deletes per hour. */
export const PRUNE_ROUNDS = 10;

export function boundedPage(opts: PaginationOptions): PaginationOptions {
  const requested = Number.isFinite(opts.numItems) ? Math.floor(opts.numItems) : 1;
  return {
    ...opts,
    numItems: Math.min(Math.max(requested, 1), MAX_PAGE),
  };
}
