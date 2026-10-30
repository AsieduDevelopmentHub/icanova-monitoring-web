import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { BUCKET_MS, PRUNE_BATCH } from "../../convex/limits";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

function person(name: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
  };
}

function sample(overrides: Record<string, unknown> = {}) {
  return {
    t: 1000,
    age: 0,
    link: "ok",
    alm: 0,
    mode: 1,
    rpm: 1500,
    batt10: null,
    hz10: null,
    kw100: null,
    van10: null,
    ...overrides,
  };
}

async function registered() {
  const t = convexTest(schema, modules);
  const asA = t.withIdentity(person("a"));
  const organizationId = await asA.mutation(api.organizations.create, { name: "North" });
  const siteId = await asA.mutation(api.sites.create, { organizationId, name: "Yard" });
  const deviceId = await asA.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "aabbccddeeff",
  });
  const generatorId = await asA.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Set",
  });
  return { t, asA, organizationId, siteId, deviceId, generatorId };
}

describe("site generator count", () => {
  test("51 registrations stay exact and a duplicate sample does not add another", async () => {
    const { t, asA, organizationId, siteId, deviceId, generatorId } = await registered();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      epoch: 2,
      seq: 1,
      samples: [
        sample({
          kw100: -450,
          extra: { oilPressureKpa: 0, voltageL2: 230 },
          extraQuality: { oilPressureKpa: "measured", voltageL2: "measured" },
        }),
      ],
    });
    const duplicate = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      epoch: 2,
      seq: 1,
      samples: [sample({ rpm: 1 })],
    });
    expect(duplicate.status).toBe("duplicate");
    const delayed = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 99,
      epoch: 1,
      seq: 9,
      samples: [sample({ rpm: 3, link: "fail" })],
    });
    expect(delayed.status).toBe("stale");
    const after = await asA.query(api.generators.detail, { generatorId });
    expect(after.current?.rpm).toBe(1500);
    for (let index = 0; index < 50; index += 1) {
      await asA.mutation(api.generators.create, {
        organizationId,
        siteId,
        deviceId,
        name: `Set ${index}`,
      });
    }
    const summary = await asA.query(api.telemetry.siteSummary, { organizationId, siteId });
    expect(summary).toMatchObject({ generators: 51, reporting: 1, linkOk: 1 });
    const detail = await asA.query(api.generators.detail, { generatorId });
    expect(detail.current?.powerKw).toBe(-4.5);
    expect(detail.current?.extra).toMatchObject({ oilPressureKpa: 0, voltageL2: 230 });
    const moved = await asA.query(api.telemetry.siteSummary, { organizationId, siteId });
    expect(moved.linkOk).toBe(1);
    expect(moved.linkFail).toBe(0);
  });

  test("an old site is counted by paging, not by a 50-row cap", async () => {
    const { t, organizationId } = await registered();
    const siteId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("sites", { organizationId, name: "Old" });
      const deviceId = await ctx.db.insert("devices", {
        organizationId,
        siteId: id,
        name: "Old gateway",
        identity: "001122334455",
      });
      await ctx.db.insert("generators", { organizationId, siteId: id, deviceId, name: "One" });
      await ctx.db.insert("generators", { organizationId, siteId: id, deviceId, name: "Two" });
      return id;
    });
    await t.mutation(internal.generators.recountGenerators, { siteId, cursor: null, seen: 0 });
    const site = await t.run(async (ctx) => ctx.db.get(siteId));
    expect(site?.generatorCount).toBe(2);
  });
});

describe("retention prune", () => {
  test("a backlog drains in bounded batches and current telemetry stays", async () => {
    const { t, organizationId, siteId, deviceId, generatorId } = await registered();
    await t.mutation(internal.telemetry.applySample, {
      organizationId,
      generatorId,
      observedAt: Date.now(),
      sourceTime: null,
      link: "fail",
      mode: null,
      alarmCount: 0,
      rpm: null,
      rpmQuality: "unavailable",
      batteryV: null,
      batteryQuality: "unavailable",
      frequencyHz: null,
      frequencyQuality: "unavailable",
      powerKw: null,
      powerQuality: "unavailable",
      voltageL1: null,
      voltageQuality: "unavailable",
    });
    const oldStart = Date.now() - 8 * 24 * 60 * 60 * 1000;
    await t.run(async (ctx) => {
      for (let index = 0; index < PRUNE_BATCH + 5; index += 1) {
        await ctx.db.insert("telemetryBuckets", {
          organizationId,
          siteId,
          deviceId,
          generatorId,
          bucketStart: oldStart - (index + 1) * BUCKET_MS,
          updatedAt: oldStart,
          sourceTime: null,
          link: "fail",
          mode: null,
          alarmCount: 0,
          rpm: null,
          rpmQuality: "unavailable",
          batteryV: null,
          batteryQuality: "unavailable",
          frequencyHz: null,
          frequencyQuality: "unavailable",
          powerKw: null,
          powerQuality: "unavailable",
          voltageL1: null,
          voltageQuality: "unavailable",
        });
      }
    });
    expect(await t.mutation(internal.telemetry.pruneBuckets, { round: 0 })).toBe(PRUNE_BATCH);
    const mid = await t.run(async (ctx) => {
      const buckets = await ctx.db.query("telemetryBuckets").collect();
      const current = await ctx.db.query("telemetryCurrent").collect();
      const state = await ctx.db.query("retentionState").first();
      return { buckets: buckets.length, current: current.length, backlog: state?.backlog };
    });
    expect(mid).toEqual({ buckets: 6, current: 1, backlog: true });
    expect(await t.mutation(internal.telemetry.pruneBuckets, { round: 0 })).toBe(5);
    const done = await t.run(async (ctx) => ctx.db.query("telemetryBuckets").collect());
    expect(done).toHaveLength(1);
    expect(done[0]?.powerKw).toBeNull();
  });
});
