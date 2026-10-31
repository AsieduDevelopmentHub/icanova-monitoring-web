/* iCanOva Monitoring — VAPID Web Push service worker (no FCM). */
/* eslint-disable no-restricted-globals */

function safePath(raw) {
  if (typeof raw !== "string") {
    return "/notifications";
  }
  const path = raw.trim();
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

function parsePayload(event) {
  if (!event.data) {
    return {
      title: "iCanOva Monitoring",
      body: "You have a new notification.",
      severity: "informational",
      path: "/notifications",
    };
  }
  try {
    const data = event.data.json();
    return {
      title: typeof data.title === "string" ? data.title.slice(0, 80) : "iCanOva Monitoring",
      body: typeof data.body === "string" ? data.body.slice(0, 140) : "",
      severity: typeof data.severity === "string" ? data.severity : "informational",
      path: safePath(data.path),
      event: typeof data.event === "string" ? data.event : undefined,
    };
  } catch {
    return {
      title: "iCanOva Monitoring",
      body: String(event.data.text?.() ?? "").slice(0, 140) || "You have a new notification.",
      severity: "informational",
      path: "/notifications",
    };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePayload(event);
  const tag =
    payload.event && typeof payload.event === "string"
      ? `icanova:${payload.event}`
      : "icanova:notification";
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag,
      renotify: true,
      data: { path: payload.path, severity: payload.severity },
      // No brand icon asset is checked into public/ yet — omit rather than invent.
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification?.data?.path);
  const targetUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(path);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
