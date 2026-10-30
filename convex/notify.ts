"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function providerId(data: unknown): string | undefined {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === "object" && "id" in item) {
        const id = (item as { id?: unknown }).id;
        if (typeof id === "string") {
          return id;
        }
      }
    }
    return undefined;
  }
  if (data && typeof data === "object" && "id" in data) {
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }
  return undefined;
}

export const sendEmail = action({
  args: {
    organizationId: v.id("organizations"),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.authz.gate, {
      organizationId: args.organizationId,
      permission: "configure.notifications",
    });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      throw new Error("Resend is not configured");
    }
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    if (result.error) {
      throw new Error(result.error.message);
    }
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "email",
      to: args.to,
      subject: args.subject,
      body: args.html,
      providerId: result.data?.id,
      status: "sent",
    });
    return { id: result.data?.id ?? null };
  },
});

export const sendSms = action({
  args: {
    organizationId: v.id("organizations"),
    to: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.authz.gate, {
      organizationId: args.organizationId,
      permission: "configure.notifications",
    });
    const apiKey = process.env.ARKESEL_API_KEY;
    const sender = process.env.ARKESEL_SENDER;
    if (!apiKey || !sender) {
      throw new Error("Arkesel is not configured");
    }
    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        message: args.message,
        recipients: [args.to],
      }),
    });
    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      data?: unknown;
    };
    if (!response.ok || payload.status === "error") {
      throw new Error(payload.message ?? `Arkesel SMS failed (${response.status})`);
    }
    const id = providerId(payload.data);
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "sms",
      to: args.to,
      body: args.message,
      providerId: id,
      status: "sent",
    });
    return { id: id ?? null };
  },
});
