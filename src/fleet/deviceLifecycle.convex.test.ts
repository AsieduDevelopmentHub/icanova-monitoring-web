import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";
import { INGEST_RATE_DEVICE_MAX } from "../../convex/limits";

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
  const generatorId = await asOwner.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Set",
  });
  return { t, asOwner, organizationId, siteId, deviceId, generatorId };
}

describe("device lifecycle", () => {
  test("active device accepts ingest and heartbeat", async () => {
    const { t, asOwner, deviceId } = await seeded();
    const detail = await asOwner.query(api.devices.detail, { deviceId });
    expect(detail.device.lifecycle).toBe("active");
    const batch = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 1,
      samples: [sample()],
    });
    expect(batch).toMatchObject({ status: "accepted", accepted: 1 });
    const hb = await t.mutation(internal.deviceHealth.recordHeartbeat, {
      identity: "aabbccddeeff",
    });
    expect(hb.status).toBe("ok");
  });

  test("deactivate rejects ingest and heartbeat before health writes; history remains", async () => {
    const { t, asOwner, deviceId } = await seeded();
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 1,
      samples: [sample({ rpm: 1500 })],
    });
    const deactivated = await asOwner.mutation(api.devices.setLifecycle, {
      deviceId,
      lifecycle: "inactive",
    });
    expect(deactivated).toMatchObject({ lifecycle: "inactive", changed: true });
    const again = await asOwner.mutation(api.devices.setLifecycle, {
      deviceId,
      lifecycle: "inactive",
    });
    expect(again.changed).toBe(false);

    const rejected = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      seq: 2,
      samples: [sample({ rpm: 1800 })],
    });
    expect(rejected).toEqual({ status: "inactive", accepted: 0 });
    const hb = await t.mutation(internal.deviceHealth.recordHeartbeat, {
      identity: "aabbccddeeff",
    });
    expect(hb.status).toBe("inactive");

    const detail = await asOwner.query(api.generators.detail, {
      generatorId: (await asOwner.query(api.devices.detail, { deviceId })).generators[0]._id,
    });
    expect(detail.current?.rpm).toBe(1500);

    const audits = await t.run(async (ctx) => ctx.db.query("audits").collect());
    expect(audits.some((row) => row.action === "device.deactivate")).toBe(true);
  });

  test("reactivation restores ingest without duplicating generators", async () => {
    const { t, asOwner, deviceId } = await seeded();
    await asOwner.mutation(api.devices.setLifecycle, { deviceId, lifecycle: "inactive" });
    await asOwner.mutation(api.devices.setLifecycle, { deviceId, lifecycle: "active" });
    const batch = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 2,
      seq: 1,
      samples: [sample()],
    });
    expect(batch.status).toBe("accepted");
    const detail = await asOwner.query(api.devices.detail, { deviceId });
    expect(detail.generators).toHaveLength(1);
    expect(detail.device.lifecycle).toBe("active");
  });

  test("cross-organization and unauthorized lifecycle changes are denied", async () => {
    const { t, deviceId, organizationId } = await seeded();
    const asStranger = t.withIdentity(stranger);
    const otherOrg = await asStranger.mutation(api.organizations.create, { name: "Other" });
    await expect(
      asStranger.mutation(api.devices.setLifecycle, { deviceId, lifecycle: "inactive" }),
    ).rejects.toThrow();
    expect(otherOrg).not.toBe(organizationId);
  });
});

describe("ingest rate limiting", () => {
  test("allows a normal burst then returns a recoverable deny", async () => {
    const { t } = await seeded();
    let last = { allowed: true, retryAfterSec: 0, deviceCount: 0, ipCount: 0 };
    for (let i = 0; i < INGEST_RATE_DEVICE_MAX; i += 1) {
      last = await t.mutation(internal.ingestRateLimit.check, {
        identity: "aabbccddeeff",
        ipKey: null,
        deviceMax: INGEST_RATE_DEVICE_MAX,
        windowMs: 60_000,
      });
      expect(last.allowed).toBe(true);
    }
    const denied = await t.mutation(internal.ingestRateLimit.check, {
      identity: "aabbccddeeff",
      ipKey: null,
      deviceMax: INGEST_RATE_DEVICE_MAX,
      windowMs: 60_000,
    });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);

    // A different device is not exhausted by the first identity.
    const other = await t.mutation(internal.ingestRateLimit.check, {
      identity: "001122334455",
      ipKey: null,
      deviceMax: INGEST_RATE_DEVICE_MAX,
      windowMs: 60_000,
    });
    expect(other.allowed).toBe(true);
  });

  test("a new window recovers automatically", async () => {
    const { t } = await seeded();
    await t.mutation(internal.ingestRateLimit.check, {
      identity: "aabbccddeeff",
      ipKey: null,
      deviceMax: 1,
      windowMs: 60_000,
    });
    const denied = await t.mutation(internal.ingestRateLimit.check, {
      identity: "aabbccddeeff",
      ipKey: null,
      deviceMax: 1,
      windowMs: 60_000,
    });
    expect(denied.allowed).toBe(false);
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("ingestRateWindows")
        .withIndex("by_key", (q) => q.eq("key", "device:aabbccddeeff"))
        .unique();
      expect(row).toBeTruthy();
      await ctx.db.patch(row!._id, { windowStart: Date.now() - 120_000 });
    });
    const recovered = await t.mutation(internal.ingestRateLimit.check, {
      identity: "aabbccddeeff",
      ipKey: null,
      deviceMax: 1,
      windowMs: 60_000,
    });
    expect(recovered.allowed).toBe(true);
  });
});
