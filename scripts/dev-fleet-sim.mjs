/**
 * Realistic continuous gateway ingest against Convex **dev**.
 *
 * Scenarios (rotating):
 *   running     — genset on load, full metric suite
 *   mains       — engine stopped, utility / mains present
 *   stopped     — engine stopped, no mains
 *   alarm       — running or mains with alm > 0
 *   link_fail   — Modbus link fail (raises comm alarm after ok→fail)
 *   degraded    — link degraded
 *   silent      — skip posts → Non Updating / stale after HEALTH window
 *   maintenance — silent overlay; maintenance rows seeded via Convex
 *
 *   node scripts/dev-fleet-sim.mjs
 *   node scripts/dev-fleet-sim.mjs --count 56 --interval-ms 30000
 *
 * Env: INGEST_URL + INGEST_SECRET from .env.local.
 * Optional: DEMO_ORG_ID (defaults to latest seeded Demo Power Ghana id).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const convexCli = path.join(repoRoot, "node_modules", "convex", "bin", "main.js");

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
const demoOrgId =
  (process.env.DEMO_ORG_ID || fileEnv.DEMO_ORG_ID || "ms7cad1xc98x7qyxpx4zmcq7j98hjyvr").trim();

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
const paceMs = Math.max(0, Number(arg("--pace-ms", "150")) || 150);
const intervalMs = Math.max(5000, Number(arg("--interval-ms", "30000")) || 30000);
const withHeartbeat = flag("--heartbeat");
const once = flag("--once");
const skipMaintenance = flag("--no-maintenance");
const fw = "sim-dev";
const git = "fleet-sim";
const sessionEpoch = Math.max(1, Math.floor(Date.now() / 1000));
const sessionBoot = (sessionEpoch % 1_000_000) + 1;

/** @typedef {"running"|"mains"|"stopped"|"alarm"|"link_fail"|"degraded"|"silent"|"maintenance"} Scenario */

/** Weighted scenario mix for a realistic fleet. */
const SCENARIO_WEIGHTS = /** @type {Array<{ scenario: Scenario, weight: number }>} */ ([
  { scenario: "running", weight: 48 },
  { scenario: "mains", weight: 16 },
  { scenario: "stopped", weight: 8 },
  { scenario: "alarm", weight: 10 },
  { scenario: "link_fail", weight: 6 },
  { scenario: "degraded", weight: 4 },
  { scenario: "silent", weight: 6 },
  { scenario: "maintenance", weight: 2 },
]);

/**
 * @typedef {{
 *   boot: number,
 *   seq: number,
 *   scenario: Scenario,
 *   linkPhase: "ok"|"fail"|"recover",
 *   silentRoundsLeft: number,
 *   hoursBase: number,
 * }} DeviceState
 */

/** @type {Map<string, DeviceState>} */
const state = new Map();

function identityFor(n) {
  return `demo-gw-${String(n).padStart(3, "0")}`;
}

function pickScenario(rng) {
  const total = SCENARIO_WEIGHTS.reduce((sum, row) => sum + row.weight, 0);
  let roll = rng() * total;
  for (const row of SCENARIO_WEIGHTS) {
    roll -= row.weight;
    if (roll <= 0) return row.scenario;
  }
  return "running";
}

