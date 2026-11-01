import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { useConvexAuth } from "convex/react";
import { MarketingLayout } from "./MarketingLayout";

const CAPABILITIES = [
  {
    title: "Gateway connectivity",
    body: "Track cloud contact for iCanOva Edge Gateways without confusing it with Modbus health or sample freshness.",
  },
  {
    title: "Live equipment monitoring",
    body: "Inspect generator measurements over Soft-AP or cloud with clear units, timestamps and honest stale or missing states.",
  },
  {
    title: "Alarms & notifications",
    body: "Acknowledge and clear alarms with a preserved lifecycle. Optional email, SMS and browser push stay channel-independent.",
  },
  {
    title: "History, events & reports",
    body: "Review health transitions, audit activity and bounded exports — without inventing uptime percentages.",
  },
  {
    title: "Sites & infrastructure",
    body: "Organize gateways and generators by site with organization isolation and role-aware access.",
  },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Register gateways",
    body: "Cloud registration binds Edge Gateways to an organization — Soft-AP Modbus settings stay on the device.",
  },
  {
    n: "02",
    title: "Follow honesty signals",
    body: "Cloud contact, Modbus health and measurement freshness remain separate so operators trust what they see.",
  },
  {
    n: "03",
    title: "Respond to alarms",
    body: "Severity and lifecycle first. Acknowledgement does not invent a clear; cleared means the condition ended.",
  },
  {
    n: "04",
    title: "Export what is stored",
    body: "Bounded reports from stored operational data — not fabricated availability scores or energy totals.",
  },
] as const;

const TRUTHS = [
  {
    title: "Cloud is not Modbus",
    body: "Online uplink contact does not mean the serial link to the controller is healthy.",
  },
  {
    title: "Modbus is not freshness",
    body: "A working poll path can still leave a sample that is too old to act on.",
  },
  {
    title: "Missing is not zero",
    body: "Absent readings stay empty. The UI never invents a calming zero.",
  },
] as const;

const FAQ = [
  {
    q: "What does iCanOva Monitoring actually monitor?",
    a: "Connected iCanOva Edge Gateways, associated generators and site groupings — cloud contact, Modbus health, measurement freshness, alarms, events and bounded reports.",
  },
  {
    q: "Do I need an account to open the dashboard?",
    a: "Yes. The operational application — including dashboard, live readings, gateways and alarms — requires a signed-in account.",
  },
  {
    q: "Is Soft-AP configuration delivered from the cloud?",
    a: "No. Baud, parity, GenComm writes and Wi-Fi Soft-AP settings stay on the gateway. The cloud stores registration and telemetry — it does not push local Modbus config.",
  },
  {
    q: "Which notification channels exist?",
    a: "In-app notifications always. Email, SMS and optional browser push when configured — each channel stays independent.",
  },
] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className={`mkt-faq-item${open ? " open" : ""}`}>
      <button
        type="button"
        className="mkt-faq-q"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        <span className="mkt-faq-icon" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      <div id={panelId} className="mkt-faq-a" hidden={!open}>
        <p>{a}</p>
      </div>
    </div>
  );
}

