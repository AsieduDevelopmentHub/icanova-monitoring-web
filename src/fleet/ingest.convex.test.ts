import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";
import { ingestAuthorized } from "../../convex/ingestAuth";

const identity = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
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
  return { t, asOwner, generatorId };
}

describe("NCU ingest", () => {
  test("a known device stores nulls as unavailable and keeps negative power", async () => {
    const { t, asOwner, generatorId } = await registered();
    const result = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 1,
      samples: [sample({ kw100: -45, rpm: 0 })],
    });
    expect(result).toMatchObject({ status: "accepted", accepted: 1 });
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current).toMatchObject({
      rpm: 0,
      rpmQuality: "measured",
      powerKw: -0.45,
      powerQuality: "measured",
      batteryV: null,
      batteryQuality: "unavailable",
      sourceTime: null,
      alarmCount: 0,
    });
  });

  test("the last sample in a batch becomes current", async () => {
    const { t, asOwner, generatorId } = await registered();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 2,
      samples: [sample({ rpm: 0 }), sample({ rpm: 1500, kw100: 12 })],
    });
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current).toMatchObject({ rpm: 1500, powerKw: 0.12 });
  });

  test("an unknown device and a missing generator do not write", async () => {
    const { t } = await registered();
    const unknown = await t.mutation(internal.ingest.acceptBatch, {
      identity: "001122334455",
      boot: 7,
      seq: 1,
      samples: [sample({ rpm: 99 })],
    });
    expect(unknown.status).toBe("unknown");
    const bare = convexTest(schema, modules);
    const owner = bare.withIdentity(identity);
    const organizationId = await owner.mutation(api.organizations.create, { name: "Bare" });
    const siteId = await owner.mutation(api.sites.create, { organizationId, name: "Yard" });
    await owner.mutation(api.devices.create, {
      organizationId,
      siteId,
      name: "Gateway",
      identity: "ffeeddccbbaa",
    });
    const missing = await bare.mutation(internal.ingest.acceptBatch, {
      identity: "ffeeddccbbaa",
      boot: 1,
      seq: 1,
      samples: [sample({ rpm: 5 })],
    });
    expect(missing.status).toBe("no-generator");
    const rows = await t.run(async (ctx) => {
      return await ctx.db.query("telemetryCurrent").collect();
    });
    expect(rows.some((row) => row.rpm === 99)).toBe(false);
  });

  test("a retry of the same sequence does not replace current, and an older sequence is ignored", async () => {
    const { t, asOwner, generatorId } = await registered();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 4,
      samples: [sample({ rpm: 1500 })],
    });
    const duplicate = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 4,
      samples: [sample({ rpm: 1 })],
    });
    const stale = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 3,
      samples: [sample({ rpm: 2 })],
    });
    expect(duplicate.status).toBe("duplicate");
    expect(stale.status).toBe("stale");
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current).toMatchObject({ rpm: 1500 });
  });

  test("a sample Convex rejects does not advance the cursor", async () => {
    const { t, asOwner, generatorId } = await registered();
    await expect(
      t.mutation(internal.ingest.acceptBatch, {
        identity: "aabbccddeeff",
        boot: 7,
        seq: 1,
        samples: [sample({ link: "offline", rpm: 9 })],
      }),
    ).rejects.toThrow(/Invalid sample/);
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current).toBeNull();
    const stored = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 7,
      seq: 1,
      samples: [sample({ rpm: 9 })],
    });
    expect(stored.status).toBe("accepted");
  });

  test("the same MAC in two organizations is not assigned to either", async () => {
    const { t } = await registered();
    const other = t.withIdentity({
      subject: "other",
      issuer: "https://issuer.test",
      tokenIdentifier: "https://issuer.test|other",
    });
    const organizationId = await other.mutation(api.organizations.create, { name: "South" });
    const siteId = await other.mutation(api.sites.create, { organizationId, name: "Quay" });
    await other.mutation(api.devices.create, {
      organizationId,
      siteId,
      name: "Gateway",
      identity: "aabbccddeeff",
    });
    const result = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 1,
      samples: [sample({ rpm: 10 })],
    });
    expect(result.status).toBe("ambiguous");
  });
});

describe("ingest secret", () => {
  test("a missing or wrong bearer is refused and the secret is not required in the result", () => {
    expect(ingestAuthorized(null, undefined)).toBe("unconfigured");
    expect(ingestAuthorized("Bearer station-secret", "station-secret")).toBe("ok");
    expect(ingestAuthorized("Bearer other-secret", "station-secret")).toBe("unauthorized");
    expect(ingestAuthorized("Bearer station-secret", undefined)).toBe("unconfigured");
  });
});
