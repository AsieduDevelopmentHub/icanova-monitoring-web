import { describe, expect, test } from "vitest";
import { notConfiguredError, providerDecision } from "../../convex/delivery";
import { buildCsv, buildPdf, buildSpreadsheet, formatExportTime } from "../../convex/formats";

describe("export files", () => {
  test("csv guards formulas and quotes", () => {
    const csv = buildCsv(["Name"], [["=cmd"], ['say "hi"']]);
    expect(csv.startsWith("Name\r\n")).toBe(true);
    expect(csv).toContain("'=cmd");
    expect(csv).toContain('"say ""hi"""');
  });

  test("spreadsheet is Excel XML", () => {
    const xml = buildSpreadsheet(["Summary"], [["Oil"]]);
    expect(xml).toContain("urn:schemas-microsoft-com:office:spreadsheet");
    expect(xml).toContain("Summary");
    expect(xml).toContain("Oil");
  });

  test("pdf starts as a PDF and keeps the title", () => {
    const bytes = buildPdf("Alarm report", ["State"], [["active"]]);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Alarm report");
    expect(text).toContain("%%EOF");
  });

  test("export times are UTC and a missing clock stays blank", () => {
    expect(formatExportTime(null)).toBe("");
    expect(formatExportTime(Number.NaN)).toBe("");
    expect(formatExportTime(Date.UTC(2024, 0, 2, 3, 4, 5))).toBe("2024-01-02T03:04:05.000Z");
  });
});

describe("delivery providers", () => {
  test("push stays not configured even when email and sms keys exist", () => {
    expect(providerDecision("push", { resend: true, arkesel: true })).toBe("not_configured");
    expect(notConfiguredError("push")).toBe("VAPID is not configured");
  });

  test("email and sms follow their own server configuration", () => {
    expect(providerDecision("email", { resend: false, arkesel: true })).toBe("not_configured");
    expect(providerDecision("sms", { resend: true, arkesel: false })).toBe("not_configured");
    expect(providerDecision("email", { resend: true, arkesel: false })).toBe("send");
    expect(providerDecision("sms", { resend: false, arkesel: true })).toBe("send");
  });
});

describe("export failure presentation", () => {
  test("accessMessage maps forbidden export without leaking secrets", async () => {
    const { accessMessage } = await import("../fleet/access");
    expect(accessMessage(new Error("Forbidden: export.reports"))).toBe(
      "This organization did not grant that permission.",
    );
    expect(accessMessage(new Error("INGEST_SECRET=abc Bearer xyz"))).toBe("The request was refused.");
    expect(accessMessage(new Error("INGEST_SECRET=abc Bearer xyz"))).not.toContain("INGEST_SECRET");
  });
});
