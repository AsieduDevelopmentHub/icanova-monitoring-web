import { Link, useParams, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { id, storedReading } from "../fleet/access";
import {
  siteAlarmsPath,
  siteEventsPath,
  siteGatewayPath,
  siteGeneratorPath,
  siteMaintenancePath,
  sitePath,
  siteTrendsPath,
} from "../fleet/paths";
import { LiveGate } from "../fleet/scope";
import { SiteInfoSection } from "../sites/SiteInfoSection";
import { storedFreshness } from "../telemetry/freshness";
import { formatReading } from "../telemetry/readings";
import { engineView } from "../telemetry/fleetView";
import { EmptyState } from "../ui/EmptyState";
import { PageSkeleton } from "../ui/Skeleton";
import { StatusMark } from "../ui/StatusMark";
import { useLiveNow } from "../ui/useLiveNow";

type SiteSection = "overview" | "generators" | "gateways" | "info";

type SiteGeneratorRow = {
  generatorId: Id<"generators">;
  name: string;
  updatedAt: number | null;
  generatorRunning: boolean | null;
  generatorRunningSince: number | null;
  mainsAvailable: boolean | null;
  mainsAvailableSince: number | null;
  rpm: number | null;
  rpmQuality: string;
  voltageL1: number | null;
  voltageQuality: string;
  powerKw: number | null;
  powerQuality: string;
  powerFactorByPhase?: {
    L1: { value: number | null; source: "controller" | "calculated" | null };
    L2: { value: number | null; source: "controller" | "calculated" | null };
    L3: { value: number | null; source: "controller" | "calculated" | null };
  };
  frequencyHz: number | null;
  frequencyQuality: string;
  batteryV: number | null;
  batteryQuality: string;
  extra?: Record<string, number | null>;
  extraQuality?: Record<string, string>;
  monthlySourceMetrics?: {
    monthStart: number;
    coverageStartedAt: number;
    generatorEnergyKwh: number | null;
    generatorEnergySince: number | null;
    generatorRunHours: number | null;
    generatorRunHoursSince: number | null;
    mainsAvailableHours: number | null;
    mainsAvailableSince: number | null;
    mainsUsageHours: number | null;
    mainsUsageSince: number | null;
  } | null;
};

type PhaseReading = {
  phase: string;
  value: string;
  source?: "controller" | "calculated" | null;
};
type PhaseRow = {
  phase: string;
  voltage: string;
  current: string;
  powerFactor: string;
  powerFactorSource?: "controller" | "calculated" | null;
  power: string;
};

const SITE_SECTIONS: { id: SiteSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "generators", label: "Generators" },
  { id: "gateways", label: "Gateways" },
  { id: "info", label: "Site Info" },
];

/** Focused monitoring sections for one physical installation. */
export function SiteDesk() {
  const { siteId } = useParams();
  const [params] = useSearchParams();
  const requestedSection = params.get("section");
  const section: SiteSection =
    requestedSection === "location"
      ? "info"
      : SITE_SECTIONS.find((item) => item.id === requestedSection)?.id ?? "overview";

  return (
    <section className="page ops-page site-desk">
      <LiveGate emptyLayout="command">
        {(org) =>
          siteId ? (
            <DeskBody
              organizationId={org.organizationId}
              siteId={siteId as Id<"sites">}
              permissions={org.permissions}
              section={section}
            />
          ) : (
            <EmptyState title="Missing site" action={<Link to="/sites">Sites</Link>} />
          )
        }
      </LiveGate>
    </section>
  );
}

