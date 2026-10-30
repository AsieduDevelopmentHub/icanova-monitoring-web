import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { isIngestHeartbeat } from "../../convex/ingestAuth";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.modules";
import { engineView } from "../telemetry/fleetView";

const owner = {
  subject: "owner",
  issuer: "https://issuer.test",
  tokenIdentifier: "https://issuer.test|owner",
};

const page = { numItems: 20, cursor: null };

function sample(link: string, extra: Record<string, unknown> = {}) {
  return {
    t: 1000,
    age: 1,
    link,
    alm: 0,
    mode: null,
    rpm: null,
    batt10: null,
    hz10: null,
    kw100: null,
    van10: null,
    ...extra,
  };
}

async function registered() {
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

async function send(
  t: ReturnType<typeof convexTest>,
  boot: number,
  seq: number,
  samples: ReturnType<typeof sample>[],
) {
  return await t.mutation(internal.ingest.acceptBatch, {
    identity: "aabbccddeeff",
    boot,
    seq,
    samples,
  });
}

async function rows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => ctx.db.query("alarms").collect());
}

describe("communication alarms", () => {
  test("ok then fail opens one warning, and repeated fail does not duplicate it", async () => {
    const { t, asOwner, organizationId, generatorId } = await registered();
    await send(t, 4, 1, [sample("ok")]);
    await send(t, 4, 2, [sample("fail"), sample("fail")]);
    await send(t, 4, 3, [sample("fail")]);
    const stored = await rows(t);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      state: "active",
      kind: "transport",
      category: "communication",
      severity: "warning",
      source: "telemetry.link",
      code: "comm.link.fail",
      occurrenceCount: 1,
      evidenceBoot: 4,
      evidenceSeq: 3,
      generatorId,
    });
    expect(stored[0]?.firstOccurredAt).toBe(stored[0]?.raisedAt);
    expect(stored[0]?.lastOccurredAt).toBeGreaterThanOrEqual(stored[0]?.firstOccurredAt ?? 0);
    expect(stored[0]?.detail).toContain("not a generator alarm");
    expect(stored[0]?.detail).toContain("not an engine stop");
    expect(JSON.stringify(stored[0])).not.toMatch(/bearer|secret|password/i);
    const listed = await asOwner.query(api.alarms.forSite, { organizationId, siteId: stored[0]!.siteId });
    expect(listed.capped).toBe(false);
    expect(listed.rows).toHaveLength(1);
    const messages = await t.run(async (ctx) => ctx.db.query("messages").collect());
    expect(messages).toEqual([]);
  });

  test("fail then ok clears, acknowledgement is kept, and a later fail is a new row", async () => {
    const { t, asOwner } = await registered();
    await send(t, 4, 1, [sample("ok")]);
    await send(t, 4, 2, [sample("fail")]);
    const opened = await rows(t);
    await asOwner.mutation(api.alarms.acknowledge, { alarmId: opened[0]!._id });
    const acknowledged = (await rows(t))[0];
    expect(acknowledged?.state).toBe("acknowledged");
    expect(acknowledged?.acknowledgedBy).toBeTruthy();
    await send(t, 4, 3, [sample("ok")]);
    const cleared = (await rows(t))[0];
    expect(cleared?.state).toBe("cleared");
    expect(cleared?.clearedAt).toEqual(expect.any(Number));
    expect(cleared?.acknowledgedBy).toBe(acknowledged?.acknowledgedBy);
    expect(cleared?.acknowledgedAt).toBe(acknowledged?.acknowledgedAt);
    await send(t, 4, 4, [sample("fail")]);
    const again = await rows(t);
    expect(again).toHaveLength(2);
    const history = again.find((alarm) => alarm._id === opened[0]!._id);
    const fresh = again.find((alarm) => alarm._id !== opened[0]!._id);
    expect(history?.state).toBe("cleared");
    expect(history?.acknowledgedBy).toBe(acknowledged?.acknowledgedBy);
    expect(fresh).toMatchObject({ state: "active", occurrenceCount: 1, evidenceSeq: 4 });
  });

  test("unknown, degraded, a bare fail, and a controller count do not open an alarm", async () => {
    const { t, asOwner, generatorId } = await registered();
    await send(t, 4, 1, [sample("fail", { alm: 6 })]);
    await send(t, 4, 2, [sample("unknown", { alm: 6 })]);
    await send(t, 4, 3, [sample("ok", { alm: 6 })]);
    await send(t, 4, 4, [sample("degraded")]);
    await send(t, 4, 5, [sample("ok", { rpm: null, alm: 3 })]);
    expect(await rows(t)).toEqual([]);
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current?.alarmCount).toBe(3);
    expect(detail.current?.link).toBe("ok");
    expect(engineView(detail.current?.rpm ?? null, detail.current?.rpmQuality ?? "unavailable").label).toBe(
      "Unreported",
    );
  });

  test("a failed link is not an engine stop", async () => {
    const { t, asOwner, generatorId } = await registered();
    await send(t, 4, 1, [sample("ok", { rpm: 1500 })]);
    await send(t, 4, 2, [sample("fail")]);
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current?.link).toBe("fail");
    expect(engineView(null, "unavailable").label).toBe("Unreported");
    expect((await rows(t))[0]?.category).toBe("communication");
  });

  test("a heartbeat is not a sample and does not open an alarm", async () => {
    const { t } = await registered();
    expect(isIngestHeartbeat({ kind: "heartbeat", identity: "aabbccddeeff" })).toBe(true);
    expect(isIngestHeartbeat({ identity: "aabbccddeeff", boot: 1, seq: 1, samples: [sample("fail")] })).toBe(
      false,
    );
    expect(await rows(t)).toEqual([]);
  });

  test("duplicate and stale batches do not clear or duplicate an open alarm", async () => {
    const { t } = await registered();
    await send(t, 4, 1, [sample("ok")]);
    await send(t, 4, 3, [sample("fail")]);
    const duplicate = await send(t, 4, 3, [sample("ok")]);
    const stale = await send(t, 4, 2, [sample("ok")]);
    expect(duplicate.status).toBe("duplicate");
    expect(stale.status).toBe("stale");
    const stored = await rows(t);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.state).toBe("active");
  });

  test("a different boot does not raise from the previous link or clear the open alarm", async () => {
    const { t, asOwner, generatorId } = await registered();
    await send(t, 4, 1, [sample("ok")]);
    const unorderedFail = await send(t, 99, 1, [sample("fail")]);
    expect(unorderedFail.status).toBe("accepted");
    expect(await rows(t)).toEqual([]);
    await send(t, 4, 2, [sample("ok")]);
    await send(t, 4, 3, [sample("fail")]);
    expect((await rows(t))[0]?.evidenceBoot).toBe(4);
    const recoveredOnAnotherBoot = await send(t, 80, 1, [sample("ok")]);
    expect(recoveredOnAnotherBoot.status).toBe("accepted");
    expect((await rows(t))[0]?.state).toBe("active");
    expect((await rows(t))[0]?.evidenceBoot).toBe(4);
    const detail = await asOwner.query(api.generators.detail, { generatorId });
    expect(detail.current?.link).toBe("ok");
  });

  test("recovery inside one ordered batch clears the alarm it just opened", async () => {
    const { t } = await registered();
    await send(t, 4, 1, [sample("ok")]);
    await send(t, 4, 2, [sample("fail"), sample("ok")]);
    const stored = await rows(t);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.state).toBe("cleared");
  });

  test("another organization cannot read or acknowledge the alarm", async () => {
    const { t, asOwner, organizationId, siteId, generatorId } = await registered();
    const outsider = t.withIdentity({
      subject: "south",
      issuer: "https://issuer.test",
      tokenIdentifier: "https://issuer.test|south",
    });
    const reader = t.withIdentity({
      subject: "reader",
      issuer: "https://issuer.test",
      tokenIdentifier: "https://issuer.test|reader",
    });
    const acker = t.withIdentity({
      subject: "acker",
      issuer: "https://issuer.test",
      tokenIdentifier: "https://issuer.test|acker",
    });
    const south = await outsider.mutation(api.organizations.create, { name: "South" });
    const readerId = await reader.mutation(api.users.ensure, {});
    const ackerId = await acker.mutation(api.users.ensure, {});
    const readRole = await asOwner.mutation(api.organizations.createRole, {
      organizationId,
      name: "Reader",
      permissions: ["view.alarms"],
    });
    const ackRole = await asOwner.mutation(api.organizations.createRole, {
      organizationId,
      name: "Acker",
      permissions: ["view.alarms", "acknowledge.alarms"],
    });
    await asOwner.mutation(api.organizations.grant, {
      organizationId,
      userId: readerId,
      roleId: readRole,
    });
    await asOwner.mutation(api.organizations.grant, {
      organizationId,
      userId: ackerId,
      roleId: ackRole,
    });
    await send(t, 4, 1, [sample("ok")]);
    await send(t, 4, 2, [sample("fail")]);
    const alarmId = (await rows(t))[0]!._id;
    await expect(outsider.query(api.alarms.forSite, { organizationId, siteId })).rejects.toThrow(/Forbidden/);
    await expect(outsider.query(api.alarms.forGenerator, { generatorId })).rejects.toThrow(/Forbidden/);
    await expect(outsider.mutation(api.alarms.acknowledge, { alarmId })).rejects.toThrow(/Forbidden/);
    await expect(reader.mutation(api.alarms.acknowledge, { alarmId })).rejects.toThrow(/Forbidden/);
    await expect(acker.mutation(api.alarms.resolve, { alarmId })).rejects.toThrow(/Forbidden/);
    await acker.mutation(api.alarms.acknowledge, { alarmId });
    const detail = await asOwner.query(api.alarms.detail, { alarmId });
    expect(detail.alarm.state).toBe("acknowledged");
    const audits = await asOwner.query(api.audits.list, { organizationId, paginationOpts: page });
    expect(audits.page.some((row) => row.action === "alarm.acknowledge")).toBe(true);
    expect(audits.page.some((row) => row.action === "alarm.raise" && row.actorToken === "ingest")).toBe(true);
    expect(JSON.stringify(audits.page)).not.toMatch(/bearer|BEGIN|ingest secret/i);
    expect(south).toBeTruthy();
  });
});
