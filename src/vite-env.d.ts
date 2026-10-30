/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GW_URL?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
