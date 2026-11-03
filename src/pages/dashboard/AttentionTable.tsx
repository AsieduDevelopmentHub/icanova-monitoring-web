import { Link } from "react-router";
import { DataTable, type Column } from "../../ui/DataTable";
import { StatusMark } from "../../ui/StatusMark";
import { formatReading } from "../../telemetry/readings";
import { storedReading } from "../../fleet/access";
import { siteGeneratorPath, sitePath } from "../../fleet/paths";
import type { BoardRow } from "./types";
import { attentionScore, engineView, linkView, storedFreshness } from "./logic";

export function AttentionTable({
  rows,
  showSite,
  onSelect,
  selectedId,
  listAll = false,
  siteId = null,
}: {
  rows: BoardRow[];
  showSite: boolean;
  onSelect: (generatorId: string) => void;
  selectedId: string | null;
  listAll?: boolean;
  siteId?: string | null;
}) {
  const now = Date.now();
  const attention = listAll
    ? rows
    : [...rows]
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
      render: (row) => {
        const sid = siteId ?? row.siteId;
        return sid ? (
          <Link to={siteGeneratorPath(sid, row.generatorId)}>Open</Link>
        ) : row.siteId ? (
          <Link to={sitePath(row.siteId)}>Site</Link>
        ) : (
          <Link to="/sites">Sites</Link>
        );
      },
    },
  ];

  return (
    <section className="cc-attention" aria-label={listAll ? "Generators" : "Generators requiring attention"}>
      <header className="cc-section-head">
        <h2 className="cc-section-title">{listAll ? "Generators" : "Attention"}</h2>
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
