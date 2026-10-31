import type { ReactNode } from "react";
import type { StatusTone } from "./StatusMark";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}
