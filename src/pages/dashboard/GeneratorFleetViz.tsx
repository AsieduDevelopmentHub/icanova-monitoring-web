import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { TwinStatus } from "../../viz/CommandTwin";

const CommandTwin = lazy(() =>
  import("../../viz/CommandTwin").then((mod) => ({ default: mod.CommandTwin })),
);

function FlatGenset({ status, label }: { status: TwinStatus; label: string }) {
  return (
    <div className="cc-twin-stage cc-twin-flat" role="img" aria-label={`${label} · ${status}`}>
      <svg viewBox="0 0 360 160" className="cc-flat-genset">
        <rect x="20" y="110" width="320" height="14" className="flat-skid" />
        <rect x="48" y="48" width="150" height="62" className="flat-canopy" />
        <rect x="210" y="58" width="78" height="48" className="flat-alt" />
        <rect x="28" y="52" width="22" height="54" className="flat-rad" />
        <rect x="90" y="28" width="12" height="24" className="flat-stack" />
        <rect x="160" y="98" width="70" height="18" className="flat-tank" />
        <circle cx="248" cy="42" r="7" className={`flat-lamp is-${status}`} />
        <text x="48" y="148" className="chart-label">
          {label} · {status}
        </text>
      </svg>
      <p className="cc-twin-caption">{label} · {status}</p>
    </div>
  );
}

class ErrorCatch extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Lazy 3D genset with flat fallback for reduced motion / errors. */
export function GeneratorFleetViz({ status, label }: { status: TwinStatus; label: string }) {
  const [flat, setFlat] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setFlat(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  if (flat || failed) {
    return <FlatGenset status={status} label={label} />;
  }

  return (
    <div className="cc-genset-viz">
      <Suspense fallback={<FlatGenset status={status} label={label} />}>
        <ErrorCatch onError={() => setFailed(true)}>
          <CommandTwin status={status} label={label} />
        </ErrorCatch>
      </Suspense>
      <button type="button" className="cc-viz-flat-btn text-btn" onClick={() => setFlat(true)}>
        Flat view
      </button>
    </div>
  );
}
