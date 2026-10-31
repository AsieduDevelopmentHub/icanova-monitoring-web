import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { deviceIsActive } from "./deviceLifecycle";

export type DeviceIdentityResolution =
  | { status: "unknown" }
  | { status: "inactive"; device: Doc<"devices"> }
  | { status: "ambiguous"; devices: Doc<"devices">[] }
  | { status: "ok"; device: Doc<"devices"> };

const IDENTITY_MATCH_CAP = 16;

/**
 * Resolve a gateway MAC to at most one device row.
 * Prefer active registrations. Optional organizationId disambiguates cross-org clones.
 * Two or more active rows (after filters) remain ambiguous.
 */
export async function resolveDeviceByIdentity(
  ctx: QueryCtx | MutationCtx,
  identity: string,
  opts?: { organizationId?: Id<"organizations"> },
): Promise<DeviceIdentityResolution> {
  if (!/^[0-9a-f]{12}$/.test(identity)) {
    return { status: "unknown" };
  }
  const all = await ctx.db
    .query("devices")
    .withIndex("by_identity", (q) => q.eq("identity", identity))
    .take(IDENTITY_MATCH_CAP);
  if (all.length === 0) {
    return { status: "unknown" };
  }

  let candidates = all;
  if (opts?.organizationId) {
    candidates = all.filter((device) => device.organizationId === opts.organizationId);
    if (candidates.length === 0) {
      return { status: "unknown" };
    }
  }

  const active = candidates.filter((device) => deviceIsActive(device));
  if (active.length === 1) {
    return { status: "ok", device: active[0]! };
  }
  if (active.length > 1) {
    return { status: "ambiguous", devices: active };
  }
  return { status: "inactive", device: candidates[0]! };
}
