import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import {
  alarmTime,
  canAcknowledge,
  categoryLabel,
  severityTone,
} from "../telemetry/alarmCenter";
import { accessMessage, id } from "./access";
import { Drawer } from "../ui/Overlay";
import { StatusMark } from "../ui/StatusMark";
import { Skeleton } from "../ui/Skeleton";

/** Quick alarm inspection without leaving the current operational page. */
export function AlarmPeek({
  alarmId,
  permissions,
  onClose,
}: {
  alarmId: string | null;
  permissions: readonly string[];
  onClose: () => void;
}) {
  return (
    <Drawer open={Boolean(alarmId)} title="Alarm" side="right" onClose={onClose}>
      {alarmId ? (
        <PeekBody alarmId={alarmId} permissions={permissions} onClose={onClose} />
      ) : null}
    </Drawer>
  );
}

function PeekBody({
  alarmId,
  permissions,
  onClose,
}: {
  alarmId: string;
  permissions: readonly string[];
  onClose: () => void;
}) {
  const data = useQuery(api.alarms.detail, { alarmId: id<"alarms">(alarmId) });
  const acknowledge = useMutation(api.alarms.acknowledge);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (data === undefined) {
    return <Skeleton lines={6} />;
  }

  const alarm = data.alarm;
  const allowAck = canAcknowledge(permissions) && alarm.state === "active";

  async function onAck() {
    setError(null);
    setPending(true);
    try {
      await acknowledge({ alarmId: id<"alarms">(alarmId) });
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack alarm-peek">
      <div className="status-row">
        <StatusMark tone={severityTone(alarm.severity)}>{alarm.severity ?? "—"}</StatusMark>
        <StatusMark tone={alarm.state === "active" ? "alarm" : "ok"}>{alarm.state}</StatusMark>
        <span className="meta">{categoryLabel(alarm)}</span>
      </div>
      <h3>{alarm.summary}</h3>
      {alarm.detail ? <p className="meta">{alarm.detail}</p> : null}
      <dl className="facts">
        <dt>Site</dt>
        <dd>
          {alarm.siteId ? <Link to={`/sites/${alarm.siteId}`}>{alarm.siteName ?? "Site"}</Link> : "—"}
        </dd>
        <dt>Generator</dt>
        <dd>
          {alarm.generatorId && alarm.siteId ? (
            <Link to={`/sites/${alarm.siteId}/generators/${alarm.generatorId}`}>
              {alarm.generatorName ?? "Generator"}
            </Link>
          ) : alarm.generatorId ? (
            <Link to={`/generators/${alarm.generatorId}`}>{alarm.generatorName ?? "Generator"}</Link>
          ) : (
            "—"
          )}
        </dd>
        <dt>Raised</dt>
        <dd className="tech">{alarmTime(alarm.raisedAt ?? alarm.firstOccurredAt)}</dd>
        <dt>Last</dt>
        <dd className="tech">{alarmTime(alarm.lastOccurredAt)}</dd>
      </dl>
      {error ? <p className="err">{error}</p> : null}
      <div className="btn-row">
        {allowAck ? (
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => void onAck()}>
            {pending ? "…" : "Acknowledge"}
          </button>
        ) : null}
        <Link className="btn btn-secondary" to={`/alarms/${alarmId}`} onClick={onClose}>
          Full detail
        </Link>
      </div>
    </div>
  );
}
