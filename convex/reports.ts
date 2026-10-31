import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { writeAudit } from "./audits";
import { requirePermission } from "./auth";
import { buildCsv, buildPdf, buildSpreadsheet, formatExportTime } from "./formats";
import { MAX_EXPORT, MAX_EXPORT_BYTES } from "./limits";

const kind = v.union(
  v.literal("alarms"),
  v.literal("maintenance"),
  v.literal("devices"),
  v.literal("deliveries"),
  v.literal("telemetry"),
  v.literal("health"),
);
const format = v.union(v.literal("csv"), v.literal("xlsx"), v.literal("pdf"));

export const build = mutation({
  args: {
    organizationId: v.id("organizations"),
    kind,
    format,
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, args.organizationId, "export.reports");
    const loaded = await loadRows(ctx, args.organizationId, args.kind);
    const body =
      args.format === "csv"
        ? buildCsv(loaded.headers, loaded.rows)
        : args.format === "xlsx"
          ? buildSpreadsheet(loaded.headers, loaded.rows)
          : buildPdf(`${args.kind} report`, loaded.headers, loaded.rows);
    const encoded = typeof body === "string" ? new TextEncoder().encode(body) : body;
    if (encoded.byteLength > MAX_EXPORT_BYTES) {
      throw new Error("Export is too large");
    }
    const content = typeof body === "string" ? body : bytesToBase64(body);
    const reportId = await ctx.db.insert("reports", {
      organizationId: args.organizationId,
      requestedBy: user._id,
      kind: args.kind,
      format: args.format,
      rowCount: loaded.rows.length,
      capped: loaded.capped,
      content,
      createdAt: Date.now(),
    });
    await writeAudit(ctx, args.organizationId, "report.build", reportId);
    return { reportId, rowCount: loaded.rows.length, capped: loaded.capped };
  },
});

export const file = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, report.organizationId, "export.reports");
    return {
      content: report.content,
      format: report.format,
      kind: report.kind,
      rowCount: report.rowCount,
      capped: report.capped,
    };
  },
});

async function loadRows(
  ctx: { db: import("./_generated/server").QueryCtx["db"] },
  organizationId: import("./_generated/dataModel").Id<"organizations">,
  reportKind: "alarms" | "maintenance" | "devices" | "deliveries" | "telemetry" | "health",
): Promise<{ headers: string[]; rows: string[][]; capped: boolean }> {
  if (reportKind === "alarms") {
    const batch = await ctx.db
      .query("alarms")
      .withIndex("by_org_raised", (q) => q.eq("organizationId", organizationId))
      .take(MAX_EXPORT + 1);
    return {
      headers: [
        "Kind",
        "State",
        "Summary",
        "Detail",
        "Source time (UTC)",
        "Category",
        "Severity",
        "Source",
        "Occurrences",
      ],
      capped: batch.length > MAX_EXPORT,
      rows: batch.slice(0, MAX_EXPORT).map((row) => [
        row.kind,
        row.state,
        row.summary,
        row.detail,
        formatExportTime(row.sourceTime),
        row.category ?? (row.kind === "controller" ? "generator" : "communication"),
        row.severity ?? "warning",
        row.source ?? "",
        String(row.occurrenceCount ?? 1),
      ]),
    };
  }
  if (reportKind === "maintenance") {
    const batch = await ctx.db
      .query("maintenanceRecords")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .take(MAX_EXPORT + 1);
    return {
      headers: ["Summary", "Notes", "Performed at (UTC)", "Recorded at (UTC)"],
      capped: batch.length > MAX_EXPORT,
      rows: batch.slice(0, MAX_EXPORT).map((row) => [
        row.summary,
        row.notes,
        formatExportTime(row.performedAt),
        formatExportTime(row.recordedAt),
      ]),
    };
  }
  if (reportKind === "telemetry") {
    const batch = await ctx.db
      .query("siteSummaries")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .take(MAX_EXPORT + 1);
    const rows: string[][] = [];
    for (const row of batch.slice(0, MAX_EXPORT)) {
      const site = await ctx.db.get(row.siteId);
      rows.push([
        site && site.organizationId === organizationId ? site.name : "",
        row.generators === null ? "" : String(row.generators),
        String(row.reporting),
        String(row.linkOk),
        String(row.linkFail),
        String(row.linkDegraded),
        String(row.linkOther),
        formatExportTime(row.lastTelemetryAt),
      ]);
    }
    return {
      headers: [
        "Site",
        "Generators",
        "Reporting",
        "Link ok",
        "Link fail",
        "Link degraded",
        "Other link",
        "Last telemetry (UTC)",
      ],
      capped: batch.length > MAX_EXPORT,
      rows,
    };
  }
  if (reportKind === "devices") {
    const batch = await ctx.db
      .query("devices")
      .withIndex("by_org_site", (q) => q.eq("organizationId", organizationId))
      .take(MAX_EXPORT + 1);
    return {
      headers: ["Name", "Identity", "Site id"],
      capped: batch.length > MAX_EXPORT,
      rows: batch.slice(0, MAX_EXPORT).map((row) => [row.name, row.identity, row.siteId]),
    };
  }
  if (reportKind === "health") {
    const batch = await ctx.db
      .query("deviceHealthEvents")
      .withIndex("by_org_at", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(MAX_EXPORT + 1);
    const rows: string[][] = [];
    for (const row of batch.slice(0, MAX_EXPORT)) {
      const device = await ctx.db.get(row.deviceId);
      if (device && device.organizationId !== organizationId) {
        throw new Error("Forbidden");
      }
      rows.push([
        formatExportTime(row.at),
        device?.name ?? "",
        device?.identity ?? "",
        row.siteId,
        row.reason,
        row.gatewayTo ?? "",
        row.modbusTo ?? "",
        row.freshnessTo ?? "",
        row.overallTo ?? "",
      ]);
    }
    return {
      headers: [
        "At (UTC)",
        "Gateway",
        "Identity",
        "Site id",
        "Reason",
        "Cloud to",
        "Modbus to",
        "Freshness to",
        "Overall to",
      ],
      capped: batch.length > MAX_EXPORT,
      rows,
    };
  }
  const batch = await ctx.db
    .query("messages")
    .withIndex("by_org_created", (q) => q.eq("organizationId", organizationId))
    .take(MAX_EXPORT + 1);
  return {
    headers: ["Channel", "Event", "Status", "Attempt", "Error"],
    capped: batch.length > MAX_EXPORT,
    rows: batch.slice(0, MAX_EXPORT).map((row) => [
      row.channel,
      row.event ?? "",
      row.status,
      String(row.attempt),
      row.error ?? "",
    ]),
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return btoa(text);
}
