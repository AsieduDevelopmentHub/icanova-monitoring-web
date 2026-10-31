import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { resolveDeviceByIdentity } from "./deviceIdentity";
import { requireAnyPermission } from "./identity";
import {
  INGEST_OPS_PRUNE_BATCH,
  INGEST_OPS_RETENTION_MS,
  INGEST_OPS_WINDOW_MS,
} from "./limits";
import { recordJobRun } from "./jobStatus";

export type IngestOpKind =
  | "accepted"
  | "heartbeat_ok"
  | "duplicate"
  | "unknown"
  | "no_generator"
  | "ambiguous"
  | "inactive"
  | "invalid"
  | "rate_limited"
  | "auth_failed"
  | "oversized"
  | "error";

const EMPTY = {
  accepted: 0,
  heartbeatOk: 0,
  duplicate: 0,
  unknown: 0,
  noGenerator: 0,
  ambiguous: 0,
  inactive: 0,
  invalid: 0,
  rateLimited: 0,
  authFailed: 0,
  oversized: 0,
  error: 0,
};

function windowStart(at: number): number {
  return Math.floor(at / INGEST_OPS_WINDOW_MS) * INGEST_OPS_WINDOW_MS;
}

function fieldFor(kind: IngestOpKind): keyof typeof EMPTY {
  switch (kind) {
    case "accepted":
      return "accepted";
    case "heartbeat_ok":
      return "heartbeatOk";
    case "duplicate":
      return "duplicate";
    case "unknown":
      return "unknown";
    case "no_generator":
      return "noGenerator";
    case "ambiguous":
      return "ambiguous";
    case "inactive":
      return "inactive";
    case "invalid":
      return "invalid";
    case "rate_limited":
      return "rateLimited";
    case "auth_failed":
      return "authFailed";
    case "oversized":
      return "oversized";
    case "error":
      return "error";
  }
}

function isErrorKind(kind: IngestOpKind): boolean {
  return (
    kind === "invalid" ||
    kind === "rate_limited" ||
    kind === "auth_failed" ||
    kind === "oversized" ||
    kind === "error" ||
    kind === "inactive" ||
    kind === "unknown" ||
    kind === "no_generator" ||
    kind === "ambiguous"
  );
}

async function bumpKey(ctx: MutationCtx, key: string, kind: IngestOpKind, at: number) {
  const start = windowStart(at);
  const existing = await ctx.db
    .query("ingestOpWindows")
    .withIndex("by_key_window", (q) => q.eq("key", key).eq("windowStart", start))
    .unique();
  const field = fieldFor(kind);
  if (!existing) {
    await ctx.db.insert("ingestOpWindows", {
      key,
      windowStart: start,
      ...EMPTY,
      [field]: 1,
      lastAcceptedAt: kind === "accepted" || kind === "heartbeat_ok" ? at : null,
      lastErrorAt: isErrorKind(kind) ? at : null,
      lastErrorKind: isErrorKind(kind) ? kind : null,
      updatedAt: at,
    });
    return;
  }
  await ctx.db.patch(existing._id, {
    [field]: existing[field] + 1,
    lastAcceptedAt:
      kind === "accepted" || kind === "heartbeat_ok" ? at : existing.lastAcceptedAt,
    lastErrorAt: isErrorKind(kind) ? at : existing.lastErrorAt,
    lastErrorKind: isErrorKind(kind) ? kind : existing.lastErrorKind,
    updatedAt: at,
  });
}

/** Record one safe ingest outcome. Never stores secrets or bodies. */
export const record = internalMutation({
  args: {
    kind: v.union(
      v.literal("accepted"),
      v.literal("heartbeat_ok"),
      v.literal("duplicate"),
      v.literal("unknown"),
      v.literal("no_generator"),
      v.literal("ambiguous"),
      v.literal("inactive"),
      v.literal("invalid"),
      v.literal("rate_limited"),
      v.literal("auth_failed"),
      v.literal("oversized"),
      v.literal("error"),
    ),
    organizationId: v.optional(v.union(v.id("organizations"), v.null())),
  },
  handler: async (ctx, args) => {
    const at = Date.now();
    await bumpKey(ctx, "global", args.kind, at);
    if (args.organizationId) {
      await bumpKey(ctx, `org:${args.organizationId}`, args.kind, at);
    }
  },
});

export const pruneOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const started = Date.now();
    const cutoff = started - INGEST_OPS_RETENTION_MS;
    const batch = await ctx.db
      .query("ingestOpWindows")
      .withIndex("by_window", (q) => q.lt("windowStart", cutoff))
      .take(INGEST_OPS_PRUNE_BATCH);
    for (const row of batch) {
      await ctx.db.delete(row._id);
    }
    await recordJobRun(ctx, {
      jobName: "ingestOps.pruneOld",
      processed: batch.length,
      pendingHint: batch.length === INGEST_OPS_PRUNE_BATCH ? INGEST_OPS_PRUNE_BATCH : 0,
      durationMs: Date.now() - started,
      status: batch.length === INGEST_OPS_PRUNE_BATCH ? "partial" : "ok",
    });
    return { deleted: batch.length };
  },
});

export const current = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, [
      "view.diagnostics",
      "view.audit",
      "manage.devices",
    ]);
    const start = windowStart(Date.now());
    const global = await ctx.db
      .query("ingestOpWindows")
      .withIndex("by_key_window", (q) => q.eq("key", "global").eq("windowStart", start))
      .unique();
    const org = await ctx.db
      .query("ingestOpWindows")
      .withIndex("by_key_window", (q) =>
        q.eq("key", `org:${args.organizationId}`).eq("windowStart", start),
      )
      .unique();
    return {
      windowStart: start,
      windowMs: INGEST_OPS_WINDOW_MS,
      global: global ?? { ...EMPTY, lastAcceptedAt: null, lastErrorAt: null, lastErrorKind: null },
      organization: org ?? { ...EMPTY, lastAcceptedAt: null, lastErrorAt: null, lastErrorKind: null },
    };
  },
});

export const resolveOrgIdentity = internalMutation({
  args: { identity: v.string() },
  handler: async (ctx, args): Promise<Id<"organizations"> | null> => {
    const resolved = await resolveDeviceByIdentity(ctx, args.identity);
    if (resolved.status !== "ok") {
      return null;
    }
    return resolved.device.organizationId;
  },
});

export function mapBatchStatus(status: string): IngestOpKind {
  if (status === "accepted") {
    return "accepted";
  }
  if (status === "inactive") {
    return "inactive";
  }
  if (status === "unknown") {
    return "unknown";
  }
  if (status === "no-generator") {
    return "no_generator";
  }
  if (status === "ambiguous") {
    return "ambiguous";
  }
  if (status === "duplicate" || status === "stale") {
    return "duplicate";
  }
  return "duplicate";
}
