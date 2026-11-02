import { useAction, useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { accessMessage } from "../fleet/access";
import { EmptyState } from "../ui/EmptyState";
import { Panel } from "../ui/Panel";
import { PasswordField } from "../ui/PasswordField";
import { PageSkeleton } from "../ui/Skeleton";

/** Env-gated platform bootstrap UI (PLATFORM_ADMIN_EMAILS / PLATFORM_ADMIN_SECRET). */
export function PlatformAdmin() {
  const capable = useQuery(api.platformAdmin.isCapable, {});
  const [secret, setSecret] = useState("");
  if (capable === undefined) {
    return (
      <section className="page">
        <PageSkeleton rows={4} label="Loading platform admin" />
      </section>
    );
  }
  if (!capable.capable && !secret) {
    return (
      <section className="page">
        <header className="page-head">
          <h1>Platform admin</h1>
        </header>
        <EmptyState
          title="Restricted"
          body="Sign in with a platform-admin email, or paste PLATFORM_ADMIN_SECRET to continue."
        />
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("secret");
            setSecret(String(value ?? ""));
          }}
        >
          <label className="filter-field grow">
            <span>Platform secret</span>
            <input name="secret" type="password" autoComplete="off" />
          </label>
          <button type="submit">Unlock</button>
        </form>
      </section>
    );
  }
  return (
    <section className="page">
      <header className="page-head">
        <h1>Platform admin</h1>
        <p>Create organizations and seed administrators. Normal users cannot self-provision orgs.</p>
      </header>
      <div className="stack">
        <DemoSeedPanel secret={capable.capable ? undefined : secret} />
        <CreateOrgPanel secret={capable.capable ? undefined : secret} />
        <AccessRequestsPanel secret={capable.capable ? undefined : secret} />
      </div>
    </section>
  );
}

function DemoSeedPanel({ secret }: { secret?: string }) {
  const seed = useAction(api.demoSeed.seedDemoFleet);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSeed() {
    setError(null);
    setOk(null);
    setPending(true);
    try {
      const result = await seed({
        secret: secret ?? "",
        organizationName: "Demo Power Ghana",
      });
      const users = result.users
        .map((user) => `${user.roleName}: ${user.email}`)
        .join(" · ");
      setOk(
        `Seeded ${result.sites} sites / ${result.gateways} gateways. Password ${result.password}. ${users}. Unactivated: ${result.unactivated.email}`,
      );
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Demo fleet seed">
      <p className="meta">
        Creates Demo Power Ghana with 56 regional sites, linked gateways, health/telemetry, and
        Admin / Sub-admin / Operator / Viewer users plus one unactivated account.
      </p>
      {error ? <p className="err">{error}</p> : null}
      {ok ? <p className="notice" role="status">{ok}</p> : null}
      <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void onSeed()}>
        {pending ? "Seeding…" : "Seed demo fleet"}
      </button>
    </Panel>
  );
}

function CreateOrgPanel({ secret }: { secret?: string }) {
  const createOrg = useAction(api.platformAdmin.createOrganization);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await createOrg({
        secret: secret ?? "",
        name: String(form.get("name") ?? ""),
        siteCodeFormat: String(form.get("siteCodeFormat") ?? "text") === "numeric" ? "numeric" : "text",
        adminEmail: String(form.get("adminEmail") ?? "") || undefined,
        adminUsername: String(form.get("adminUsername") ?? "") || undefined,
        adminPassword: String(form.get("adminPassword") ?? "") || undefined,
        adminName: String(form.get("adminName") ?? "") || undefined,
      });
      setOk(`Organization created (${String(result.organizationId).slice(0, 8)}…).`);
      event.currentTarget.reset();
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Create organization">
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Organization name</span>
          <input name="name" required disabled={pending} />
        </label>
        <label className="field">
          <span>Site code format</span>
          <select name="siteCodeFormat" defaultValue="text" disabled={pending}>
            <option value="text">Text</option>
            <option value="numeric">Numeric only</option>
          </select>
        </label>
        <h3>Seed admin (optional)</h3>
        <label className="field">
          <span>Admin name</span>
          <input name="adminName" disabled={pending} />
        </label>
        <label className="field">
          <span>Admin username</span>
          <input name="adminUsername" disabled={pending} />
        </label>
        <label className="field">
          <span>Admin email</span>
          <input name="adminEmail" type="email" disabled={pending} />
        </label>
        <PasswordField label="Admin password" name="adminPassword" disabled={pending} minLength={8} />
        {error ? <p className="err">{error}</p> : null}
        {ok ? <p className="meta">{ok}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create organization"}
        </button>
      </form>
    </Panel>
  );
}

function AccessRequestsPanel({ secret }: { secret?: string }) {
  const requests = useQuery(api.platformAdmin.listAccessRequests, { secret });
  const close = useMutation(api.platformAdmin.closeAccessRequest);
  if (requests === undefined) {
    return <PageSkeleton rows={3} label="Loading access requests" />;
  }
  return (
    <Panel title="Access requests">
      {requests.length === 0 ? <p className="meta">No pending requests.</p> : null}
      <ul className="stack">
        {requests.map((row) => (
          <li key={row.requestKey}>
            <strong>{row.name}</strong> · {row.email}
            {row.organizationHint ? ` · ${row.organizationHint}` : ""}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                void close({
                  secret,
                  requestKey: row.requestKey as Id<"accessRequests">,
                })
              }
            >
              Close
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
