/** Decorative IoT / circuit diagram for the auth brand pane. */
export function AuthTechDiagram() {
  return (
    <div className="auth-tech" aria-hidden="true">
      <svg className="auth-tech-svg" viewBox="0 0 640 720" role="presentation">
        <defs>
          <linearGradient id="authTechLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a8754d" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#a8754d" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#637b83" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="authTechGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a8754d" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#a8754d" stopOpacity="0" />
          </radialGradient>
          <filter id="authTechSoft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* Grid */}
        <g className="auth-tech-grid" stroke="#2a3642" strokeWidth="1">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`v${i}`} x1={40 + i * 46} y1="48" x2={40 + i * 46} y2="620" />
          ))}
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`h${i}`} x1="40" y1={48 + i * 46} x2="600" y2={48 + i * 46} />
          ))}
        </g>

        {/* Traces */}
        <g className="auth-tech-traces" fill="none" stroke="url(#authTechLine)" strokeWidth="1.75">
          <path d="M96 160 H220 V268 H320" />
          <path d="M320 268 H460 V180 H544" />
          <path d="M320 268 V400 H200 V480" />
          <path d="M320 400 H480 V520 H560" />
          <path d="M200 480 H120 V560" />
          <path d="M480 520 V580 H360" />
          <path className="auth-tech-trace-dash" d="M544 180 V120 H420" />
          <path className="auth-tech-trace-dash" d="M96 160 V100 H180" />
        </g>

        {/* Moving packets */}
        <g className="auth-tech-packets">
          <circle className="auth-tech-packet auth-tech-packet-a" r="3.5" fill="#a8754d">
            <animateMotion dur="4.8s" repeatCount="indefinite" path="M96 160 H220 V268 H320" />
          </circle>
          <circle className="auth-tech-packet auth-tech-packet-b" r="3" fill="#637b83">
            <animateMotion dur="5.6s" begin="0.8s" repeatCount="indefinite" path="M320 268 H460 V180 H544" />
          </circle>
          <circle className="auth-tech-packet auth-tech-packet-c" r="3" fill="#b8babc">
            <animateMotion dur="6.2s" begin="1.4s" repeatCount="indefinite" path="M320 268 V400 H200 V480" />
          </circle>
          <circle className="auth-tech-packet auth-tech-packet-d" r="2.8" fill="#a8754d">
            <animateMotion dur="5.2s" begin="0.4s" repeatCount="indefinite" path="M320 400 H480 V520 H560" />
          </circle>
        </g>

        {/* Nodes */}
        <g className="auth-tech-nodes">
          <g transform="translate(96 160)">
            <circle className="auth-tech-node-glow" r="18" fill="url(#authTechGlow)" />
            <circle className="auth-tech-node" r="7" />
            <text className="auth-tech-label" x="14" y="-12">
              EDGE
            </text>
          </g>
          <g transform="translate(320 268)">
            <circle className="auth-tech-node-glow auth-tech-node-glow-core" r="28" fill="url(#authTechGlow)" />
            <rect className="auth-tech-core" x="-16" y="-16" width="32" height="32" rx="6" />
            <text className="auth-tech-label" x="22" y="-18">
              GATEWAY
            </text>
          </g>
          <g transform="translate(544 180)">
            <circle className="auth-tech-node-glow" r="16" fill="url(#authTechGlow)" />
            <circle className="auth-tech-node auth-tech-node-cloud" r="6.5" />
            <text className="auth-tech-label" x="-52" y="-12">
              CLOUD
            </text>
          </g>
          <g transform="translate(200 480)">
            <circle className="auth-tech-node-glow" r="15" fill="url(#authTechGlow)" />
            <circle className="auth-tech-node auth-tech-node-modbus" r="6" />
            <text className="auth-tech-label" x="12" y="22">
              MODBUS
            </text>
          </g>
          <g transform="translate(480 520)">
            <circle className="auth-tech-node-glow" r="15" fill="url(#authTechGlow)" />
            <circle className="auth-tech-node auth-tech-node-site" r="6" />
            <text className="auth-tech-label" x="12" y="22">
              SITE
            </text>
          </g>
          <g transform="translate(560 520)">
            <circle className="auth-tech-node" r="4.5" />
          </g>
          <g transform="translate(120 560)">
            <circle className="auth-tech-node" r="4.5" />
          </g>
          <g transform="translate(360 580)">
            <circle className="auth-tech-node" r="4.5" />
          </g>
        </g>

        {/* Status chips */}
        <g className="auth-tech-chips" fontFamily="IBM Plex Mono, ui-monospace, monospace">
          <g transform="translate(420 100)">
            <rect className="auth-tech-chip" width="112" height="28" rx="6" />
            <circle className="auth-tech-led auth-tech-led-ok" cx="16" cy="14" r="3.5" />
            <text className="auth-tech-chip-text" x="28" y="18">
              LINK OK
            </text>
          </g>
          <g transform="translate(72 88)">
            <rect className="auth-tech-chip" width="100" height="28" rx="6" />
            <circle className="auth-tech-led auth-tech-led-tx" cx="16" cy="14" r="3.5" />
            <text className="auth-tech-chip-text" x="28" y="18">
              TX / RX
            </text>
          </g>
          <g transform="translate(460 560)">
            <rect className="auth-tech-chip" width="120" height="28" rx="6" />
            <circle className="auth-tech-led auth-tech-led-pulse" cx="16" cy="14" r="3.5" />
            <text className="auth-tech-chip-text" x="28" y="18">
              TELEMETRY
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
