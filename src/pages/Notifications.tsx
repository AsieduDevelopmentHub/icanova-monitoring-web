import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { DataTable } from "../ui/DataTable";

const EVENTS = ["alarm.raised", "maintenance.recorded"] as const;
const CHANNELS = ["email", "sms", "push"] as const;

export function Notifications() {
  return (
    <OrgGate
      title="Notifications"
      lede="Resend sends email and Arkesel sends SMS when their server environment variables are set. Web push has no VAPID sender in this deployment."
      offline="No notification query is running."
    >
      {(organizationId) => <Desk organizationId={organizationId} />}
    </OrgGate>
  );
}

function Desk({ organizationId }: { organizationId: Id<"organizations"> }) {
  const policies = useQuery(api.notifications.listPolicies, { organizationId });
  const preference = useQuery(api.notifications.myPreference, { organizationId });
  const deliveries = useQuery(api.notifications.listDeliveries, {
    organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const savePolicy = useMutation(api.notifications.savePolicy);
  const savePreference = useMutation(api.notifications.savePreference);
  const requestDelivery = useMutation(api.notifications.requestDelivery);
  const retryDelivery = useMutation(api.notifications.retryDelivery);
  const [error, setError] = useState<string | null>(null);
  if (policies === undefined || preference === undefined || deliveries === undefined) {
    return <p className="empty">Loading notification settings.</p>;
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <div className="stack">
        <PreferenceForm
          preference={preference}
          onSave={(fields) => run(() => savePreference({ organizationId, ...fields }))}
        />
      <h2>Policies</h2>
      {EVENTS.map((eventName) => (
        <div key={eventName} className="filter-bar">
          <span>{eventName}</span>
          {CHANNELS.map((channel) => {
            const policy = policies.find((item) => item.event === eventName && item.channel === channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() =>
                  run(() =>
                    savePolicy({
                      organizationId,
                      event: eventName,
                      channel,
                      enabled: !policy?.enabled,
                    }),
                  )
                }
              >
                {channel} {policy?.enabled ? "on" : "off"}
              </button>
            );
          })}
        </div>
      ))}
      <h2>Delivery history</h2>
      <DataTable
        caption="Notification attempts"
        rows={deliveries.page}
        getRowKey={(row) => row._id}
        empty="No deliveries recorded."
        columns={[
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "event", header: "Event", render: (row) => row.event ?? "—" },
          { key: "status", header: "Status", render: (row) => row.status },
          { key: "attempt", header: "Attempt", align: "right", render: (row) => row.attempt },
          { key: "error", header: "Error", render: (row) => row.error ?? "—" },
          {
            key: "retry",
            header: "",
            render: (row) => (
              <button type="button" onClick={() => run(() => retryDelivery({ messageId: row._id }))}>
                Retry
              </button>
            ),
          },
        ]}
      />
      <p className="meta">Retries stop after 3 attempts. Push retries record the same not-configured result.</p>
      {error ? <p className="err">{error}</p> : null}
      <RequestButton
        onRequest={(userId) => run(() => requestDelivery({ organizationId, userId, event: "alarm.raised" }))}
      />
    </div>
  );
}

function PreferenceForm({
  preference,
  onSave,
}: {
  preference: {
    email: string | null;
    phone: string | null;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  } | null;
  onSave: (fields: {
    email: string | null;
    phone: string | null;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  }) => void;
}) {
  const [email, setEmail] = useState(preference?.email ?? "");
  const [phone, setPhone] = useState(preference?.phone ?? "");
  const [emailEnabled, setEmailEnabled] = useState(preference?.emailEnabled ?? false);
  const [smsEnabled, setSmsEnabled] = useState(preference?.smsEnabled ?? false);
  const [pushEnabled, setPushEnabled] = useState(preference?.pushEnabled ?? false);
  return (
    <form
      className="stack"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSave({
          email: email.trim() ? email.trim() : null,
          phone: phone.trim() ? phone.trim() : null,
          emailEnabled,
          smsEnabled,
          pushEnabled,
        });
      }}
    >
      <h2>Your destinations</h2>
      <label className="filter-field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} />
        Email enabled
      </label>
      <label className="filter-field">
        <span>Phone</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} />
        SMS enabled
      </label>
      <label className="check">
        <input type="checkbox" checked={pushEnabled} onChange={(event) => setPushEnabled(event.target.checked)} />
        Push preference. Delivery stays not configured until a VAPID sender exists.
      </label>
      <button type="submit">Save preference</button>
    </form>
  );
}

function RequestButton({
  onRequest,
}: {
  onRequest: (userId: Id<"users">) => void;
}) {
  const me = useQuery(api.users.me, {});
  if (!me) {
    return null;
  }
  return (
    <button type="button" onClick={() => onRequest(me._id)}>
      Request alarm.raised for this account
    </button>
  );
}
