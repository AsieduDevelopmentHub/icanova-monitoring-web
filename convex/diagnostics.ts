import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePermission } from "./auth";
import { MAX_PAGE } from "./limits";

const nullableText = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

function successful(crcResult: string | null, result: string | null) {
  return crcResult === "PASS" && result === "VALID MODBUS RESPONSE";
}

export const list = query({
  args: {
    deviceId: v.id("devices"),
    kind: v.union(v.literal("all"), v.literal("frame"), v.literal("batch")),
    search: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) {
      throw new Error("Not found");
    }
    await requirePermission(ctx, device.organizationId, "view.diagnostics");
    const search = args.search.trim().toLowerCase();
    if (search.length > 80) {
      throw new Error("Search is too long");
    }
    const batch = await ctx.db
      .query("modbusRecords")
      .withIndex("by_device_time", (q) => q.eq("deviceId", device._id))
      .order("desc")
      .take(200);
    if (batch.some((row) => row.organizationId !== device.organizationId)) {
      throw new Error("Forbidden");
    }
    const rows = batch
      .filter((row) => {
        if (args.kind !== "all" && row.kind !== args.kind) {
          return false;
        }
        if (!search) {
          return true;
        }
        return [
          row.kind,
          row.txn,
          row.functionCode,
          row.address,
          row.result,
          row.crcResult,
          row.tx,
          row.rx,
          row.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .slice(0, MAX_PAGE);
    const poll = await ctx.db
      .query("devicePolls")
      .withIndex("by_device", (q) => q.eq("deviceId", device._id))
      .unique();
    if (poll && poll.organizationId !== device.organizationId) {
      throw new Error("Forbidden");
    }
    return { rows, capped: batch.length === 200, poll: poll ?? null };
  },
});

/** Collector entry. A CRC pass with an invalid frame does not update the last good poll. */
export const record = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    deviceId: v.id("devices"),
    kind: v.union(v.literal("frame"), v.literal("batch")),
    txn: nullableNumber,
    functionCode: nullableText,
    address: nullableNumber,
    quantity: nullableNumber,
    tx: nullableText,
    rx: nullableText,
    rxLength: nullableNumber,
    receivedCrc: nullableText,
    calculatedCrc: nullableText,
    crcResult: nullableText,
    result: nullableText,
    latencyMs: nullableNumber,
    retries: nullableNumber,
    note: nullableText,
    sourceTime: nullableNumber,
  },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.organizationId !== args.organizationId) {
      throw new Error("Forbidden");
    }
    const recordedAt = Date.now();
    const id = await ctx.db.insert("modbusRecords", {
      organizationId: device.organizationId,
      deviceId: device._id,
      recordedAt,
      kind: args.kind,
      txn: args.txn,
      functionCode: args.functionCode,
      address: args.address,
      quantity: args.quantity,
      tx: args.tx,
      rx: args.rx,
      rxLength: args.rxLength,
      receivedCrc: args.receivedCrc,
      calculatedCrc: args.calculatedCrc,
      crcResult: args.crcResult,
      result: args.result,
      latencyMs: args.latencyMs,
      retries: args.retries,
      note: args.note,
    });
    if (args.kind === "frame" && successful(args.crcResult, args.result)) {
      const label = args.txn === null ? "Successful poll" : `TXN ${args.txn}`;
      const existing = await ctx.db
        .query("devicePolls")
        .withIndex("by_device", (q) => q.eq("deviceId", device._id))
        .unique();
      const poll = {
        organizationId: device.organizationId,
        deviceId: device._id,
        txn: args.txn,
        label,
        at: args.sourceTime,
      };
      if (existing) {
        await ctx.db.patch(existing._id, poll);
      } else {
        await ctx.db.insert("devicePolls", poll);
      }
    }
    return id;
  },
});
