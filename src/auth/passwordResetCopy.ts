/**
 * Anti-enumeration copy for password reset request step.
 * Must not reveal whether an email is registered.
 */
export function resetRequestConfirmation(): string {
  return "If an account exists for that email, a reset code was sent. Enter the code and a new password.";
}
