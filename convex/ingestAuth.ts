/** Heartbeats are probes. They are not telemetry samples and must not open alarms. */
export function isIngestHeartbeat(body: unknown): boolean {
  if (!body || typeof body !== "object") {
    return false;
  }
  return (body as { kind?: unknown }).kind === "heartbeat";
}

/** Compare the collector bearer without logging either value. */
export function ingestAuthorized(
  header: string | null,
  secret: string | undefined,
): "ok" | "unconfigured" | "unauthorized" {
  if (!secret) {
    return "unconfigured";
  }
  const presented = extractBearer(header);
  if (presented === null) {
    return "unauthorized";
  }
  return constantTimeEqual(presented, secret) ? "ok" : "unauthorized";
}

export function extractBearer(header: string | null): string | null {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) {
    return null;
  }
  const presented = header.slice(prefix.length);
  return presented.length > 0 ? presented : null;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/** SHA-256 hex digest for device credential storage. Never log the plaintext. */
export async function hashIngestCredential(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plaintext));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function deviceCredentialMatches(
  presentedHash: string,
  currentHash: string | undefined,
  previousHash: string | undefined,
): boolean {
  if (currentHash && constantTimeEqual(presentedHash, currentHash)) {
    return true;
  }
  if (previousHash && constantTimeEqual(presentedHash, previousHash)) {
    return true;
  }
  return false;
}
