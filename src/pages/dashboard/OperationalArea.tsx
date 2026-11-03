import { Link } from "react-router";
import { storedReading } from "../../fleet/access";
import { siteGeneratorPath } from "../../fleet/paths";
import { formatReading } from "../../telemetry/readings";
import { StatusMark } from "../../ui/StatusMark";
import { TechValue } from "../../ui/TechValue";
import { PowerFlowTwinLazy } from "../../viz/PowerFlowTwinLazy";
import { derivePowerFlow } from "../../viz/powerFlowModel";
import { GeneratorFleetViz } from "./GeneratorFleetViz";
import type { BoardRow } from "./types";
import { engineView, linkView, storedFreshness, twinFromRow, twinFromRows } from "./logic";
import { FleetHealth } from "./FleetHealth";

function extraNumber(row: BoardRow, key: string): number | null {
  const value = row.extra?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function OperationalArea({
  rows,
  primary,
  siteName,
  gatewayOnline,
  onSelect,
  siteId = null,
}: {
  rows: BoardRow[];
  primary: BoardRow | null;
  siteName: string;
  gatewayOnline: boolean | null;
  onSelect: (generatorId: string) => void;
  siteId?: string | null;
}) {
  const fleetTwin = twinFromRows(rows);
  const twinStatus = twinFromRow(primary, fleetTwin);
  const primaryFresh = primary ? storedFreshness(primary.updatedAt, Date.now()) : null;
  const primaryEngine = primary ? engineView(primary.rpm, primary.rpmQuality) : null;
  const primaryLink = primary ? linkView(primary.link) : null;
  const powerReading = primary
    ? storedReading(primary.powerKw, primary.powerQuality, "kW")
    : null;
  const fuel = primary ? extraNumber(primary, "fuelLevelPct") ?? extraNumber(primary, "fuel") : null;
  const loadPct = primary ? extraNumber(primary, "loadPct") ?? extraNumber(primary, "load") : null;
  const flow = derivePowerFlow({
    label: primary?.name ?? siteName,
    twinStatus,
    gatewayOnline,
    linkOk:
      primaryLink == null
        ? null
        : primaryLink.label === "Modbus ok"
          ? true
          : primaryLink.label === "Modbus fail"
            ? false
            : null,
    hasSample: primary?.updatedAt != null,
    stale: primaryFresh?.stale ?? false,
    engineRunning: primaryEngine?.label === "Running",
    powerKw:
      powerReading?.quality === "measured" && powerReading.value != null
        ? powerReading.value
        : null,
    voltageL1:
      primary?.voltageQuality === "measured" && primary.voltageL1 != null
        ? primary.voltageL1
        : null,
    batteryV:
      primary?.batteryQuality === "measured" && primary.batteryV != null
        ? primary.batteryV
        : null,
    frequencyHz:
      primary?.frequencyQuality === "measured" && primary.frequencyHz != null
        ? primary.frequencyHz
        : null,
  });

  return (
    <div className="cc-viz-grid">
      <div className="cc-ops-viz">
        <div className="cc-hero-row">
          <GeneratorFleetViz status={twinStatus} label={primary?.name ?? siteName} />
          <div className="cc-power-slot">
            <PowerFlowTwinLazy flow={flow} />
          </div>
        </div>
        {primary ? (
          <div className="metric-grid metric-grid-primary">
            <TechValue
              label="kW"
              value={formatReading(storedReading(primary.powerKw, primary.powerQuality, "kW"))}
            />
            <TechValue
              label="Hz"
              value={formatReading(
                storedReading(
                  primary.frequencyHz ?? null,
                  primary.frequencyQuality ?? "unavailable",
                  "Hz",
                ),
              )}
            />
            <TechValue
              label="RPM"
              value={formatReading(storedReading(primary.rpm, primary.rpmQuality, "rpm"))}
            />
            <TechValue
              label="L1 V"
              value={formatReading(
                storedReading(
                  primary.voltageL1 ?? null,
                  primary.voltageQuality ?? "unavailable",
                  "V",
                ),
              )}
            />
            <TechValue
              label="Battery"
              value={formatReading(
                storedReading(
                  primary.batteryV ?? null,
                  primary.batteryQuality ?? "unavailable",
                  "V",
                ),
              )}
            />
            <TechValue label="Fuel" value={fuel == null ? "—" : `${fuel} %`} />
            <TechValue label="Load" value={loadPct == null ? "—" : `${loadPct} %`} />
          </div>
        ) : null}
        {rows.length > 0 ? (
          <ul className="cc-equip-list">
            {rows.slice(0, 10).map((row) => {
              const engine = engineView(row.rpm, row.rpmQuality);
              const fresh = storedFreshness(row.updatedAt, Date.now());
              const selected = primary?.generatorId === row.generatorId;
              return (
                <li key={row.generatorId} className={selected ? "is-selected" : undefined}>
                  <button type="button" className="text-btn" onClick={() => onSelect(row.generatorId)}>
                    {row.name}
                  </button>
                  <StatusMark
                    tone={
                      engine.tone === "alarm"
                        ? "alarm"
                        : fresh.stale
                          ? "warn"
                          : engine.tone === "ok"
                            ? "ok"
                            : "offline"
                    }
                  >
                    {engine.label}
                  </StatusMark>
                  <Link
                    to={
                      (siteId ?? row.siteId)
                        ? siteGeneratorPath(siteId ?? row.siteId!, row.generatorId)
                        : "/sites"
                    }
                    className="cc-equip-open"
                  >
                    Open
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      <FleetHealth rows={rows} />
    </div>
  );
}
