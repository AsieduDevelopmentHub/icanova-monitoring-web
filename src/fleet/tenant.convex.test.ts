import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { BUCKET_MS } from "../../convex/limits";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const observedAt = 1_700_000_000_000;
const page = { numItems: 20, cursor: null };

function person(name: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
  };
}

function sample(overrides: {
  observedAt?: number;
  rpm?: number;
  rpmQuality?: "measured" | "under-range";
  powerKw?: number | null;
  powerQuality?: "measured" | "under-range" | "unavailable";
} = {}) {
  return {
    observedAt,
    sourceTime: null,
    link: "ok",
    mode: "Auto",
    alarmCount: 0,
    rpm: 0,
    rpmQuality: "measured" as const,
    batteryV: null,
    batteryQuality: "unavailable" as const,
    frequencyHz: null,
    frequencyQuality: "unavailable" as const,
    powerKw: null as number | null,
    powerQuality: "unavailable" as const,
    voltageL1: null,
    voltageQuality: "unavailable" as const,
    ...overrides,
  };
}

async function seed() {
  const t = convexTest(schema, modules);
  const asA = t.withIdentity(person("a"));
  const asB = t.withIdentity(person("b"));
  const asC = t.withIdentity(person("c"));
  const orgA = await asA.mutation(api.organizations.create, { name: "North" });
  const orgC = await asC.mutation(api.organizations.create, { name: "South" });
  const userB = await asB.mutation(api.users.ensure, {});
  const roleB = await asA.mutation(api.organizations.createRole, {
    organizationId: orgA,
    name: "Viewer",
    permissions: ["view.dashboard"],
  });
  await asA.mutation(api.organizations.grant, {
    organizationId: orgA,
    userId: userB,
    roleId: roleB,
  });
  const siteA = await asA.mutation(api.sites.create, { organizationId: orgA, name: "Yard" });
  const siteC = await asC.mutation(api.sites.create, { organizationId: orgC, name: "Quay" });
  const deviceA = await asA.mutation(api.devices.create, {
    organizationId: orgA,
    siteId: siteA,
    name: "Gateway A",
    identity: "gw-a",
  });
  const deviceC = await asC.mutation(api.devices.create, {
    organizationId: orgC,
    siteId: siteC,
    name: "Gateway C",
    identity: "gw-c",
  });
  const generatorA = await asA.mutation(api.generators.create, {
    organizationId: orgA,
    siteId: siteA,
    deviceId: deviceA,
    name: "Set A",
  });
  const generatorC = await asC.mutation(api.generators.create, {
    organizationId: orgC,
    siteId: siteC,
    deviceId: deviceC,
    name: "Set C",
  });
  return { t, asA, asB, asC, orgA, orgC, siteA, siteC, deviceA, deviceC, generatorA, generatorC };
}

