import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { MAX_PAGE } from "./limits";
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
  const generators = await ctx.db
    .query("generators")
    .withIndex("by_org_site", (q) => q.eq("organizationId", organizationId).eq("siteId", siteId))
    .take(MAX_PAGE + 1);
  const id = await ctx.db.insert("siteSummaries", {
    organizationId,
    siteId,
    generators: generators.length > MAX_PAGE ? null : generators.length,
    reporting: 0,
    linkOk: 0,
    linkFail: 0,
    linkDegraded: 0,
    linkOther: 0,
    lastTelemetryAt: null,
  });
  const created = await ctx.db.get(id);
  if (!created) {
    throw new Error("Not found");
  }
  return { summary: created, created: true as const };
}

/** Call after the generator row is inserted. The count includes that row when the summary is new. */
export async function noteGenerator(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  siteId: Id<"sites">,
) {
  const { summary } = await ensureSummary(ctx, organizationId, siteId);
  const listed = await ctx.db
    .query("generators")
    .withIndex("by_org_site", (q) => q.eq("organizationId", organizationId).eq("siteId", siteId))
    .take(MAX_PAGE + 1);
  await ctx.db.patch(summary._id, {
    generators: listed.length > MAX_PAGE ? null : listed.length,
  });
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
