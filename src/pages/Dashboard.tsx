import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { FleetBoundary } from "../fleet/boundary";
import { storedReading } from "../fleet/access";
import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { engineView, linkView, snapshotScope, type LiveRow } from "../telemetry/fleetView";
import { pageFreshness, storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import { DataTable, type Column } from "../ui/DataTable";
import { FilterBar, FilterSearch } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { SiteAlarmPanel } from "../fleet/AlarmPanel";

type BoardRow = LiveRow & {
  generatorId: string;
  name: string;
  powerKw: number | null;
  powerQuality: string;
};

export function Dashboard() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>Current readings for one site. This board does not subscribe to history or to every site.</p>
      </header>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId}>
            {(siteId, siteName, moreSites) => (
              <FleetBoundary key={siteId}>
                <SiteBoard
                  organizationId={org.organizationId}
                  siteId={siteId}
                  siteName={siteName}
                  moreSites={moreSites}
                  permissions={org.permissions}
                />
              </FleetBoundary>
            )}
          </SiteSelect>
        )}
      </LiveGate>
      <p className="meta">
        The labelled demonstration stays at{" "}
        <Link to={`/generators/${DEMO_GENERATOR_ID}`}>generators/{DEMO_GENERATOR_ID}</Link>. It is not
        this board.
      </p>
    </section>
  );
}

function SiteBoard({
  organizationId,
  siteId,
  siteName,
  moreSites,
  permissions,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
  moreSites: boolean;
  permissions: readonly string[];
}) {
  const data = useQuery(api.telemetry.currentForSite, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  const summary = useQuery(api.telemetry.siteSummary, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const loaded = (Array.isArray(data?.rows) ? data.rows : []) as BoardRow[];
    const q = query.trim().toLowerCase();
    if (!q) {
      return loaded;
    }
    return loaded.filter((row) => row.name.toLowerCase().includes(q));
  }, [data, query]);

  if (data === undefined) {
    return <p className="empty">Loading current readings.</p>;
  }
  const loaded = (Array.isArray(data.rows) ? data.rows : []) as BoardRow[];
  const scope = snapshotScope(loaded, Boolean(data.capped));
  const freshness = pageFreshness(loaded, Date.now());
  const siteReady = summary?.ready === true;
  const columns: Column<BoardRow>[] = [
    {
      key: "name",
      header: "Generator",
      render: (row) => <Link to={`/generators/${row.generatorId}`}>{row.name}</Link>,
    },
    {
      key: "link",
      header: "Link",
      render: (row) => {
        const link = linkView(row.link);
        return <StatusMark tone={link.tone}>{link.label}</StatusMark>;
      },
    },
    {
      key: "engine",
      header: "Engine",
      render: (row) => {
        const engine = engineView(row.rpm, row.rpmQuality);
        return <StatusMark tone={engine.tone}>{engine.label}</StatusMark>;
      },
    },
    {
      key: "alarms",
      header: "Alarm count",
      align: "right",
      render: (row) =>
        row.alarmCount === null || !Number.isFinite(row.alarmCount) ? (
          "—"
        ) : row.alarmCount > 0 ? (
          <StatusMark tone="warn">{String(row.alarmCount)}</StatusMark>
        ) : (
          "0"
        ),
    },
    {
      key: "rpm",
      header: "RPM",
      align: "right",
      render: (row) => formatReading(storedReading(row.rpm, row.rpmQuality, "rpm")),
    },
    {
      key: "power",
      header: "kW",
      align: "right",
      render: (row) => formatReading(storedReading(row.powerKw, row.powerQuality, "kW")),
    },
    {
      key: "stored",
      header: "Stored",
      render: (row) => {
        const freshness = storedFreshness(row.updatedAt, Date.now());
        return (
          <>
            {freshness.stale ? <StatusMark tone="warn">Stale</StatusMark> : null} {freshness.label}
          </>
        );
      },
    },
  ];

  return (
    <div className="stack">
      <p className="meta">
        Site {siteName}. {scope.note}
        {moreSites ? " The site selector is also a partial page." : ""}
      </p>
      {loaded.length === 0 ? (
        <p className="empty">
          No generators are registered on this site. Register a device and a generator on Generators.
          The device identity is the 12-character efuse MAC.
        </p>
      ) : scope.reporting === 0 ? (
        <div className="notice" role="note">
          <strong>No live telemetry.</strong> Generators are registered, and none has a stored reading.
          Check that the gateway identity matches the registered device.
        </div>
      ) : null}
      <div className="metric-grid">
        <Metric
          label="Generators"
          value={siteReady && summary?.generators !== null ? String(summary?.generators) : String(scope.generators)}
          note={
            siteReady
              ? summary?.generators === null
                ? "More than 50 generators. Not a complete count."
                : "Stored site summary."
              : scope.note
          }
        />
        <Metric
          label="Reporting"
          value={siteReady ? String(summary?.reporting) : String(scope.reporting)}
          note={siteReady ? "Generators with a stored reading" : "Rows with a stored reading in this page"}
        />
        <Metric
          label="Online links"
          value={siteReady ? String(summary?.linkOk) : String(scope.online)}
          note={siteReady ? "Link ok. Not an engine state." : "Link ok in this page"}
        />
        <Metric
          label="Offline links"
          value={siteReady ? String(summary?.linkFail) : String(scope.offline)}
          note="Link fail. Not an engine stop"
        />
        <Metric
          label="Degraded links"
          value={siteReady ? String(summary?.linkDegraded) : String(scope.degraded)}
          note="Link degraded"
        />
        <Metric
          label="Other links"
          value={siteReady ? String(summary?.linkOther) : String(scope.unknown)}
          note="Unknown, missing, or not ok, fail, or degraded"
        />
        <Metric label="Fresh" value={String(freshness.fresh)} note={freshness.note} />
        <Metric label="Stale" value={String(freshness.stale)} note={freshness.note} />
      </div>
      <SiteAlarmPanel
        organizationId={organizationId}
        siteId={siteId}
        permissions={permissions}
      />
      <FilterBar label="Filter this site snapshot">
        <FilterSearch label="Name" value={query} onChange={setQuery} placeholder="Generator name" />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.generatorId}
        empty={loaded.length === 0 ? "No generators are registered on this site." : "No name matches this filter."}
        caption={`Current readings for ${siteName}`}
      />
    </div>
  );
}
