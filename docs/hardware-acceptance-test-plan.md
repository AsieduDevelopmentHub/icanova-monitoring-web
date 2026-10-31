# Hardware acceptance test plan (Phase 8.4)

**Status:** Procedure prepared. **No physical validation claimed.**  
**Overall:** `BLOCKED — PHYSICAL HARDWARE REQUIRED` (no DSE controller available for this programme).  
**Policy:** Read-only by default — no remote start/stop or control register writes. Do not fabricate results.

Each test records: Test ID · Equipment · Setup · Procedure · Expected · Actual · Evidence · Pass/fail · Tester · Date.

---

## Gateway (ESP32-C3)

| Test ID | Equipment | Setup / procedure | Expected | Actual | Evidence | Pass/fail | Tester | Date |
|---|---|---|---|---|---|---|---|---|
| HW-GW-01 Boot/stability | ESP32-C3 gateway, PSU | Power cycle; note firmware | Stable boot; expected version | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-02 Brownout | Adjustable PSU | Dip voltage per bench SOP | Clean reset/recovery | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-03 Network STA | AP/SIM as applicable | Associate; HTTPS uplink | Reachable ingest host | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-04 Identity | Registered cloud device | Compare 12-hex identity | Matches registration | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-05 Heartbeat | Cloud staging/prod | Heartbeat only | Online without Modbus alarms | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-06 Ingest batch | NCU/collector path | Send telemetry batch | Accepted / expected status | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-07 Restart cursors | Power cycle mid-stream | Resume seq/cursors | No duplicate events | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-08 Enclosure/thermal | Enclosure | Soak at site temp | Within design limits | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-09 SIM/network | SIM where used | Interrupt/restore WAN | Queue/retry; no silent zeroing | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-GW-10 Device credential | Provisioned secret | Device bearer ingest | Dual-auth success; hash never logged | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |

## RS485

| Test ID | Equipment | Setup / procedure | Expected | Actual | Evidence | Pass/fail | Tester | Date |
|---|---|---|---|---|---|---|---|---|
| HW-485-01 A/B polarity | Cable, DSE | Document polarity | Correct polarity | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-485-02 Termination/bias | Network design | Apply site design | Stable bus | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-485-03 Protection | Transient/ESD as designed | Visual + bench SOP | Protection present | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-485-04 Transceiver | Scope/logic optional | TX/RX activity | Levels within transceiver spec | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |

## Modbus RTU

| Test ID | Equipment | Setup / procedure | Expected | Actual | Evidence | Pass/fail | Tester | Date |
|---|---|---|---|---|---|---|---|---|
| HW-MB-01 Baud/parity/stop | DSE config | Match settings | Frames accepted | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-02 Valid CRC | DSE online | Read known registers | CRC OK; values match map | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-03 Timing | Bus load | Inter-frame timing | Within Modbus RTU timing | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-04 Timeout | Disconnect slave | Request timeout | Link fail — **not** generator stopped | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-05 Bad CRC/slave/reg | Injected faults | Error path | No invented zeros | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-06 Retry/recovery | Restore bus | After failure | Communication restores | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-07 Duplicate/delay | Replay frames | Cloud ingest | Idempotent handling | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-MB-08 Disconnected bus | Open RS485 | Continuous poll | Fail closed; no fake telemetry | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |

## DSE controller

| Test ID | Equipment | Setup / procedure | Expected | Actual | Evidence | Pass/fail | Tester | Date |
|---|---|---|---|---|---|---|---|---|
| HW-DSE-01 Model ID | Physical DSE | Read identity regs | Matches map | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-02 Register map | DSE + documentation | Spot-check critical regs | Scaling/signed match display | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-03 Missing regs | Unsupported set | Request absent | Unavailable ≠ zero | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-04 Alarms | Active/clear on controller | Compare counts/codes | Matches supported evidence | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-05 Operating state | Running/stopped | From DSE fields/RPM evidence | Not inferred from gateway alone | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-06 Freshness | Silence then sample | Stale after silence | Correct freshness state | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |
| HW-DSE-07 Negative power/PF | Controllers that report negatives | Capture samples | Negatives preserved | | | BLOCKED — PHYSICAL HARDWARE REQUIRED | | |

## Safety

| Check ID | Confirmed | Tester | Date |
|---|---|---|---|
| HW-SAFE-01 Read-only product default | | | |
| HW-SAFE-02 No remote start/stop in cloud UI | | | |
| HW-SAFE-03 No control register writes from cloud | | | |
| HW-SAFE-04 Approved power and wiring | | | |

## Software-only note

Cloud dual-auth, ingest limits, and ACL are covered by staging automated tests — they do **not** substitute for the physical rows above.
