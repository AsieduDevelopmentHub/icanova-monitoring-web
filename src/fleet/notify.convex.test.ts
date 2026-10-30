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
  const organizationId = await asOwner.mutation(api.organizations.create, { name: "Station" });
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
  const me = await asOwner.query(api.users.me, {});
  return { t, asOwner, organizationId, siteId, deviceId, generatorId, userId: me!._id };
}

describe("notification emit", () => {
  test("a new alarm creates one inbox notice and repeated samples do not", async () => {
    const { t, asOwner, organizationId, siteId, deviceId, generatorId, userId } = await seeded();
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: "ops@example.com",
      phone: null,
      emailEnabled: true,
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
    const alarmId = await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "transport",
      summary: "Controller communication failed",
      detail: "link fail",
      sourceTime: null,
    });
    const again = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      epoch: 1,
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
    expect(again.status).toBe("accepted");
    const duplicate = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 1,
      epoch: 1,
      seq: 1,
      samples: [
        {
          t: 2,
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
    expect(duplicate.status).toBe("duplicate");
    const inbox = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: false,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const raised = inbox.page.filter((row) => row.event === "alarm.raised" && row.alarmId === alarmId);
    expect(raised).toHaveLength(1);
    const deliveries = await asOwner.query(api.notifications.listDeliveries, {
      organizationId,
      paginationOpts: { numItems: 20, cursor: null },
    });
    const emailRows = deliveries.page.filter(
      (row) => row.event === "alarm.raised" && row.channel === "email",
    );
    expect(emailRows).toHaveLength(1);
    expect(emailRows[0]?.status).toBe("not_configured");
    expect(emailRows[0]?.to).toBe("ops@example.com");
    expect(JSON.stringify(deliveries.page)).not.toMatch(/RESEND_API_KEY|ARKESEL_API_KEY/);
    void userId;
  });

  test("acknowledgement and clear follow policy and reoccurrence is a new notice", async () => {
    const { t, asOwner, organizationId, siteId, deviceId, generatorId } = await seeded();
    await asOwner.mutation(api.notifications.savePreference, {
      organizationId,
      email: null,
      phone: null,
      emailEnabled: false,
      smsEnabled: false,
      pushEnabled: false,
      inAppEnabled: true,
    });
    for (const event of ["alarm.raised", "alarm.acknowledged", "alarm.cleared"] as const) {
      await asOwner.mutation(api.notifications.savePolicy, {
        organizationId,
        channel: "inapp",
        event,
        enabled: true,
      });
    }
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: null,
    });
    const first = await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "controller",
      summary: "Operator note",
      detail: "manual",
      sourceTime: null,
    });
    await asOwner.mutation(api.alarms.acknowledge, { alarmId: first });
    await asOwner.mutation(api.alarms.clear, { alarmId: first });
    const second = await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "controller",
      summary: "Operator note again",
      detail: "manual",
      sourceTime: null,
    });
    const inbox = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: false,
      event: null,
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(inbox.page.filter((row) => row.alarmId === first).map((row) => row.event).sort()).toEqual([
      "alarm.acknowledged",
      "alarm.cleared",
      "alarm.raised",
    ]);
    expect(inbox.page.filter((row) => row.alarmId === second && row.event === "alarm.raised")).toHaveLength(
      1,
    );
    const failThenOk = await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 4,
      epoch: 2,
      seq: 1,
      samples: [
        { t: 1, age: 0, link: "ok", alm: 0, mode: 1, rpm: 0, batt10: null, hz10: null, kw100: null, van10: null },
      ],
    });
    expect(failThenOk.status).toBe("accepted");
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 4,
      epoch: 2,
      seq: 2,
      samples: [
        { t: 2, age: 0, link: "fail", alm: 0, mode: 1, rpm: 0, batt10: null, hz10: null, kw100: null, van10: null },
      ],
    });
    await t.mutation(internal.ingest.acceptBatch, {
      identity: "aabbccddeeff",
      boot: 4,
      epoch: 2,
      seq: 3,
      samples: [
        { t: 3, age: 0, link: "ok", alm: 0, mode: 1, rpm: 0, batt10: null, hz10: null, kw100: null, van10: null },
      ],
    });
    const after = await asOwner.query(api.notifications.listInbox, {
      organizationId,
      unreadOnly: false,
      event: "alarm.cleared",
      severity: "all",
      siteId: null,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(after.page.some((row) => row.event === "alarm.cleared")).toBe(true);
  });

  test("escalation stops after acknowledgement and cross-org access is denied", async () => {
    const { t, asOwner, organizationId, siteId, deviceId, generatorId } = await seeded();
    const asOther = t.withIdentity(person("other"));
    const otherOrg = await asOther.mutation(api.organizations.create, { name: "South" });
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
    await asOwner.mutation(api.notifications.saveSettings, {
      organizationId,
      minSeverity: "informational",
      escalateAfterMinutes: 1,
    });
    const alarmId = await asOwner.mutation(api.alarms.raise, {
      organizationId,
      siteId,
      deviceId,
      generatorId,
      kind: "controller",
      summary: "Needs ack",
      detail: "manual",
      sourceTime: null,
    });
    await asOwner.mutation(api.alarms.acknowledge, { alarmId });
    const stopped = await t.mutation(internal.notifyEmit.checkEscalation, { alarmId });
    expect(stopped.status).toBe("stopped");
    await expect(
      asOther.query(api.notifications.listDeliveries, {
        organizationId,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      asOther.mutation(api.notifications.savePolicy, {
        organizationId,
        channel: "email",
        event: "alarm.raised",
        enabled: true,
      }),
    ).rejects.toThrow(/Forbidden/);
    void otherOrg;
  });
});
