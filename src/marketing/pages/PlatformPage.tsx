import { useEffect } from "react";
import { Link } from "react-router";
import { useConvexAuth } from "convex/react";
import { MarketingLayout } from "../MarketingLayout";
import { PageClose } from "./PageClose";

const AREAS = [
  {
    title: "Dashboard",
    body: "Operations overview with cloud contact, Modbus health and freshness kept distinct.",
    to: "/app",
    label: "Dashboard",
  },
  {
    title: "Live readings",
    body: "Generator measurements with units, timestamps and honest stale or missing states.",
    to: "/local",
    label: "Live readings",
  },
  {
    title: "Gateways",
    body: "Identity and cloud connectivity without conflating serial health.",
    to: "/gateways",
    label: "Gateways",
  },
  {
    title: "Alarms",
    body: "Acknowledge and clear with a preserved lifecycle — acknowledgement is not a clear.",
    to: "/alarms",
    label: "Alarms",
  },
  {
    title: "Sites & generators",
    body: "Organize infrastructure by site with organization isolation and role-aware access.",
    to: "/sites",
    label: "Sites",
  },
  {
    title: "Reports & events",
    body: "Bounded exports and audit activity from stored Convex data — no invented uptime scores.",
    to: "/reports",
    label: "Reports",
  },
] as const;

const SIGNALS = [
  {
    title: "Cloud contact",
    body: "Whether the Edge Gateway is reaching ingest — not a proxy for Modbus.",
  },
  {
    title: "Modbus health",
    body: "Whether the serial poll path to the controller is succeeding.",
  },
  {
    title: "Freshness",
    body: "Whether the latest stored sample is young enough to act on.",
  },
] as const;

function CapLink({
  to,
  label,
  isAuthenticated,
}: {
  to: string;
  label: string;
  isAuthenticated: boolean;
}) {
  if (isAuthenticated) {
    return (
      <Link className="mkt-text-link" to={to}>
        Open {label}
      </Link>
    );
  }
  return (
    <Link className="mkt-text-link" to="/auth/login" state={{ from: to }}>
      Sign in for {label}
    </Link>
  );
}

function PlatformHeroFrame() {
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
              <path className="mkt-chart-grid" d="M0 30 H320 M0 60 H320 M0 90 H320" />
              <path
                className="mkt-chart-line"
                d="M0 78 C40 70, 60 88, 90 62 C120 36, 150 48, 180 40 C210 32, 240 58, 270 46 C290 40, 310 28, 320 34"
              />
            </svg>
            <span>Illustrative trend — not live telemetry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlatformPage() {
  const { isAuthenticated } = useConvexAuth();
  const exploreTo = isAuthenticated ? "/app" : "/auth/login";

  useEffect(() => {
    document.title = "Platform · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-hero mkt-surface mkt-seam-scoop" aria-labelledby="platform-hero-title">
          <div className="mkt-hero-copy mkt-inner" data-mkt-reveal data-mkt-from="left">
            <p className="mkt-eyebrow">Software</p>
            <h1 id="platform-hero-title">
              Monitoring that keeps industrial signals honest.
            </h1>
            <p className="mkt-lede">
              One authenticated application for gateway contact, equipment measurements, alarms and
              bounded reporting — designed so operators can trust what they see.
            </p>
            <div className="mkt-cta-row">
              <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to={exploreTo}>
                {isAuthenticated ? "Open dashboard" : "Get started"}
              </Link>
              <Link className="mkt-btn mkt-btn-ghost mkt-btn-lg" to="/product">
                Edge Gateway
              </Link>
            </div>
          </div>
          <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
            <PlatformHeroFrame />
          </div>
        </section>

        <section className="mkt-section mkt-surface mkt-seam-rise mkt-seam-wave">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Access</p>
              <h2>The Shell requires Convex Auth.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                Dashboard, live readings, gateways, alarms and admin routes live behind sign-in.
                Unsigned visitors are redirected to login. Soft-AP Modbus settings stay on the device;
                the cloud holds registration, telemetry and organization data.
              </p>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-band mkt-surface mkt-seam-arch">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Capabilities</p>
              <h2>What the platform actually does.</h2>
              <p className="mkt-copy mkt-copy-narrow">
                Every item maps to a real application route — not a marketing checklist of aspirational
                modules.
              </p>
            </div>
            <ul className="mkt-cap-list">
              {AREAS.map((item, index) => (
                <li
                  key={item.to}
                  data-mkt-reveal
                  data-mkt-from={index % 2 === 0 ? "left" : "right"}
                  data-mkt-delay={String((index % 3) + 1)}
                >
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                  <CapLink
                    to={item.to}
                    label={item.label}
                    isAuthenticated={isAuthenticated}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mkt-section mkt-dark mkt-surface mkt-seam-scoop">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">Honesty signals</p>
              <h2>Three states operators must not conflate.</h2>
            </div>
            <div className="mkt-truths">
              {SIGNALS.map((item, index) => (
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

        <section className="mkt-section mkt-surface mkt-seam-rise mkt-seam-wave">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Notifications</p>
              <h2>Channels stay independent.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                In-app notifications always. Email (Resend), SMS (Arkesel) and optional VAPID browser
                push when configured — each channel fails or succeeds on its own. Alarm lifecycle in
                the product is not rewritten by a delivery attempt.
              </p>
            </div>
          </div>
        </section>

        <PageClose
          title="Bring industrial operations into focus."
          body="Centralize gateway contact, equipment measurements and alarm response in one coherent monitoring experience."
          secondaryTo="/product"
          secondaryLabel="Edge Gateway"
        />
      </main>
    </MarketingLayout>
  );
}
