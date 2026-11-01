import { useEffect } from "react";
import { Link } from "react-router";
import { useConvexAuth } from "convex/react";
import { MarketingLayout } from "../MarketingLayout";
import { PageClose } from "./PageClose";
import {
  AccessModelDiagram,
  AppMapDiagram,
  BoundaryDiagram,
  ChannelsDiagram,
  RetentionDiagram,
} from "../diagrams/SystemDiagrams";

const AREAS = [
  {
    title: "Dashboard",
    body: "Organization overview with cloud contact, Modbus health and freshness kept in separate columns — never rolled into a single “uptime” score.",
  },
  {
    title: "Live readings",
    body: "Stored generator measurements with units and timestamps. Empty stays empty; stale is labeled, not filled with a decorative zero.",
  },
  {
    title: "Gateways",
    body: "Identity, cloud connectivity and registration metadata. Soft-AP baud, parity and GenComm writes are not edited from the cloud.",
  },
  {
    title: "Sites & generators",
    body: "Site groupings and equipment binding, scoped to the signed-in organization.",
  },
  {
    title: "Alarms",
    body: "Active, acknowledged and cleared as a preserved lifecycle. Acknowledgement does not invent a clear.",
  },
  {
    title: "Reports & events",
    body: "Bounded exports and audit activity from stored operational data — no fabricated availability or energy totals.",
  },
  {
    title: "Administration",
    body: "Users, custom roles, notification settings and an operations desk — gated by permission, not by marketing claims.",
  },
] as const;

const PERMISSIONS = [
  { name: "View measurements", meaning: "Read live and historical measurements." },
  { name: "Acknowledge alarms", meaning: "Acknowledge an open condition without clearing it." },
  { name: "Manage devices", meaning: "Register and bind Edge Gateways." },
  { name: "Configure notifications", meaning: "Enable email, SMS or browser push for the organization." },
  { name: "Export reports", meaning: "Download bounded stored history." },
  { name: "Manage roles", meaning: "Define which permissions a role may hold." },
] as const;

const CHANNELS = [
  { name: "In-app", body: "Always on. Alarm and event notices stay inside the application." },
  { name: "Email", body: "Optional email delivery. A bounce does not rewrite the alarm record." },
  { name: "SMS", body: "Optional SMS delivery. Channel failure is independent of lifecycle." },
  { name: "Browser push", body: "Optional browser notifications. Delivery success is not treated as acknowledgement." },
] as const;

