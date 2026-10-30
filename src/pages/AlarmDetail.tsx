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
      <section className="page">
        <h1>Alarm</h1>
        <p>Missing id.</p>
      </section>
    );
  }
  const demo = demoRows.find((row) => row.id === alarmId);
  if (demo || !import.meta.env.VITE_CONVEX_URL) {
    if (!demo) {
      return (
        <section className="page">
          <header className="page-head">
            <h1>Alarm</h1>
            <p>That id is not in the demo log.</p>
          </header>
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
    <section className="page">
      <header className="page-head">
        <h1>{row.summary}</h1>
        <p>
          <Link to="/alarms">Alarms</Link>
        </p>
      </header>
      <div className="notice fixture" role="note">
        <strong>Demo log.</strong> From {DEMO_SOURCE}. Acknowledgement, comments, assignment, and
        resolution are not stored for this row.
      </div>
      <p>
        <StatusMark tone={row.kind === "transport" ? "warn" : "alarm"}>{row.kind}</StatusMark>
      </p>
      <p>{row.detail}</p>
      <p className="meta">Remote controller writes are not enabled.</p>
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
      <section className="page">
        <p className="empty">Loading the alarm.</p>
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
    <section className="page">
      <header className="page-head">
        <h1>{alarm.summary}</h1>
        <p>
          <Link to="/alarms">Alarms</Link>
        </p>
      </header>
      <p>
        <StatusMark tone={severityTone(alarm.severity)}>{alarm.severity}</StatusMark>{" "}
        <StatusMark tone={alarm.state === "resolved" || alarm.state === "cleared" ? "ok" : alarm.state === "active" ? "alarm" : "warn"}>
          {alarm.state}
        </StatusMark>{" "}
        <span className="meta">{categoryLabel(alarm)}</span>
      </p>
      <p>{alarm.detail}</p>
      <p className="meta">
        First {alarmTime(alarm.firstOccurredAt)}. Last {alarmTime(alarm.lastOccurredAt)}. Occurrences{" "}
        {alarm.occurrenceCount}. {acknowledgementLabel({
          acknowledged: alarm.acknowledgedAt !== null,
          acknowledgedBy: alarm.acknowledgedByName,
        })}
        . Source {alarm.source}. These actions do not write to the controller. Acknowledgement does
        not clear the condition.
      </p>
      <div className="filter-bar">
        {allowAck ? (
          <button type="button" onClick={() => run(() => acknowledge({ alarmId: alarm._id }))}>
            Acknowledge
          </button>
        ) : null}
        {allowManage ? (
          <>
            <button type="button" onClick={() => run(() => clear({ alarmId: alarm._id }))}>
              Clear
            </button>
            <button type="button" onClick={() => run(() => resolve({ alarmId: alarm._id }))}>
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
            <button type="submit">Add comment</button>
          </form>
        </>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
      <h2>Comments</h2>
      {data.comments.length === 0 ? (
        <p className="empty">No comments.</p>
      ) : (
        <ul>
          {data.comments.map((item) => (
            <li key={item._id}>{item.body}</li>
          ))}
        </ul>
      )}
      <h2>History</h2>
      <ul>
        {data.events.map((event) => (
          <li key={event._id}>
            {event.action}
            {event.fromState ? ` from ${event.fromState}` : ""}
            {event.toState ? ` to ${event.toState}` : ""}
            {event.note ? `: ${event.note}` : ""}
          </li>
        ))}
      </ul>
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
