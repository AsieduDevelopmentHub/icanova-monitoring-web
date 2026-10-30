/** How a stored bearer is allowed to open organization queries. */

export function sessionView(
  hasToken: boolean,
  me: object | null | undefined,
): "signed-out" | "loading" | "rejected" | "open" {
  if (!hasToken) {
    return "signed-out";
  }
  if (me === undefined) {
    return "loading";
  }
  if (me === null) {
    return "rejected";
  }
  return "open";
}
