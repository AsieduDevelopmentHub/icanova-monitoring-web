import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { PageSkeleton } from "../ui/Skeleton";
import { SessionPulse } from "../ui/SessionPulse";
import { sessionView } from "./session";
import { rejectedSessionNotice } from "./sessionGates";
import { FleetBoundary } from "./boundary";
import { id } from "./access";
import { ScopeEmpty, type ScopeEmptyLayout } from "./ScopeEmpty";

type OrgRow = { organizationId: string; name: string; permissions: string[] };

export function LiveGate({
  children,
  emptyLayout = "list",
  emptyCaption,
  emptyColumns,
}: {
  children: (org: OrgRow) => ReactNode;
  emptyLayout?: ScopeEmptyLayout;
  emptyCaption?: string;
  emptyColumns?: string[];
}) {
  const emptyProps = { layout: emptyLayout, caption: emptyCaption, columns: emptyColumns };
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (!import.meta.env.VITE_CONVEX_URL) {
    return <ScopeEmpty reason="offline" {...emptyProps} />;
  }
  if (isLoading) {
    return <SessionPulse compact label="Checking session" />;
  }
  if (!isAuthenticated) {
    return <ScopeEmpty reason="unsigned" {...emptyProps} />;
  }
  return (
    <FleetBoundary>
      <OrgBody emptyProps={emptyProps}>{children}</OrgBody>
    </FleetBoundary>
  );
}

function OrgBody({
  children,
  emptyProps,
}: {
  children: (org: OrgRow) => ReactNode;
  emptyProps: {
    layout: ScopeEmptyLayout;
    caption?: string;
    columns?: string[];
  };
}) {
  const me = useQuery(api.users.me, {});
  const orgs = useQuery(api.organizations.mine, {});
  const ensure = useMutation(api.users.ensure);
  const { signOut } = useAuthActions();
  const [ensureError, setEnsureError] = useState(false);
  const [picked, setPicked] = useState("");

  // Authenticated session with no users row yet → provision once (email-rebind safe).
  useEffect(() => {
    if (me !== null || ensureError) {
      return;
    }
    let cancelled = false;
    void ensure({})
      .then(() => {
        if (!cancelled) setEnsureError(false);
      })
      .catch(() => {
        if (!cancelled) setEnsureError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [me, ensure, ensureError]);

  const gate = sessionView(true, me === undefined ? undefined : me);
  if (gate === "loading" || orgs === undefined || (gate === "rejected" && !ensureError)) {
    return <PageSkeleton rows={4} label="Loading organizations" />;
  }
  if (gate === "rejected") {
    const notice = rejectedSessionNotice();
    return (
      <div className="notice" role="note">
        <strong>{notice.title}</strong> {notice.detail} Convex Auth must be configured on the{" "}
        <code>VITE_CONVEX_URL</code> deployment (<code>JWT_PRIVATE_KEY</code> / <code>JWKS</code>).{" "}
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }
  if (!Array.isArray(orgs) || orgs.length === 0) {
    return <ScopeEmpty reason="organization" {...emptyProps} />;
  }
  const listed = orgs as OrgRow[];
  const org = listed.find((item) => item.organizationId === picked) ?? listed[0];
  return (
    <div className="stack">
      <FilterBar label="Organization">
        <FilterSelect
          label="Organization"
          value={org.organizationId}
          onChange={setPicked}
          options={listed.map((item) => ({ value: item.organizationId, label: item.name }))}
        />
      </FilterBar>
      <FleetBoundary key={org.organizationId}>{children(org)}</FleetBoundary>
    </div>
  );
}

const ALL_SITES = "__all__";

export function SiteSelect({
  organizationId,
  allowAll = false,
  children,
}: {
  organizationId: string;
  allowAll?: boolean;
  children: (
    siteId: Id<"sites"> | null,
    siteName: string,
    moreSites: boolean,
  ) => ReactNode;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [picked, setPicked] = useState(allowAll ? ALL_SITES : "");
  const sites = useQuery(api.sites.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor },
  });
  if (sites === undefined) {
    return <PageSkeleton rows={3} label="Loading sites" />;
  }
  const page = Array.isArray(sites.page) ? sites.page : [];
  if (page.length === 0 && cursor === null) {
    if (allowAll) {
      return (
        <div className="stack">
          <FilterBar label="Site">
            <FilterSelect
              label="Site"
              value={ALL_SITES}
              onChange={setPicked}
              options={[{ value: ALL_SITES, label: "All Sites" }]}
            />
          </FilterBar>
          {children(null, "All Sites", false)}
        </div>
      );
    }
    return (
      <ScopeEmpty
        reason="sites"
        layout="list"
        showSiteFilter
        caption="Site inventory"
        columns={["Site", "Generators", "Gateways"]}
      />
    );
  }
  const allSelected = allowAll && (picked === ALL_SITES || picked === "");
  const selected = allSelected ? null : page.find((site) => site._id === picked) ?? page[0];
  const options = [
    ...(allowAll ? [{ value: ALL_SITES, label: "All Sites" }] : []),
    ...page.map((site) => ({ value: site._id, label: site.name })),
  ];
  return (
    <div className="stack">
      <FilterBar label="Site">
        <FilterSelect
          label="Site"
          value={allSelected ? ALL_SITES : (selected?._id ?? "")}
          onChange={setPicked}
          options={options}
        />
      </FilterBar>
      {sites.isDone === false ? (
        <p className="meta">
          More sites exist than this page.{" "}
          {sites.continueCursor ? (
            <button type="button" className="text-btn" onClick={() => setCursor(sites.continueCursor)}>
              Next sites
            </button>
          ) : null}
        </p>
      ) : null}
      {allSelected
        ? children(null, "All Sites", sites.isDone === false)
        : selected
          ? children(id<"sites">(selected._id), selected.name, sites.isDone === false)
          : null}
    </div>
  );
}
