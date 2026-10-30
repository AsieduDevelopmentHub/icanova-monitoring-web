import { Link } from "react-router";
import { OrgFleet } from "../fleet/OrgFleet";
import { DEMO_GENERATOR_ID, DEMO_SOURCE } from "../telemetry/logModel";
import { demoSamples } from "../telemetry/demoLog";
import { formatReading, readingOf } from "../telemetry/readings";

export function Generators() {
  const latest = demoSamples[demoSamples.length - 1];
  const model = latest ? readingOf(latest.readings, "Model Number") : null;
  const serial = latest ? readingOf(latest.readings, "Serial Number") : null;

  return (
    <section className="page">
      <header className="page-head">
        <h1>Generators</h1>
        <p>The demo log is one controller. An organization list appears only when Convex is configured and a bearer is present.</p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? <OrgFleet /> : null}
      <div className="notice fixture" role="note">
        <strong>Demo log.</strong> Rows come from {DEMO_SOURCE}.{" "}
        {import.meta.env.VITE_CONVEX_URL
          ? "This table is not the organization list above."
          : "Nothing on this page opens a gateway or Convex."}
      </div>
      {latest && model && serial ? (
        <div className="table-wrap">
          <table className="data-table">
            <caption>Demo generator from the log excerpt</caption>
            <thead>
              <tr>
                <th>Model</th>
                <th>Serial</th>
                <th>Samples</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatReading(model)}</td>
                <td>{formatReading(serial)}</td>
                <td className="num">{demoSamples.length}</td>
                <td>
                  <Link to={`/generators/${DEMO_GENERATOR_ID}`}>Open detail</Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">The log excerpt did not parse.</p>
      )}
    </section>
  );
}
