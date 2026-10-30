/** Export builders. They do not read the database and they do not embed secrets. */

const MAX_CELL = 500;

/** UTC timestamp for export cells. A missing clock stays blank. */
export function formatExportTime(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }
  return new Date(value).toISOString();
}

export function guardCell(value: string): string {
  const trimmed = value.replace(/\r|\n/g, " ").slice(0, MAX_CELL);
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const safeHeaders = headers.map(guardCell);
  const lines = [safeHeaders, ...rows.map((row) => row.map(guardCell))].map((row) =>
    row.map(csvField).join(","),
  );
  return `${lines.join("\r\n")}\r\n`;
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildSpreadsheet(headers: string[], rows: string[][]): string {
  const head = headers.map((cell) => `<Cell><Data ss:Type="String">${xml(guardCell(cell))}</Data></Cell>`).join("");
  const body = rows
    .map((row) => {
      const cells = row
        .map((cell) => `<Cell><Data ss:Type="String">${xml(guardCell(cell))}</Data></Cell>`)
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Report"><Table><Row>${head}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildPdf(title: string, headers: string[], rows: string[][]): Uint8Array {
  const lines = [title, headers.map(guardCell).join(" | ")];
  for (const row of rows) {
    lines.push(row.map((cell) => guardCell(cell).slice(0, 48)).join(" | "));
  }
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 36) {
    pages.push(lines.slice(index, index + 36));
  }
  if (pages.length === 0) {
    pages.push([title]);
  }
  return encodePdf(pages);
}

function encodePdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const pageIds: number[] = [];
  let next = 3;
  const fontId = 3 + pages.length * 2;
  for (const lines of pages) {
    const pageId = next;
    const contentId = next + 1;
    next += 2;
    pageIds.push(pageId);
    const commands = ["BT", "/F1 9 Tf", "40 750 Td", "12 TL"];
    lines.forEach((line, index) => {
      const text = pdfText(line);
      commands.push(index === 0 ? `(${text}) Tj` : `T* (${text}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    objects.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    );
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>\nendobj\n`,
    );
  }
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  const catalog = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const pageTree = `2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>\nendobj\n`;
  const font = `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const body = catalog + pageTree + objects.join("") + font;
  const header = "%PDF-1.4\n";
  const full = header + body;
  const xrefAt = full.length;
  const offsets = new Map<number, number>();
  let cursor = header.length;
  const chunks = [catalog, pageTree, ...objects, font];
  const ids = [1, 2, ...objects.map((object) => Number(object.slice(0, object.indexOf(" ")))), fontId];
  for (let index = 0; index < chunks.length; index += 1) {
    offsets.set(ids[index], cursor);
    cursor += chunks[index].length;
  }
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= fontId; id += 1) {
    const offset = offsets.get(id) ?? 0;
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `${xref}trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(full + trailer);
}

function pdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
