export type DeliveryChannel = "email" | "sms" | "push";

/** Push has no VAPID sender in this repo. Email and SMS send only when their server env is set. */
export function providerDecision(
  kind: DeliveryChannel,
  env: { resend: boolean; arkesel: boolean },
): "send" | "not_configured" {
  if (kind === "push") {
    return "not_configured";
  }
  if (kind === "email") {
    return env.resend ? "send" : "not_configured";
  }
  return env.arkesel ? "send" : "not_configured";
}

export function notConfiguredError(kind: DeliveryChannel): string {
  if (kind === "push") {
    return "VAPID is not configured";
  }
  if (kind === "email") {
    return "Resend is not configured";
  }
  return "Arkesel is not configured";
}
