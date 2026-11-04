import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { isPrivateOrReservedIp } from "./geoMath";

type IpWhoBody = {
  success?: boolean;
  message?: string;
  latitude?: number;
  longitude?: number;
};

function parseCoords(
  lat: number | undefined,
  lon: number | undefined,
): { lat: number; lon: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  if (lat! < -90 || lat! > 90 || lon! < -180 || lon! > 180) {
    return null;
  }
  return { lat: lat!, lon: lon! };
}

/**
 * Free HTTPS GeoIP with city-level lat/lon (no API key).
 * @see https://ipwhois.io/documentation
 */
async function lookupIpwho(ip: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as IpWhoBody;
  if (body.success === false) {
    return null;
  }
  return parseCoords(body.latitude, body.longitude);
}

/**
 * Resolve GeoIP for a gateway ingress IP and apply move-aware site updates.
 * Scheduled from /ncu/ingest after heartbeat so the 204 path stays fast.
 */
export const resolveAndApply = internalAction({
  args: {
    identity: v.string(),
    clientIp: v.string(),
    ipKey: v.string(),
    organizationId: v.optional(v.id("organizations")),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string; result?: unknown }> => {
    const clientIp = args.clientIp.trim();
    if (!clientIp || isPrivateOrReservedIp(clientIp) || !args.ipKey) {
      return { ok: false, reason: "skip_ip" };
    }

    const gate: { proceed: boolean; reason?: string } = await ctx.runMutation(
      internal.sites.gateIpLookup,
      {
        identity: args.identity,
        ipKey: args.ipKey,
        ...(args.organizationId
          ? { organizationId: args.organizationId as Id<"organizations"> }
          : {}),
      },
    );
    if (!gate.proceed) {
      return { ok: false, reason: gate.reason };
    }

    let fix: { lat: number; lon: number } | null = null;
    try {
      fix = await lookupIpwho(clientIp);
    } catch {
      return { ok: false, reason: "provider_error" };
    }
    if (!fix) {
      return { ok: false, reason: "no_coords" };
    }

    const result: unknown = await ctx.runMutation(internal.sites.considerIpLocation, {
      identity: args.identity,
      latitude: fix.lat,
      longitude: fix.lon,
      ipKey: args.ipKey,
      ...(args.organizationId
        ? { organizationId: args.organizationId as Id<"organizations"> }
        : {}),
    });
    return { ok: true, result };
  },
});
