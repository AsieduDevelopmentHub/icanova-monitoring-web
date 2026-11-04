/**
 * One-shot read of demo org telemetry health for local diagnosis.
 *   node scripts/dev-fleet-diag.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");
const orgId = process.argv[2] || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr";

const query = `
const orgId = ${JSON.stringify(orgId)};
const org = await ctx.db.get(orgId);
const devices = await ctx.db
  .query("devices")
  .withIndex("by_org", (q) => q.eq("organizationId", orgId))
  .take(5);
const sample = [];
for (const d of devices) {
  const gens = await ctx.db
    .query("generators")
    .withIndex("by_device", (q) => q.eq("deviceId", d._id))
    .take(1);
  const g = gens[0];
  const tel = g
    ? await ctx.db
        .query("telemetryCurrent")
        .withIndex("by_generator", (q) => q.eq("generatorId", g._id))
        .unique()
    : null;
  const health = await ctx.db
    .query("deviceHealthCurrent")
    .withIndex("by_device", (q) => q.eq("deviceId", d._id))
    .unique();
  sample.push({
    identity: d.identity,
    lifecycle: d.lifecycle,
    rpm: tel?.rpm ?? null,
    rpmQuality: tel?.rpmQuality ?? null,
    powerKw: tel?.powerKw ?? null,
    updatedAt: tel?.updatedAt ?? null,
    ageSec: tel?.updatedAt ? Math.round((Date.now() - tel.updatedAt) / 1000) : null,
    sourceTime: tel?.sourceTime ?? null,
    link: tel?.link ?? null,
    gatewayStatus: health?.gatewayStatus ?? null,
    telemetryFreshness: health?.telemetryFreshness ?? null,
    overallStatus: health?.overallStatus ?? null,
    lastHeartbeatAt: health?.lastHeartbeatAt ?? null,
    lastTelemetryAt: health?.lastTelemetryAt ?? null,
  });
}
const orgSummary = await ctx.db
  .query("orgHealthSummaries")
  .withIndex("by_org", (q) => q.eq("organizationId", orgId))
  .unique();
const siteSummaries = await ctx.db
  .query("siteSummaries")
  .withIndex("by_org", (q) => q.eq("organizationId", orgId))
  .take(3);
return {
  orgName: org?.name ?? null,
  sample,
  orgSummary: orgSummary
    ? {
        gatewayOnline: orgSummary.gatewayOnline,
        gatewayOffline: orgSummary.gatewayOffline,
        telemetryFresh: orgSummary.telemetryFresh,
        telemetryStale: orgSummary.telemetryStale,
        linkOk: orgSummary.linkOk,
        overallHealthy: orgSummary.overallHealthy,
        overallDegraded: orgSummary.overallDegraded,
        lastTelemetryAt: orgSummary.lastTelemetryAt,
        lastGatewayContactAt: orgSummary.lastGatewayContactAt,
        updatedAt: orgSummary.updatedAt,
      }
    : null,
  siteSummaries: siteSummaries.map((s) => ({
    siteId: s.siteId,
    reporting: s.reporting,
    gatewayOnline: s.gatewayOnline,
    linkOk: s.linkOk,
    lastTelemetryAt: s.lastTelemetryAt,
  })),
  now: Date.now(),
};
`;

const r = spawnSync(
  process.execPath,
  [convexCli, "run", "--deployment", "dev", "--inline-query", query],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
