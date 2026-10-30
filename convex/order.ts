/**
 * Ordering key is the persistent session counter (epoch) plus the sequence
 * inside that session. A random boot id is not an ordering key.
 * A missing epoch is an old payload: it may continue its own boot, and it
 * must not replace telemetry from a different boot or from a newer epoch.
 */

export type Cursor = {
  epoch?: number;
  boot: number;
  seq: number;
};

export type Incoming = {
  epoch?: number;
  boot: number;
  seq: number;
};

export type OrderDecision =
  | { action: "accept"; ordered: boolean; epoch?: number }
  | { action: "duplicate" }
  | { action: "stale" };

export function hasEpoch(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value > 0;
}

export function orderBatch(cursor: Cursor | null, incoming: Incoming): OrderDecision {
  const epoch = hasEpoch(incoming.epoch) ? incoming.epoch : undefined;
  if (!cursor) {
    return { action: "accept", ordered: false, epoch };
  }
  if (epoch !== undefined) {
    if (hasEpoch(cursor.epoch)) {
      if (epoch < cursor.epoch) {
        return { action: "stale" };
      }
      if (epoch === cursor.epoch && incoming.seq < cursor.seq) {
        return { action: "stale" };
      }
      if (epoch === cursor.epoch && incoming.seq === cursor.seq) {
        return { action: "duplicate" };
      }
      return { action: "accept", ordered: epoch === cursor.epoch, epoch };
    }
    return { action: "accept", ordered: false, epoch };
  }
  if (hasEpoch(cursor.epoch)) {
    return { action: "stale" };
  }
  if (cursor.boot !== incoming.boot) {
    return { action: "stale" };
  }
  if (incoming.seq < cursor.seq) {
    return { action: "stale" };
  }
  if (incoming.seq === cursor.seq) {
    return { action: "duplicate" };
  }
  return { action: "accept", ordered: true };
}
