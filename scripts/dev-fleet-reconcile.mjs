/**
 * Rebuild Demo Power Ghana health tallies after OCC soak damage.
 *   node scripts/dev-fleet-reconcile.mjs
 *   node scripts/dev-fleet-reconcile.mjs <organizationId>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");
const organizationId = process.argv[2] || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr";

const r = spawnSync(
  process.execPath,
  [
    convexCli,
    "run",
    "--deployment",
    "dev",
    "--push",
    "deviceHealth:reconcileOrg",
    JSON.stringify({ organizationId, cursor: null }),
  ],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
