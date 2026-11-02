import { useAction, useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { Dialog } from "../ui/Overlay";
import { Panel } from "../ui/Panel";
import { PasswordField } from "../ui/PasswordField";
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
  const [createOpen, setCreateOpen] = useState(false);
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
    <div className="stack">
      <div className="filter-bar">
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          Create user
        </button>
      </div>
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
      <CreateMemberDialog
        open={createOpen}
        organizationId={organizationId}
        roles={roles}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function CreateMemberDialog({
  open,
  organizationId,
  roles,
  onClose,
}: {
  open: boolean;
  organizationId: Id<"organizations">;
  roles: Array<{ roleId: Id<"roles">; name: string }>;
  onClose: () => void;
}) {
  const createMember = useAction(api.organizations.createMember);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const defaultRole =
    roles.find((role) => role.name === "Operator")?.roleId ?? roles[0]?.roleId ?? "";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await createMember({
        organizationId,
        email: String(form.get("email") ?? ""),
        username: String(form.get("username") ?? ""),
        name: String(form.get("name") ?? "") || undefined,
        password: String(form.get("password") ?? ""),
        roleId: String(form.get("roleId") ?? "") as Id<"roles">,
      });
      onClose();
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="Create user" onClose={onClose}>
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Display name</span>
          <input name="name" disabled={pending} />
        </label>
        <label className="field">
          <span>Username</span>
          <input name="username" required minLength={3} maxLength={32} disabled={pending} />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required disabled={pending} />
        </label>
        <PasswordField label="Temporary password" name="password" required minLength={8} disabled={pending} />
        <label className="field">
          <span>Role</span>
          <select name="roleId" defaultValue={defaultRole} required disabled={pending}>
            {roles.map((role) => (
              <option key={role.roleId} value={role.roleId}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="err">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={pending || !defaultRole}>
          {pending ? "Creating…" : "Create user"}
        </button>
      </form>
    </Dialog>
  );
}
