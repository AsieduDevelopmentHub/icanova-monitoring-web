import { useState } from "react";
import { DataTable } from "../ui/DataTable";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";
import {
  addressLabel,
  filterDiagnostics,
  lastSuccessfulRow,
  retriesLabel,
  type DiagnosticKind,
  type DiagnosticRow,
} from "../telemetry/diagnosticsView";

export function DiagnosticPanel({
  rows,
  sourceNote,
  successNote,
  chronological = true,
}: {
  rows: DiagnosticRow[];
  sourceNote: string;
  successNote?: string;
  /** Last-success walks from the end, so the rows must be oldest first. */
  chronological?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | DiagnosticKind>("all");
  const [picked, setPicked] = useState("");
  const shown = filterDiagnostics(rows, search, kind);
  const selected = shown.find((row) => row.key === picked) ?? shown[0] ?? null;
  const success = chronological ? lastSuccessfulRow(rows) : null;
  const successText =
    successNote ??
    (success
      ? `Last successful poll is TXN ${success.txn}. CRC ${success.crcResult}, result ${success.result}. The log has no clock, so there is no timestamp. A CRC pass with an invalid frame is not a successful poll.`
      : "No successful poll is in this set. A CRC pass with an invalid frame is not counted.");

  return (
    <div className="stack">
      <p>{sourceNote}</p>
      <p>{successText}</p>
      <FilterBar label="Diagnostics filters">
        <FilterSearch label="Search" value={search} onChange={setSearch} placeholder="Address, txn, frame, result" />
        <FilterSelect
          label="Kind"
          value={kind}
          onChange={(value) => setKind(value === "frame" || value === "batch" ? value : "all")}
          options={[
            { value: "all", label: "Frames and batches" },
            { value: "frame", label: "Frames" },
            { value: "batch", label: "Batch errors" },
          ]}
        />
      </FilterBar>
      <DataTable
        caption="Modbus diagnostics"
        rows={shown}
        getRowKey={(row) => row.key}
        empty="No rows match this filter."
        columns={[
          {
            key: "open",
            header: "",
            render: (row) => (
              <button type="button" onClick={() => setPicked(row.key)}>
                Evidence
              </button>
            ),
          },
          { key: "kind", header: "Kind", render: (row) => row.kind },
          { key: "txn", header: "Txn", align: "right", render: (row) => row.txn ?? "—" },
          { key: "fc", header: "Function", render: (row) => row.functionCode ?? "—" },
          { key: "addr", header: "Address", render: (row) => addressLabel(row.address) },
          { key: "crc", header: "CRC", render: (row) => row.crcResult ?? "—" },
          { key: "result", header: "Result", render: (row) => row.result ?? "—" },
          {
            key: "ms",
            header: "First RX",
            align: "right",
            render: (row) => (row.latencyMs === null ? "—" : `${row.latencyMs} ms`),
          },
          { key: "retries", header: "Retries", render: (row) => retriesLabel(row.retries) },
        ]}
      />
      {selected ? <Evidence row={selected} /> : null}
    </div>
  );
}

function Evidence({ row }: { row: DiagnosticRow }) {
  const transport = row.kind === "batch" || row.crcResult === "FAIL" || (row.result ?? "").includes("INVALID");
  return (
    <div className="stack">
      <p>
        <StatusMark tone={transport ? "warn" : "ok"}>{transport ? "Transport" : "Frame accepted"}</StatusMark>
      </p>
      <dl className="facts">
        <dt>Function code</dt>
        <dd>{row.functionCode ?? "—"}</dd>
        <dt>Register address</dt>
        <dd>{addressLabel(row.address)}</dd>
        <dt>Quantity</dt>
        <dd>{row.quantity ?? "—"}</dd>
        <dt>Received CRC</dt>
        <dd>{row.receivedCrc ?? "—"}</dd>
        <dt>Calculated CRC</dt>
        <dd>{row.calculatedCrc ?? "—"}</dd>
        <dt>CRC result</dt>
        <dd>{row.crcResult ?? "—"}</dd>
        <dt>Result</dt>
        <dd>{row.result ?? "—"}</dd>
        <dt>Time to first RX byte</dt>
        <dd>{row.latencyMs === null ? "—" : `${row.latencyMs} ms`}</dd>
        <dt>Retries</dt>
        <dd>{retriesLabel(row.retries)}</dd>
        <dt>RX length</dt>
        <dd>{row.rxLength ?? "—"}</dd>
        <dt>Raw TX</dt>
        <dd>{row.tx ?? "—"}</dd>
        <dt>Raw RX</dt>
        <dd>{row.rx ?? "—"}</dd>
        <dt>Note</dt>
        <dd>{row.note ?? "—"}</dd>
      </dl>
    </div>
  );
}
