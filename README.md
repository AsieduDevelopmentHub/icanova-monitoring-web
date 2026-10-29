# DSE Gateway — React overview

Separate repo from the ESP32 firmware (`dse-modbus-gateway`). Monitor uses `GET /api/status`. Configure uses `public/gencomm.json` and, when a gateway is connected, `GET /api/read`, `POST /api/write`, and `POST /api/control`.

The firmware tool `tools/build_gencomm_catalog.py` in `dse-modbus-gateway` writes `public/gencomm.json` into this repo at `dev/iot/dse-gateway-web`.

Package manager: **pnpm**.

## Run

```bash
pnpm install

# Mock data (no hardware)
pnpm dev:mock

# Proxy to gateway AP (default http://192.168.4.1)
pnpm dev

# Custom gateway IP
# Windows PowerShell:
$env:VITE_GW_URL="http://192.168.1.50"; pnpm dev
```

Open http://localhost:5173/

## Build

```bash
pnpm build
```

Static output in `dist/`. The ESP32 still serves its own embedded page.
