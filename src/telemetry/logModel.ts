import { parseMeasurement, type Reading } from "./readings";

export const DEMO_GENERATOR_ID = "log-7320";
export const DEMO_SOURCE = "dse-modbus-gateway/logs/dse.log";

export type BatchFail = {
  address: number;
  qty: number;
  result: number;
  resultName: string;
};

export type LogSample = {
  index: number;
  sourceTime: null;
  sourceLabel: string;
  mode: string | null;
  link: string | null;
  alarmPage: string | null;
  batchFails: BatchFail[];
  readings: Reading[];
};

export type CommFrame = {
  txn: number;
  device: string | null;
  request: string | null;
  tx: string | null;
  rx: string | null;
  rxLength: number | null;
  staleBytes: number | null;
  firstRxMs: number | null;
  receivedCrc: string | null;
  calculatedCrc: string | null;
  crcResult: string | null;
  result: string | null;
  note: string | null;
  retries: number | null;
  source: string;
};

export type FrameFacts = {
  functionCode: string | null;
  address: number | null;
  quantity: number | null;
  retries: number | null;
  latencyMs: number | null;
  successful: boolean;
};

/** Names from ModbusResult in the gateway firmware. Unknown codes stay numeric. */
const MODBUS_RESULT = [
  "ok",
  "timeout",
  "crc",
  "exception",
  "frame",
  "rejected",
  "unexpected",
  "partial",
] as const;

export function modbusResultName(code: number): string {
  return MODBUS_RESULT[code] ?? `result ${code}`;
}

const SKIP_LABELS = new Set(["Flags", "Supported (read)"]);

export function parseSampleLines(lines: string[], index: number): LogSample {
  const sample: LogSample = {
    index,
    sourceTime: null,
    sourceLabel: `${DEMO_SOURCE} · sample ${index + 1} · no clock in the terminal log`,
    mode: null,
    link: null,
    alarmPage: null,
    batchFails: [],
    readings: [],
  };
  for (const line of lines) {
    const link = line.match(/^LINK:\s*(\S+)/);
    if (link) {
      sample.link = link[1];
      continue;
    }
    const alarm = line.match(/^Alarm page (\d+):\s*(.+)$/);
    if (alarm) {
      sample.alarmPage = `${alarm[1]} ${alarm[2].trim()}`;
      continue;
    }
    const batch = line.match(/^BATCH FAIL @(\d+) qty=(\d+) result=(\d+)/);
    if (batch) {
      const result = Number(batch[3]);
      sample.batchFails.push({
        address: Number(batch[1]),
        qty: Number(batch[2]),
        result,
        resultName: modbusResultName(result),
      });
      continue;
    }
    const kv = line.match(/^([^:]+):\s*(.*)$/);
    if (!kv) {
      continue;
    }
    const label = kv[1].trim();
    if (SKIP_LABELS.has(label) || label.startsWith("[")) {
      continue;
    }
    if (label === "Operating mode") {
      sample.mode = kv[2].trim();
      continue;
    }
    sample.readings.push(parseMeasurement(label, kv[2]));
  }
  return sample;
}

