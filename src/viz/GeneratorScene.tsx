import { Component, useEffect, useState, type ReactNode } from "react";
import type { MachineFlag, MachinePose } from "../telemetry/readings";

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function FlatSchematic({ pose, flag }: { pose: MachinePose; flag: MachineFlag }) {
  return (
    <svg className="flat-gen" viewBox="0 0 320 140" role="img" aria-label={`Flat generator schematic, ${pose}`}>
      <title>{`Flat schematic, ${pose}`}</title>
      <rect x="16" y="78" width="288" height="10" className="flat-skid" />
      <rect x="36" y="36" width="168" height="42" className="flat-canopy" />
      <rect x="214" y="48" width="62" height="30" className="flat-alt" />
      <rect x="78" y="18" width="10" height="22" className="flat-stack" />
      <circle cx="250" cy="28" r="6" className="flat-lamp" />
      <text x="36" y="128" className="chart-label">
        {pose}
        {flag === "none" ? "" : ` · ${flag}`}
      </text>
    </svg>
  );
}

function SpatialSchematic({ pose }: { pose: MachinePose }) {
  return (
    <div className="scene-stage">
      <div className={`scene-rig pose-${pose}`}>
        <div className="gen-skid" />
        <div className="gen-canopy" />
        <div className={`gen-alt${pose === "running" ? " spin" : ""}`} />
        <div className="gen-stack" />
        <div className="gen-lamp" />
      </div>
    </div>
  );
}

export function GeneratorScene({ pose, flag }: { pose: MachinePose; flag: MachineFlag }) {
  const [reduced, setReduced] = useState(false);
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const showFlat = flat || reduced;
  const label = `Generator schematic, ${pose}${flag === "none" ? "" : `, ${flag}`}. Not a scanned model.`;

  return (
    <section className="scene" data-pose={pose} data-flag={flag} data-motion={reduced ? "reduce" : "ok"} aria-label={label}>
      <div className="scene-bar">
        <p>
          Schematic only. Pose follows measured RPM. Link is the lamp, not a substitute for RPM.
          {reduced ? " Reduced motion keeps the flat schematic." : ""}
        </p>
        <button type="button" aria-pressed={showFlat} onClick={() => setFlat((current) => !current)} disabled={reduced && !flat}>
          {showFlat ? "Spatial view" : "Flat schematic"}
        </button>
      </div>
      <SceneBoundary fallback={<FlatSchematic pose={pose} flag={flag} />}>
        {showFlat ? (
          <FlatSchematic pose={pose} flag={flag} />
        ) : (
          <SpatialSchematic pose={pose} />
        )}
      </SceneBoundary>
    </section>
  );
}
