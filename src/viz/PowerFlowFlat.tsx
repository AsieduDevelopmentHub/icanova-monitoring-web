import {
  derivePowerFlow,
  flowPathColor,
  type PowerFlowInput,
  type PowerFlowState,
} from "./powerFlowModel";

/** 2D energy block diagram — reduced-motion / narrow viewport fallback. */
export function PowerFlowFlat({
  flow,
  input,
}: {
  flow?: PowerFlowState;
  input?: PowerFlowInput;
}) {
  const state = flow ?? (input ? derivePowerFlow(input) : null);
  if (!state) {
    return null;
  }
  const stroke = flowPathColor(state.flowMode);
  const dash = state.animateFlow ? "6 4" : state.flowMode === "static" ? "4 6" : undefined;
  const active = state.flowMode === "flowing";

  return (
    <div
      className="cc-twin-stage power-flow-flat"
      role="img"
      aria-label={`${state.label} · ${state.caption}`}
    >
      <svg className="power-flow-svg" viewBox="0 0 640 220" aria-hidden="true">
        <rect x="0" y="0" width="640" height="220" className="pf-bg" />

        <NodeBox
          x={24}
          y={78}
          w={88}
          h={52}
          label="Gateway"
          tone={state.gatewayOnline === false ? "offline" : "ok"}
        />
        <NodeBox
          x={160}
          y={78}
          w={88}
          h={52}
          label="Modbus"
          tone={state.linkOk === false ? "alarm" : state.linkOk === true ? "ok" : "idle"}
        />
        <NodeBox x={296} y={62} w={112} h={84} label="Generator" tone={statusTone(state)} primary />
        <NodeBox
          x={456}
          y={40}
          w={72}
          h={44}
          label="AC"
          tone={state.voltageL1 != null ? "ok" : "idle"}
          value={state.voltageL1 != null ? `${state.voltageL1.toFixed(0)} V` : "—"}
        />
        <NodeBox
          x={456}
          y={120}
          w={72}
          h={44}
          label="Battery"
          tone={state.batteryV != null ? "ok" : "idle"}
          value={state.batteryV != null ? `${state.batteryV.toFixed(1)} V` : "—"}
        />
        <NodeBox
          x={560}
          y={78}
          w={60}
          h={52}
          label="Load"
          tone={active ? "ok" : "idle"}
          value={state.powerKw != null ? `${state.powerKw.toFixed(1)}` : "—"}
        />

        <path d="M112 104 H160" className="pf-edge" stroke={stroke} strokeDasharray={dash} opacity={edgeOpacity(state)} />
        <path d="M248 104 H296" className="pf-edge" stroke={stroke} strokeDasharray={dash} opacity={edgeOpacity(state)} />
        <path
          d="M408 90 H456"
          className="pf-edge"
          stroke={stroke}
          strokeDasharray={active ? "6 4" : dash}
          opacity={edgeOpacity(state)}
        />
        <path
          d="M408 118 H492 V142"
          className="pf-edge"
          stroke={stroke}
          strokeDasharray={dash}
          opacity={edgeOpacity(state) * 0.85}
        />
        <path
          d="M528 62 H545 V104 H560"
          className="pf-edge"
          stroke={stroke}
          strokeDasharray={active ? "6 4" : dash}
          opacity={edgeOpacity(state)}
        />

        <text x={24} y={208} className="pf-caption">
          {state.label} · {state.caption}
        </text>
      </svg>
      <p className="cc-twin-caption">{state.caption}</p>
    </div>
  );
}

function edgeOpacity(state: PowerFlowState): number {
  if (state.flowMode === "blocked" || state.flowMode === "fault") return 0.35;
  if (state.flowMode === "stale") return 0.55;
  return 0.95;
}

function statusTone(state: PowerFlowState): "ok" | "alarm" | "warn" | "offline" | "idle" {
  if (state.twinStatus === "fault") return "alarm";
  if (state.twinStatus === "warning" || state.stale) return "warn";
  if (state.twinStatus === "offline") return "offline";
  if (state.engineRunning) return "ok";
  return "idle";
}

function NodeBox({
  x,
  y,
  w,
  h,
  label,
  value,
  tone,
  primary,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value?: string;
  tone: "ok" | "alarm" | "warn" | "offline" | "idle";
  primary?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width={w}
        height={h}
        rx={4}
        className={`pf-node pf-node-${tone}${primary ? " is-primary" : ""}`}
      />
      <text x={w / 2} y={value ? h / 2 - 4 : h / 2 + 4} textAnchor="middle" className="pf-node-label">
        {label}
      </text>
      {value ? (
        <text x={w / 2} y={h / 2 + 12} textAnchor="middle" className="pf-node-value">
          {value}
        </text>
      ) : null}
    </g>
  );
}
