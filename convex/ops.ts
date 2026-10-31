import { v } from "convex/values";
import { query } from "./_generated/server";
import { memberPermissions, roleHasPermission } from "./identity";
import { HEALTH_STALE_MS } from "./limits";
import type { Permission } from "./permissions";

/**
 * Section permissions for /admin/ops. manage.devices alone does not unlock this overview.
 * Hiding a nav item is not authorization — each section is gated independently.
 */
export const OPS_SECTION_PERMISSIONS = [
  "view.diagnostics",
  "view.audit",
  "view.alarms",
  "configure.notifications",
] as const satisfies readonly Permission[];

/**
 * Operator overview. Uses incremental summaries + bounded samples.
 * Does not scan the full fleet. Does not invent measurements.
 * Sections are null when the caller lacks the matching permission.
 */
export const overview = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const permissions = await memberPermissions(ctx, args.organizationId);
    if (!permissions) {
      throw new Error("Forbidden");
    }
    const canEnter = OPS_SECTION_PERMISSIONS.some((need) => roleHasPermission(permissions, need));
    if (!canEnter) {
      throw new Error("Forbidden");
    }

    const canDiagnostics = roleHasPermission(permissions, "view.diagnostics");
    const canAudit = roleHasPermission(permissions, "view.audit");
    const canAlarms = roleHasPermission(permissions, "view.alarms");
    const canNotify = roleHasPermission(permissions, "configure.notifications");

    const now = Date.now();
    const denied = (need: Permission) => ({
      denied: true as const,
      required: need,
      note: "Section withheld. Matching permission required on the role.",
    });

    let fleet = null as
      | ReturnType<typeof buildFleet>
      | ReturnType<typeof emptyFleet>
      | ReturnType<typeof denied>
      | null;
    let ingest = null as object | ReturnType<typeof denied> | null;
    let jobs = null as object[] | ReturnType<typeof denied> | null;

    if (canDiagnostics) {
      const health = await ctx.db
        .query("orgHealthSummaries")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .unique();
      fleet = health ? buildFleet(health) : emptyFleet();

      const windowStart = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000);
      const ingestOrg = await ctx.db
        .query("ingestOpWindows")
        .withIndex("by_key_window", (q) =>
          q.eq("key", `org:${args.organizationId}`).eq("windowStart", windowStart),
        )
        .unique();
      const ingestGlobal = await ctx.db
        .query("ingestOpWindows")
        .withIndex("by_key_window", (q) =>
          q.eq("key", "global").eq("windowStart", windowStart),
        )
        .unique();
      ingest = {
        windowStart,
        organization: ingestOrg ? mapIngestOrg(ingestOrg) : emptyIngest(),
        global: ingestGlobal ? mapIngestGlobal(ingestGlobal) : emptyIngestGlobal(),
      };

      const jobDocs = await ctx.db.query("jobRunState").take(40);
      const staleJobMs = 5 * 60 * 1000;
      jobs = jobDocs.map((job) => ({
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
          (job.status === "running" || (job.pendingHint !== null && job.pendingHint > 0)),
      }));
    } else {
      fleet = denied("view.diagnostics");
      ingest = denied("view.diagnostics");
      jobs = denied("view.diagnostics");
    }

    let notifications = null as object | ReturnType<typeof denied> | null;
    if (canNotify) {
      const recentMessages = await ctx.db
        .query("messages")
        .withIndex("by_org_created", (q) => q.eq("organizationId", args.organizationId))
        .order("desc")
        .take(100);
      notifications = summarizeNotify(recentMessages);
    } else {
      notifications = denied("configure.notifications");
    }

    let alarms = null as object | ReturnType<typeof denied> | null;
    if (canAlarms) {
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
      alarms = {
        activeOrAckInRecentPage: activeAlarmCount,
        note: "From newest 50 alarms by raisedAt. Not a full open-alarm index scan.",
      };
    } else {
      alarms = denied("view.alarms");
    }

    let audit = null as object | ReturnType<typeof denied> | null;
    if (canAudit) {
      const rows = await ctx.db
        .query("audits")
        .withIndex("by_org_time", (q) => q.eq("organizationId", args.organizationId))
        .order("desc")
        .take(20);
      audit = {
        sampleSize: rows.length,
        note: "Newest 20 audit rows. Full history uses audits.list.",
        rows: rows.map((row) => ({
          action: row.action,
          target: row.target,
          at: row.at,
        })),
      };
    } else {
      audit = denied("view.audit");
    }

    return {
      at: now,
      healthStaleMs: HEALTH_STALE_MS,
      sections: {
        diagnostics: canDiagnostics,
        audit: canAudit,
        alarms: canAlarms,
        notifications: canNotify,
      },
      fleet,
      ingest,
      jobs,
      notifications,
      alarms,
      audit,
      dimensionsNote:
        "Gateway, Modbus, telemetry freshness and engine state are independent. Missing is not zero.",
    };
  },
});

