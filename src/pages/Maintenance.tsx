import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { DataTable } from "../ui/DataTable";
import { Dialog } from "../ui/Overlay";
import { PageSkeleton } from "../ui/Skeleton";

export function Maintenance() {
  return (
    <OrgGate title="Maintenance" offline="No maintenance query is running.">
      {(organizationId) => <Records organizationId={organizationId} />}
    </OrgGate>
  );
}

function Records({ organizationId }: { organizationId: Id<"organizations"> }) {
  const page = useQuery(api.maintenance.list, {
    organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const generators = useQuery(api.maintenance.generators, { organizationId });
  const create = useMutation(api.maintenance.create);
  const [open, setOpen] = useState(false);
  const [generatorId, setGeneratorId] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (page === undefined || generators === undefined) {
    return <PageSkeleton rows={5} label="Loading maintenance" />;
  }
  const selected = generators.some((row) => row.generatorId === generatorId)
    ? generatorId
    : (generators[0]?.generatorId ?? "");

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

  return (
    <div className="stack">
      <div className="ops-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Record maintenance
        </button>
      </div>
      <DataTable
        dense
        caption="Maintenance"
        rows={page.page}
        getRowKey={(row) => row._id}
        empty="No maintenance records."
        columns={[
          { key: "summary", header: "Summary", render: (row) => row.summary },
          {
            key: "generator",
            header: "Generator",
            render: (row) => (
              <Link to={`/generators/${row.generatorId}`}>
                {generators.find((g) => g.generatorId === row.generatorId)?.name ?? "Open"}
              </Link>
            ),
          },
          { key: "notes", header: "Notes", render: (row) => row.notes || "—" },
          {
            key: "performed",
            header: "Performed",
            render: (row) =>
              row.performedAt == null ? "—" : (
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
              {generators.map((row) => (
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
