import { useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FleetBoundary } from "../fleet/boundary";
import { unsignedNotice } from "../fleet/sessionGates";
import { EmptyState } from "../ui/EmptyState";
import { FilterSelect } from "../ui/FilterBar";
import { Skeleton } from "../ui/Skeleton";

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
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return <Skeleton lines={4} />;
  }
  if (!isAuthenticated) {
    const notice = unsignedNotice(offline);
    return (
      <div className="notice" role="note">
        <strong>{notice.title}</strong> {notice.detail}
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
    return <Skeleton lines={3} />;
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return (
      <EmptyState
        title="No organization membership"
        body="This account is not a member of an organization yet."
      />
    );
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
