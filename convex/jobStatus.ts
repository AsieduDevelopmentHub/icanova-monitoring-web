import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";
import { requireAnyPermission } from "./identity";

const status = v.union(
  v.literal("ok"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("running"),
);

/** Upsert safe operational counters for a scheduled or chained job. */
export async function recordJobRun(
  ctx: MutationCtx,
  args: {
    jobName: string;
    processed?: number;
    failed?: number;
    pendingHint?: number | null;
    durationMs?: number | null;
    status: "ok" | "partial" | "failed" | "running";
    error?: string | null;
  },
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("jobRunState")
    .withIndex("by_job", (q) => q.eq("jobName", args.jobName))
    .unique();
  const safeError =
    args.error && args.error.length > 240 ? `${args.error.slice(0, 240)}…` : (args.error ?? null);
  const patch = {
    jobName: args.jobName,
    lastAttemptAt: now,
    lastSuccessAt:
      args.status === "ok" || args.status === "partial"
        ? now
        : (existing?.lastSuccessAt ?? null),
    lastErrorAt: args.status === "failed" ? now : (existing?.lastErrorAt ?? null),
    lastError: args.status === "failed" ? safeError : args.status === "ok" ? null : (existing?.lastError ?? null),
    processed: args.processed ?? 0,
    failed: args.failed ?? 0,
    pendingHint: args.pendingHint ?? null,
    durationMs: args.durationMs ?? null,
    status: args.status,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }
  return await ctx.db.insert("jobRunState", patch);
}

export const record = internalMutation({
  args: {
    jobName: v.string(),
    processed: v.optional(v.number()),
    failed: v.optional(v.number()),
    pendingHint: v.optional(v.union(v.number(), v.null())),
    durationMs: v.optional(v.union(v.number(), v.null())),
    status,
    error: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await recordJobRun(ctx, args);
  },
});

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, ["view.audit", "manage.devices"]);
    const rows = await ctx.db.query("jobRunState").take(40);
    return rows.map((row) => ({
      jobName: row.jobName,
      lastAttemptAt: row.lastAttemptAt,
      lastSuccessAt: row.lastSuccessAt,
      lastErrorAt: row.lastErrorAt,
      lastError: row.lastError,
      processed: row.processed,
      failed: row.failed,
      pendingHint: row.pendingHint,
      durationMs: row.durationMs,
      status: row.status,
      updatedAt: row.updatedAt,
    }));
  },
});
