import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { decodeBatch } from "./ingestDecode";
import {
  constantTimeEqual,
  extractBearer,
  ingestAuthorized,
  isIngestHeartbeat,
} from "./ingestAuth";
import type { IngestOpKind } from "./ingestOps";
import { mapBatchStatus } from "./ingestOps";
import {
  INGEST_MAX_BODY,
  INGEST_RATE_DEVICE_MAX,
  INGEST_RATE_IP_MAX,
  INGEST_RATE_WINDOW_MS,
} from "./limits";

const http = httpRouter();
auth.addHttpRoutes(http);

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

// /.well-known/jwks.json is registered by Convex Auth (auth.addHttpRoutes) from JWKS env.
// Do not re-register the legacy AUTH_JWT_JWKS lab route — it conflicts with Convex Auth.

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
    const authHeader = request.headers.get("Authorization");
    const gate = ingestAuthorized(authHeader, process.env.INGEST_SECRET);
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

    // Dual-auth: shared INGEST_SECRET OR registered device credential (migration).
    let deviceOrgId: string | null = null;
    if (gate !== "ok") {
      const presented = extractBearer(authHeader);
      let deviceAuth: { ok: boolean; reason?: string; organizationId?: string } | null = null;
      if (presented && identityHint) {
        try {
          deviceAuth = (await ctx.runMutation(internal.devices.verifyDeviceIngestCredential, {
            identity: identityHint,
            presented,
          })) as { ok: boolean; reason?: string; organizationId?: string };
        } catch {
          deviceAuth = null;
        }
      }
      if (!deviceAuth?.ok) {
        if (deviceAuth?.reason === "inactive") {
          await note(ctx, "inactive", deviceAuth.organizationId ?? null);
          return Response.json({ error: "Device inactive", status: "inactive" }, { status: 403 });
        }
        if (gate === "unconfigured" && !presented) {
          return Response.json({ error: "Ingest is not configured" }, { status: 503 });
        }
        await note(ctx, "auth_failed");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      deviceOrgId = deviceAuth.organizationId ?? null;
    }
    let orgId: string | null = deviceOrgId;
    if (!orgId && identityHint) {
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
      const fw = typeof record.fw === "string" ? record.fw.trim().slice(0, 40) : undefined;
      const git = typeof record.git === "string" ? record.git.trim().slice(0, 16) : undefined;
      if (/^[0-9a-f]{12}$/.test(identity)) {
        try {
          const result = await ctx.runMutation(internal.deviceHealth.recordHeartbeat, {
            identity,
            ...(orgId ? { organizationId: orgId as Id<"organizations"> } : {}),
            ...(fw ? { firmwareVersion: fw } : {}),
            ...(git ? { firmwareGit: git } : {}),
          });
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
      const result = await ctx.runMutation(internal.ingest.acceptBatch, {
        ...batch,
        ...(orgId ? { organizationId: orgId as Id<"organizations"> } : {}),
      });
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

async function authorizeDeviceOrIngest(
  ctx: { runMutation: (ref: any, args: any) => Promise<unknown> },
  authHeader: string | null,
  identity: string | null,
): Promise<
  { ok: true; organizationId: string | null } | { ok: false; status: number; body: object }
> {
  const gate = ingestAuthorized(authHeader, process.env.INGEST_SECRET);
  if (gate === "ok") {
    return { ok: true, organizationId: null };
  }
  const presented = extractBearer(authHeader);
  if (!presented || !identity || !/^[0-9a-f]{12}$/.test(identity)) {
    if (gate === "unconfigured" && !presented) {
      return { ok: false, status: 503, body: { error: "Ingest is not configured" } };
    }
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  try {
    const deviceAuth = (await ctx.runMutation(internal.devices.verifyDeviceIngestCredential, {
      identity,
      presented,
    })) as { ok: boolean; reason?: string; organizationId?: string };
    if (!deviceAuth?.ok) {
      if (deviceAuth?.reason === "inactive") {
        return {
          ok: false,
          status: 403,
          body: { error: "Device inactive", status: "inactive" },
        };
      }
      return { ok: false, status: 401, body: { error: "Unauthorized" } };
    }
    return { ok: true, organizationId: deviceAuth.organizationId ?? null };
  } catch {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
}

http.route({
  path: "/ncu/ota/check",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const channelRaw = (url.searchParams.get("channel") ?? "stable").toLowerCase();
    const channel = channelRaw === "beta" ? "beta" : "stable";
    const current = (url.searchParams.get("current") ?? "").trim();
    const identity = (url.searchParams.get("identity") ?? "").trim().toLowerCase();
    const auth = await authorizeDeviceOrIngest(
      ctx,
      request.headers.get("Authorization"),
      identity || null,
    );
    if (!auth.ok) {
      return Response.json(auth.body, { status: auth.status });
    }
    const latest = await ctx.runQuery(internal.firmwareReleases.latestPublished, { channel });
    if (!latest) {
      return Response.json({ status: "up-to-date", upToDate: true }, { status: 200 });
    }
    if (current && current === latest.version) {
      return Response.json(
        { status: "up-to-date", upToDate: true, version: latest.version },
        { status: 200 },
      );
    }
    const downloadUrl = await ctx.runQuery(internal.firmwareReleases.resolveDownloadUrl, {
      storageId: latest.storageId,
    });
    if (!downloadUrl) {
      return Response.json({ error: "Firmware blob unavailable" }, { status: 503 });
    }
    return Response.json({
      status: "update",
      upToDate: false,
      version: latest.version,
      sha256: latest.sha256,
      size: latest.size,
      gitHash: latest.gitHash ?? null,
      url: downloadUrl,
      channel: latest.channel,
    });
  }),
});

http.route({
  path: "/ncu/ota/publish",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.OTA_PUBLISH_SECRET?.trim();
    if (!secret) {
      return Response.json({ error: "OTA publish is not configured" }, { status: 503 });
    }
    const presented = extractBearer(request.headers.get("Authorization"));
    if (!presented || !constantTimeEqual(presented, secret)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const action = typeof body.action === "string" ? body.action : "";
    if (action === "uploadUrl") {
      const uploadUrl = await ctx.runMutation(internal.firmwareReleases.internalCreateUploadUrl, {});
      return Response.json({ uploadUrl });
    }
    if (action === "publish") {
      const version = typeof body.version === "string" ? body.version : "";
      const channel = body.channel === "beta" ? "beta" : "stable";
      const storageId = typeof body.storageId === "string" ? body.storageId : "";
      const sha256 = typeof body.sha256 === "string" ? body.sha256 : "";
      const size = typeof body.size === "number" ? body.size : Number(body.size);
      const gitHash = typeof body.gitHash === "string" ? body.gitHash : undefined;
      const notes = typeof body.notes === "string" ? body.notes : undefined;
      if (!storageId) {
        return Response.json({ error: "storageId required" }, { status: 400 });
      }
      try {
        const id = await ctx.runMutation(internal.firmwareReleases.internalPublish, {
          version,
          channel,
          storageId: storageId as Id<"_storage">,
          sha256,
          size,
          gitHash,
          notes,
          createdBy: "ci",
        });
        return Response.json({ releaseId: id, version, channel });
      } catch (error) {
        const message = error instanceof Error ? error.message : "publish failed";
        return Response.json({ error: message }, { status: 400 });
      }
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  }),
});

http.route({
  path: "/ncu/location",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const identity =
      typeof body.identity === "string" ? body.identity.trim().toLowerCase() : null;
    const latitude =
      typeof body.latitude === "number"
        ? body.latitude
        : typeof body.lat === "number"
          ? body.lat
          : Number.NaN;
    const longitude =
      typeof body.longitude === "number"
        ? body.longitude
        : typeof body.lon === "number"
          ? body.lon
          : Number.NaN;
    const auth = await authorizeDeviceOrIngest(
      ctx,
      request.headers.get("Authorization"),
      identity,
    );
    if (!auth.ok) {
      return Response.json(auth.body, { status: auth.status });
    }
    if (!identity || !/^[0-9a-f]{12}$/.test(identity)) {
      return Response.json({ error: "identity required" }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json({ error: "latitude and longitude required" }, { status: 400 });
    }
    try {
      const result = await ctx.runMutation(internal.sites.setLocationForIdentity, {
        identity,
        latitude,
        longitude,
        ...(auth.organizationId
          ? { organizationId: auth.organizationId as Id<"organizations"> }
          : {}),
      });
      if (result.status === "inactive") {
        return Response.json({ error: "Device inactive", status: "inactive" }, { status: 403 });
      }
      if (result.status === "unknown") {
        return Response.json({ error: "Unknown device" }, { status: 404 });
      }
      if (result.status === "ambiguous") {
        return Response.json({ error: "Ambiguous device" }, { status: 409 });
      }
      if (result.status !== "ok") {
        return Response.json({ error: "Invalid location" }, { status: 400 });
      }
      return Response.json({ ok: true, siteId: result.siteId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "location failed";
      return Response.json({ error: message }, { status: 400 });
    }
  }),
});

export default http;
