import type { GatewayStatus } from "./types";
import type { GenCatalog } from "./gencomm";

export async function fetchStatus(): Promise<GatewayStatus> {
  throw new Error("Readings come from Convex, not the gateway HTTP API.");
}

export async function fetchCatalog(): Promise<GenCatalog> {
  const res = await fetch("/gencomm.json");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as GenCatalog;
}

export async function readWords(addr: number, qty: number): Promise<number[]> {
  void addr;
  void qty;
  throw new Error("Register reads are not sent to the gateway.");
}

export async function writeWords(addr: number, words: number[]): Promise<void> {
  void addr;
  void words;
  throw new Error("Register writes are not sent to the gateway.");
}

export async function sendControl(key: number): Promise<void> {
  void key;
  throw new Error("Controller commands are not sent to the gateway.");
}
