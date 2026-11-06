import { useState, type ReactNode } from "react";
import { isValidElement } from "react";

type ExportFormat = "" | "pdf" | "csv" | "excel";
export type ExportCell = string | number | null | undefined;

export function PageExport({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: ExportCell[][];
}) {
  const [format, setFormat] = useState<ExportFormat>("");
  const disabled = rows.length === 0;

  function onChange(next: ExportFormat) {
    setFormat("");
    if (!next) {
      return;
    }
    if (next === "pdf") {
      printPage(title);
      return;
    }
    downloadTable(title, headers, rows, next);
  }

  return (
    <label className="page-export">
      <span>Export</span>
      <select
        aria-label={`Export ${title}`}
        value={format}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ExportFormat)}
      >
        <option value="">Choose format</option>
        <option value="pdf">PDF</option>
        <option value="csv">CSV</option>
        <option value="excel">Excel</option>
      </select>
    </label>
  );
}

export function exportCellText(value: ReactNode): ExportCell {
  if (value == null || typeof value === "boolean") {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(exportCellText).filter((part) => part !== "").join(" ");
  }
  if (isValidElement<{ children?: ReactNode }>(value)) {
    return exportCellText(value.props.children);
  }
  return "";
}

function printPage(title: string) {
  const previousTitle = document.title;
  document.title = `${fileStem(title)} · iCaNova Monitoring`;
  document.body.classList.add("print-export");
  try {
    window.print();
  } finally {
    document.body.classList.remove("print-export");
    document.title = previousTitle;
  }
}

function downloadTable(
  title: string,
  headers: string[],
  rows: ExportCell[][],
  format: "csv" | "excel",
) {
  const content =
    format === "csv"
      ? buildCsvExport(headers, rows)
      : buildExcelExport(headers, rows, title);
  const mime =
    format === "csv"
      ? "text/csv;charset=utf-8"
      : "application/vnd.ms-excel;charset=utf-8";
  const extension = format === "csv" ? "csv" : "xls";
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileStem(title)}.${extension}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function buildCsvExport(headers: string[], rows: ExportCell[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvField).join(","))
    .join("\r\n") + "\r\n";
}

function csvField(value: ExportCell): string {
  const text = safeCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildExcelExport(headers: string[], rows: ExportCell[][], title: string): string {
  const renderRow = (row: ExportCell[]) =>
    `<Row>${row.map(excelCell).join("")}</Row>`;
  const worksheetName = xml(title.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Export");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${worksheetName}"><Table>${renderRow(headers)}${rows.map(renderRow).join("")}</Table></Worksheet>
</Workbook>`;
}

function excelCell(value: ExportCell): string {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const type = isNumber ? "Number" : "String";
  const text = isNumber ? String(value) : safeCell(value);
  return `<Cell><Data ss:Type="${type}">${xml(text)}</Data></Cell>`;
}

function safeCell(value: ExportCell): string {
  const text = value == null ? "" : String(value).replace(/\r|\n/g, " ").slice(0, 500);
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return text;
  }
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fileStem(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "icanova-export";
}
