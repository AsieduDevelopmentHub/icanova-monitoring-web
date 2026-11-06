import type { ReactNode } from "react";
import { StatusMark, type StatusTone } from "./StatusMark";

export type MonitoringNode = {
  label: string;
  value: string;
  tone: StatusTone;
};

export type MonitoringReading = {
  label: string;
  value: string;
};

export function MonitoringPath({
  nodes,
  readings,
  illustration,
}: {
  nodes: MonitoringNode[];
  readings: MonitoringReading[];
  illustration?: ReactNode;
}) {
  return (
    <section className="monitoring-path" aria-labelledby="monitoring-path-title">
      <header className="monitoring-path-head">
        <div>
          <h2 id="monitoring-path-title">Monitoring status</h2>
          <p>Gateway contact, controller link, and telemetry freshness are separate signals.</p>
        </div>
      </header>
      <div className="monitoring-path-content">
        <div className="monitoring-path-nodes" role="list" aria-label="Known monitoring relationships">
          {nodes.map((node) => (
            <div className="monitoring-path-node" role="listitem" key={node.label}>
              <span className="monitoring-path-node-label">{node.label}</span>
              <StatusMark tone={node.tone}>{node.value}</StatusMark>
            </div>
          ))}
        </div>
        {illustration ? (
          <aside className="monitoring-path-illustration" aria-label="Illustrative equipment model">
            <span>Equipment view · illustrative</span>
            {illustration}
          </aside>
        ) : null}
      </div>
      {readings.length > 0 ? (
        <dl className="monitoring-path-readings">
          {readings.map((reading) => (
            <div key={reading.label}>
              <dt>{reading.label}</dt>
              <dd>{reading.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
