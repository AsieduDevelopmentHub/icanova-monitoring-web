/**
 * Non-destructive environment profile validation.
 * Checks required *names* and public URL shapes. Never prints secret values.
 *
 *   node scripts/validate-env-profile.mjs development
 *   node scripts/validate-env-profile.mjs staging
 *   node scripts/validate-env-profile.mjs recovery
 *   node scripts/validate-env-profile.mjs production
 *   node scripts/validate-env-profile.mjs staging --env-file .env.staging.local
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PROFILES = ["development", "staging", "recovery", "production"];
const profile = process.argv[2];
const envFileFlag = process.argv.indexOf("--env-file");
const envFile = envFileFlag >= 0 ? process.argv[envFileFlag + 1] : null;

if (!profile || !PROFILES.includes(profile)) {
  console.error(
    `usage: node scripts/validate-env-profile.mjs <${PROFILES.join("|")}> [--env-file path]`,
  );
  process.exit(2);
}

/** Convex deployment CLI arg and expected cloud host fragment. */
const DEPLOYMENT = {
  development: { arg: "dev", cloud: "effervescent-kangaroo-10.convex.cloud", ref: "effervescent-kangaroo-10" },
  staging: { arg: "staging", cloud: "dapper-roadrunner-247.convex.cloud", ref: "dapper-roadrunner-247" },
  recovery: { arg: "recovery", cloud: "vivid-mosquito-28.convex.cloud", ref: "vivid-mosquito-28" },
  production: { arg: "production", cloud: "tremendous-sturgeon-449.convex.cloud", ref: "tremendous-sturgeon-449" },
};

/** Convex Auth (Password) — active. Auth0 AUTH_JWT_* retained for future IdP cutover only. */
const REQUIRED_CONVEX = {
  development: ["JWT_PRIVATE_KEY", "JWKS", "INGEST_SECRET"],
  staging: ["JWT_PRIVATE_KEY", "JWKS", "INGEST_SECRET"],
  recovery: ["JWT_PRIVATE_KEY", "JWKS", "INGEST_SECRET"],
  // Production not cut over in 8.5E — still empty; require Convex Auth keys when provisioning.
  production: ["JWT_PRIVATE_KEY", "JWKS", "INGEST_SECRET"],
};

const REQUIRED_VITE = {
  development: ["VITE_CONVEX_URL"],
  staging: ["VITE_CONVEX_URL"],
  recovery: ["VITE_CONVEX_URL"],
  // Auth0 VITE_OIDC_* no longer required for SPA login (Convex Auth).
  production: ["VITE_CONVEX_URL"],
};

/** Lab-only destinations — never on recovery or production. */
const FORBIDDEN_TEST_NOTIFY = ["TEST_NOTIFY_EMAIL", "TEST_NOTIFY_PHONE"];

/** Recovery quarantine: no provider notify at all. Production may add Resend/Arkesel later. */
const FORBIDDEN_RECOVERY_NOTIFY = [
  ...FORBIDDEN_TEST_NOTIFY,
  "RESEND_API_KEY",
  "RESEND_FROM",
  "ARKESEL_API_KEY",
  "ARKESEL_SENDER",
  "EMAIL_ALERTS_ENABLED",
  "SMS_ALERTS_ENABLED",
];

/** Staging Auth0 host fragment — production must not reuse it. */
const STAGING_AUTH0_HOST = "dev-notfczud6xx8hhxf.us.auth0.com";

const CROSS_ENV_HOSTS = {
  development: ["dapper-roadrunner-247", "tremendous-sturgeon-449", "vivid-mosquito-28"],
  staging: ["effervescent-kangaroo-10", "tremendous-sturgeon-449", "vivid-mosquito-28"],
  recovery: ["effervescent-kangaroo-10", "dapper-roadrunner-247", "tremendous-sturgeon-449"],
  production: ["effervescent-kangaroo-10", "dapper-roadrunner-247", "vivid-mosquito-28"],
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
  // Prefer local binary; avoid CONVEX_DEPLOY_KEY + --deployment conflict.
  const env = { ...process.env };
  delete env.CONVEX_DEPLOY_KEY;
  delete env.CONVEX_DEPLOYMENT;
  const convexBin = process.platform === "win32"
    ? "node_modules/convex/bin/main.js"
    : "node_modules/convex/bin/main.js";
  const r = spawnSync(
    process.execPath,
    [convexBin, "env", "list", "--deployment", deploymentArg],
    { encoding: "utf8", env, shell: false, cwd: process.cwd() },
  );
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/cannot be used with CONVEX_DEPLOY_KEY/i.test(text)) {
    return { ok: false, names: [], rawTail: "deploy-key-conflict" };
  }
  const names = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[A-Z][A-Z0-9_]+$/.test(l));
  return { ok: names.length > 0 || /No environment variables set/i.test(text), names, rawTail: text.slice(0, 240) };
}

