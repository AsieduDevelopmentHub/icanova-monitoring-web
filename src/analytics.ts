declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function analyticsPage(location: { origin: string; pathname: string }) {
  return {
    page_path: location.pathname,
    page_location: `${location.origin}${location.pathname}`,
  };
}

export function startAnalytics() {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId || import.meta.env.MODE === "mock") {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  const send = () => {
    const page = analyticsPage(window.location);
    window.gtag?.("event", "page_view", {
      ...page,
      page_title: document.title,
    });
  };
  send();

  const historyWithFlag = history as History & { dseAnalytics?: boolean };
  if (!historyWithFlag.dseAnalytics) {
    historyWithFlag.dseAnalytics = true;
    const push = history.pushState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      push(...args);
      send();
    };
    window.addEventListener("popstate", send);
  }
}
