import { frameFacts, type CommFrame, type LogSample } from "./logModel";

export type DiagnosticKind = "frame" | "batch";

export type DiagnosticRow = {
  key: string;
  kind: DiagnosticKind;
  txn: number | null;
  functionCode: string | null;
  address: number | null;
  quantity: number | null;
  tx: string | null;
  rx: string | null;
  rxLength: number | null;
  receivedCrc: string | null;
  calculatedCrc: string | null;
  crcResult: string | null;
  result: string | null;
  latencyMs: number | null;
  retries: number | null;
  note: string | null;
};

export function demoDiagnostics(frames: CommFrame[], samples: LogSample[]): DiagnosticRow[] {
  const frameRows: DiagnosticRow[] = frames.map((frame) => {
    const facts = frameFacts(frame);
    return {
      key: `txn-${frame.txn}`,
      kind: "frame",
      txn: frame.txn,
      functionCode: facts.functionCode,
      address: facts.address,
      quantity: facts.quantity,
      tx: frame.tx,
      rx: frame.rx,
      rxLength: frame.rxLength,
      receivedCrc: frame.receivedCrc,
      calculatedCrc: frame.calculatedCrc,
      crcResult: frame.crcResult,
      result: frame.result,
      latencyMs: facts.latencyMs,
      retries: facts.retries,
      note: frame.note,
    };
  });
  const batchRows: DiagnosticRow[] = samples.flatMap((sample) =>
    sample.batchFails.map((fail) => ({
      key: `batch-${sample.index}-${fail.address}`,
      kind: "batch" as const,
      txn: null,
      functionCode: null,
      address: fail.address,
      quantity: fail.qty,
      tx: null,
      rx: null,
      rxLength: null,
      receivedCrc: null,
      calculatedCrc: null,
      crcResult: null,
      result: fail.resultName,
      latencyMs: null,
      retries: null,
      note: `Sample ${sample.index + 1}. Result code ${fail.result}.`,
    })),
  );
  return [...frameRows, ...batchRows];
}

export function lastSuccessfulRow(rows: DiagnosticRow[]): DiagnosticRow | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.kind === "frame" && row.crcResult === "PASS" && row.result === "VALID MODBUS RESPONSE") {
      return row;
    }
  }
  return null;
}

export function filterDiagnostics(
  rows: DiagnosticRow[],
  search: string,
  kind: "all" | DiagnosticKind,
): DiagnosticRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) {
      return false;
    }
    if (!needle) {
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
      .includes(needle);
  });
}

export function retriesLabel(value: number | null): string {
  return value === null ? "not recorded" : String(value);
}

export function addressLabel(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value} (0x${value.toString(16)})`;
}
