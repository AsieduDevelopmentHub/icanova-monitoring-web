import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { recordJobRun } from "./jobStatus";
import {
  INGEST_RATE_DEVICE_MAX,
  INGEST_RATE_IP_MAX,
  INGEST_RATE_PRUNE_BATCH,
  INGEST_RATE_STALE_MS,
  INGEST_RATE_WINDOW_MS,
} from "./limits";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSec: number;
  deviceCount: number;
  ipCount: number;
};

function clampMax(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.min(Math.floor(value), 10_000);
}

async function bumpWindow(
  ctx: MutationCtx,
  key: string,
  now: number,
  windowMs: number,
  max: number,
): Promise<{ allowed: boolean; count: number; retryAfterSec: number }> {
  const existing = await ctx.db
    .query("ingestRateWindows")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing || now - existing.windowStart >= windowMs) {
    if (existing) {
      await ctx.db.patch(existing._id, {
        windowStart: now,
        count: 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("ingestRateWindows", {
        key,
        windowStart: now,
        count: 1,
        updatedAt: now,
      });
    }
    return { allowed: true, count: 1, retryAfterSec: 0 };
  }
  const next = existing.count + 1;
  if (next > max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((existing.windowStart + windowMs - now) / 1000),
    );
    await ctx.db.patch(existing._id, { updatedAt: now });
    return { allowed: false, count: existing.count, retryAfterSec };
  }
  await ctx.db.patch(existing._id, { count: next, updatedAt: now });
  return { allowed: true, count: next, retryAfterSec: 0 };
}

/**
 * Count one ingest attempt against device identity and optional IP.
 * Denied requests do not permanently block; the window ages out.
 */
export const check = internalMutation({
  args: {
    identity: v.union(v.string(), v.null()),
    ipKey: v.union(v.string(), v.null()),
    deviceMax: v.optional(v.number()),
    ipMax: v.optional(v.number()),
    windowMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<RateLimitDecision> => {
    const now = Date.now();
    const windowMs = clampMax(args.windowMs, INGEST_RATE_WINDOW_MS);
    const deviceMax = clampMax(args.deviceMax, INGEST_RATE_DEVICE_MAX);
    const ipMax = clampMax(args.ipMax, INGEST_RATE_IP_MAX);
    let deviceCount = 0;
    let ipCount = 0;
    let retryAfterSec = 0;

    if (args.identity && /^[0-9a-f]{12}$/.test(args.identity)) {
      const device = await bumpWindow(
        ctx,
        `device:${args.identity}`,
        now,
        windowMs,
        deviceMax,
      );
      deviceCount = device.count;
      if (!device.allowed) {
        return {
          allowed: false,
          retryAfterSec: device.retryAfterSec,
          deviceCount,
          ipCount,
        };
      }
      retryAfterSec = Math.max(retryAfterSec, device.retryAfterSec);
    }

    if (args.ipKey && args.ipKey.length >= 3 && args.ipKey.length <= 64) {
      const ip = await bumpWindow(ctx, `ip:${args.ipKey}`, now, windowMs, ipMax);
      ipCount = ip.count;
      if (!ip.allowed) {
        return {
          allowed: false,
          retryAfterSec: ip.retryAfterSec,
          deviceCount,
          ipCount,
        };
      }
      retryAfterSec = Math.max(retryAfterSec, ip.retryAfterSec);
    }

    return { allowed: true, retryAfterSec, deviceCount, ipCount };
  },
});

export const pruneStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const started = Date.now();
    const cutoff = started - INGEST_RATE_STALE_MS;
    const batch = await ctx.db
      .query("ingestRateWindows")
      .withIndex("by_updated", (q) => q.lt("updatedAt", cutoff))
      .take(INGEST_RATE_PRUNE_BATCH);
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
    await recordJobRun(ctx, {
      jobName: "ingestRateLimit.pruneStale",
      processed: batch.length,
      pendingHint: batch.length === INGEST_RATE_PRUNE_BATCH ? INGEST_RATE_PRUNE_BATCH : 0,
      durationMs: Date.now() - started,
      status: batch.length === INGEST_RATE_PRUNE_BATCH ? "partial" : "ok",
    });
    return { deleted: batch.length };
  },
});
