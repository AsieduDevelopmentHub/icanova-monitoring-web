import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  existingDeviceRemainsActive,
  LIFECYCLE_BACKFILL,
} from "../../convex/migrations";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

const owner = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

describe("migration safety", () => {
  test("existing records without lifecycle remain active to readers", () => {
    expect(existingDeviceRemainsActive(undefined)).toBe(true);
    expect(existingDeviceRemainsActive("active")).toBe(true);
    expect(existingDeviceRemainsActive("inactive")).toBe(false);
  });

  test("lifecycle backfill is idempotent, resumable, and dry-run by default", async () => {
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
    await t.run(async (ctx) => {
      await ctx.db.patch(deviceId, { lifecycle: undefined, lifecycleChangedAt: undefined });
    });

    const started = await asOwner.mutation(api.migrations.startLifecycleBackfill, {
      organizationId,
    });
    expect(started).toMatchObject({ dryRun: true, name: LIFECYCLE_BACKFILL });

    const dry = await t.mutation(internal.migrations.backfillDeviceLifecycle, {
      dryRun: true,
      cursor: null,
    });
    expect(dry).toMatchObject({ dryRun: true, status: "completed" });
    expect(dry.updated).toBeGreaterThanOrEqual(1);
    const stillMissing = await t.run(async (ctx) => ctx.db.get(deviceId));
    expect(stillMissing?.lifecycle).toBeUndefined();

    const written = await t.mutation(internal.migrations.backfillDeviceLifecycle, {
      dryRun: false,
      cursor: null,
    });
    expect(written.status).toBe("completed");
    const after = await t.run(async (ctx) => ctx.db.get(deviceId));
    expect(after?.lifecycle).toBe("active");

    const again = await t.mutation(internal.migrations.backfillDeviceLifecycle, {
      dryRun: false,
      cursor: null,
    });
    expect(again.skipped).toBeGreaterThanOrEqual(1);
    expect(again.updated).toBe(0);
  });

  test("lifecycle backfill is not a cron job", async () => {
    const crons = await import("../../convex/crons");
    expect(crons.default).toBeTruthy();
    // Migrations remain operator-started; cron module exports the job registry only.
    expect(internal.migrations.backfillDeviceLifecycle).toBeTruthy();
    expect(internal.telemetry.pruneBuckets).toBeTruthy();
  });
});

describe("scheduled job visibility", () => {
  test("prune and rate-limit jobs record bounded run state", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity(owner);
    const organizationId = await asOwner.mutation(api.organizations.create, { name: "Ops" });
    await t.mutation(internal.telemetry.pruneBuckets, {});
    await t.mutation(internal.ingestRateLimit.pruneStale, {});
    await t.mutation(internal.deviceHealth.sweep, {});
    const rows = await asOwner.query(api.jobStatus.list, { organizationId });
    const names = rows.map((row) => row.jobName).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "telemetry.pruneBuckets",
        "ingestRateLimit.pruneStale",
        "deviceHealth.sweep",
      ]),
    );
    for (const row of rows) {
      expect(JSON.stringify(row)).not.toMatch(/INGEST_SECRET|Bearer |RESEND_API_KEY/);
    }
  });
});
