import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FleetBoundary } from "../fleet/boundary";
import { useBearerToken } from "../fleet/useBearer";
import { FilterSelect } from "../ui/FilterBar";

export function OrgGate({
  title,
  lede,
  offline,
  children,
}: {
  title: string;
  lede: string;
  offline: string;
  children: (organizationId: Id<"organizations">) => ReactNode;
}) {
  return (
    <section className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p>{lede}</p>
      </header>
      {import.meta.env.VITE_CONVEX_URL ? (
        <Signed offline={offline}>{children}</Signed>
      ) : (
        <div className="notice" role="note">
          {offline}
        </div>
      )}
    </section>
  );
}

function Signed({
  offline,
  children,
}: {
  offline: string;
  children: (organizationId: Id<"organizations">) => ReactNode;
}) {
  const token = useBearerToken();
  if (!token) {
    return (
      <div className="notice" role="note">
        <strong>Not signed in.</strong> {offline}
      </div>
    );
  }
  return (
    <FleetBoundary>
      <Picker>{children}</Picker>
    </FleetBoundary>
  );
}

function Picker({ children }: { children: (organizationId: Id<"organizations">) => ReactNode }) {
  const orgs = useQuery(api.organizations.mine, {});
  const [picked, setPicked] = useState("");
  if (orgs === undefined) {
    return <p className="empty">Loading organizations.</p>;
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return <p className="empty">This account has no organization membership.</p>;
  }
  const organizationId = orgs.some((org) => org.organizationId === picked)
    ? picked
    : orgs[0].organizationId;
  return (
    <div className="stack">
      <FilterSelect
        label="Organization"
        value={organizationId}
        onChange={setPicked}
        options={orgs.map((org) => ({ value: org.organizationId, label: org.name }))}
      />
      <FleetBoundary key={organizationId}>{children(organizationId as Id<"organizations">)}</FleetBoundary>
    </div>
  );
}
