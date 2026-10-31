# Phase 3 — Visual identity notes

Design system for **iCanOva Monitoring** (Industrial Precision + Modern Enterprise SaaS).

## Tokens

Defined in `src/styles.css`:

- Brand palette (graphite, warm white, deep slate, titanium, copper, steel).
- Semantic surfaces (`--bg`, `--bg-elev`, `--bg-nav`, `--ink`, status colours).
- Light theme default on `:root`.
- Dark theme via `html[data-theme="dark"]`.
- Typography: Manrope / Inter / IBM Plex Mono.
- Spacing, radii, shadows, sidebar/topbar dimensions.

Theme persistence: `localStorage` key `icanova-theme` (`src/theme/theme.ts`). Boot script in `index.html` avoids flash.

## Shell

- Graphite sidebar with iCanOva Monitoring wordmark.
- Theme toggle in top bar (and mobile drawer).
- Breadcrumbs + session actions unchanged functionally.

## Auth

Login and callback use a shared `auth-panel` layout. Auth0 / OIDC logic untouched.
