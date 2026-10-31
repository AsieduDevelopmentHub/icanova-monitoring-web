import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { mapBatchStatus } from "../../convex/ingestOps";
import { HEALTH_EVENT_RETENTION_MS } from "../../convex/limits";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";
import { engineView } from "../telemetry/fleetView";

const owner = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

const stranger = {
  subject: "stranger",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|stranger",
};

async function seeded() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(owner);
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "North" });
  const siteId = await asOwner.mutation(api.sites.create, { organizationId, name: "Yard" });
  const deviceId = await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "aabbccddeeff",
  });
  await asOwner.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Set",
  });
  return { t, asOwner, organizationId, deviceId };
}

describe("ingestion observability", () => {
  test("maps batch statuses and records hourly counters without secrets", async () => {
    expect(mapBatchStatus("accepted")).toBe("accepted");
    expect(mapBatchStatus("stale")).toBe("duplicate");
    expect(mapBatchStatus("inactive")).toBe("inactive");
    const { t, asOwner, organizationId } = await seeded();
    await t.mutation(internal.ingestOps.record, { kind: "accepted", organizationId });
    await t.mutation(internal.ingestOps.record, { kind: "duplicate", organizationId });
    await t.mutation(internal.ingestOps.record, { kind: "rate_limited", organizationId });
    await t.mutation(internal.ingestOps.record, { kind: "auth_failed", organizationId: null });
    const current = await asOwner.query(api.ingestOps.current, { organizationId });
    expect(current.organization.accepted).toBe(1);
    expect(current.organization.duplicate).toBe(1);
    expect(current.organization.rateLimited).toBe(1);
    expect(current.global.authFailed).toBe(1);
    expect(JSON.stringify(current)).not.toMatch(/Bearer |INGEST_SECRET|password/i);
  });

  test("inactive device ingest increments inactive counter path via acceptBatch", async () => {
    const { t, asOwner, organizationId, deviceId } = await seeded();
    await asOwner.mutation(api.devices.setLifecycle, { deviceId, lifecycle: "inactive" });
    const result = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 1,
      samples: [
        {
          t: 1,
          age: 0,
          link: "ok",
          alm: 0,
          mode: null,
          rpm: null,
          batt10: null,
          hz10: null,
          kw100: null,
          van10: null,
        },
      ],
    });
    expect(result.status).toBe("inactive");
    await t.mutation(internal.ingestOps.record, {
      kind: mapBatchStatus(result.status),
      organizationId,
    });
    const current = await asOwner.query(api.ingestOps.current, { organizationId });
    expect(current.organization.inactive).toBe(1);
  });
});

