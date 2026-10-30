import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { requirePermission } from "./auth";
import { BUCKET_MS, BUCKET_RETENTION_MS, CHART_POINTS, MAX_PAGE, SERIES_READ, boundedPage } from "./limits";
import { downsample, foldMetric, type MetricFold, type SeriesPoint } from "./rollup";
import { noteSample } from "./siteSummary";

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
  current: (SampleInput & { updatedAt: number; boot?: number; seq?: number }) | null,
) {
  return {
    generatorId: generator._id,
    name: generator.name,
    updatedAt: current?.updatedAt ?? null,
    sourceTime: current?.sourceTime ?? null,
    boot: current?.boot ?? null,
    seq: current?.seq ?? null,
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
    boot: v.optional(v.number()),
    seq: v.optional(v.number()),
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
    const updatedAt = Date.now();
    const stored = {
      organizationId: generator.organizationId,
      siteId: generator.siteId,
      deviceId: generator.deviceId,
      generatorId: generator._id,
      updatedAt,
      ...sample,
    };
    const current = await ctx.db
      .query("telemetryCurrent")
      .withIndex("by_generator", (q) => q.eq("generatorId", generator._id))
      .unique();
    const currentDoc = {
      ...stored,
      ...(args.boot !== undefined ? { boot: args.boot } : {}),
      ...(args.seq !== undefined ? { seq: args.seq } : {}),
    };
    if (current) {
      if (current.organizationId !== generator.organizationId) {
        throw new Error("Forbidden");
      }
      await ctx.db.patch(current._id, currentDoc);
    } else {
      await ctx.db.insert("telemetryCurrent", currentDoc);
    }
    await noteSample(ctx, {
      organizationId: generator.organizationId,
      siteId: generator.siteId,
      previousLink: current?.link ?? null,
      link: sample.link,
      hadCurrent: current !== null,
      at: updatedAt,
    });
    const bucketStart = Math.floor(args.observedAt / BUCKET_MS) * BUCKET_MS;
    const bucket = await ctx.db
      .query("telemetryBuckets")
      .withIndex("by_generator_time", (q) =>
        q.eq("generatorId", generator._id).eq("bucketStart", bucketStart),
      )
      .unique();
    if (bucket && bucket.organizationId !== generator.organizationId) {
      throw new Error("Forbidden");
    }
    const rpm = foldMetric(readFold(bucket, "rpm"), sample.rpm, sample.rpmQuality === "measured");
    const battery = foldMetric(
      readFold(bucket, "battery"),
      sample.batteryV,
      sample.batteryQuality === "measured",
    );
    const frequency = foldMetric(
      readFold(bucket, "frequency"),
      sample.frequencyHz,
      sample.frequencyQuality === "measured",
    );
    const power = foldMetric(readFold(bucket, "power"), sample.powerKw, sample.powerQuality === "measured");
    const voltage = foldMetric(
      readFold(bucket, "voltage"),
      sample.voltageL1,
      sample.voltageQuality === "measured",
    );
    const bucketDoc = {
      ...stored,
      bucketStart,
      sampleCount: (bucket?.sampleCount ?? 0) + 1,
      ...writeFold("rpm", rpm),
      ...writeFold("battery", battery),
      ...writeFold("frequency", frequency),
      ...writeFold("power", power),
      ...writeFold("voltage", voltage),
    };
    if (bucket) {
      await ctx.db.patch(bucket._id, bucketDoc);
    } else {
      await ctx.db.insert("telemetryBuckets", bucketDoc);
    }
    return { generatorId: generator._id, bucketStart };
  },
});

type FoldSource = {
  rpmMin?: number | null;
  rpmMax?: number | null;
  rpmSum?: number;
  rpmCount?: number;
  rpmLast?: number | null;
  batteryMin?: number | null;
  batteryMax?: number | null;
  batterySum?: number;
  batteryCount?: number;
  batteryLast?: number | null;
  frequencyMin?: number | null;
  frequencyMax?: number | null;
  frequencySum?: number;
  frequencyCount?: number;
  frequencyLast?: number | null;
  powerMin?: number | null;
  powerMax?: number | null;
  powerSum?: number;
  powerCount?: number;
  powerLast?: number | null;
  voltageMin?: number | null;
  voltageMax?: number | null;
  voltageSum?: number;
  voltageCount?: number;
  voltageLast?: number | null;
} | null;

function readFold(bucket: FoldSource, name: "rpm" | "battery" | "frequency" | "power" | "voltage"): MetricFold | null {
  if (!bucket) {
    return null;
  }
  const min = bucket[`${name}Min`];
  const max = bucket[`${name}Max`];
  const sum = bucket[`${name}Sum`];
  const count = bucket[`${name}Count`];
  const last = bucket[`${name}Last`];
  if (count === undefined && last === undefined && min === undefined) {
    return null;
  }
  return {
    min: min ?? null,
    max: max ?? null,
    sum: sum ?? 0,
    count: count ?? 0,
    last: last ?? null,
  };
}

