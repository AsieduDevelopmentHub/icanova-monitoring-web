import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { DELIVERY_LEASE_MS } from "../../convex/limits";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";

function person(name: string) {
  return {
    subject: name,
    issuer: "https://issuer.test",
    tokenIdentifier: `https://issuer.test|${name}`,
  };
}

async function seeded() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity(person("owner"));
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "Station" });
  const siteId = await asOwner.mutation(api.sites.create, { organizationId, name: "Yard" });
  const deviceId = await asOwner.mutation(api.devices.create, {
    organizationId,
    siteId,
    name: "Gateway",
    identity: "ccddeeff0011",
  });
  const generatorId = await asOwner.mutation(api.generators.create, {
    organizationId,
    siteId,
    deviceId,
    name: "Set 1",
  });
  const me = await asOwner.query(api.users.me, {});
  await asOwner.mutation(api.notifications.savePreference, {
    organizationId,
    email: "ops@example.com",
    phone: "+233200000000",
    emailEnabled: true,
    smsEnabled: true,
    pushEnabled: false,
    inAppEnabled: true,
  });
  await asOwner.mutation(api.notifications.savePolicy, {
    organizationId,
    channel: "email",
    event: "alarm.raised",
    enabled: true,
  });
  await asOwner.mutation(api.notifications.saveSettings, {
    organizationId,
    minSeverity: "informational",
    escalateAfterMinutes: null,
  });
  return { t, asOwner, organizationId, siteId, deviceId, generatorId, userId: me!._id };
}

