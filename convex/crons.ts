import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "prune telemetry buckets",
  { minutes: 1 },
  internal.telemetry.pruneBuckets,
  {},
);

export default crons;

// Delivery lease reclaim is scheduled per claim (reclaimIfStale). A global
// scan cron is intentionally omitted so the hot path stays indexed and bounded.
