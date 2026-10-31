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
import { FilterBar, FilterSearch } from "../ui/FilterBar";
import { Metric } from "../ui/Metric";
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
        <h1>Live readings</h1>
        <p>
          Stored telemetry from Convex for one site. Values are not polled from the gateway Soft-AP on
          this page. Stale means the stored sample aged out — not a fabricated live feed.
        </p>
      </header>
      <LiveGate>
        {(org) => (
          <SiteSelect organizationId={org.organizationId}>
            {(siteId, siteName) => (
              <SiteReadings organizationId={org.organizationId} siteId={siteId} siteName={siteName} />
            )}
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
    return <p className="empty">Loading current readings.</p>;
  }
  const loaded = (Array.isArray(data.rows) ? data.rows : []) as LiveRow[];
  return (
    <div className="stack">
      <div className="ops-banner">
        <p className="meta">
          Site <strong>{siteName}</strong>. Phase B/C load fields are not in the stored sample.
          {data.capped ? " First page of generators only." : ""}
        </p>
        <div className="ops-links">
          <Link to="/">Dashboard</Link>
          <Link to="/gateways">Gateways</Link>
          <Link to="/local/configure">Configure (local)</Link>
        </div>
      </div>
      {loaded.length === 0 ? (
        <p className="empty">No generators are registered on this site.</p>
      ) : (
        <>
          <FilterBar label="Filter readings">
            <FilterSearch
              label="Generator"
              value={query}
              onChange={setQuery}
              placeholder="Generator name"
            />
          </FilterBar>
          {rows.length === 0 ? (
            <p className="empty">No generators match this filter.</p>
          ) : (
            rows.map((row) => (
              <ReadingRow key={row.generatorId ?? row.name} row={row} />
            ))
          )}
        </>
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
    <section className={`section reading-card${freshness.stale ? " is-stale" : ""}`}>
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
        {row.updatedAt != null ? (
          <>
            {" · sample "}
            <span className="tech">{new Date(row.updatedAt).toISOString()}</span>
          </>
        ) : (
          " · no stored sample"
        )}
        {row.alarmCount === null ? "" : ` · alarm count ${row.alarmCount}`}
      </p>
      {row.updatedAt == null ? (
        <p className="empty">No measurement values are available until a sample is stored.</p>
      ) : (
        <div className="metric-grid">
          <Metric
            label="Battery"
            value={formatReading(storedReading(row.batteryV, row.batteryQuality, "V"))}
          />
          <Metric
            label="Engine RPM"
            value={formatReading(storedReading(row.rpm, row.rpmQuality, "rpm"))}
          />
          <Metric
            label="Frequency"
            value={formatReading(storedReading(row.frequencyHz, row.frequencyQuality, "Hz"))}
          />
          <Metric
            label="L1 voltage"
            value={formatReading(storedReading(row.voltageL1, row.voltageQuality, "V"))}
          />
          <Metric
            label="Total power"
            value={formatReading(storedReading(row.powerKw, row.powerQuality, "kW"))}
          />
        </div>
      )}
      {row.generatorId ? (
        <p className="meta">
          <Link to={`/generators/${row.generatorId}`}>Open generator</Link>
          {" · "}
          <Link to={`/generators/${row.generatorId}/trends`}>Trends</Link>
        </p>
      ) : null}
    </section>
  );
}
