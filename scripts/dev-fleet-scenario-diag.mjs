/** Snapshot power-source mix for the live demo org. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");
const orgId = process.argv[2] || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr";

const query = `
const orgId = ${JSON.stringify(orgId)};
const now = Date.now();
const devices = await ctx.db.query("devices").withIndex("by_org", q => q.eq("organizationId", orgId)).take(80);
let running = 0, mains = 0, stopped = 0, alarm = 0, linkFail = 0, stale = 0, fresh = 0;
const samples = [];
for (const d of devices) {
  if (d.lifecycle === "inactive") continue;
  const gens = await ctx.db.query("generators").withIndex("by_device", q => q.eq("deviceId", d._id)).take(1);
  const g = gens[0];
  if (!g) continue;
  const tel = await ctx.db.query("telemetryCurrent").withIndex("by_generator", q => q.eq("generatorId", g._id)).unique();
  const health = await ctx.db.query("deviceHealthCurrent").withIndex("by_device", q => q.eq("deviceId", d._id)).unique();
  if (!tel) continue;
  const mainsL1 = typeof tel.extra?.mainsL1 === "number" ? tel.extra.mainsL1 : null;
  const ageSec = tel.updatedAt ? Math.round((now - tel.updatedAt)/1000) : null;
  if ((tel.alarmCount ?? 0) > 0) alarm += 1;
  if (tel.link === "fail") linkFail += 1;
  if (tel.rpm != null && tel.rpm > 0) running += 1;
  else if (mainsL1 != null && mainsL1 >= 100) mains += 1;
  else stopped += 1;
  if (health?.telemetryFreshness === "fresh") fresh += 1;
  else stale += 1;
  if (samples.length < 8) {
    samples.push({ identity: d.identity, rpm: tel.rpm, mainsL1, alm: tel.alarmCount, link: tel.link, ageSec, fuel: tel.extra?.fuelPct ?? null, load: tel.extra?.loadPct ?? null });
  }
}
const maint = await ctx.db.query("maintenanceRecords").withIndex("by_org", q => q.eq("organizationId", orgId)).take(20);
return { running, mains, stopped, alarm, linkFail, fresh, stale, maintenanceRecords: maint.length, samples };
`;

const r = spawnSync(
  process.execPath,
  [convexCli, "run", "--deployment", "dev", "--inline-query", query],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
