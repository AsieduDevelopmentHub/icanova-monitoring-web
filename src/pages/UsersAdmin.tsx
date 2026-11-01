import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { Panel } from "../ui/Panel";
import { PageSkeleton } from "../ui/Skeleton";

export function UsersAdmin() {
  return (
    <OrgGate title="Users" offline="No membership query is running.">
      {(organizationId) => <Roster organizationId={organizationId} />}
    </OrgGate>
  );
}

function Roster({ organizationId }: { organizationId: Id<"organizations"> }) {
  const roster = useQuery(api.organizations.roster, { organizationId });
  const roles = useQuery(api.organizations.listRoles, { organizationId });
  const grant = useMutation(api.organizations.grant);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (roster === undefined || roles === undefined) {
    return <PageSkeleton rows={5} label="Loading users" />;
  }
  const selectedUser = roster.some((row) => row.userId === userId) ? userId : (roster[0]?.userId ?? "");
  const selectedRole = roles.some((role) => role.roleId === roleId) ? roleId : (roles[0]?.roleId ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      await grant({
        organizationId,
        userId: selectedUser as Id<"users">,
        roleId: selectedRole as Id<"roles">,
      });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Membership">
      {roster.length === 0 ? <p className="empty">No members in this page.</p> : null}
      <ul>
        {roster.map((row) => (
          <li key={row.userId}>
            {row.name} · {row.roleName}
          </li>
        ))}
      </ul>
      <form className="form-section" onSubmit={onSubmit}>
        <h2>Grant role</h2>
        <div className="filter-bar">
          <label className="filter-field">
            <span>Member</span>
            <select value={selectedUser} onChange={(event) => setUserId(event.target.value)}>
              {roster.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Role</span>
            <select value={selectedRole} onChange={(event) => setRoleId(event.target.value)}>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Granting…" : "Grant role"}
          </button>
        </div>
      </form>
      {error ? <p className="err">{error}</p> : null}
    </Panel>
  );
}
