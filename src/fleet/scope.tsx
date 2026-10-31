import { useAuthActions } from "@convex-dev/auth/react";
import { useEffect, useState, type ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { sessionView } from "./session";
import { rejectedSessionNotice, unsignedNotice } from "./sessionGates";
import { FleetBoundary } from "./boundary";
import { id } from "./access";

type OrgRow = { organizationId: string; name: string; permissions: string[] };

export function LiveGate({ children }: { children: (org: OrgRow) => ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (!import.meta.env.VITE_CONVEX_URL) {
    return (
      <div className="notice" role="note">
        <strong>No deployment URL.</strong> Live queries are not running.
      </div>
    );
  }
  if (isLoading) {
    return <p className="empty">Checking session…</p>;
  }
  if (!isAuthenticated) {
    const notice = unsignedNotice("No organization query is running.");
    return (
      <div className="notice" role="note">
        <strong>{notice.title}</strong> {notice.detail}
      </div>
    );
  }
  return (
    <FleetBoundary>
      <OrgBody>{children}</OrgBody>
    </FleetBoundary>
  );
}

function OrgBody({ children }: { children: (org: OrgRow) => ReactNode }) {
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
    return <p className="empty">Loading organizations.</p>;
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
    return <p className="empty">This account has no organization membership.</p>;
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

export function SiteSelect({
  organizationId,
  children,
}: {
  organizationId: string;
  children: (siteId: Id<"sites">, siteName: string, moreSites: boolean) => ReactNode;
}) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const sites = useQuery(api.sites.list, {
    organizationId: id<"organizations">(organizationId),
    paginationOpts: { numItems: 50, cursor },
  });
  if (sites === undefined) {
    return <p className="empty">Loading sites.</p>;
  }
  const page = Array.isArray(sites.page) ? sites.page : [];
  if (page.length === 0 && cursor === null) {
    return (
      <p className="empty">
        No sites are registered in this organization. Create a site on Generators, then register the
        gateway there. Its identity is the 12-character efuse MAC.
      </p>
    );
  }
  const selected = page.find((site) => site._id === picked) ?? page[0];
  return (
    <div className="stack">
      <FilterBar label="Site">
        <FilterSelect
          label="Site"
          value={selected?._id ?? ""}
          onChange={setPicked}
          options={page.map((site) => ({ value: site._id, label: site.name }))}
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
      {selected ? children(id<"sites">(selected._id), selected.name, sites.isDone === false) : null}
    </div>
  );
}
