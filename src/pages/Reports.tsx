import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";

type ReportKind = "alarms" | "maintenance" | "devices" | "deliveries" | "telemetry" | "health";
type ReportFormat = "csv" | "xlsx" | "pdf";

const KINDS: { value: ReportKind; label: string }[] = [
  { value: "alarms", label: "Alarms" },
  { value: "health", label: "Gateway health" },
  { value: "telemetry", label: "Site summary" },
  { value: "devices", label: "Gateways" },
  { value: "maintenance", label: "Maintenance" },
  { value: "deliveries", label: "Deliveries" },
];

/** Type C analytics — filters, build, download table. */
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

  const resultRows = file
    ? [
        {
          id: "ready",
          kind: file.kind,
          format: file.format,
          rows: String(file.rowCount),
        },
      ]
    : [];

  return (
    <div className="stack analytics-page">
      <p className="meta">
        <Link to="/trends">Trends</Link>
        {" · "}
        <Link to="/alarms">Alarms</Link>
      </p>
      <form className="stack" onSubmit={onSubmit}>
        <FilterBar label="Report filters">
          <FilterSelect
            label="Kind"
            searchable={false}
            value={kind}
            onChange={(value) => setKind((KINDS.find((item) => item.value === value)?.value as ReportKind) ?? "alarms")}
            options={KINDS}
          />
          <FilterSelect
            label="Format"
            searchable={false}
            value={format}
            onChange={(value) => setFormat(value === "xlsx" || value === "pdf" ? value : "csv")}
            options={[
              { value: "csv", label: "CSV" },
              { value: "xlsx", label: "Excel" },
              { value: "pdf", label: "PDF" },
            ]}
          />
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Building…" : "Build"}
          </button>
        </FilterBar>
      </form>
      {capped ? <p className="meta">Row limit reached.</p> : null}
      {error ? <p className="err">{error}</p> : null}
      {file ? (
        <DataTable
          dense
          caption="Export ready"
          rows={resultRows}
          getRowKey={(row) => row.id}
          empty="No export."
          columns={[
            { key: "kind", header: "Kind", render: (row) => row.kind },
            { key: "format", header: "Format", render: (row) => row.format.toUpperCase() },
            { key: "rows", header: "Rows", align: "right", render: (row) => row.rows },
            {
              key: "download",
              header: "",
              render: () => (
                <button type="button" className="btn btn-secondary" onClick={() => downloadReport(file)}>
                  Download
                </button>
              ),
            },
          ]}
        />
      ) : (
        <EmptyState title="No export yet" body="Choose a kind and build a report." />
      )}
    </div>
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
