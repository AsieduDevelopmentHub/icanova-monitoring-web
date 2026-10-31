import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { derivePowerFlow, type PowerFlowInput, type PowerFlowState } from "./powerFlowModel";
import { PowerFlowFlat } from "./PowerFlowFlat";

const PowerFlowTwin = lazy(() =>
  import("./PowerFlowTwin").then((mod) => ({ default: mod.PowerFlowTwin })),
);

type Props = {
  flow?: PowerFlowState;
  input?: PowerFlowInput;
};

/** Lazy R3F power-flow twin with reduced-motion / narrow flat SVG fallback. */
export function PowerFlowTwinLazy(props: Props) {
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const state = useMemo(
    () => props.flow ?? (props.input ? derivePowerFlow(props.input) : null),
    [props.flow, props.input],
  );

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

  if (!state) {
    return null;
  }

  if (reduced || narrow) {
    return <PowerFlowFlat flow={state} />;
  }

  return (
    <Suspense fallback={<PowerFlowFlat flow={state} />}>
      <PowerFlowTwin flow={state} />
    </Suspense>
  );
}