async function pendingEmail(args: Awaited<ReturnType<typeof seeded>>) {
  const alarmId = await args.asOwner.mutation(api.alarms.raise, {
    organizationId: args.organizationId,
    siteId: args.siteId,
    deviceId: args.deviceId,
    generatorId: args.generatorId,
    kind: "controller",
    summary: "Needs delivery",
    detail: "manual",
    sourceTime: null,
  });
  const deliveries = await args.asOwner.query(api.notifications.listDeliveries, {
    organizationId: args.organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const message = deliveries.page.find((row) => row.channel === "email" && row.alarmId === alarmId);
  expect(message).toBeTruthy();
  // Tests exercise the claim lease without live Resend credentials.
  await args.t.run(async (ctx) => {
    await ctx.db.patch(message!._id, {
      status: "pending",
      error: undefined,
      failureCategory: undefined,
      attempt: 0,
    });
  });
  return { alarmId, messageId: message!._id };
}

describe("notification delivery reliability", () => {
  test("expired processing leases can be reclaimed and concurrent claims do not double-send", async () => {
    const seededOrg = await seeded();
    const { t, messageId } = { t: seededOrg.t, ...(await pendingEmail(seededOrg)) };
    const first = await t.mutation(internal.notifyEmit.claimMessage, { messageId });
    expect(first?.claimGeneration).toBe(1);
    const concurrent = await t.mutation(internal.notifyEmit.claimMessage, { messageId });
    expect(concurrent).toBeNull();
    await t.run(async (ctx) => {
      await ctx.db.patch(messageId, { leaseExpiresAt: Date.now() - 1 });
    });
    const reclaimed = await t.mutation(internal.notifyEmit.claimMessage, { messageId });
    expect(reclaimed?.claimGeneration).toBe(2);
    const stale = await t.mutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration: 1,
      status: "sent",
      providerId: "stale-worker",
    });
    expect(stale.status).toBe("stale");
    const still = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(still?.status).toBe("processing");
    expect(still?.providerId).toBeUndefined();
    const done = await t.mutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration: 2,
      status: "sent",
      providerId: "current-worker",
    });
    expect(done.status).toBe("completed");
    const final = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(final?.status).toBe("sent");
    expect(final?.providerId).toBe("current-worker");
  });

  test("reclaimIfStale restores a crashed worker after the lease timeout", async () => {
    const seededOrg = await seeded();
    const { t, messageId } = { t: seededOrg.t, ...(await pendingEmail(seededOrg)) };
    const claimed = await t.mutation(internal.notifyEmit.claimMessage, { messageId });
    expect(claimed?.claimGeneration).toBe(1);
    await t.run(async (ctx) => {
      await ctx.db.patch(messageId, { leaseExpiresAt: Date.now() - DELIVERY_LEASE_MS });
    });
    const result = await t.mutation(internal.notifyEmit.reclaimIfStale, {
      messageId,
      claimGeneration: 1,
    });
    expect(result.status).toBe("reclaimed");
    const row = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(row?.status).toBe("pending");
    expect(row?.failureCategory).toBe("uncertain");
  });

  test("uncertain provider outcomes are not auto-retried as definite failures", async () => {
    const seededOrg = await seeded();
    const { t, messageId } = { t: seededOrg.t, ...(await pendingEmail(seededOrg)) };
    const claimed = await t.mutation(internal.notifyEmit.claimMessage, { messageId });
    const completed = await t.mutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration: claimed!.claimGeneration,
      status: "uncertain",
      error: "Provider timeout",
      failureCategory: "uncertain",
      scheduleRetry: true,
    });
    expect(completed.status).toBe("completed");
    const row = await t.run(async (ctx) => ctx.db.get(messageId));
    expect(row?.status).toBe("uncertain");
    expect(row?.nextAttemptAt).toBeUndefined();
  });

  test("manual retry re-checks preferences and alarm eligibility", async () => {
    const seededOrg = await seeded();
    const { asOwner, organizationId, t } = seededOrg;
    const { alarmId, messageId } = await pendingEmail(seededOrg);
    await t.run(async (ctx) => {
      await ctx.db.patch(messageId, { status: "failed", failureCategory: "rejected", attempt: 1 });
    });
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: "ops@example.com",
      phone: null,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
    });
    await expect(asOwner.mutation(api.notifications.retryDelivery, { messageId })).rejects.toThrow(
      /preference disables/i,
    );
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: "ops@example.com",
      phone: null,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
    });
    await asOwner.mutation(api.alarms.acknowledge, { alarmId });
    await expect(asOwner.mutation(api.notifications.retryDelivery, { messageId })).rejects.toThrow(
      /no longer eligible/i,
    );
    const asOther = t.withIdentity(person("intruder"));
    await asOther.mutation(api.organizations.create, { name: "South" });
    await expect(asOther.mutation(api.notifications.retryDelivery, { messageId })).rejects.toThrow(
      /Forbidden/,
    );
  });

  test("escalation waits for the original due time and does not duplicate", async () => {
    const { t, asOwner, organizationId, siteId, deviceId, generatorId } = await seeded();
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: 10,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "inapp",
      event: "alarm.raised",
      enabled: true,
    });
    const alarmId = await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "controller",
      summary: "Escalate me",
      detail: "manual",
      sourceTime: null,
    });
    const alarm = await t.run(async (ctx) => ctx.db.get(alarmId));
    const dueAt = (alarm?.raisedAt ?? Date.now()) + 10 * 60_000;
    const early = await t.mutation(internal.notifyEmit.checkEscalation, { alarmId, dueAt });
    expect(early.status).toBe("rescheduled");
    const first = await t.mutation(internal.notifyEmit.checkEscalation, {
      alarmId,
      dueAt: Date.now() - 1,
    });
    expect(first).toMatchObject({ status: "escalated", created: true });
    const second = await t.mutation(internal.notifyEmit.checkEscalation, {
      alarmId,
      dueAt: Date.now() - 1,
    });
    expect(second).toMatchObject({ status: "escalated", created: false });
    await asOwner.mutation(api.alarms.acknowledge, { alarmId });
    const stopped = await t.mutation(internal.notifyEmit.checkEscalation, {
      alarmId,
      dueAt: Date.now() - 1,
    });
    expect(stopped.status).toBe("stopped");
  });
});
