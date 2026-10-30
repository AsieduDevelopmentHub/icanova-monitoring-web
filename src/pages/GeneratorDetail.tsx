import { Link, useParams, useSearchParams } from "react-router";
import { ChartFrame } from "../ui/ChartFrame";
import { DataTable } from "../ui/DataTable";
import { Metric } from "../ui/Metric";
import { StatusMark } from "../ui/StatusMark";
import { demoFrames, demoSamples, samplesForMode } from "../telemetry/demoLog";
import { DEMO_GENERATOR_ID, seriesFor, type LogSample } from "../telemetry/logModel";
import {
  formatReading,
  machineFlag,
  machinePose,
  qualityLabel,
  readingOf,
  type Quality,
  type Reading,
} from "../telemetry/readings";
import { GENERATOR_SECTIONS, SELECTABLE_METRICS, sectionById } from "../telemetry/sections";
import { GeneratorScene } from "../viz/GeneratorScene";
import { ConvexGenerator } from "../fleet/ConvexGenerator";

function toneFor(quality: Quality): "ok" | "warn" | "alarm" | "offline" | "neutral" {
  if (quality === "measured") {
    return "neutral";
  }
  if (quality === "under-range" || quality === "over-range" || quality === "stale") {
    return "warn";
  }
  if (quality === "invalid") {
    return "alarm";
  }
  return "offline";
}

function queryFor(mode: string, metric: string): string {
  return `?mode=${encodeURIComponent(mode)}&metric=${encodeURIComponent(metric)}`;
}

function ReadingValue({ reading, selected }: { reading: Reading; selected: boolean }) {
  const measured = reading.quality === "measured" && reading.valueText !== null;
  const valueText = measured ? reading.valueText : null;
  return (
    <Metric
      selected={selected}
      label={reading.label}
      value={valueText ?? qualityLabel(reading.quality)}
      unit={valueText !== null ? reading.unit : undefined}
      note={
        valueText !== null
          ? "Measured · no clock in the log"
          : `${qualityLabel(reading.quality)} · not shown as zero`
      }
    />
  );
}

