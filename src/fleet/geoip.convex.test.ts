import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const identity = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

async function seeded() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(identity);
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "Geo Org" });
  const siteId = await asOwner.mutation(api.sites.create, {
    organizationId,
    name: "Yard",
  });
  await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "aabbccddeeff",
  });
  return { t, asOwner, organizationId, siteId };
}

describe("IP geolocation move-aware", () => {
  test("empty seed + jitter ignore + manual relocate confirms", async () => {
    const { t, asOwner, organizationId, siteId } = await seeded();

    const seededIp = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 5.6037,
      longitude: -0.187,
      ipKey: "ip1",
    });
    expect(seededIp.status).toBe("applied");

    let site = await asOwner.query(api.sites.get, { organizationId, siteId });
    expect(site).toMatchObject({
      latitude: 5.6037,
      longitude: -0.187,
      locationSource: "ip",
    });

    const jitter = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 5.61,
      longitude: -0.18,
      ipKey: "ip1",
    });
    expect(jitter).toMatchObject({ status: "ignored", reason: "ip_jitter" });
    site = await asOwner.query(api.sites.get, { organizationId, siteId });
    expect(site?.latitude).toBeCloseTo(5.6037, 4);

    await asOwner.mutation(api.sites.setLocation, {
      organizationId,
      siteId,
      latitude: 5.6037,
      longitude: -0.187,
      source: "manual",
    });
    site = await asOwner.query(api.sites.get, { organizationId, siteId });
    expect(site?.locationSource).toBe("manual");

    const far = { latitude: 6.6885, longitude: -1.6244 };
    const p1 = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      ...far,
      ipKey: "ip2",
    });
    expect(p1).toMatchObject({ status: "pending", count: 1 });
    const p2 = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      ...far,
      ipKey: "ip2",
    });
    expect(p2).toMatchObject({ status: "pending", count: 2 });
    const p3 = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      ...far,
      ipKey: "ip2",
    });
    expect(p3).toMatchObject({ status: "applied" });

    site = await asOwner.query(api.sites.get, { organizationId, siteId });
    expect(site).toMatchObject({
      latitude: far.latitude,
      longitude: far.longitude,
      locationSource: "ip",
    });
  });

  test("Soft-AP / operator source clears pending", async () => {
    const { t, asOwner, organizationId, siteId } = await seeded();
    await asOwner.mutation(api.sites.setLocation, {
      organizationId,
      siteId,
      latitude: 5.6,
      longitude: -0.2,
      source: "manual",
    });
    await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 6.6885,
      longitude: -1.6244,
      ipKey: "move",
    });
    await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 6.6885,
      longitude: -1.6244,
      ipKey: "move",
    });

    const cleared = await t.mutation(internal.sites.setLocationForIdentity, {
      identity: "aabbccddeeff",
      latitude: 5.55,
      longitude: -0.21,
      source: "browser",
    });
    expect(cleared).toMatchObject({ status: "ok" });

    const site = await asOwner.query(api.sites.get, { organizationId, siteId });
    expect(site).toMatchObject({
      latitude: 5.55,
      longitude: -0.21,
      locationSource: "browser",
    });

    const again = await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 6.6885,
      longitude: -1.6244,
      ipKey: "move2",
    });
    expect(again).toMatchObject({ status: "pending", count: 1 });
  });

  test("gateIpLookup debounces same ipKey", async () => {
    const { t } = await seeded();
    await t.mutation(internal.sites.considerIpLocation, {
      identity: "aabbccddeeff",
      latitude: 5.6,
      longitude: -0.2,
      ipKey: "same",
      now: 1_000_000,
    });
    const gated = await t.mutation(internal.sites.gateIpLookup, {
      identity: "aabbccddeeff",
      ipKey: "same",
      now: 1_000_000 + 60_000,
    });
    expect(gated.proceed).toBe(false);
    expect(gated.reason).toBe("debounced");

    const freshIp = await t.mutation(internal.sites.gateIpLookup, {
      identity: "aabbccddeeff",
      ipKey: "other",
      now: 1_000_000 + 60_000,
    });
    expect(freshIp.proceed).toBe(true);
  });
});
