import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";

const CommandTwin = lazy(() =>
  import("./CommandTwin").then((mod) => ({ default: mod.CommandTwin })),
);

type Props = ComponentProps<typeof CommandTwin>;

/** Lazy R3F twin with reduced-motion / narrow-viewport flat fallback. */
export function CommandTwinLazy(props: Props) {
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 799px)");
    const apply = () => {
      setReduced(motion.matches);
      setNarrow(width.matches);
    };
    apply();
    motion.addEventListener("change", apply);
    width.addEventListener("change", apply);
    return () => {
      motion.removeEventListener("change", apply);
      width.removeEventListener("change", apply);
    };
  }, []);

  if (reduced || narrow) {
    return (
      <div className="cc-twin-stage" role="img" aria-label={`${props.label} · ${props.status}`}>
        <svg className="flat-gen" viewBox="0 0 320 140" style={{ margin: "2rem auto", display: "block" }}>
          <rect x="16" y="78" width="288" height="10" className="flat-skid" />
          <rect x="36" y="36" width="168" height="42" className="flat-canopy" />
          <rect x="214" y="48" width="62" height="30" className="flat-alt" />
          <rect x="78" y="18" width="10" height="22" className="flat-stack" />
          <circle cx="250" cy="28" r="6" className="flat-lamp" />
          <text x="36" y="128" className="chart-label">
            {props.label} · {props.status}
          </text>
        </svg>
        <p className="cc-twin-caption">
          {reduced ? "Reduced motion — flat schematic" : "Compact view — flat schematic"}
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="cc-twin-stage">
          <p className="cc-twin-caption">Loading visualization…</p>
        </div>
      }
    >
      <CommandTwin {...props} />
    </Suspense>
  );
}