function writeFold(name: "rpm" | "battery" | "frequency" | "power" | "voltage", fold: MetricFold) {
  return {
    [`${name}Min`]: fold.min,
    [`${name}Max`]: fold.max,
    [`${name}Sum`]: fold.sum,
    [`${name}Count`]: fold.count,
    [`${name}Last`]: fold.last,
  };
}

function seriesPoint(fold: MetricFold, fallback: number | null, fallbackMeasured: boolean, t: number): SeriesPoint {
  if (fold.count > 0) {
    return { t, value: fold.last, min: fold.min, max: fold.max, sum: fold.sum, count: fold.count };
  }
  if (fallbackMeasured && fallback !== null) {
    return { t, value: fallback, min: fallback, max: fallback, sum: fallback, count: 1 };
  }
  return { t, value: null, min: null, max: null, sum: 0, count: 0 };
}

const rangeMs = {
  hour: 60 * 60 * 1000,
  six: 6 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
} as const;

/** One generator, one time range, 15-minute buckets. Not a fleet query. */
export const series = query({
  args: {
    generatorId: v.id("generators"),
    range: v.union(v.literal("hour"), v.literal("six"), v.literal("day"), v.literal("week")),
  },
  handler: async (ctx, args) => {
    const generator = await ctx.db.get(args.generatorId);
    if (!generator) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, generator.organizationId, "view.telemetry");
    const from = Date.now() - rangeMs[args.range];
    const buckets = await ctx.db
      .query("telemetryBuckets")
      .withIndex("by_generator_time", (q) =>
        q.eq("generatorId", generator._id).gte("bucketStart", from),
      )
      .take(SERIES_READ);
    if (buckets.some((bucket) => bucket.organizationId !== generator.organizationId)) {
      throw new Error("Forbidden");
    }
    const capped = buckets.length >= SERIES_READ;
    const points = buckets.map((bucket) => {
      const rpm = seriesPoint(readFold(bucket, "rpm") ?? { min: null, max: null, sum: 0, count: 0, last: null }, bucket.rpm, bucket.rpmQuality === "measured", bucket.bucketStart);
      const battery = seriesPoint(readFold(bucket, "battery") ?? { min: null, max: null, sum: 0, count: 0, last: null }, bucket.batteryV, bucket.batteryQuality === "measured", bucket.bucketStart);
      const frequency = seriesPoint(readFold(bucket, "frequency") ?? { min: null, max: null, sum: 0, count: 0, last: null }, bucket.frequencyHz, bucket.frequencyQuality === "measured", bucket.bucketStart);
      const power = seriesPoint(readFold(bucket, "power") ?? { min: null, max: null, sum: 0, count: 0, last: null }, bucket.powerKw, bucket.powerQuality === "measured", bucket.bucketStart);
      const voltage = seriesPoint(readFold(bucket, "voltage") ?? { min: null, max: null, sum: 0, count: 0, last: null }, bucket.voltageL1, bucket.voltageQuality === "measured", bucket.bucketStart);
      return { t: bucket.bucketStart, rpm, battery, frequency, power, voltage };
    });
    const chart = {
      rpm: downsample(points.map((point) => point.rpm), CHART_POINTS, BUCKET_MS),
      battery: downsample(points.map((point) => point.battery), CHART_POINTS, BUCKET_MS),
      frequency: downsample(points.map((point) => point.frequency), CHART_POINTS, BUCKET_MS),
      power: downsample(points.map((point) => point.power), CHART_POINTS, BUCKET_MS),
      voltage: downsample(points.map((point) => point.voltage), CHART_POINTS, BUCKET_MS),
    };
    const reduced = {
      rpm: chart.rpm.length < points.length,
      battery: chart.battery.length < points.length,
      frequency: chart.frequency.length < points.length,
      power: chart.power.length < points.length,
      voltage: chart.voltage.length < points.length,
    };
    return {
      resolutionMs: BUCKET_MS,
      from,
      capped,
      reduced,
      rpm: chart.rpm,
      battery: chart.battery,
      frequency: chart.frequency,
      power: chart.power,
      voltage: chart.voltage,
    };
  },
});

/** Stored site counters. Freshness is not included because it expires without a new sample. */
export const siteSummary = query({
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
    const summary = await ctx.db
      .query("siteSummaries")
      .withIndex("by_site", (q) => q.eq("siteId", args.siteId))
      .unique();
    if (summary && summary.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    if (!summary) {
      return {
        ready: false,
        generators: null,
        reporting: 0,
        linkOk: 0,
        linkFail: 0,
        linkDegraded: 0,
        linkOther: 0,
        lastTelemetryAt: null,
      };
    }
    return {
      ready: true,
      generators: summary.generators,
      reporting: summary.reporting,
      linkOk: summary.linkOk,
      linkFail: summary.linkFail,
      linkDegraded: summary.linkDegraded,
      linkOther: summary.linkOther,
      lastTelemetryAt: summary.lastTelemetryAt,
    };
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
