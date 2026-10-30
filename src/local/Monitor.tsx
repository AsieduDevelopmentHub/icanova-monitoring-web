import { useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { storedReading } from "../fleet/access";
import { LiveGate, SiteSelect } from "../fleet/scope";
import { engineView, linkView } from "../telemetry/fleetView";
import { storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";

type LiveRow = {
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
        <p>Stored telemetry from Convex for one site. This page does not call the gateway.</p>
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
  if (data === undefined) {
    return <p className="empty">Loading current readings.</p>;
  }
  const rows = (Array.isArray(data.rows) ? data.rows : []) as LiveRow[];
  return (
    <div className="stack">
      <p className="meta">Site {siteName}. Phase B and C, current, and load are not in the stored sample.</p>
      {rows.length === 0 ? (
        <p className="empty">No generators are registered on this site.</p>
      ) : (
        rows.map((row) => <ReadingRow key={row.name} row={row} />)
      )}
    </div>
  );
}

function ReadingRow({ row }: { row: LiveRow }) {
  const link = linkView(row.link);
  const engine = engineView(row.rpm, row.rpmQuality);
  const freshness = storedFreshness(row.updatedAt, Date.now());
  return (
    <section className="section">
      <h2>{row.name}</h2>
      <div className="status-row">
        <StatusMark tone={link.tone}>{link.label}</StatusMark>
        <StatusMark tone={engine.tone}>{engine.label}</StatusMark>
        {freshness.stale ? <StatusMark tone="warn">Stale</StatusMark> : null}
      </div>
      <p className="meta">
        {freshness.label}
        {row.alarmCount === null ? "" : ` · alarm count ${row.alarmCount}`}
      </p>
      <div className="metric-grid">
        <Metric label="Battery" value={formatReading(storedReading(row.batteryV, row.batteryQuality, "V"))} />
        <Metric label="Engine RPM" value={formatReading(storedReading(row.rpm, row.rpmQuality, "rpm"))} />
        <Metric label="Frequency" value={formatReading(storedReading(row.frequencyHz, row.frequencyQuality, "Hz"))} />
        <Metric label="L1 voltage" value={formatReading(storedReading(row.voltageL1, row.voltageQuality, "V"))} />
        <Metric label="Total power" value={formatReading(storedReading(row.powerKw, row.powerQuality, "kW"))} />
      </div>
    </section>
  );
}
