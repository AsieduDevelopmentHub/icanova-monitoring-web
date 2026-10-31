import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PERMISSIONS } from "../../convex/permissions";
import { accessMessage } from "../fleet/access";
import { OrgGate } from "../admin/OrgGate";

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
  const [roleId, setRoleId] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>(["view.dashboard"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (roles === undefined) {
    return <p className="empty">Loading roles.</p>;
  }
  const current = roles.find((role) => role.roleId === roleId);

  function load(nextId: string) {
    setRoleId(nextId);
    const role = roles?.find((item) => item.roleId === nextId);
    if (role) {
      setName(role.name);
      setSelected(role.permissions);
    }
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
        const created = await createRole({ organizationId, name, permissions: selected });
        setRoleId(created);
      }
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="filter-field">
        <span>Existing role</span>
        <select value={roleId} onChange={(event) => load(event.target.value)}>
          <option value="">New role</option>
          {roles.map((role) => (
            <option key={role.roleId} value={role.roleId}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
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
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : current ? "Update role" : "Create role"}
      </button>
      {error ? <p className="err">{error}</p> : null}
      <p className="meta">Saving checks manage.roles. A hidden checkbox is not the authorization.</p>
    </form>
  );
}
