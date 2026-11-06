import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const identity = {
  subject: "runtime-owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|runtime-owner",
};

async function seed() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(identity);
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "Runtime Org" });
  const siteId = await asOwner.mutation(api.sites.create, {
    organizationId,
    name: "Runtime Site",
  });
  const deviceId = await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Runtime Gateway",
    identity: "runtime-device",
  });
  const generatorId = await asOwner.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Generator 1",
  });
  return { t, asOwner, organizationId, siteId, generatorId };
}

async function sample(
  t: ReturnType<typeof convexTest>,
  organizationId: Awaited<ReturnType<typeof seed>>["organizationId"],
  generatorId: Awaited<ReturnType<typeof seed>>["generatorId"],
  rpm: number,
  mainsVoltage: number,
  engineHours?: number,
  genEnergyKwh?: number,
  activePowerL1?: number,
  apparentPowerL1?: number,
  powerFactorL1?: number,
  powerFactorQuality: "measured" | "invalid" = "measured",
) {
  const extra: Record<string, number | null> = { mainsL1: mainsVoltage };
  const extraQuality: Record<string, "measured" | "invalid"> = { mainsL1: "measured" };
  if (engineHours !== undefined) {
    extra.engineHours = engineHours;
    extraQuality.engineHours = "measured";
  }
  if (genEnergyKwh !== undefined) {
    extra.genEnergyKwh = genEnergyKwh;
    extraQuality.genEnergyKwh = "measured";
  }
  if (activePowerL1 !== undefined) {
    extra.powerL1W = activePowerL1;
    extraQuality.powerL1W = "measured";
  }
  if (apparentPowerL1 !== undefined) {
    extra.apparentL1Va = apparentPowerL1;
    extraQuality.apparentL1Va = "measured";
  }
  if (powerFactorL1 !== undefined) {
    extra.pfL1 = powerFactorL1;
    extraQuality.pfL1 = powerFactorQuality;
  }
  await t.mutation(internal.telemetry.applySample, {
    organizationId,
    generatorId,
    observedAt: Date.now(),
    sourceTime: null,
    link: "ok",
    mode: "Auto",
    alarmCount: 0,
    rpm,
    rpmQuality: "measured",
    batteryV: null,
    batteryQuality: "unavailable",
    frequencyHz: null,
    frequencyQuality: "unavailable",
    powerKw: null,
    powerQuality: "unavailable",
    voltageL1: null,
    voltageQuality: "unavailable",
    extra,
    extraQuality,
  });
}

describe("continuous source runtime", () => {
  test("tracks generator and mains run starts and clears them after a measured stop", async () => {
    const { t, asOwner, organizationId, siteId, generatorId } = await seed();
    await sample(t, organizationId, generatorId, 1500, 230);
    const first = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
    const firstRow = first.rows[0];
    expect(firstRow).toMatchObject({
      generatorRunning: true,
      mainsAvailable: true,
    });
    expect(firstRow.generatorRunningSince).toBeTypeOf("number");
    expect(firstRow.mainsAvailableSince).toBeTypeOf("number");
    expect(firstRow.monthlySourceMetrics?.generatorEnergyKwh).toBeNull();
    expect(firstRow.monthlySourceMetrics?.generatorRunHours).toBeNull();

    await sample(t, organizationId, generatorId, 1500, 230);
    const second = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
    expect(second.rows[0].generatorRunningSince).toBe(firstRow.generatorRunningSince);
    expect(second.rows[0].mainsAvailableSince).toBe(firstRow.mainsAvailableSince);

    await sample(t, organizationId, generatorId, 0, 230);
    const stopped = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
    expect(stopped.rows[0]).toMatchObject({
      generatorRunning: false,
      generatorRunningSince: null,
      mainsAvailable: true,
    });
    expect(stopped.rows[0].mainsAvailableSince).toBe(firstRow.mainsAvailableSince);

    await sample(t, organizationId, generatorId, 0, 0);
    const noSource = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
    expect(noSource.rows[0]).toMatchObject({
      generatorRunning: false,
      generatorRunningSince: null,
      mainsAvailable: false,
      mainsAvailableSince: null,
    });
  });

  test("tracks generator counter deltas and observed mains-source hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00.000Z"));
    try {
      const { t, asOwner, organizationId, siteId, generatorId } = await seed();
      await sample(t, organizationId, generatorId, 1500, 230, 10, 500, 800, 1000);
      vi.advanceTimersByTime(60_000);
      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000);

      const current = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
      expect(current.rows[0]?.monthlySourceMetrics).toMatchObject({
        monthStart: Date.UTC(2026, 2, 1),
        generatorEnergyKwh: 0.5,
        generatorRunHours: 1.25,
        mainsUsageHours: 0,
      });
      expect(current.rows[0]?.monthlySourceMetrics?.mainsAvailableHours).toBeCloseTo(1 / 60, 5);
      expect(current.rows[0]?.monthlySourceMetrics?.mainsUsageHours).toBe(0);
      expect(current.rows[0]?.monthlySourceMetrics?.generatorEnergySince).toBeTypeOf("number");
      expect(current.rows[0]?.monthlySourceMetrics?.generatorRunHoursSince).toBeTypeOf("number");
      expect(current.rows[0]?.monthlySourceMetrics?.mainsAvailableSince).toBeTypeOf("number");
      expect(current.rows[0]?.monthlySourceMetrics?.mainsUsageSince).toBeTypeOf("number");

      await sample(t, organizationId, generatorId, 0, 230, 11.25, 500.5, 800, 1000);
      vi.advanceTimersByTime(60_000);
      await sample(t, organizationId, generatorId, 0, 230, 11.25, 500.5, 800, 1000);
      const onMains = await asOwner.query(api.telemetry.currentForSite, { organizationId, siteId });
      expect(onMains.rows[0]?.monthlySourceMetrics?.mainsUsageHours).toBeCloseTo(1 / 60, 5);

      vi.advanceTimersByTime(60_000);
      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000);
      vi.advanceTimersByTime(60_000);
      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000);
      const onGenerator = await asOwner.query(api.telemetry.currentForSite, {
        organizationId,
        siteId,
      });
      expect(onGenerator.rows[0]?.monthlySourceMetrics?.mainsUsageHours).toBeCloseTo(1 / 60, 5);

      expect(current.rows[0]?.powerFactorByPhase.L1).toEqual({ value: 0.8, source: "calculated" });
      expect(current.rows[0]?.powerFactorByPhase.L2.value).toBeNull();

      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000, 0.75);
      const withControllerFactor = await asOwner.query(api.telemetry.currentForSite, {
        organizationId,
        siteId,
      });
      expect(withControllerFactor.rows[0]?.powerFactorByPhase.L1).toEqual({
        value: 0.75,
        source: "controller",
      });

      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000, 0.75, "invalid");
      const withInvalidControllerFactor = await asOwner.query(api.telemetry.currentForSite, {
        organizationId,
        siteId,
      });
      expect(withInvalidControllerFactor.rows[0]?.powerFactorByPhase.L1).toEqual({
        value: 0.8,
        source: "calculated",
      });

      await sample(t, organizationId, generatorId, 1500, 230, 11.25, 500.5, 800, 1000, 1.2);
      const withOutOfRangeControllerFactor = await asOwner.query(api.telemetry.currentForSite, {
        organizationId,
        siteId,
      });
      expect(withOutOfRangeControllerFactor.rows[0]?.powerFactorByPhase.L1).toEqual({
        value: 0.8,
        source: "calculated",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