function ensureState(identity, n) {
  let row = state.get(identity);
  if (!row) {
    row = {
      boot: sessionBoot,
      seq: 0,
      scenario: "running",
      linkPhase: "ok",
      silentRoundsLeft: 0,
      hoursBase: 1200 + (n % 800) * 10,
    };
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

function retargetScenarios(_round) {
  for (let n = 1; n <= count; n += 1) {
    const identity = identityFor(n);
    const row = ensureState(identity, n);
    const next = pickScenario(Math.random);
    // Keep an open link_fail long enough to raise + show on UI.
    if (row.scenario === "link_fail" && row.linkPhase === "fail" && Math.random() < 0.55) {
      continue;
    }
    row.scenario = next;
    if (next === "link_fail") {
      row.linkPhase = "ok";
    }
    if (next === "silent" || next === "maintenance") {
      row.silentRoundsLeft = 4 + Math.floor(Math.random() * 5);
    } else {
      row.silentRoundsLeft = 0;
    }
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
  return { status: response.status, body: text.slice(0, 180) };
}

function seedMaintenanceOnce() {
  if (skipMaintenance || !demoOrgId) return;
  const r = spawnSync(
    process.execPath,
    [
      convexCli,
      "run",
      "--deployment",
      "dev",
      "demoSeed:seedDemoMaintenance",
      JSON.stringify({ organizationId: demoOrgId, maxRecords: 8 }),
    ],
    { encoding: "utf8", cwd: repoRoot },
  );
  if (r.stdout) process.stdout.write(`maintenance: ${r.stdout}`);
  if (r.status !== 0 && r.stderr) process.stderr.write(r.stderr);
}

/**
 * Full sample for Site Desk / Operational Area / roster power source.
 * Wire names match convex/metrics.ts (decoded into extra.*).
 */
function sampleFor(row, n, tick, scenario) {
  /** @type {Scenario} */
  const kind = scenario;
  const load = 35 + ((tick + n) % 55);
  const baseHours = Math.floor(row.hoursBase + tick / 3600);

  if (kind === "mains" || (kind === "alarm" && n % 2 === 0)) {
    const alm = kind === "alarm" ? 1 + (n % 3) : 0;
    return {
      t: tick,
      age: 1,
      link: "ok",
      alm,
      mode: null,
      rpm: 0,
      batt10: 252 + (n % 5),
      hz10: 0,
      kw100: 0,
      van10: 0,
      vbn10: 0,
      vcn10: 0,
      // Utility present
      mhz10: 500 + (n % 3),
      mvan10: 2300 + (n % 40),
      mvbn10: 2290 + (n % 40),
      mvcn10: 2310 + (n % 40),
      mvab10: 4000 + (n % 50),
      mvbc10: 3990 + (n % 50),
      mvca10: 4010 + (n % 50),
      fuel: 60 + (n % 30),
      cool: 42 + (n % 8),
      oil: 280 + (n % 20),
      pct100: 0,
      eh100: baseHours * 100,
      starts: 40 + (n % 80),
      eng: 0,
      ctrl: 1,
    };
  }

  if (kind === "stopped" || kind === "maintenance") {
    return {
      t: tick,
      age: 1,
      link: "ok",
      alm: 0,
      mode: null,
      rpm: 0,
      batt10: 246 + (n % 6),
      hz10: 0,
      kw100: 0,
      van10: 0,
      vbn10: 0,
      vcn10: 0,
      mhz10: 0,
      mvan10: 0,
      mvbn10: 0,
      mvcn10: 0,
      fuel: 55 + (n % 20),
      cool: 38 + (n % 6),
      oil: 250,
      pct100: 0,
      eh100: baseHours * 100,
      starts: 30 + (n % 50),
      eng: 0,
      ctrl: 0,
    };
  }

  if (kind === "link_fail") {
    const link = row.linkPhase === "ok" ? "ok" : "fail";
    return {
      t: tick,
      age: 2,
      link,
      alm: link === "fail" ? 0 : 0,
      mode: null,
      rpm: link === "ok" ? 1500 : null,
      batt10: 240,
      hz10: link === "ok" ? 500 : null,
      kw100: link === "ok" ? load * 100 : null,
      van10: link === "ok" ? 2300 : null,
      vbn10: link === "ok" ? 2290 : null,
      vcn10: link === "ok" ? 2310 : null,
      fuel: 70,
      cool: 78,
      eh100: baseHours * 100,
      starts: 55 + (n % 40),
    };
  }

  if (kind === "degraded") {
    return {
      t: tick,
      age: 3,
      link: "degraded",
      alm: 0,
      mode: null,
      rpm: 1450 + (n % 20),
      batt10: 236,
      hz10: 490,
      kw100: Math.max(10, load - 15) * 100,
      van10: 2200,
      vbn10: 2180,
      vcn10: 2210,
      fuel: 50 + (n % 15),
      cool: 88 + (n % 10),
      oil: 220,
      pct100: (load - 10) * 100,
      eh100: baseHours * 100,
      starts: 60 + (n % 30),
      eng: 1,
    };
  }

  // running (+ alarm on genset)
  const alm = kind === "alarm" ? 1 + (n % 4) : 0;
  return {
    t: tick,
    age: 1,
    link: "ok",
    alm,
    mode: null,
    rpm: 1480 + ((tick + n) % 40),
    batt10: 240 + (n % 12),
    hz10: 495 + (n % 8),
    kw100: load * 100,
    van10: 2280 + (n % 50),
    vbn10: 2270 + (n % 50),
    vcn10: 2290 + (n % 50),
    vab10: 3950 + (n % 40),
    vbc10: 3940 + (n % 40),
    vca10: 3960 + (n % 40),
    ia10: 80 + (n % 40),
    ib10: 78 + (n % 40),
    ic10: 82 + (n % 40),
    pct100: load * 100,
    fuel: 45 + (n % 40),
    cool: 75 + (n % 15),
    oil: 300 + (n % 40),
    oilc: 85 + (n % 10),
    eh100: baseHours * 100,
    starts: 80 + (n % 120),
    chg10: 270 + (n % 10),
    pa: load * 300,
    pb: load * 290,
    pc: load * 310,
    pf: 95 + (n % 5),
    // Mains absent / low while genset carries load
    mhz10: 0,
    mvan10: 0,
    mvbn10: 0,
    mvcn10: 0,
    eng: 1,
    ctrl: 2,
  };
}

async function tickGateway(n, now) {
  const identity = identityFor(n);
  const row = ensureState(identity, n);
  const scenario = row.scenario;

  if (scenario === "silent" || scenario === "maintenance") {
    if (row.silentRoundsLeft > 0) {
      row.silentRoundsLeft -= 1;
      return {
        identity,
        scenario,
        skipped: true,
        accepted: true,
        hb: 204,
        batch: 0,
        detail: "skipped",
      };
    }
    // After silence window, resume as stopped so the site can recover.
    row.scenario = "stopped";
  }

  if (scenario === "link_fail") {
    if (row.linkPhase === "ok" && row.seq >= 1) {
      row.linkPhase = "fail";
    } else if (row.linkPhase === "fail" && Math.random() < 0.25) {
      row.linkPhase = "recover";
    } else if (row.linkPhase === "recover") {
      row.linkPhase = "ok";
      row.scenario = "running";
    }
  }

  let hb = { status: 204, body: "" };
  if (withHeartbeat) {
    hb = await postJson({ kind: "heartbeat", identity, fw, git });
    if (paceMs) await sleep(paceMs);
  }

  row.seq += 1;
  const effective =
    scenario === "link_fail" && row.linkPhase === "recover" ? "running" : scenario;
  const batch = await postJson({
    identity,
    boot: row.boot,
    seq: row.seq,
    epoch: sessionEpoch,
    samples: [sampleFor(row, n, now % 1_000_000, effective)],
  });
  return {
    identity,
    scenario: effective,
    skipped: false,
    hb: hb.status,
    batch: batch.status,
    accepted: batchAccepted(batch.status, batch.body),
    detail: batch.body,
  };
}

function tallyScenarios() {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const row of state.values()) {
    counts[row.scenario] = (counts[row.scenario] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

async function runRound(round) {
  const now = Date.now();
  if (round === 1 || round % 3 === 0) {
    retargetScenarios(round);
  }
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  for (let n = 1; n <= count; n += 1) {
    try {
      const r = await tickGateway(n, now);
      if (r.skipped) {
        skipped += 1;
        ok += 1;
      } else {
        const hbOk = !withHeartbeat || r.hb === 204;
        if (hbOk && r.accepted) {
          ok += 1;
        } else {
          fail += 1;
          if (failures.length < 5) {
            failures.push(`${r.identity} ${r.scenario} hb=${r.hb} batch=${r.batch} ${r.detail}`);
          }
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
    `${ts} round=${round} ok=${ok} fail=${fail} silent≈${skipped} mix{ ${tallyScenarios()} }`,
  );
  for (const line of failures) {
    console.log(`  fail: ${line}`);
  }
  if (round === 1 || round % 10 === 0) {
    seedMaintenanceOnce();
  }
  return { ok, fail };
}

console.log(
  `dev-fleet-sim → ${ingestUrl} count=${count} intervalMs=${intervalMs} paceMs=${paceMs} epoch=${sessionEpoch} boot=${sessionBoot}${withHeartbeat ? " heartbeat" : ""}${once ? " once" : ""}`,
);

let round = 0;
let running = false;
retargetScenarios(1);
seedMaintenanceOnce();

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
