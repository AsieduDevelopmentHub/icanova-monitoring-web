import { useEffect, useState, type ReactNode } from "react";

const ALARM_FRAMES = [
  [
    { sev: "Transport", sevClass: "mkt-sev", text: "Link DEGRADED" },
    { sev: "Transport", sevClass: "mkt-sev", text: "Batch CRC fail" },
    { sev: "Controller", sevClass: "mkt-sev warn", text: "Oil pressure low" },
  ],
  [
    { sev: "Transport", sevClass: "mkt-sev", text: "Link recovering" },
    { sev: "Transport", sevClass: "mkt-sev", text: "Batch CRC fail" },
        { sev: "Controller", sevClass: "mkt-sev warn", text: "Oil pressure 26 psi" },
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
  const [rpm, setRpm] = useState(1545);
  const [hz, setHz] = useState(50.02);
  const [oil, setOil] = useState(56);
  const [age, setAge] = useState(12);
  const [cloud, setCloud] = useState<"Online" | "Degraded">("Online");
  const [alarmFrame, setAlarmFrame] = useState(0);
  const [trace, setTrace] = useState<number[]>([1542, 1548, 1545, 1540, 1551, 1547, 1545]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setRpm((prev) => {
        const next = walk(prev, 1538, 1552, 5, 0);
        setTrace((points) => [...points.slice(-8), next]);
        return next;
      });
      setHz((prev) => walk(prev, 49.85, 50.16, 0.14, 2));
      setOil((prev) => walk(prev, 54, 58, 1.2, 0));
      setAge((prev) => (prev >= 86 ? 8 : prev + 3 + Math.round(Math.random() * 4)));
      setCloud((prev) => (Math.random() > 0.82 ? (prev === "Online" ? "Degraded" : "Online") : prev));
      setAlarmFrame((prev) => (prev + 1) % ALARM_FRAMES.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [reduce]);

  const spark = trace
    .map((value, i) => {
      const x = (i / Math.max(1, trace.length - 1)) * 240;
      const y = 40 - ((value - 1534) / 22) * 28;
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
              <Reading label="Identity">GW-1842</Reading>
              <div>
                <div className="mkt-metric-head">
                  <span>Cloud</span>
                </div>
                <strong className={cloud === "Online" ? "mkt-proof-online" : "mkt-proof-degraded"}>
                  {cloud}
                </strong>
              </div>
              <Reading label="Last ingest" unit="s">
                {age}
              </Reading>
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
              <Reading label="RPM" unit="rpm">
                {rpm}
              </Reading>
              <Reading label="Freq" unit="Hz">
                {hz.toFixed(2)}
              </Reading>
              <Reading label="Oil" unit="psi">
                {oil}
              </Reading>
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

function walk(prev: number, min: number, max: number, step: number, digits: number) {
  return round(Math.min(max, Math.max(min, prev + (Math.random() - 0.5) * step)), digits);
}

function Reading({
  label,
  unit,
  children,
  extra,
}: {
  label: string;
  unit?: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div>
      <div className="mkt-metric-head">
        <span>{label}</span>
        {unit ? <span className="mkt-metric-unit">{unit}</span> : null}
      </div>
      <strong className="mkt-proof-readout">{children}</strong>
      {extra}
    </div>
  );
}

export function HeroProductFrame() {
  const reduce = usePrefersReducedMotion();
  const [rpm, setRpm] = useState(1545);
  const [fuel, setFuel] = useState(75.4);
  const [voltage, setVoltage] = useState(401.2);
  const [hours, setHours] = useState(4138.81);
  const [starts] = useState(4185);
  const [battery, setBattery] = useState(13.6);
  const [hz, setHz] = useState(50.02);
  const [oil, setOil] = useState(56);
  const [coolant, setCoolant] = useState(86);
  const [charge, setCharge] = useState(14.2);
  const [l1a, setL1a] = useState(18.7);
  const [energy] = useState(19711.6);
  const [trace, setTrace] = useState<number[]>([1542, 1548, 1545, 1540, 1551, 1547, 1545]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setRpm((prev) => {
        const next = walk(prev, 1538, 1552, 5, 0);
        setTrace((points) => [...points.slice(-11), next]);
        return next;
      });
      setFuel((prev) => walk(prev, 74.6, 75.8, 0.35, 1));
      setVoltage((prev) => walk(prev, 398.4, 403.6, 0.6, 1));
      setBattery((prev) => walk(prev, 13.4, 13.8, 0.12, 1));
      setHz((prev) => walk(prev, 49.85, 50.16, 0.14, 2));
      setOil((prev) => walk(prev, 54, 58, 1.2, 0));
      setCoolant((prev) => walk(prev, 84, 91, 1.4, 0));
      setCharge((prev) => walk(prev, 14.1, 14.3, 0.08, 1));
      setL1a((prev) => walk(prev, 18.0, 20.0, 0.5, 1));
    }, 1100);
    const hoursId = window.setInterval(() => {
      setHours((prev) => round(prev + 0.01, 2));
    }, 36_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(hoursId);
    };
  }, [reduce]);

  const spark = trace
    .map((value, i) => {
      const x = (i / Math.max(1, trace.length - 1)) * 320;
      const y = 96 - ((value - 1534) / 22) * 70;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="mkt-hero-visual" aria-hidden="true">
      <div className="mkt-frame mkt-frame-hero">
        <aside className="mkt-frame-side">
          <div className="mkt-frame-brand">
            <strong>iCaNova</strong>
            <span>Monitoring</span>
          </div>
          <div className="mkt-frame-nav">
            <span>Dashboard</span>
            <span className="on">Live readings</span>
            <span>Gateways</span>
            <span>Alarms</span>
            <span>Reports</span>
          </div>
        </aside>
        <div className="mkt-frame-main">
          <header className="mkt-frame-top">
            <span>DSE 7320 · Auto</span>
            <span className="mkt-proof-scan">Running</span>
          </header>
          <div className="mkt-frame-metrics">
            <Reading label="RPM" unit="rpm">
              {rpm}
            </Reading>
            <Reading
              label="Fuel"
              unit="%"
              extra={
                <span className="mkt-fuel-track">
                  <span className="mkt-fuel-fill" style={{ width: `${fuel}%` }} />
                </span>
              }
            >
              {fuel.toFixed(1)}
            </Reading>
            <Reading label="L1-L2" unit="V">
              {voltage.toFixed(1)}
            </Reading>
            <Reading label="Coolant" unit="°C">
              {coolant}
            </Reading>
          </div>
          <div className="mkt-frame-chart">
            <svg viewBox="0 0 320 120" preserveAspectRatio="none">
              <path className="mkt-chart-grid" d="M0 30 H320 M0 60 H320 M0 90 H320" />
              <polyline className="mkt-chart-line" points={spark} />
            </svg>
            <span>Engine speed — live generator replay</span>
          </div>
          <div className="mkt-engine-grid">
            <Reading label="Hours" unit="h">
              {hours.toFixed(2)}
            </Reading>
            <Reading label="Starts">{starts}</Reading>
            <Reading label="Battery" unit="V">
              {battery.toFixed(1)}
            </Reading>
            <Reading label="Freq" unit="Hz">
              {hz.toFixed(2)}
            </Reading>
            <Reading label="Oil" unit="psi">
              {oil}
            </Reading>
            <Reading label="Charge alt" unit="V">
              {charge.toFixed(1)}
            </Reading>
            <Reading label="L1" unit="A">
              {l1a.toFixed(1)}
            </Reading>
            <Reading label="Energy" unit="kWh">
              {energy.toFixed(1)}
            </Reading>
          </div>
        </div>
      </div>
    </div>
  );
}
