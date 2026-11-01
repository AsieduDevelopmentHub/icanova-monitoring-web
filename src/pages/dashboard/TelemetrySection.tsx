import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { id, storedReading } from "../../fleet/access";
import { formatReading } from "../../telemetry/readings";
import { SectionHeader } from "../../ui/SectionHeader";
import { SeriesChart } from "../../ui/SeriesChart";
import { Skeleton } from "../../ui/Skeleton";
import { TechValue } from "../../ui/TechValue";
import type { BoardRow, ChartRange } from "./types";
import { CHART_RANGE_LABEL } from "./types";
import { storedFreshness } from "./logic";

export function TelemetrySection({
  primary,
  range,
  onRange,
}: {
  primary: BoardRow | null;
  range: ChartRange;
  onRange: (range: ChartRange) => void;
}) {
  if (!primary) {
    return (
      <section className="cc-telemetry" aria-label="Telemetry">
        <header className="cc-section-head">
          <h2 className="cc-section-title">Power / telemetry</h2>
        </header>
        <p className="empty">Select a generator to inspect live measurements.</p>
      </section>
    );
  }

  const fresh = storedFreshness(primary.updatedAt, Date.now());

  return (
    <section className="cc-telemetry" aria-label="Telemetry">
      <SectionHeader
        title={primary.name}
        actions={
          <div className="cc-telemetry-actions">
            <span className={`cc-freshness is-${fresh.state}`}>
              {fresh.label}
            </span>
            <div className="cc-range-toggle" role="group" aria-label="Chart range">
              {(Object.keys(CHART_RANGE_LABEL) as ChartRange[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={range === key ? "is-active" : undefined}
                  onClick={() => onRange(key)}
                >
                  {CHART_RANGE_LABEL[key]}
                </button>
              ))}
            </div>
            <Link to={`/generators/${primary.generatorId}/trends`}>Trends</Link>
          </div>
        }
      />
      <div className="metric-grid metric-grid-primary">
        <TechValue
          label="Power"
          value={formatReading(storedReading(primary.powerKw, primary.powerQuality, "kW"))}
        />
        <TechValue
          label="Frequency"
          value={formatReading(
            storedReading(primary.frequencyHz ?? null, primary.frequencyQuality ?? "unavailable", "Hz"),
          )}
        />
        <TechValue
          label="Voltage L1"
          value={formatReading(
            storedReading(primary.voltageL1 ?? null, primary.voltageQuality ?? "unavailable", "V"),
          )}
        />
        <TechValue
          label="Battery"
          value={formatReading(
            storedReading(primary.batteryV ?? null, primary.batteryQuality ?? "unavailable", "V"),
          )}
        />
        <TechValue
          label="RPM"
          value={formatReading(storedReading(primary.rpm, primary.rpmQuality, "rpm"))}
        />
      </div>
      <CommandCharts generatorId={primary.generatorId} range={range} />
    </section>
  );
}

function CommandCharts({ generatorId, range }: { generatorId: string; range: ChartRange }) {
  const series = useQuery(api.telemetry.series, {
    generatorId: id<"generators">(generatorId),
    range,
  });
  if (series === undefined) {
    return <Skeleton lines={4} />;
  }
  return (
    <div className="cc-charts">
      <SeriesChart
        title="Power"
        unit="kW"
        points={series.power}
        reduced={series.reduced.power}
        caption={CHART_RANGE_LABEL[range]}
        height={240}
      />
      <SeriesChart
        title="Voltage"
        unit="V"
        points={series.voltage}
        reduced={series.reduced.voltage}
        caption={CHART_RANGE_LABEL[range]}
        height={240}
      />
      <SeriesChart
        title="Frequency"
        unit="Hz"
        points={series.frequency}
        reduced={series.reduced.frequency}
        caption={CHART_RANGE_LABEL[range]}
        height={240}
      />
    </div>
  );
}
