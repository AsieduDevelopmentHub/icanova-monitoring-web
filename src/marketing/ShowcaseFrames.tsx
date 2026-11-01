import { useEffect, useState } from "react";

const ALARM_FRAMES = [
  [
    { sev: "Transport", sevClass: "mkt-sev", text: "Link DEGRADED" },
    { sev: "Transport", sevClass: "mkt-sev", text: "Batch CRC fail" },
    { sev: "Controller", sevClass: "mkt-sev warn", text: "Oil pressure low" },
  ],
  [
    { sev: "Transport", sevClass: "mkt-sev", text: "Link recovering" },
    { sev: "Transport", sevClass: "mkt-sev", text: "Batch CRC fail" },
    { sev: "Controller", sevClass: "mkt-sev warn", text: "Oil pressure 1.8 bar" },
  ],
  [
    { sev: "Transport", sevClass: "mkt-sev ok", text: "Link OK" },
    { sev: "Transport", sevClass: "mkt-sev", text: "Batch CRC fail" },
    { sev: "Controller", sevClass: "mkt-sev warn", text: "Oil pressure low" },
  ],
] as const;

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduce;
}

export function ShowcaseFrames() {
  const reduce = usePrefersReducedMotion();
  const [kw, setKw] = useState(128.4);
  const [hz, setHz] = useState(50.02);
  const [oil, setOil] = useState(86);
  const [age, setAge] = useState(12);
  const [cloud, setCloud] = useState<"Online" | "Degraded">("Online");
  const [alarmFrame, setAlarmFrame] = useState(0);
  const [trace, setTrace] = useState<number[]>([126, 128, 127, 129, 128.4, 130, 128.4]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setKw((prev) => {
        const next = round(Math.min(134, Math.max(122, prev + (Math.random() - 0.45) * 2.4)), 1);
        setTrace((points) => [...points.slice(-8), next]);
        return next;
      });
      setHz((prev) => round(Math.min(50.12, Math.max(49.88, prev + (Math.random() - 0.5) * 0.06)), 2));
      setOil((prev) => Math.min(91, Math.max(82, prev + Math.round((Math.random() - 0.5) * 2))));
      setAge((prev) => (prev >= 86 ? 8 : prev + 3 + Math.round(Math.random() * 4)));
      setCloud((prev) => (Math.random() > 0.82 ? (prev === "Online" ? "Degraded" : "Online") : prev));
      setAlarmFrame((prev) => (prev + 1) % ALARM_FRAMES.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [reduce]);

  const spark = trace
    .map((value, i) => {
      const x = (i / Math.max(1, trace.length - 1)) * 240;
      const y = 40 - ((value - 120) / 16) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const alarms = ALARM_FRAMES[alarmFrame];
  const fresh = age < 40;

  return (
    <div className="mkt-proof-grid">
      <article className="mkt-proof mkt-proof-live">
        <div className="mkt-frame mkt-frame-compact">
          <div className="mkt-frame-main">
            <header className="mkt-frame-top">
              <span>Alarm centre</span>
              <span className="mkt-proof-scan">Live</span>
            </header>
            <div className="mkt-frame-table">
              {alarms.map((row) => (
                <div
                  className={`mkt-frame-tr mkt-proof-row-live${
                    row.sevClass.includes("warn") || /DEGRADED|fail/i.test(row.text) ? " is-hot" : ""
                  }`}
                  key={`${row.sev}-${row.text}`}
                >
                  <span className={row.sevClass}>{row.sev}</span>
                  <span>{row.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <h3>Alarm centre</h3>
        <p>Active, acknowledged and cleared states with equipment context operators can trust.</p>
      </article>
      <article className="mkt-proof mkt-proof-live">
        <div className="mkt-frame mkt-frame-compact">
          <div className="mkt-frame-main">
            <header className="mkt-frame-top">
              <span>Gateway detail</span>
            </header>
            <div className="mkt-frame-metrics mkt-frame-metrics-3">
              <div>
                <span>Identity</span>
                <strong>GW-1842</strong>
              </div>
              <div>
                <span>Cloud</span>
                <strong className={cloud === "Online" ? "mkt-proof-online" : "mkt-proof-degraded"}>
                  {cloud}
                </strong>
              </div>
              <div>
                <span>Last ingest</span>
                <strong className="mkt-proof-readout">{age}s</strong>
              </div>
            </div>
            <p className="mkt-frame-note">Cloud metadata is not Soft-AP delivery.</p>
          </div>
        </div>
        <h3>Gateway detail</h3>
        <p>Identity, connectivity and configuration boundaries made explicit.</p>
      </article>
      <article className="mkt-proof mkt-proof-live">
        <div className="mkt-frame mkt-frame-compact">
          <div className="mkt-frame-main">
            <header className="mkt-frame-top">
              <span>Live readings</span>
              <span className={fresh ? "mkt-proof-fresh" : "mkt-proof-stale"}>{fresh ? "Fresh" : "Stale"}</span>
            </header>
            <div className="mkt-frame-metrics mkt-frame-metrics-3">
              <div>
                <span>kW</span>
                <strong className="mkt-proof-readout">{kw.toFixed(1)}</strong>
              </div>
              <div>
                <span>Hz</span>
                <strong className="mkt-proof-readout">{hz.toFixed(2)}</strong>
              </div>
              <div>
                <span>Oil °C</span>
                <strong className="mkt-proof-readout">{oil}</strong>
              </div>
            </div>
            <div className="mkt-proof-spark" aria-hidden="true">
              <svg viewBox="0 0 240 48" preserveAspectRatio="none">
                <path className="mkt-proof-spark-grid" d="M0 12 H240 M0 24 H240 M0 36 H240" />
                <polyline className="mkt-proof-spark-line" points={spark} />
              </svg>
            </div>
            <p className="mkt-frame-note">Units and timestamps — stale stays labeled.</p>
          </div>
        </div>
        <h3>Live readings</h3>
        <p>Stored measurements with honest empty and stale states — never decorative zeros.</p>
      </article>
    </div>
  );
}
