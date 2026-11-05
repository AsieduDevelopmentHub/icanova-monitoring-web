---
description: "Use when changing deployment, environment, Pages, build, or release configuration."
applyTo: "{package.json,scripts/**,.env*,.github/**,wrangler*,docs/deployment/**,docs/operations/**,docs/guide/*deploy*,docs/guide/*environment*}"
---

# Deployment safety

| Environment | Convex | Id |
|---|---|---|
| Development | `effervescent-kangaroo-10` | kangaroo |
| Staging | `dapper-roadrunner-247` | roadrunner |
| Production | `tremendous-sturgeon-449` | sturgeon |
| Recovery | `vivid-mosquito-28` | mosquito |

Pages project: `icanova`. Staging: `https://icanova.pages.dev`.

## Staging build

Use `pnpm build:staging` only for staging; never use bare `pnpm build` for staging because Vite production mode can bake `.env.local` (the wrong Convex URL) into the bundle.

Before a staging deploy, confirm the staging build, `roadrunner` target and expected Convex URL, secret scan, distribution contents (no private credentials or accidental production URL), and intended commit.

After a staging deploy, verify the live URL loads, talks to `roadrunner`, authenticates, and can reach key routes and available organization/device data; inspect console/logs and record URL, commit, and rollback. Build success is not deploy success.

## Production

Production is not authorized by default. Do not deploy/configure `sturgeon`, migrate production users, or point Pages at production without explicit owner authorization. Bugfixes, preparation, or documentation edits do not authorize production work. Keep `mosquito` isolated and never copy staging secrets to production.
