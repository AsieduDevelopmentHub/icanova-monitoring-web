import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { OrgGate } from "../admin/OrgGate";
import { accessMessage } from "../fleet/access";
import { labelForNotifyEvent, NOTIFY_EVENT_CATALOG } from "../notify/eventCatalog";
import {
  createBrowserPushSubscription,
  detectBrowserPushSupport,
  dropLocalPushSubscription,
  permissionState,
} from "../notify/webPush";
import { DataTable } from "../ui/DataTable";
import { FilterSelect } from "../ui/FilterBar";
import { Panel } from "../ui/Panel";
import { StatusMark } from "../ui/StatusMark";
import { Tabs } from "../ui/Tabs";
import { PageSkeleton, Skeleton } from "../ui/Skeleton";

const EVENTS = NOTIFY_EVENT_CATALOG.map((row) => row.event);
const CHANNELS = ["inapp", "email", "sms", "push"] as const;

function categoryFor(event: string): string {
  if (event.startsWith("alarm.")) {
    return "Alarm";
  }
  if (event.startsWith("health.gateway.")) {
    return "Gateway connectivity";
  }
  if (event.startsWith("health.telemetry.")) {
    return "Measurement freshness";
  }
  if (event === "device.registered") {
    return "Administrative";
  }
  return "System";
}

export function Notifications() {
  return (
    <OrgGate title="Notifications" offline="No notification query is running.">
      {(organizationId) => <Desk organizationId={organizationId} />}
    </OrgGate>
  );
}

function Desk({ organizationId }: { organizationId: Id<"organizations"> }) {
  const [tab, setTab] = useState<"inbox" | "settings" | "delivery">("inbox");
  return (
    <div className="stack">
      <Tabs
        label="Notification sections"
        value={tab}
        onChange={setTab}
        items={[
          { id: "inbox", label: "Inbox" },
          { id: "settings", label: "Settings" },
          { id: "delivery", label: "Delivery history" },
        ]}
      />
      {tab === "inbox" ? <Inbox organizationId={organizationId} /> : null}
      {tab === "settings" ? <Settings organizationId={organizationId} /> : null}
      {tab === "delivery" ? <Delivery organizationId={organizationId} /> : null}
    </div>
  );
}

