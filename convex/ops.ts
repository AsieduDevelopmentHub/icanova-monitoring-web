import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAnyPermission } from "./auth";
import { HEALTH_STALE_MS } from "./limits";

/**
 * Operator overview. Uses incremental summaries + bounded samples.
 * Does not scan the full fleet. Does not invent measurements.
 */
export const overview = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, args.organizationId, [
      "view.diagnostics",
      "view.audit",
      "manage.devices",
    ]);
    const now = Date.now();
    const health = await ctx.db
      .query("orgHealthSummaries")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .unique();

    const windowStart = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000);
    const ingestOrg = await ctx.db
      .query("ingestOpWindows")
      .withIndex("by_key_window", (q) =>
        q.eq("key", `org:${args.organizationId}`).eq("windowStart", windowStart),
      )
      .unique();
    const ingestGlobal = await ctx.db
      .query("ingestOpWindows")
      .withIndex("by_key_window", (q) => q.eq("key", "global").eq("windowStart", windowStart))
      .unique();

    const jobs = await ctx.db.query("jobRunState").take(40);
    const staleJobMs = 5 * 60 * 1000;
    const jobRows = jobs.map((job) => ({
      jobName: job.jobName,
      lastAttemptAt: job.lastAttemptAt,
      lastSuccessAt: job.lastSuccessAt,
      lastErrorAt: job.lastErrorAt,
      lastError: job.lastError,
      processed: job.processed,
      failed: job.failed,
      pendingHint: job.pendingHint,
      durationMs: job.durationMs,
      status: job.status,
      stale:
        job.lastAttemptAt < now - staleJobMs &&
        (job.status === "running" || job.pendingHint !== null && job.pendingHint > 0),
    }));

    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_org_created", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(100);
    const notify = {
      sampleSize: recentMessages.length,
      note: "Counts from the newest 100 organization messages. Not a lifetime total.",
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      uncertain: 0,
      notConfigured: 0,
      cancelled: 0,
      emailSent: 0,
      smsSent: 0,
      lastEmailSentAt: null as number | null,
      lastSmsSentAt: null as number | null,
    };
    for (const row of recentMessages) {
      if (row.status === "pending") {
        notify.pending += 1;
      } else if (row.status === "processing") {
        notify.processing += 1;
      } else if (row.status === "sent") {
        notify.sent += 1;
        if (row.channel === "email") {
          notify.emailSent += 1;
          notify.lastEmailSentAt = Math.max(notify.lastEmailSentAt ?? 0, row.createdAt);
        }
        if (row.channel === "sms") {
          notify.smsSent += 1;
          notify.lastSmsSentAt = Math.max(notify.lastSmsSentAt ?? 0, row.createdAt);
        }
      } else if (row.status === "failed") {
        notify.failed += 1;
      } else if (row.status === "uncertain") {
        notify.uncertain += 1;
      } else if (row.status === "not_configured") {
        notify.notConfigured += 1;
      } else if (row.status === "cancelled" || row.status === "suppressed") {
        notify.cancelled += 1;
      }
    }

    const activeAlarms = await ctx.db
      .query("alarms")
      .withIndex("by_org_raised", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(50);
    let activeAlarmCount = 0;
    for (const alarm of activeAlarms) {
      if (alarm.state === "active" || alarm.state === "acknowledged") {
        activeAlarmCount += 1;
      }
    }

    const emptyIngest = {
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
      lastAcceptedAt: null as number | null,
      lastErrorAt: null as number | null,
      lastErrorKind: null as string | null,
    };

    return {
      at: now,
      healthStaleMs: HEALTH_STALE_MS,
      fleet: health
        ? {
            ready: true as const,
            devicesTracked: health.devicesTracked,
            devicesActive: health.devicesActive ?? null,
            devicesInactive: health.devicesInactive ?? null,
            gatewayOnline: health.gatewayOnline,
            gatewayOffline: health.gatewayOffline,
            gatewayUnknown: health.gatewayUnknown,
            modbusOk: health.modbusOk,
            modbusDegraded: health.modbusDegraded,
            modbusFail: health.modbusFail,
            modbusUnknown: health.modbusUnknown,
            telemetryFresh: health.telemetryFresh,
            telemetryStale: health.telemetryStale,
            telemetryMissing: health.telemetryMissing,
            overallHealthy: health.overallHealthy,
            overallDegraded: health.overallDegraded,
            overallUnhealthy: health.overallUnhealthy,
            overallUnknown: health.overallUnknown,
            activeCommProblems: health.activeCommProblems,
            lastGatewayContactAt: health.lastGatewayContactAt,
            lastTelemetryAt: health.lastTelemetryAt,
          }
        : {
            ready: false as const,
            devicesTracked: 0,
            devicesActive: null,
            devicesInactive: null,
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
            lastGatewayContactAt: null,
            lastTelemetryAt: null,
          },
      ingest: {
        windowStart,
        organization: ingestOrg
          ? {
              accepted: ingestOrg.accepted,
              heartbeatOk: ingestOrg.heartbeatOk,
              duplicate: ingestOrg.duplicate,
              unknown: ingestOrg.unknown,
              noGenerator: ingestOrg.noGenerator,
              ambiguous: ingestOrg.ambiguous,
              inactive: ingestOrg.inactive,
              invalid: ingestOrg.invalid,
              rateLimited: ingestOrg.rateLimited,
              authFailed: ingestOrg.authFailed,
              oversized: ingestOrg.oversized,
              error: ingestOrg.error,
              lastAcceptedAt: ingestOrg.lastAcceptedAt,
              lastErrorAt: ingestOrg.lastErrorAt,
              lastErrorKind: ingestOrg.lastErrorKind,
            }
          : emptyIngest,
        global: ingestGlobal
          ? {
              accepted: ingestGlobal.accepted,
              heartbeatOk: ingestGlobal.heartbeatOk,
              duplicate: ingestGlobal.duplicate,
              rateLimited: ingestGlobal.rateLimited,
              authFailed: ingestGlobal.authFailed,
              invalid: ingestGlobal.invalid,
              lastAcceptedAt: ingestGlobal.lastAcceptedAt,
              lastErrorAt: ingestGlobal.lastErrorAt,
              lastErrorKind: ingestGlobal.lastErrorKind,
            }
          : {
              accepted: 0,
              heartbeatOk: 0,
              duplicate: 0,
              rateLimited: 0,
              authFailed: 0,
              invalid: 0,
              lastAcceptedAt: null,
              lastErrorAt: null,
              lastErrorKind: null,
            },
      },
      jobs: jobRows,
      notifications: notify,
      alarms: {
        activeOrAckInRecentPage: activeAlarmCount,
        note: "From newest 50 alarms by raisedAt. Not a full open-alarm index scan.",
      },
      dimensionsNote:
        "Gateway, Modbus, telemetry freshness and engine state are independent. Missing is not zero.",
    };
  },
});
