/**
 * Gateway/device identity used for ingest and heartbeat registration.
 * Firmware reports the ESP32 efuse MAC as 12 lowercase hex characters.
 */
export function normalizeGatewayIdentity(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
}

/** Returns an operator-facing error, or null when the identity is acceptable for registration. */
export function gatewayIdentityError(raw: string): string | null {
  const normalized = normalizeGatewayIdentity(raw);
  if (!normalized) {
    return "Enter the gateway identity (12-character efuse MAC).";
  }
  if (!/^[0-9a-f]{12}$/.test(normalized)) {
    return "Identity must be the 12-character lowercase hex efuse MAC (example: a1b2c3d4e5f6).";
  }
  return null;
}
