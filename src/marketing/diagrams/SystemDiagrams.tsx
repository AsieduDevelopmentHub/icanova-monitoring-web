import { useEffect, useId, useState, type ReactNode } from "react";

const COPPER = "#a8754d";
const STEEL = "#637b83";
const NAVY = "#263746";
const GRAPHITE = "#111820";
const SILVER = "#b8babc";
const INFO = "#477ca8";
const OK = "#24845b";
const WARN = "#d18a26";

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

function useMark(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, "")}`;
}

function Packet({
  path,
  dur,
  begin = "0s",
  color,
  reduce,
}: {
  path: string;
  dur: string;
  begin?: string;
  color: string;
  reduce: boolean;
}) {
  if (reduce) return null;
  return (
    <g className="mkt-diagram-packet">
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
      <circle r="8" fill={color} opacity="0.24" />
      <circle r="5" fill={color} />
    </g>
  );
}

function DiagramStage({ children, id }: { children: ReactNode; id: string }) {
  return (
    <figure className="mkt-diagram" aria-hidden="true">
      <div className="mkt-diagram-stage">
        <svg
          className="mkt-diagram-svg"
          viewBox="0 0 560 320"
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
        >
          <WashDefs id={id} />
          <Grid id={id} />
          {children}
        </svg>
      </div>
    </figure>
  );
}

function Grid({ id }: { id: string }) {
  return (
    <g className="mkt-diagram-grid" stroke="#d8d9d7" strokeWidth="1">
      <rect width="560" height="320" fill={`url(#${id}-wash)`} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={`v${i}`} x1={28 + i * 46} y1="18" x2={28 + i * 46} y2="302" />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`h${i}`} x1="28" y1={18 + i * 47} x2="532" y2={18 + i * 47} />
      ))}
    </g>
  );
}

