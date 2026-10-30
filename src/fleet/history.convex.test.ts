import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { BUCKET_MS } from "../../convex/limits";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const observedAt = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;

function person(name: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
  };
}

function sample(overrides: {
  observedAt?: number;
  link?: string;
  rpm?: number | null;
  rpmQuality?: "measured" | "unavailable";
  batteryV?: number | null;
  batteryQuality?: "measured" | "unavailable";
  powerKw?: number | null;
  powerQuality?: "measured" | "unavailable";
  boot?: number;
  seq?: number;
} = {}) {
  return {
    observedAt,
    sourceTime: null,
    link: "ok",
    mode: "Auto",
    alarmCount: 0,
    rpm: 1500 as number | null,
    rpmQuality: "measured" as const,
    batteryV: 24 as number | null,
    batteryQuality: "measured" as const,
    frequencyHz: 50,
    frequencyQuality: "measured" as const,
    powerKw: 10 as number | null,
    powerQuality: "measured" as const,
    voltageL1: 230,
    voltageQuality: "measured" as const,
    ...overrides,
  };
}

async function seed() {
  const t = convexTest(schema, modules);
  const asA = t.withIdentity(person("a"));
  const asC = t.withIdentity(person("c"));
  const orgA = await asA.mutation(api.organizations.create, { name: "North" });
  const orgC = await asC.mutation(api.organizations.create, { name: "South" });
  const siteA = await asA.mutation(api.sites.create, { organizationId: orgA, name: "Yard" });
  const siteC = await asC.mutation(api.sites.create, { organizationId: orgC, name: "Quay" });
  const deviceA = await asA.mutation(api.devices.create, {
    organizationId: orgA,
    siteId: siteA,
    name: "Gateway A",
    identity: "gw-a",
  });
  const generatorA = await asA.mutation(api.generators.create, {
    organizationId: orgA,
    siteId: siteA,
    deviceId: deviceA,
    name: "Set A",
  });
  return { t, asA, asC, orgA, orgC, siteA, siteC, generatorA };
}

describe("telemetry history", () => {
  test("one bucket keeps measured folds and ignores an unavailable sample", async () => {
    const { t, asA, orgA, siteA, generatorA } = await seed();
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ powerKw: 0, powerQuality: "measured", boot: 7, seq: 1 }),
    });
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({
        powerKw: -8,
        powerQuality: "measured",
        rpm: null,
        rpmQuality: "unavailable",
        boot: 7,
        seq: 2,
      }),
    });
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({
        powerKw: null,
        powerQuality: "unavailable",
        rpm: null,
        rpmQuality: "unavailable",
        batteryV: null,
        batteryQuality: "unavailable",
        seq: 3,
      }),
    });
    const series = await asA.query(api.telemetry.series, { generatorId: generatorA, range: "week" });
    expect(series.power).toHaveLength(1);
    expect(series.power[0]).toMatchObject({ value: -8, min: -8, max: 0, sum: -8, count: 2 });
    expect(series.rpm[0]?.count).toBe(1);
    expect(series.capped).toBe(false);
    const summary = await asA.query(api.telemetry.siteSummary, { organizationId: orgA, siteId: siteA });
    expect(summary).toMatchObject({
      ready: true,
      generators: 1,
      reporting: 1,
      linkOk: 1,
      linkFail: 0,
    });
    const current = await asA.query(api.telemetry.currentForSite, { organizationId: orgA, siteId: siteA });
    expect(current.rows[0]?.boot).toBe(7);
  });

  test("a later bucket does not replace an earlier one and another org cannot read it", async () => {
    const { t, asA, asC, orgA, orgC, siteA, siteC, generatorA } = await seed();
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ observedAt: observedAt - BUCKET_MS, link: "ok" }),
    });
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ link: "fail" }),
    });
    const series = await asA.query(api.telemetry.series, { generatorId: generatorA, range: "hour" });
    expect(series.rpm.map((point: { t: number }) => point.t)).toEqual([
      observedAt - BUCKET_MS,
      observedAt,
    ]);
    const summary = await asA.query(api.telemetry.siteSummary, { organizationId: orgA, siteId: siteA });
    expect(summary).toMatchObject({ reporting: 1, linkOk: 0, linkFail: 1 });
    await expect(
      asC.query(api.telemetry.series, { generatorId: generatorA, range: "day" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asC.query(api.telemetry.siteSummary, { organizationId: orgA, siteId: siteA }),
    ).rejects.toThrow(/Forbidden/);
    const empty = await asC.query(api.telemetry.siteSummary, { organizationId: orgC, siteId: siteC });
    expect(empty.ready).toBe(false);
  });
});
