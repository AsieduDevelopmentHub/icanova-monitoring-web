import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";

const EFFECTIVE = "1 November 2026";
const UPDATED = "1 November 2026";
const VERSION = "2026.11.1";

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Privacy notice · iCaNova Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero" aria-labelledby="privacy-hero-title">
          <div className="mkt-inner mkt-page-hero-copy" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Legal</p>
            <h1 id="privacy-hero-title">Privacy notice</h1>
            <p className="mkt-lede">
              How iCaNova Monitoring, a product of ASIEDU DEVELOPMENT HUB, handles account and
              operational data. This is a product notice — not a substitute for counsel-drafted
              policy on a regulated or enterprise deployment.
            </p>
            <dl className="mkt-legal-meta">
              <div>
                <dt>Effective</dt>
                <dd>{EFFECTIVE}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{UPDATED}</dd>
              </div>
              <div>
                <dt>Copyright</dt>
                <dd>© 2026 iCaNova</dd>
              </div>
              <div>
                <dt>Established</dt>
                <dd>2026</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mkt-section mkt-section-tight mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-legal-stack">
            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>1. Who we are</h2>
              <p>
                iCaNova is the product identity. iCaNova Monitoring is the authenticated web
                application. The Edge Gateway is the related hardware product. The parent company is
                ASIEDU DEVELOPMENT HUB. Day-to-day product communication leads with iCaNova;
                ASIEDU DEVELOPMENT HUB remains the legal operator of the service described here.
              </p>
              <p>
                Questions about this notice:{" "}
                <Link className="mkt-text-link" to="/contact">
                  contact iCaNova
                </Link>
                .
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>2. Scope</h2>
              <p>
                This notice covers the public marketing site and the signed-in Monitoring
                application: authentication, organization membership, gateway registration,
                telemetry, alarms, events, exports and optional notification channels. It does not
                cover third-party controller manufacturers (including Deep Sea Electronics) or
                networks you operate on-site.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>3. Data we process</h2>
              <ul>
                <li>
                  Account data: username or sign-in identifier, authentication credentials,
                  organization membership and assigned roles.
                </li>
                <li>
                  Operational data: gateway identity and registration metadata, telemetry samples,
                  alarm lifecycle, audit and event records, site and generator labels.
                </li>
                <li>
                  Notification settings: in-app always; email, SMS and browser-push endpoints when an
                  organization enables them.
                </li>
                <li>
                  Usage signals: coarse product analytics when instrumented — not a covert profile of
                  plant operations.
                </li>
                <li>
                  Contact drafts: the public contact form opens the visitor’s email application. That
                  page does not store the message on this website.
                </li>
              </ul>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>4. Why we process it</h2>
              <p>
                To provide the service you request: sign-in, organization isolation, live and
                historical readings, alarm workflows, bounded exports and optional notifications. We
                process this data to perform the service contract with the organization, to secure
                the application, and to operate and improve Monitoring. Soft-AP Modbus settings stay
                on the gateway and are not collected as cloud configuration.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>5. Where it is stored and who assists</h2>
              <p>
                Application data is stored in the hosted application database configured for the
                deployment. Sign-in sessions follow the configured authentication service. Depending
                on what an organization enables, subprocessors may include:
              </p>
              <ul>
                <li>Hosted application database, authentication and file storage used by the product.</li>
                <li>Transactional email, including password-reset and alarm email when configured.</li>
                <li>SMS delivery when configured.</li>
                <li>Optional browser notifications to subscribed browsers.</li>
              </ul>
              <p>
                Each channel receives only what is required to deliver that message. A delivery
                attempt does not rewrite alarm lifecycle in the product.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>6. Retention</h2>
              <p>
                Account and organization records persist while the organization uses the service.
                Telemetry history is bounded — about seven days in the current product — then ages
                out. Alarm, event and audit records follow the deployment’s configured retention.
                Organization administrators should treat exports as their own copies once downloaded.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>7. Your choices and rights</h2>
              <p>
                Organization administrators manage users, roles and notification settings inside the
                application. To request access, correction or deletion of account or telemetry data
                for a deployment, use the{" "}
                <Link className="mkt-text-link" to="/contact">
                  contact
                </Link>{" "}
                page. We may need to verify the requester’s authority for that organization. Local
                privacy laws may grant additional rights; enterprise agreements can document a
                specific process.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>8. Security</h2>
              <p>
                The Shell requires authentication. Ingest endpoints are credentialed and
                organization-scoped. We do not publish secrets in the marketing site. No method of
                transmission or storage is perfectly secure; organizations remain responsible for
                credential hygiene and role assignment.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>9. Children</h2>
              <p>
                iCaNova Monitoring is an industrial operations product. It is not directed at
                children and we do not knowingly collect personal data from children.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>10. Changes</h2>
              <p>
                We may update this notice as the product evolves. The “Last updated” and version
                fields above are authoritative for the text on this page. Material changes will be
                reflected here; continued use after an update constitutes awareness of the revised
                notice.
              </p>
            </article>

            <p className="mkt-legal-foot" data-mkt-reveal data-mkt-from="fade">
              Related:{" "}
              <Link className="mkt-text-link" to="/terms">
                Terms of use
              </Link>
              . © 2026 iCaNova. Established 2026. Document{" "}
              {VERSION}, effective{" "}
              {EFFECTIVE}.
            </p>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
