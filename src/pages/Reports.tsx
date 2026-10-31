import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { Panel } from "../ui/Panel";

type ReportKind = "alarms" | "maintenance" | "devices" | "deliveries" | "telemetry" | "health";
type ReportFormat = "csv" | "xlsx" | "pdf";

const KIND_HELP: Record<ReportKind, string> = {
  alarms: "Latest alarm rows for this organization (bounded). Includes state and severity when stored.",
  maintenance: "Maintenance records for this organization (bounded).",
  devices: "Registered gateways/devices with identity and site id (bounded).",
  deliveries: "Notification delivery attempts (bounded).",
  telemetry: "Stored site summary tallies — not energy totals and not a full history dump.",
  health: "Recent gateway health transitions for the organization (bounded). Not an uptime percentage.",
};

export function Reports() {
  return (
    <OrgGate title="Reports" offline="No export is running.">
      {(organizationId) => <ExportForm organizationId={organizationId} />}
    </OrgGate>
  );
}

function ExportForm({ organizationId }: { organizationId: Id<"organizations"> }) {
  const build = useMutation(api.reports.build);
  const [kind, setKind] = useState<ReportKind>("alarms");
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [reportId, setReportId] = useState<Id<"reports"> | null>(null);
  const [capped, setCapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const file = useQuery(api.reports.file, reportId ? { reportId } : "skip");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const result = await build({ organizationId, kind, format });
      setReportId(result.reportId);
      setCapped(result.capped);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Export" description={KIND_HELP[kind]}>
      <form className="filter-bar" onSubmit={onSubmit}>
        <label className="filter-field">
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as ReportKind)}>
            <option value="alarms">Alarm report</option>
            <option value="health">Gateway health transitions</option>
            <option value="telemetry">Site operational summary</option>
            <option value="devices">Gateway inventory</option>
            <option value="maintenance">Maintenance</option>
            <option value="deliveries">Notification deliveries</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Format</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)}>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel</option>
            <option value="pdf">PDF</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Building…" : "Build report"}
        </button>
      </form>
      {capped ? (
        <div className="notice" role="note">
          <strong>Bounded export.</strong> This file stopped at the row limit. It is not a complete
          operational record.
        </div>
      ) : null}
      {file ? (
        <button type="button" className="btn btn-secondary" onClick={() => downloadReport(file)}>
          Download {file.kind} ({file.rowCount} rows)
        </button>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <p className="meta">
        Build and download require <code className="tech">export.reports</code>.{" "}
        <Link to="/events">Open event timeline</Link>
        {" · "}
        <Link to="/alarms">Alarm center</Link>
      </p>
    </Panel>
  );
}

function downloadReport(file: { content: string; format: string; kind: string }) {
  const payload = file.format === "pdf" ? base64ToBuffer(file.content) : file.content;
  const type =
    file.format === "csv" ? "text/csv" : file.format === "xlsx" ? "application/vnd.ms-excel" : "application/pdf";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const ext = file.format === "xlsx" ? "xls" : file.format;
  const url = URL.createObjectURL(new Blob([payload], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `icanova-${file.kind}-${stamp}.${ext}`;
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
