import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { shiftLink } from "./rollup";

async function ensureSummary(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const existing = await ctx.db
    .query("siteSummaries")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .unique();
  if (existing) {
    if (existing.organizationId !== organizationId) {
      throw new Error("Forbidden");
    }
    return { summary: existing, created: false as const };
  }
  const site = await ctx.db.get(siteId);
  if (!site || site.organizationId !== organizationId) {
    throw new Error("Forbidden");
  }
  const id = await ctx.db.insert("siteSummaries", {
    organizationId,
    siteId,
    generators: typeof site.generatorCount === "number" ? site.generatorCount : null,
    reporting: 0,
    linkOk: 0,
    linkFail: 0,
    linkDegraded: 0,
    linkOther: 0,
    lastTelemetryAt: null,
    gatewayOnline: 0,
    gatewayOffline: 0,
    gatewayUnknown: 0,
    modbusOk: 0,
    modbusDegraded: 0,
    modbusFail: 0,
    modbusUnknown: 0,
    telemetryFresh: 0,
    telemetryStale: 0,
    telemetryMissing: 0,
    overallHealthy: 0,
    overallDegraded: 0,
    overallUnhealthy: 0,
    overallUnknown: 0,
    activeCommProblems: 0,
    devicesTracked: 0,
    lastGatewayContactAt: null,
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Not found");
  }
  return { summary: created, created: true as const };
}

/**
 * Call after the generator row is inserted.
 * Returns "recount" when this site has no stored count yet. The caller schedules
 * one paged recount. A stored count increments by one and is not scanned.
 */
export async function noteGenerator(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
): Promise<"recount" | "counted"> {
  const site = await ctx.db.get(siteId);
  if (!site || site.organizationId !== organizationId) {
    throw new Error("Forbidden");
  }
  if (typeof site.generatorCount !== "number") {
    if (!site.recounting) {
      await ctx.db.patch(site._id, { recounting: true });
      return "recount";
    }
    return "counted";
  }
  const next = site.generatorCount + 1;
  await ctx.db.patch(site._id, { generatorCount: next });
  const { summary } = await ensureSummary(ctx, organizationId, siteId);
  await ctx.db.patch(summary._id, { generators: next });
  return "counted";
}

export async function noteSample(
  ctx: MutationCtx,
  args: {
    organizationId: Id<"organizations">;
    siteId: Id<"sites">;
    previousLink: string | null;
    link: string | null;
    hadCurrent: boolean;
    at: number;
  },
) {
  const { summary, created } = await ensureSummary(ctx, args.organizationId, args.siteId);
  const links = shiftLink(
    {
      ok: summary.linkOk,
      fail: summary.linkFail,
      degraded: summary.linkDegraded,
      other: summary.linkOther,
    },
    args.hadCurrent ? args.previousLink : null,
    args.link,
    args.hadCurrent,
  );
  await ctx.db.patch(summary._id, {
    reporting: summary.reporting + (args.hadCurrent && !created ? 0 : 1),
    linkOk: links.ok,
    linkFail: links.fail,
    linkDegraded: links.degraded,
    linkOther: links.other,
    lastTelemetryAt: args.at,
  });
}
