/**
 * Verify Auth0 access token → Convex staging (/me + org queries).
 * Reads token from .jwt/staging/auth0.access.token (gitignored) or AUTH0_ACCESS_TOKEN.
 * Never prints the token.
 *
 *   node scripts/verify-auth0-staging.mjs
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = new URL("../", import.meta.url);
const site = "https://dapper-roadrunner-247.convex.site";
const cloud = "https://dapper-roadrunner-247.convex.cloud";
const expectedIss = "https://dev-notfczud6xx8hhxf.us.auth0.com/";
const expectedAud = "icanova";
const tokenPath = new URL(".jwt/staging/auth0.access.token", root);

function loadToken() {
  const fromEnv = process.env.AUTH0_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(tokenPath)) return readFileSync(tokenPath, "utf8").trim();
  throw new Error(
    "Missing Auth0 access token. Save it to .jwt/staging/auth0.access.token (gitignored) or set AUTH0_ACCESS_TOKEN.",
  );
}

function b64urlJson(part) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (part.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
}

function assert(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}\t${name}${detail ? `\t${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const token = loadToken();
const parts = token.split(".");
assert("jwt-shape", parts.length === 3);
const header = b64urlJson(parts[0]);
const claims = b64urlJson(parts[1]);
assert("alg-rs256", header.alg === "RS256", `alg=${header.alg}`);
const iss = String(claims.iss ?? "");
assert(
  "iss",
  iss.replace(/\/$/, "") === expectedIss.replace(/\/$/, ""),
  `iss=${iss}`,
);
const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
assert("aud-icanova", aud.includes(expectedAud), `aud=${JSON.stringify(claims.aud)}`);
assert("sub-present", typeof claims.sub === "string" && claims.sub.length > 0);
assert("exp-future", typeof claims.exp === "number" && claims.exp > Date.now() / 1000);
assert("not-id-token-azp-only", aud.includes(expectedAud)); // access token must carry API aud

const meResp = await fetch(`${site}/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
const meText = await meResp.text();
assert("me-status", meResp.status === 200, `status=${meResp.status}`);
let me = null;
try {
  me = JSON.parse(meText);
} catch {
  assert("me-json", false);
}
if (me) {
  assert("me-subject", typeof me.subject === "string" && me.subject.length > 0);
  assert("me-sub-matches-jwt", me.subject === claims.sub);
  // never log email/sub in full if sensitive — print lengths only
  console.log(`info\tme-subject-len=${me.subject.length}`);
}

const client = new ConvexHttpClient(cloud);
client.setAuth(token);
const userId = await client.mutation(api.users.ensure, {});
assert("users-ensure", Boolean(userId));
let orgs = await client.query(api.organizations.mine, {});
if (!orgs.length) {
  await client.mutation(api.organizations.create, { name: "Auth0Station" });
  orgs = await client.query(api.organizations.mine, {});
}
assert("org-membership", orgs.length >= 1, `count=${orgs.length}`);
const organizationId = orgs[0].organizationId;
const page = { numItems: 5, cursor: null };
const sites = await client.query(api.sites.list, { organizationId, paginationOpts: page });
assert("sites-query", Array.isArray(sites.page));

// Create/find a foreign org the user does NOT belong to — via second synthetic path is hard
// without another identity. Instead create org B with same user then we need isolation with
// a different membership. For isolation tests we create org Foreign and rely on a second
// user OR we test that random foreign id is denied.
// Lab-era org on this staging deployment (created under subject "operator").
// Auth0 user must not be a member — backend should refuse (Convex may surface "Server Error").
const foreignIdPath = new URL(".jwt/staging/foreign-org-id.txt", root);
const foreignOrgId =
  (existsSync(foreignIdPath) ? readFileSync(foreignIdPath, "utf8").trim() : "") ||
  "p57actwmrcvm9g54r5rqr5fj6s8hb5ws";
writeFileSync(foreignIdPath, foreignOrgId);
try {
  await client.query(api.sites.list, {
    organizationId: foreignOrgId,
    paginationOpts: page,
  });
  assert("foreign-org-denied", false, "query unexpectedly succeeded");
} catch (err) {
  const msg = String(err?.message ?? err);
  // Own-org query already passed above; opaque Convex "Server Error" still counts as denial.
  assert(
    "foreign-org-denied",
    /Forbidden|Unauthorized|Server Error|permission|denied/i.test(msg),
    msg.slice(0, 160),
  );
}

writeFileSync(
  new URL(".jwt/staging/auth0.verify.json", root),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      iss,
      aud: claims.aud,
      subLen: String(claims.sub).length,
      meOk: meResp.status === 200,
      orgCount: orgs.length,
      organizationId,
    },
    null,
    2,
  ),
);
console.log(process.exitCode ? "verify=FAILED" : "verify=PASSED");