function DeskBody({
  organizationId,
  siteId,
  permissions,
  section,
}: {
  organizationId: string;
  siteId: Id<"sites">;
  permissions: readonly string[];
  section: SiteSection;
}) {
  const orgId = id<"organizations">(organizationId);
  const now = useLiveNow();
  const site = useQuery(api.sites.get, {
    organizationId: orgId,
    siteId,
  });
  const devices = useQuery(api.devices.list, {
    organizationId: orgId,
    siteId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const telemetry = useQuery(api.telemetry.currentForSite, {
    organizationId: orgId,
    siteId,
  });
  const healthSummary = useQuery(
    api.deviceHealth.siteHealthSummary,
    permissions.includes("view.dashboard") ? { organizationId: orgId, siteId } : "skip",
  );
  const canManageSite = permissions.includes("manage.sites");

  if (site === undefined) {
    return <PageSkeleton rows={6} label="Loading site" />;
  }
  if (site === null) {
    return <EmptyState title="Site not found" action={<Link to="/sites">Sites</Link>} />;
  }
  const gateways = Array.isArray(devices?.page) ? devices.page : [];
  const generatorRows = Array.isArray(telemetry?.rows)
    ? (telemetry.rows as SiteGeneratorRow[])
    : [];
  const latestUpdatedAt = Array.isArray(telemetry?.rows)
    ? telemetry.rows.reduce<number | null>((max, row) => {
        const at = row.updatedAt;
        if (at == null || !Number.isFinite(at)) {
          return max;
        }
        return max == null || at > max ? at : max;
      }, null)
    : null;
  const freshness = storedFreshness(latestUpdatedAt, Date.now());
  const reporting = generatorRows.filter((row) => row.updatedAt !== null).length;
  const running = generatorRows.filter(
    (row) => row.rpmQuality === "measured" && row.rpm !== null && row.rpm > 0,
  ).length;
  const updatedAtLabel =
    latestUpdatedAt == null
      ? telemetry === undefined
        ? "Loading latest sample"
        : "No telemetry yet"
      : new Date(latestUpdatedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "medium",
        });

  return (
    <div className="stack">
      <header className="page-identity site-detail-header">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{site.name}</h1>
          <div className="site-detail-meta">
            {site.code ? <span className="tech">{site.code}</span> : null}
            {site.region ? <span>{site.region}</span> : null}
          </div>
          <p className="meta site-detail-freshness">
            {latestUpdatedAt != null ? (
              <StatusMark tone={freshness.stale ? "warn" : "ok"}>
                {freshness.stale ? "Stale" : "Reporting"}
              </StatusMark>
            ) : null}
            <span>
              {latestUpdatedAt != null ? "Last sample " : ""}
              {updatedAtLabel}
            </span>
          </p>
        </div>
      </header>

      <nav className="site-detail-tabs" aria-label="Site sections">
        {SITE_SECTIONS.map((item) => (
          <Link
            key={item.id}
            to={
              item.id === "overview"
                ? sitePath(site.siteId)
                : `${sitePath(site.siteId)}?section=${item.id}`
            }
            className={section === item.id ? "site-detail-tab is-active" : "site-detail-tab"}
            aria-current={section === item.id ? "page" : undefined}
          >
            {item.label}
            {item.id === "generators" && telemetry?.capped ? <span>50+</span> : null}
            {item.id === "gateways" && devices?.isDone === false ? <span>20+</span> : null}
          </Link>
        ))}
      </nav>

      {section === "overview" ? (
        <div className="stack site-detail-section">
          <section className="ops-section" aria-labelledby="site-snapshot-title">
            <div className="ops-section-head">
              <h2 id="site-snapshot-title">Site snapshot</h2>
              <span className="meta">{freshness.label}</span>
            </div>
            {telemetry === undefined ? (
              <PageSkeleton rows={2} label="Loading site snapshot" />
            ) : (
              <div className="site-overview-metrics">
                <div>
                  <span className="meta">Generators</span>
                  <strong>{telemetry.capped ? `${generatorRows.length}+` : generatorRows.length}</strong>
                </div>
                <div>
                  <span className="meta">Reporting</span>
                  <strong>{reporting}</strong>
                </div>
                <div>
                  <span className="meta">Running</span>
                  <strong>{running}</strong>
                </div>
              </div>
            )}
            {telemetry?.capped ? (
              <p className="meta">Snapshot counts reflect the first 50 generators.</p>
            ) : null}
          </section>
          <SiteGenerators
            siteId={site.siteId}
            rows={generatorRows}
            loading={telemetry === undefined}
            capped={Boolean(telemetry?.capped)}
            variant="overview"
            now={now}
          />
          <section className="site-overview-links" aria-label="Site monitoring sections">
            <Link to={siteAlarmsPath(site.siteId)}>Alarms</Link>
            <Link to={siteEventsPath(site.siteId)}>Events</Link>
            <Link to={siteTrendsPath(site.siteId)}>Trends</Link>
            <Link to={siteMaintenancePath(site.siteId)}>Maintenance</Link>
          </section>
        </div>
      ) : null}

      {section === "generators" ? (
        <SiteGenerators
          siteId={site.siteId}
          rows={generatorRows}
          loading={telemetry === undefined}
          capped={Boolean(telemetry?.capped)}
          variant="list"
          now={now}
        />
      ) : null}

      {section === "gateways" ? (
        <section className="ops-section site-context-panel" aria-labelledby="site-gateway-title">
          <div className="ops-section-head">
            <h2 id="site-gateway-title">Gateways</h2>
            {devices?.isDone === false ? <span className="meta">First 20 shown</span> : null}
          </div>
          <div className="site-section-summary">
            <div>
              <span className="meta">Registered</span>
              <strong>{devices ? `${gateways.length}${devices.isDone ? "" : "+"}` : "—"}</strong>
            </div>
            <div>
              <span className="meta">Online</span>
              <strong>{healthSummary?.ready ? healthSummary.gatewayOnline : "—"}</strong>
            </div>
            <div>
              <span className="meta">Offline</span>
              <strong>{healthSummary?.ready ? healthSummary.gatewayOffline : "—"}</strong>
            </div>
            <div>
              <span className="meta">Unknown</span>
              <strong>{healthSummary?.ready ? healthSummary.gatewayUnknown : "—"}</strong>
            </div>
          </div>
          {devices === undefined ? (
            <PageSkeleton rows={2} label="Loading gateways" />
          ) : gateways.length === 0 ? (
            <p className="empty">No gateway linked to this site.</p>
          ) : (
            <>
              <ul className="site-gateway-list">
                {gateways.map(
                  (device: { _id: string; name: string; identity: string; lifecycle: string }) => {
                    const active = device.lifecycle === "active";
                    return (
                      <li key={device._id}>
                        <Link to={siteGatewayPath(site.siteId, device.identity || device._id)}>
                          <span className="site-gateway-identity">
                            <strong>{device.name}</strong>
                            <span className="meta tech">{device.identity}</span>
                          </span>
                          <span className="site-gateway-state">
                            <StatusMark tone={active ? "ok" : "neutral"}>
                              {active ? "Active" : device.lifecycle}
                            </StatusMark>
                            <span className="meta">Open monitoring</span>
                          </span>
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
              {devices.isDone === false ? (
                <p className="meta">Additional gateways are not shown on this page.</p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {section === "info" ? (
        <SiteInfoSection
          organizationId={orgId}
          site={site}
          canManage={canManageSite}
        />
      ) : null}
    </div>
  );
}

function SiteGenerators({
  siteId,
  rows,
  loading,
  capped,
  variant,
  now,
}: {
  siteId: Id<"sites">;
  rows: SiteGeneratorRow[];
  loading: boolean;
  capped: boolean;
  variant: "overview" | "list";
  now: number;
}) {
  const title = variant === "overview" ? "Generator readings" : "Generators";
  return (
    <section className="ops-section site-generators" aria-labelledby="site-generators-title">
      <div className="ops-section-head">
        <h2 id="site-generators-title">{title}</h2>
        <div className="site-section-heading-meta">
          {!loading ? <span className="meta">{rows.length}{capped ? "+" : ""} loaded</span> : null}
          {capped ? <span className="meta">First 50 shown</span> : null}
        </div>
      </div>
      {loading ? (
        <PageSkeleton rows={4} label="Loading generator readings" />
      ) : rows.length === 0 ? (
        <p className="empty">No generators linked to this site.</p>
      ) : (
        <>
          {capped ? <p className="meta">Additional generators are not shown on this page.</p> : null}
          {variant === "overview" ? (
            <div className="site-overview-generator-list">
              {rows.map((row) => (
                <SiteOverviewGenerator key={row.generatorId} siteId={siteId} row={row} now={now} />
              ))}
            </div>
          ) : (
            <div className="site-overview-generator-list">
              {rows.map((row) => (
                <SiteOverviewGenerator key={row.generatorId} siteId={siteId} row={row} detailed now={now} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SiteOverviewGenerator({
  siteId,
  row,
  detailed = false,
  now,
}: {
  siteId: Id<"sites">;
  row: SiteGeneratorRow;
  detailed?: boolean;
  now: number;
}) {
  const readings = generatorReadings(row);
  const engine = engineView(row.rpm, row.rpmQuality);
  const telemetryFresh = row.updatedAt != null && !storedFreshness(row.updatedAt, now).stale;
  const activeSource = telemetryFresh
    ? row.generatorRunning === true
      ? "generator"
      : row.mainsAvailable === true
        ? "mains"
        : null
    : null;
  const generatorRunningSince = telemetryFresh ? row.generatorRunningSince : null;
  const mainsAvailableSince = telemetryFresh ? row.mainsAvailableSince : null;
  const updatedAt = row.updatedAt == null
    ? "No sample recorded"
    : new Date(row.updatedAt).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  const mainsVoltageKeys = ["mainsL1", "mainsL2", "mainsL3"] as const;
  const phaseRows: PhaseRow[] = readings.voltage.map((voltage, index) => ({
    phase: voltage.phase,
    voltage:
      activeSource === "generator"
        ? voltage.value
        : activeSource === "mains"
          ? extraReading(row, mainsVoltageKeys[index] ?? "mainsL1", "")
          : "N/A",
    current: activeSource === "generator" ? readings.current[index].value : "N/A",
    powerFactor: activeSource === "generator" ? readings.powerFactor[index].value : "N/A",
    powerFactorSource: readings.powerFactor[index].source,
    power: activeSource === "generator" ? readings.power[index].value : "N/A",
  }));
  const hasContinuousRun =
    (row.generatorRunning === true && generatorRunningSince != null) ||
    (row.mainsAvailable === true && mainsAvailableSince != null);

  return (
    <article className="site-overview-generator">
      <header className="site-overview-generator-head">
        <div>
          <Link to={siteGeneratorPath(siteId, row.generatorId)}>{row.name}</Link>
          <span className="meta">Sample {updatedAt}</span>
          <div className="site-continuous-runs" aria-label="Continuous source runtime">
            {row.generatorRunning === true && generatorRunningSince != null ? (
              <span>Generator running · {continuousDuration(generatorRunningSince, now)}</span>
            ) : null}
            {row.mainsAvailable === true && mainsAvailableSince != null ? (
              <span>Mains available · {continuousDuration(mainsAvailableSince, now)}</span>
            ) : null}
            {!hasContinuousRun ? <span>N/A</span> : null}
          </div>
        </div>
        <StatusMark tone={engine.tone}>{engine.label}</StatusMark>
      </header>
      <div className="site-overview-generator-layout">
        <div className="site-reading-panels">
          <ReadingPanel
            title="Active power"
            tone="power"
            value={formatReading(storedReading(row.powerKw, row.powerQuality, "kW"))}
            note={`Frequency · ${formatReading(storedReading(row.frequencyHz, row.frequencyQuality, "Hz"))}`}
          />
          <ReadingPanel
            title="Fuel"
            tone="fuel"
            value={extraReading(row, "fuelPct", "%")}
            note={`Load · ${extraReading(row, "loadPct", "%")}`}
          />
          <ReadingPanel
            title="Battery"
            tone="battery"
            value={formatReading(storedReading(row.batteryV, row.batteryQuality, "V"))}
            note="DC voltage"
          />
          <ReadingPanel
            title="Engine"
            tone="engine"
            value={`HRM · ${extraReading(row, "engineHours", "h")}`}
            note={`RPM · ${formatReading(storedReading(row.rpm, row.rpmQuality, "rpm"))} · Starts · ${extraReading(row, "engineStarts", "")}`}
          />
        </div>
        <div className="site-phase-panel">
          <h3>Power parameters</h3>
          <div className="site-phase-table-wrap">
            <table className="data-table dense site-phase-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th className="num">V</th>
                  <th className="num">A</th>
                  <th className="num">PF</th>
                  <th className="num">kW</th>
                </tr>
              </thead>
              <tbody>
                {phaseRows.map((phase) => (
                  <tr key={phase.phase}>
                    <th scope="row">{phase.phase}</th>
                    <td className="num">{phase.voltage}</td>
                    <td className="num">{phase.current}</td>
                    <td
                      className="num"
                      title={phase.powerFactorSource === "calculated" ? "Calculated from active and apparent power" : undefined}
                    >
                      {phase.powerFactor}
                    </td>
                    <td className="num">{phase.power}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="site-phase-detail-link" to={siteGeneratorPath(siteId, row.generatorId)}>
            Generator details
          </Link>
        </div>
      </div>
      <MonthlyPowerSourceTable metrics={row.monthlySourceMetrics} />
      {detailed ? <SupportingReadings row={row} /> : null}
    </article>
  );
}

function MonthlyPowerSourceTable({
  metrics,
}: {
  metrics: SiteGeneratorRow["monthlySourceMetrics"];
}) {
  const monthLabel = metrics
    ? new Date(metrics.monthStart).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : new Date().toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

  return (
    <section className="site-monthly-power" aria-label="Monthly power-source metrics">
      <div className="site-monthly-power-heading">
        <h3>{monthLabel}</h3>
      </div>
      <div className="site-monthly-power-table-wrap">
        <table className="data-table dense site-monthly-power-table">
          <thead>
            <tr>
              <th>Power source</th>
              <th className="num">kWh</th>
              <th className="num">Run hours (h)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Generator</th>
              <td className="num">{monthlyValue(metrics?.generatorEnergyKwh)}</td>
              <td className="num">{monthlyValue(metrics?.generatorRunHours)}</td>
            </tr>
            <tr>
              <th scope="row">Mains</th>
              <td className="num">N/A</td>
              <td className="num">{monthlyValue(metrics?.mainsUsageHours)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function monthlyValue(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "N/A";
}

function continuousDuration(since: number, now: number): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - since) / 60_000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function ReadingPanel({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: "power" | "fuel" | "battery" | "engine";
}) {
  return (
    <section className={`site-reading-panel is-${tone}`}>
      <h3>{title}</h3>
      <strong className="tech">{value}</strong>
      <span>{note}</span>
    </section>
  );
}

function SupportingReadings({ row }: { row: SiteGeneratorRow }) {
  const candidates: { key: string; label: string; unit: string }[] = [
    { key: "voltageL12", label: "L1–L2 voltage", unit: "V" },
    { key: "voltageL23", label: "L2–L3 voltage", unit: "V" },
    { key: "voltageL31", label: "L3–L1 voltage", unit: "V" },
    { key: "mainsHz", label: "General frequency", unit: "Hz" },
    { key: "coolantC", label: "Coolant", unit: "°C" },
    { key: "oilTempC", label: "Oil temperature", unit: "°C" },
    { key: "oilPressureKpa", label: "Oil pressure", unit: "kPa" },
    { key: "chargeAltV", label: "Charge alternator", unit: "V" },
  ];
  const readings = candidates.filter(({ key }) => {
    const value = row.extra?.[key];
    return row.extraQuality?.[key] === "measured" && typeof value === "number" && Number.isFinite(value);
  });

  return (
    <section className="site-supporting-readings" aria-label="Additional measured readings">
      <h3>Additional measurements</h3>
      {readings.length > 0 ? (
        <dl>
          {readings.map(({ key, label, unit }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd className="tech">{extraReading(row, key, unit)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="meta">No additional measurements reported for this generator.</p>
      )}
    </section>
  );
}

function generatorReadings(row: SiteGeneratorRow): {
  voltage: PhaseReading[];
  current: PhaseReading[];
  powerFactor: PhaseReading[];
  power: PhaseReading[];
} {
  return {
    voltage: [
      { phase: "L1", value: formatReading(storedReading(row.voltageL1, row.voltageQuality, "")) },
      { phase: "L2", value: extraReading(row, "voltageL2", "") },
      { phase: "L3", value: extraReading(row, "voltageL3", "") },
    ],
    current: [
      { phase: "L1", value: extraReading(row, "currentL1", "") },
      { phase: "L2", value: extraReading(row, "currentL2", "") },
      { phase: "L3", value: extraReading(row, "currentL3", "") },
    ],
    powerFactor: (["L1", "L2", "L3"] as const).map((phase) => {
      const factor = row.powerFactorByPhase?.[phase];
      return {
        phase,
        value: formatReading(
          storedReading(factor?.value ?? null, factor?.value == null ? "unavailable" : "measured", ""),
        ),
        source: factor?.source,
      };
    }),
    power: [
      { phase: "L1", value: extraReading(row, "powerL1W", "", 1000) },
      { phase: "L2", value: extraReading(row, "powerL2W", "", 1000) },
      { phase: "L3", value: extraReading(row, "powerL3W", "", 1000) },
    ],
  };
}

function extraReading(
  row: SiteGeneratorRow,
  key: string,
  unit: string,
  divisor = 1,
): string {
  const value = row.extra?.[key] ?? null;
  const quality = row.extraQuality?.[key] ?? "unavailable";
  return formatReading(
    storedReading(value === null ? null : value / divisor, quality, unit),
  );
}
