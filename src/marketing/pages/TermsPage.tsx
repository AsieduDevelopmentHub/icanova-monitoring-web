import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";

const SECTIONS = [
  {
    title: "Service",
    body: "iCanOva Monitoring provides authenticated access to gateway registration, telemetry, alarms and related operational tools. The Edge Gateway and Soft-AP configuration remain device-side responsibilities.",
  },
  {
    title: "Accounts",
    body: "Keep credentials confidential and use roles appropriate to your organization. Unauthorized access, abuse of ingest endpoints or attempts to bypass organization isolation are prohibited.",
  },
  {
    title: "Data honesty",
    body: "The product surfaces stored states. Cloud contact, Modbus health and freshness are independent signals. We do not warrant that any reading is suitable as the sole basis for life-safety or regulatory decisions without your own operational procedures.",
  },
  {
    title: "Availability",
    body: "Hosting depends on Convex and configured third-party channels. Planned or unplanned interruptions may occur. Marketing pages do not invent uptime guarantees.",
  },
  {
    title: "Parent company",
    body: "iCanOva is a product identity of ASIEDU DEVELOPMENT HUB (ADH). Enterprise deployments may use a separate commercial agreement that supersedes this summary.",
  },
] as const;

export function TermsPage() {
  useEffect(() => {
    document.title = "Terms · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero mkt-surface mkt-seam-scoop" aria-labelledby="terms-hero-title">
          <div className="mkt-inner mkt-page-hero-copy" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Legal</p>
            <h1 id="terms-hero-title">Terms of use</h1>
            <p className="mkt-lede">
              Concise terms for accessing iCanOva Monitoring. Not a complete commercial contract —
              enterprise deployments may use a separate agreement.
            </p>
          </div>
        </section>

        <section className="mkt-section mkt-section-tight mkt-surface mkt-seam-rise mkt-seam-arch">
          <div className="mkt-inner mkt-legal-stack">
            {SECTIONS.map((section, index) => (
              <article
                key={section.title}
                className="mkt-legal-block"
                data-mkt-reveal
                data-mkt-from="up"
                data-mkt-delay={String((index % 3) + 1)}
              >
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
            <p className="mkt-legal-foot" data-mkt-reveal data-mkt-from="fade">
              Questions:{" "}
              <Link className="mkt-text-link" to="/contact">
                contact iCanOva
              </Link>
              . Also see{" "}
              <Link className="mkt-text-link" to="/privacy">
                privacy notice
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
