import { useEffect, useState } from "react";
import { fetchStatus } from "../api";
import type { GatewayStatus } from "../types";
import { Metric, formatMeasure } from "../ui/Metric";
import { StatusMark, statusToneForLink } from "../ui/StatusMark";

export function Monitor() {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await fetchStatus();
        if (!cancelled) {
          setStatus(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "fetch failed");
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const stale = (status?.ageMs ?? 0) > 8000;
  const mode = status?.opMode?.name ?? "—";
  const engine = status?.engStatus?.name ?? "—";
  const mock = import.meta.env.VITE_USE_MOCK === "1";

  return (
    <section className={`page${stale ? " stale" : ""}`}>
      <header className="page-head">
        <h1>{status?.headline ?? (error ? "Offline" : "…")}</h1>
        <p>
          {mode} · {engine}
        </p>
      </header>
      <div className="status-row">
        {status ? (
          <StatusMark tone={statusToneForLink(status.link)}>
            {status.link === "ok" ? "link ok" : status.link}
          </StatusMark>
        ) : null}
        {stale ? <StatusMark tone="warn">stale</StatusMark> : null}
        {mock ? <StatusMark tone="info">mock</StatusMark> : null}
      </div>
      <p className="meta">
        {status
          ? `slave ${status.slaveId} · ${status.wifiMode} ${status.wifiIp}` +
            (status.rssi ? ` · ${status.rssi} dBm` : "") +
            ` · age ${status.ageMs} ms` +
            (status.lastError ? ` · ${status.lastError}` : "")
          : "Waiting for /api/status…"}
      </p>
      {error ? <p className="err">{error}</p> : null}

      <div className="metric-grid">
        <Metric label="Battery" value={formatMeasure(status?.batteryV, 1)} unit="V" />
        <Metric label="Engine RPM" value={formatMeasure(status?.engRpm, 0)} />
        <Metric label="Frequency" value={formatMeasure(status?.genFreq, 1)} unit="Hz" />
        <Metric label="L1 voltage" value={formatMeasure(status?.genVan, 1)} unit="V" />
        <Metric label="L2 voltage" value={formatMeasure(status?.genVbn, 1)} unit="V" />
        <Metric label="L3 voltage" value={formatMeasure(status?.genVcn, 1)} unit="V" />
        <Metric label="L1 current" value={formatMeasure(status?.genIa, 1)} unit="A" />
        <Metric label="L2 current" value={formatMeasure(status?.genIb, 1)} unit="A" />
        <Metric label="L3 current" value={formatMeasure(status?.genIc, 1)} unit="A" />
        <Metric label="Total power" value={formatMeasure(status?.genPTotKw, 2)} unit="kW" />
        <Metric label="Load" value={formatMeasure(status?.genPctKw, 1)} unit="%" />
      </div>

      <section className="section">
        <h2>Active alarms</h2>
        {!status?.alarms?.length ? (
          <p className="empty">No active alarms</p>
        ) : (
          <ul className="alarms">
            {status.alarms.map((alarm) => (
              <li key={`${alarm.addr}-${alarm.slot}`}>
                <span className="state">{alarm.state}</span> — {alarm.name}{" "}
                <span className="meta">
                  @{alarm.addr}[{alarm.slot}]
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="footnote">
        This page polls GET /api/status every 2 s. That request does not change the ESP32
        Modbus interval.
      </p>
    </section>
  );
}
