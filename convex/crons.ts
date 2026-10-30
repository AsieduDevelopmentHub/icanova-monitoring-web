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
