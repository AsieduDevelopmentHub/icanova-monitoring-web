import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "prune telemetry buckets",
  { minutes: 1 },
  internal.telemetry.pruneBuckets,
  {},
);

crons.interval(
  "device health sweep",
  { minutes: 1 },
  internal.deviceHealth.sweep,
  {},
);

crons.interval(
  "prune ingest rate windows",
  { minutes: 15 },
  internal.ingestRateLimit.pruneStale,
  {},
);

export default crons;

// Delivery lease reclaim is scheduled per claim (reclaimIfStale). A global
// scan cron is intentionally omitted so the hot path stays indexed and bounded.
