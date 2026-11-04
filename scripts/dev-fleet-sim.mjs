/**
 * Continuous gateway ingest soak against Convex **dev**.
 * Seeds are assumed (demo-gw-001…N from demoSeed). Posts telemetry batches;
 * a rotating fraction of gateways report Stopped (rpm=0).
 *
 * Designed to avoid OCC storms on orgHealthSummaries: no parallel heartbeats,
 * paced posts, and non-overlapping rounds.
 *
 *   node scripts/dev-fleet-sim.mjs
 *   node scripts/dev-fleet-sim.mjs --count 20 --interval-ms 20000 --stop-pct 20
 *
 * Env: INGEST_URL + INGEST_SECRET from .env.local (or process env).
 * Does not print secrets.
 */
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL(".env.local", root), "utf8");
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i < 0) continue;
      out[trimmed.slice(0, i)] = trimmed.slice(i + 1);
    }
    return out;
  } catch {
    return {};
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function flag(name) {
  return process.argv.includes(name);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const fileEnv = loadEnvLocal();
const ingestUrl = (process.env.INGEST_URL || fileEnv.INGEST_URL || "").trim();
const ingestSecret = (process.env.INGEST_SECRET || fileEnv.INGEST_SECRET || "").trim();

if (!ingestUrl || !ingestUrl.includes("/ncu/ingest")) {
  console.error("INGEST_URL missing or not an /ncu/ingest URL");
  process.exit(1);
}
if (!ingestSecret || ingestSecret.length < 16) {
  console.error("INGEST_SECRET missing or too short");
  process.exit(1);
}
if (ingestUrl.includes("roadrunner") || ingestUrl.includes("sturgeon")) {
  console.error("Refusing: INGEST_URL does not look like Convex development");
  process.exit(1);
}

const count = Math.max(1, Math.min(56, Number(arg("--count", "56")) || 56));
// Pace posts so orgHealthSummaries OCC retries settle between devices.
const paceMs = Math.max(0, Number(arg("--pace-ms", "120")) || 120);
const intervalMs = Math.max(5000, Number(arg("--interval-ms", "30000")) || 30000);
const stopPct = Math.max(0, Math.min(90, Number(arg("--stop-pct", "20")) || 20));
const withHeartbeat = flag("--heartbeat");
const once = flag("--once");
const fw = "sim-dev";
const git = "dev-fleet-sim";
// Epoch must be > 0 so a restarted sim can supersede a higher leftover seq/boot.
const sessionEpoch = Math.max(1, Math.floor(Date.now() / 1000));
const sessionBoot = (sessionEpoch % 1_000_000) + 1;

/** @type {Map<string, { boot: number, seq: number, stopped: boolean }>} */
const state = new Map();

function identityFor(n) {
  return `demo-gw-${String(n).padStart(3, "0")}`;
}

function ensureState(identity) {
  let row = state.get(identity);
  if (!row) {
    row = { boot: sessionBoot, seq: 0, stopped: false };
    state.set(identity, row);
  }
  return row;
}

function batchAccepted(status, body) {
  if (status !== 200 && status !== 204) return false;
  if (!body) return status === 204;
  try {
    const parsed = JSON.parse(body);
    return parsed?.status === "accepted";
  } catch {
    return false;
  }
}

function retargetStops() {
  const target = Math.round((count * stopPct) / 100);
  const rows = [];
  for (let n = 1; n <= count; n += 1) {
    rows.push(ensureState(identityFor(n)));
  }
  // Stable-ish random selection each retarget.
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  for (let i = 0; i < rows.length; i += 1) {
    rows[i].stopped = i < target;
  }
}

async function postJson(body) {
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ingestSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text.slice(0, 160) };
}

function sampleFor(row, tick) {
  if (row.stopped) {
    return {
      t: tick,
      age: 1,
      link: "ok",
      alm: 0,
      mode: null,
      rpm: 0,
      batt10: 248,
      hz10: 0,
      kw100: 0,
      van10: 0,
    };
  }
  const load = 40 + (tick % 50);
  return {
    t: tick,
    age: 1,
    link: "ok",
    alm: 0,
    mode: null,
    rpm: 1480 + (tick % 40),
    batt10: 240 + (tick % 10),
    hz10: 495 + (tick % 10),
    kw100: load * 100,
    van10: 2280 + (tick % 40),
  };
}

async function tickGateway(n, now) {
  const identity = identityFor(n);
  const row = ensureState(identity);
  let hb = { status: 204, body: "" };
  if (withHeartbeat) {
    hb = await postJson({ kind: "heartbeat", identity, fw, git });
    if (paceMs) await sleep(paceMs);
  }
  row.seq += 1;
  const batch = await postJson({
    identity,
    boot: row.boot,
    seq: row.seq,
    epoch: sessionEpoch,
    samples: [sampleFor(row, now % 1_000_000)],
  });
  return {
    identity,
    stopped: row.stopped,
    hb: hb.status,
    batch: batch.status,
    accepted: batchAccepted(batch.status, batch.body),
    detail: batch.body,
  };
}

async function runRound(round) {
  const now = Date.now();
  // Retarget stops every other round so the fleet isn't thrashing.
  if (round === 1 || round % 2 === 0) {
    retargetStops();
  }
  let ok = 0;
  let fail = 0;
  let stopped = 0;
  const failures = [];
  for (let n = 1; n <= count; n += 1) {
    try {
      const r = await tickGateway(n, now);
      if (r.stopped) stopped += 1;
      const hbOk = !withHeartbeat || r.hb === 204;
      if (hbOk && r.accepted) {
        ok += 1;
      } else {
        fail += 1;
        if (failures.length < 5) {
          failures.push(`${r.identity} hb=${r.hb} batch=${r.batch} ${r.detail}`);
        }
      }
    } catch (err) {
      fail += 1;
      if (failures.length < 5) {
        failures.push(`${identityFor(n)} ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (paceMs) await sleep(paceMs);
  }
  const ts = new Date().toISOString();
  console.log(
    `${ts} round=${round} gateways=${count} ok=${ok} fail=${fail} stopped=${stopped} targetStopPct=${stopPct}`,
  );
  for (const line of failures) {
    console.log(`  fail: ${line}`);
  }
  return { ok, fail };
}

console.log(
  `dev-fleet-sim → ${ingestUrl} count=${count} intervalMs=${intervalMs} paceMs=${paceMs} stopPct=${stopPct} epoch=${sessionEpoch} boot=${sessionBoot}${withHeartbeat ? " heartbeat" : ""}${once ? " once" : ""}`,
);

let round = 0;
let running = false;

async function loop() {
  if (running) return;
  running = true;
  try {
    const result = await runRound(++round);
    if (round === 1 && result.fail === count) {
      console.error("All gateways failed — is the demo fleet seeded on this deployment?");
      process.exit(1);
    }
    if (once) {
      process.exit(result.fail > 0 ? 1 : 0);
    }
  } finally {
    running = false;
  }
  setTimeout(() => {
    void loop();
  }, intervalMs);
}

await loop();
if (!once) {
  console.log("Running continuously (Ctrl+C to stop)…");
}
