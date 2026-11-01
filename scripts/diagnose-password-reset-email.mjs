/**
 * Diagnose staging password-reset email delivery.
 * Sends a Resend canary with the staging key, then calls auth.signIn reset.
 * Never prints API keys or OTP codes.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Resend } from "resend";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

function load(path) {
  const map = {};
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    map[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return map;
}

function convexGet(name) {
  const result = spawnSync(
    "npx",
    ["convex", "env", "get", name, "--deployment", "staging"],
    { encoding: "utf8", shell: true, cwd: process.cwd() },
  );
  return (result.stdout || "").trim();
}

function domainOf(value) {
  const email = (value.match(/<([^>]+)>/)?.[1] || value).trim().toLowerCase();
  return email.includes("@") ? email.split("@")[1] : "(none)";
}

const fileEnv = { ...load(".env.staging.local"), ...load(".env.local") };
const to = (process.env.TEST_NOTIFY_EMAIL || fileEnv.TEST_NOTIFY_EMAIL || "")
  .trim()
  .toLowerCase();
const key = convexGet("RESEND_API_KEY");
const from = convexGet("AUTH_EMAIL_FROM") || convexGet("RESEND_FROM");

if (!to || !key || !from) {
  console.error("FAIL\tmissing to/key/from");
  process.exit(1);
}

console.log(`mailbox_domain=${domainOf(to)}`);
console.log(`from_domain=${domainOf(from)}`);
console.log(`key_len=${key.length} key_prefix=${key.slice(0, 4)}`);

const resend = new Resend(key);
const stamp = new Date().toISOString();
const canary = await resend.emails.send({
  from,
  to: [to],
  subject: `iCaNova Resend canary ${stamp}`,
  text: `Canary only. Not a password reset. ${stamp}`,
});
if (canary.error) {
  console.log(`canary=FAIL ${JSON.stringify(canary.error)}`);
} else {
  console.log(`canary=OK id=${canary.data?.id ?? "unknown"}`);
}

const client = new ConvexHttpClient("https://dapper-roadrunner-247.convex.cloud");
try {
  const result = await client.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "reset", email: to },
  });
  console.log(`reset_action=OK ${JSON.stringify(result)}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(
    `reset_action=FAIL ${message.replace(/re_[A-Za-z0-9]+/g, "re_***").slice(0, 600)}`,
  );
}
