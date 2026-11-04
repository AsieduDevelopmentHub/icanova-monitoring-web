/**
 * List Demo Power Ghana orgs + sample siteSummary ages for diagnosis.
 *   node scripts/dev-fleet-orgs.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");

const query = `
const now = Date.now();
const orgs = await ctx.db.query("organizations").take(100);
const demo = orgs.filter((o) => (o.name || "").includes("Demo Power"));
const out = [];
for (const org of demo) {
  const summaries = await ctx.db
    .query("siteSummaries")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .take(3);
  const devices = await ctx.db
    .query("devices")
    .withIndex("by_org", (q) => q.eq("organizationId", org._id))
    .take(2);
  const ages = summaries.map((s) => ({
    lastTelemetryAt: s.lastTelemetryAt,
    ageSec: s.lastTelemetryAt ? Math.round((now - s.lastTelemetryAt) / 1000) : null,
    reporting: s.reporting,
    gatewayOnline: s.gatewayOnline,
  }));
  out.push({
    organizationId: org._id,
    name: org.name,
    createdAt: org.createdAt ?? null,
    deviceSample: devices.map((d) => ({ identity: d.identity, lifecycle: d.lifecycle })),
    summarySample: ages,
  });
}
return { now, demoCount: demo.length, demo: out };
`;

const r = spawnSync(
  process.execPath,
  [convexCli, "run", "--deployment", "dev", "--inline-query", query],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
