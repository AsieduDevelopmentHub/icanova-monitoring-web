import { Link, useParams } from "react-router";
import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { formatReading, machineFlag, machinePose } from "../telemetry/readings";
import { storedFreshness } from "../telemetry/freshness";
import { GeneratorScene } from "../viz/GeneratorScene";
import { SeriesChart } from "../ui/SeriesChart";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { storedReading, id } from "./access";
import { FleetBoundary } from "./boundary";
import { GeneratorAlarms } from "./AlarmPanel";

export function ConvexGenerator() {
  const { id } = useParams();
  if (!id) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Generator</h1>
          <p>Missing id.</p>
        </header>
      </section>
    );
  }
  return (
    <FleetBoundary key={id}>
      <ConvexBody generatorId={id} />
    </FleetBoundary>
  );
}

function ConvexBody({ generatorId }: { generatorId: string }) {
  const detail = useQuery(api.generators.detail, { generatorId: id<"generators">(generatorId) });
  const history = usePaginatedQuery(
    api.telemetry.history,
    { generatorId: id<"generators">(generatorId) },
    { initialNumItems: 20 },
  );
  if (detail === undefined) {
    return (
      <section className="page">
        <p className="empty">Loading the generator.</p>
      </section>
    );
  }
  const current = detail.current;
  const rpm = storedReading(current?.rpm ?? null, current?.rpmQuality ?? "unavailable", "rpm");
  const battery = storedReading(
    current?.batteryV ?? null,
    current?.batteryQuality ?? "unavailable",
    "V",
  );
  const frequency = storedReading(
    current?.frequencyHz ?? null,
    current?.frequencyQuality ?? "unavailable",
    "Hz",
  );
  const power = storedReading(current?.powerKw ?? null, current?.powerQuality ?? "unavailable", "kW");
  const voltage = storedReading(
    current?.voltageL1 ?? null,
    current?.voltageQuality ?? "unavailable",
    "V",
  );
  const pose = machinePose(rpm);
  const flag = machineFlag(typeof current?.link === "string" ? current.link : null);
  const freshness = storedFreshness(current?.updatedAt ?? null, Date.now());

  return (
    <section className="page">
      <header className="page-head">
        <h1>{detail.name}</h1>
        <p>
          <Link to="/generators">Generators</Link>
        </p>
      </header>
      <div className="notice" role="note">
        <strong>Stored current reading.</strong> One document for this generator. History below is a
        page of 15-minute buckets, not the live poll. Engine, electrical, and mains sections remain
        on the demo log. This is not a Modbus session.
      </div>
      <div className="status-row">
        {freshness.stale ? <StatusMark tone="warn">stale</StatusMark> : null}
        <span className="meta">{freshness.label}</span>
      </div>
      <GeneratorScene pose={pose} flag={flag} />
      <div className="metric-grid">
        <Metric label="RPM" value={formatReading(rpm)} />
        <Metric label="Battery" value={formatReading(battery)} />
        <Metric label="Frequency" value={formatReading(frequency)} />
        <Metric label="Power" value={formatReading(power)} />
        <Metric label="L1 voltage" value={formatReading(voltage)} />
        <Metric label="L2 voltage" value={formatReading(extraReading(current, "voltageL2", "V"))} />
        <Metric label="L3 voltage" value={formatReading(extraReading(current, "voltageL3", "V"))} />
        <Metric label="L1 current" value={formatReading(extraReading(current, "currentL1", "A"))} />
        <Metric label="L2 current" value={formatReading(extraReading(current, "currentL2", "A"))} />
        <Metric label="L3 current" value={formatReading(extraReading(current, "currentL3", "A"))} />
        <Metric label="Load" value={formatReading(extraReading(current, "loadPct", "%"))} />
        <Metric label="Oil pressure" value={formatReading(extraReading(current, "oilPressureKpa", "kPa"))} />
        <Metric label="Coolant" value={formatReading(extraReading(current, "coolantC", "°C"))} />
        <Metric label="Fuel" value={formatReading(extraReading(current, "fuelPct", "%"))} />
        <Metric label="Engine status code" value={formatReading(extraReading(current, "engineStatus", ""))} />
        <Metric label="Engine status alt" value={formatReading(extraReading(current, "engineStatusAlt", ""))} />
        <Metric label="Control status" value={formatReading(extraReading(current, "controlStatus", ""))} />
        <Metric label="Charger voltage" value={formatReading(extraReading(current, "chargeAltV", "V"))} />
        <Metric label="L1 real power" value={formatReading(extraReading(current, "powerL1W", "W"))} />
        <Metric label="L2 real power" value={formatReading(extraReading(current, "powerL2W", "W"))} />
        <Metric label="L3 real power" value={formatReading(extraReading(current, "powerL3W", "W"))} />
        <Metric label="L1 apparent" value={formatReading(extraReading(current, "apparentL1Va", "VA"))} />
        <Metric label="L2 apparent" value={formatReading(extraReading(current, "apparentL2Va", "VA"))} />
        <Metric label="L3 apparent" value={formatReading(extraReading(current, "apparentL3Va", "VA"))} />
        <Metric label="Apparent total" value={formatReading(extraReading(current, "apparentTotVa", "VA"))} />
        <Metric label="L1 reactive" value={formatReading(extraReading(current, "reactiveL1Var", "VAr"))} />
        <Metric label="L2 reactive" value={formatReading(extraReading(current, "reactiveL2Var", "VAr"))} />
        <Metric label="L3 reactive" value={formatReading(extraReading(current, "reactiveL3Var", "VAr"))} />
        <Metric label="Reactive total" value={formatReading(extraReading(current, "reactiveTotVar", "VAr"))} />
        <Metric label="L1 power factor" value={formatReading(extraReading(current, "pfL1", ""))} />
        <Metric label="L2 power factor" value={formatReading(extraReading(current, "pfL2", ""))} />
        <Metric label="L3 power factor" value={formatReading(extraReading(current, "pfL3", ""))} />
        <Metric label="Power factor" value={formatReading(extraReading(current, "pfTot", ""))} />
        <Metric
          label="Source time"
          value={current?.sourceTime == null ? "—" : new Date(current.sourceTime).toISOString()}
        />
      </div>
      <p className="meta">
        Engine status and control status are controller codes. They are not running or stopped.
        Phase power, apparent power, reactive power, power factor, charger voltage, oil, coolant,
        and fuel stay unavailable until a sample includes them. A missing value is not zero.
      </p>
      <p className="meta">
        Reported alarm count {current?.alarmCount == null ? "—" : String(current.alarmCount)}. This
        number is not a list of generator alarm names. Mode {current?.mode ?? "—"}. Link{" "}
        {current?.link ?? "—"}. {freshness.label}. Link and freshness are separate.
      </p>
      <HistoryCharts generatorId={generatorId} />
      <GeneratorAlarms generatorId={generatorId} organizationId={detail.organizationId} />
      <p className="meta">
        Each row is one 15-minute bucket. Buckets are kept for 7 days. A missing measurement stays
        unavailable. The chart above does not connect across a gap.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <caption>History buckets for this generator</caption>
          <thead>
            <tr>
              <th>Bucket start</th>
              <th>RPM</th>
              <th>Power</th>
              <th>L1</th>
            </tr>
          </thead>
          <tbody>
            {history.results.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  {history.status === "LoadingFirstPage" ? "Loading history." : "No buckets stored."}
                </td>
              </tr>
            ) : (
              history.results.map((bucket) => {
                const bucketRpm = storedReading(bucket.rpm, bucket.rpmQuality, "rpm");
                const bucketPower = storedReading(bucket.powerKw, bucket.powerQuality, "kW");
                const bucketVoltage = storedReading(bucket.voltageL1, bucket.voltageQuality, "V");
                return (
                  <tr key={bucket._id}>
                    <td className="num">
                      {new Date(bucket.bucketStart).toISOString()}
                    </td>
                    <td>
                      <StatusMark tone={bucketRpm.quality === "measured" ? "neutral" : "warn"}>
                        {formatReading(bucketRpm)}
                      </StatusMark>
                    </td>
                    <td>{formatReading(bucketPower)}</td>
                    <td>{formatReading(bucketVoltage)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {history.status === "CanLoadMore" ? (
        <button type="button" onClick={() => history.loadMore(20)}>
          Load next page
        </button>
      ) : null}
    </section>
  );
}

const RANGES = ["hour", "six", "day", "week"] as const;
type RangeName = (typeof RANGES)[number];

function extraReading(
  current: { extra?: Record<string, number | null> | undefined; extraQuality?: Record<string, string> | undefined } | null,
  key: string,
  unit: string,
) {
  return storedReading(current?.extra?.[key] ?? null, current?.extraQuality?.[key] ?? "unavailable", unit);
}

function HistoryCharts({ generatorId }: { generatorId: string }) {
  const [range, setRange] = useState<RangeName>("day");
  const series = useQuery(api.telemetry.series, {
    generatorId: id<"generators">(generatorId),
    range,
  });
  const caption =
    range === "hour"
      ? "Last hour. Resolution is 15 minutes, so this range has at most four buckets."
      : range === "six"
        ? "Last 6 hours. Resolution is 15 minutes."
        : range === "week"
          ? "Last 7 days. Resolution is 15 minutes. Older buckets are deleted."
          : "Last 24 hours. Resolution is 15 minutes.";
  return (
    <div className="stack">
      <FilterBar label="History range">
        <FilterSelect
          label="Range"
          value={range}
          onChange={(value) => setRange(RANGES.find((item) => item === value) ?? "day")}
          options={[
            { value: "hour", label: "Last hour" },
            { value: "six", label: "Last 6 hours" },
            { value: "day", label: "Last 24 hours" },
            { value: "week", label: "Last 7 days" },
          ]}
        />
      </FilterBar>
      {series === undefined ? <p className="empty">Loading history.</p> : null}
      {series?.capped ? (
        <p className="meta">This range stopped at the read limit. It is not every stored bucket.</p>
      ) : null}
      <SeriesChart
        title="RPM"
        unit="rpm"
        points={series?.rpm ?? []}
        reduced={Boolean(series?.reduced.rpm)}
        caption={caption}
      />
      <SeriesChart
        title="Battery"
        unit="V"
        points={series?.battery ?? []}
        reduced={Boolean(series?.reduced.battery)}
        caption={caption}
      />
      <SeriesChart
        title="Frequency"
        unit="Hz"
        points={series?.frequency ?? []}
        reduced={Boolean(series?.reduced.frequency)}
        caption={caption}
      />
      <SeriesChart
        title="Power"
        unit="kW"
        points={series?.power ?? []}
        reduced={Boolean(series?.reduced.power)}
        caption={caption}
      />
      <SeriesChart
        title="L1 voltage"
        unit="V"
        points={series?.voltage ?? []}
        reduced={Boolean(series?.reduced.voltage)}
        caption={caption}
      />
    </div>
  );
}
