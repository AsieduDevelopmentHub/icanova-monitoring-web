import { useAction, useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { DataTable } from "../ui/DataTable";
import { Dialog } from "../ui/Overlay";
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
  const pending = useQuery(api.memberRequests.listPending, { organizationId });
  const grant = useMutation(api.organizations.grant);
  const confirm = useAction(api.memberRequests.confirm);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  if (roster === undefined || roles === undefined || pending === undefined) {
    return <PageSkeleton rows={5} label="Loading users" />;
  }
  const selectedUser = roster.some((row) => row.userId === userId) ? userId : (roster[0]?.userId ?? "");
  const selectedRole = roles.some((role) => role.roleId === roleId) ? roleId : (roles[0]?.roleId ?? "");

  async function onGrant(event: FormEvent) {
    event.preventDefault();
    if (pendingAction) {
      return;
    }
    setError(null);
    setMessage(null);
    setPendingAction(true);
    try {
      await grant({
        organizationId,
        userId: selectedUser as Id<"users">,
        roleId: selectedRole as Id<"roles">,
      });
      setGrantOpen(false);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPendingAction(false);
    }
  }

  async function onConfirm(requestId: Id<"memberRequests">) {
    setError(null);
    setMessage(null);
    setPendingAction(true);
    try {
      const result = await confirm({ organizationId, requestId });
      setMessage(
        `Confirmed ${result.email}. Temporary password ready for the confirmation email: ${result.temporaryPassword}`,
      );
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPendingAction(false);
    }
  }

  return (
    <div className="stack">
      <div className="ops-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          Request user
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setGrantOpen(true)}>
          Grant role
        </button>
      </div>
      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
      <DataTable
        dense
        caption="Membership"
        rows={roster}
        getRowKey={(row) => row.userId}
        empty="No members."
        columns={[
          { key: "name", header: "Member", render: (row) => row.name },
          { key: "role", header: "Role", render: (row) => row.roleName },
        ]}
      />
      <DataTable
        dense
        caption="Pending requests"
        rows={pending}
        getRowKey={(row) => row.requestId}
        empty="No pending requests."
        columns={[
          { key: "name", header: "Name", render: (row) => row.name },
          { key: "email", header: "Email", render: (row) => row.email },
          { key: "role", header: "Role", render: (row) => row.roleName },
          {
            key: "confirm",
            header: "",
            render: (row) => (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={pendingAction}
                onClick={() => void onConfirm(row.requestId)}
              >
                Confirm
              </button>
            ),
          },
        ]}
      />
      <Dialog open={grantOpen} title="Grant role" onClose={() => setGrantOpen(false)}>
        <form className="stack" onSubmit={onGrant}>
          <label className="field">
            <span>Member</span>
            <select value={selectedUser} onChange={(event) => setUserId(event.target.value)}>
              {roster.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Role</span>
            <select value={selectedRole} onChange={(event) => setRoleId(event.target.value)}>
              {roles.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={pendingAction}>
            {pendingAction ? "Granting…" : "Grant"}
          </button>
        </form>
      </Dialog>
      <RequestMemberDialog
        open={createOpen}
        organizationId={organizationId}
        roles={roles}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}

function RequestMemberDialog({
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
  const requestMember = useMutation(api.memberRequests.request);
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
      await requestMember({
        organizationId,
        email: String(form.get("email") ?? ""),
        name: String(form.get("name") ?? ""),
        roleId: String(form.get("roleId") ?? "") as Id<"roles">,
        note: String(form.get("note") ?? "") || undefined,
      });
      onClose();
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="Request user" onClose={onClose}>
      <form className="stack" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Full name</span>
          <input name="name" required disabled={pending} />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" required disabled={pending} />
        </label>
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
        <label className="field">
          <span>Note (optional)</span>
          <input name="note" disabled={pending} />
        </label>
        {error ? <p className="err">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={pending || !defaultRole}>
          {pending ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </Dialog>
  );
}
