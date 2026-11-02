import { createAccount } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { normalizeEmail, normalizeUsername } from "./authIdentity";
import { requireName, requirePermission, resolveAppUser } from "./identity";
import { assertPasswordRequirements } from "./passwordPolicy";
import { MAX_PAGE } from "./limits";

/** Org admin: request a member. Confirmation later provisions the account. */
export const request = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    name: v.string(),
    roleId: v.id("roles"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new ConvexError("Email is required");
    }
    const name = requireName(args.name, "Name");
    const role = await ctx.db.get(args.roleId);
    if (!role || role.organizationId !== args.organizationId) {
      throw new ConvexError("Role not found");
    }
    const pending = await ctx.db
      .query("memberRequests")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(10);
    if (pending.some((row) => row.status === "pending" && row.organizationId === args.organizationId)) {
      throw new ConvexError("A pending request already exists for this email");
    }
    const resolved = await resolveAppUser(ctx);
    const requestId = await ctx.db.insert("memberRequests", {
      organizationId: args.organizationId,
      email,
      name,
      roleId: args.roleId,
      note: args.note?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
      createdBy: resolved?.user._id,
    });
    return { requestId };
  },
});

export const listPending = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const rows = await ctx.db
      .query("memberRequests")
      .withIndex("by_org_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending"),
      )
      .take(MAX_PAGE);
    const out = [];
    for (const row of rows) {
      const role = await ctx.db.get(row.roleId);
      out.push({
        requestId: row._id,
        email: row.email,
        name: row.name,
        roleName: role?.name ?? "Unknown",
        note: row.note ?? null,
        createdAt: row.createdAt,
      });
    }
    return out;
  },
});

/**
 * Confirm a member request: create the password account, attach membership,
 * and return a one-time temp password for the confirmation email path.
 */
export const confirm = action({
  args: {
    organizationId: v.id("organizations"),
    requestId: v.id("memberRequests"),
    temporaryPassword: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ email: string; username: string; temporaryPassword: string }> => {
    const detail = await ctx.runQuery(api.memberRequests.confirmPreview, {
      organizationId: args.organizationId,
      requestId: args.requestId,
    });
    const temporaryPassword = args.temporaryPassword?.trim() || `Tmp${Date.now().toString(36)}9a`;
    assertPasswordRequirements(temporaryPassword);
    const username =
      normalizeUsername(detail.email.split("@")[0] ?? "member") ||
      `user${Date.now().toString(36)}`;
    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: detail.email, secret: temporaryPassword },
      profile: { email: detail.email, username, name: detail.name },
      shouldLinkViaEmail: true,
    });
    const userId = created.user._id as Id<"users">;
    await ctx.runMutation(api.memberRequests.finalizeConfirm, {
      organizationId: args.organizationId,
      requestId: args.requestId,
      userId,
      roleId: detail.roleId,
    });
    return {
      email: detail.email,
      username,
      temporaryPassword,
    };
  },
});

export const confirmPreview = query({
  args: {
    organizationId: v.id("organizations"),
    requestId: v.id("memberRequests"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const row = await ctx.db.get(args.requestId);
    if (!row || row.organizationId !== args.organizationId || row.status !== "pending") {
      throw new ConvexError("Request not found");
    }
    return {
      email: row.email,
      name: row.name,
      roleId: row.roleId,
    };
  },
});

export const finalizeConfirm = mutation({
  args: {
    organizationId: v.id("organizations"),
    requestId: v.id("memberRequests"),
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.organizationId, "manage.users");
    const row = await ctx.db.get(args.requestId);
    if (!row || row.organizationId !== args.organizationId || row.status !== "pending") {
      throw new ConvexError("Request not found");
    }
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("memberships", {
        organizationId: args.organizationId,
        userId: args.userId,
        roleId: args.roleId,
      });
    }
    await ctx.db.patch(row._id, {
      status: "confirmed",
      confirmedAt: Date.now(),
    });
    return { ok: true as const };
  },
});
