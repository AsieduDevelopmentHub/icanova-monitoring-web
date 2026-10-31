export type DeliveryChannel = "email" | "sms" | "push";

export function vapidConfigured(env: {
  publicKey?: string | null;
  privateKey?: string | null;
  subject?: string | null;
}): boolean {
  return Boolean(env.publicKey?.trim() && env.privateKey?.trim() && env.subject?.trim());
}

/** Push sends only when VAPID env is complete. Email/SMS when their server env is set. */
export function providerDecision(
  kind: DeliveryChannel,
  env: { resend: boolean; arkesel: boolean; vapid?: boolean },
): "send" | "not_configured" {
  if (kind === "push") {
    return env.vapid ? "send" : "not_configured";
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

/** Allow-listed SPA paths for push notification click navigation. */
export function safeNotificationPath(input: string | null | undefined): string {
  if (!input || typeof input !== "string") {
    return "/notifications";
  }
  const path = input.trim();
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://") ||
    path.includes("\\") ||
    path.includes("..")
  ) {
    return "/notifications";
  }
  if (
    path === "/notifications" ||
    path === "/alarms" ||
    path === "/dashboard" ||
    path === "/gateways" ||
    path === "/sites" ||
    /^\/alarms\/[a-z0-9]+$/i.test(path) ||
    /^\/gateways\/[a-z0-9]+$/i.test(path) ||
    /^\/generators\/[a-z0-9]+$/i.test(path) ||
    /^\/sites\/[a-z0-9]+$/i.test(path)
  ) {
    return path.slice(0, 200);
  }
  return "/notifications";
}

export function pushPayloadPath(args: {
  alarmId?: string | null;
  deviceId?: string | null;
  generatorId?: string | null;
}): string {
  if (args.alarmId) {
    return safeNotificationPath(`/alarms/${args.alarmId}`);
  }
  if (args.deviceId) {
    return safeNotificationPath(`/gateways/${args.deviceId}`);
  }
  if (args.generatorId) {
    return safeNotificationPath(`/generators/${args.generatorId}`);
  }
  return "/notifications";
}
