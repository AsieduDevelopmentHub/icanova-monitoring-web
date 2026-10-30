import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  deviceCredentialMatches,
  hashIngestCredential,
  ingestAuthorized,
} from "../../convex/ingestAuth";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const owner = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

async function seeded() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(owner);
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "CredOrg" });
  const siteId = await asOwner.mutation(api.sites.create, { organizationId, name: "Yard" });
  const deviceId = await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "aabbccddeeff",
  });
  return { t, asOwner, organizationId, deviceId };
}

describe("device ingest credentials", () => {
  test("shared secret path remains valid", () => {
    const secret = "s".repeat(32);
    expect(ingestAuthorized(`Bearer ${secret}`, secret)).toBe("ok");
    expect(ingestAuthorized("Bearer wrong", secret)).toBe("unauthorized");
  });

  test("hash match supports current and previous during rotation", async () => {
    const current = await hashIngestCredential("device-secret-one!!");
    const previous = await hashIngestCredential("device-secret-zero!!");
    expect(deviceCredentialMatches(current, current, previous)).toBe(true);
    expect(deviceCredentialMatches(previous, current, previous)).toBe(true);
    expect(deviceCredentialMatches(await hashIngestCredential("nope"), current, previous)).toBe(
      false,
    );
  });

  test("setIngestCredential stores hash and never returns it from detail", async () => {
    const { asOwner, deviceId } = await seeded();
    const rotated = await asOwner.mutation(api.devices.setIngestCredential, {
      deviceId,
      plaintext: "device-secret-alpha1",
    });
    expect(rotated.hasIngestCredential).toBe(true);
    const detail = await asOwner.query(api.devices.detail, { deviceId });
    expect(detail.device.hasIngestCredential).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/ingestCredentialHash|device-secret-alpha1/);
  });

  test("verifyDeviceIngestCredential accepts matching bearer and rejects wrong or inactive", async () => {
    const { t, asOwner, deviceId } = await seeded();
    await asOwner.mutation(api.devices.setIngestCredential, {
      deviceId,
      plaintext: "device-secret-beta12",
    });
    const ok = await t.mutation(internal.devices.verifyDeviceIngestCredential, {
      identity: "aabbccddeeff",
      presented: "device-secret-beta12",
    });
    expect(ok.ok).toBe(true);
    const bad = await t.mutation(internal.devices.verifyDeviceIngestCredential, {
      identity: "aabbccddeeff",
      presented: "wrong-secret-zzzzzz",
    });
    expect(bad.ok).toBe(false);
    await asOwner.mutation(api.devices.setLifecycle, { deviceId, lifecycle: "inactive" });
    const inactive = await t.mutation(internal.devices.verifyDeviceIngestCredential, {
      identity: "aabbccddeeff",
      presented: "device-secret-beta12",
    });
    expect(inactive).toMatchObject({ ok: false, reason: "inactive" });
  });
});