function HeroProductFrame() {
  return (
    <div className="mkt-hero-visual" aria-hidden="true">
      <div className="mkt-frame mkt-frame-hero">
        <aside className="mkt-frame-side">
          <div className="mkt-frame-brand">
            <strong>iCanOva</strong>
            <span>Monitoring</span>
          </div>
          <div className="mkt-frame-nav">
            <span className="on">Dashboard</span>
            <span>Live readings</span>
            <span>Gateways</span>
            <span>Alarms</span>
            <span>Reports</span>
          </div>
        </aside>
        <div className="mkt-frame-main">
          <header className="mkt-frame-top">
            <span>Operations overview</span>
            <span className="mkt-pill">Demo composition</span>
          </header>
          <div className="mkt-frame-metrics">
            <div>
              <span>Cloud</span>
              <strong>Online</strong>
            </div>
            <div>
              <span>Modbus</span>
              <strong>OK</strong>
            </div>
            <div>
              <span>Freshness</span>
              <strong>Fresh</strong>
            </div>
            <div>
              <span>Attention</span>
              <strong>2 open</strong>
            </div>
          </div>
          <div className="mkt-frame-chart">
            <svg viewBox="0 0 320 120" preserveAspectRatio="none">
              <path
                className="mkt-chart-grid"
                d="M0 30 H320 M0 60 H320 M0 90 H320"
              />
              <path
                className="mkt-chart-line"
                d="M0 78 C40 70, 60 88, 90 62 C120 36, 150 48, 180 40 C210 32, 240 58, 270 46 C290 40, 310 28, 320 34"
              />
            </svg>
            <span>Illustrative trend — not live telemetry</span>
          </div>
          <div className="mkt-frame-table">
            <div className="mkt-frame-tr head">
              <span>Site</span>
              <span>Cloud</span>
              <span>Modbus</span>
              <span>Age</span>
            </div>
            <div className="mkt-frame-tr">
              <span>Plant North</span>
              <span>Online</span>
              <span>OK</span>
              <span>42s</span>
            </div>
            <div className="mkt-frame-tr">
              <span>Yard B</span>
              <span>Online</span>
              <span>Degraded</span>
              <span>3m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseFrames() {
  return (
    <div className="mkt-proof-grid">
      <article className="mkt-proof">
        <div className="mkt-frame mkt-frame-compact">
          <div className="mkt-frame-main">
            <header className="mkt-frame-top">
              <span>Alarm centre</span>
            </header>
            <div className="mkt-frame-table">
              <div className="mkt-frame-tr">
                <span className="mkt-sev">Transport</span>
                <span>Link DEGRADED</span>
              </div>
              <div className="mkt-frame-tr">
                <span className="mkt-sev">Transport</span>
                <span>Batch CRC fail</span>
              </div>
              <div className="mkt-frame-tr">
                <span className="mkt-sev warn">Controller</span>
                <span>Oil pressure low</span>
              </div>
            </div>
          </div>
        </div>
        <h3>Alarm centre</h3>
        <p>Active, acknowledged and cleared states with equipment context operators can trust.</p>
      </article>
      <article className="mkt-proof">
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
                <strong>Online</strong>
              </div>
              <div>
                <span>Config</span>
                <strong>On device</strong>
              </div>
            </div>
            <p className="mkt-frame-note">Cloud metadata is not Soft-AP delivery.</p>
          </div>
        </div>
        <h3>Gateway detail</h3>
        <p>Identity, connectivity and configuration boundaries made explicit.</p>
      </article>
      <article className="mkt-proof">
        <div className="mkt-frame mkt-frame-compact">
          <div className="mkt-frame-main">
            <header className="mkt-frame-top">
              <span>Live readings</span>
            </header>
            <div className="mkt-frame-metrics mkt-frame-metrics-3">
              <div>
                <span>kW</span>
                <strong>128.4</strong>
              </div>
              <div>
                <span>Hz</span>
                <strong>50.02</strong>
              </div>
              <div>
                <span>Oil °C</span>
                <strong>86</strong>
              </div>
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

export function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const exploreTo = isAuthenticated ? "/app" : "/auth/login";
  const exploreLabel = isAuthenticated ? "Open dashboard" : "Get started";

  useEffect(() => {
    document.title = "iCanOva Monitoring · Industrial operations visibility";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-hero" aria-labelledby="mkt-hero-title">
          <div className="mkt-hero-copy mkt-inner" data-mkt-reveal data-mkt-from="left">
            <p className="mkt-eyebrow">Intelligent industrial monitoring</p>
            <h1 id="mkt-hero-title">
              Connect your operations.
              <span className="mkt-hero-emphasis"> Understand everything.</span>
            </h1>
            <p className="mkt-lede">
              iCanOva Monitoring brings industrial equipment, Edge Gateways and operational data into
              one coherent experience — engineered for teams who need honest visibility, not vanity
              dashboards.
            </p>
            <div className="mkt-cta-row">
              <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to={exploreTo}>
                {exploreLabel}
              </Link>
              <Link className="mkt-btn mkt-btn-ghost mkt-btn-lg" to="/product">
                See the product
              </Link>
            </div>
          </div>
          <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
            <HeroProductFrame />
          </div>
        </section>

        <section className="mkt-stats" aria-label="Product facts" data-mkt-reveal data-mkt-from="fade">
          <div className="mkt-inner mkt-stats-row">
            <div>
              <strong>3</strong>
              <span>Honesty signals — cloud, Modbus, freshness</span>
            </div>
            <div>
              <strong>4</strong>
              <span>Notification channels when configured</span>
            </div>
            <div>
              <strong>~7d</strong>
              <span>Telemetry history retention (bounded)</span>
            </div>
          </div>
        </section>

        <section id="platform" className="mkt-section mkt-blend mkt-edge-wave">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Platform</p>
              <h2>Most monitoring flattens signals. iCanOva keeps them separate.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                Built for gateways, generators and site infrastructure. Cloud contact is not Modbus
                health. A stale sample is not a failed link. Operators see what is known — and what is
                not — so engineering and operations can act with confidence.
              </p>
              <p className="mkt-section-more">
                <Link className="mkt-text-link" to="/platform">
                  Platform overview
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section id="capabilities" className="mkt-section mkt-mist mkt-curve-shell">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Capabilities</p>
              <h2>What the platform actually does.</h2>
              <p className="mkt-copy mkt-copy-narrow">
                Every item maps to a real application surface. Sign-in is required before the
                dashboard opens.
              </p>
            </div>
            <ul className="mkt-cap-list">
              {CAPABILITIES.map((item, index) => (
                <li
                  key={item.title}
                  data-mkt-reveal
                  data-mkt-from={index % 2 === 0 ? "left" : "right"}
                  data-mkt-delay={String((index % 3) + 1)}
                >
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="product" className="mkt-section mkt-product-hardware mkt-edge-pop" aria-labelledby="mkt-product-title">
          <div className="mkt-inner mkt-hardware-layout">
            <div className="mkt-hardware-copy" data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Product</p>
              <h2 id="mkt-product-title">iCanOva Edge Gateway</h2>
              <p className="mkt-copy">
                Industrial enclosure for Modbus RTU edge connectivity — power, transmit and receive
                status at a glance. Concept casing for field mounting beside generator controllers.
              </p>
              <ul className="mkt-hardware-facts">
                <li>RS485 Modbus RTU</li>
                <li>Wide DC input</li>
                <li>Power · TX · RX indicators</li>
              </ul>
              <p className="mkt-section-more">
                <Link className="mkt-text-link" to="/product">
                  Edge Gateway details
                </Link>
              </p>
            </div>
            <figure className="mkt-hardware-figure" data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <div className="mkt-hardware-stage">
                <img
                  className="mkt-hardware-img"
                  src="/brand/icanova-edge-gateway.png?v=7"
                  alt="iCanOva Edge Gateway concept casing"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className="mkt-hardware-cap">Concept enclosure · not a retail render pack</figcaption>
            </figure>
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-edge-clip" aria-labelledby="mkt-platform-title">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Platform</p>
              <h2 id="mkt-platform-title">The interface is the proof.</h2>
              <p className="mkt-copy mkt-copy-narrow">
                Illustrative compositions of the authenticated application — refined for operational
                scanning, not decorative KPI mosaics.
              </p>
            </div>
            <div data-mkt-reveal data-mkt-from="clip" data-mkt-delay="1">
              <ShowcaseFrames />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-dark mkt-edge-cut" aria-labelledby="mkt-truth-title">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">Engineering honesty</p>
              <h2 id="mkt-truth-title">Built around how industrial links actually fail.</h2>
            </div>
            <div className="mkt-truths">
              {TRUTHS.map((item, index) => (
                <article
                  key={item.title}
                  data-mkt-reveal
                  data-mkt-from={index === 1 ? "up" : index === 0 ? "left" : "right"}
                  data-mkt-delay={String(index + 1)}
                >
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-blend mkt-edge-wave-tight">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Workflow</p>
              <h2>From registration to response.</h2>
            </div>
            <ol className="mkt-steps">
              {STEPS.map((step, index) => (
                <li
                  key={step.n}
                  data-mkt-reveal
                  data-mkt-from={index % 2 === 0 ? "left" : "right"}
                  data-mkt-delay={String((index % 2) + 1)}
                >
                  <span className="mkt-step-n">{step.n}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="faq" className="mkt-section mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-faq-layout">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Good to know</p>
              <h2>Frequently asked questions</h2>
            </div>
            <div className="mkt-faq" data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              {FAQ.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-close-band" id="about" data-mkt-reveal data-mkt-from="scale">
          <div className="mkt-inner mkt-close-card">
            <div>
              <p className="mkt-eyebrow">Next step</p>
              <h2>Bring industrial operations into focus.</h2>
              <p>
                Centralize gateway contact, equipment measurements and alarm response in one coherent
                monitoring experience.
              </p>
            </div>
            <div className="mkt-cta-row">
              <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to={exploreTo}>
                {exploreLabel}
              </Link>
              {!isAuthenticated ? (
                <Link className="mkt-btn mkt-btn-secondary mkt-btn-lg" to="/auth/login">
                  Sign in
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