describe("ops overview and health independence", () => {
  test("overview returns separated dimensions and denies cross-tenant", async () => {
    const { t, asOwner, organizationId } = await seeded();
    await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "aabbccddeeff" });
    await t.mutation(internal.telemetry.pruneBuckets, {});
    const overview = await asOwner.query(api.ops.overview, { organizationId });
    expect(overview.fleet).not.toMatchObject({ denied: true });
    const fleet = overview.fleet as { gatewayOnline: number; modbusOk: number };
    expect(fleet.gatewayOnline).toBeGreaterThanOrEqual(0);
    expect(fleet.modbusOk).toBeGreaterThanOrEqual(0);
    expect(overview.dimensionsNote).toMatch(/independent/i);
    expect(engineView(null, "unavailable").label).toBe("Unreported");
    expect(engineView(null, "unavailable").label).not.toBe("Stopped");
    expect(JSON.stringify(overview)).not.toMatch(/INGEST_SECRET|RESEND_API_KEY|Bearer /);

    const asStranger = t.withIdentity(stranger);
    await asStranger.mutation(api.organizations.create, { name: "Other" });
    await expect(asStranger.query(api.ops.overview, { organizationId })).rejects.toThrow();
  });

  test("manage.devices alone cannot open ops; section perms are independent", async () => {
    const { t, asOwner, organizationId } = await seeded();
    const limited = {
      subject: "viewer",
      issuer: "https://issuer.test",
      tokenIdentifier: "https://issuer.test|viewer",
    };
    const asViewer = t.withIdentity(limited);
    await asViewer.mutation(api.organizations.create, { name: "ViewerOrg" });
    const me = await asViewer.query(api.users.me, {});
    expect(me).not.toBeNull();

    const devicesOnly = await asOwner.mutation(api.organizations.createRole, {
      organizationId,
      name: "Devices only",
      permissions: ["manage.devices", "view.dashboard"],
    });
    await asOwner.mutation(api.organizations.grant, {
      organizationId,
      userId: me!._id,
      roleId: devicesOnly,
    });
    await expect(asViewer.query(api.ops.overview, { organizationId })).rejects.toThrow();

    const alarmsOnly = await asOwner.mutation(api.organizations.createRole, {
      organizationId,
      name: "Alarms ops",
      permissions: ["view.alarms", "view.dashboard"],
    });
    await asOwner.mutation(api.organizations.grant, {
      organizationId,
      userId: me!._id,
      roleId: alarmsOnly,
    });
    const alarmsView = await asViewer.query(api.ops.overview, { organizationId });
    expect(alarmsView.alarms).toMatchObject({ activeOrAckInRecentPage: expect.any(Number) });
    expect(alarmsView.fleet).toMatchObject({ denied: true, required: "view.diagnostics" });
    expect(alarmsView.audit).toMatchObject({ denied: true, required: "view.audit" });
    expect(alarmsView.notifications).toMatchObject({
      denied: true,
      required: "configure.notifications",
    });

    const diagOnly = await asOwner.mutation(api.organizations.createRole, {
      organizationId,
      name: "Diagnostics ops",
      permissions: ["view.diagnostics", "view.dashboard"],
    });
    await asOwner.mutation(api.organizations.grant, {
      organizationId,
      userId: me!._id,
      roleId: diagOnly,
    });
    const diagView = await asViewer.query(api.ops.overview, { organizationId });
    expect(diagView.sections.diagnostics).toBe(true);
    expect(diagView.fleet).not.toMatchObject({ denied: true });
    expect(diagView.audit).toMatchObject({ denied: true, required: "view.audit" });
    expect(diagView.notifications).toMatchObject({ denied: true });
    expect(diagView.alarms).toMatchObject({ denied: true, required: "view.alarms" });
  });

  test("10k fleet tallies remain incremental without a scan", async () => {
    const { shiftHealthTallies, EMPTY_HEALTH_TALLIES } = await import(
      "../../convex/deviceHealthLogic"
    );
    let tallies = { ...EMPTY_HEALTH_TALLIES };
    const snap = {
      gatewayStatus: "online" as const,
      modbusStatus: "ok" as const,
      telemetryFreshness: "fresh" as const,
      overallStatus: "healthy" as const,
    };
    for (let i = 0; i < 10_000; i += 1) {
      tallies = shiftHealthTallies(tallies, null, snap, false);
    }
    expect(tallies.devicesTracked).toBe(10_000);
    expect(tallies.gatewayOnline).toBe(10_000);
  });
});

describe("retention", () => {
  test("health event prune removes only aged rows and leaves alarms/audits", async () => {
    const { t, asOwner, organizationId, deviceId } = await seeded();
    await t.mutation(internal.deviceHealth.recordHeartbeat, { identity: "aabbccddeeff" });
    const aged = Date.now() - HEALTH_EVENT_RETENTION_MS - 60_000;
    await t.run(async (ctx) => {
      const events = await ctx.db.query("deviceHealthEvents").collect();
      for (const row of events) {
        await ctx.db.patch(row._id, { at: aged });
      }
      await ctx.db.insert("alarms", {
        organizationId,
        siteId: (await ctx.db.get(deviceId))!.siteId,
        deviceId,
        generatorId: null,
        kind: "transport",
        state: "active",
        summary: "keep",
        detail: "keep",
        raisedAt: Date.now(),
        sourceTime: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        assignedTo: null,
        clearedAt: null,
        resolvedAt: null,
        resolvedBy: null,
      });
    });
    const pruned = await t.mutation(internal.deviceHealth.pruneHealthEvents, {});
    expect(pruned.deleted).toBeGreaterThanOrEqual(1);
    const remaining = await t.run(async (ctx) => ({
      events: await ctx.db.query("deviceHealthEvents").collect(),
      alarms: await ctx.db.query("alarms").collect(),
      audits: await ctx.db.query("audits").collect(),
    }));
    expect(remaining.events.every((row) => row.at >= Date.now() - HEALTH_EVENT_RETENTION_MS)).toBe(
      true,
    );
    expect(remaining.alarms).toHaveLength(1);
    expect(remaining.audits.length).toBeGreaterThan(0);
    void asOwner;
  });
});
