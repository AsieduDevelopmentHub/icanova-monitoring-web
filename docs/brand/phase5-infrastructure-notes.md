# Phase 5 — Gateway & infrastructure management notes

## Capability matrix

| Capability | Backend | UI | Action taken |
| ---------- | ------- | -- | ------------ |
| Gateway registration | `devices.create` (+ 12-hex identity) | Gateways + Generators | Improved workflow + validation |
| Gateway-to-site assignment | Required at create | Site select on register | Reused |
| Device registration | Same as gateway row | Same | Clarified product naming |
| Site create / rename | `sites.create`, `sites.rename` | Sites page | Added rename + create UI |
| Generator create | `generators.create` | Generators / OrgFleet | Kept |
| Modbus configuration | Soft-AP / USB CLI only | Local Configure | Documented — not cloud-delivered |
| Config delivery / ack | None | Honest empty states | Do not invent |
| Device diagnostics | `diagnostics.list` | Gateway detail | Reused |
| Firmware version | Not stored | Shown as unavailable | Documented |
| Ingest credentials | Existing mutations | Not exposed as secrets | Unchanged |

## Provisioning (verified)

1. Create organization (if needed).
2. Create site.
3. Register gateway with **12-character efuse MAC** identity.
4. Attach generator(s) to that gateway.
5. Device must heartbeat/ingest with the same identity.
6. Soft-AP Modbus / GenComm settings remain local to the gateway.
