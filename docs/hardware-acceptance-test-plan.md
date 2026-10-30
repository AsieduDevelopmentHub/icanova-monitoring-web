# Hardware acceptance test plan (Phase 8.0G)

**Status:** Procedure prepared. **No physical validation claimed.**  
**Evidence fields below must remain empty until a real bench/site test.**

Do not fabricate results. Read-only operation by default — no remote start/stop or control register writes.

---

## Gateway (ESP32-C3)

| Test | Pass criteria | Result | Evidence | Date |
|---|---|---|---|---|
| Boot / stability | Stable after power cycle; expected firmware version | | | |
| Network | STA associates; HTTPS uplink reachable | | | |
| Device identity | 12-hex identity matches registered device | | | |
| Heartbeat | Cloud gateway online updates without opening Modbus alarms | | | |
| Ingestion | Telemetry batch accepted | | | |
| Restart recovery | Cursors / seq resume without duplicates | | | |

## RS485

| Test | Pass criteria | Result | Evidence | Date |
|---|---|---|---|---|
| A/B wiring | Correct polarity; documented | | | |
| Termination / bias | Per site design | | | |
| Baud / parity / stop | Match DSE config | | | |
| Isolation / protection | Safe bench wiring | | | |

## Modbus RTU

| Test | Pass criteria | Result | Evidence | Date |
|---|---|---|---|---|
| Valid response | CRC OK; expected registers | | | |
| Timeout | Link fail / unknown — not generator stopped | | | |
| CRC / bad slave / bad register | Error path; no invented zeros | | | |
| Retry / recovery | Restores after loss | | | |
| Duplicate / delayed | Idempotent handling | | | |

## DSE controller

| Test | Pass criteria | Result | Evidence | Date |
|---|---|---|---|---|
| Model ID | Matches expected map | | | |
| Scaling / signed values | Match controller display | | | |
| Missing registers | Unavailable ≠ zero | | | |
| Alarm count | Matches supported evidence | | | |
| Operating states | Running/stopped from RPM evidence only | | | |
| Freshness | Stale after silence | | | |

## Safety

| Check | Confirmed |
|---|---|
| Read-only by default | |
| No remote start/stop in product | |
| No control register writes from cloud UI | |
| Approved power and wiring | |
| Tester / witness | |
