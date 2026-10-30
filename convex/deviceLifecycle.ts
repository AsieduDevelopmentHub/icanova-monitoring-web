import type { Doc } from "./_generated/dataModel";

/** Existing rows without lifecycle remain active. */
export function deviceIsActive(
  device: Pick<Doc<"devices">, "lifecycle"> | { lifecycle?: "active" | "inactive" | undefined },
): boolean {
  return device.lifecycle !== "inactive";
}

export function lifecycleLabel(
  device: Pick<Doc<"devices">, "lifecycle"> | { lifecycle?: "active" | "inactive" | undefined },
): "active" | "inactive" {
  return deviceIsActive(device) ? "active" : "inactive";
}
