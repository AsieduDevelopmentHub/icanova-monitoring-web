/**
 * Staging-only HTTP dual-auth matrix for /ncu/ingest.
 * Uses lab operator JWT + synthetic devices. Does not print secrets or hashes.
 *
 *   node scripts/staging-device-cred-http.mjs
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = new URL("../", import.meta.url);
const site = "https://dapper-roadrunner-247.convex.site";
const cloud = "https://dapper-roadrunner-247.convex.cloud";
const ingestUrl = `${site}/ncu/ingest`;
// Unique per-run 12-hex identities avoid by_identity collisions across staging orgs.
const suffix = Date.now().toString(16).padStart(10, "0").slice(-10);
const identityA = `a1${suffix}`; // 12 hex chars
const identityB = `b2${suffix}`;
if (!/^[0-9a-f]{12}$/.test(identityA) || !/^[0-9a-f]{12}$/.test(identityB)) {
  throw new Error(`bad test identities ${identityA} ${identityB}`);
}
const credA1 = "staging-device-a-secret01";
const credA2 = "staging-device-a-secret02";
const credB = "staging-device-b-secret99";

function loadEnvLocal(path) {
  const text = readFileSync(new URL(path, root), "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return out;
}

async function postIngest(bearer, body) {
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.slice(0, 200) };
}

function heartbeat(identity) {
  return { kind: "heartbeat", identity };
}

function assertCase(name, ok, detail = "") {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}\t${name}${detail ? `\t${detail}` : ""}`);
  if (!ok) {
    process.exitCode = 1;
  }
}

const env = loadEnvLocal(".env.staging.local");
const shared = env.INGEST_SECRET?.trim();
if (!shared || shared.length < 32) {
  throw new Error("INGEST_SECRET missing from .env.staging.local");
}
// Prefer Auth0 access token (aud=icanova); fall back to lab mint only if present.
function loadOperatorToken() {
  const auth0Path = new URL(".jwt/staging/auth0.access.token", root);
  const labPath = new URL(".jwt/staging/session.token", root);
  try {
    const t = readFileSync(auth0Path, "utf8").trim();
    if (t) return t;
  } catch {
    /* missing */
  }
  try {
    return readFileSync(labPath, "utf8").trim();
  } catch {
    throw new Error(
      "Need .jwt/staging/auth0.access.token (Auth0 access token, aud=icanova) for staging Convex mutations.",
    );
  }
}
const token = loadOperatorToken();
const client = new ConvexHttpClient(cloud);
client.setAuth(token);
const page = { numItems: 20, cursor: null };

await client.mutation(api.users.ensure, {});
const orgs = await client.query(api.organizations.mine, {});
let organizationId = orgs[0]?.organizationId;
if (!organizationId) {
  organizationId = await client.mutation(api.organizations.create, { name: "Station" });
}
const sites = await client.query(api.sites.list, { organizationId, paginationOpts: page });
let siteId = sites.page[0]?._id;
if (!siteId) {
  siteId = await client.mutation(api.sites.create, { organizationId, name: "Station" });
}

async function ensureDevice(identity, name) {
  const devices = await client.query(api.devices.list, {
    organizationId,
    siteId,
    paginationOpts: page,
  });
  let device = devices.page.find((row) => row.identity === identity);
  if (!device) {
    const deviceId = await client.mutation(api.devices.create, {
      organizationId,
      siteId,
      name,
      identity,
    });
    device = { _id: deviceId, identity };
  }
  // Ensure active for matrix start.
  await client.mutation(api.devices.setLifecycle, {
    deviceId: device._id,
    lifecycle: "active",
  });
  return device;
}

const deviceA = await ensureDevice(identityA, "cred-matrix-a");
const deviceB = await ensureDevice(identityB, "cred-matrix-b");

await client.mutation(api.devices.setIngestCredential, {
  deviceId: deviceA._id,
  plaintext: credA1,
});
await client.mutation(api.devices.setIngestCredential, {
  deviceId: deviceB._id,
  plaintext: credB,
});

const detail = await client.query(api.devices.detail, { deviceId: deviceA._id });
assertCase(
  "detail-hides-hashes",
  detail.device.hasIngestCredential === true &&
    !JSON.stringify(detail).includes("ingestCredentialHash") &&
    !JSON.stringify(detail).includes(credA1),
);

{
  const r = await postIngest(shared, heartbeat(identityA));
  assertCase("shared-secret-ok", r.status === 204, `status=${r.status}`);
}
{
  const r = await postIngest("not-a-valid-secret!!!!!!!!!!!", heartbeat(identityA));
  assertCase("invalid-bearer-401", r.status === 401, `status=${r.status}`);
}
{
  const r = await fetch(ingestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(heartbeat(identityA)),
  });
  assertCase("missing-bearer-401", r.status === 401, `status=${r.status}`);
}
{
  const r = await postIngest(credA1, heartbeat(identityA));
  assertCase("device-cred-valid", r.status === 204, `status=${r.status}`);
}
{
  const r = await postIngest("wrong-device-secret!!!!!", heartbeat(identityA));
  assertCase("device-cred-invalid", r.status === 401, `status=${r.status}`);
}
{
  const r = await postIngest(credB, heartbeat(identityA));
  assertCase("wrong-device-cred", r.status === 401, `status=${r.status}`);
}

await client.mutation(api.devices.setIngestCredential, {
  deviceId: deviceA._id,
  plaintext: credA2,
});
{
  const oldOk = await postIngest(credA1, heartbeat(identityA));
  const newOk = await postIngest(credA2, heartbeat(identityA));
  assertCase(
    "rotation-overlap",
    oldOk.status === 204 && newOk.status === 204,
    `old=${oldOk.status} new=${newOk.status}`,
  );
}

await client.mutation(api.devices.clearIngestCredential, { deviceId: deviceA._id });
{
  const revoked = await postIngest(credA2, heartbeat(identityA));
  const sharedStill = await postIngest(shared, heartbeat(identityA));
  assertCase(
    "revoked-device-cred",
    revoked.status === 401 && sharedStill.status === 204,
    `revoked=${revoked.status} shared=${sharedStill.status}`,
  );
}

// Re-set credential then deactivate.
await client.mutation(api.devices.setIngestCredential, {
  deviceId: deviceA._id,
  plaintext: credA2,
});
await client.mutation(api.devices.setLifecycle, {
  deviceId: deviceA._id,
  lifecycle: "inactive",
});
{
  const inactive = await postIngest(credA2, heartbeat(identityA));
  assertCase("inactive-device-403", inactive.status === 403, `status=${inactive.status}`);
}
// Restore active for future lab use; leave credential set.
await client.mutation(api.devices.setLifecycle, {
  deviceId: deviceA._id,
  lifecycle: "active",
});

console.log(`target=${ingestUrl}`);
console.log(`organizationId=${organizationId}`);
console.log(`deviceA=${identityA} deviceB=${identityB}`);
console.log(process.exitCode ? "matrix=FAILED" : "matrix=PASSED");
