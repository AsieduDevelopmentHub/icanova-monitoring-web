import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { requirePermission } from "./auth";
import { BUCKET_MS, BUCKET_RETENTION_MS, MAX_PAGE, boundedPage } from "./limits";

const quality = v.union(
  v.literal("measured"),
  v.literal("unavailable"),
  v.literal("unsupported"),
  v.literal("under-range"),
  v.literal("over-range"),
  v.literal("stale"),
  v.literal("invalid"),
);

const sampleArgs = {
  sourceTime: v.union(v.number(), v.null()),
  link: v.union(v.string(), v.null()),
  mode: v.union(v.string(), v.null()),
  alarmCount: v.union(v.number(), v.null()),
  rpm: v.union(v.number(), v.null()),
  rpmQuality: quality,
  batteryV: v.union(v.number(), v.null()),
  batteryQuality: quality,
  frequencyHz: v.union(v.number(), v.null()),
  frequencyQuality: quality,
  powerKw: v.union(v.number(), v.null()),
  powerQuality: quality,
  voltageL1: v.union(v.number(), v.null()),
  voltageQuality: quality,
};

type Quality =
  | "measured"
  | "unavailable"
  | "unsupported"
  | "under-range"
  | "over-range"
  | "stale"
  | "invalid";

type SampleInput = {
  sourceTime: number | null;
  link: string | null;
  mode: string | null;
  alarmCount: number | null;
  rpm: number | null;
  rpmQuality: Quality;
  batteryV: number | null;
  batteryQuality: Quality;
  frequencyHz: number | null;
  frequencyQuality: Quality;
  powerKw: number | null;
  powerQuality: Quality;
  voltageL1: number | null;
  voltageQuality: Quality;
};

function cleanText(value: string | null) {
  if (value === null) {
    return null;
  }
  const text = value.trim();
  if (!text) {
    return null;
  }
  return text.slice(0, 40);
}

function cleanCount(value: number | null) {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid sample");
  }
  return value;
}

function cleanMetric(value: number | null, readingQuality: Quality) {
  if (readingQuality !== "measured") {
    return null;
  }
  if (value === null || !Number.isFinite(value)) {
    throw new Error("Invalid sample");
  }
  return value;
}

function cleanSample(input: SampleInput) {
  if (input.sourceTime !== null && !Number.isFinite(input.sourceTime)) {
    throw new Error("Invalid sample");
  }
  return {
    sourceTime: input.sourceTime,
    link: cleanText(input.link),
    mode: cleanText(input.mode),
    alarmCount: cleanCount(input.alarmCount),
    rpm: cleanMetric(input.rpm, input.rpmQuality),
    rpmQuality: input.rpmQuality,
    batteryV: cleanMetric(input.batteryV, input.batteryQuality),
    batteryQuality: input.batteryQuality,
    frequencyHz: cleanMetric(input.frequencyHz, input.frequencyQuality),
    frequencyQuality: input.frequencyQuality,
    powerKw: cleanMetric(input.powerKw, input.powerQuality),
    powerQuality: input.powerQuality,
    voltageL1: cleanMetric(input.voltageL1, input.voltageQuality),
    voltageQuality: input.voltageQuality,
  };
}

function emptyReading(qualityName: Quality) {
  return { value: null, quality: qualityName };
}

function rowFromCurrent(
  generator: { _id: Id<"generators">; name: string },
  current: (SampleInput & { updatedAt: number }) | null,
) {
  return {
    generatorId: generator._id,
    name: generator.name,
    updatedAt: current?.updatedAt ?? null,
    sourceTime: current?.sourceTime ?? null,
    link: current?.link ?? null,
    mode: current?.mode ?? null,
    alarmCount: current?.alarmCount ?? null,
    rpm: current?.rpm ?? emptyReading("unavailable").value,
    rpmQuality: current?.rpmQuality ?? "unavailable",
    batteryV: current?.batteryV ?? null,
    batteryQuality: current?.batteryQuality ?? "unavailable",
    frequencyHz: current?.frequencyHz ?? null,
    frequencyQuality: current?.frequencyQuality ?? "unavailable",
    powerKw: current?.powerKw ?? null,
    powerQuality: current?.powerQuality ?? "unavailable",
    voltageL1: current?.voltageL1 ?? null,
    voltageQuality: current?.voltageQuality ?? "unavailable",
  };
}

