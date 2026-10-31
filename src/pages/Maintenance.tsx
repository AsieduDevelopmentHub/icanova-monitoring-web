import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { DataTable } from "../ui/DataTable";

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
  const [generatorId, setGeneratorId] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (page === undefined || generators === undefined) {
    return <p className="empty">Loading maintenance records.</p>;
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
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <div className="stack">
      <DataTable
        caption="Maintenance records"
        rows={page.page}
        getRowKey={(row) => row._id}
        empty="No maintenance records."
        columns={[
          { key: "summary", header: "Summary", render: (row) => row.summary },
          { key: "notes", header: "Notes", render: (row) => row.notes || "—" },
          {
            key: "performed",
            header: "Performed",
            render: (row) => (row.performedAt === null ? "—" : String(row.performedAt)),
          },
        ]}
      />
      <form className="stack" onSubmit={onSubmit}>
        <label className="filter-field">
          <span>Generator</span>
          <select value={selected} onChange={(event) => setGeneratorId(event.target.value)}>
            {generators.map((row) => (
              <option key={row.generatorId} value={row.generatorId}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Summary</span>
          <input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="filter-field">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button type="submit">Record maintenance</button>
        <p className="meta">Performed time stays empty unless a source clock is supplied. Recording checks manage.maintenance.</p>
      </form>
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
