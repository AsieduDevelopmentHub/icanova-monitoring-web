import { useState, type ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FleetBoundary } from "../fleet/boundary";
import { ScopeEmpty } from "../fleet/ScopeEmpty";
import { FilterSelect } from "../ui/FilterBar";
import { PageSkeleton } from "../ui/Skeleton";

export function OrgGate({
  title,
  lede,
  offline,
  children,
  emptyLayout = "list",
}: {
  title: string;
  lede?: string;
  offline: string;
  children: (organizationId: Id<"organizations">) => ReactNode;
  emptyLayout?: "list" | "desk";
}) {
  return (
    <section className="page">
      <header className="page-head">
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </header>
      {import.meta.env.VITE_CONVEX_URL ? (
        <Signed offline={offline} emptyLayout={emptyLayout}>
          {children}
        </Signed>
      ) : (
        <ScopeEmpty reason="offline" layout={emptyLayout} showSiteFilter={false} caption={title} />
      )}
    </section>
  );
}

function Signed({
  offline,
  emptyLayout,
  children,
}: {
  offline: string;
  emptyLayout: "list" | "desk";
  children: (organizationId: Id<"organizations">) => ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) {
    return <PageSkeleton rows={4} label="Checking session" />;
  }
  if (!isAuthenticated) {
    return <ScopeEmpty reason="unsigned" layout={emptyLayout} showSiteFilter={false} caption={offline} />;
  }
  return (
    <FleetBoundary>
      <Picker emptyLayout={emptyLayout}>{children}</Picker>
    </FleetBoundary>
  );
}

function Picker({
  children,
  emptyLayout,
}: {
  children: (organizationId: Id<"organizations">) => ReactNode;
  emptyLayout: "list" | "desk";
}) {
  const orgs = useQuery(api.organizations.mine, {});
  const [picked, setPicked] = useState("");
  if (orgs === undefined) {
    return <PageSkeleton rows={3} label="Loading organizations" />;
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return (
      <ScopeEmpty
        reason="organization"
        layout={emptyLayout}
        showSiteFilter={false}
        caption="Organization members"
        columns={["Name", "Role", "Status"]}
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
