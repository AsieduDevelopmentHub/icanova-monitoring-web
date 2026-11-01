"""Crop iCaNova logo sheet into transparent PNG assets for marketing."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

SRC = Path(
    r"C:\Users\ASIEDU\.cursor\projects\d-dev-hardware-dse-modbus-gateway\assets"
    r"\d__dev_iot_dse-gateway-web_docs_brand_iCaNova_Industrial_Intelligence_Branding_logo.png"
)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "brand"
DOCS = ROOT / "docs" / "brand" / "logo"


def save(im: Image.Image, path: Path, max_w: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = im
    if max_w and out.width > max_w:
        ratio = max_w / out.width
        out = out.resize((max_w, max(1, int(out.height * ratio))), Image.Resampling.LANCZOS)
    out.save(path, "PNG", optimize=True)
    print(f"wrote {path.name} {out.size}")


def trim_alpha(im: Image.Image, pad: int = 4) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop(
        (
            max(0, l - pad),
            max(0, t - pad),
            min(im.width, r + pad),
            min(im.height, b + pad),
        )
    )


def keep_logo_pixel(r: int, g: int, b: int) -> bool:
    # Copper / bronze accents
    if r >= 95 and r >= g + 12 and r >= b + 18:
        return True
    # Off-white bars, arcs, wordmark
    if (r + g + b) / 3.0 >= 118:
        return True
    # Soft anti-aliased copper fringe
    if r >= 70 and r > g and r > b and (r + g + b) / 3.0 >= 70:
        return True
    return False


def cutout_logo(im: Image.Image) -> Image.Image:
    out = im.convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8 or not keep_logo_pixel(r, g, b):
                px[x, y] = (r, g, b, 0)
            else:
                # Restore near-full opacity for kept content
                px[x, y] = (r, g, b, max(a, 230) if a > 40 else a)
    return trim_alpha(out, 6)


def square_pad(im: Image.Image) -> Image.Image:
    side = max(im.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    return canvas


def main() -> None:
    sheet = Image.open(SRC).convert("RGBA")
    DOCS.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(DOCS / "icanova-brand-sheet.png")

    # Manual crops on the 1024x682 sheet.
    lockup = cutout_logo(sheet.crop((130, 125, 980, 355)))
    save(lockup, OUT / "logo-lockup-light.png", 920)
    save(lockup, DOCS / "logo-lockup-light.png", 920)

    # App tiles kept as rounded icons (useful favicon fallback / social).
    icon_dark = trim_alpha(sheet.crop((70, 445, 265, 620)), 2)
    icon_light = trim_alpha(sheet.crop((285, 445, 480, 620)), 2)
    save(icon_dark, OUT / "logo-app-dark.png", 256)
    save(icon_light, OUT / "logo-app-light.png", 256)

    # Transparent mark only (bars + rings) for nav / light surfaces.
    mark = cutout_logo(icon_dark)
    save(mark, OUT / "logo-mark.png", 320)
    save(mark, DOCS / "logo-mark.png", 320)
    save(mark, OUT / "logo-mark-on-light.png", 320)

    # Dark-surface lockup (same cutout as light — white letters).
    save(lockup, OUT / "logo-lockup-dark.png", 920)

    # Wordmark only (copper stylized A) — large footer mark.
    lw, lh = lockup.size
    px = lockup.load()
    gap_end = None
    x = 0
    while x < lw // 2:
        opaque = sum(1 for y in range(lh) if px[x, y][3] > 40)
        if opaque < 3:
            start = x
            while x < lw and sum(1 for y in range(lh) if px[x, y][3] > 40) < 3:
                x += 1
            if x - start >= 8:
                gap_end = x
                break
        else:
            x += 1
    left = gap_end if gap_end is not None else int(lw * 0.30)
    wordmark = trim_alpha(lockup.crop((left, 0, lw, int(lh * 0.72))), 8)
    save(wordmark, OUT / "logo-wordmark.png", 1100)
    save(wordmark, DOCS / "logo-wordmark.png", 1100)

    icon = square_pad(mark)
    for size, name in (
        (512, "logo-icon-512.png"),
        (192, "logo-icon-192.png"),
        (64, "favicon-64.png"),
        (32, "favicon-32.png"),
    ):
        save(icon.resize((size, size), Image.Resampling.LANCZOS), OUT / name)

    # Clean previews
    warm = (242, 241, 237, 255)
    dark = (17, 24, 32, 255)
    for asset, bg, name in (
        (lockup, dark, "preview-lockup-on-dark.png"),
        (lockup, warm, "preview-lockup-on-light.png"),
        (mark, warm, "preview-mark-on-light.png"),
        (mark, dark, "preview-mark-on-dark.png"),
    ):
        canvas = Image.new("RGBA", asset.size, bg)
        canvas.alpha_composite(asset)
        canvas.convert("RGB").save(OUT / name)


if __name__ == "__main__":
    main()
