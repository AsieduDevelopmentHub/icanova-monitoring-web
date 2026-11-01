import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";
import { PageClose } from "./PageClose";

const SPECS = [
  { label: "Serial", value: "RS485 Modbus RTU" },
  { label: "Power", value: "Wide DC input" },
  { label: "Status", value: "Power · TX · RX" },
  { label: "Uplink", value: "HTTPS ingest" },
] as const;

const FLOW = [
  {
    n: "01",
    title: "Poll the controller",
    body: "GenComm / DSE registers over RS485 — baud and parity stay on the Soft-AP.",
  },
  {
    n: "02",
    title: "Hold what matters",
    body: "Samples buffer locally when the uplink dips, then resume without inventing gaps.",
  },
  {
    n: "03",
    title: "Post to monitoring",
    body: "Authenticated HTTPS ingest into Convex — organization-scoped, rate-aware.",
  },
  {
    n: "04",
    title: "Surface honest states",
    body: "Cloud contact, Modbus health and freshness stay separate in iCanOva Monitoring.",
  },
] as const;

const BOUNDARIES = [
  {
    title: "Cloud ≠ Modbus",
    body: "An online uplink does not mean the serial link to the controller is healthy.",
  },
  {
    title: "Modbus ≠ freshness",
    body: "A working poll path can still leave a sample too old to act on.",
  },
  {
    title: "Missing ≠ zero",
    body: "Absent readings stay empty. The gateway and UI never invent calming zeros.",
  },
] as const;

export function ProductPage() {
  useEffect(() => {
    document.title = "Edge Gateway · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero mkt-page-hero-split mkt-surface mkt-seam-scoop" aria-labelledby="product-hero-title">
          <div className="mkt-inner mkt-page-hero-grid">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Hardware</p>
              <h1 id="product-hero-title">iCanOva Edge Gateway</h1>
              <p className="mkt-lede">
                Industrial Modbus edge hardware that bridges generator controllers to iCanOva
                Monitoring — RS485 on the plant floor, HTTPS to the cloud.
              </p>
              <div className="mkt-cta-row">
                <Link className="mkt-btn mkt-btn-primary mkt-btn-lg" to="/contact">
                  Talk about hardware
                </Link>
                <Link className="mkt-btn mkt-btn-ghost mkt-btn-lg" to="/platform">
                  See the platform
                </Link>
              </div>
            </div>
            <figure
              className="mkt-page-hero-figure"
              data-mkt-reveal
              data-mkt-from="right"
              data-mkt-delay="1"
            >
              <div className="mkt-hardware-stage mkt-page-product-stage">
                <img
                  className="mkt-hardware-img"
                  src="/brand/icanova-edge-gateway.png?v=7"
                  alt="iCanOva Edge Gateway concept casing"
                  width={1280}
                  height={720}
                  decoding="async"
                />
              </div>
              <figcaption className="mkt-hardware-cap">
                Concept enclosure · mechanical pack may differ by revision
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mkt-stats mkt-surface mkt-seam-rise mkt-seam-arch" aria-label="Gateway facts" data-mkt-reveal data-mkt-from="fade">
          <div className="mkt-inner mkt-stats-row mkt-specs-row">
            {SPECS.map((spec) => (
              <div key={spec.label}>
                <strong>{spec.label}</strong>
                <span>{spec.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-surface mkt-seam-wave">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Role</p>
              <h2>Edge connectivity without cloud overreach.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                The gateway polls compatible controllers, keeps Soft-AP configuration on-device, and
                posts telemetry to the monitoring backend. Cloud registration binds the unit to an
                organization — it does not push baud, parity or GenComm writes from the dashboard.
              </p>
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-band mkt-surface mkt-seam-arch">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="up">
              <p className="mkt-eyebrow">Path</p>
              <h2>From controller to operator.</h2>
            </div>
            <ol className="mkt-steps">
              {FLOW.map((step, index) => (
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

        <section className="mkt-section mkt-dark mkt-surface mkt-seam-scoop">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">Honesty</p>
              <h2>Signals stay separate at the edge too.</h2>
            </div>
            <div className="mkt-truths">
              {BOUNDARIES.map((item, index) => (
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
              <p className="mkt-eyebrow">Enclosure</p>
              <h2>Concept casing for product communication.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                Imagery shows a concept industrial enclosure suited to cabinet installs beside
                generator controllers. Final casing, mounting hardware and field labeling may change
                by production revision — treat dimensions as indicative until a released drawing pack
                is provided.
              </p>
            </div>
          </div>
        </section>

        <PageClose
          title="Pair the gateway with monitoring."
          body="Register Edge Gateways, follow honesty signals and respond to alarms in one coherent application."
          secondaryTo="/platform"
          secondaryLabel="Platform overview"
        />
      </main>
    </MarketingLayout>
  );
}
