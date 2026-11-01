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
    title: "No organization linked",
    body: "This account is signed in but not a member of an organization yet. Create one to register sites, gateways, and generators.",
    action: <Link to="/generators">Open Generators</Link>,
  },
  sites: {
    title: "No sites yet",
    body: "Create a site for this organization, then register a gateway with its 12-character efuse MAC identity.",
    action: <Link to="/generators">Create a site</Link>,
  },
  unsigned: {
    title: "Sign in required",
    body: "Live organization data is not loaded until a session is present.",
    action: <Link to="/auth/login">Sign in</Link>,
  },
  offline: {
    title: "Live data unavailable",
    body: "Convex is not configured in this build, so organization queries are not running.",
  },
};

/** Keeps page chrome (filters + section frames) when scope has no org/site/data. */
export function ScopeEmpty({
  reason,
  layout = "list",
  showSiteFilter = true,
  caption = "Organization data",
  columns = ["Name", "Status", "Updated"],
}: {
  reason: ScopeEmptyReason;
  layout?: ScopeEmptyLayout;
  showSiteFilter?: boolean;
  caption?: string;
  columns?: string[];
}) {
  const copy = COPY[reason];
  return (
    <div className="stack scope-empty">
      <FilterBar label="Scope">
        <FilterSelect
          label="Organization"
          value=""
          onChange={() => {}}
          disabled
          options={[{ value: "", label: reason === "organization" ? "No organization" : "—" }]}
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
          <div className="scope-empty-grid">
            <div className="panel scope-empty-panel">
              <div className="panel-head">
                <h2 className="panel-title">Operational view</h2>
              </div>
              <div className="panel-body">
                <p className="meta">No generators to display.</p>
              </div>
            </div>
            <div className="panel scope-empty-panel">
              <div className="panel-head">
                <h2 className="panel-title">Attention</h2>
              </div>
              <div className="panel-body">
                <p className="meta">Nothing requires attention.</p>
              </div>
            </div>
          </div>
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
          <div className="scope-empty-grid desk">
            <div className="panel scope-empty-panel">
              <div className="panel-head">
                <h2 className="panel-title">Overview</h2>
              </div>
              <div className="panel-body">
                <p className="meta">Counts appear after an organization is linked.</p>
              </div>
            </div>
            <div className="panel scope-empty-panel">
              <div className="panel-head">
                <h2 className="panel-title">Activity</h2>
              </div>
              <div className="panel-body">
                <p className="meta">No operational rows yet.</p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