function TrendChart({
  points,
  unit,
}: {
  points: { index: number; value: number; text: string }[];
  unit: string;
}) {
  if (points.length === 0) {
    return null;
  }
  const width = 360;
  const height = 150;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const xFor = (index: number) => 28 + ((index - 1) / Math.max(demoSamples.length - 1, 1)) * (width - 40);
  const yFor = (value: number) => 16 + (1 - (value - min) / span) * (height - 40);
  const runs: { index: number; value: number }[][] = [];
  let run: { index: number; value: number }[] = [];
  let previous: number | null = null;
  for (const point of points) {
    if (previous !== null && point.index !== previous + 1) {
      runs.push(run);
      run = [];
    }
    run.push(point);
    previous = point.index;
  }
  if (run.length > 0) {
    runs.push(run);
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Demo log series, ${unit || "value"}`}>
      <title>Demo log series</title>
      <line x1="28" y1="16" x2="28" y2={height - 24} className="chart-axis" />
      <line x1="28" y1={height - 24} x2={width - 8} y2={height - 24} className="chart-axis" />
      <text x="2" y="20" className="chart-label">
        {max}
      </text>
      <text x="2" y={height - 26} className="chart-label">
        {min}
      </text>
      {runs.map((segment, index) => (
        <path
          key={index}
          className="chart-series"
          d={segment
            .map((point, pointIndex) => {
              const command = pointIndex === 0 ? "M" : "L";
              return `${command}${xFor(point.index).toFixed(1)} ${yFor(point.value).toFixed(1)}`;
            })
            .join(" ")}
        />
      ))}
      {points.map((point) => (
        <circle key={point.index} cx={xFor(point.index)} cy={yFor(point.value)} r="2.5" className="chart-point" />
      ))}
    </svg>
  );
}

function sampleHeading(sample: LogSample): string {
  return `Sample ${sample.index + 1}${sample.mode ? ` · ${sample.mode}` : ""}`;
}

export function GeneratorDetail() {
  const { id, section: sectionParam } = useParams();
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "history" ? "history" : "live";
  const metric = params.get("metric") || "Engine RPM";
  const section = sectionById(sectionParam);

  if (id !== DEMO_GENERATOR_ID) {
    if (import.meta.env.VITE_CONVEX_URL) {
      return <ConvexGenerator />;
    }
    return (
      <section className="page">
        <header className="page-head">
          <h1>Generator</h1>
          <p>That id is not in the demo log.</p>
        </header>
      </section>
    );
  }
  if (sectionParam && !section) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Unknown section</h1>
          <p>This detail page does not have that section.</p>
        </header>
      </section>
    );
  }

  const shown = samplesForMode(mode);
  const focus = shown[shown.length - 1];
  const pose = machinePose(focus ? readingOf(focus.readings, "Engine RPM") : null);
  const flag = machineFlag(focus?.link ?? null);
  const selectedReading = focus ? readingOf(focus.readings, metric) : null;
  const historyPoints = seriesFor(mode === "history" ? demoSamples : shown, metric);
  const omitted = demoSamples.length - seriesFor(demoSamples, metric).length;

  function setMode(next: "live" | "history") {
    const query = new URLSearchParams(params);
    query.set("mode", next);
    if (!query.get("metric")) {
      query.set("metric", metric);
    }
    setParams(query);
  }

  function setMetric(next: string) {
    const query = new URLSearchParams(params);
    query.set("metric", next);
    query.set("mode", mode);
    setParams(query);
  }

  const base = `/generators/${DEMO_GENERATOR_ID}`;

  return (
    <section className="page">
      <header className="page-head">
        <h1>Model {focus ? formatReading(readingOf(focus.readings, "Model Number")) : "—"}</h1>
        <p>
          {focus?.mode ?? "Mode unavailable"} · control status{" "}
          {focus ? formatReading(readingOf(focus.readings, "Control Unit Status")) : "—"} · serial{" "}
          {focus ? formatReading(readingOf(focus.readings, "Serial Number")) : "—"}
        </p>
      </header>
      <div className="notice fixture" role="note">
        <strong>Demo log, not a live connection.</strong> {focus?.sourceLabel}. Source time is empty
        because the terminal log has no clock. Live mode is the last sample in that file.
      </div>
      <div className="status-row">
        <StatusMark tone={pose === "running" ? "ok" : pose === "stopped" ? "offline" : "neutral"}>
          {pose}
        </StatusMark>
        <StatusMark tone={flag === "fault" ? "alarm" : flag === "warning" ? "warn" : "neutral"}>
          {flag === "none" ? "link clear" : `link ${flag}`}
        </StatusMark>
        {mode === "live" ? <StatusMark tone="info">live sample</StatusMark> : <StatusMark tone="info">history</StatusMark>}
      </div>

      <div className="filter-bar">
        <div className="mode-switch" role="group" aria-label="Demo view mode">
          <button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")}>
            Live
          </button>
          <button type="button" aria-pressed={mode === "history"} onClick={() => setMode("history")}>
            History
          </button>
        </div>
        <label className="filter-field grow">
          <span>Metric</span>
          <select value={metric} onChange={(event) => setMetric(event.target.value)}>
            {SELECTABLE_METRICS.map((item) => (
              <option key={item.label} value={item.label}>
                {item.section} — {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="section-nav" aria-label="Generator sections">
        <Link to={`${base}${queryFor(mode, metric)}`} className={section ? undefined : "on"} aria-current={section ? undefined : "page"}>
          Overview
        </Link>
        {GENERATOR_SECTIONS.map((item) => (
          <Link
            key={item.id}
            to={`${base}/${item.id}${queryFor(mode, metric)}`}
            className={section?.id === item.id ? "on" : undefined}
            aria-current={section?.id === item.id ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {!section ? (
        <>
          <GeneratorScene pose={pose} flag={flag} />
          <div className="metric-grid">
            <Metric label="Samples in view" value={String(shown.length)} note={mode === "live" ? "Last log sample" : "All excerpt samples"} />
            <Metric
              label={metric}
              value={
                selectedReading && selectedReading.quality === "measured" && selectedReading.valueText
                  ? selectedReading.valueText
                  : selectedReading
                    ? qualityLabel(selectedReading.quality)
                    : "—"
              }
              unit={
                selectedReading?.quality === "measured" ? selectedReading.unit : undefined
              }
              note="Selected metric"
            />
            <Metric label="Link" value={focus?.link ?? "—"} note="Separate from RPM" />
            <Metric label="Source time" value="—" note="Not in the log" />
          </div>
        </>
      ) : null}

      {section && section.labels.length > 0 && mode === "live" && focus ? (
        <div className="metric-grid">
          {section.labels.map((label) => (
            <ReadingValue
              key={label}
              reading={readingOf(focus.readings, label)}
              selected={label === metric}
            />
          ))}
        </div>
      ) : null}

      {section && section.labels.length > 0 && mode === "history" ? (
        <DataTable
          caption="History from the log excerpt. A quality word is not a zero."
          columns={[
            { key: "label", header: "Metric", render: (label: string) => label },
            ...demoSamples.map((sample) => ({
              key: `s${sample.index}`,
              header: sampleHeading(sample),
              render: (label: string) => {
                const reading = readingOf(sample.readings, label);
                return (
                  <span className={label === metric ? "is-selected-text" : undefined}>
                    <StatusMark tone={toneFor(reading.quality)}>{formatReading(reading)}</StatusMark>
                  </span>
                );
              },
            })),
          ]}
          rows={[...section.labels]}
          getRowKey={(label) => label}
          empty="No metrics in this section."
        />
      ) : null}

      {section?.id === "trends" ? (
        <ChartFrame
          title={metric}
          caption={
            mode === "live"
              ? "Live mode plots the last log sample only. It is not a subscription. Gaps are omitted, not drawn as zero."
              : `History plots measured samples only. ${omitted} log sample${omitted === 1 ? "" : "s"} omitted for this metric.`
          }
          empty={historyPoints.length === 0 ? "No measured value for this metric in the current mode." : undefined}
        >
          <TrendChart points={historyPoints} unit={selectedReading?.unit ?? ""} />
        </ChartFrame>
      ) : null}

      {section?.id === "alarms" ? (
        <div className="stack-copy">
          <p>
            The log does not contain an alarm acknowledgement record. Unsupported phases stay in
            Electrical as unimplemented. They are not listed here as zeros.
          </p>
          <ul className="alarms">
            {shown.flatMap((sample) => {
              const items: { key: string; text: string }[] = [];
              if (sample.alarmPage) {
                items.push({
                  key: `${sample.index}-page`,
                  text: `${sampleHeading(sample)}: alarm page ${sample.alarmPage}`,
                });
              }
              for (const reading of sample.readings) {
                if (reading.quality === "under-range" || reading.quality === "over-range" || reading.quality === "invalid" || reading.quality === "stale") {
                  items.push({
                    key: `${sample.index}-${reading.label}`,
                    text: `${sampleHeading(sample)}: ${reading.label} is ${qualityLabel(reading.quality)}`,
                  });
                }
              }
              return items;
            }).map((item) => (
              <li key={item.key}>{item.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section?.id === "communications" ? (
        <div className="stack-copy">
          <p>
            Frames are the diagnostic excerpt. TXN 43 prints CRC PASS and INVALID MODBUS FRAME
            together; both lines are kept. This is not a live Modbus monitor. The gateway page
            lists function code, address, CRC, latency, and retries.{" "}
            <Link to="/gateways/log-7320">Open diagnostics</Link>
          </p>
          <DataTable
            caption="Batch failures in the samples currently in view"
            columns={[
              { key: "sample", header: "Sample", render: (row: { sample: string }) => row.sample },
              { key: "address", header: "Address", align: "right", render: (row: { address: number }) => row.address },
              { key: "qty", header: "Qty", align: "right", render: (row: { qty: number }) => row.qty },
              { key: "result", header: "Result", render: (row: { resultName: string }) => row.resultName },
            ]}
            rows={shown.flatMap((sample) =>
              sample.batchFails.map((fail) => ({
                sample: sampleHeading(sample),
                address: fail.address,
                qty: fail.qty,
                resultName: fail.resultName,
              })),
            )}
            getRowKey={(row) => `${row.sample}-${row.address}`}
            empty={
              mode === "live"
                ? "No batch failures in the last sample. History includes earlier ones."
                : "No batch failures in this view."
            }
          />
          <DataTable
            caption="Diagnostic frames from the log excerpt"
            columns={[
              { key: "txn", header: "Txn", render: (frame) => frame.txn },
              { key: "request", header: "Request", render: (frame) => frame.request ?? "—" },
              { key: "crc", header: "CRC", render: (frame) => `${frame.crcResult ?? "—"} · rx ${frame.receivedCrc ?? "—"} · calc ${frame.calculatedCrc ?? "—"}` },
              { key: "result", header: "Result", render: (frame) => frame.result ?? "—" },
              { key: "ms", header: "First RX ms", align: "right", render: (frame) => frame.firstRxMs ?? "—" },
            ]}
            rows={demoFrames}
            getRowKey={(frame) => String(frame.txn)}
            empty="No frames in the excerpt."
          />
        </div>
      ) : null}

      {section?.id === "maintenance" ? (
        <p>
          Engine hours and starts above are the only maintenance figures in the log. Organization
          work records are kept separately on <Link to="/maintenance">Maintenance</Link>.
        </p>
      ) : null}
    </section>
  );
}
