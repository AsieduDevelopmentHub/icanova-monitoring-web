export type GenReg = {
  o: number;
  w: number;
  n: string;
  a: "r" | "rw" | "w";
  ty?: string;
  mn?: string;
  mx?: string;
  v?: (number | null)[];
  comp?: boolean;
};

export type GenPage = {
  p: number;
  b: number;
  t: string;
  regs: GenReg[];
};

export type GenScf = {
  k: number;
  n: string;
  blocked?: boolean;
  risk?: boolean;
};

export type GenCatalog = {
  device: string;
  model: number;
  formula: string;
  wordOrder: string;
  note: string;
  pages: GenPage[];
  scf: GenScf[];
};

const SENTINELS = [
  "reserved",
  "low input",
  "high input",
  "bad data",
  "transducer fault",
  "under range",
  "over range",
  "unimplemented",
];

export function sentinelName(raw: number, type?: string): string | null {
  const signed = !!type && /s/i.test(type);
  if (!signed && raw >= 0xfff8 && raw <= 0xffff) {
    return SENTINELS[raw - 0xfff8] ?? "unavailable";
  }
  if (signed && raw >= 0x7ff8 && raw <= 0x7fff) {
    return SENTINELS[raw - 0x7ff8] ?? "unavailable";
  }
  return null;
}

export function formatWord(raw: number | null, type?: string): string {
  if (raw === null || raw === undefined) {
    return "—";
  }
  const name = sentinelName(raw, type);
  if (name) {
    return name;
  }
  const hex = raw.toString(16).toUpperCase().padStart(4, "0");
  return `${raw} (0x${hex})`;
}

export function readSpans(page: GenPage): { addr: number; qty: number }[] {
  const addrs = new Set<number>();
  for (const reg of page.regs) {
    for (let i = 0; i < reg.w; i++) {
      addrs.add(page.b + reg.o + i);
    }
  }
  const sorted = [...addrs].sort((a, b) => a - b);
  const spans: { addr: number; qty: number }[] = [];
  let i = 0;
  while (i < sorted.length) {
    let qty = 1;
    while (
      i + qty < sorted.length &&
      sorted[i + qty] === sorted[i] + qty &&
      qty < 8
    ) {
      qty++;
    }
    spans.push({ addr: sorted[i], qty });
    i += qty;
  }
  return spans;
}

export function wordsForWrite(reg: GenReg, text: string): number[] {
  const parts = text
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => Number(part));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 65535)) {
    throw new Error("Each word must be an integer from 0 to 65535");
  }
  if (reg.comp) {
    if (parts.length !== 1) {
      throw new Error("Enter one value. Its ones complement is sent with it.");
    }
    return [parts[0], (65535 - parts[0]) & 0xffff];
  }
  if (parts.length !== reg.w) {
    throw new Error(`Enter ${reg.w} word${reg.w === 1 ? "" : "s"}, separated by spaces`);
  }
  return parts;
}
