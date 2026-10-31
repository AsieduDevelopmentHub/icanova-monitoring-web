import { Link, useParams } from "react-router";
import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import {
  formatReading,
  machineFlag,
  machinePose,
  type MachineFlag,
  type MachinePose,
} from "../telemetry/readings";
import { storedFreshness } from "../telemetry/freshness";
import { PowerFlowTwinLazy } from "../viz/PowerFlowTwinLazy";
import type { TwinStatus } from "../viz/CommandTwin";
import { derivePowerFlow } from "../viz/powerFlowModel";
import { SeriesChart } from "../ui/SeriesChart";
import { DataTable } from "../ui/DataTable";
import { formatStat, seriesStats } from "../telemetry/seriesStats";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { TechValue } from "../ui/TechValue";
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
  const twinStatus = twinStatusFromPose(pose, flag);
  const linkRaw = typeof current?.link === "string" ? current.link.toLowerCase() : "";
  const flow = derivePowerFlow({
    label: detail.name,
    twinStatus,
    gatewayOnline: null,
    linkOk: linkRaw.includes("fail")
      ? false
      : linkRaw.includes("ok") || linkRaw.includes("up")
        ? true
        : null,
    hasSample: current?.updatedAt != null,
    stale: freshness.stale,
    engineRunning: pose === "running",
    powerKw: power.quality === "measured" && power.value != null ? power.value : null,
    voltageL1: voltage.quality === "measured" && voltage.value != null ? voltage.value : null,
    batteryV: battery.quality === "measured" && battery.value != null ? battery.value : null,
    frequencyHz:
      frequency.quality === "measured" && frequency.value != null ? frequency.value : null,
  });

  return (
    <section className="page">
      <header className="page-head">
        <h1>{detail.name}</h1>
        <p>
          <Link to="/generators">Generators</Link>
        </p>
      </header>
      <div className="status-row">
        {freshness.stale ? <StatusMark tone="warn">stale</StatusMark> : null}
        <StatusMark tone={flag === "fault" ? "alarm" : flag === "warning" ? "warn" : "ok"}>
          {current?.link ?? "link —"}
        </StatusMark>
        <span className="meta">
          {freshness.label}
          {current?.alarmCount == null ? "" : ` · alarms ${current.alarmCount}`}
          {current?.mode ? ` · ${current.mode}` : ""}
        </span>
      </div>
      <div className="gen-flagship">
        <PowerFlowTwinLazy flow={flow} />
        <div className="stack">
          <div className="metric-grid metric-grid-primary">
            <TechValue label="RPM" value={formatReading(rpm)} />
            <TechValue label="Battery" value={formatReading(battery)} />
            <TechValue label="Hz" value={formatReading(frequency)} />
            <TechValue label="kW" value={formatReading(power)} />
            <TechValue label="L1 V" value={formatReading(voltage)} />
            <TechValue label="Load" value={formatReading(extraReading(current, "loadPct", "%"))} />
            <TechValue label="Fuel" value={formatReading(extraReading(current, "fuelPct", "%"))} />
            <TechValue
              label="Coolant"
              value={formatReading(extraReading(current, "coolantC", "°C"))}
            />
          </div>
          <GeneratorAlarms generatorId={generatorId} organizationId={detail.organizationId} />
        </div>
      </div>
      <details className="cc-more-metrics">
        <summary>More measurements</summary>
        <div className="metric-grid">
          <Metric label="L2 V" value={formatReading(extraReading(current, "voltageL2", "V"))} />
          <Metric label="L3 V" value={formatReading(extraReading(current, "voltageL3", "V"))} />
          <Metric label="L1 A" value={formatReading(extraReading(current, "currentL1", "A"))} />
          <Metric label="L2 A" value={formatReading(extraReading(current, "currentL2", "A"))} />
          <Metric label="L3 A" value={formatReading(extraReading(current, "currentL3", "A"))} />
          <Metric label="Oil kPa" value={formatReading(extraReading(current, "oilPressureKpa", "kPa"))} />
          <Metric label="Engine code" value={formatReading(extraReading(current, "engineStatus", ""))} />
          <Metric label="Control" value={formatReading(extraReading(current, "controlStatus", ""))} />
          <Metric label="Charger V" value={formatReading(extraReading(current, "chargeAltV", "V"))} />
          <Metric label="PF" value={formatReading(extraReading(current, "pfTot", ""))} />
          <Metric
            label="Source time"
            value={current?.sourceTime == null ? "—" : new Date(current.sourceTime).toISOString()}
          />
        </div>
      </details>
      <HistoryCharts generatorId={generatorId} />
      <div className="table-wrap">
        <table className="data-table dense">
          <caption>History buckets</caption>
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
    range === "hour" ? "1h" : range === "six" ? "6h" : range === "week" ? "7d" : "24h";
  return (
    <div className="stack">
      <FilterBar label="Range">
        <FilterSelect
          label="Range"
          value={range}
          onChange={(value) => setRange(RANGES.find((item) => item === value) ?? "day")}
          options={[
            { value: "hour", label: "1 hour" },
            { value: "six", label: "6 hours" },
            { value: "day", label: "24 hours" },
            { value: "week", label: "7 days" },
          ]}
        />
      </FilterBar>
      {series === undefined ? <p className="empty">Loading history.</p> : null}
      {series?.capped ? <p className="meta">Read limit reached.</p> : null}
      {series ? (
        <MetricStrip
          items={[
            { label: "RPM", unit: "rpm", points: series.rpm },
            { label: "Battery", unit: "V", points: series.battery },
            { label: "Frequency", unit: "Hz", points: series.frequency },
            { label: "Power", unit: "kW", points: series.power },
            { label: "L1 voltage", unit: "V", points: series.voltage },
          ]}
        />
      ) : null}
      <div className="cc-charts">
        <SeriesChart
          title="Power"
          unit="kW"
          points={series?.power ?? []}
          reduced={Boolean(series?.reduced.power)}
          caption={caption}
          height={240}
        />
        <SeriesChart
          title="Frequency"
          unit="Hz"
          points={series?.frequency ?? []}
          reduced={Boolean(series?.reduced.frequency)}
          caption={caption}
          height={240}
        />
        <SeriesChart
          title="RPM"
          unit="rpm"
          points={series?.rpm ?? []}
          reduced={Boolean(series?.reduced.rpm)}
          caption={caption}
          height={220}
        />
        <SeriesChart
          title="Battery"
          unit="V"
          points={series?.battery ?? []}
          reduced={Boolean(series?.reduced.battery)}
          caption={caption}
          height={220}
        />
        <SeriesChart
          title="L1 voltage"
          unit="V"
          points={series?.voltage ?? []}
          reduced={Boolean(series?.reduced.voltage)}
          caption={caption}
          height={220}
        />
      </div>
    </div>
  );
}

