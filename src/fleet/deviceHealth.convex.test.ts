import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";
import { HEALTH_STALE_MS } from "../../convex/limits";

const identity = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

const outsider = {
  subject: "other",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|other",
};

function sample(overrides: Record<string, unknown> = {}) {
  return {
    t: 1000,
    age: 2,
    link: "ok",
    alm: 0,
    mode: null,
    rpm: null,
    batt10: null,
    hz10: null,
    kw100: null,
    van10: null,
    ...overrides,
  };
}

async function registered() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(identity);
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "North" });
  const siteId = await asOwner.mutation(api.sites.create, { organizationId, name: "Yard" });
  const deviceId = await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "aabbccddeeff",
  });
  const generatorId = await asOwner.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Set",
  });
  return { t, asOwner, organizationId, siteId, deviceId, generatorId };
}

describe("device health", () => {
  test("heartbeat marks gateway online without inventing telemetry or Modbus", async () => {
    const { t, asOwner, deviceId } = await registered();
    const first = await t.mutation(internal.deviceHealth.recordHeartbeat, {
      identity: "aabbccddeeff",
    });
    expect(first).toMatchObject({ status: "ok" });
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health).toMatchObject({
      gatewayStatus: "online",
      modbusStatus: "unknown",
      telemetryFreshness: "missing",
      lastHeartbeatAt: expect.any(Number),
      lastTelemetryAt: null,
      link: null,
    });
    expect(health?.overallStatus).not.toBe("healthy");
    const again = await t.mutation(internal.deviceHealth.recordHeartbeat, {
      identity: "aabbccddeeff",
    });
    expect(again).toMatchObject({ status: "ok" });
    const events = await asOwner.query(api.deviceHealth.listEvents, {
      deviceId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(events.page.length).toBe(1);
  });

  test("unknown and ambiguous identities do not write health", async () => {
    const { t } = await registered();
    expect(await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "001122334455" })).toEqual({
      status: "unknown",
    });
    const bare = convexTest(schema, modules);
    const owner = bare.withIdentity(identity);
    const organizationId = await owner.mutation(api.organizations.create, { name: "A" });
    const organizationIdB = await owner.mutation(api.organizations.create, { name: "B" });
    const siteA = await owner.mutation(api.sites.create, { organizationId, name: "A" });
    const siteB = await owner.mutation(api.sites.create, {
      organizationId: organizationIdB,
      name: "B",
    });
    await owner.mutation(api.devices.create, {
      organizationId,
      siteId: siteA,
      name: "One",
      identity: "112233445566",
    });
    await owner.mutation(api.devices.create, {
      organizationId: organizationIdB,
      siteId: siteB,
      name: "Two",
      identity: "112233445566",
    });
    expect(
      await bare.mutation(internal.deviceHealth.recordHeartbeat, { identity: "112233445566" }),
    ).toEqual({ status: "ambiguous" });
  });

  test("accepted batch updates Modbus, freshness, and gateway contact", async () => {
    const { t, asOwner, deviceId, organizationId, siteId } = await registered();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 1,
      samples: [sample({ link: "ok", rpm: 1500 })],
    });
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health).toMatchObject({
      gatewayStatus: "online",
      modbusStatus: "ok",
      telemetryFreshness: "fresh",
      overallStatus: "healthy",
      lastAcceptedBatchAt: expect.any(Number),
      lastTelemetryAt: expect.any(Number),
      link: "ok",
    });
    const site = await asOwner.query(api.deviceHealth.siteHealthSummary, {
      organizationId,
      siteId,
    });
    expect(site).toMatchObject({
      ready: true,
      devicesTracked: 1,
      gatewayOnline: 1,
      modbusOk: 1,
      telemetryFresh: 1,
      overallHealthy: 1,
    });
    const org = await asOwner.query(api.deviceHealth.orgSummary, { organizationId });
    expect(org).toMatchObject({ ready: true, devicesTracked: 1, gatewayOnline: 1 });
  });

  test("sweep marks gateway offline and telemetry stale after the freshness window", async () => {
    const { t, asOwner, deviceId } = await registered();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 2,
      seq: 1,
      samples: [sample({ link: "ok" })],
    });
    const aged = Date.now() - HEALTH_STALE_MS - 5_000;
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("deviceHealthCurrent")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
        .unique();
      expect(row).toBeTruthy();
      await ctx.db.patch(row!._id, {
        lastGatewayContactAt: aged,
        lastHeartbeatAt: aged,
        lastAcceptedBatchAt: aged,
        lastTelemetryAt: aged,
      });
    });
    await t.mutation(internal.deviceHealth.sweep, {});
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health).toMatchObject({
      gatewayStatus: "offline",
      telemetryFreshness: "stale",
      overallStatus: "unhealthy",
    });
  });

  test("gateway recovery after offline emits once when policy is enabled", async () => {
    const { t, asOwner, organizationId, deviceId } = await registered();
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: null,
    });
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: null,
      phone: null,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "inapp",
      event: "health.gateway.offline",
      enabled: true,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "inapp",
      event: "health.gateway.recovered",
      enabled: true,
    });
    await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "aabbccddeeff" });
    const aged = Date.now() - HEALTH_STALE_MS - 1_000;
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("deviceHealthCurrent")
        .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
        .unique();
      await ctx.db.patch(row!._id, {
        lastGatewayContactAt: aged,
        lastHeartbeatAt: aged,
      });
    });
    await t.mutation(internal.deviceHealth.sweep, {});
    const offline = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(offline?.gatewayStatus).toBe("offline");
    expect(offline?.gatewayOfflineNotified).toBe(true);
    await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "aabbccddeeff" });
    const recovered = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(recovered?.gatewayStatus).toBe("online");
    expect(recovered?.gatewayOfflineNotified).toBe(false);
    const inbox = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: false,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const events = inbox.page.map((row) => row.event);
    expect(events.filter((e) => e === "health.gateway.offline")).toHaveLength(1);
    expect(events.filter((e) => e === "health.gateway.recovered")).toHaveLength(1);
  });

  test("Modbus fail raises a communication alarm without a health.modbus notify event", async () => {
    const { t, asOwner, organizationId, deviceId } = await registered();
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: null,
    });
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: null,
      phone: null,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "inapp",
      event: "alarm.raised",
      enabled: true,
    });
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 3,
      seq: 1,
      samples: [sample({ link: "ok" })],
    });
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 3,
      seq: 2,
      samples: [sample({ link: "fail" })],
    });
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health?.modbusStatus).toBe("fail");
    const inbox = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: false,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(inbox.page.some((row) => row.event === "alarm.raised")).toBe(true);
    expect(
      inbox.page.some((row) => row.event.startsWith("health.") && row.event.includes("modbus")),
    ).toBe(false);
    const events = await asOwner.query(api.deviceHealth.listEvents, {
      deviceId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(events.page.some((row) => row.modbusTo === "fail")).toBe(true);
  });

  test("cross-tenant health reads are denied", async () => {
    const { t, deviceId, organizationId } = await registered();
    const asOther = t.withIdentity(outsider);
    await asOther.mutation(api.organizations.create, { name: "Other" });
    await expect(asOther.query(api.deviceHealth.getForDevice, { deviceId })).rejects.toThrow();
    await expect(
      asOther.query(api.deviceHealth.orgSummary, { organizationId }),
    ).rejects.toThrow();
  });

  test("health writes are internal; clients only read and may request reconcile", async () => {
    const { t, asOwner, deviceId, siteId } = await registered();
    expect(api.deviceHealth.getForDevice).toBeTruthy();
    expect(api.deviceHealth.requestSiteReconcile).toBeTruthy();
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health).toBeNull();
    const after = await t.mutation(internal.deviceHealth.recordHeartbeat, {
      identity: "aabbccddeeff",
    });
    expect(after.status).toBe("ok");
    await asOwner.mutation(api.deviceHealth.requestSiteReconcile, { siteId });
  });

  test("heartbeat does not require a prior Modbus sample", async () => {
    const { t, asOwner, deviceId } = await registered();
    await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "aabbccddeeff" });
    const health = await asOwner.query(api.deviceHealth.getForDevice, { deviceId });
    expect(health?.gatewayStatus).toBe("online");
    expect(health?.modbusStatus).toBe("unknown");
    expect(health?.link).toBeNull();
  });
});
