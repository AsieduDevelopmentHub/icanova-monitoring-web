/** Browser Push API helpers (VAPID). No FCM. Permission only after explicit user action. */

export type BrowserPushSupport = {
  supported: boolean;
  reason?: string;
};

export function detectBrowserPushSupport(): BrowserPushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "Not a browser environment" };
  }
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "Service workers are not supported" };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: "PushManager is not supported" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "Notification API is not supported" };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: "Browser push requires a secure context (HTTPS)" };
  }
  return { supported: true };
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
}

export type BrowserSubscriptionPayload = {
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  userAgentLabel: string;
};

export async function createBrowserPushSubscription(
  vapidPublicKey: string,
): Promise<BrowserSubscriptionPayload> {
  const support = detectBrowserPushSupport();
  if (!support.supported) {
    throw new Error(support.reason ?? "Browser push is not supported");
  }
  if (Notification.permission === "denied") {
    throw new Error("Browser notification permission was denied");
  }
  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      throw new Error("Browser notification permission was not granted");
    }
  }
  const registration = await registerPushServiceWorker();
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser did not return a complete Push API subscription");
  }
  return {
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    expirationTime: subscription.expirationTime,
    userAgentLabel: navigator.userAgent.slice(0, 120),
  };
}

export async function dropLocalPushSubscription(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}