/** Latest document for one site. Does not read history. */
export const currentForSite = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.telemetry");
    const site = await ctx.db.get(args.siteId);
    if (!site || site.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const generators = await ctx.db
      .query("generators")
      .withIndex("by_org_site", (q) =>
        q.eq("organizationId", args.organizationId).eq("siteId", args.siteId),
      )
      .take(MAX_PAGE + 1);
    const capped = generators.length > MAX_PAGE;
    const page = generators.slice(0, MAX_PAGE);
    const rows = [];
    for (const generator of page) {
      const current = await ctx.db
        .query("telemetryCurrent")
        .withIndex("by_generator", (q) => q.eq("generatorId", generator._id))
        .unique();
      if (current && current.organizationId !== args.organizationId) {
        throw new Error("Forbidden");
      }
      rows.push(rowFromCurrent(generator, current));
    }
    return { rows, capped };
  },
});

/** History for one generator. This is not the live site subscription. */
export const history = query({
  args: {
    generatorId: v.id("generators"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const generator = await ctx.db.get(args.generatorId);
    if (!generator) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, generator.organizationId, "view.telemetry");
    const result = await ctx.db
      .query("telemetryBuckets")
      .withIndex("by_generator_time", (q) => q.eq("generatorId", generator._id))
      .order("desc")
      .paginate(boundedPage(args.paginationOpts));
    if (result.page.some((bucket) => bucket.organizationId !== generator.organizationId)) {
      throw new Error("Forbidden");
    }
    return result;
  },
});

/**
 * Collector entry. Not a public function.
 * Replaces the current document and the open 15-minute bucket.
 */
export const applySample = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    generatorId: v.id("generators"),
    observedAt: v.number(),
    ...sampleArgs,
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.observedAt)) {
      throw new Error("Invalid sample");
    }
    const generator = await ctx.db.get(args.generatorId);
    if (!generator || generator.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const sample = cleanSample(args);
    const stored = {
      organizationId: generator.organizationId,
      siteId: generator.siteId,
      deviceId: generator.deviceId,
      generatorId: generator._id,
      updatedAt: Date.now(),
      ...sample,
    };
    const current = await ctx.db
      .query("telemetryCurrent")
      .withIndex("by_generator", (q) => q.eq("generatorId", generator._id))
      .unique();
    if (current) {
      if (current.organizationId !== generator.organizationId) {
        throw new Error("Forbidden");
      }
      await ctx.db.patch(current._id, stored);
    } else {
      await ctx.db.insert("telemetryCurrent", stored);
    }
    const bucketStart = Math.floor(args.observedAt / BUCKET_MS) * BUCKET_MS;
    const bucket = await ctx.db
      .query("telemetryBuckets")
      .withIndex("by_generator_time", (q) =>
        q.eq("generatorId", generator._id).eq("bucketStart", bucketStart),
      )
      .unique();
    const bucketDoc = { ...stored, bucketStart };
    if (bucket) {
      if (bucket.organizationId !== generator.organizationId) {
        throw new Error("Forbidden");
      }
      await ctx.db.patch(bucket._id, bucketDoc);
    } else {
      await ctx.db.insert("telemetryBuckets", bucketDoc);
    }
    return { generatorId: generator._id, bucketStart };
  },
});

export const pruneBuckets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - BUCKET_RETENTION_MS;
    const old = await ctx.db
      .query("telemetryBuckets")
      .withIndex("by_bucket", (q) => q.lt("bucketStart", cutoff))
      .take(100);
    for (const bucket of old) {
      await ctx.db.delete(bucket._id);
    }
    return old.length;
  },
});
