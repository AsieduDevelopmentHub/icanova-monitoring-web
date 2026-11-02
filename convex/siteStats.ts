import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./identity";
import { GHANA_REGIONS } from "./regions";

const STATS_PAGE = 500;

/**
 * Org Command Center aggregates: region-wise updating vs non-updating sites,
 * plus overall site-count rings (total / updating / non-updating / fresh / accumulated).
 */
export const commandOverview = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    try {
      await requirePermission(ctx, args.organizationId, "view.dashboard");
    } catch {
      return {
        regions: GHANA_REGIONS.map((region) => ({ region, updating: 0, nonUpdating: 0 })),
        siteCounts: {
          total: 0,
          updating: 0,
          nonUpdating: 0,
          currentData: 0,
          accumulatedData: 0,
        },
      };
    }
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(STATS_PAGE);
    const devices = await ctx.db
      .query("devices")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(STATS_PAGE);
    const healthRows = await ctx.db
      .query("deviceHealthCurrent")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .take(STATS_PAGE);

    const healthByDevice = new Map(
      healthRows.map((row) => [String(row.deviceId), row] as const),
    );
    const devicesBySite = new Map<string, typeof devices>();
    for (const device of devices) {
      if (!device.siteId) {
        continue;
      }
      const key = String(device.siteId);
      const bucket = devicesBySite.get(key) ?? [];
      bucket.push(device);
      devicesBySite.set(key, bucket);
    }

    type RegionBucket = { region: string; updating: number; nonUpdating: number };
    const byRegion = new Map<string, RegionBucket>();
    for (const region of GHANA_REGIONS) {
      byRegion.set(region, { region, updating: 0, nonUpdating: 0 });
    }

    let updating = 0;
    let nonUpdating = 0;
    let currentData = 0;
    let accumulatedData = 0;

    for (const site of sites) {
      const region = site.region?.trim() || "Unassigned";
      if (!byRegion.has(region)) {
        byRegion.set(region, { region, updating: 0, nonUpdating: 0 });
      }
      const siteDevices = devicesBySite.get(String(site._id)) ?? [];
      let siteUpdating = false;
      let siteFresh = false;
      for (const device of siteDevices) {
        const health = healthByDevice.get(String(device._id));
        if (health?.gatewayStatus === "online") {
          siteUpdating = true;
        }
        if (health?.telemetryFreshness === "fresh") {
          siteFresh = true;
        }
      }
      if (siteDevices.length === 0) {
        nonUpdating += 1;
        byRegion.get(region)!.nonUpdating += 1;
        continue;
      }
      if (siteUpdating) {
        updating += 1;
        byRegion.get(region)!.updating += 1;
      } else {
        nonUpdating += 1;
        byRegion.get(region)!.nonUpdating += 1;
      }
      if (siteFresh) {
        currentData += 1;
      } else if (siteUpdating) {
        accumulatedData += 1;
      }
    }

    const regions = [
      ...GHANA_REGIONS.map((region) => byRegion.get(region)!),
      ...[...byRegion.values()].filter(
        (row) => !(GHANA_REGIONS as readonly string[]).includes(row.region),
      ),
    ];

    return {
      regions,
      siteCounts: {
        total: sites.length,
        updating,
        nonUpdating,
        currentData,
        accumulatedData,
      },
    };
  },
});
