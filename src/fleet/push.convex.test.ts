import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
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
  const asOther = t.withIdentity(person("other"));
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "Station" });
  await asOther.mutation(api.organizations.create, { name: "Other" });
  const me = await asOwner.query(api.users.me, {});
  return { t, asOwner, asOther, organizationId, userId: me!._id };
}

describe("VAPID push subscriptions", () => {
  test("vapid public key stays null when env is unset", async () => {
    const { asOwner, organizationId } = await seeded();
    const key = await asOwner.query(api.push.vapidPublicKey, { organizationId });
    expect(key.configured).toBe(false);
    expect(key.publicKey).toBeNull();
  });

  test("subscribe is rejected when VAPID is not configured", async () => {
    const { asOwner, organizationId } = await seeded();
    await expect(
      asOwner.mutation(api.push.subscribe, {
        organizationId,
        endpoint: "https://push.example/sub/abc1234567890",
        p256dh: "abcdefghijklmnopqrstuv",
        auth: "abcdefghijklmnop",
        expirationTime: null,
        userAgentLabel: "vitest",
      }),
    ).rejects.toThrow(/not configured/i);
  });

  test("users cannot unsubscribe another user's subscription id", async () => {
    const { t, asOwner, asOther, organizationId } = await seeded();
    // Seed a subscription row via internal DB helper path is unavailable; insert through test context.
    const owner = await asOwner.query(api.users.me, {});
    const subscriptionId = await t.run(async (ctx) => {
      return await ctx.db.insert("pushSubscriptions", {
        organizationId,
        userId: owner!._id,
        endpoint: "https://push.example/sub/owner-only-endpoint-01",
        p256dh: "abcdefghijklmnopqrstuv",
        auth: "abcdefghijklmnop",
        expirationTime: null,
        status: "active",
        createdAt: Date.now(),
      });
    });
    await expect(
      asOther.mutation(api.push.unsubscribe, {
        organizationId,
        subscriptionId,
      }),
    ).rejects.toThrow();
    const status = await asOwner.query(api.push.mySubscriptionStatus, { organizationId });
    expect(status.activeCount).toBe(1);
    expect(status.subscriptions[0]?.id).toBe(subscriptionId);
    // Status response must not leak endpoints.
    expect(JSON.stringify(status)).not.toContain("push.example");
  });

  test("invalid subscription cleanup marks expired", async () => {
    const { t, asOwner, organizationId } = await seeded();
    const owner = await asOwner.query(api.users.me, {});
    const subscriptionId = await t.run(async (ctx) => {
      return await ctx.db.insert("pushSubscriptions", {
        organizationId,
        userId: owner!._id,
        endpoint: "https://push.example/sub/cleanup-endpoint-01",
        p256dh: "abcdefghijklmnopqrstuv",
        auth: "abcdefghijklmnop",
        expirationTime: null,
        status: "active",
        createdAt: Date.now(),
      });
    });
    await t.mutation(internal.push.markSubscriptionInvalid, {
      subscriptionId,
      reason: "410 Gone",
      expired: true,
    });
    const status = await asOwner.query(api.push.mySubscriptionStatus, { organizationId });
    expect(status.activeCount).toBe(0);
  });

  test("emit queues push messages when preference, policy, and subscription exist", async () => {
    const { t, asOwner, organizationId } = await seeded();
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
      name: "Set 1",
    });
    const owner = await asOwner.query(api.users.me, {});
    await t.run(async (ctx) => {
      await ctx.db.insert("pushSubscriptions", {
        organizationId,
        userId: owner!._id,
        endpoint: "https://push.example/sub/emit-endpoint-01",
        p256dh: "abcdefghijklmnopqrstuv",
        auth: "abcdefghijklmnop",
        expirationTime: null,
        status: "active",
        createdAt: Date.now(),
      });
    });
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: null,
      phone: null,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: true,
      inAppEnabled: true,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "push",
      event: "alarm.raised",
      enabled: true,
    });
    await asOwner.mutation(api.notifications.savePolicy, {
      organizationId,
      channel: "inapp",
      event: "alarm.raised",
      enabled: true,
    });
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: null,
    });
    await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "transport",
      summary: "Controller communication failed",
      detail: "link fail",
      sourceTime: null,
    });
    const deliveries = await asOwner.query(api.notifications.listDeliveries, {
      organizationId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const pushRows = deliveries.page.filter((row) => row.channel === "push");
    expect(pushRows.length).toBeGreaterThanOrEqual(1);
    expect(pushRows[0]?.to).toBe("browser subscription");
    expect(pushRows[0]?.status).toBe("not_configured");
    const inbox = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: true,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(inbox.page.length).toBeGreaterThanOrEqual(1);
    const first = inbox.page[0]!;
    await asOwner.mutation(api.notifications.markRead, {
      organizationId,
      notificationId: first._id,
    });
    await asOwner.mutation(api.notifications.markUnread, {
      organizationId,
      notificationId: first._id,
    });
    const again = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: true,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(again.page.some((row) => row._id === first._id)).toBe(true);
  });
});
