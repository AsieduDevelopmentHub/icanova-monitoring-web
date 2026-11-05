import { useState, type FormEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { accessMessage, id } from "../fleet/access";
import { FleetBoundary } from "../fleet/boundary";
import { demoAlarms } from "../telemetry/alarms";
import { demoSamples } from "../telemetry/demoLog";
import { DEMO_SOURCE } from "../telemetry/logModel";
import { StatusMark } from "../ui/StatusMark";
import { PageSkeleton } from "../ui/Skeleton";
import {
  acknowledgementLabel,
  alarmTime,
  canAcknowledge,
  canManageAlarms,
  categoryLabel,
  severityTone,
} from "../telemetry/alarmCenter";

const demoRows = demoAlarms(demoSamples);

export function AlarmDetail() {
  const { id: alarmId } = useParams();
  if (!alarmId) {
    return (
      <section className="page ops-page">
        <h1>Alarm</h1>
        <p>Missing id.</p>
      </section>
    );
  }
  const demo = demoRows.find((row) => row.id === alarmId);
  if (demo || !import.meta.env.VITE_CONVEX_URL) {
    if (!demo) {
      return (
        <section className="page ops-page">
          <p className="meta">That id is not in the demo log.</p>
        </section>
      );
    }
    return <DemoAlarm row={demo} />;
  }
  return (
    <FleetBoundary key={alarmId}>
      <StoredAlarm alarmId={alarmId} />
    </FleetBoundary>
  );
}

function DemoAlarm({ row }: { row: (typeof demoRows)[number] }) {
  return (
    <section className="page ops-page">
      <header className="page-identity">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{row.summary}</h1>
          <p className="meta">
            <Link to="/alarms">Alarms</Link>
          </p>
        </div>
      </header>
      <p className="meta" role="note">
        Demo · {DEMO_SOURCE}
      </p>
      <div className="status-row">
        <StatusMark tone={row.kind === "transport" ? "warn" : "alarm"}>{row.kind}</StatusMark>
      </div>
      {row.detail ? <p className="meta">{row.detail}</p> : null}
    </section>
  );
}

function StoredAlarm({ alarmId }: { alarmId: string }) {
  const data = useQuery(api.alarms.detail, { alarmId: id<"alarms">(alarmId) });
  const orgs = useQuery(api.organizations.mine, {});
  const acknowledge = useMutation(api.alarms.acknowledge);
  const clear = useMutation(api.alarms.clear);
  const resolve = useMutation(api.alarms.resolve);
  const assign = useMutation(api.alarms.assign);
  const comment = useMutation(api.alarms.comment);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <section className="page ops-page">
        <PageSkeleton rows={6} label="Loading alarm" />
      </section>
    );
  }
  const alarm = data.alarm;
  const permissions =
    orgs?.find((org) => org.organizationId === alarm.organizationId)?.permissions ?? [];
  const allowAck = canAcknowledge(permissions);
  const allowManage = canManageAlarms(permissions);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(accessMessage(caught));
    }
  }

  return (
    <section className="page ops-page">
      <header className="page-identity">
        <div className="page-identity-main">
          <h1 className="page-identity-title">{alarm.summary}</h1>
        </div>
      </header>
      <div className="status-row">
        <StatusMark tone={severityTone(alarm.severity)}>{alarm.severity}</StatusMark>
        <StatusMark
          tone={
            alarm.state === "resolved" || alarm.state === "cleared"
              ? "ok"
              : alarm.state === "active"
                ? "alarm"
                : "warn"
          }
        >
          {alarm.state}
        </StatusMark>
        <span className="meta">{categoryLabel(alarm)}</span>
      </div>
      {alarm.detail ? <p className="meta">{alarm.detail}</p> : null}
      <dl className="facts">
        <dt>Site</dt>
        <dd>
          {alarm.siteId ? <Link to={`/sites/${alarm.siteId}`}>{alarm.siteName ?? "Site"}</Link> : "—"}
        </dd>
        <dt>Generator</dt>
        <dd>
          {alarm.generatorId ? (
            <Link
              to={
                alarm.siteId
                  ? `/sites/${alarm.siteId}/generators/${alarm.generatorId}`
                  : `/generators/${alarm.generatorId}`
              }
            >
              {alarm.generatorName ?? "Generator"}
            </Link>
          ) : (
            "—"
          )}
        </dd>
        <dt>Raised</dt>
        <dd className="tech">{alarmTime(alarm.raisedAt ?? alarm.firstOccurredAt)}</dd>
        <dt>Last</dt>
        <dd className="tech">{alarmTime(alarm.lastOccurredAt)}</dd>
        <dt>Occurrences</dt>
        <dd className="tech">{alarm.occurrenceCount}</dd>
        <dt>Ack</dt>
        <dd>
          {acknowledgementLabel({
            acknowledged: alarm.acknowledgedAt !== null,
            acknowledgedBy: alarm.acknowledgedByName,
          })}
          {alarm.acknowledgedAt ? ` · ${alarmTime(alarm.acknowledgedAt)}` : ""}
        </dd>
      </dl>
      <div className="btn-row">
        {allowAck ? (
          <button type="button" className="btn btn-primary" onClick={() => run(() => acknowledge({ alarmId: alarm._id }))}>
            Acknowledge
          </button>
        ) : null}
        {allowManage ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => run(() => clear({ alarmId: alarm._id }))}>
              Clear
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => run(() => resolve({ alarmId: alarm._id }))}>
              Resolve
            </button>
          </>
        ) : null}
      </div>
      {allowManage ? (
        <>
          <FleetBoundary>
            <AssignForm
              organizationId={alarm.organizationId}
              onAssign={(userId) => run(() => assign({ alarmId: alarm._id, userId }))}
            />
          </FleetBoundary>
          <form
            className="filter-bar"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run(async () => {
                await comment({ alarmId: alarm._id, body });
                setBody("");
              });
            }}
          >
            <label className="filter-field grow">
              <span>Comment</span>
              <input value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-secondary">
              Add
            </button>
          </form>
        </>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <section className="ops-section" aria-labelledby="alarm-comments-title">
        <h2 id="alarm-comments-title">Comments</h2>
        {data.comments.length === 0 ? (
          <p className="empty">No comments.</p>
        ) : (
          <ul>
            {data.comments.map((item) => (
              <li key={item._id}>{item.body}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="ops-section" aria-labelledby="alarm-history-title">
        <h2 id="alarm-history-title">History</h2>
        <ul>
          {data.events.map((event) => (
            <li key={event._id}>
              <span className="tech">{event.action}</span>
              {event.fromState ? ` ${event.fromState}` : ""}
              {event.toState ? ` → ${event.toState}` : ""}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function AssignForm({
  organizationId,
  onAssign,
}: {
  organizationId: Id<"organizations">;
  onAssign: (userId: Id<"users"> | null) => void;
}) {
  const members = useQuery(api.alarms.members, { organizationId });
  const [assignee, setAssignee] = useState("");
  return (
    <form
      className="filter-bar"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onAssign(assignee ? id<"users">(assignee) : null);
      }}
    >
      <label className="filter-field">
        <span>Assign</span>
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option value="">Unassigned</option>
          {(members ?? []).map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">Save assignment</button>
    </form>
  );
}
