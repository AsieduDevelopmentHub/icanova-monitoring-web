"""Key white studio background to alpha and turn floor leftovers into a soft ground shadow."""
from __future__ import annotations

import os
import shutil

import numpy as np
from PIL import Image, ImageFilter

SRC = r"C:\Users\ASIEDU\.cursor\projects\d-dev-hardware-dse-modbus-gateway\assets\icanova-gateway-product.jpg"
OUT_DIR = r"D:\dev\iot\dse-gateway-web\public\brand"
OUT = os.path.join(OUT_DIR, "icanova-edge-gateway.png")
DOCS_OUT = r"D:\dev\iot\dse-gateway-web\docs\brand\icanova-edge-gateway.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    a = np.array(im, dtype=np.float32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    avg = (r + g + b) / 3.0
    chroma = np.maximum(np.maximum(np.abs(r - g), np.abs(g - b)), np.abs(r - b))
    h = avg.shape[0]
    yy = np.arange(h)[:, None]

    white = avg >= 242
    near = (~white) & (avg >= 220) & (chroma < 14)
    alpha = np.full(avg.shape, 255.0, dtype=np.float32)
    alpha[white] = 0
    alpha[near] = np.clip((242 - avg[near]) / 22.0, 0, 1) * 255

    product = (avg < 200) | (chroma >= 14)
    ground = (~product) & (chroma < 14) & (avg >= 150) & (avg < 242) & (yy > h * 0.52)
    strength = np.clip((235 - avg[ground]) / 90.0, 0, 1) ** 1.15
    a[ground, 0] = 48
    a[ground, 1] = 46
    a[ground, 2] = 42
    alpha[ground] = strength * 95

    fringe = (avg >= 210) & (chroma < 12) & (~ground)
    alpha[fringe] = np.minimum(alpha[fringe], np.clip((230 - avg[fringe]) / 30.0, 0, 1) * 40)

    a[:, :, 3] = alpha
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")

    rgb = out.convert("RGB")
    al = out.split()[3].filter(ImageFilter.GaussianBlur(radius=0.8))
    out = Image.merge("RGBA", (*rgb.split(), al))

    bbox = out.getbbox()
    if bbox:
        pad = 56
        l, t, r2, b2 = bbox
        out = out.crop(
            (
                max(0, l - pad),
                max(0, t - pad),
                min(out.size[0], r2 + pad),
                min(out.size[1], b2 + pad),
            ),
        )

    canvas = Image.new("RGBA", (out.size[0], out.size[1] + 48), (0, 0, 0, 0))
    canvas.paste(out, (0, 0), out)
    out = canvas

    os.makedirs(OUT_DIR, exist_ok=True)
    out.save(OUT, "PNG", optimize=True)
    os.makedirs(os.path.dirname(DOCS_OUT), exist_ok=True)
    shutil.copyfile(OUT, DOCS_OUT)
    print(f"saved {OUT} {out.size}")


if __name__ == "__main__":
    main()
