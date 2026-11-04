/**
 * Seed demo fleet on Convex deployment (default: personal `dev`).
 *
 *   node scripts/seed-demo-fleet.mjs
 *   node scripts/seed-demo-fleet.mjs --deployment dev
 *
 * Reads PLATFORM_ADMIN_SECRET from Convex env for that deployment.
 * Does not print the secret.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

const deployment = arg("--deployment", "dev");
const orgName = arg("--org", "Demo Power Ghana");

function convex(args) {
  const r = spawnSync(process.execPath, [convexCli, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  if (r.error) throw r.error;
  return r;
}

const secretResult = convex(["env", "get", "PLATFORM_ADMIN_SECRET", "--deployment", deployment]);
const secret = (secretResult.stdout || "").trim();
if (secretResult.status !== 0 || !secret) {
  process.stderr.write(secretResult.stderr || "PLATFORM_ADMIN_SECRET missing on deployment\n");
  process.exit(1);
}

const payload = JSON.stringify({
  secret,
  organizationName: orgName,
});

const run = convex(["run", "--deployment", deployment, "demoSeed:seedDemoFleet", payload]);
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
process.exit(run.status ?? 1);