describe("tenant isolation", () => {
  test("an outsider cannot read another organization", async () => {
    const { t, asA, asB, asC, orgA, orgC, siteA, siteC, generatorA, generatorC } = await seed();
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ rpm: 1500, rpmQuality: "measured" }),
    });
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgC,
      generatorId: generatorC,
      ...sample({ rpm: 900, rpmQuality: "measured" }),
    });

    const own = await asA.query(api.telemetry.currentForSite, {
      organizationId: orgA,
      siteId: siteA,
    });
    expect(own.rows.map((row: { name: string; rpm: number | null }) => [row.name, row.rpm])).toEqual([
      ["Set A", 1500],
    ]);

    await expect(
      t.query(api.telemetry.currentForSite, { organizationId: orgA, siteId: siteA }),
    ).rejects.toThrow(/Unauthorized/);
    await expect(
      asC.query(api.telemetry.currentForSite, { organizationId: orgA, siteId: siteA }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asA.query(api.telemetry.currentForSite, { organizationId: orgA, siteId: siteC }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asB.query(api.telemetry.currentForSite, { organizationId: orgA, siteId: siteA }),
    ).rejects.toThrow(/Forbidden/);
    await expect(asC.query(api.generators.detail, { generatorId: generatorA })).rejects.toThrow(
      /Forbidden/,
    );
    await expect(asC.query(api.telemetry.history, { generatorId: generatorA, paginationOpts: page })).rejects.toThrow(
      /Forbidden/,
    );
    await expect(asB.query(api.sites.list, { organizationId: orgC, paginationOpts: page })).rejects.toThrow(
      /Forbidden/,
    );

    const sites = await asB.query(api.sites.list, { organizationId: orgA, paginationOpts: page });
    expect(sites.page.map((site: { name: string }) => site.name)).toEqual(["Yard"]);
    await expect(
      asB.mutation(api.sites.create, { organizationId: orgA, name: "Blocked" }),
    ).rejects.toThrow(/Forbidden/);

    const mineA = await asA.query(api.organizations.mine, {});
    expect(mineA.map((org: { name: string }) => org.name)).toEqual(["North"]);
    expect(await t.query(api.organizations.mine, {})).toEqual([]);
  });

  test("the same gateway identity can exist in another organization only", async () => {
    const { asA, asC, orgA, orgC, siteA, siteC } = await seed();
    await asA.mutation(api.devices.create, {
      organizationId: orgA,
      siteId: siteA,
      name: "Second",
      identity: "shared-mac",
    });
    await expect(
      asA.mutation(api.devices.create, {
        organizationId: orgA,
        siteId: siteA,
        name: "Duplicate",
        identity: "shared-mac",
      }),
    ).rejects.toThrow(/Already registered/);
    const other = await asC.mutation(api.devices.create, {
      organizationId: orgC,
      siteId: siteC,
      name: "Other",
      identity: "shared-mac",
    });
    expect(other).toBeTruthy();
  });

  test("current telemetry is replaced and a non-measured zero is stored as null", async () => {
    const { t, asA, orgA, generatorA } = await seed();
    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ rpm: 0, rpmQuality: "under-range", powerKw: -454, powerQuality: "measured" }),
    });
    const first = await asA.query(api.generators.detail, { generatorId: generatorA });
    expect(first.current).toEqual(
      expect.objectContaining({
        rpm: null,
        rpmQuality: "under-range",
        powerKw: -454,
        powerQuality: "measured",
        sourceTime: null,
      }),
    );

    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({
        observedAt: observedAt + 1000,
        rpm: 0,
        rpmQuality: "measured",
        powerKw: 0,
        powerQuality: "under-range",
      }),
    });
    const second = await asA.query(api.generators.detail, { generatorId: generatorA });
    expect(second.current).toEqual(
      expect.objectContaining({
        rpm: 0,
        rpmQuality: "measured",
        powerKw: null,
        powerQuality: "under-range",
      }),
    );

    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ observedAt: observedAt + BUCKET_MS, rpm: 1587, rpmQuality: "measured" }),
    });

    const detail = await asA.query(api.generators.detail, { generatorId: generatorA });
    expect(detail.current).toEqual(expect.objectContaining({ rpm: 1587, rpmQuality: "measured" }));

    const counts = await t.run(async (ctx) => {
      const current = await ctx.db.query("telemetryCurrent").collect();
      const buckets = await ctx.db.query("telemetryBuckets").collect();
      return { current: current.length, buckets: buckets.length };
    });
    expect(counts).toEqual({ current: 1, buckets: 2 });

    const history = await asA.query(api.telemetry.history, {
      generatorId: generatorA,
      paginationOpts: { numItems: 500, cursor: null },
    });
    expect(history.page.length).toBeLessThanOrEqual(50);
    expect(history.page.length).toBe(2);
    const noPublicIngest: "applySample" extends keyof typeof api.telemetry ? never : true = true;
    expect(noPublicIngest).toBe(true);
  });

  test("site pages are clamped and old buckets can be pruned without deleting current", async () => {
    const { t, asA, orgA, generatorA } = await seed();
    for (let index = 0; index < 51; index += 1) {
      await asA.mutation(api.sites.create, { organizationId: orgA, name: `Site ${index}` });
    }
    const listed = await asA.query(api.sites.list, {
      organizationId: orgA,
      paginationOpts: { numItems: 500, cursor: null },
    });
    expect(listed.page.length).toBeLessThanOrEqual(50);
    expect(listed.isDone).toBe(false);

    await t.mutation(internal.telemetry.applySample, {
      organizationId: orgA,
      generatorId: generatorA,
      ...sample({ observedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, rpm: 10, rpmQuality: "measured" }),
    });
    expect(await t.mutation(internal.telemetry.pruneBuckets, {})).toBe(1);
    const left = await t.run(async (ctx) => {
      const current = await ctx.db.query("telemetryCurrent").collect();
      const buckets = await ctx.db.query("telemetryBuckets").collect();
      return { current: current.length, buckets: buckets.length };
    });
    expect(left).toEqual({ current: 1, buckets: 0 });
  });

  test("a file url stays inside the owning organization", async () => {
    const { t, asA, asB, asC, orgA } = await seed();
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["note"])));
    await asA.mutation(api.storage.saveFile, {
      organizationId: orgA,
      storageId,
      name: "note.txt",
    });
    expect(await asA.query(api.storage.fileUrl, { storageId })).toEqual(expect.any(String));
    expect(await asB.query(api.storage.fileUrl, { storageId })).toBeNull();
    await expect(asC.query(api.storage.fileUrl, { storageId })).rejects.toThrow(/Forbidden/);
    await expect(
      asB.query(internal.authz.gate, {
        organizationId: orgA,
        permission: "configure.notifications",
      }),
    ).rejects.toThrow(/Forbidden/);
  });

  test("audit pages do not cross organizations", async () => {
    const { asA, asC, orgA, orgC } = await seed();
    const own = await asA.query(api.audits.list, {
      organizationId: orgA,
      paginationOpts: page,
    });
    expect(own.page.length).toBeGreaterThan(0);
    expect(own.page.every((row: { organizationId: string }) => row.organizationId === orgA)).toBe(true);
    await expect(
      asC.query(api.audits.list, { organizationId: orgA, paginationOpts: page }),
    ).rejects.toThrow(/Forbidden/);
    const south = await asC.query(api.audits.list, {
      organizationId: orgC,
      paginationOpts: page,
    });
    expect(south.page.every((row: { organizationId: string }) => row.organizationId === orgC)).toBe(true);
  });

  test("alarm changes stay in the organization and do not skip acknowledgement", async () => {
    const { asA, asB, asC, orgA, orgC, siteA, deviceA } = await seed();
    const me = await asA.query(api.users.me, {});
    const outsider = await asC.query(api.users.me, {});
    const reader = await asB.query(api.users.me, {});
    if (!me || !outsider || !reader) {
      throw new Error("missing user");
    }
    const readerRole = await asA.mutation(api.organizations.createRole, {
      organizationId: orgA,
      name: "Alarm reader",
      permissions: ["view.alarms"],
    });
    await asA.mutation(api.organizations.grant, {
      organizationId: orgA,
      userId: reader._id,
      roleId: readerRole,
    });
    const alarmId = await asA.mutation(api.alarms.raise, {
      organizationId: orgA,
      siteId: siteA,
      deviceId: deviceA,
      generatorId: null,
      kind: "transport",
      summary: "CRC fail on batch",
      detail: "Result crc at 1408",
      sourceTime: null,
    });
    await expect(asB.mutation(api.alarms.acknowledge, { alarmId })).rejects.toThrow(/Forbidden/);
    await expect(asC.query(api.alarms.detail, { alarmId })).rejects.toThrow(/Forbidden/);
    await expect(asA.mutation(api.alarms.resolve, { alarmId })).rejects.toThrow(/Invalid transition/);
    const visible = await asB.query(api.alarms.list, {
      organizationId: orgA,
      state: "active",
      kind: "transport",
      deviceId: null,
      search: "1408",
      paginationOpts: page,
    });
    expect(visible.rows).toHaveLength(1);
    await asA.mutation(api.alarms.acknowledge, { alarmId });
    await expect(asA.mutation(api.alarms.acknowledge, { alarmId })).rejects.toThrow(/Invalid transition/);
    await asA.mutation(api.alarms.comment, { alarmId, body: "Checked the frame" });
    await expect(
      asA.mutation(api.alarms.assign, { alarmId, userId: outsider._id }),
    ).rejects.toThrow(/Forbidden/);
    await asA.mutation(api.alarms.assign, { alarmId, userId: me._id });
    await asA.mutation(api.alarms.resolve, { alarmId });
    const detail = await asA.query(api.alarms.detail, { alarmId });
    expect(detail.alarm.state).toBe("resolved");
    expect(detail.alarm.kind).toBe("transport");
    expect(detail.comments.map((item) => item.body)).toEqual(["Checked the frame"]);
    expect(detail.events.map((event) => event.action)).toEqual([
      "raise",
      "acknowledge",
      "comment",
      "assign",
      "resolve",
    ]);
    const controller = await asA.query(api.alarms.list, {
      organizationId: orgA,
      state: "all",
      kind: "controller",
      deviceId: null,
      search: "CRC",
      paginationOpts: page,
    });
    expect(controller.rows).toHaveLength(0);
    const south = await asC.query(api.alarms.list, {
      organizationId: orgC,
      state: "all",
      kind: "all",
      deviceId: null,
      search: "CRC",
      paginationOpts: page,
    });
    expect(south.rows).toHaveLength(0);
  });

  test("diagnostics stay on the device and a CRC pass is not a successful poll", async () => {
    const { t, asA, asB, asC, orgA, orgC, deviceA } = await seed();
    await t.mutation(internal.diagnostics.record, {
      organizationId: orgA,
      deviceId: deviceA,
      kind: "frame",
      txn: 43,
      functionCode: "0x10",
      address: 4104,
      quantity: 2,
      tx: "01 10 10 08",
      rx: "33 03 75 30 00 1A DA 10",
      rxLength: 8,
      receivedCrc: "0x10DA",
      calculatedCrc: "0x10DA",
      crcResult: "PASS",
      result: "INVALID MODBUS FRAME (CRC)",
      latencyMs: 305,
      retries: null,
      note: "Do NOT treat this as a valid exception.",
      sourceTime: null,
    });
    const invalid = await asA.query(api.diagnostics.list, {
      deviceId: deviceA,
      kind: "frame",
      search: "0x10",
    });
    expect(invalid.rows).toHaveLength(1);
    expect(invalid.poll).toBeNull();
    expect(invalid.rows[0]?.retries).toBeNull();
    await expect(
      asB.query(api.diagnostics.list, { deviceId: deviceA, kind: "all", search: "" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asC.query(api.diagnostics.list, { deviceId: deviceA, kind: "all", search: "" }),
    ).rejects.toThrow(/Forbidden/);
    await t.mutation(internal.diagnostics.record, {
      organizationId: orgA,
      deviceId: deviceA,
      kind: "frame",
      txn: 44,
      functionCode: "0x3",
      address: 4096,
      quantity: 8,
      tx: "01 03 10 00 00 08 40 CC",
      rx: "01 03 10",
      rxLength: 21,
      receivedCrc: "0x151E",
      calculatedCrc: "0x151E",
      crcResult: "PASS",
      result: "VALID MODBUS RESPONSE",
      latencyMs: 1,
      retries: null,
      note: null,
      sourceTime: null,
    });
    const good = await asA.query(api.diagnostics.list, {
      deviceId: deviceA,
      kind: "all",
      search: "",
    });
    expect(good.poll).toMatchObject({ label: "TXN 44", at: null });
    const otherOrg = await asC.query(api.devices.inventory, {
      organizationId: orgC,
      search: "Gateway A",
      paginationOpts: page,
    });
    expect(otherOrg.rows).toHaveLength(0);
    const own = await asA.query(api.devices.inventory, {
      organizationId: orgA,
      search: "gw-a",
      paginationOpts: page,
    });
    expect(own.rows.map((row) => row.identity)).toEqual(["gw-a"]);
  });
});