function buildFleet(health: {
  devicesTracked: number;
  devicesActive?: number;
  devicesInactive?: number;
  gatewayOnline: number;
  gatewayOffline: number;
  gatewayUnknown: number;
  modbusOk: number;
  modbusDegraded: number;
  modbusFail: number;
  modbusUnknown: number;
  telemetryFresh: number;
  telemetryStale: number;
  telemetryMissing: number;
  overallHealthy: number;
  overallDegraded: number;
  overallUnhealthy: number;
  overallUnknown: number;
  activeCommProblems: number;
  lastGatewayContactAt: number | null;
  lastTelemetryAt: number | null;
}) {
  return {
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
  };
}

function emptyFleet() {
  return {
    ready: false as const,
    devicesTracked: 0,
    devicesActive: null as number | null,
    devicesInactive: null as number | null,
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
    lastGatewayContactAt: null as number | null,
    lastTelemetryAt: null as number | null,
  };
}

function emptyIngest() {
  return {
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
}

function emptyIngestGlobal() {
  return {
    accepted: 0,
    heartbeatOk: 0,
    duplicate: 0,
    rateLimited: 0,
    authFailed: 0,
    invalid: 0,
    lastAcceptedAt: null as number | null,
    lastErrorAt: null as number | null,
    lastErrorKind: null as string | null,
  };
}

function mapIngestOrg(row: {
  accepted: number;
  heartbeatOk: number;
  duplicate: number;
  unknown: number;
  noGenerator: number;
  ambiguous: number;
  inactive: number;
  invalid: number;
  rateLimited: number;
  authFailed: number;
  oversized: number;
  error: number;
  lastAcceptedAt: number | null;
  lastErrorAt: number | null;
  lastErrorKind: string | null;
}) {
  return {
    accepted: row.accepted,
    heartbeatOk: row.heartbeatOk,
    duplicate: row.duplicate,
    unknown: row.unknown,
    noGenerator: row.noGenerator,
    ambiguous: row.ambiguous,
    inactive: row.inactive,
    invalid: row.invalid,
    rateLimited: row.rateLimited,
    authFailed: row.authFailed,
    oversized: row.oversized,
    error: row.error,
    lastAcceptedAt: row.lastAcceptedAt,
    lastErrorAt: row.lastErrorAt,
    lastErrorKind: row.lastErrorKind,
  };
}

function mapIngestGlobal(row: {
  accepted: number;
  heartbeatOk: number;
  duplicate: number;
  rateLimited: number;
  authFailed: number;
  invalid: number;
  lastAcceptedAt: number | null;
  lastErrorAt: number | null;
  lastErrorKind: string | null;
}) {
  return {
    accepted: row.accepted,
    heartbeatOk: row.heartbeatOk,
    duplicate: row.duplicate,
    rateLimited: row.rateLimited,
    authFailed: row.authFailed,
    invalid: row.invalid,
    lastAcceptedAt: row.lastAcceptedAt,
    lastErrorAt: row.lastErrorAt,
    lastErrorKind: row.lastErrorKind,
  };
}

function summarizeNotify(
  recentMessages: Array<{
    status: string;
    channel: string;
    createdAt: number;
  }>,
) {
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
  return notify;
}
