import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { DataTable } from "../ui/DataTable";
import { FilterSelect } from "../ui/FilterBar";
import { StatusMark } from "../ui/StatusMark";

const EVENTS = [
  "alarm.raised",
  "alarm.acknowledged",
  "alarm.cleared",
  "device.registered",
] as const;
const CHANNELS = ["inapp", "email", "sms", "push"] as const;

export function Notifications() {
  return (
    <OrgGate
      title="Notifications"
      lede="In-app notices, organization policies, and delivery history. Email uses Resend and SMS uses Arkesel when those server credentials are set. Push has no VAPID sender."
      offline="No notification query is running."
    >
      {(organizationId) => <Desk organizationId={organizationId} />}
    </OrgGate>
  );
}

function Desk({ organizationId }: { organizationId: Id<"organizations"> }) {
  const [tab, setTab] = useState<"inbox" | "settings" | "delivery">("inbox");
  return (
    <div className="stack">
      <div className="filter-bar">
        <button type="button" className={tab === "inbox" ? "on" : undefined} onClick={() => setTab("inbox")}>
          Inbox
        </button>
        <button
          type="button"
          className={tab === "settings" ? "on" : undefined}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
        <button
          type="button"
          className={tab === "delivery" ? "on" : undefined}
          onClick={() => setTab("delivery")}
        >
          Delivery history
        </button>
      </div>
      {tab === "inbox" ? <Inbox organizationId={organizationId} /> : null}
      {tab === "settings" ? <Settings organizationId={organizationId} /> : null}
      {tab === "delivery" ? <Delivery organizationId={organizationId} /> : null}
    </div>
  );
}

function Inbox({ organizationId }: { organizationId: Id<"organizations"> }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [event, setEvent] = useState<string>("all");
  const [severity, setSeverity] = useState<"all" | "critical" | "warning" | "informational">("all");
  const [siteId, setSiteId] = useState<string>("all");
  const sites = useQuery(api.sites.list, {
    organizationId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const unread = useQuery(api.notifications.unreadCount, { organizationId });
  const inbox = useQuery(api.notifications.listInbox, {
    organizationId,
    unreadOnly,
    event: event === "all" ? null : event,
    severity,
    siteId: siteId === "all" ? null : (siteId as Id<"sites">),
    paginationOpts: { numItems: 30, cursor: null },
  });
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [error, setError] = useState<string | null>(null);

  if (inbox === undefined || sites === undefined || unread === undefined) {
    return <p className="empty">Loading inbox.</p>;
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
      <p className="meta">
        Unread <StatusMark tone={unread > 0 ? "warn" : "ok"}>{unread}</StatusMark>
      </p>
      <div className="filter-bar">
        <label className="check">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(eventChange) => setUnreadOnly(eventChange.target.checked)}
          />
          Unread only
        </label>
        <FilterSelect
          label="Event"
          value={event}
          onChange={setEvent}
          options={[
            { value: "all", label: "All events" },
            ...EVENTS.map((name) => ({ value: name, label: name })),
          ]}
        />
        <FilterSelect
          label="Severity"
          value={severity}
          onChange={(value) => setSeverity(value as typeof severity)}
          options={[
            { value: "all", label: "All severities" },
            { value: "critical", label: "Critical" },
            { value: "warning", label: "Warning" },
            { value: "informational", label: "Informational" },
          ]}
        />
        <FilterSelect
          label="Site"
          value={siteId}
          onChange={setSiteId}
          options={[
            { value: "all", label: "All sites" },
            ...sites.page.map((site) => ({ value: site._id, label: site.name })),
          ]}
        />
        <button type="button" onClick={() => run(() => markAllRead({ organizationId }))}>
          Mark page unread as read
        </button>
      </div>
      <DataTable
        caption="In-app notifications"
        rows={inbox.page}
        getRowKey={(row) => row._id}
        empty="No notifications match these filters."
        columns={[
          {
            key: "state",
            header: "State",
            render: (row) => (row.readAt == null ? <StatusMark tone="warn">unread</StatusMark> : "read"),
          },
          { key: "event", header: "Event", render: (row) => row.event },
          { key: "severity", header: "Severity", render: (row) => row.severity },
          { key: "title", header: "Title", render: (row) => row.title },
          {
            key: "at",
            header: "When",
            render: (row) => new Date(row.createdAt).toISOString(),
          },
          {
            key: "open",
            header: "",
            render: (row) => (
              <span className="filter-bar">
                {row.alarmId ? <Link to={`/alarms/${row.alarmId}`}>Alarm</Link> : null}
                {row.generatorId ? <Link to={`/generators/${row.generatorId}`}>Generator</Link> : null}
                {row.deviceId ? <Link to={`/gateways/${row.deviceId}`}>Gateway</Link> : null}
                {row.readAt == null ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(() => markRead({ organizationId, notificationId: row._id }))
                    }
                  >
                    Mark read
                  </button>
                ) : null}
              </span>
            ),
          },
        ]}
      />
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

function Settings({ organizationId }: { organizationId: Id<"organizations"> }) {
  const policies = useQuery(api.notifications.listPolicies, { organizationId });
  const preference = useQuery(api.notifications.myPreference, { organizationId });
  const settings = useQuery(api.notifications.getSettings, { organizationId });
  const savePolicy = useMutation(api.notifications.savePolicy);
  const savePreference = useMutation(api.notifications.savePreference);
  const saveSettings = useMutation(api.notifications.saveSettings);
  const [error, setError] = useState<string | null>(null);
  const [escalate, setEscalate] = useState("");
  const [minSeverity, setMinSeverity] = useState<"critical" | "warning" | "informational">("warning");

  if (policies === undefined || preference === undefined) {
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
      {settings ? (
        <form
          className="stack"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            run(() =>
              saveSettings({
                organizationId,
                minSeverity: minSeverity || settings.minSeverity,
                escalateAfterMinutes: escalate.trim() ? Number(escalate) : null,
              }),
            );
          }}
        >
          <h2>Organization defaults</h2>
          <p className="meta">
            Current minimum severity {settings.minSeverity}. Escalation{" "}
            {settings.escalateAfterMinutes == null
              ? "disabled"
              : `${settings.escalateAfterMinutes} min`}.
          </p>
          <FilterSelect
            label="Minimum severity"
            value={minSeverity}
            onChange={(value) => setMinSeverity(value as typeof minSeverity)}
            options={[
              { value: "critical", label: "Critical" },
              { value: "warning", label: "Warning" },
              { value: "informational", label: "Informational" },
            ]}
          />
          <label className="filter-field">
            <span>Escalate after minutes (blank disables)</span>
            <input value={escalate} onChange={(event) => setEscalate(event.target.value)} />
          </label>
          <button type="submit">Save organization settings</button>
        </form>
      ) : (
        <p className="meta">Organization settings require configure.notifications.</p>
      )}
      <h2>Policies</h2>
      <p className="meta">Channels stay off until enabled. Push always records not configured.</p>
      {EVENTS.map((eventName) => (
        <div key={eventName} className="filter-bar">
          <span>{eventName}</span>
          {CHANNELS.map((channelName) => {
            const policy = policies.find(
              (item) => item.event === eventName && item.channel === channelName,
            );
            return (
              <button
                key={channelName}
                type="button"
                onClick={() =>
                  run(() =>
                    savePolicy({
                      organizationId,
                      event: eventName,
                      channel: channelName,
                      enabled: !policy?.enabled,
                    }),
                  )
                }
              >
                {channelName} {policy?.enabled ? "on" : "off"}
              </button>
            );
          })}
        </div>
      ))}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}

