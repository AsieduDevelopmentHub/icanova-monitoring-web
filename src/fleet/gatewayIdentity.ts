/**
 * Cloud link identity for gateways.
 * Preferred: assigned product serial / device id set on the gateway (`device.id`).
 * Legacy: 12-char lowercase hex efuse MAC.
 */

const MAC_RE = /^[0-9a-f]{12}$/;
const SERIAL_RE = /^[a-z0-9][a-z0-9-]{3,31}$/;

export function normalizeGatewayIdentity(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (/^[0-9a-f:.\-\s]+$/i.test(trimmed)) {
    const hex = trimmed.replace(/[^0-9a-f]/g, "");
    if (MAC_RE.test(hex)) {
      return hex;
    }
  }
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

/** Returns an operator-facing error, or null when the identity is acceptable for registration. */
export function gatewayIdentityError(raw: string): string | null {
  const normalized = normalizeGatewayIdentity(raw);
  if (!normalized) {
    return "Enter the gateway device ID (serial), for example icn-edge-00042.";
  }
  if (!isGatewayIdentity(normalized)) {
    return "Device ID must be 4–32 characters: letters, digits, and hyphens (example: icn-edge-00042). Legacy 12-character MAC hex is still accepted.";
  }
  return null;
}
