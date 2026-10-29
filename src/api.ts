import { mockStatus } from "./mockStatus";
import type { GatewayStatus } from "./types";
import type { GenCatalog } from "./gencomm";

const useMock = import.meta.env.VITE_USE_MOCK === "1";

export async function fetchStatus(): Promise<GatewayStatus> {
  if (useMock) {
    await new Promise((r) => setTimeout(r, 120));
    return {
      ...mockStatus,
      ageMs: Math.floor(Math.random() * 800),
      uptimeMs: mockStatus.uptimeMs + Date.now() % 100000,
    };
  }
  const res = await fetch("/api/status");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as GatewayStatus;
}

export async function fetchCatalog(): Promise<GenCatalog> {
  const res = await fetch("/gencomm.json");
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as GenCatalog;
}

export async function readWords(addr: number, qty: number): Promise<number[]> {
  const res = await fetch(`/api/read?addr=${addr}&qty=${qty}`);
  const body = (await res.json()) as { result?: string; error?: string; words?: number[] };
  if (!res.ok || body.result !== "ok" || !body.words) {
    throw new Error(body.error || body.result || `HTTP ${res.status}`);
  }
  return body.words;
}

export async function writeWords(addr: number, words: number[]): Promise<void> {
  const res = await fetch("/api/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addr, words }),
  });
  const body = (await res.json()) as { result?: string; error?: string };
  if (!res.ok || body.result !== "ok") {
    throw new Error(body.error || body.result || `HTTP ${res.status}`);
  }
}

export async function sendControl(key: number): Promise<void> {
  const res = await fetch("/api/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const body = (await res.json()) as { result?: string; error?: string };
  if (!res.ok || body.result !== "ok") {
    throw new Error(body.error || body.result || `HTTP ${res.status}`);
  }
}
