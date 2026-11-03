import { Link } from "react-router";
import type { ReactNode } from "react";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { StatusStrip } from "../ui/StatusStrip";

export type ScopeEmptyReason = "organization" | "sites" | "unsigned" | "offline";
export type ScopeEmptyLayout = "command" | "list" | "desk";

const COPY: Record<ScopeEmptyReason, { title: string; body: string; action?: ReactNode }> = {
  organization: {
    title: "Account not yet activated",
    body: "No organization membership on this account.",
  },
  sites: {
    title: "No sites yet",
    body: "Provision a site and gateway together.",
    action: <Link to="/sites">Sites</Link>,
  },
  unsigned: {
    title: "Sign in required",
    body: "",
    action: <Link to="/auth/login">Sign in</Link>,
  },
  offline: {
    title: "Live data unavailable",
    body: "",
  },
};

/** Keeps page chrome (filters + section frames) when scope has no org/site/data. */
export function ScopeEmpty({
  reason,
  layout = "list",
  showSiteFilter = true,
  caption = "Organization data",
  columns = ["Name", "Status", "Updated"],
  platformCapable = false,
}: {
  reason: ScopeEmptyReason;
  layout?: ScopeEmptyLayout;
  showSiteFilter?: boolean;
  caption?: string;
  columns?: string[];
  platformCapable?: boolean;
}) {
  const copy = COPY[reason];
  if (reason === "organization") {
    return (
      <div className="stack scope-empty">
        <EmptyState
          title={copy.title}
          body={copy.body}
          action={
            platformCapable ? <Link to="/admin/platform">Open Platform admin</Link> : undefined
          }
        />
      </div>
    );
  }
  return (
    <div className="stack scope-empty">
      <FilterBar label="Scope">
        <FilterSelect
          label="Organization"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: "", label: "—" }]}
        />
        {showSiteFilter ? (
          <FilterSelect
            label="Site"
            value=""
            onChange={() => {}}
            disabled
            options={[{ value: "", label: reason === "sites" ? "No sites" : "—" }]}
          />
        ) : null}
      </FilterBar>

      {layout === "command" ? (
        <div className="cc-layout">
          <StatusStrip
            title={reason === "sites" ? "All Sites" : "Fleet"}
            subtitle={copy.title}
            items={[
              { label: "Sites", value: "0" },
              { label: "Generators", value: "0" },
              { label: "Running", value: "0" },
              { label: "Stopped", value: "0" },
              { label: "Alarms", value: "0", tone: "ok" },
              { label: "Offline GW", value: "0", tone: "ok" },
            ]}
            trailing={<span className="status-strip-pill tone-offline">{copy.title}</span>}
          />
          <EmptyState title={copy.title} body={copy.body} action={copy.action} />
          <DataTable
            caption="Fleet rows"
            rows={[]}
            getRowKey={() => "empty"}
            empty="No generators in this scope."
            columns={[
              { key: "name", header: "Generator", render: () => null },
              { key: "site", header: "Site", render: () => null },
              { key: "state", header: "State", render: () => null },
              { key: "power", header: "Power", render: () => null },
            ]}
          />
        </div>
      ) : null}

      {layout === "list" ? (
        <>
          <EmptyState title={copy.title} body={copy.body} action={copy.action} />
          <DataTable
            caption={caption}
            rows={[]}
            getRowKey={() => "empty"}
            empty="No rows for this scope yet."
            columns={columns.map((header) => ({
              key: header.toLowerCase().replace(/\s+/g, "-"),
              header,
              render: () => null,
            }))}
          />
        </>
      ) : null}

      {layout === "desk" ? (
        <>
          <EmptyState title={copy.title} body={copy.body} action={copy.action} />
        </>
      ) : null}
    </div>
  );
}
