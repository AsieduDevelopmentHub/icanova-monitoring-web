/**
 * Cloud link identity for gateways.
 * Preferred: assigned product serial / device id (e.g. icn-edge-00042).
 * Legacy: 12-char lowercase hex efuse MAC.
 */

const MAC_RE = /^[0-9a-f]{12}$/;
/** 4..32 chars: starts/continues with [a-z0-9-], must start with alnum. */
const SERIAL_RE = /^[a-z0-9][a-z0-9-]{3,31}$/;

export function normalizeGatewayIdentity(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  // Colon/dash separated MAC (or plain 12 hex) → 12 hex.
  if (/^[0-9a-f:.\-\s]+$/i.test(trimmed)) {
    const hex = trimmed.replace(/[^0-9a-f]/g, "");
    if (MAC_RE.test(hex)) {
      return hex;
    }
  }
  // Assigned serial: keep letters, digits, hyphen.
  return trimmed.replace(/[^a-z0-9-]/g, "");
}

export function isGatewayIdentity(identity: string): boolean {
  if (MAC_RE.test(identity)) {
    return true;
  }
  if (!SERIAL_RE.test(identity)) {
    return false;
  }
  if (identity.startsWith("-") || identity.endsWith("-") || identity.includes("--")) {
    return false;
  }
  return true;
}
