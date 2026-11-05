# iCaNova Monitoring — project instructions

## Product and architecture

- The platform is **iCaNova Monitoring**; the edge companion is **iCaNova Edge Gateway**. Follow `docs/product/terminology.md`; do not invent brand or product names.
- This repository owns the React application, Convex Auth/authz, organization/site/device/telemetry presentation, alarms, notifications, and deployment tooling. Keep hardware/Modbus implementation in firmware and presentation in the web app.
- The system is an organization-scoped Convex backend (`convex/`) and React SPA (`src/`). Preserve gateway/cloud contracts, backend authorization, and existing responsibilities.
- Prefer shared components in `src/ui/` and `src/sites/`. Live cloud data uses Convex subscriptions; do not introduce reload-based refresh.
- Keep cloud contact, Modbus/link health, and measurement freshness separate. Do not invent telemetry fields or treat missing values as zero.
- Auth and environment identifiers remain unchanged unless a migration is approved. Fail closed on auth misconfiguration.

## Change management

Before a substantial change, inspect the implementation and relevant docs, identify affected surfaces and risks, define intended behavior, then make the smallest complete change. Afterward inspect the diff, preserve compatibility, run relevant checks, update related documentation, and report remaining risks. Prefer reversible work. Do not make destructive database changes without explicit approval and a verified recovery plan.

## Hard safety boundaries

- Do not deploy to production (`sturgeon`), change production secrets, or migrate production users without explicit owner authorization.
- Do not wipe or destructively migrate Convex data without explicit owner approval and a recovery plan.
- Do not flash hardware or open serial ports as part of repository tasks.
- Never commit `.env.local`, credentials, or production secrets.

## Verification

Do not claim work is complete based on code changes alone. Run relevant tests and builds; for UI changes, inspect the actual route and check responsive behavior before claiming it was verified. Distinguish source inspection, static analysis, tests, build, browser behavior, hosted environment, and hardware evidence. State what was not verified.

For substantial feature, bug, refactor, schema, auth, API, deploy, configuration, test-suite, or documentation/status work, report:

1. **TASK SUMMARY** — objective, status, and outcome.
2. **FILES CHANGED** — created, modified, or deleted files and why.
3. **IMPLEMENTATION DETAILS** — behavior, components, and design decisions.
4. **VERIFICATION AND TEST RESULTS** — each check, command, PASS/FAIL/NOT RUN, and evidence.
5. **ACTUAL BEHAVIOR VERIFICATION** — routes, interactions, console, backend, and real-data evidence, or NOT VERIFIED.
6. **SECURITY AND DATA-INTEGRITY CHECK** — authorization, tenant isolation, persistence, secrets, and destructive operations.
7. **DEPLOYMENT AND ENVIRONMENT STATUS** — deployment status, target, URL, Convex environment, commit, and rollback, or NOT DEPLOYED.
8. **KNOWN ISSUES AND LIMITATIONS** — unresolved items and missing evidence.
9. **DOCUMENTATION UPDATED** — changed docs or none.
10. **FINAL ENGINEERING VERDICT** — COMPLETE — VERIFIED, COMPLETE WITH DOCUMENTED LIMITATIONS, PARTIALLY COMPLETE, BLOCKED, or FAILED.
11. **NEXT ACTIONS** — safe next steps and any required owner, production, or hardware authorization.

## Scoped guidance

Use the matching instructions in `.github/instructions/` for UI, Convex, security, data integrity, API contracts, observability, deployment, and documentation work. These are VS Code/Copilot equivalents of the project rules in `.cursor/rules/`.
