import { useEffect } from "react";
import { Link } from "react-router";
import { MarketingLayout } from "../MarketingLayout";
import { PageClose } from "./PageClose";
import { EdgePathDiagram, EdgeRoleDiagram, SoftApDiagram } from "../diagrams/SystemDiagrams";

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
    body: "Authenticated HTTPS ingest into the monitoring backend — organization-scoped, rate-aware.",
  },
  {
    n: "04",
    title: "Surface honest states",
    body: "Cloud contact, Modbus health and freshness stay separate in iCanOva Monitoring.",
  },
] as const;

const INDICATORS = [
  {
    title: "Power",
    body: "Unit is receiving DC input. Absence here is not a cloud outage and is not a Modbus fault.",
  },
  {
    title: "TX",
    body: "Transmit activity on the RS485 path toward the controller.",
  },
  {
    title: "RX",
    body: "Receive activity from the controller. Quiet RX with live TX is a field clue, not a dashboard invention.",
  },
] as const;

export function ProductPage() {
  useEffect(() => {
    document.title = "Edge Gateway · iCanOva Monitoring";
  }, []);

  return (
    <MarketingLayout reveal>
      <main className="mkt-main">
        <section className="mkt-page-hero mkt-page-hero-split" aria-labelledby="product-hero-title">
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

        <section className="mkt-stats" aria-label="Gateway facts" data-mkt-reveal data-mkt-from="fade">
          <div className="mkt-inner mkt-stats-row mkt-specs-row">
            {SPECS.map((spec) => (
              <div key={spec.label}>
                <strong>{spec.label}</strong>
                <span>{spec.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section mkt-blend mkt-edge-wave">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Role</p>
              <h2>Edge connectivity without cloud overreach.</h2>
              <p className="mkt-copy">
                The gateway polls compatible controllers, keeps Soft-AP configuration on-device, and
                posts telemetry to the monitoring backend. Cloud registration binds the unit to an
                organization — it does not push baud, parity or GenComm writes from the dashboard.
              </p>
            </div>
            <div className="mkt-diagram-slot">
              <EdgeRoleDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist mkt-curve-shell">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div>
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
            <div className="mkt-diagram-slot">
              <EdgePathDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-dark mkt-edge-cut">
          <div className="mkt-inner">
            <div data-mkt-reveal data-mkt-from="fade">
              <p className="mkt-eyebrow">Field indicators</p>
              <h2>Power, transmit and receive stay readable at the cabinet.</h2>
            </div>
            <div className="mkt-truths">
              {INDICATORS.map((item, index) => (
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

        <section className="mkt-section mkt-blend mkt-edge-pop">
          <div className="mkt-inner mkt-split mkt-split-visual">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Soft-AP</p>
              <h2>Local configuration never leaves the enclosure.</h2>
              <p className="mkt-copy">
                Default hostname is icanova-edge. The Soft-AP SSID follows ICANOVA-EDGE-XXXX. Baud,
                parity, slave address and GenComm writes are set on the device — iCanOva Monitoring
                binds the registered unit to an organization and receives HTTPS ingest. It does not
                become a remote serial console.
              </p>
            </div>
            <div className="mkt-diagram-slot">
              <SoftApDiagram />
            </div>
          </div>
        </section>

        <section className="mkt-section mkt-mist">
          <div className="mkt-inner mkt-split">
            <div data-mkt-reveal data-mkt-from="left">
              <p className="mkt-eyebrow">Compatibility</p>
              <h2>Built around DSE / GenComm register maps.</h2>
            </div>
            <div data-mkt-reveal data-mkt-from="right" data-mkt-delay="1">
              <p className="mkt-copy">
                The gateway polls compatible Deep Sea Electronics controllers over RS485 Modbus RTU.
                DSE remains third-party equipment — not the product brand. Imagery shows a concept
                industrial enclosure for cabinet installs beside the controller. Final casing,
                mounting hardware and field labeling may change by production revision.
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
