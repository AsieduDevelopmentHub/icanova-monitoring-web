/**
 * Additive, bounded migrations. Never auto-run destructive work.
 * Pattern: optional fields → compatible readers/writers → optional backfill → verify.
 */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePermission } from "./auth";
import { lifecycleLabel } from "./deviceLifecycle";

const BATCH = 40;

export const LIFECYCLE_BACKFILL = "device.lifecycle.active_default";

async function loadState(ctx: MutationCtx | QueryCtx, name: string) {
  return await ctx.db
    .query("migrationState")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
}

/**
 * Backfill missing device.lifecycle to "active".
 * dryRun=true counts only. Does not run automatically from crons.
 */
export const backfillDeviceLifecycle = internalMutation({
  args: {
    dryRun: v.boolean(),
    cursor: v.optional(v.union(v.string(), v.null())),
    processed: v.optional(v.number()),
    updated: v.optional(v.number()),
    skipped: v.optional(v.number()),
    errors: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun;
    let processed = args.processed ?? 0;
    let updated = args.updated ?? 0;
    let skipped = args.skipped ?? 0;
    let errors = args.errors ?? 0;
    const page = await ctx.db.query("devices").paginate({
      numItems: BATCH,
      cursor: args.cursor ?? null,
    });
    for (const device of page.page) {
      processed += 1;
      try {
        if (device.lifecycle === "active" || device.lifecycle === "inactive") {
          skipped += 1;
          continue;
        }
        if (!dryRun) {
          await ctx.db.patch(device._id, {
            lifecycle: "active",
            lifecycleChangedAt: device.lifecycleChangedAt ?? Date.now(),
          });
        }
        updated += 1;
      } catch {
        errors += 1;
      }
    }
    const status = page.isDone ? ("completed" as const) : ("running" as const);
    const existing = await loadState(ctx, LIFECYCLE_BACKFILL);
    const row = {
      name: LIFECYCLE_BACKFILL,
      cursor: page.isDone ? null : page.continueCursor,
      processed,
      updated,
      skipped,
      errors,
      dryRun,
      status,
      lastError: null as string | null,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("migrationState", row);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillDeviceLifecycle, {
        dryRun,
        cursor: page.continueCursor,
        processed,
        updated,
        skipped,
        errors,
      });
    }
    return row;
  },
});

/** Operator-triggered. Default dryRun=true so no silent writes. */
export const startLifecycleBackfill = mutation({
  args: {
    organizationId: v.id("organizations"),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    const dryRun = args.dryRun !== false;
    await ctx.scheduler.runAfter(0, internal.migrations.backfillDeviceLifecycle, {
      dryRun,
      cursor: null,
    });
    return { started: true, dryRun, name: LIFECYCLE_BACKFILL };
  },
});

export const getMigration = query({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.devices");
    return await loadState(ctx, args.name);
  },
});

/** Pure helper for tests: missing lifecycle reads as active. */
export function existingDeviceRemainsActive(lifecycle: string | undefined) {
  return lifecycleLabel({ lifecycle: lifecycle as "active" | "inactive" | undefined }) === "active";
}
