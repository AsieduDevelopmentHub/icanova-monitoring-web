import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";

export function Reports() {
  return (
    <OrgGate
      title="Reports"
      lede="CSV, Excel, and PDF files are built on the server. One export reads at most 200 rows. Site telemetry is the stored summary, not an energy total."
      offline="No export is running."
    >
      {(organizationId) => <ExportForm organizationId={organizationId} />}
    </OrgGate>
  );
}

function ExportForm({ organizationId }: { organizationId: Id<"organizations"> }) {
  const build = useMutation(api.reports.build);
  const [kind, setKind] = useState<"alarms" | "maintenance" | "devices" | "deliveries" | "telemetry">(
    "alarms",
  );
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [reportId, setReportId] = useState<Id<"reports"> | null>(null);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useQuery(api.reports.file, reportId ? { reportId } : "skip");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await build({ organizationId, kind, format });
      setReportId(result.reportId);
      setCapped(result.capped);
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <div className="stack">
      <form className="filter-bar" onSubmit={onSubmit}>
        <label className="filter-field">
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="alarms">Alarms</option>
            <option value="maintenance">Maintenance</option>
            <option value="devices">Devices</option>
            <option value="deliveries">Deliveries</option>
            <option value="telemetry">Site telemetry</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Format</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="submit">Build report</button>
      </form>
      {capped ? <p className="notice">This file stopped at 200 rows.</p> : null}
      {file ? (
        <button type="button" onClick={() => downloadReport(file)}>
          Download {file.kind} ({file.rowCount} rows)
        </button>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <p className="meta">Build and download both require export.reports on this organization.</p>
    </div>
  );
}

function downloadReport(file: { content: string; format: string; kind: string }) {
  const payload = file.format === "pdf" ? base64ToBuffer(file.content) : file.content;
  const type =
    file.format === "csv" ? "text/csv" : file.format === "xlsx" ? "application/vnd.ms-excel" : "application/pdf";
  const url = URL.createObjectURL(new Blob([payload], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${file.kind}.${file.format === "xlsx" ? "xls" : file.format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