export function parseLogSamples(text: string): LogSample[] {
  const samples: LogSample[] = [];
  let current: string[] | null = null;
  const flush = () => {
    if (!current) {
      return;
    }
    samples.push(parseSampleLines(current, samples.length));
    current = null;
  };
  for (const line of text.split(/\r?\n/)) {
    if (/^======== cycle /.test(line) || /^## DSE iterate /.test(line)) {
      flush();
      current = [line];
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("> ") || line.startsWith("PS ")) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return samples;
}

export function parseCommFrames(text: string): CommFrame[] {
  const frames: CommFrame[] = [];
  let draft: CommFrame | null = null;
  const push = () => {
    if (draft) {
      frames.push(draft);
      draft = null;
    }
  };
  for (const line of text.split(/\r?\n/)) {
    const txn = line.match(/TXN #(\d+)/);
    if (txn) {
      push();
      draft = {
        txn: Number(txn[1]),
        device: null,
        request: null,
        tx: null,
        rx: null,
        rxLength: null,
        staleBytes: null,
        firstRxMs: null,
        receivedCrc: null,
        calculatedCrc: null,
        crcResult: null,
        result: null,
        note: null,
        retries: null,
        source: DEMO_SOURCE,
      };
      continue;
    }
    if (!draft) {
      continue;
    }
    const device = line.match(/^Device:\s*(.+)$/);
    if (device) {
      draft.device = device[1].trim();
      continue;
    }
    const request = line.match(/^REQUEST(?: fields)?:\s*(.+)$/);
    if (request) {
      draft.request = request[1].trim();
      continue;
    }
    const tx = line.match(/^FINAL TX BYTE ARRAY:\s*(.+)$/);
    if (tx) {
      draft.tx = tx[1].trim();
      continue;
    }
    const rx = line.match(/^RAW RX:\s*(.+)$/);
    if (rx) {
      draft.rx = rx[1].trim();
      continue;
    }
    const rxLength = line.match(/^RX length:\s*(\d+)/);
    if (rxLength) {
      draft.rxLength = Number(rxLength[1]);
      continue;
    }
    const stale = line.match(/^RX stale bytes:\s*(\d+)/);
    if (stale) {
      draft.staleBytes = Number(stale[1]);
      continue;
    }
    const first = line.match(/^Time to first RX byte:\s*(\d+)\s*ms/);
    if (first) {
      draft.firstRxMs = Number(first[1]);
      continue;
    }
    const received = line.match(/^RECEIVED CRC COMBINED:\s*(\S+)/);
    if (received) {
      draft.receivedCrc = received[1];
      continue;
    }
    const calculated = line.match(/^CALCULATED CRC:\s*(\S+)/);
    if (calculated) {
      draft.calculatedCrc = calculated[1];
      continue;
    }
    const crc = line.match(/^CRC RESULT:\s*(\S+)/);
    if (crc) {
      draft.crcResult = crc[1];
      continue;
    }
    const result = line.match(/^RESULT:\s*(.+)$/);
    if (result) {
      draft.result = result[1].trim();
      continue;
    }
    const note = line.match(/^NOTE:\s*(.+)$/);
    if (note) {
      draft.note = note[1].trim();
      continue;
    }
    const retries = line.match(/^Retries:\s*(\d+)/i);
    if (retries) {
      draft.retries = Number(retries[1]);
    }
  }
  push();
  return frames;
}

function hexByte(value: string): string | null {
  if (!/^[0-9a-fA-F]{2}$/.test(value)) {
    return null;
  }
  return `0x${value.toLowerCase()}`;
}

/** Function code and address come from the request line, or from the TX bytes when the line omits them. */
export function frameFacts(frame: CommFrame): FrameFacts {
  const request = frame.request ?? "";
  const fc = request.match(/fc=0x([0-9a-fA-F]+)/);
  const addrHex = request.match(/addr=0x([0-9a-fA-F]+)/);
  const addrDec = request.match(/addr=(\d+)/);
  const qty = request.match(/qty=(\d+)/);
  let functionCode = fc ? `0x${fc[1].toLowerCase()}` : null;
  let address = addrHex ? Number.parseInt(addrHex[1], 16) : addrDec ? Number(addrDec[1]) : null;
  const tx = frame.tx?.split(/\s+/) ?? [];
  if (!functionCode && tx.length >= 2) {
    functionCode = hexByte(tx[1]);
  }
  if (address === null && tx.length >= 4 && hexByte(tx[2]) && hexByte(tx[3])) {
    address = Number.parseInt(tx[2] + tx[3], 16);
  }
  return {
    functionCode,
    address: address !== null && Number.isFinite(address) ? address : null,
    quantity: qty ? Number(qty[1]) : null,
    retries: frame.retries,
    latencyMs: frame.firstRxMs,
    successful: frame.crcResult === "PASS" && frame.result === "VALID MODBUS RESPONSE",
  };
}

/** CRC PASS with an invalid frame is not a successful poll. */
export function lastSuccessfulFrame(frames: CommFrame[]): CommFrame | null {
  for (let index = frames.length - 1; index >= 0; index -= 1) {
    const frame = frames[index];
    if (frameFacts(frame).successful) {
      return frame;
    }
  }
  return null;
}

export function seriesFor(
  samples: LogSample[],
  label: string,
): { index: number; value: number; text: string }[] {
  const points: { index: number; value: number; text: string }[] = [];
  for (const sample of samples) {
    const reading =
      sample.readings.find((item) => item.label === label) ?? null;
    if (!reading || reading.quality !== "measured" || reading.value === null || !reading.valueText) {
      continue;
    }
    points.push({ index: sample.index + 1, value: reading.value, text: reading.valueText });
  }
  return points;
}
