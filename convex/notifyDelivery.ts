/** Provider delivery outcomes. Timeouts are uncertain, not definite failures. */

export type DeliveryOutcome =
  | { kind: "sent"; id: string | null }
  | { kind: "rejected"; error: string }
  | { kind: "uncertain"; error: string }
  | { kind: "not_configured"; error: string };

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const text = error.message.toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("abort") ||
    text.includes("network") ||
    text.includes("fetch failed") ||
    text.includes("econnreset") ||
    text.includes("econnrefused")
  );
}

/**
 * Resend accepts Idempotency-Key. A timeout after the request left our process
 * may still have accepted the mail; retries must reuse the same key.
 * Arkesel has no documented idempotency key: an uncertain timeout may duplicate
 * on automatic or manual retry.
 */
export const PROVIDER_IDEMPOTENCY = {
  email: "resend-idempotency-key" as const,
  sms: "none" as const,
};
