/** Compare the collector bearer without logging either value. */
export function ingestAuthorized(header: string | null, secret: string | undefined): "ok" | "unconfigured" | "unauthorized" {
  if (!secret) {
    return "unconfigured";
  }
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) {
    return "unauthorized";
  }
  const presented = header.slice(prefix.length);
  if (presented.length !== secret.length) {
    return "unauthorized";
  }
  let diff = 0;
  for (let index = 0; index < secret.length; index += 1) {
    diff |= presented.charCodeAt(index) ^ secret.charCodeAt(index);
  }
  return diff === 0 ? "ok" : "unauthorized";
}
