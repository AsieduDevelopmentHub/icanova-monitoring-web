/**
 * Convex Auth Password reset email provider (Auth.js EmailConfig).
 * Prefer AUTH_RESEND_KEY; fall back to existing staging RESEND_API_KEY.
 * Never log the raw reset token.
 */
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { generateRandomString, type RandomReader } from "@oslojs/crypto/random";

/** Exported for unit tests — never logs secrets. */
export function resolveResendApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const dedicated = env.AUTH_RESEND_KEY?.trim();
  if (dedicated) {
    return dedicated;
  }
  const shared = env.RESEND_API_KEY?.trim();
  return shared || undefined;
}

/** Exported for unit tests. */
export function resolveResetFromAddress(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = env.AUTH_EMAIL_FROM?.trim();
  if (dedicated) {
    return dedicated;
  }
  const shared = env.RESEND_FROM?.trim();
  if (shared) {
    return shared;
  }
  return "iCanOva Monitoring <onboarding@resend.dev>";
}

function resendApiKey(): string | undefined {
  return resolveResendApiKey();
}

function fromAddress(): string {
  return resolveResetFromAddress();
}

function otpToken(): string {
  const random: RandomReader = {
    read(bytes) {
      crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
    },
  };
  return generateRandomString(random, "0123456789", 8);
}

/**
 * Auth.js email provider used by Password({ reset }).
 * When Resend is not configured and AUTH_PASSWORD_RESET_DEV=1, accepts the
 * request without sending mail (controlled development adapter). Live delivery
 * remains unverified until Resend credentials are present.
 */
export const PasswordResetEmail = Resend({
  id: "password-reset-otp",
  apiKey: resendApiKey() ?? "dev-unused",
  async generateVerificationToken() {
    return otpToken();
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const apiKey = resendApiKey();
    const from = fromAddress();
    if (!apiKey) {
      const allowDev = process.env.AUTH_PASSWORD_RESET_DEV?.trim() === "1";
      if (allowDev) {
        // Do not print the token. Operators enable this only in non-customer envs.
        console.info(
          `[password-reset-dev] reset code generated for ${email} (token not logged; use Convex Auth verification UI)`,
        );
        return;
      }
      throw new Error("Password reset email is not configured");
    }
    const resend = new ResendAPI(apiKey);
    // Prefer the resolved key (Auth.js may pass provider.apiKey as the placeholder).
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: "Reset your iCanOva password",
      text: `Your iCanOva password reset code is ${token}. It expires shortly. If you did not request this, ignore this email.`,
      html: `<p>Your iCanOva password reset code is <strong>${token}</strong>.</p><p>It expires shortly. If you did not request this, ignore this email.</p>`,
    });
    if (error) {
      throw new Error("Could not send password reset email");
    }
    void provider;
  },
});
