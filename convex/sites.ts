import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import {
  decideIpLocation,
  IP_LOOKUP_DEBOUNCE_MS,
  type LocationSource,
} from "./geoMath";
import { isGatewayIdentity, normalizeGatewayIdentity } from "./gatewayIdentity";
import { assertSameOrg, requireName, requirePermission } from "./identity";
import { boundedPage, MAX_PAGE } from "./limits";
import { emitDeviceRegistered } from "./notifyEmit";
import {
  codeFromName,
  normalizeSiteCodeFormat,
  requireSiteCode,
} from "./siteCodes";

const locationSourceValidator = v.union(
  v.literal("manual"),
  v.literal("browser"),
  v.literal("ip"),
);

function clearPendingFields() {
  return {
    locationPendingLat: undefined,
    locationPendingLon: undefined,
    locationPendingCount: undefined,
    locationPendingIpKey: undefined,
    locationPendingAt: undefined,
  };
}

export async function requireSite(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const site = await ctx.db.get(siteId);
  if (!site) {
    throw new Error("Forbidden");
  }
  assertSameOrg(site.organizationId, organizationId);
  return site;
}

function requireCoordinate(value: number, kind: "latitude" | "longitude"): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${kind} must be a finite number`);
  }
  if (kind === "latitude" && (value < -90 || value > 90)) {
    throw new Error("latitude must be between -90 and 90");
  }
  if (kind === "longitude" && (value < -180 || value > 180)) {
    throw new Error("longitude must be between -180 and 180");
  }
  return value;
}

function requireSiteInfoText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ConvexError(`${label} must be ${maxLength} characters or fewer`);
  }
  return normalized;
}

function requireSiteDate(value: number | null, label: string, now: number): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0 || value > now) {
    throw new ConvexError(`${label} must be a valid date and time in the past`);
  }
  return value;
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    return await ctx.db
      .query("sites")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .paginate(boundedPage(args.paginationOpts));
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const site = await ctx.db.get(args.siteId);
    if (!site || site.organizationId !== args.organizationId) {
      return null;
    }
    let assignedOperatorName: string | null = null;
    const assignedOperatorUserId = site.assignedOperatorUserId;
    if (assignedOperatorUserId) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", args.organizationId).eq("userId", assignedOperatorUserId),
        )
        .unique();
      if (membership) {
        const user = await ctx.db.get(assignedOperatorUserId);
        assignedOperatorName = user?.name ?? user?.username ?? null;
      }
    }
    return {
      siteId: site._id,
      name: site.name,
      code: site.code ?? null,
      region: site.region ?? null,
      siteInfo: site.siteInfo ?? {
        zone: "",
        cluster: "",
        address: "",
        siteType: "",
        category: "",
        energyClassification: "",
        coolingClassification: "",
        geoClassification: "",
        siteClassification: "",
        simDetails: "",
        customerSiteId: "",
        fieldEngineer: "",
        engineerContact: "",
        communicationMode: "",
        installationAt: null,
      },
      assignedOperatorUserId: site.assignedOperatorUserId ?? null,
      assignedOperatorName,
      assignedOperatorNote: site.assignedOperatorNote ?? null,
      onAirSince: site.onAirSince ?? null,
      latitude: site.latitude ?? null,
      longitude: site.longitude ?? null,
      locationUpdatedAt: site.locationUpdatedAt ?? null,
      locationSource: site.locationSource ?? null,
    };
  },
});

export const operatorOptions = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    const rows = [];
    for (const membership of memberships) {
      const role = await ctx.db.get(membership.roleId);
      if (!role || role.organizationId !== args.organizationId || role.name !== "Operator") {
        continue;
      }
      const user = await ctx.db.get(membership.userId);
      if (!user) {
        continue;
      }
      rows.push({
        userId: user._id,
        name: user.name ?? user.username ?? user.email ?? "Operator",
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const byCode = query({
  args: {
    organizationId: v.id("organizations"),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "view.dashboard");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    const code = requireSiteCode(args.code, normalizeSiteCodeFormat(org.siteCodeFormat));
    const site = await ctx.db
      .query("sites")
      .withIndex("by_org_code", (q) =>
        q.eq("organizationId", args.organizationId).eq("code", code),
      )
      .unique();
    if (!site) {
      return null;
    }
    return {
      siteId: site._id,
      name: site.name,
      code: site.code ?? code,
      latitude: site.latitude ?? null,
      longitude: site.longitude ?? null,
    };
  },
});

/**
 * Legacy bare create — still permission-gated.
 * Prefer `provision` so a gateway is assigned in the same workflow.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    const format = normalizeSiteCodeFormat(org.siteCodeFormat);
    const name = requireName(args.name, "Site name");
    const code = requireSiteCode(
      args.code?.trim() || codeFromName(name, format, Date.now() % 100000),
      format,
    );
    const clash = await ctx.db
      .query("sites")
      .withIndex("by_org_code", (q) =>
        q.eq("organizationId", args.organizationId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new ConvexError("Site code already in use");
    }
    const siteId = await ctx.db.insert("sites", {
      organizationId: args.organizationId,
      name,
      code,
      generatorCount: 0,
    });
    await writeAudit(ctx, args.organizationId, "site.create", siteId);
    return siteId;
  },
});

/**
 * Atomic site + gateway provision (hybrid 2C).
 * Assign an unassigned device or register a new gateway identity.
 */
export const provision = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    code: v.string(),
    region: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    deviceId: v.optional(v.id("devices")),
    gatewayName: v.optional(v.string()),
    gatewayIdentity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    await requirePermission(ctx, args.organizationId, "manage.devices");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    const format = normalizeSiteCodeFormat(org.siteCodeFormat);
    const name = requireName(args.name, "Site name");
    const code = requireSiteCode(args.code, format);
    const clash = await ctx.db
      .query("sites")
      .withIndex("by_org_code", (q) =>
        q.eq("organizationId", args.organizationId).eq("code", code),
      )
      .unique();
    if (clash) {
      throw new ConvexError("Site code already in use");
    }

    let deviceId = args.deviceId ?? null;
    let gatewayNameForEmit = "";
    let createdNew = false;
    if (deviceId) {
      const device = await ctx.db.get(deviceId);
      if (!device || device.organizationId !== args.organizationId) {
        throw new ConvexError("Gateway not found in this organization");
      }
      if (device.siteId) {
        throw new ConvexError("Gateway is already assigned to a site");
      }
      gatewayNameForEmit = device.name;
    } else {
      const gatewayName = requireName(args.gatewayName ?? "", "Gateway name");
      const identity = normalizeGatewayIdentity(args.gatewayIdentity ?? "");
      if (!isGatewayIdentity(identity)) {
        throw new ConvexError("Invalid gateway identity");
      }
      gatewayNameForEmit = gatewayName;
      const existing = await ctx.db
        .query("devices")
        .withIndex("by_org_identity", (q) =>
          q.eq("organizationId", args.organizationId).eq("identity", identity),
        )
        .unique();
      if (existing) {
        if (existing.siteId) {
          throw new ConvexError("Gateway identity is already assigned");
        }
        deviceId = existing._id;
        if (existing.name !== gatewayName) {
          await ctx.db.patch(existing._id, { name: gatewayName });
        }
      } else {
        deviceId = await ctx.db.insert("devices", {
          organizationId: args.organizationId,
          name: gatewayName,
          identity,
          lifecycle: "active",
          lifecycleChangedAt: Date.now(),
        });
        createdNew = true;
      }
    }

    const siteFields: {
      organizationId: Id<"organizations">;
      name: string;
      code: string;
      generatorCount: number;
      region?: string;
      latitude?: number;
      longitude?: number;
      locationUpdatedAt?: number;
      locationSource?: LocationSource;
    } = {
      organizationId: args.organizationId,
      name,
      code,
      generatorCount: 0,
    };
    if (args.region?.trim()) {
      siteFields.region = args.region.trim();
    }
    if (args.latitude !== undefined && args.longitude !== undefined) {
      siteFields.latitude = requireCoordinate(args.latitude, "latitude");
      siteFields.longitude = requireCoordinate(args.longitude, "longitude");
      siteFields.locationUpdatedAt = Date.now();
      siteFields.locationSource = "manual";
    }
    const siteId = await ctx.db.insert("sites", siteFields);
    await ctx.db.patch(deviceId, { siteId });
    if (createdNew) {
      await emitDeviceRegistered(ctx, {
        organizationId: args.organizationId,
        siteId,
        deviceId,
        deviceName: gatewayNameForEmit,
      });
    }
    await writeAudit(ctx, args.organizationId, "site.provision", siteId);
    return {
      siteId,
      code,
      name,
      deviceId,
    };
  },
});

/** Backfill missing site codes for an organization. */
export const backfillCodes = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const org = await ctx.db.get(args.organizationId);
    if (!org) {
      throw new Error("Forbidden");
    }
    const format = normalizeSiteCodeFormat(org.siteCodeFormat);
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(MAX_PAGE);
    let updated = 0;
    let index = 1;
    for (const site of sites) {
      if (site.code) {
        index += 1;
        continue;
      }
      let candidate = codeFromName(site.name, format, index);
      let suffix = 0;
      while (true) {
        const tryCode = suffix === 0 ? candidate : `${candidate}-${suffix}`.slice(0, 32);
        const clash = await ctx.db
          .query("sites")
          .withIndex("by_org_code", (q) =>
            q.eq("organizationId", args.organizationId).eq("code", tryCode),
          )
          .unique();
        if (!clash) {
          await ctx.db.patch(site._id, { code: tryCode });
          updated += 1;
          break;
        }
        suffix += 1;
      }
      index += 1;
    }
    return { updated };
  },
});

/** Rename site metadata only. */
export const rename = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const site = await requireSite(ctx, args.organizationId, args.siteId);
    const name = requireName(args.name, "Site name");
    if (site.name === name) {
      return { siteId: site._id, changed: false as const };
    }
    await ctx.db.patch(site._id, { name });
    await writeAudit(ctx, args.organizationId, "site.rename", site._id);
    return { siteId: site._id, changed: true as const };
  },
});

export const updateInfo = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    name: v.string(),
    code: v.string(),
    region: v.string(),
    latitude: v.union(v.number(), v.null()),
    longitude: v.union(v.number(), v.null()),
    details: v.object({
      zone: v.string(),
      cluster: v.string(),
      address: v.string(),
      siteType: v.string(),
      category: v.string(),
      energyClassification: v.string(),
      coolingClassification: v.string(),
      geoClassification: v.string(),
      siteClassification: v.string(),
      simDetails: v.string(),
      customerSiteId: v.string(),
      fieldEngineer: v.string(),
      engineerContact: v.string(),
      communicationMode: v.string(),
      installationAt: v.union(v.number(), v.null()),
    }),
    assignedOperatorUserId: v.union(v.id("users"), v.null()),
    assignedOperatorNote: v.string(),
    onAirSince: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const site = await requireSite(ctx, args.organizationId, args.siteId);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) {
      throw new ConvexError("Forbidden");
    }
    const name = requireName(args.name, "Site name");
    const code = requireSiteCode(args.code, normalizeSiteCodeFormat(organization.siteCodeFormat));
    const clash = await ctx.db
      .query("sites")
      .withIndex("by_org_code", (q) =>
        q.eq("organizationId", args.organizationId).eq("code", code),
      )
      .unique();
    if (clash && clash._id !== site._id) {
      throw new ConvexError("Site code already in use");
    }
    if ((args.latitude === null) !== (args.longitude === null)) {
      throw new ConvexError("Enter both latitude and longitude, or clear both");
    }
    const latitude = args.latitude === null ? null : requireCoordinate(args.latitude, "latitude");
    const longitude = args.longitude === null ? null : requireCoordinate(args.longitude, "longitude");
    const now = Date.now();
    const installationAt = requireSiteDate(args.details.installationAt, "Installation date", now);
    const onAirSince = requireSiteDate(args.onAirSince, "Time on air", now);

    if (args.assignedOperatorUserId !== null) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", args.organizationId).eq("userId", args.assignedOperatorUserId!),
        )
        .unique();
      const role = membership ? await ctx.db.get(membership.roleId) : null;
      if (!membership || !role || role.organizationId !== args.organizationId || role.name !== "Operator") {
        throw new ConvexError("Choose an Operator who belongs to this organization");
      }
    }

    const details = {
      zone: requireSiteInfoText(args.details.zone, "Zone", 100),
      cluster: requireSiteInfoText(args.details.cluster, "Cluster", 100),
      address: requireSiteInfoText(args.details.address, "Site address", 500),
      siteType: requireSiteInfoText(args.details.siteType, "Site type", 100),
      category: requireSiteInfoText(args.details.category, "Category", 100),
      energyClassification: requireSiteInfoText(args.details.energyClassification, "Energy classification", 160),
      coolingClassification: requireSiteInfoText(args.details.coolingClassification, "Cooling classification", 160),
      geoClassification: requireSiteInfoText(args.details.geoClassification, "Geo classification", 160),
      siteClassification: requireSiteInfoText(args.details.siteClassification, "Site classification", 160),
      simDetails: requireSiteInfoText(args.details.simDetails, "SIM details", 500),
      customerSiteId: requireSiteInfoText(args.details.customerSiteId, "Customer site ID", 120),
      fieldEngineer: requireSiteInfoText(args.details.fieldEngineer, "Field engineer", 160),
      engineerContact: requireSiteInfoText(args.details.engineerContact, "Engineer contact", 120),
      communicationMode: requireSiteInfoText(args.details.communicationMode, "Communication mode", 100),
      installationAt,
    };
    const region = requireSiteInfoText(args.region, "Region", 120);
    const assignedOperatorNote = requireSiteInfoText(args.assignedOperatorNote, "Operator note", 500);
    const locationChanged = site.latitude !== latitude || site.longitude !== longitude;
    await ctx.db.patch(site._id, {
      name,
      code,
      region: region || undefined,
      siteInfo: details,
      assignedOperatorUserId: args.assignedOperatorUserId ?? undefined,
      assignedOperatorNote: assignedOperatorNote || undefined,
      onAirSince: onAirSince ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      ...(locationChanged
        ? latitude !== null && longitude !== null
          ? {
              locationUpdatedAt: now,
              locationSource: "manual" as const,
              ...clearPendingFields(),
            }
          : {
              locationUpdatedAt: undefined,
              locationSource: undefined,
              ...clearPendingFields(),
            }
        : {}),
    });
    await writeAudit(ctx, args.organizationId, "site.info.update", site._id);
    return { siteId: site._id, changed: true as const };
  },
});

/** Set WGS84 coordinates for a site (cloud source of truth for maps). */
export const setLocation = mutation({
  args: {
    organizationId: v.id("organizations"),
    siteId: v.id("sites"),
    latitude: v.number(),
    longitude: v.number(),
    source: v.optional(locationSourceValidator),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.sites");
    const site = await requireSite(ctx, args.organizationId, args.siteId);
    const latitude = requireCoordinate(args.latitude, "latitude");
    const longitude = requireCoordinate(args.longitude, "longitude");
    const source: LocationSource =
      args.source === "browser" || args.source === "ip" ? args.source : "manual";
    await ctx.db.patch(site._id, {
      latitude,
      longitude,
      locationUpdatedAt: Date.now(),
      locationSource: source,
      ...clearPendingFields(),
    });
    await writeAudit(ctx, args.organizationId, "site.location", site._id);
    return { siteId: site._id, latitude, longitude, locationSource: source };
  },
});

/** Device Soft-AP sync: resolve enrolled device → its site, then set location. */
export const setLocationForIdentity = internalMutation({
  args: {
    identity: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    organizationId: v.optional(v.id("organizations")),
    source: v.optional(locationSourceValidator),
  },
  handler: async (ctx, args) => {
    const identity = normalizeGatewayIdentity(args.identity);
    if (!isGatewayIdentity(identity)) {
      return { status: "invalid" as const };
    }
    const latitude = requireCoordinate(args.latitude, "latitude");
    const longitude = requireCoordinate(args.longitude, "longitude");
    const source: LocationSource =
      args.source === "browser" || args.source === "ip" ? args.source : "manual";
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", identity))
      .take(5);
    const scoped = args.organizationId
      ? matches.filter((device) => device.organizationId === args.organizationId)
      : matches;
    if (scoped.length === 0) {
      return { status: "unknown" as const };
    }
    if (scoped.length > 1) {
      return { status: "ambiguous" as const };
    }
    const device = scoped[0];
    if (device.lifecycle === "inactive") {
      return { status: "inactive" as const };
    }
    if (!device.siteId) {
      return { status: "unassigned" as const };
    }
    const site = await ctx.db.get(device.siteId);
    if (!site || site.organizationId !== device.organizationId) {
      return { status: "unknown" as const };
    }
    await ctx.db.patch(site._id, {
      latitude,
      longitude,
      locationUpdatedAt: Date.now(),
      locationSource: source,
      ...clearPendingFields(),
    });
    return {
      status: "ok" as const,
      siteId: site._id,
      organizationId: device.organizationId,
    };
  },
});

/**
 * Decide whether an IP GeoIP lookup should run for this device/site.
 * Updates lastIngressIpKey on health when a device health row exists.
 */
export const gateIpLookup = internalMutation({
  args: {
    identity: v.string(),
    ipKey: v.string(),
    organizationId: v.optional(v.id("organizations")),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = normalizeGatewayIdentity(args.identity);
    if (!isGatewayIdentity(identity) || !args.ipKey) {
      return { proceed: false as const, reason: "invalid" as const };
    }
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", identity))
      .take(5);
    const scoped = args.organizationId
      ? matches.filter((device) => device.organizationId === args.organizationId)
      : matches;
    if (scoped.length !== 1) {
      return { proceed: false as const, reason: "unresolved" as const };
    }
    const device = scoped[0];
    if (device.lifecycle === "inactive" || !device.siteId) {
      return { proceed: false as const, reason: "unavailable" as const };
    }
    const site = await ctx.db.get(device.siteId);
    if (!site || site.organizationId !== device.organizationId) {
      return { proceed: false as const, reason: "unknown" as const };
    }

    const now = args.now ?? Date.now();
    const health = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    if (health) {
      await ctx.db.patch(health._id, {
        lastIngressIpKey: args.ipKey,
        lastGeoAt: now,
      });
    }

    const pendingOpen = (site.locationPendingCount ?? 0) > 0;
    const sameIp = site.locationIpKey === args.ipKey;
    const checkedAt = site.locationIpCheckedAt ?? 0;
    if (!pendingOpen && sameIp && now - checkedAt < IP_LOOKUP_DEBOUNCE_MS) {
      return {
        proceed: false as const,
        reason: "debounced" as const,
        siteId: site._id,
        deviceId: device._id,
        organizationId: device.organizationId,
      };
    }

    return {
      proceed: true as const,
      siteId: site._id,
      deviceId: device._id,
      organizationId: device.organizationId,
    };
  },
});

/** Apply an IP-derived WGS84 fix with move-aware hysteresis. */
export const considerIpLocation = internalMutation({
  args: {
    identity: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    ipKey: v.string(),
    organizationId: v.optional(v.id("organizations")),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = normalizeGatewayIdentity(args.identity);
    if (!isGatewayIdentity(identity) || !args.ipKey) {
      return { status: "invalid" as const };
    }
    const latitude = requireCoordinate(args.latitude, "latitude");
    const longitude = requireCoordinate(args.longitude, "longitude");
    const matches = await ctx.db
      .query("devices")
      .withIndex("by_identity", (q) => q.eq("identity", identity))
      .take(5);
    const scoped = args.organizationId
      ? matches.filter((device) => device.organizationId === args.organizationId)
      : matches;
    if (scoped.length === 0) {
      return { status: "unknown" as const };
    }
    if (scoped.length > 1) {
      return { status: "ambiguous" as const };
    }
    const device = scoped[0];
    if (device.lifecycle === "inactive") {
      return { status: "inactive" as const };
    }
    if (!device.siteId) {
      return { status: "unassigned" as const };
    }
    const site = await ctx.db.get(device.siteId);
    if (!site || site.organizationId !== device.organizationId) {
      return { status: "unknown" as const };
    }

    const now = args.now ?? Date.now();
    const decision = decideIpLocation({
      currentLat: site.latitude,
      currentLon: site.longitude,
      source: site.locationSource,
      pendingLat: site.locationPendingLat,
      pendingLon: site.locationPendingLon,
      pendingCount: site.locationPendingCount,
      pendingIpKey: site.locationPendingIpKey,
      fixLat: latitude,
      fixLon: longitude,
      ipKey: args.ipKey,
    });

    if (decision.action === "ignore") {
      await ctx.db.patch(site._id, {
        locationIpKey: args.ipKey,
        locationIpCheckedAt: now,
      });
      return { status: "ignored" as const, reason: decision.reason };
    }

    if (decision.action === "pending") {
      await ctx.db.patch(site._id, {
        locationIpKey: args.ipKey,
        locationIpCheckedAt: now,
        locationPendingLat: decision.lat,
        locationPendingLon: decision.lon,
        locationPendingCount: decision.count,
        locationPendingIpKey: decision.ipKey,
        locationPendingAt: now,
      });
      return {
        status: "pending" as const,
        count: decision.count,
        siteId: site._id,
      };
    }

    await ctx.db.patch(site._id, {
      latitude,
      longitude,
      locationUpdatedAt: now,
      locationSource: "ip",
      locationIpKey: args.ipKey,
      locationIpCheckedAt: now,
      ...(decision.clearPending ? clearPendingFields() : {}),
    });
    return {
      status: "applied" as const,
      siteId: site._id,
      organizationId: device.organizationId,
    };
  },
});
