import { readFileSync, writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const root = new URL("../", import.meta.url);
const argv = process.argv.slice(2);
const staging = argv.includes("--staging");
const args = argv.filter((a) => a !== "--staging");
const tokenRel = staging ? ".jwt/staging/session.token" : ".jwt/session.token";
const scopeRel = staging ? ".jwt/staging/scope.json" : ".jwt/scope.json";
const deployment = staging
  ? "https://dapper-roadrunner-247.convex.cloud"
  : "https://effervescent-kangaroo-10.convex.cloud";
const token = readFileSync(new URL(tokenRel, root), "utf8").trim();
const client = new ConvexHttpClient(deployment);
client.setAuth(token);
const page = { numItems: 10, cursor: null };
const scopePath = new URL(scopeRel, root);

async function ensureScope() {
  const userId = await client.mutation(api.users.ensure, {});
  let orgs = await client.query(api.organizations.mine, {});
  let organizationId = orgs[0]?.organizationId;
  if (!organizationId) {
    organizationId = await client.mutation(api.organizations.create, { name: "Station" });
    orgs = await client.query(api.organizations.mine, {});
  }
  const sites = await client.query(api.sites.list, { organizationId, paginationOpts: page });
  let siteId = sites.page[0]?._id;
  if (!siteId) {
    siteId = await client.mutation(api.sites.create, { organizationId, name: "Station" });
  }
  const scope = { userId, organizationId, siteId, name: orgs[0]?.name ?? "Station" };
  writeFileSync(scopePath, JSON.stringify(scope));
  console.log(`signed-in organization=${scope.name} sites=${sites.page.length || 1}`);
}

async function register(identity) {
  const scope = JSON.parse(readFileSync(scopePath, "utf8"));
  const devices = await client.query(api.devices.list, {
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    paginationOpts: page,
  });
  let device = devices.page.find((row) => row.identity === identity);
  if (!device) {
    const deviceId = await client.mutation(api.devices.create, {
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      name: "dse-gw",
      identity,
    });
    device = { _id: deviceId, identity };
  }
  const generators = await client.query(api.generators.list, {
    organizationId: scope.organizationId,
    siteId: scope.siteId,
    paginationOpts: page,
  });
  const existing = generators.page.find((row) => row.deviceId === device._id);
  if (!existing) {
    await client.mutation(api.generators.create, {
      organizationId: scope.organizationId,
      siteId: scope.siteId,
      deviceId: device._id,
      name: "Set 1",
    });
  }
  console.log(`registered identity=${identity}`);
}

async function telemetry() {
  const scope = JSON.parse(readFileSync(scopePath, "utf8"));
  const current = await client.query(api.telemetry.currentForSite, {
    organizationId: scope.organizationId,
    siteId: scope.siteId,
  });
  const row = current.rows.find((item) => item.updatedAt !== null) ?? null;
  if (!row) {
    console.log("telemetry-current=empty");
    return;
  }
  console.log(
    JSON.stringify({
      name: row.name,
      updatedAt: new Date(row.updatedAt).toISOString(),
      sourceTime: row.sourceTime,
      link: row.link,
      mode: row.mode,
      alarmCount: row.alarmCount,
      rpm: row.rpm,
      rpmQuality: row.rpmQuality,
      batteryV: row.batteryV,
      batteryQuality: row.batteryQuality,
      frequencyHz: row.frequencyHz,
      frequencyQuality: row.frequencyQuality,
      powerKw: row.powerKw,
      powerQuality: row.powerQuality,
      voltageL1: row.voltageL1,
      voltageQuality: row.voltageQuality,
    }),
  );
}

const [command, identity] = args;
if (command === "ensure") {
  await ensureScope();
} else if (command === "register") {
  await register(identity);
} else if (command === "telemetry") {
  await telemetry();
} else {
  throw new Error("use ensure [--staging], register <identity> [--staging], or telemetry [--staging]");
}
