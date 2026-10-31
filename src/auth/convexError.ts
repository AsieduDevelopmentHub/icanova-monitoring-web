/** User-facing password rule copy — keep in sync with `convex/passwordPolicy.ts`. */
export const PASSWORD_RULE_HINT =
  "At least 8 characters, including a letter and a number.";

/**
 * Strip Convex transport wrappers (`[Request ID…]`, `Server Error`, `Uncaught ConvexError:`)
 * so callers can map the inner message safely.
 */
export function extractConvexErrorText(error: unknown): string {
  if (error == null) {
    return "";
  }
  let text = "";
  if (error instanceof Error) {
    text = error.message;
  } else if (typeof error === "string") {
    text = error;
  } else if (typeof error === "object" && "message" in error) {
    text = String((error as { message: unknown }).message ?? "");
  }
  // ConvexError sometimes puts the payload on `data`.
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "string" && data.trim()) {
      text = `${text} ${data}`;
    } else if (data && typeof data === "object" && "message" in data) {
      text = `${text} ${String((data as { message: unknown }).message ?? "")}`;
    }
  }
  return text
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\bServer Error\b\s*/gi, "")
    .replace(/\bUncaught ConvexError:\s*/gi, "")
    .replace(/\bUncaught Error:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map known auth / policy failures to short safe copy. Never return Request IDs
 * or stack-like Convex dumps to the UI.
 */
export function sanitizeConvexError(error: unknown, fallback: string): string {
  const text = extractConvexErrorText(error);
  if (/at least 8 characters/i.test(text)) {
    return "Password must be at least 8 characters.";
  }
  if (/letters and a number/i.test(text)) {
    return "Password must include letters and a number.";
  }
  if (/current password is incorrect/i.test(text)) {
    return "Current password is incorrect.";
  }
  if (/must be different from the current password/i.test(text)) {
    return "New password must be different from the current password.";
  }
  if (/do not match/i.test(text)) {
    return "New password and confirmation do not match.";
  }
  if (/email is required/i.test(text)) {
    return "Email is required.";
  }
  // Never pass through raw Convex / server dumps (may include Request IDs or secrets).
  return fallback;
}

/** Client-side mirror of server password policy (instant feedback). */
export function clientPasswordIssue(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include letters and a number.";
  }
  return null;
}
