import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    // Do not attach sentry-trace to the gateway proxy or to Convex bearer requests.
    tracePropagationTargets: [],
    beforeBreadcrumb(breadcrumb) {
      return sanitizeTelemetry(breadcrumb);
    },
    beforeSend(event) {
      if (event.request) {
        event.request.cookies = undefined;
        event.request.headers = undefined;
        event.request.data = undefined;
        if (typeof event.request.url === "string") {
          event.request.url = stripUrl(event.request.url);
        }
      }
      return event;
    },
  });
}

function sanitizeTelemetry<T extends { data?: Record<string, unknown> }>(breadcrumb: T): T {
  const data = breadcrumb.data;
  if (!data) {
    return breadcrumb;
  }
  for (const key of ["request_body", "response_body", "headers", "Authorization", "Cookie"]) {
    delete data[key];
  }
  if (typeof data.url === "string") {
    data.url = stripUrl(data.url);
  }
  return breadcrumb;
}

function stripUrl(value: string): string {
  const withoutHash = value.split("#")[0] ?? value;
  return withoutHash.split("?")[0] ?? withoutHash;
}