function Delivery({ organizationId }: { organizationId: Id<"organizations"> }) {
  const deliveries = useQuery(api.notifications.listDeliveries, {
    organizationId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const retryDelivery = useMutation(api.notifications.retryDelivery);
  const requestDelivery = useMutation(api.notifications.requestDelivery);
  const [error, setError] = useState<string | null>(null);

  if (deliveries === undefined) {
    return <p className="empty">Loading delivery history.</p>;
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
      <h2>Delivery history</h2>
      <DataTable
        caption="Notification attempts"
        rows={deliveries.page}
        getRowKey={(row) => row._id}
        empty="No deliveries recorded."
        columns={[
          { key: "channel", header: "Channel", render: (row) => row.channel },
          { key: "event", header: "Event", render: (row) => row.event ?? "—" },
          { key: "to", header: "Recipient", render: (row) => row.to },
          { key: "status", header: "Status", render: (row) => row.status },
          { key: "attempt", header: "Attempts", align: "right", render: (row) => row.attempt },
          {
            key: "created",
            header: "Created",
            render: (row) => new Date(row.createdAt).toISOString(),
          },
          {
            key: "last",
            header: "Last attempt",
            render: (row) => (row.lastAttemptAt ? new Date(row.lastAttemptAt).toISOString() : "—"),
          },
          { key: "provider", header: "Provider id", render: (row) => row.providerId ?? "—" },
          { key: "error", header: "Failure", render: (row) => row.error ?? "—" },
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
      <p className="meta">Retries stop after 3 attempts. Provider keys are never shown here.</p>
      {error ? <p className="err">{error}</p> : null}
      <RequestButton
        onRequest={(userId) =>
          run(() => requestDelivery({ organizationId, userId, event: "alarm.raised" }))
        }
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
    inAppEnabled?: boolean;
    minSeverity?: "critical" | "warning" | "informational";
  } | null;
  onSave: (fields: {
    email: string | null;
    phone: string | null;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    inAppEnabled: boolean;
    minSeverity: "critical" | "warning" | "informational";
  }) => void;
}) {
  const [email, setEmail] = useState(preference?.email ?? "");
  const [phone, setPhone] = useState(preference?.phone ?? "");
  const [emailEnabled, setEmailEnabled] = useState(preference?.emailEnabled ?? false);
  const [smsEnabled, setSmsEnabled] = useState(preference?.smsEnabled ?? false);
  const [pushEnabled, setPushEnabled] = useState(preference?.pushEnabled ?? false);
  const [inAppEnabled, setInAppEnabled] = useState(preference?.inAppEnabled ?? true);
  const [minSeverity, setMinSeverity] = useState(preference?.minSeverity ?? "informational");
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
          inAppEnabled,
          minSeverity,
        });
      }}
    >
      <h2>Your destinations</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={inAppEnabled}
          onChange={(event) => setInAppEnabled(event.target.checked)}
        />
        In-app notifications
      </label>
      <label className="filter-field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={emailEnabled}
          onChange={(event) => setEmailEnabled(event.target.checked)}
        />
        Email enabled
      </label>
      <label className="filter-field">
        <span>Phone</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={smsEnabled}
          onChange={(event) => setSmsEnabled(event.target.checked)}
        />
        SMS enabled
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={pushEnabled}
          onChange={(event) => setPushEnabled(event.target.checked)}
        />
        Push preference. Delivery stays not configured until a VAPID sender exists.
      </label>
      <FilterSelect
        label="Personal minimum severity"
        value={minSeverity}
        onChange={(value) => setMinSeverity(value as typeof minSeverity)}
        options={[
          { value: "informational", label: "Informational" },
          { value: "warning", label: "Warning" },
          { value: "critical", label: "Critical" },
        ]}
      />
      <button type="submit">Save preference</button>
    </form>
  );
}

function RequestButton({ onRequest }: { onRequest: (userId: Id<"users">) => void }) {
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
