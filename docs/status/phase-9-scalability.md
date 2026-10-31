# Phase 9 — Multi-tenant scalability notes

**Date:** 2026-10-31  
**Status:** REVIEWED (documentation) — **NOT** a capacity certification  
**Method:** Code/index inspection only; no synthetic load campaign in this phase  

---

## Observed patterns

| Area | Observation | Risk if ignored |
|---|---|---|
| Org scoping | Queries generally take `organizationId` + membership gates | Cross-tenant leakage if a new query omits gates |
| Pagination | List endpoints use `paginationOpts` in fleet/notify/alarms | Unbounded reads on large fleets |
| Telemetry | Current telemetry is one doc per generator; history buckets prune (~7d) | History growth bounded by prune policy |
| Notify outbox | Delivery retries capped; idempotency keys on providers | Duplicate SMS risk called out where provider lacks idempotency |
| Ingest | Rate limit + dual-auth | Shared secret blast radius remains (documented exception) |
| Auth tables | Convex Auth indexes present after 8.5F | Session growth normal; invalidate on password change |

## Recommendations (engineering, not SLOs)

1. Keep new list queries paginated and org-scoped by default.  
2. Prefer transition-driven notify emit (already required) over sample fan-out.  
3. Before claiming multi-tenant load capacity, run a controlled staging soak with measured org/device counts — **not done here**.  
4. Do not infer production capacity from staging Pages traffic.  

## Explicit non-claims

- No QPS, latency, or concurrent-tenant numbers.  
- No production load test.  
