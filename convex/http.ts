import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

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

export default http;