function PlatformWorkspace() {
  return (
    <div className="mkt-workspace" aria-hidden="true">
      <div className="mkt-workspace-board">
        <article className="mkt-workspace-col">
          <header>
            Active <strong>2</strong>
          </header>
          <div className="mkt-workspace-item">
            <span>Link degraded</span>
            <span>Transport</span>
          </div>
          <div className="mkt-workspace-item">
            <span>Oil pressure low</span>
            <span>Controller</span>
          </div>
        </article>
        <article className="mkt-workspace-col">
          <header>
            Acknowledged <strong>1</strong>
          </header>
          <div className="mkt-workspace-item">
            <span>Batch CRC fail</span>
            <span>Still open</span>
          </div>
        </article>
        <article className="mkt-workspace-col">
          <header>
            Cleared <strong>1</strong>
          </header>
          <div className="mkt-workspace-col-empty">
            <div className="mkt-workspace-item">
              <span>High coolant</span>
              <span>Condition ended</span>
            </div>
          </div>
        </article>
      </div>
      <div className="mkt-workspace-meta">
        <span className="mkt-workspace-chip">In-app</span>
        <span className="mkt-workspace-chip">Email</span>
        <span className="mkt-workspace-chip">SMS</span>
        <span className="mkt-workspace-chip">Browser push</span>
        <span className="mkt-workspace-chip">Roles are permission-scoped</span>
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
        <section className="mkt-hero" aria-labelledby="platform-hero-title">
          <div className="mkt-hero-copy mkt-inner" data-mkt-reveal data-mkt-from="left">
            <p className="mkt-eyebrow">Operator application</p>
            <h1 id="platform-hero-title">The application operators actually work in.</h1>
            <p className="mkt-lede">
              iCanOva Monitoring is a signed-in application — roles, alarm lifecycle and
              notification channels — not a restatement of the homepage pitch.
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
            <PlatformWorkspace />
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div>
              <div data-mkt-reveal data-mkt-from="up">
                <p className="mkt-eyebrow">Application map</p>
                <h2>Every surface is a signed-in workspace.</h2>
                <p className="mkt-copy mkt-copy-narrow">
                  Visitors sign in before the dashboard opens. The items below are the product — not a
                  brochure of modules we hope to build.
                </p>
              </div>
              <div className="mkt-matrix">
                {AREAS.map((item, index) => (
                  <article
                    key={item.title}
                    className="mkt-matrix-row"
                    data-mkt-reveal
                    data-mkt-from="up"
                    data-mkt-delay={String((index % 3) + 1)}
                  >
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="mkt-diagram-slot">
              <AppMapDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-blend mkt-edge-pop">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div>
              <div data-mkt-reveal data-mkt-from="left">
                <p className="mkt-eyebrow">Access model</p>
                <h2>Organization isolation with named permissions.</h2>
                <p className="mkt-copy">
                  A signed-in account is required. Data is scoped to the organization. Roles are not a
                  fixed “admin / viewer” costume — each organization assigns permissions such as
                  viewing measurements, acknowledging alarms, managing devices and exporting reports.
                </p>
              </div>
              <ul className="mkt-cap-list">
                {PERMISSIONS.map((item, index) => (
                  <li
                    key={item.name}
                    data-mkt-reveal
                    data-mkt-from={index % 2 === 0 ? "left" : "right"}
                    data-mkt-delay={String((index % 3) + 1)}
                  >
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.meaning}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-diagram-slot">
              <AccessModelDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-edge-clip">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Boundary</p>
              <h2>Cloud registration is not Soft-AP control.</h2>
              <p className="mkt-copy">
                The cloud stores organization membership, gateway registration, telemetry samples,
                alarms and audit activity. Baud, parity, GenComm writes and Wi-Fi Soft-AP settings
                stay on the Edge Gateway. The dashboard does not push local Modbus configuration.
              </p>
            </div>
            <div className="mkt-diagram-slot">
              <BoundaryDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-dark mkt-curve-soft">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">How signals appear</p>
              <h2>Operators read three independent columns.</h2>
            </div>
            <div className="mkt-truths">
              <article data-mkt-reveal data-mkt-from="left">
                <h3>Cloud contact</h3>
                <p>
                  Last successful ingest from the gateway. Online here does not paint the serial
                  path green.
                </p>
              </article>
              <article data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
                <h3>Modbus health</h3>
                <p>
                  Whether polls to the controller are succeeding. A healthy poll can still be too
                  old to act on.
                </p>
              </article>
              <article data-mkt-reveal data-mkt-from="right" data-mkt-delay="2">
                <h3>Freshness</h3>
                <p>
                  Age of the latest stored sample. Stale is labeled. Missing is blank — never a
                  calming zero.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-blend mkt-edge-wave">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div>
              <div data-mkt-reveal data-mkt-from="up">
                <p className="mkt-eyebrow">Notifications</p>
                <h2>Channels fail on their own.</h2>
                <p className="mkt-copy mkt-copy-narrow">
                  A delivery attempt does not acknowledge or clear an alarm. Each channel is configured
                  per organization and reported independently.
                </p>
              </div>
              <ul className="mkt-cap-list">
                {CHANNELS.map((item, index) => (
                  <li
                    key={item.name}
                    data-mkt-reveal
                    data-mkt-from={index % 2 === 0 ? "left" : "right"}
                    data-mkt-delay={String((index % 3) + 1)}
                  >
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mkt-diagram-slot">
              <ChannelsDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Retention</p>
              <h2>Export what is stored — then it ages out.</h2>
              <p className="mkt-copy">
                Telemetry history is bounded (about seven days in the current product). Reports pull
                from stored records, not invented availability percentages. If a deployment needs a
                longer retain window, that is a commercial conversation — not a silent change to
                what the UI pretends to hold.
              </p>
            </div>
            <div className="mkt-diagram-slot">
              <RetentionDiagram />
            </div>
          </div>
        </section>

        <PageClose
          title="Open the application, not another brochure."
          body="Sign in for dashboard, live readings, gateways and alarm lifecycle — or talk to us about a deployment."
          secondaryTo="/contact"
          secondaryLabel="Contact"
        />
      </main>
    </MarketingLayout>
  );
}
