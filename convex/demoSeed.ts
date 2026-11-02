import { createAccount } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  assertPlatformAdminSecret,
  isPlatformAdminEmail,
  normalizeEmail,
  normalizeUsername,
} from "./authIdentity";
import { insertOrganizationWithRoles } from "./orgBootstrap";
import { GHANA_REGIONS } from "./regions";
import { ROLE_PRESETS } from "./rolePresets";

const DEMO_PASSWORD = "DemoPassw0rd!";
const SITE_COUNT = 56;

const DEMO_USERS: ReadonlyArray<{
  email: string;
  username: string;
  name: string;
  roleName: (typeof ROLE_PRESETS)[number]["name"];
}> = [
  {
    email: "admin@demo.icanova.test",
    username: "demo_admin",
    name: "Demo Admin",
    roleName: "Admin",
  },
  {
    email: "subadmin@demo.icanova.test",
    username: "demo_subadmin",
    name: "Demo Sub-admin",
    roleName: "Sub-admin",
  },
  {
    email: "operator@demo.icanova.test",
    username: "demo_operator",
    name: "Demo Operator",
    roleName: "Operator",
  },
  {
    email: "viewer@demo.icanova.test",
    username: "demo_viewer",
    name: "Demo Viewer",
    roleName: "Viewer",
  },
];

async function assertPlatformCaller(ctx: ActionCtx, secret: string | undefined) {
  const identity = await ctx.auth.getUserIdentity();
  const email = normalizeEmail(identity?.email ?? null);
  if (isPlatformAdminEmail(email)) {
    return;
  }
  // JWT often omits email; isCapable resolves the canonical users row.
  if (identity) {
    const capable = await ctx.runQuery(api.platformAdmin.isCapable, {});
    if (capable.capable) {
      return;
    }
  }
  assertPlatformAdminSecret(secret);
}

/** Internal: insert sites, gateways, generators, and health rows for a demo org. */
export const insertFleet = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    siteCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let sites = 0;
    let gateways = 0;
    let generators = 0;
    for (let i = 0; i < args.siteCount; i += 1) {
      const region = GHANA_REGIONS[i % GHANA_REGIONS.length]!;
      const n = i + 1;
      const code = `S${String(n).padStart(3, "0")}`;
      const siteId = await ctx.db.insert("sites", {
        organizationId: args.organizationId,
        name: `${region} Site ${n}`,
        code,
        generatorCount: 1,
        region,
        latitude: 5.5 + (i % 10) * 0.2,
        longitude: -0.2 - (i % 8) * 0.15,
        locationUpdatedAt: now,
      });
      sites += 1;
      const identity = `demo-gw-${String(n).padStart(3, "0")}`;
      const deviceId = await ctx.db.insert("devices", {
        organizationId: args.organizationId,
        siteId,
        name: `Gateway ${n}`,
        identity,
        lifecycle: "active",
        lifecycleChangedAt: now,
      });
      gateways += 1;
      const generatorId = await ctx.db.insert("generators", {
        organizationId: args.organizationId,
        siteId,
        deviceId,
        name: `Generator ${n}`,
        code: `G${String(n).padStart(3, "0")}`,
      });
      generators += 1;

      // ~90% updating/online, rest offline; ~87% fresh among updating.
      const updating = i % 10 !== 0;
      const fresh = updating && i % 12 !== 0;
      await ctx.db.insert("deviceHealthCurrent", {
        organizationId: args.organizationId,
        deviceId,
        siteId,
        generatorId,
        lastHeartbeatAt: updating ? now - 30_000 : now - 3_600_000,
        lastAcceptedBatchAt: updating ? now - 45_000 : null,
        lastGatewayContactAt: updating ? now - 30_000 : now - 3_600_000,
        lastTelemetryAt: fresh ? now - 20_000 : updating ? now - 900_000 : null,
        link: updating ? "ok" : "fail",
        gatewayStatus: updating ? "online" : "offline",
        modbusStatus: updating ? "ok" : "fail",
        telemetryFreshness: fresh ? "fresh" : updating ? "stale" : "missing",
        overallStatus: fresh ? "healthy" : updating ? "degraded" : "unhealthy",
        gatewayOfflineNotified: false,
        telemetryStaleNotified: false,
        updatedAt: now,
      });
      const q = fresh ? ("measured" as const) : ("unavailable" as const);
      await ctx.db.insert("telemetryCurrent", {
        organizationId: args.organizationId,
        siteId,
        deviceId,
        generatorId,
        updatedAt: now,
        sourceTime: fresh ? now - 20_000 : null,
        link: updating ? "ok" : "fail",
        mode: updating ? "run" : null,
        alarmCount: 0,
        rpm: fresh ? 1500 + (i % 40) : null,
        rpmQuality: q,
        batteryV: fresh ? 24 + (i % 5) * 0.1 : null,
        batteryQuality: q,
        frequencyHz: fresh ? 50 : null,
        frequencyQuality: q,
        powerKw: fresh ? 80 + (i % 50) : null,
        powerQuality: q,
        voltageL1: fresh ? 230 : null,
        voltageQuality: q,
      });
    }
    return { sites, gateways, generators };
  },
});