function Inbox({ organizationId }: { organizationId: Id<"organizations"> }) {
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
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
    unreadOnly: readFilter === "unread",
    event: event === "all" ? null : event,
    severity,
    siteId: siteId === "all" ? null : (siteId as Id<"sites">),
    paginationOpts: { numItems: 30, cursor: null },
  });
  const markRead = useMutation(api.notifications.markRead);
  const markUnread = useMutation(api.notifications.markUnread);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [error, setError] = useState<string | null>(null);

  if (inbox === undefined || sites === undefined || unread === undefined) {
    return <PageSkeleton rows={6} label="Loading inbox" />;
  }

  const rows =
    readFilter === "read" ? inbox.page.filter((row) => row.readAt != null) : inbox.page;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <Panel
      title="Inbox"
      actions={
        <button type="button" className="btn btn-secondary" onClick={() => run(() => markAllRead({ organizationId }))}>
          Mark all read
        </button>
      }
    >
      <p className="meta">
        Unread <StatusMark tone={unread > 0 ? "warn" : "ok"}>{unread}</StatusMark>
      </p>
      <div className="filter-bar">
        <FilterSelect
          label="State"
          value={readFilter}
          onChange={(value) => setReadFilter(value as typeof readFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "unread", label: "Unread" },
            { value: "read", label: "Read" },
          ]}
        />
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
      </div>
      <DataTable
        caption="In-app notifications"
        rows={rows}
        getRowKey={(row) => row._id}
        empty="No notifications match these filters."
        columns={[
          {
            key: "state",
            header: "State",
            render: (row) =>
              row.readAt == null ? <StatusMark tone="warn">unread</StatusMark> : "read",
          },
          {
            key: "category",
            header: "Category",
            render: (row) => categoryFor(row.event),
          },
          { key: "event", header: "Event", render: (row) => row.event },
          {
            key: "severity",
            header: "Severity",
            render: (row) => (
              <StatusMark
                tone={
                  row.severity === "critical" ? "alarm" : row.severity === "warning" ? "warn" : "ok"
                }
              >
                {row.severity}
              </StatusMark>
            ),
          },
          {
            key: "title",
            header: "Title",
            render: (row) => (
              <span>
                <strong>{row.title}</strong>
                <br />
                <span className="meta">{row.body}</span>
              </span>
            ),
          },
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
                {row.siteId ? <Link to={`/sites/${row.siteId}`}>Site</Link> : null}
                {row.readAt == null ? (
                  <button
                    type="button"
                    onClick={() =>
                      run(() => markRead({ organizationId, notificationId: row._id }))
                    }
                  >
                    Mark read
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      run(() => markUnread({ organizationId, notificationId: row._id }))
                    }
                  >
                    Mark unread
                  </button>
                )}
              </span>
            ),
          },
        ]}
      />
      {error ? <p className="err">{error}</p> : null}
    </Panel>
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
    return <Skeleton lines={5} />;
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
      <BrowserPushPanel organizationId={organizationId} />
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
              : `${settings.escalateAfterMinutes} min`}
            .
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
      <Panel title="Event catalog">
        <DataTable
          caption="Notification events"
          rows={[...NOTIFY_EVENT_CATALOG]}
          getRowKey={(row) => row.event}
          empty="No events defined."
          columns={[
            { key: "label", header: "Event", render: (row) => row.label },
            { key: "id", header: "Id", render: (row) => row.event },
            { key: "when", header: "Emitted when", render: (row) => row.when },
            {
              key: "subject",
              header: "Sample subject",
              render: (row) => row.sampleSubject,
            },
          ]}
        />
      </Panel>
      <h2>Policies</h2>
      <p className="meta">
        Channel × event matrix. Push delivery requires VAPID env plus an active browser subscription.
      </p>
      {EVENTS.map((eventName) => (
        <div key={eventName} className="filter-bar">
          <span title={eventName}>{labelForNotifyEvent(eventName)}</span>
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

function BrowserPushPanel({ organizationId }: { organizationId: Id<"organizations"> }) {
  const vapid = useQuery(api.push.vapidPublicKey, { organizationId });
  const status = useQuery(api.push.mySubscriptionStatus, { organizationId });
  const subscribe = useMutation(api.push.subscribe);
  const unsubscribeAll = useMutation(api.push.unsubscribeAll);
  const savePreference = useMutation(api.notifications.savePreference);
  const preference = useQuery(api.notifications.myPreference, { organizationId });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const support = detectBrowserPushSupport();
  const permission = permissionState();

  if (vapid === undefined || status === undefined || preference === undefined) {
    return <Skeleton lines={5} />;
  }

  async function enablePush() {
    setError(null);
    setBusy(true);
    try {
      if (!vapid?.configured || !vapid.publicKey) {
        throw new Error("Browser push is not configured on this deployment yet");
      }
      const payload = await createBrowserPushSubscription(vapid.publicKey);
      await subscribe({
        organizationId,
        endpoint: payload.endpoint,
        p256dh: payload.p256dh,
        auth: payload.auth,
        expirationTime: payload.expirationTime,
        userAgentLabel: payload.userAgentLabel,
      });
      await savePreference({
        organizationId,
        email: preference?.email ?? null,
        phone: preference?.phone ?? null,
        emailEnabled: preference?.emailEnabled ?? false,
        smsEnabled: preference?.smsEnabled ?? false,
        pushEnabled: true,
        inAppEnabled: preference?.inAppEnabled ?? true,
        minSeverity: preference?.minSeverity ?? "informational",
        subscribedSiteIds: preference?.subscribedSiteIds,
      });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setError(null);
    setBusy(true);
    try {
      await unsubscribeAll({ organizationId });
      await dropLocalPushSubscription();
      await savePreference({
        organizationId,
        email: preference?.email ?? null,
        phone: preference?.phone ?? null,
        emailEnabled: preference?.emailEnabled ?? false,
        smsEnabled: preference?.smsEnabled ?? false,
        pushEnabled: false,
        inAppEnabled: preference?.inAppEnabled ?? true,
        minSeverity: preference?.minSeverity ?? "informational",
        subscribedSiteIds: preference?.subscribedSiteIds,
      });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Browser push">
      <p className="meta">
        Support: {support.supported ? "available" : support.reason}. Permission: {permission}. Server
        VAPID: {vapid.configured ? "configured" : "not configured"}. Active subscriptions:{" "}
        {status.activeCount}.
      </p>
      <div className="filter-bar">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !support.supported}
          onClick={() => void enablePush()}
        >
          Enable browser notifications
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || status.activeCount === 0}
          onClick={() => void disablePush()}
        >
          Disable on this account
        </button>
      </div>
      {status.subscriptions.length > 0 ? (
        <ul className="meta">
          {status.subscriptions.map((row) => (
            <li key={row.id}>
              Browser · registered {new Date(row.createdAt).toISOString()}
              {row.lastSuccessAt
                ? ` · last accepted ${new Date(row.lastSuccessAt).toISOString()}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
    </Panel>
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
    return <Skeleton lines={5} />;
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
      <p className="meta">
        Outbox outcomes for email, SMS, and browser push. Accepted by a push service does not mean the
        notification was displayed or read.
      </p>
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
          {
            key: "category",
            header: "Failure category",
            render: (row) => row.failureCategory ?? "—",
          },
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
          {
            key: "next",
            header: "Next retry",
            render: (row) => (row.nextAttemptAt ? new Date(row.nextAttemptAt).toISOString() : "—"),
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
      <p className="meta">Retries stop after 3 attempts. Provider keys and push endpoints are never shown.</p>
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
      <p className="meta">
        Creating an in-app notification is separate from delivering email, SMS, or browser push.
      </p>
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
        Browser push preference (delivery still needs an active subscription below)
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
