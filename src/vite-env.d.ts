/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GW_URL?: string;
  readonly VITE_USE_MOCK?: string;
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_OIDC_ISSUER?: string;
  readonly VITE_OIDC_CLIENT_ID?: string;
  readonly VITE_OIDC_AUDIENCE?: string;
  readonly VITE_OIDC_REDIRECT_URI?: string;
  readonly VITE_OIDC_LOGOUT_REDIRECT_URI?: string;
  readonly VITE_OIDC_AUTHORIZATION_ENDPOINT?: string;
  readonly VITE_OIDC_TOKEN_ENDPOINT?: string;
  readonly VITE_OIDC_END_SESSION_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
