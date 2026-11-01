import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { accessMessage } from "../fleet/access";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function FirmwareReleasesPanel({
  organizationId,
  canManage,
}: {
  organizationId: Id<"organizations">;
  canManage: boolean;
}) {
  const releases = useQuery(
    api.firmwareReleases.list,
    canManage ? { organizationId, channel: "stable" } : "skip",
  );
  const beta = useQuery(
    api.firmwareReleases.list,
    canManage ? { organizationId, channel: "beta" } : "skip",
  );
  const createUploadUrl = useMutation(api.firmwareReleases.createUploadUrl);
  const publish = useMutation(api.firmwareReleases.publish);
  const setPublished = useMutation(api.firmwareReleases.setPublished);
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<"stable" | "beta">("stable");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return <p className="meta">Publishing firmware requires manage.devices.</p>;
  }

  async function onPublish(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!file) {
      setError("Choose a firmware .bin file.");
      return;
    }
    setPending(true);
    try {
      const sha256 = await sha256Hex(file);
      const uploadUrl = await createUploadUrl({ organizationId });
      const uploaded = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploaded.ok) {
        throw new Error(`Upload failed (${uploaded.status})`);
      }
      const body = (await uploaded.json()) as { storageId?: string };
      if (!body.storageId) {
        throw new Error("Upload did not return storageId");
      }
      await publish({
        organizationId,
        version,
        channel,
        storageId: body.storageId as Id<"_storage">,
        sha256,
        size: file.size,
        notes: notes.trim() || undefined,
      });
      setMessage(`Published ${version} on ${channel}.`);
      setVersion("");
      setNotes("");
      setFile(null);
    } catch (caught) {
      setError(accessMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const rows = [...(releases ?? []), ...(beta ?? [])].sort(
    (a, b) => b.createdAt - a.createdAt,
  );

  return (
    <div className="stack">
      <form className="filter-bar" onSubmit={(event) => void onPublish(event)}>
        <label className="filter-field">
          <span>Version</span>
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="0.2.0"
            required
          />
        </label>
        <label className="filter-field">
          <span>Channel</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as "stable" | "beta")}
          >
            <option value="stable">stable</option>
            <option value="beta">beta</option>
          </select>
        </label>
        <label className="filter-field grow">
          <span>Notes</span>
          <input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <label className="filter-field grow">
          <span>Firmware .bin</span>
          <input
            type="file"
            accept=".bin,application/octet-stream"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Publishing…" : "Publish release"}
        </button>
      </form>
      {error ? <p className="err">{error}</p> : null}
      {message ? <p className="meta">{message}</p> : null}
      {releases === undefined || beta === undefined ? (
        <p className="meta">Loading releases…</p>
      ) : rows.length === 0 ? (
        <p className="empty">No firmware releases published yet.</p>
      ) : (
        <ul className="stack">
          {rows.map((row) => (
            <li key={row._id} className="meta">
              <strong>{row.version}</strong> · {row.channel} · {(row.size / 1024).toFixed(0)} KiB
              {row.gitHash ? ` · ${row.gitHash}` : ""} · {row.published ? "published" : "unpublished"}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: "0.5rem" }}
                onClick={() =>
                  void setPublished({
                    organizationId,
                    releaseId: row._id,
                    published: !row.published,
                  }).catch((caught) => setError(accessMessage(caught)))
                }
              >
                {row.published ? "Unpublish" : "Publish"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
