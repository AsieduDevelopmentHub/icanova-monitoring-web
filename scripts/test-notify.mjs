/**
 * Live Resend / Arkesel smoke test against Convex.
 * Destinations: argv or TEST_NOTIFY_EMAIL / TEST_NOTIFY_PHONE in .env.local.
 * Never prints API keys.
 */
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = new URL("../", import.meta.url);

function envLocal(name) {
  const text = readFileSync(new URL(".env.local", root), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && match[1] === name) {
      return match[2].trim();
    }
  }
  return "";
}

function fromAddress() {
  const from = envLocal("RESEND_FROM");
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}

const email = process.argv[2] || envLocal("TEST_NOTIFY_EMAIL") || fromAddress();
const phone = process.argv[3] || envLocal("TEST_NOTIFY_PHONE");
const token = readFileSync(new URL(".jwt/session.token", root), "utf8").trim();
const client = new ConvexHttpClient("https://effervescent-kangaroo-10.convex.cloud");
client.setAuth(token);

const stamp = new Date().toISOString();
const orgs = await client.query(api.organizations.mine, {});
const organizationId = orgs[0]?.organizationId;
if (!organizationId) {
  throw new Error("No organization for operator token");
}

console.log(`org=${orgs[0]?.name} email-to=${email ? "set" : "missing"} sms-to=${phone ? "set" : "missing"}`);

if (email) {
  try {
    const result = await client.action(api.notify.sendEmail, {
      organizationId,
      to: email,
      subject: `DSE notify demo ${stamp}`,
      html: `<p>Demo Resend delivery from iCanOva Monitoring Platform at ${stamp}.</p><p>This is not an operational alarm.</p>`,
    });
    console.log(`email=sent providerId=${result.id ?? "null"}`);
  } catch (error) {
    console.log(`email=failed ${error instanceof Error ? error.message.slice(0, 200) : error}`);
  }
}

if (phone) {
  try {
    const result = await client.action(api.notify.sendSms, {
      organizationId,
      to: phone,
      message: `DSE demo SMS ${stamp}. Not an operational alarm.`,
    });
    console.log(`sms=sent providerId=${result.id ?? "null"}`);
  } catch (error) {
    console.log(`sms=failed ${error instanceof Error ? error.message.slice(0, 200) : error}`);
  }
} else {
  console.log("sms=skipped (pass phone as argv[3] or TEST_NOTIFY_PHONE in .env.local)");
}

const deliveries = await client.query(api.notifications.listDeliveries, {
  organizationId,
  paginationOpts: { numItems: 5, cursor: null },
});
for (const row of deliveries.page) {
  console.log(
    JSON.stringify({
      channel: row.channel,
      status: row.status,
      attempt: row.attempt,
      failureCategory: row.failureCategory,
      providerId: row.providerId,
      error: row.error,
      createdAt: new Date(row.createdAt).toISOString(),
    }),
  );
}
