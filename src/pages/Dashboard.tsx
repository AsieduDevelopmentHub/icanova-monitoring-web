import { useMemo, useState } from "react";
import {
  FIXTURE_ENGINES,
  FIXTURE_SOURCE,
  fixtureGenerators,
  type FixtureGenerator,
} from "../fixtures/dashboard";
import { ChartFrame } from "../ui/ChartFrame";
import { DataTable, type Column } from "../ui/DataTable";
import { FilterBar, FilterSearch, FilterSelect } from "../ui/FilterBar";
import { Metric, formatMeasure } from "../ui/Metric";
import { Drawer, Dialog } from "../ui/Overlay";
import { StatusMark, statusToneForEngine, statusToneForLink } from "../ui/StatusMark";

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function LoadChart({ rows }: { rows: FixtureGenerator[] }) {
  const points = rows.filter(
    (row): row is FixtureGenerator & { loadPct: number } => row.loadPct !== null,
  );
  if (points.length < 2) {
    return null;
  }
  const width = 360;
  const height = 140;
  const max = Math.max(...points.map((point) => point.loadPct), 1);
  const coords = points.map((point, index) => {
    const x = 28 + (index / (points.length - 1)) * (width - 40);
    const y = 16 + (1 - point.loadPct / max) * (height - 36);
    return { x, y, point };
  });
  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fixture load percent">
      <title>Fixture load percent</title>
      <line x1="28" y1="16" x2="28" y2={height - 20} className="chart-axis" />
      <line x1="28" y1={height - 20} x2={width - 8} y2={height - 20} className="chart-axis" />
      <text x="4" y="20" className="chart-label">
        {max.toFixed(0)}%
      </text>
      <text x="8" y={height - 8} className="chart-label">
        0
      </text>
      <path d={path} className="chart-series" />
      {coords.map((coord) => (
        <circle key={coord.point.id} cx={coord.x} cy={coord.y} r="2.5" className="chart-point" />
      ))}
    </svg>
  );
}

function quality(value: number | null, digits: number, unit: string): string {
  if (value === null) {
    return "No value in this fixture";
  }
  return `Fixture value ${value.toFixed(digits)} ${unit}`.trim();
}

export function Dashboard() {
  const [query, setQuery] = useState("");
  const [site, setSite] = useState("all");
  const [engine, setEngine] = useState("all");
  const [selected, setSelected] = useState<FixtureGenerator | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const sites = useMemo(
    () => [...new Set(fixtureGenerators.map((row) => row.site))],
    [],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fixtureGenerators.filter((row) => {
      if (site !== "all" && row.site !== site) {
        return false;
      }
      if (engine !== "all" && row.engine !== engine) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.site.toLowerCase().includes(q)
      );
    });
  }, [query, site, engine]);

  const loads = rows.flatMap((row) => (row.loadPct === null ? [] : [row.loadPct]));
  const running = rows.filter((row) => row.engine === "Running").length;
  const faults = rows.filter((row) => row.engine === "Fault").length;
  const loadMean = mean(loads);

  const columns: Column<FixtureGenerator>[] = [
    { key: "id", header: "Id", render: (row) => row.id },
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "site", header: "Site", render: (row) => row.site },
    {
      key: "engine",
      header: "Engine",
      render: (row) => (
        <StatusMark tone={statusToneForEngine(row.engine)}>{row.engine}</StatusMark>
      ),
    },
    {
      key: "link",
      header: "Link",
      render: (row) => <StatusMark tone={statusToneForLink(row.link)}>{row.link}</StatusMark>,
    },
    {
      key: "rpm",
      header: "RPM",
      align: "right",
      render: (row) => formatMeasure(row.rpm, 0),
    },
    {
      key: "kw",
      header: "kW",
      align: "right",
      render: (row) => formatMeasure(row.kw, 1),
    },
    {
      key: "load",
      header: "Load %",
      align: "right",
      render: (row) => formatMeasure(row.loadPct, 0),
    },
    {
      key: "open",
      header: "Detail",
      render: (row) => (
        <button type="button" className="text-btn" onClick={() => setSelected(row)}>
          Open
        </button>
      ),
    },
  ];

  return (
    <section className="page">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>Command layout for a fleet. The numbers on this page are fixtures.</p>
      </header>
      <div className="notice fixture" role="note">
        <strong>Fixture board.</strong> {FIXTURE_SOURCE} A dash is a missing fixture
        value. A zero is a zero written in the fixture, including the stopped set.
      </div>

      <FilterBar label="Filter fixture generators">
        <FilterSearch
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Name, id, or site"
        />
        <FilterSelect
          label="Site"
          value={site}
          onChange={setSite}
          options={[
            { value: "all", label: "All fixture sites" },
            ...sites.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="Engine"
          value={engine}
          onChange={setEngine}
          options={[
            { value: "all", label: "All states" },
            ...FIXTURE_ENGINES.map((name) => ({ value: name, label: name })),
          ]}
        />
        <button type="button" className="text-btn" onClick={() => setGuideOpen(true)}>
          How to read this
        </button>
      </FilterBar>

      <div className="metric-grid">
        <Metric label="Rows" value={String(rows.length)} note="Filtered fixtures" />
        <Metric label="Running" value={String(running)} note="Fixture engine state" />
        <Metric label="Fault" value={String(faults)} note="Fixture engine state" />
        <Metric
          label="Mean load"
          value={formatMeasure(loadMean, 0)}
          unit={loadMean === null ? undefined : "%"}
          note="Rows with a load value"
        />
      </div>

      <div className="board-split">
        <ChartFrame
          title="Load"
          caption="Y axis is fixture load percent. X axis is filtered rows that include a load. Null loads are omitted."
          empty={
            loads.length < 2
              ? "Need at least two fixture rows with a load value."
              : undefined
          }
        >
          <LoadChart rows={rows} />
        </ChartFrame>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          empty="No fixture rows match this filter."
          caption="Fixture generators. Not live telemetry."
        />
      </div>

      <Drawer
        open={selected !== null}
        title={selected ? `${selected.id} fixture` : "Fixture"}
        side="right"
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <dl className="spec">
            <div>
              <dt>Source</dt>
              <dd>{FIXTURE_SOURCE}</dd>
            </div>
            <div>
              <dt>Site</dt>
              <dd>{selected.site}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{selected.name}</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>{selected.engine}</dd>
            </div>
            <div>
              <dt>Link</dt>
              <dd>{selected.link}</dd>
            </div>
            <div>
              <dt>RPM</dt>
              <dd>{quality(selected.rpm, 0, "rpm")}</dd>
            </div>
            <div>
              <dt>Power</dt>
              <dd>{quality(selected.kw, 1, "kW")}</dd>
            </div>
            <div>
              <dt>Load</dt>
              <dd>{quality(selected.loadPct, 0, "%")}</dd>
            </div>
          </dl>
        ) : null}
      </Drawer>

      <Dialog open={guideOpen} title="How to read this board" onClose={() => setGuideOpen(false)}>
        <p>
          Every figure on the dashboard comes from <code>src/fixtures/dashboard.ts</code>.
          Filtering only hides those rows in the browser. It does not query Convex or a
          gateway.
        </p>
        <p>
          Live readings for the gateway on this LAN are on Local gateway. Configure still
          reads and writes that gateway. The other navigation items have no backend yet.
        </p>
        <button type="button" onClick={() => setGuideOpen(false)}>
          Close
        </button>
      </Dialog>
    </section>
  );
}
