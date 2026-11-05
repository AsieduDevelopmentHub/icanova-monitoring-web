import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");
const orgId = process.argv[2] || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr";

const query = `
const orgId = ${JSON.stringify(orgId)};
const devices = await ctx.db.query("devices").withIndex("by_org", (q) => q.eq("organizationId", orgId)).take(60);
const out = [];
let measured = 0;
let unavailable = 0;
let near12 = 0;
for (const d of devices) {
  if (d.lifecycle === "inactive") continue;
  const gens = await ctx.db.query("generators").withIndex("by_device", (q) => q.eq("deviceId", d._id)).take(1);
  const g = gens[0];
  if (!g) continue;
  const tel = await ctx.db.query("telemetryCurrent").withIndex("by_generator", (q) => q.eq("generatorId", g._id)).unique();
  if (!tel) continue;
  if (tel.batteryQuality === "measured" && tel.batteryV != null) {
    measured += 1;
    if (tel.batteryV >= 11 && tel.batteryV <= 14.5) near12 += 1;
  } else {
    unavailable += 1;
  }
  if (out.length < 12) {
    out.push({
      identity: d.identity,
      batteryV: tel.batteryV,
      batteryQuality: tel.batteryQuality,
      rpm: tel.rpm,
      link: tel.link,
      chargeAltV: tel.extra?.chargeAltV ?? null,
    });
  }
}
return { measured, unavailable, near12, sample: out };
`;

const r = spawnSync(
  process.execPath,
  [convexCli, "run", "--deployment", "dev", "--inline-query", query],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
