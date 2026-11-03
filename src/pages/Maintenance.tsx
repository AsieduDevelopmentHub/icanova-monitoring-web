import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { siteGeneratorPath } from "../fleet/paths";
import { DataTable } from "../ui/DataTable";
import { Dialog } from "../ui/Overlay";
import { FilterBar, FilterSelect } from "../ui/FilterBar";
import { PageSkeleton } from "../ui/Skeleton";

export function Maintenance() {
  return (
    <OrgGate title="Maintenance" offline="No maintenance query is running.">
      {(organizationId) => <Records organizationId={organizationId} />}
    </OrgGate>
  );
}

function Records({ organizationId }: { organizationId: Id<"organizations"> }) {
  const [params, setParams] = useSearchParams();
  const siteFilter = params.get("site") ?? "";
  const page = useQuery(api.maintenance.list, {
    organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const generators = useQuery(api.maintenance.generators, { organizationId });
  const sites = useQuery(api.sites.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const create = useMutation(api.maintenance.create);
  const [open, setOpen] = useState(false);
  const [generatorId, setGeneratorId] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (page === undefined || generators === undefined || sites === undefined) {
    return <PageSkeleton rows={5} label="Loading maintenance" />;
  }

  const siteNameById = new Map(
    (Array.isArray(sites.page) ? sites.page : []).map((site) => [String(site._id), site.name]),
  );
  const siteOptions = [
    ...new Map(
      generators
        .filter((row) => row.siteId)
        .map((row) => [String(row.siteId), String(row.siteId)] as const),
    ).entries(),
  ].map(([value]) => ({ value, label: siteNameById.get(value) ?? value }));

  const scopedGens = siteFilter
    ? generators.filter((row) => String(row.siteId) === siteFilter)
    : generators;
  const selected = scopedGens.some((row) => row.generatorId === generatorId)
    ? generatorId
    : (scopedGens[0]?.generatorId ?? "");

  const records = siteFilter
    ? page.page.filter((row) =>
        scopedGens.some((g) => g.generatorId === row.generatorId),
      )
    : page.page;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create({
        organizationId,
        generatorId: selected as Id<"generators">,
        summary,
        notes,
        performedAt: null,
      });
      setSummary("");
      setNotes("");
      setOpen(false);
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  function setSite(value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === "all") {
      next.delete("site");
    } else {
      next.set("site", value);
    }
    setParams(next);
  }

  return (
    <div className="stack">
      <div className="ops-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Record maintenance
        </button>
      </div>
      <FilterBar label="Maintenance filters">
        <FilterSelect
          label="Site"
          value={siteFilter || "all"}
          onChange={setSite}
          options={[
            { value: "all", label: "All sites" },
            ...siteOptions.map((opt) => ({
              value: opt.value,
              label: opt.label,
            })),
          ]}
        />
      </FilterBar>
      <DataTable
        dense
        caption="Maintenance"
        rows={records}
        getRowKey={(row) => row._id}
        empty="No maintenance records."
        columns={[
          { key: "summary", header: "Summary", render: (row) => row.summary },
          {
            key: "generator",
            header: "Generator",
            render: (row) => {
              const gen = generators.find((g) => g.generatorId === row.generatorId);
              if (!gen) {
                return "—";
              }
              return gen.siteId ? (
                <Link to={siteGeneratorPath(String(gen.siteId), String(row.generatorId))}>
                  {gen.name}
                </Link>
              ) : (
                gen.name
              );
            },
          },
          { key: "notes", header: "Notes", render: (row) => row.notes || "—" },
          {
            key: "performed",
            header: "Performed",
            render: (row) =>
              row.performedAt == null ? (
                "—"
              ) : (
                <span className="tech">{new Date(row.performedAt).toLocaleString()}</span>
              ),
          },
        ]}
      />
      <Dialog open={open} title="Record maintenance" onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={onSubmit}>
          <label className="field">
            <span>Generator</span>
            <select value={selected} onChange={(event) => setGeneratorId(event.target.value)}>
              {scopedGens.map((row) => (
                <option key={row.generatorId} value={row.generatorId}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Summary</span>
            <input value={summary} onChange={(event) => setSummary(event.target.value)} required />
          </label>
          <label className="field">
            <span>Notes</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          {error ? <p className="err">{error}</p> : null}
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </form>
      </Dialog>
    </div>
  );
}