export const attachDemoMembership = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleName: v.string(),
  },
  handler: async (ctx, args) => {
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(20);
    const role = roles.find((row) => row.name === args.roleName);
    if (!role) {
      throw new ConvexError(`Role ${args.roleName} not found`);
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { roleId: role._id });
      return { membershipId: existing._id, roleId: role._id };
    }
    const membershipId = await ctx.db.insert("memberships", {
      organizationId: args.organizationId,
      userId: args.userId,
      roleId: role._id,
    });
    return { membershipId, roleId: role._id };
  },
});

export const createDemoOrg = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return await insertOrganizationWithRoles(ctx, {
      name: args.name,
      siteCodeFormat: "text",
    });
  },
});

/**
 * Platform-only: seed a demo organization with 56 sites/gateways and four role users.
 * Password for all demo users: DemoPassw0rd!
 * Also creates an unactivated account (no membership): pending@demo.icanova.test
 */
export const seedDemoFleet = action({
  args: {
    secret: v.optional(v.string()),
    organizationName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPlatformCaller(ctx, args.secret);
    const orgName = args.organizationName?.trim() || "Demo Power Ghana";
    const boot = (await ctx.runMutation(internal.demoSeed.createDemoOrg, {
      name: orgName,
    })) as { organizationId: Id<"organizations">; adminRoleId: Id<"roles"> };

    const fleet = (await ctx.runMutation(internal.demoSeed.insertFleet, {
      organizationId: boot.organizationId,
      siteCount: SITE_COUNT,
    })) as { sites: number; gateways: number; generators: number };

    const users: Array<{ email: string; username: string; roleName: string }> = [];
    for (const demo of DEMO_USERS) {
      const email = normalizeEmail(demo.email);
      const username = normalizeUsername(demo.username);
      if (!email || !username) {
        continue;
      }
      const created = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: DEMO_PASSWORD },
        profile: { email, username, name: demo.name },
        shouldLinkViaEmail: true,
      });
      const userId = created.user._id as Id<"users">;
      await ctx.runMutation(internal.demoSeed.attachDemoMembership, {
        organizationId: boot.organizationId,
        userId,
        roleName: demo.roleName,
      });
      users.push({ email, username, roleName: demo.roleName });
    }

    const pendingEmail = "pending@demo.icanova.test";
    await createAccount(ctx, {
      provider: "password",
      account: { id: pendingEmail, secret: DEMO_PASSWORD },
      profile: {
        email: pendingEmail,
        username: "demo_pending",
        name: "Pending Activation",
      },
      shouldLinkViaEmail: true,
    });

    return {
      organizationId: boot.organizationId,
      organizationName: orgName,
      ...fleet,
      users,
      unactivated: { email: pendingEmail, username: "demo_pending" },
      password: DEMO_PASSWORD,
    };
  },
});
