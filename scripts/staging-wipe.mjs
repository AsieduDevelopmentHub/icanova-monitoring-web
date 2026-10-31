import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const envPath = new URL("../.env.staging.local", import.meta.url);
const envText = readFileSync(envPath, "utf8");
const keyLine = envText.split(/\r?\n/).find((l) => l.startsWith("CONVEX_DEPLOY_KEY="));
if (!keyLine) throw new Error("CONVEX_DEPLOY_KEY missing in .env.staging.local");
process.env.CONVEX_DEPLOY_KEY = keyLine.slice("CONVEX_DEPLOY_KEY=".length);

let tableIndex = Number(process.argv[2] ?? 0);
let rounds = 0;
let totalDeleted = 0;

while (rounds < 500) {
  const argsJson = JSON.stringify({ confirm: "STAGING_WIPE", tableIndex });
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "convex", "run", "stagingWipe:clearTenantData", argsJson],
    { encoding: "utf8", shell: false, env: process.env },
  );
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  console.log(out);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  const match = out.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("Could not parse wipe result");
    process.exit(1);
  }
  const parsed = JSON.parse(match[0]);
  totalDeleted += parsed.deleted ?? 0;
  rounds += 1;
  if (parsed.done) {
    console.log(`DONE rounds=${rounds} totalDeleted≈${totalDeleted}`);
    process.exit(0);
  }
  tableIndex = parsed.tableIndex;
}

console.error("safety stop after 500 rounds");
process.exit(1);
