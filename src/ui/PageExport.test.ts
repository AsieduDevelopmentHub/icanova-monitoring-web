import { describe, expect, test } from "vitest";
import { buildCsvExport, buildExcelExport } from "./PageExport";

describe("page exports", () => {
  test("CSV escapes fields and guards spreadsheet formulas without changing negative numbers", () => {
    const csv = buildCsvExport(["Site", "Reading", "Note"], [
      ["=2+2", -1.25, 'say "hi"'],
    ]);

    expect(csv).toBe("Site,Reading,Note\r\n'=2+2,-1.25,\"say \"\"hi\"\"\"\r\n");
  });

  test("Excel export contains a workbook with escaped cells and numeric values", () => {
    const xml = buildExcelExport(["Site & ID", "Voltage"], [["<Site>", 230.5]], "Site report");

    expect(xml).toContain('<Worksheet ss:Name="Site report">');
    expect(xml).toContain("Site &amp; ID");
    expect(xml).toContain("&lt;Site&gt;");
    expect(xml).toContain('<Data ss:Type="Number">230.5</Data>');
  });
});
