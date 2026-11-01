import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";

const SECTIONS = [
  {
    title: "What we process",
    body: "Account authentication (Convex Auth), organization membership, gateway registration metadata, telemetry samples, alarms, events and optional notification channel settings (email, SMS, browser push when configured).",
  },
  {
    title: "Why",
    body: "To provide industrial monitoring: sign-in, organization isolation, live and historical readings, alarm workflows and bounded exports. Product analytics may record coarse usage signals when instrumented.",
  },
  {
    title: "Where",
    body: "Application data is stored in Convex backends configured for the deployment. Auth sessions follow Convex Auth / configured providers. Notification vendors receive only what is required for that channel.",
  },
  {
    title: "Your choices",
    body: "Organization administrators manage users and roles inside the app. To ask about account or telemetry retention for a deployment, use the contact page.",
  },
  {
    title: "Updates",
    body: "This notice may change as the product evolves. Continued use of the service after an update constitutes awareness of the revised text on this page.",
  },
] as const;

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero mkt-surface mkt-seam-wave" aria-labelledby="privacy-hero-title">
          <div className="mkt-inner mkt-page-hero-copy" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Legal</p>
            <h1 id="privacy-hero-title">Privacy notice</h1>
            <p className="mkt-lede">
              How iCanOva Monitoring handles account and operational data. Concise product framing —
              not a substitute for counsel-drafted policy for regulated deployments.
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
              <Link className="mkt-text-link" to="/terms">
                terms of use
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
