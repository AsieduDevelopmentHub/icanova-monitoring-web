/**
 * Point demo users at the live Demo Power Ghana org; archive older clones.
 *   node scripts/dev-fleet-fix-membership.mjs
 *   node scripts/dev-fleet-fix-membership.mjs <organizationId>
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");
const keepOrganizationId = process.argv[2] || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr";

const r = spawnSync(
  process.execPath,
  [
    convexCli,
    "run",
    "--deployment",
    "dev",
    "--push",
    "demoSeed:retargetDemoMemberships",
    JSON.stringify({ keepOrganizationId }),
  ],
  { encoding: "utf8", cwd: repoRoot },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
process.exit(r.status ?? 1);