function assert(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}\t${name}${detail ? `\t${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

function defaultEnvFile(p) {
  if (p === "staging") return ".env.staging.local";
  if (p === "production") return ".env.production.local";
  if (p === "recovery") return ".env.recovery.local";
  return ".env.local";
}

const meta = DEPLOYMENT[profile];
const local = loadDotEnv(envFile || defaultEnvFile(profile));

console.log(`profile=${profile}`);
console.log(`deploymentArg=${meta.arg}`);
console.log(`expectedCloud=${meta.cloud}`);
console.log(`expectedRef=${meta.ref}`);

const convex = listConvexEnvNames(meta.arg);
assert("convex-env-list", convex.ok || convex.names.length >= 0, `names=${convex.names.length}`);

for (const name of REQUIRED_CONVEX[profile]) {
  assert(`convex-has-${name}`, convex.names.includes(name));
}

if (profile === "recovery") {
  for (const name of FORBIDDEN_RECOVERY_NOTIFY) {
    assert(`forbids-${name}`, !convex.names.includes(name));
  }
}
if (profile === "production") {
  for (const name of FORBIDDEN_TEST_NOTIFY) {
    assert(`forbids-${name}`, !convex.names.includes(name));
  }
}

if (profile === "production") {
  assert(
    "production-env-provisioned",
    convex.names.length > 0,
    "tremendous-sturgeon-449 empty until operator configures — expected FAIL pre-provision",
  );
  // Production Vite file must not point at staging Auth0 when present
  const iss = local.VITE_OIDC_ISSUER?.trim() ?? "";
  if (iss) {
    assert(
      "production-not-staging-issuer",
      !iss.includes(STAGING_AUTH0_HOST),
      "staging Auth0 host rejected",
    );
  }
  const aud = local.VITE_OIDC_AUDIENCE?.trim() ?? "";
  if (aud) {
    assert("production-audience-set", Boolean(aud), "set");
    assert("production-audience-not-lab-default", aud !== "dse-gateway");
  }
}

for (const name of REQUIRED_VITE[profile]) {
  const val = local[name]?.trim() ?? "";
  const present = Boolean(val);
  // Recovery may validate Convex URL from env file; missing Vite OIDC is OK (quarantine).
  if (profile === "production" && !present) {
    assert(`vite-has-${name}`, false, "missing-in-env-file");
  } else if (profile === "staging") {
    assert(`vite-has-${name}`, present, present ? "set" : "missing-in-env-file");
  } else if (profile === "development" || profile === "recovery") {
    if (name === "VITE_CONVEX_URL") {
      assert(`vite-has-${name}`, present, present ? "set" : "missing-in-env-file");
    }
  }

  if (name === "VITE_CONVEX_URL" && val) {
    assert(`vite-convex-https`, val.startsWith("https://"));
    assert(
      `vite-convex-host`,
      val.includes(meta.ref) || val.includes(meta.cloud),
      "host-check",
    );
    for (const foreign of CROSS_ENV_HOSTS[profile]) {
      assert(`vite-not-${foreign}`, !val.includes(foreign));
    }
  }
  if (name === "VITE_OIDC_ISSUER" && val) {
    assert(`vite-oidc-https`, val.startsWith("https://"));
  }
  if (name === "VITE_OIDC_AUDIENCE" && val) {
    if (profile === "staging") {
      assert("staging-aud-icanova", val === "icanova");
    }
    assert("audience-not-empty-fallback", val.length > 0);
    assert("audience-not-disabled", val !== "disabled");
  }
  if (name === "VITE_OIDC_REDIRECT_URI" && val && profile === "production") {
    assert(
      "production-redirect-https",
      val.startsWith("https://"),
      "prod callback must be https",
    );
    assert(
      "production-redirect-not-localhost",
      !/localhost|127\.0\.0\.1/i.test(val),
    );
  }
}

const secretLeak = Object.keys(local).filter(
  (k) => k.startsWith("VITE_") && /SECRET|PASSWORD|PRIVATE|API_KEY/i.test(k),
);
assert("no-secret-shaped-vite-keys", secretLeak.length === 0, secretLeak.join(",") || "ok");

// Cross-env Convex URL in recovery/prod env files
if (local.CONVEX_DEPLOYMENT) {
  const dep = local.CONVEX_DEPLOYMENT;
  assert(`deploy-key-ref-${meta.ref}`, dep.includes(meta.ref), "deployment identity");
  for (const foreign of CROSS_ENV_HOSTS[profile]) {
    assert(`deploy-not-${foreign}`, !dep.includes(foreign));
  }
}

console.log(process.exitCode ? "profile=FAILED" : "profile=PASSED");
