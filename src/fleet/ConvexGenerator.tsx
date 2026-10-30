import { Link, useParams } from "react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { formatReading, machineFlag, machinePose } from "../telemetry/readings";
import { GeneratorScene } from "../viz/GeneratorScene";
import { storedReading, id } from "./access";
import { FleetBoundary } from "./boundary";

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
      <GeneratorScene pose={pose} flag={flag} />
      <div className="metric-grid">
        <Metric label="RPM" value={formatReading(rpm)} />
        <Metric label="Battery" value={formatReading(battery)} />
        <Metric label="Frequency" value={formatReading(frequency)} />
        <Metric label="Power" value={formatReading(power)} />
        <Metric label="L1 voltage" value={formatReading(voltage)} />
        <Metric
          label="Source time"
          value={current?.sourceTime == null ? "—" : String(current.sourceTime)}
        />
      </div>
      <p className="meta">
        Alarm count {current?.alarmCount == null ? "—" : String(current.alarmCount)}. Mode{" "}
        {current?.mode ?? "—"}. Link {current?.link ?? "—"}.
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
                    <td className="num">{bucket.bucketStart}</td>
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
