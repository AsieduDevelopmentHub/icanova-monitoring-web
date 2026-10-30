import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { ingestAuthorized } from "./ingestAuth";

const http = httpRouter();

http.route({
  path: "/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const header = request.headers.get("Authorization") ?? "";
    if (!header.startsWith("Bearer ")) {
      return Response.json({ error: "Missing bearer token" }, { status: 401 });
    }
    const identity = await ctx.auth.getUserIdentity();
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
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const declared = request.headers.get("Content-Length");
    if (declared !== null) {
      const length = Number(declared);
      if (!Number.isFinite(length) || length < 2 || length > 8192) {
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
    }
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length < 2 || raw.length > 8192) {
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
      body = JSON.parse(raw) as unknown;
    } catch {
      return Response.json({ error: "Invalid sample" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid sample" }, { status: 400 });
    }
    const record = body as Record<string, unknown>;
    try {
      const result = await ctx.runMutation(internal.ingest.acceptBatch, {
        identity: record.identity,
        boot: record.boot,
        seq: record.seq,
        samples: record.samples,
      } as {
        identity: string;
        boot: number;
        seq: number;
        samples: {
          t: number;
          age: number;
          link: string;
          alm: number;
          mode: number | null;
          rpm: number | null;
          batt10: number | null;
          hz10: number | null;
          kw100: number | null;
          van10: number | null;
        }[];
      });
      if (result.status === "unknown" || result.status === "no-generator") {
        return Response.json(result, { status: 404 });
      }
      if (result.status === "ambiguous") {
        return Response.json(result, { status: 409 });
      }
      return Response.json(result, { status: 200 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Invalid sample")) {
        return Response.json({ error: "Invalid sample" }, { status: 400 });
      }
      return Response.json({ error: "Ingest failed" }, { status: 500 });
    }
  }),
});

export default http;