function WashDefs({ id, dark }: { id: string; dark?: boolean }) {
  return (
    <defs>
      <linearGradient id={`${id}-line`} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={COPPER} stopOpacity="0.18" />
        <stop offset="50%" stopColor={COPPER} stopOpacity="0.92" />
        <stop offset="100%" stopColor={STEEL} stopOpacity="0.28" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={COPPER} stopOpacity="0.5" />
        <stop offset="100%" stopColor={COPPER} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-wash`} x1="0%" y1="0%" x2="100%" y2="100%">
        {dark ? (
          <>
            <stop offset="0%" stopColor="#18222c" />
            <stop offset="100%" stopColor="#111820" />
          </>
        ) : (
          <>
            <stop offset="0%" stopColor="#f7f5f1" />
            <stop offset="100%" stopColor="#efece6" />
          </>
        )}
      </linearGradient>
    </defs>
  );
}

function Node({
  x,
  y,
  label,
  sub,
  fill = COPPER,
  r = 10,
  glowId,
}: {
  x: number;
  y: number;
  label: string;
  sub?: string;
  fill?: string;
  r?: number;
  glowId: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="24" fill={`url(#${glowId})`} className="mkt-diagram-glow" />
      <circle r={r} fill={fill} stroke={SILVER} strokeWidth="1.6" />
      <text className="mkt-diagram-label" x="0" y="34" textAnchor="middle">
        {label}
      </text>
      {sub ? (
        <text className="mkt-diagram-sub" x="0" y="50" textAnchor="middle">
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Chip({
  x,
  y,
  w = 124,
  label,
  led = OK,
  delay = "0s",
}: {
  x: number;
  y: number;
  w?: number;
  label: string;
  led?: string;
  delay?: string;
}) {
  const reduce = usePrefersReducedMotion();
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect className="mkt-diagram-chip" width={w} height="32" rx="8" />
      <circle className="mkt-diagram-led" cx="16" cy="16" r="4.4" fill={led}>
        {reduce ? null : (
          <animate attributeName="opacity" values="0.35;1;0.35" dur="1.6s" begin={delay} repeatCount="indefinite" />
        )}
      </circle>
      <text className="mkt-diagram-chip-text" x="30" y="21">
        {label}
      </text>
    </g>
  );
}

/** Three independent honesty columns — they never merge. */
export function HonestySignalsDiagram() {
  const id = useMark("hon");
  const reduce = usePrefersReducedMotion();
  const lanes = [
    { x: 100, label: "CLOUD", sub: "uplink", color: INFO, path: "M100 214 V62" },
    { x: 280, label: "MODBUS", sub: "serial", color: OK, path: "M280 214 V62" },
    { x: 460, label: "FRESH", sub: "sample age", color: COPPER, path: "M460 214 V62" },
  ];
  return (
    <DiagramStage id={id}>
      <text className="mkt-diagram-kicker" x="280" y="36" textAnchor="middle">
        INDEPENDENT SIGNALS
      </text>
      {lanes.map((lane) => (
        <g key={lane.label}>
          <path
            d={`M${lane.x} 214 V62`}
            fill="none"
            stroke={`url(#${id}-line)`}
            strokeWidth="2.8"
            className="mkt-diagram-dash"
          />
          <Packet path={lane.path} dur="3.6s" color={lane.color} reduce={reduce} />
          <Node x={lane.x} y={214} label={lane.label} sub={lane.sub} fill={lane.color} glowId={`${id}-glow`} />
          <rect x={lane.x - 22} y="48" width="44" height="14" rx="3" fill={lane.color} opacity="0.9" />
        </g>
      ))}
      <text className="mkt-diagram-note" x="280" y="300" textAnchor="middle">
        online ≠ healthy poll ≠ fresh sample
      </text>
    </DiagramStage>
  );
}

/** Five real product surfaces around one org. */
export function SurfacesDiagram() {
  const id = useMark("surf");
  const reduce = usePrefersReducedMotion();
  const spokes = [
    { x: 90, y: 86, label: "GATEWAY", path: "M280 168 L90 86" },
    { x: 470, y: 86, label: "LIVE", path: "M280 168 L470 86" },
    { x: 90, y: 250, label: "ALARMS", path: "M280 168 L90 250" },
    { x: 470, y: 250, label: "HISTORY", path: "M280 168 L470 250" },
    { x: 280, y: 54, label: "SITES", path: "M280 168 V54" },
  ];
  return (
    <DiagramStage id={id}>
      <g fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.6">
        {spokes.map((s) => (
          <path key={s.label} d={s.path} className="mkt-diagram-dash" />
        ))}
      </g>
      {spokes.map((s, i) => (
        <Packet
          key={s.label}
          path={s.path}
          dur={`${4 + i * 0.4}s`}
          begin={`${i * 0.25}s`}
          color={i % 2 ? STEEL : COPPER}
          reduce={reduce}
        />
      ))}
      {spokes.map((s) => (
        <Node key={s.label} x={s.x} y={s.y} label={s.label} glowId={`${id}-glow`} />
      ))}
      <g transform="translate(280 168)">
        <circle r="36" fill={`url(#${id}-glow)`} className="mkt-diagram-glow" />
        <rect x="-22" y="-22" width="44" height="44" rx="9" fill={GRAPHITE} stroke={COPPER} strokeWidth="2" />
        <text className="mkt-diagram-label" x="0" y="48" textAnchor="middle">
          ORG
        </text>
      </g>
      <Chip x={206} y={272} w={148} label="SIGNED-IN APP" led={OK} />
    </DiagramStage>
  );
}

/** Org isolation with named permission keys. */
export function AccessModelDiagram() {
  const id = useMark("acc");
  const reduce = usePrefersReducedMotion();
  const keys = [
    { x: 86, y: 132, label: "VIEW" },
    { x: 196, y: 132, label: "ACK" },
    { x: 306, y: 132, label: "DEVICES" },
    { x: 86, y: 188, label: "NOTIFY" },
    { x: 196, y: 188, label: "EXPORT" },
    { x: 306, y: 188, label: "ROLES" },
  ];
  return (
    <DiagramStage id={id}>
      <rect x="58" y="58" width="372" height="214" rx="14" fill="none" stroke={NAVY} strokeWidth="1.6" />
      <text className="mkt-diagram-kicker" x="74" y="82">
        ORGANIZATION
      </text>
      {keys.map((k, i) => (
        <Chip
          key={k.label}
          x={k.x}
          y={k.y}
          w={108}
          label={k.label}
          led={i === 1 ? WARN : COPPER}
          delay={`${i * 0.2}s`}
        />
      ))}
      <path
        d="M430 168 H488"
        fill="none"
        stroke={STEEL}
        strokeWidth="2.4"
        strokeDasharray="6 8"
      />
      <g transform="translate(506 168)">
        <circle r="18" fill="none" stroke={STEEL} strokeWidth="2" />
        <text className="mkt-diagram-label" x="0" y="36" textAnchor="middle">
          OUTSIDE
        </text>
      </g>
      {!reduce ? (
        <g className="mkt-diagram-packet">
          <animateMotion dur="3.2s" repeatCount="indefinite" path="M488 168 H440" />
          <circle r="7" fill={STEEL} opacity="0.28" />
          <circle r="4.5" fill={STEEL} />
        </g>
      ) : null}
      <text className="mkt-diagram-note" x="244" y="292" textAnchor="middle">
        no org match · no data
      </text>
    </DiagramStage>
  );
}

/** Signed-in workspace tiles. */
export function AppMapDiagram() {
  const id = useMark("map");
  const tiles = [
    "DASHBOARD",
    "LIVE",
    "GATEWAYS",
    "SITES",
    "ALARMS",
    "REPORTS",
    "ADMIN",
    "EVENTS",
  ];
  return (
    <DiagramStage id={id}>
      <Chip x={28} y={28} w={128} label="SESSION ON" led={OK} />
      {tiles.map((label, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = 48 + col * 122;
        const y = 86 + row * 92;
        return (
          <g key={label} transform={`translate(${x} ${y})`}>
            <rect
              width="112"
              height="78"
              rx="12"
              fill={GRAPHITE}
              stroke={i === 4 ? COPPER : "#2a3642"}
              strokeWidth="1.8"
            />
            <circle cx="20" cy="20" r="5.2" fill={i === 4 ? WARN : COPPER} className="mkt-diagram-led" />
            <text className="mkt-diagram-chip-text" x="14" y="52">
              {label}
            </text>
          </g>
        );
      })}
    </DiagramStage>
  );
}

/** Cloud store vs on-device Soft-AP — only ingest crosses. */
export function BoundaryDiagram() {
  const id = useMark("bnd");
  const reduce = usePrefersReducedMotion();
  return (
    <DiagramStage id={id}>
      <rect x="36" y="56" width="200" height="208" rx="12" fill="none" stroke={STEEL} strokeWidth="1.5" />
      <rect x="324" y="56" width="200" height="208" rx="12" fill="none" stroke={NAVY} strokeWidth="1.5" />
      <text className="mkt-diagram-kicker" x="52" y="80">
        ON DEVICE
      </text>
      <text className="mkt-diagram-kicker" x="340" y="80">
        CLOUD STORE
      </text>
      {["BAUD", "PARITY", "GENCOMM"].map((item, i) => (
        <Chip key={item} x={58} y={108 + i * 42} w={156} label={item} led={STEEL} delay={`${i * 0.3}s`} />
      ))}
      {["ORG", "TELEMETRY", "ALARMS"].map((item, i) => (
        <Chip key={item} x={346} y={108 + i * 42} w={156} label={item} led={INFO} delay={`${0.15 + i * 0.3}s`} />
      ))}
      <path d="M236 160 H324" fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.8" />
      <Packet path="M236 160 H324" dur="2.8s" color={COPPER} reduce={reduce} />
      <text className="mkt-diagram-note" x="280" y="148" textAnchor="middle">
        HTTPS INGEST
      </text>
      <line x1="280" y1="56" x2="280" y2="264" stroke={SILVER} strokeWidth="1" strokeDasharray="3 7" />
    </DiagramStage>
  );
}

/** Four notification channels that fail independently. */
export function ChannelsDiagram() {
  const id = useMark("chn");
  const reduce = usePrefersReducedMotion();
  const arms = [
    { label: "IN-APP", x: 70, y: 70, color: OK },
    { label: "EMAIL", x: 490, y: 70, color: INFO },
    { label: "SMS", x: 70, y: 250, color: COPPER },
    { label: "PUSH", x: 490, y: 250, color: WARN },
  ];
  return (
    <DiagramStage id={id}>
      <g fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.6">
        {arms.map((a) => (
          <path key={a.label} className="mkt-diagram-dash" d={`M280 160 L${a.x} ${a.y}`} />
        ))}
      </g>
      {arms.map((a, i) => (
        <Packet
          key={a.label}
          path={`M280 160 L${a.x} ${a.y}`}
          dur={`${3.4 + i * 0.35}s`}
          begin={`${i * 0.2}s`}
          color={a.color}
          reduce={reduce}
        />
      ))}
      <g transform="translate(280 160)">
        <circle r="34" fill={`url(#${id}-glow)`} className="mkt-diagram-glow" />
        <rect x="-20" y="-20" width="40" height="40" rx="8" fill={GRAPHITE} stroke={COPPER} strokeWidth="2" />
        <text className="mkt-diagram-label" x="0" y="48" textAnchor="middle">
          ALARM
        </text>
      </g>
      {arms.map((a) => (
        <Node key={a.label} x={a.x} y={a.y} label={a.label} fill={a.color} glowId={`${id}-glow`} />
      ))}
      <text className="mkt-diagram-note" x="280" y="304" textAnchor="middle">
        delivery ≠ acknowledge
      </text>
    </DiagramStage>
  );
}

/** Bounded ~7 day retain window. */
export function RetentionDiagram() {
  const id = useMark("ret");
  const reduce = usePrefersReducedMotion();
  const days = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "NOW"];
  return (
    <DiagramStage id={id}>
      <text className="mkt-diagram-kicker" x="28" y="40">
        STORED WINDOW ~7d
      </text>
      <path d="M48 168 H512" fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.6" />
      {days.map((day, i) => {
        const x = 64 + i * 66;
        const h = 36 + (i % 3) * 22;
        return (
          <g key={day}>
            <rect
              x={x - 14}
              y={168 - h}
              width="28"
              height={h}
              rx="4"
              fill={i === 0 ? STEEL : COPPER}
              opacity={0.34 + i * 0.1}
            >
              {!reduce && i === 0 ? (
                <animate attributeName="opacity" values="0.55;0.08;0.55" dur="4s" repeatCount="indefinite" />
              ) : null}
            </rect>
            <text className="mkt-diagram-sub" x={x} y="198" textAnchor="middle">
              {day}
            </text>
          </g>
        );
      })}
      <Chip x={28} y={236} w={148} label="AGES OUT" led={STEEL} />
      <Chip x={196} y={236} w={168} label="EXPORT STORED" led={OK} delay="0.4s" />
      <text className="mkt-diagram-note" x="280" y="298" textAnchor="middle">
        no invented availability %
      </text>
    </DiagramStage>
  );
}

/** RS485 in, HTTPS out — cloud does not own the serial. */
export function EdgeRoleDiagram() {
  const id = useMark("role");
  const reduce = usePrefersReducedMotion();
  return (
    <DiagramStage id={id}>
      <Node x={86} y={160} label="CONTROLLER" sub="RS485" fill={OK} glowId={`${id}-glow`} />
      <path d="M110 160 H230" fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.8" className="mkt-diagram-dash" />
      <g transform="translate(280 160)">
        <circle r="42" fill={`url(#${id}-glow)`} className="mkt-diagram-glow" />
        <rect x="-52" y="-32" width="104" height="64" rx="12" fill={GRAPHITE} stroke={COPPER} strokeWidth="2" />
        <text className="mkt-diagram-chip-text" x="-32" y="6">
          EDGE GW
        </text>
      </g>
      <path d="M326 160 H470" fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.8" />
      <Node x={490} y={160} label="MONITORING" sub="HTTPS" fill={INFO} glowId={`${id}-glow`} />
      <Packet path="M110 160 H230" dur="2.6s" color={OK} reduce={reduce} />
      <Packet path="M326 160 H470" dur="3.1s" begin="0.5s" color={COPPER} reduce={reduce} />
      <Chip x={70} y={236} w={100} label="TX / RX" led={INFO} />
      <Chip x={196} y={236} w={132} label="ON DEVICE" led={COPPER} delay="0.35s" />
      <Chip x={352} y={236} w={132} label="REGISTER" led={OK} delay="0.7s" />
    </DiagramStage>
  );
}

/** Controller → buffer → ingest → operator. */
export function EdgePathDiagram() {
  const id = useMark("path");
  const reduce = usePrefersReducedMotion();
  const stops = [
    { x: 70, label: "POLL" },
    { x: 200, label: "HOLD" },
    { x: 330, label: "POST" },
    { x: 460, label: "SHOW" },
  ];
  return (
    <DiagramStage id={id}>
      <path
        d="M70 150 H460"
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2.8"
        className="mkt-diagram-dash"
      />
      <Packet path="M70 150 H460" dur="5.2s" color={COPPER} reduce={reduce} />
      {stops.map((s, i) => (
        <g key={s.label}>
          <Node x={s.x} y={150} label={s.label} fill={i === 3 ? INFO : COPPER} glowId={`${id}-glow`} />
          <text className="mkt-diagram-sub" x={s.x} y="196" textAnchor="middle">
            0{i + 1}
          </text>
        </g>
      ))}
      <text className="mkt-diagram-note" x="280" y="268" textAnchor="middle">
        buffer locally · never invent the gap
      </text>
    </DiagramStage>
  );
}

/** Soft-AP settings stay inside the enclosure. */
export function SoftApDiagram() {
  const id = useMark("sap");
  const reduce = usePrefersReducedMotion();
  return (
    <DiagramStage id={id}>
      <rect x="70" y="48" width="250" height="224" rx="14" fill="none" stroke={COPPER} strokeWidth="1.7" />
      <text className="mkt-diagram-kicker" x="88" y="74">
        ENCLOSURE
      </text>
      <Chip x={92} y={96} w={206} label="icanova-edge" led={OK} />
      <Chip x={92} y={138} w={206} label="SSID ICANOVA-…" led={INFO} delay="0.3s" />
      <Chip x={92} y={180} w={206} label="BAUD · PARITY" led={COPPER} delay="0.55s" />
      <text className="mkt-diagram-note" x="195" y="246" textAnchor="middle">
        not a remote serial console
      </text>
      <path d="M320 160 H430" fill="none" stroke={STEEL} strokeWidth="2.6" />
      <Node x={470} y={160} label="CLOUD" sub="ingest only" fill={INFO} glowId={`${id}-glow`} />
      <Packet path="M320 160 H430" dur="3s" color={COPPER} reduce={reduce} />
    </DiagramStage>
  );
}

/** Missing stays empty — never a calming zero. */
export function KnownUnknownDiagram() {
  const id = useMark("know");
  return (
    <DiagramStage id={id}>
      <rect x="48" y="64" width="210" height="192" rx="12" fill="none" stroke={OK} strokeWidth="1.5" />
      <rect x="302" y="64" width="210" height="192" rx="12" fill="none" stroke={STEEL} strokeWidth="1.5" />
      <text className="mkt-diagram-kicker" x="64" y="90">
        KNOWN
      </text>
      <text className="mkt-diagram-kicker" x="318" y="90">
        UNKNOWN
      </text>
      <text className="mkt-diagram-value" x="72" y="150">
        128.4 kW
      </text>
      <text className="mkt-diagram-sub" x="72" y="174">
        42s · stored
      </text>
      <rect x="326" y="128" width="162" height="44" rx="6" fill="none" stroke={SILVER} strokeDasharray="5 5" />
      <text className="mkt-diagram-note" x="407" y="156" textAnchor="middle">
        EMPTY
      </text>
      <Chip x={64} y={204} w={120} label="FRESH" led={OK} />
      <Chip x={318} y={204} w={168} label="NOT 0.0" led={WARN} delay="0.4s" />
    </DiagramStage>
  );
}
