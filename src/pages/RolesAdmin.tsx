import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PERMISSIONS } from "../../convex/permissions";
import { accessMessage } from "../fleet/access";
import { OrgGate } from "../admin/OrgGate";
import { DataTable } from "../ui/DataTable";
import { Dialog } from "../ui/Overlay";
import { PageSkeleton } from "../ui/Skeleton";

export function RolesAdmin() {
  return (
    <OrgGate title="Roles" offline="No role query is running.">
      {(organizationId) => <RoleEditor organizationId={organizationId} />}
    </OrgGate>
  );
}

function RoleEditor({ organizationId }: { organizationId: Id<"organizations"> }) {
  const roles = useQuery(api.organizations.listRoles, { organizationId });
  const createRole = useMutation(api.organizations.createRole);
  const updateRole = useMutation(api.organizations.updateRole);
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>(["view.dashboard"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (roles === undefined) {
    return <PageSkeleton rows={4} label="Loading roles" />;
  }
  const current = roles.find((role) => role.roleId === roleId);

  function openNew() {
    setRoleId("");
    setName("");
    setSelected(["view.dashboard"]);
    setError(null);
    setOpen(true);
  }

  function openEdit(nextId: string) {
    const role = roles?.find((item) => item.roleId === nextId);
    if (!role) {
      return;
    }
    setRoleId(nextId);
    setName(role.name);
    setSelected(role.permissions);
    setError(null);
    setOpen(true);
  }

  function toggle(permission: string) {
    setSelected((currentSelected) =>
      currentSelected.includes(permission)
        ? currentSelected.filter((item) => item !== permission)
        : [...currentSelected, permission],
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      if (current) {
        await updateRole({ organizationId, roleId: current.roleId, name, permissions: selected });
      } else {
        await createRole({ organizationId, name, permissions: selected });
      }
      setOpen(false);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <div className="ops-toolbar">
        <button type="button" className="btn btn-primary" onClick={openNew}>
          New role
        </button>
      </div>
      <DataTable
        dense
        caption="Roles"
        rows={roles}
        getRowKey={(row) => row.roleId}
        empty="No roles."
        columns={[
          { key: "name", header: "Role", render: (row) => row.name },
          {
            key: "perms",
            header: "Permissions",
            render: (row) => <span className="tech">{row.permissions.length}</span>,
          },
          {
            key: "edit",
            header: "",
            render: (row) => (
              <button type="button" className="text-btn" onClick={() => openEdit(row.roleId)}>
                Edit
              </button>
            ),
          },
        ]}
      />
      <Dialog open={open} title={current ? "Edit role" : "New role"} onClose={() => setOpen(false)}>
        <form className="stack" onSubmit={onSubmit}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <fieldset>
            <legend>Permissions</legend>
            {PERMISSIONS.map((permission) => (
              <label key={permission} className="check">
                <input
                  type="checkbox"
                  checked={selected.includes(permission)}
                  onChange={() => toggle(permission)}
                />
                {permission}
              </label>
            ))}
          </fieldset>
          {error ? <p className="err">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : current ? "Update" : "Create"}
          </button>
        </form>
      </Dialog>
    </div>
  );
}
