import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";
import { PageClose } from "./PageClose";

const PILLARS = [
  {
    title: "Imagine",
    body: "Industrial visibility that respects how links actually fail — cloud, Modbus and freshness kept apart.",
  },
  {
    title: "Connect",
    body: "Edge Gateways and monitoring software that bind equipment to organizations without overreaching Soft-AP.",
  },
  {
    title: "Innovate",
    body: "Product craft for operators who need honest empty states more than decorative KPI mosaics.",
  },
] as const;

const LINES = [
  {
    title: "iCanOva Monitoring",
    body: "The cloud application: sites, gateways, generators, live readings, alarms, events and bounded reports.",
    to: "/platform",
    label: "Platform",
  },
  {
    title: "iCanOva Edge Gateway",
    body: "Hardware that polls controllers over RS485 and uplinks telemetry over HTTPS ingest.",
    to: "/product",
    label: "Hardware",
  },
] as const;

export function AboutPage() {
  useEffect(() => {
    document.title = "About · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero mkt-page-hero-brand" aria-labelledby="about-hero-title">
          <div className="mkt-inner" data-mkt-reveal data-mkt-from="up">
            <p className="mkt-eyebrow">Brand</p>
            <p className="mkt-brand-hero-mark" aria-hidden="true">
              iCanOva
            </p>
            <h1 id="about-hero-title">Intelligent technology for connected industries.</h1>
            <p className="mkt-lede">
              iCanOva builds monitoring that operators can trust — equipment, Edge Gateways and
              operational data in one coherent experience, without vanity dashboards.
            </p>
            <div className="mkt-cta-row">
              <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to="/platform">
                Explore the platform
              </Link>
              <Link className="mkt-btn mkt-btn-ghost mkt-btn-lg" to="/contact">
                Contact
              </Link>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-edge-wave">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">Tagline</p>
              <h2>Imagine. Connect. Innovate.</h2>
            </div>
            <div className="mkt-truths mkt-truths-light">
              {PILLARS.map((item, index) => (
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

        <section className="mkt-section mkt-blend">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Mission</p>
              <h2>Honest visibility for industrial operations.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                Bring industrial equipment, Edge Gateways and operational data into focus. Operators
                should see what is known — and what is not — so engineering and operations can act
                with confidence. We refuse decorative zeros, blurred uplink/serial health and
                fabricated availability scores.
              </p>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-edge-pop">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Product line</p>
              <h2>What we ship under iCanOva.</h2>
            </div>
            <ul className="mkt-cap-list">
              {LINES.map((item, index) => (
                <li
                  key={item.title}
                  data-mkt-reveal
                  data-mkt-from={index % 2 === 0 ? "left" : "right"}
                  data-mkt-delay={String(index + 1)}
                >
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                  <Link className="mkt-text-link" to={item.to}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mkt-section mkt-dark mkt-curve-soft">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Parent</p>
              <h2>ASIEDU DEVELOPMENT HUB</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy mkt-copy-on-dark">
                iCanOva is a product identity of ASIEDU DEVELOPMENT HUB. Day-to-day product
                communication leads with iCanOva; ASIEDU DEVELOPMENT HUB remains the corporate
                parent.
              </p>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-blend mkt-edge-clip">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Discipline</p>
              <h2>What we will not ship.</h2>
            </div>
            <ul className="mkt-cap-list">
              <li data-mkt-reveal data-mkt-from="left">
                <div>
                  <h3>Decorative zeros</h3>
                  <p>Missing readings stay empty. A blank cell is more honest than a calming 0.0.</p>
                </div>
              </li>
              <li data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
                <div>
                  <h3>Blurred health</h3>
                  <p>Cloud contact, Modbus and freshness are never collapsed into one green badge.</p>
                </div>
              </li>
              <li data-mkt-reveal data-mkt-from="left" data-mkt-delay="2">
                <div>
                  <h3>Invented availability</h3>
                  <p>Reports export stored data. We do not mint uptime percentages for a slide deck.</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <PageClose
          title="Build with an honest monitoring stack."
          body="From Edge Gateway registration to alarm response — one coherent iCanOva experience."
          secondaryTo="/contact"
          secondaryLabel="Contact"
        />
      </main>
    </MarketingLayout>
  );
}
