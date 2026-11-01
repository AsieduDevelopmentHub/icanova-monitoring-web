import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";

const EFFECTIVE = "1 November 2026";
const UPDATED = "1 November 2026";
const VERSION = "2026.11.1";

export function TermsPage() {
  useEffect(() => {
    document.title = "Terms of use · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero" aria-labelledby="terms-hero-title">
          <div className="mkt-inner mkt-page-hero-copy" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Legal</p>
            <h1 id="terms-hero-title">Terms of use</h1>
            <p className="mkt-lede">
              These terms govern access to iCanOva Monitoring, a product of ASIEDU DEVELOPMENT HUB.
              They are a concise public statement — not a complete commercial contract. Enterprise
              deployments may use a separate agreement that supersedes this page.
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
                <dd>© 2026 iCanOva</dd>
              </div>
              <div>
                <dt>Established</dt>
                <dd>2024</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mkt-section mkt-section-tight mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-legal-stack">
            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>1. Acceptance</h2>
              <p>
                By creating an account, signing in, registering an Edge Gateway or otherwise using
                iCanOva Monitoring, you agree to these terms on behalf of yourself and the
                organization you represent. If you do not agree, do not use the service.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>2. The service</h2>
              <p>
                iCanOva Monitoring provides authenticated access to gateway registration, telemetry,
                alarms, sites, reports and related operational tools. The iCanOva Edge Gateway and
                its Soft-AP configuration remain device-side responsibilities. Deep Sea Electronics
                / DSE controllers and GenComm register maps are third-party equipment — not part of
                the iCanOva brand.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>3. Accounts and organizations</h2>
              <p>
                Keep credentials confidential. Use roles and permissions appropriate to each person
                in your organization. You are responsible for activity under your accounts, including
                ingest credentials issued to gateways. We may suspend access that appears compromised
                or abusive.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>4. Acceptable use</h2>
              <p>You may not:</p>
              <ul>
                <li>Access another organization’s data or attempt to bypass organization isolation.</li>
                <li>Abuse ingest, authentication or notification endpoints, including automated flooding.</li>
                <li>Probe, scan or interfere with the service except as expressly authorized in writing.</li>
                <li>Misrepresent readings, alarms or exports produced by the product as something they are not.</li>
                <li>Use the service for any unlawful purpose.</li>
              </ul>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>5. Data honesty and no life-safety warranty</h2>
              <p>
                The product surfaces stored states. Cloud contact, Modbus health and freshness are
                independent signals. Missing values stay empty. We do not warrant that any reading,
                alarm or export is suitable as the sole basis for life-safety, emergency shutdown or
                regulatory compliance. Your organization remains responsible for operational
                procedures, on-site verification and qualified personnel.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>6. Availability</h2>
              <p>
                Hosting depends on the application platform and configured third-party channels
                (including email, SMS and optional browser push). Planned or unplanned interruptions
                may occur.
                These marketing pages do not invent an uptime guarantee or service-credit schedule.
                Any availability commitment belongs in a signed enterprise agreement.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>7. Intellectual property</h2>
              <p>
                iCanOva, iCanOva Monitoring, iCanOva Edge Gateway and related marks are product
                identities of ASIEDU DEVELOPMENT HUB. You receive a limited, revocable right to use
                the application for your organization’s operations. You do not receive ownership of
                the software, documentation or brand. Feedback you send may be used to improve the
                product without obligation.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>8. Your data</h2>
              <p>
                You retain rights in the operational data you submit. You grant ASIEDU DEVELOPMENT
                HUB a license to host, process and display that data as needed to provide Monitoring.
                See the{" "}
                <Link className="mkt-text-link" to="/privacy">
                  privacy notice
                </Link>{" "}
                for categories, processors and retention. Telemetry history is bounded in the current
                product.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>9. Disclaimers and limitation</h2>
              <p>
                The service is provided “as is” and “as available.” To the fullest extent permitted
                by law, ASIEDU DEVELOPMENT HUB disclaims implied warranties of merchantability,
                fitness for a particular purpose and non-infringement. ASIEDU DEVELOPMENT HUB is not
                liable for indirect, incidental, special or
                consequential damages, or for decisions made solely from a stale, missing or
                misunderstood reading. Liability for direct damages is limited to fees paid for the
                service in the three months before the claim, or a nominal amount if the deployment
                is not on a paid plan — unless a signed agreement states otherwise.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>10. Indemnity</h2>
              <p>
                You will defend and indemnify ASIEDU DEVELOPMENT HUB against claims arising from your
                misuse of the service, your on-site operations, or data you submit, except to the
                extent a claim is caused by ASIEDU DEVELOPMENT HUB’s willful misconduct.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up">
              <h2>11. Governing terms and changes</h2>
              <p>
                Enterprise contracts specify governing law, venue and order of precedence. Absent
                such a contract, these terms are the public conditions of use and may be updated on
                this page. The version and “Last updated” fields above identify the current text.
                Continued use after an update constitutes acceptance of the revised terms.
              </p>
            </article>

            <article className="mkt-legal-block" data-mkt-reveal data-mkt-from="up" data-mkt-delay="1">
              <h2>12. Contact</h2>
              <p>
                Notices and questions:{" "}
                <Link className="mkt-text-link" to="/contact">
                  contact iCanOva
                </Link>
                . © 2026 iCanOva. Established 2024.
              </p>
            </article>

            <p className="mkt-legal-foot" data-mkt-reveal data-mkt-from="fade">
              Related:{" "}
              <Link className="mkt-text-link" to="/privacy">
                Privacy notice
              </Link>
              . Document {VERSION}, effective {EFFECTIVE}.
            </p>
          </div>
        </section>
      </main>
    </MarketingLayout>
  );
}
