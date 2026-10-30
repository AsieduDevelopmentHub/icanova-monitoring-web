import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const ncuSample = v.object({
  t: v.number(),
  age: v.number(),
  link: v.string(),
  alm: v.number(),
  mode: v.union(v.number(), v.null()),
  rpm: v.union(v.number(), v.null()),
  batt10: v.union(v.number(), v.null()),
  hz10: v.union(v.number(), v.null()),
  kw100: v.union(v.number(), v.null()),
  van10: v.union(v.number(), v.null()),
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
    samples: v.array(ncuSample),
  },
  handler: async (ctx, args) => {
    if (!/^[0-9a-f]{12}$/.test(args.identity)) {
      return { status: "unknown" as const, accepted: 0 };
    }
    if (!Number.isInteger(args.boot) || !Number.isInteger(args.seq) || args.seq < 1) {
      throw new Error("Invalid sample");
    }
    if (args.samples.length < 1 || args.samples.length > 8) {
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
    // Same-boot sequence is monotonic. A different boot id is not: the device
    // draws it with esp_random(), and sample t is uptime rather than a clock.
    // A delayed batch from an older boot can still replace current telemetry.
    if (cursor && cursor.boot === args.boot && args.seq < cursor.seq) {
      return { status: "stale" as const, accepted: 0 };
    }
    if (cursor && cursor.boot === args.boot && args.seq === cursor.seq) {
      return { status: "duplicate" as const, accepted: 0 };
    }
    const observedAt = Date.now();
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
      });
    }
    if (cursor) {
      await ctx.db.patch(cursor._id, { boot: args.boot, seq: args.seq });
    } else {
      await ctx.db.insert("ingestCursors", {
        organizationId: device.organizationId,
        deviceId: device._id,
        boot: args.boot,
        seq: args.seq,
      });
    }
    return { status: "accepted" as const, accepted: args.samples.length };
  },
});

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
