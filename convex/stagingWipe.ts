import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";

/**
 * Destructive staging reset only. Requires confirm = "STAGING_WIPE".
 * Clears tenant + auth rows so org/device/user provisioning can start again.
 * Do not run against production.
 */
const TABLES: TableNames[] = [
  "notificationDispatches",
  "userNotifications",
  "pushSubscriptions",
  "notificationPreferences",
  "notificationPolicies",
  "notificationSettings",
  "messages",
  "alarmComments",
  "alarmEvents",
  "alarms",
  "deviceHealthEvents",
  "deviceHealthCurrent",
  "telemetryBuckets",
  "telemetryCurrent",
  "ingestCursors",
  "ingestRateWindows",
  "ingestOpWindows",
  "siteSummaries",
  "orgHealthSummaries",
  "modbusRecords",
  "devicePolls",
  "maintenanceRecords",
  "reports",
  "audits",
  "files",
  "generators",
  "devices",
  "sites",
  "memberships",
  "roles",
  "organizations",
  "retentionState",
  "jobRunState",
  "migrationState",
  "users",
  "authSessions",
  "authAccounts",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
];

const BATCH = 80;

export const clearTenantData = internalMutation({
  args: {
    confirm: v.string(),
    tableIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== "STAGING_WIPE") {
      throw new Error('confirm must be "STAGING_WIPE"');
    }
    let tableIndex = args.tableIndex ?? 0;
    let deleted = 0;
    while (tableIndex < TABLES.length && deleted < BATCH) {
      const table = TABLES[tableIndex]!;
      const rows = await ctx.db.query(table).take(BATCH - deleted);
      if (rows.length === 0) {
        tableIndex += 1;
        continue;
      }
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }
    return {
      done: tableIndex >= TABLES.length,
      tableIndex,
      deleted,
      currentTable: tableIndex < TABLES.length ? TABLES[tableIndex] : null,
    };
  },
});
