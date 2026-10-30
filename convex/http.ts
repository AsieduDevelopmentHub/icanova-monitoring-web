import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { decodeBatch } from "./ingestDecode";
import { ingestAuthorized, isIngestHeartbeat } from "./ingestAuth";
import type { IngestOpKind } from "./ingestOps";
import { mapBatchStatus } from "./ingestOps";
import {
  INGEST_MAX_BODY,
  INGEST_RATE_DEVICE_MAX,
  INGEST_RATE_IP_MAX,
  INGEST_RATE_WINDOW_MS,
} from "./limits";

const http = httpRouter();

function rateEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Hash IP to a short key so raw addresses are not stored as free text longer than needed. */
function ipKeyFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip");
  if (!forwarded) {
    return null;
  }
  const first = forwarded.split(",")[0]?.trim() ?? "";
  if (!first || first.length > 64) {
    return null;
  }
  let hash = 0;
  for (let i = 0; i < first.length; i += 1) {
    hash = (hash * 31 + first.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function extractIdentity(record: Record<string, unknown>): string | null {
  if (typeof record.identity === "string") {
    const id = record.identity.trim().toLowerCase();
    return /^[0-9a-f]{12}$/.test(id) ? id : null;
  }
  return null;
}

async function note(ctx: any, kind: IngestOpKind, organizationId?: string | null) {
  try {
    await ctx.runMutation(internal.ingestOps.record, {
      kind,
      organizationId: organizationId ?? null,
    });
  } catch {
    // Metrics must not break ingest.
  }
}

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    const body = process.env.AUTH_JWT_JWKS?.trim() ?? "";
    if (!body.startsWith("{")) {
      return Response.json({ error: "JWKS is not configured" }, { status: 503 });
    }
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
  }),
});

http.route({
  path: "/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const header = request.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ")) {
      return Response.json({ error: "Missing bearer token" }, { status: 401 });
    }
    let identity = null;
    try {
      identity = await ctx.auth.getUserIdentity();
    } catch {
      return Response.json({ error: "Invalid bearer token" }, { status: 401 });
    }
    if (!identity) {
      return Response.json({ error: "Invalid bearer token" }, { status: 401 });
    }
    return Response.json({
      subject: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email ?? null,
    });
  }),
});

http.route({
  path: "/ncu/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const gate = ingestAuthorized(request.headers.get("Authorization"), process.env.INGEST_SECRET);
    if (gate === "unconfigured") {
      return Response.json({ error: "Ingest is not configured" }, { status: 503 });
    }
    if (gate !== "ok") {
      await note(ctx, "auth_failed");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const declared = request.headers.get("Content-Length");
    if (declared !== null) {
      const length = Number(declared);
      if (!Number.isFinite(length) || length < 2 || length > INGEST_MAX_BODY) {
        await note(ctx, "oversized");
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
    }
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length < 2 || raw.length > INGEST_MAX_BODY) {
        await note(ctx, "oversized");
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
      body = JSON.parse(raw) as unknown;
    } catch {
      await note(ctx, "invalid");
      return Response.json({ error: "Invalid sample" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      await note(ctx, "invalid");
      return Response.json({ error: "Invalid sample" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    const identityHint = extractIdentity(record);
    let orgId: string | null = null;
    if (identityHint) {
      try {
        orgId = (await ctx.runMutation(internal.ingestOps.resolveOrgIdentity, {
          identity: identityHint,
        })) as string | null;
      } catch {
        orgId = null;
      }
    }
    const ipKey = ipKeyFromRequest(request);
    const limit = await ctx.runMutation(internal.ingestRateLimit.check, {
      identity: identityHint,
      ipKey,
      deviceMax: rateEnv("INGEST_RATE_LIMIT_DEVICE", INGEST_RATE_DEVICE_MAX),
      ipMax: rateEnv("INGEST_RATE_LIMIT_IP", INGEST_RATE_IP_MAX),
      windowMs: rateEnv("INGEST_RATE_WINDOW_MS", INGEST_RATE_WINDOW_MS),
    });
    if (!limit.allowed) {
      await note(ctx, "rate_limited", orgId);
      return new Response(JSON.stringify({ error: "Rate limited", retryAfterSec: limit.retryAfterSec }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfterSec),
        },
      });
    }

    if (isIngestHeartbeat(record)) {
      const identity = identityHint ?? "";
      if (/^[0-9a-f]{12}$/.test(identity)) {
        try {
          const result = await ctx.runMutation(internal.deviceHealth.recordHeartbeat, { identity });
          if (result.status === "inactive") {
            await note(ctx, "inactive", orgId);
            return Response.json({ error: "Device inactive", status: "inactive" }, { status: 403 });
          }
          if (result.status === "ok") {
            await note(ctx, "heartbeat_ok", orgId);
          }
        } catch {
          // Heartbeat probes stay 204 when persistence fails for unknown/transient errors.
        }
      }
      return new Response(null, { status: 204 });
    }
    try {
      const batch = decodeBatch(record);
      const result = await ctx.runMutation(internal.ingest.acceptBatch, batch);
      await note(ctx, mapBatchStatus(result.status), orgId);
      if (result.status === "unknown" || result.status === "no-generator") {
        return Response.json(result, { status: 404 });
      }
      if (result.status === "ambiguous") {
        return Response.json(result, { status: 409 });
      }
      if (result.status === "inactive") {
        return Response.json(result, { status: 403 });
      }
      return Response.json(result, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Invalid sample")) {
        await note(ctx, "invalid", orgId);
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
      await note(ctx, "error", orgId);
      return Response.json({ error: "Ingest failed" }, { status: 500 });
    }
  }),
});

export default http;
