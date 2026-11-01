import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { storedReading } from "../fleet/access";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { engineView, linkView } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSearch } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
import { Panel } from "../ui/Panel";
import { Skeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";

type LiveRow = {
  generatorId?: string;
  name: string;
  updatedAt: number | null;
  link: string | null;
  alarmCount: number | null;
  rpm: number | null;
  rpmQuality: string;
  batteryV: number | null;
  batteryQuality: string;
  frequencyHz: number | null;
  frequencyQuality: string;
  powerKw: number | null;
  powerQuality: string;
  voltageL1: number | null;
  voltageQuality: string;
};

export function Monitor() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Live Systems</h1>
      </header>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId}>
            {(siteId, siteName) =>
              siteId ? (
                <SiteReadings organizationId={org.organizationId} siteId={siteId} siteName={siteName} />
              ) : null
            }
          </SiteSelect>
        )}
      </LiveGate>
    </section>
  );
}

function SiteReadings({
  organizationId,
  siteId,
  siteName,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  siteName: string;
}) {
  const data = useQuery(api.telemetry.currentForSite, {
    organizationId: organizationId as Id<"organizations">,
    siteId,
  });
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const loaded = (Array.isArray(data?.rows) ? data.rows : []) as LiveRow[];
    const q = query.trim().toLowerCase();
    if (!q) {
      return loaded;
    }
    return loaded.filter((row) => row.name.toLowerCase().includes(q));
  }, [data, query]);

  if (data === undefined) {
    return <Skeleton lines={5} />;
  }
  const loaded = (Array.isArray(data.rows) ? data.rows : []) as LiveRow[];
  return (
    <div className="stack">
      <div className="ops-banner">
        <p className="meta">
          <strong>{siteName}</strong>
          {data.capped ? " · first page" : ""}
        </p>
        <div className="ops-links">
          <Link to="/app">Dashboard</Link>
          <Link to="/gateways">Gateways</Link>
        </div>
      </div>
      {loaded.length === 0 ? (
        <EmptyState
          title="No generators"
          body="Register equipment for this site."
          action={<Link to="/generators">Generators</Link>}
        />
      ) : (
        <Panel
          title="Readings"
          actions={
            <FilterBar label="Filter">
              <FilterSearch label="Generator" value={query} onChange={setQuery} placeholder="Name" />
            </FilterBar>
          }
        >
          {rows.length === 0 ? (
            <EmptyState title="No matches" body="No generators match this filter." />
          ) : (
            rows.map((row) => <ReadingRow key={row.generatorId ?? row.name} row={row} />)
          )}
        </Panel>
      )}
    </div>
  );
}

function ReadingRow({ row }: { row: LiveRow }) {
  const link = linkView(row.link);
  const engine = engineView(row.rpm, row.rpmQuality);
  const freshness = storedFreshness(row.updatedAt, Date.now());
  const heading = row.generatorId ? (
    <Link to={`/generators/${row.generatorId}`}>{row.name}</Link>
  ) : (
    row.name
  );
  return (
    <article className={`reading-card${freshness.stale ? " is-stale" : ""}`}>
      <h2>{heading}</h2>
      <div className="status-row">
        <StatusMark tone={link.tone}>{link.label}</StatusMark>
        <StatusMark tone={engine.tone}>{engine.label}</StatusMark>
        <StatusMark
          tone={freshness.stale ? "warn" : freshness.state === "fresh" ? "ok" : "offline"}
        >
          {freshness.state === "fresh" ? "Fresh" : freshness.state === "stale" ? "Stale" : "Missing"}
        </StatusMark>
      </div>
      <p className="meta">
        {freshness.label}
        {row.alarmCount === null ? "" : ` · alarms ${row.alarmCount}`}
      </p>
      {row.updatedAt == null ? (
        <EmptyState title="No sample" body="Waiting for a stored reading." />
      ) : (
        <div className="metric-grid metric-grid-primary">
          <Metric
            label="Battery"
            value={formatReading(storedReading(row.batteryV, row.batteryQuality, "V"))}
          />
          <Metric
            label="RPM"
            value={formatReading(storedReading(row.rpm, row.rpmQuality, "rpm"))}
          />
          <Metric
            label="Hz"
            value={formatReading(storedReading(row.frequencyHz, row.frequencyQuality, "Hz"))}
          />
          <Metric
            label="L1 V"
            value={formatReading(storedReading(row.voltageL1, row.voltageQuality, "V"))}
          />
          <Metric
            label="kW"
            value={formatReading(storedReading(row.powerKw, row.powerQuality, "kW"))}
          />
        </div>
      )}
      {row.generatorId ? (
        <p className="meta">
          <Link to={`/generators/${row.generatorId}/trends`}>Trends</Link>
        </p>
      ) : null}
    </article>
  );
}
