"use node";

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { type DeliveryOutcome, isTimeoutError } from "./notifyDelivery";

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

async function sendResend(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string,
): Promise<DeliveryOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { kind: "not_configured", error: "Resend is not configured" };
  }
  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
      headers: { "Idempotency-Key": idempotencyKey.slice(0, 256) },
    });
    if (result.error) {
      return { kind: "rejected", error: result.error.message.slice(0, 300) };
    }
    return { kind: "sent", id: result.data?.id ?? null };
  } catch (error) {
    if (isTimeoutError(error)) {
      return {
        kind: "uncertain",
        error: error instanceof Error ? error.message.slice(0, 300) : "Provider timeout",
      };
    }
    return {
      kind: "rejected",
      error: error instanceof Error ? error.message.slice(0, 300) : "Email send failed",
    };
  }
}

async function sendArkesel(to: string, message: string): Promise<DeliveryOutcome> {
  const apiKey = process.env.ARKESEL_API_KEY;
  const sender = process.env.ARKESEL_SENDER;
  if (!apiKey || !sender) {
    return { kind: "not_configured", error: "Arkesel is not configured" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
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
      signal: controller.signal,
    });
    const payload = (await response.json()) as {
      status?: string;
      message?: string;
      data?: unknown;
    };
    if (!response.ok || payload.status === "error") {
      return {
        kind: "rejected",
        error: (payload.message ?? `Arkesel SMS failed (${response.status})`).slice(0, 300),
      };
    }
    return { kind: "sent", id: providerId(payload.data) ?? null };
  } catch (error) {
    if (isTimeoutError(error) || (error instanceof Error && error.name === "AbortError")) {
      return {
        kind: "uncertain",
        error:
          "SMS provider timed out or the network failed. Delivery is uncertain; Arkesel has no idempotency key so a retry may duplicate.",
      };
    }
    return {
      kind: "rejected",
      error: error instanceof Error ? error.message.slice(0, 300) : "SMS send failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function finish(
  ctx: { runMutation: Function },
  messageId: unknown,
  claimGeneration: number,
  outcome: DeliveryOutcome,
) {
  if (outcome.kind === "sent") {
    return await ctx.runMutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration,
      status: "sent",
      providerId: outcome.id ?? undefined,
    });
  }
  if (outcome.kind === "not_configured") {
    return await ctx.runMutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration,
      status: "not_configured",
      error: outcome.error,
      failureCategory: "not_configured",
    });
  }
  if (outcome.kind === "uncertain") {
    return await ctx.runMutation(internal.notifyEmit.completeMessage, {
      messageId,
      claimGeneration,
      status: "uncertain",
      error: outcome.error,
      failureCategory: "uncertain",
      scheduleRetry: false,
    });
  }
  return await ctx.runMutation(internal.notifyEmit.completeMessage, {
    messageId,
    claimGeneration,
    status: "failed",
    error: outcome.error,
    failureCategory: "rejected",
    scheduleRetry: true,
  });
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
        const outcome = await sendResend(
          claimed.to,
          claimed.subject ?? "DSE notification",
          claimed.body,
          claimed.idempotencyKey,
        );
        await finish(ctx, args.messageId, claimed.claimGeneration, outcome);
        return { status: outcome.kind };
      }
      if (claimed.channel === "sms") {
        const outcome = await sendArkesel(claimed.to, claimed.body);
        await finish(ctx, args.messageId, claimed.claimGeneration, outcome);
        return { status: outcome.kind };
      }
      await finish(ctx, args.messageId, claimed.claimGeneration, {
        kind: "not_configured",
        error: "Channel is not deliverable",
      });
      return { status: "not_configured" as const };
    } catch (error) {
      const uncertain = isTimeoutError(error);
      await finish(ctx, args.messageId, claimed.claimGeneration, {
        kind: uncertain ? "uncertain" : "rejected",
        error: error instanceof Error ? error.message.slice(0, 300) : "Delivery failed",
      });
      return { status: uncertain ? "uncertain" : "failed" };
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
    const outcome = await sendResend(args.to, args.subject, args.html, `manual:${args.organizationId}:${args.to}:${args.subject}`);
    if (outcome.kind !== "sent") {
      await ctx.runMutation(internal.messages.record, {
        organizationId: args.organizationId,
        channel: "email",
        to: args.to,
        subject: args.subject,
        body: args.html,
        status: outcome.kind === "not_configured" ? "not_configured" : outcome.kind === "uncertain" ? "uncertain" : "failed",
        attempt: 1,
        error: outcome.error,
      });
      throw new Error(outcome.error);
    }
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "email",
      to: args.to,
      subject: args.subject,
      body: args.html,
      providerId: outcome.id ?? undefined,
      status: "sent",
      attempt: 1,
    });
    return { id: outcome.id };
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
    const outcome = await sendArkesel(args.to, args.message);
    if (outcome.kind !== "sent") {
      await ctx.runMutation(internal.messages.record, {
        organizationId: args.organizationId,
        channel: "sms",
        to: args.to,
        body: args.message,
        status: outcome.kind === "not_configured" ? "not_configured" : outcome.kind === "uncertain" ? "uncertain" : "failed",
        attempt: 1,
        error: outcome.error,
      });
      throw new Error(outcome.error);
    }
    await ctx.runMutation(internal.messages.record, {
      organizationId: args.organizationId,
      channel: "sms",
      to: args.to,
      body: args.message,
      providerId: outcome.id ?? undefined,
      status: "sent",
      attempt: 1,
    });
    return { id: outcome.id };
  },
});
