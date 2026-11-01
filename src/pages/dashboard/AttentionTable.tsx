import { Link } from "react-router";
import { DataTable, type Column } from "../../ui/DataTable";
import { StatusMark } from "../../ui/StatusMark";
import { formatReading } from "../../telemetry/readings";
import { storedReading } from "../../fleet/access";
import type { BoardRow } from "./types";
import { attentionScore, engineView, linkView, storedFreshness } from "./logic";

export function AttentionTable({
  rows,
  showSite,
  onSelect,
  selectedId,
}: {
  rows: BoardRow[];
  showSite: boolean;
  onSelect: (generatorId: string) => void;
  selectedId: string | null;
}) {
  const now = Date.now();
  const attention = [...rows]
    .filter((row) => attentionScore(row, now) >= 20)
    .sort((a, b) => attentionScore(b, now) - attentionScore(a, now))
    .slice(0, 12);

  const columns: Column<BoardRow>[] = [
    ...(showSite
      ? [
          {
            key: "site",
            header: "Site",
            render: (row: BoardRow) => row.siteName ?? "—",
          } satisfies Column<BoardRow>,
        ]
      : []),
    {
      key: "name",
      header: "Generator",
      render: (row) => (
        <button type="button" className="text-btn" onClick={() => onSelect(row.generatorId)}>
          {row.name}
        </button>
      ),
    },
    {
      key: "state",
      header: "State",
      render: (row) => {
        const engine = engineView(row.rpm, row.rpmQuality);
        return <StatusMark tone={engine.tone}>{engine.label}</StatusMark>;
      },
    },
    {
      key: "load",
      header: "Load",
      align: "right",
      render: (row) => formatReading(storedReading(row.powerKw, row.powerQuality, "kW")),
    },
    {
      key: "link",
      header: "Modbus",
      render: (row) => {
        const link = linkView(row.link);
        return <StatusMark tone={link.tone}>{link.label}</StatusMark>;
      },
    },
    {
      key: "fresh",
      header: "Freshness",
      render: (row) => {
        const state = storedFreshness(row.updatedAt, now);
        return (
          <StatusMark tone={state.stale ? "warn" : state.state === "fresh" ? "ok" : "offline"}>
            {state.state === "fresh" ? "Fresh" : state.state === "stale" ? "Stale" : "Missing"}
          </StatusMark>
        );
      },
    },
    {
      key: "alarms",
      header: "Alarms",
      align: "right",
      render: (row) =>
        (row.alarmCount ?? 0) > 0 ? (
          <StatusMark tone="warn">{String(row.alarmCount)}</StatusMark>
        ) : (
          "0"
        ),
    },
    {
      key: "action",
      header: "",
      render: (row) => <Link to={`/generators/${row.generatorId}`}>Open</Link>,
    },
  ];

  return (
    <section className="cc-attention" aria-label="Generators requiring attention">
      <header className="cc-section-head">
        <h2 className="cc-section-title">Attention</h2>
        <p className="cc-section-desc">Generators with alarms, link faults, or stale telemetry.</p>
      </header>
      <DataTable
        dense
        columns={columns}
        rows={attention}
        getRowKey={(row) => row.generatorId}
        empty="No generators require attention."
        rowClassName={(row) => (row.generatorId === selectedId ? "is-selected" : undefined)}
      />
    </section>
  );
}
