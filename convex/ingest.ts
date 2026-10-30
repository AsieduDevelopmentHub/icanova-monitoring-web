import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { observeCommunicationLink } from "./alarms";
import { deviceIsActive } from "./deviceLifecycle";
import { recordAcceptedBatch } from "./deviceHealth";
import { INGEST_MAX_SAMPLES } from "./limits";
import { METRIC_KEYS } from "./metrics";
import { orderBatch } from "./order";

const numberOrNull = v.union(v.number(), v.null());

const ncuSample = v.object({
  t: v.number(),
  age: v.number(),
  link: v.string(),
  alm: v.number(),
  mode: numberOrNull,
  rpm: numberOrNull,
  batt10: numberOrNull,
  hz10: numberOrNull,
  kw100: numberOrNull,
  van10: numberOrNull,
  extra: v.optional(v.record(v.string(), numberOrNull)),
  extraQuality: v.optional(
    v.record(v.string(), v.union(v.literal("measured"), v.literal("unavailable"))),
  ),
  unmapped: v.optional(v.record(v.string(), numberOrNull)),
});

const links = new Set(["ok", "degraded", "fail", "unknown"]);

/**
 * Station collector entry. The caller supplies the efuse MAC from the NCU1
 * header, not an organization id. One registered device and one generator
 * must already exist. The same MAC in two organizations is rejected.
 */
export const acceptBatch = internalMutation({
  args: {
    identity: v.string(),
    boot: v.number(),
    seq: v.number(),
    epoch: v.optional(v.number()),
    samples: v.array(ncuSample),
  },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{12}$/.test(args.identity)) {
      return { status: "unknown" as const, accepted: 0 };
    }
    if (!Number.isInteger(args.boot) || !Number.isInteger(args.seq) || args.seq < 1) {
      throw new Error("Invalid sample");
    }
    if (args.samples.length < 1 || args.samples.length > INGEST_MAX_SAMPLES) {
      throw new Error("Invalid sample");
    }
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", args.identity))
      .take(2);
    if (matches.length === 0) {
      return { status: "unknown" as const, accepted: 0 };
    }
    if (matches.length > 1) {
      return { status: "ambiguous" as const, accepted: 0 };
    }
    const device = matches[0];
    if (!deviceIsActive(device)) {
      return { status: "inactive" as const, accepted: 0 };
    }
    const generators = await ctx.db
      .query("generators")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .take(2);
    const generator = generators[0];
    if (!generator || generators.length !== 1 || generator.organizationId !== device.organizationId) {
      return { status: "no-generator" as const, accepted: 0 };
    }
    const cursor = await ctx.db
      .query("ingestCursors")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    const decision = orderBatch(cursor, {
      epoch: args.epoch,
      boot: args.boot,
      seq: args.seq,
    });
    if (decision.action !== "accept") {
      return { status: decision.action, accepted: 0 };
    }
    const observedAt = Date.now();
    const current = await ctx.db
      .query("telemetryCurrent")
      .withIndex("by_generator", (q) => q.eq("generatorId", generator._id))
      .unique();
    let previousLink = current?.link ?? null;
    // A different boot id is not ordered against the stored link. Samples
    // inside this accepted batch are ordered with each other.
    let ordered = decision.ordered;
    for (const sample of args.samples) {
      if (!Number.isFinite(sample.t) || !Number.isFinite(sample.age) || !links.has(sample.link)) {
        throw new Error("Invalid sample");
      }
      const rpm = scaled(sample.rpm, 1);
      const battery = scaled(sample.batt10, 10);
      const frequency = scaled(sample.hz10, 10);
      const power = scaled(sample.kw100, 100);
      const voltage = scaled(sample.van10, 10);
      await ctx.runMutation(internal.telemetry.applySample, {
        organizationId: device.organizationId,
        generatorId: generator._id,
        observedAt,
        sourceTime: null,
        link: sample.link,
        mode: sample.mode === null ? null : String(sample.mode),
        alarmCount: sample.alm,
        rpm: rpm.value,
        rpmQuality: rpm.quality,
        batteryV: battery.value,
        batteryQuality: battery.quality,
        frequencyHz: frequency.value,
        frequencyQuality: frequency.quality,
        powerKw: power.value,
        powerQuality: power.quality,
        voltageL1: voltage.value,
        voltageQuality: voltage.quality,
        boot: args.boot,
        seq: args.seq,
        epoch: decision.epoch,
        extra: sample.extra ?? blankExtra(),
        extraQuality: sample.extraQuality ?? blankExtraQuality(),
        unmapped: sample.unmapped ?? {},
      });
      await observeCommunicationLink(ctx, {
        organizationId: device.organizationId,
        siteId: generator.siteId,
        deviceId: device._id,
        generatorId: generator._id,
        previousLink: ordered ? previousLink : null,
        link: sample.link,
        boot: args.boot,
        seq: args.seq,
        ordered,
        at: observedAt,
      });
      previousLink = sample.link;
      ordered = true;
    }
    const cursorDoc = {
      boot: args.boot,
      seq: args.seq,
      ...(decision.epoch !== undefined ? { epoch: decision.epoch } : {}),
    };
    if (cursor) {
      await ctx.db.patch(cursor._id, cursorDoc);
    } else {
      await ctx.db.insert("ingestCursors", {
        organizationId: device.organizationId,
        deviceId: device._id,
        ...cursorDoc,
      });
    }
    const last = args.samples[args.samples.length - 1];
    await recordAcceptedBatch(ctx, {
      organizationId: device.organizationId,
      deviceId: device._id,
      siteId: generator.siteId,
      generatorId: generator._id,
      link: last?.link ?? null,
      at: observedAt,
    });
    return { status: "accepted" as const, accepted: args.samples.length };
  },
});

function blankExtra(): Record<string, number | null> {
  const extra: Record<string, number | null> = {};
  for (const key of METRIC_KEYS) {
    extra[key] = null;
  }
  return extra;
}

function blankExtraQuality(): Record<string, "unavailable"> {
  const quality: Record<string, "unavailable"> = {};
  for (const key of METRIC_KEYS) {
    quality[key] = "unavailable";
  }
  return quality;
}

function scaled(value: number | null, divisor: number): {
  value: number | null;
  quality: "measured" | "unavailable";
} {
  if (value === null) {
    return { value: null, quality: "unavailable" };
  }
  if (!Number.isFinite(value)) {
    throw new Error("Invalid sample");
  }
  return { value: value / divisor, quality: "measured" };
}
