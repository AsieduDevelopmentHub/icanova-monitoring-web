"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

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

async function sendResend(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false as const, error: "Resend is not configured" };
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) {
    return { ok: false as const, error: result.error.message.slice(0, 300) };
  }
  return { ok: true as const, id: result.data?.id ?? null };
}

async function sendArkesel(to: string, message: string) {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = process.env.ARKESEL_SENDER;
  if (!apiKey || !sender) {
    return { ok: false as const, error: "Arkesel is not configured" };
  }
  const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      message,
      recipients: [to],
    }),
  });
  const payload = (await response.json()) as {
    status?: string;
    message?: string;
    data?: unknown;
  };
  if (!response.ok || payload.status === "error") {
    return {
      ok: false as const,
      error: (payload.message ?? `Arkesel SMS failed (${response.status})`).slice(0, 300),
    };
  }
  return { ok: true as const, id: providerId(payload.data) ?? null };
}

/** Async outbox worker. Never called from telemetry ingest synchronously. */
export const deliverMessage = internalAction({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internal.notifyEmit.claimMessage, {
      messageId: args.messageId,
    });
    if (!claimed) {
      return { status: "skipped" as const };
    }
    try {
      if (claimed.channel === "email") {
        const result = await sendResend(claimed.to, claimed.subject ?? "DSE notification", claimed.body);
        if (!result.ok) {
          await ctx.runMutation(internal.notifyEmit.completeMessage, {
            messageId: args.messageId,
            status: "failed",
            error: result.error,
            scheduleRetry: true,
          });
          return { status: "failed" as const };
        }
        await ctx.runMutation(internal.notifyEmit.completeMessage, {
          messageId: args.messageId,
          status: "sent",
          providerId: result.id ?? undefined,
        });
        return { status: "sent" as const };
      }
      if (claimed.channel === "sms") {
        const result = await sendArkesel(claimed.to, claimed.body);
        if (!result.ok) {
          await ctx.runMutation(internal.notifyEmit.completeMessage, {
            messageId: args.messageId,
            status: "failed",
            error: result.error,
            scheduleRetry: true,
          });
          return { status: "failed" as const };
        }
        await ctx.runMutation(internal.notifyEmit.completeMessage, {
          messageId: args.messageId,
          status: "sent",
          providerId: result.id ?? undefined,
        });
        return { status: "sent" as const };
      }
      await ctx.runMutation(internal.notifyEmit.completeMessage, {
        messageId: args.messageId,
        status: "not_configured",
        error: "Channel is not deliverable",
      });
      return { status: "not_configured" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 300) : "Delivery failed";
      await ctx.runMutation(internal.notifyEmit.completeMessage, {
        messageId: args.messageId,
        status: "failed",
        error: message,
        scheduleRetry: true,
      });
      return { status: "failed" as const };
    }
  },
});

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
    const result = await sendResend(args.to, args.subject, args.html);
    if (!result.ok) {
      await ctx.runMutation(internal.messages.record, {
        organizationId: args.organizationId,
        channel: "email",
        to: args.to,
        subject: args.subject,
        body: args.html,
        status: result.error.includes("not configured") ? "not_configured" : "failed",
        attempt: 1,
        error: result.error,
      });
      throw new Error(result.error);
    }
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "email",
      to: args.to,
      subject: args.subject,
      body: args.html,
      providerId: result.id ?? undefined,
      status: "sent",
      attempt: 1,
    });
    return { id: result.id };
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
    const result = await sendArkesel(args.to, args.message);
    if (!result.ok) {
      await ctx.runMutation(internal.messages.record, {
        organizationId: args.organizationId,
        channel: "sms",
        to: args.to,
        body: args.message,
        status: result.error.includes("not configured") ? "not_configured" : "failed",
        attempt: 1,
        error: result.error,
      });
      throw new Error(result.error);
    }
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "sms",
      to: args.to,
      body: args.message,
      providerId: result.id ?? undefined,
      status: "sent",
      attempt: 1,
    });
    return { id: result.id };
  },
});
