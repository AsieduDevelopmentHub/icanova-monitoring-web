export function Settings() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Settings</h1>
        <p>Deployment settings stay on the server. This screen does not change the gateway.</p>
      </header>
      <div className="stack">
        <p>
          A browser preference does not change the ESP32 poll interval or the uplink period. Those
          stay on the gateway.
        </p>
        <p>
          Historical telemetry buckets are pruned after seven days by the existing Convex schedule.
          Current telemetry is one document per generator and is not part of that prune.
        </p>
        <p>
          Resend and Arkesel credentials are Convex environment variables. Web push has no VAPID
          configuration, so a push policy records not configured.
        </p>
        <p>Role, export, and notification changes are audited in the organization audit log.</p>
      </div>
    </section>
  );
}
