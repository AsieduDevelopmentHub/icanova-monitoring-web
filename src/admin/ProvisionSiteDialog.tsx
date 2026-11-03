import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { accessMessage } from "../fleet/access";
import { Dialog } from "../ui/Overlay";

type Step = "site" | "gateway" | "review";

export function ProvisionSiteDialog({
  open,
  organizationId,
  siteCodeFormat,
  onClose,
  onProvisioned,
}: {
  open: boolean;
  organizationId: Id<"organizations">;
  siteCodeFormat: "numeric" | "text";
  onClose: () => void;
  onProvisioned?: (result: { siteId: Id<"sites">; code: string; name: string }) => void;
}) {
  const [step, setStep] = useState<Step>("site");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mode, setMode] = useState<"pick" | "register">("pick");
  const [search, setSearch] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [gatewayName, setGatewayName] = useState("");
  const [gatewayIdentity, setGatewayIdentity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const unassigned = useQuery(
    api.devices.listUnassigned,
    open ? { organizationId, search } : "skip",
  );
  const provision = useMutation(api.sites.provision);

  const selected = useMemo(
    () => unassigned?.find((row) => row.deviceId === deviceId) ?? null,
    [unassigned, deviceId],
  );

  function reset() {
    setStep("site");
    setName("");
    setCode("");
    setLatitude("");
    setLongitude("");
    setMode("pick");
    setSearch("");
    setDeviceId("");
    setGatewayName("");
    setGatewayIdentity("");
    setError(null);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function onProvision(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await provision({
        organizationId,
        name,
        code,
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        deviceId: mode === "pick" && deviceId ? (deviceId as Id<"devices">) : undefined,
        gatewayName: mode === "register" ? gatewayName : undefined,
        gatewayIdentity: mode === "register" ? gatewayIdentity : undefined,
      });
      onProvisioned?.({
        siteId: result.siteId,
        code: result.code,
        name: result.name,
      });
      close();
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="Provision site" onClose={close}>
      <div className="stack provision-wizard">
        <ol className="provision-steps" aria-label="Provisioning steps">
          <li className={step === "site" ? "is-current" : "is-done"}>Site</li>
          <li className={step === "gateway" ? "is-current" : step === "review" ? "is-done" : undefined}>
            Gateway
          </li>
          <li className={step === "review" ? "is-current" : undefined}>Review</li>
        </ol>

        {step === "site" ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setStep("gateway");
            }}
          >
            <label className="field">
              <span>Site name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Site code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                inputMode={siteCodeFormat === "numeric" ? "numeric" : "text"}
                pattern={siteCodeFormat === "numeric" ? "[0-9]+" : "[A-Za-z0-9][A-Za-z0-9._\\-]{0,31}"}
              />
            </label>
            <div className="filter-bar">
              <label className="filter-field">
                <span>Latitude (optional)</span>
                <input value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              </label>
              <label className="filter-field">
                <span>Longitude (optional)</span>
                <input value={longitude} onChange={(e) => setLongitude(e.target.value)} />
              </label>
            </div>
            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </form>
        ) : null}

        {step === "gateway" ? (
          <div className="stack">
            <div className="filter-bar">
              <button
                type="button"
                className={mode === "pick" ? "btn btn-primary" : "btn btn-secondary"}
                onClick={() => setMode("pick")}
              >
                Select available
              </button>
              <button
                type="button"
                className={mode === "register" ? "btn btn-primary" : "btn btn-secondary"}
                onClick={() => setMode("register")}
              >
                Register new
              </button>
            </div>
            {mode === "pick" ? (
              <>
                <label className="field">
                  <span>Search gateways</span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name or identity"
                  />
                </label>
                <ul className="gateway-picker">
                  {(unassigned ?? []).map((row) => (
                    <li key={row.deviceId}>
                      <button
                        type="button"
                        className={
                          deviceId === row.deviceId
                            ? "gateway-pick-item is-selected"
                            : "gateway-pick-item"
                        }
                        onClick={() => setDeviceId(row.deviceId)}
                      >
                        <strong>{row.name}</strong>
                        <span className="tech">{row.identity}</span>
                        <span className="meta">
                          {row.lifecycle} · {row.assignment}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {unassigned && unassigned.length === 0 ? (
                  <p className="meta">No unassigned gateways. Register a new identity.</p>
                ) : null}
              </>
            ) : (
              <>
                <label className="field">
                  <span>Gateway name</span>
                  <input
                    value={gatewayName}
                    onChange={(e) => setGatewayName(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Identity (MAC or serial)</span>
                  <input
                    value={gatewayIdentity}
                    onChange={(e) => setGatewayIdentity(e.target.value)}
                    required
                  />
                </label>
              </>
            )}
            <div className="filter-bar">
              <button type="button" className="btn btn-secondary" onClick={() => setStep("site")}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={mode === "pick" ? !deviceId : !gatewayName.trim() || !gatewayIdentity.trim()}
                onClick={() => setStep("review")}
              >
                Review
              </button>
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <form className="stack" onSubmit={(event) => void onProvision(event)}>
            <div className="panel scope-empty-panel">
              <div className="panel-body">
                <h3>Site</h3>
                <p>
                  <strong>{name}</strong>
                  <br />
                  Code {code}
                  {latitude && longitude ? (
                    <>
                      <br />
                      {latitude}, {longitude}
                    </>
                  ) : null}
                </p>
                <h3>Gateway</h3>
                <p>
                  {mode === "pick" && selected ? (
                    <>
                      <strong>{selected.name}</strong>
                      <br />
                      Identity: {selected.identity}
                    </>
                  ) : (
                    <>
                      <strong>{gatewayName}</strong>
                      <br />
                      Identity: {gatewayIdentity}
                    </>
                  )}
                </p>
                <h3>Assignment</h3>
                <p>
                  {name} →{" "}
                  {mode === "pick" && selected ? selected.identity : gatewayIdentity}
                </p>
              </div>
            </div>
            {error ? <p className="err">{error}</p> : null}
            <div className="filter-bar">
              <button type="button" className="btn btn-secondary" onClick={() => setStep("gateway")}>
                Back
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Provisioning…" : "Provision Site"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </Dialog>
  );
}
