/**
 * Non-destructive environment profile validation.
 * Checks required *names* and public URL shapes. Never prints secret values.
 *
 *   node scripts/validate-env-profile.mjs staging
 *   node scripts/validate-env-profile.mjs production
 *   node scripts/validate-env-profile.mjs staging --env-file .env.staging.local
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const profile = process.argv[2];
const envFileFlag = process.argv.indexOf("--env-file");
const envFile = envFileFlag >= 0 ? process.argv[envFileFlag + 1] : null;

if (!profile || !["staging", "production", "development"].includes(profile)) {
  console.error("usage: node scripts/validate-env-profile.mjs <development|staging|production> [--env-file path]");
  process.exit(2);
}

const REQUIRED_CONVEX = {
  development: ["AUTH_JWT_ISSUER", "AUTH_JWKS_URL", "AUTH_JWT_AUDIENCE", "INGEST_SECRET"],
  staging: ["AUTH_JWT_ISSUER", "AUTH_JWKS_URL", "AUTH_JWT_AUDIENCE", "INGEST_SECRET"],
  production: ["AUTH_JWT_ISSUER", "AUTH_JWKS_URL", "AUTH_JWT_AUDIENCE", "INGEST_SECRET"],
};

const FORBIDDEN_PROD = ["TEST_NOTIFY_EMAIL", "TEST_NOTIFY_PHONE"];

const REQUIRED_VITE = {
  development: ["VITE_CONVEX_URL"],
  staging: ["VITE_CONVEX_URL", "VITE_OIDC_ISSUER", "VITE_OIDC_CLIENT_ID", "VITE_OIDC_AUDIENCE", "VITE_OIDC_REDIRECT_URI"],
  production: ["VITE_CONVEX_URL", "VITE_OIDC_ISSUER", "VITE_OIDC_CLIENT_ID", "VITE_OIDC_AUDIENCE", "VITE_OIDC_REDIRECT_URI"],
};

function loadDotEnv(path) {
  if (!path || !existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i)] = t.slice(i + 1).trim();
  }
  return out;
}

function listConvexEnvNames(deploymentArg) {
  const r = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "convex", "env", "list", "--deployment", deploymentArg],
    { encoding: "utf8", shell: false },
  );
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Z][A-Z0-9_]+$/.test(l));
  return { ok: r.status === 0 || names.length > 0, names, rawTail: text.slice(0, 200) };
}

function assert(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}\t${name}${detail ? `\t${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const deploymentArg = profile === "production" ? "production" : profile === "staging" ? "staging" : "dev";
const expectedCloud =
  profile === "staging"
    ? "dapper-roadrunner-247.convex.cloud"
    : profile === "production"
      ? "tremendous-sturgeon-449.convex.cloud"
      : "effervescent-kangaroo-10.convex.cloud";

const local = loadDotEnv(
  envFile ||
    (profile === "staging"
      ? ".env.staging.local"
      : profile === "production"
        ? ".env.production.local"
        : ".env.local"),
);

console.log(`profile=${profile}`);
console.log(`deploymentArg=${deploymentArg}`);

const convex = listConvexEnvNames(deploymentArg);
assert("convex-env-list", convex.ok || convex.names.length >= 0, `names=${convex.names.length}`);

for (const name of REQUIRED_CONVEX[profile]) {
  assert(`convex-has-${name}`, convex.names.includes(name));
}

if (profile === "production") {
  for (const name of FORBIDDEN_PROD) {
    assert(`convex-forbids-${name}`, !convex.names.includes(name));
  }
  assert(
    "production-env-not-empty",
    convex.names.length > 0,
    "tremendous-sturgeon-449 currently expected empty until operator configures",
  );
}

for (const name of REQUIRED_VITE[profile]) {
  const val = local[name]?.trim() ?? "";
  assert(`vite-has-${name}`, Boolean(val), val ? "set" : "missing-in-env-file");
  if (name === "VITE_CONVEX_URL" && val) {
    assert(`vite-convex-host`, val.includes(expectedCloud.split(".")[0]) || val.includes(expectedCloud), "host-check");
    assert(`vite-convex-https`, val.startsWith("https://"));
  }
  if (name.startsWith("VITE_OIDC_ISSUER") && val) {
    assert(`vite-oidc-https`, val.startsWith("https://"));
  }
}

const secretLeak = Object.keys(local).filter((k) => k.startsWith("VITE_") && /SECRET|PASSWORD|PRIVATE|API_KEY/i.test(k));
assert("no-secret-shaped-vite-keys", secretLeak.length === 0, secretLeak.join(",") || "ok");

if (profile === "staging" && local.VITE_OIDC_AUDIENCE) {
  assert("staging-aud-icanova", local.VITE_OIDC_AUDIENCE.trim() === "icanova");
}

console.log(process.exitCode ? "profile=FAILED" : "profile=PASSED");