function MetricStrip({
  items,
}: {
  items: { label: string; unit: string; points: Parameters<typeof seriesStats>[0] }[];
}) {
  const rows = items.map((item) => {
    const stats = seriesStats(item.points);
    return {
      label: item.label,
      unit: item.unit,
      latest: formatStat(stats.latest),
      min: formatStat(stats.min),
      max: formatStat(stats.max),
      average: formatStat(stats.average),
      count: String(stats.count),
      buckets: String(stats.bucketsWithData),
    };
  });
  return (
    <DataTable
      caption="Measured statistics for the selected range"
      rows={rows}
      getRowKey={(row) => row.label}
      empty="No measured history in this range."
      columns={[
        { key: "label", header: "Measurement", render: (row) => row.label },
        { key: "unit", header: "Unit", render: (row) => row.unit },
        { key: "latest", header: "Latest", align: "right", render: (row) => row.latest },
        { key: "min", header: "Min", align: "right", render: (row) => row.min },
        { key: "max", header: "Max", align: "right", render: (row) => row.max },
        { key: "average", header: "Average", align: "right", render: (row) => row.average },
        { key: "count", header: "Readings", align: "right", render: (row) => row.count },
        { key: "buckets", header: "Buckets", align: "right", render: (row) => row.buckets },
      ]}
    />
  );
}

function twinStatusFromPose(pose: MachinePose, flag: MachineFlag): TwinStatus {
  if (flag === "fault") {
    return "fault";
  }
  if (flag === "warning") {
    return "warning";
  }
  if (pose === "running") {
    return "running";
  }
  if (pose === "offline") {
    return "offline";
  }
  if (pose === "stopped") {
    return "stopped";
  }
  return "unknown";
}
