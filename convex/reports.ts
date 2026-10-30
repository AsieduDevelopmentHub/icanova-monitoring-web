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
  reportKind: "alarms" | "maintenance" | "devices" | "deliveries",
): Promise<{ headers: string[]; rows: string[][]; capped: boolean }> {
  if (reportKind === "alarms") {
    const batch = await ctx.db
      .query("alarms")
      .withIndex("by_org_raised", (q) => q.eq("organizationId", organizationId))
      .take(MAX_EXPORT + 1);
    return {
      headers: ["Kind", "State", "Summary", "Detail", "Source time (UTC)"],
      capped: batch.length > MAX_EXPORT,
      rows: batch.slice(0, MAX_EXPORT).map((row) => [
        row.kind,
        row.state,
        row.summary,
        row.detail,
        formatExportTime(row.sourceTime),
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
