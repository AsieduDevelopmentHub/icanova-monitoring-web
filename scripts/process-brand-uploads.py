"""Save user brand uploads, crop app tiles to radius, cut lockup bg, rebuild favicons."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
DOCS = ROOT / "docs" / "brand" / "logo"
SRC_DIR = DOCS / "uploads"

ASSETS = Path(r"C:\Users\ASIEDU\.cursor\projects\d-dev-hardware-dse-modbus-gateway\assets")
LIGHT_SRC = ASSETS / (
    "c__Users_ASIEDU_AppData_Roaming_Cursor_User_workspaceStorage_6005101f4b1f1900072ae2f7aec86f4e_images"
    "_image-0872646f-d363-4a05-a368-2d30a42459d6.png"
)
DARK_SRC = ASSETS / (
    "c__Users_ASIEDU_AppData_Roaming_Cursor_User_workspaceStorage_6005101f4b1f1900072ae2f7aec86f4e_images"
    "_image-548df164-4d9f-472e-b8be-205c11ec4ebd.png"
)
LOCKUP_SRC = ASSETS / (
    "c__Users_ASIEDU_AppData_Roaming_Cursor_User_workspaceStorage_6005101f4b1f1900072ae2f7aec86f4e_images"
    "_image-9a124444-3402-4faf-803d-e1bae0b8377d.png"
)

# iOS-like continuous-corner feel ≈ 22% of side
RADIUS_RATIO = 0.22
NAVY = (17, 24, 32, 255)


def save(im: Image.Image, path: Path, max_w: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = im
    if max_w and out.width > max_w:
        ratio = max_w / out.width
        out = out.resize((max_w, max(1, int(out.height * ratio))), Image.Resampling.LANCZOS)
    out.save(path, "PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} {out.size}")


def trim_alpha(im: Image.Image, pad: int = 0) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def detect_tile_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    """Find the opaque rounded tile inside a shadowed/transparent frame."""
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    # Sample corner to learn outer (non-tile) color if present.
    samples = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    outer = samples[0]

    def is_outer(p: tuple[int, int, int, int]) -> bool:
        r, g, b, a = p
        if a < 20:
            return True
        return abs(r - outer[0]) + abs(g - outer[1]) + abs(b - outer[2]) < 28 and a > 200

    # Prefer alpha mask when the tile is already on transparency.
    alpha = rgba.getchannel("A")
    if sum(1 for s in samples if s[3] < 40) >= 2:
        bbox = alpha.point(lambda a: 255 if a >= 40 else 0).getbbox()
        if bbox:
            return bbox

    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if is_outer(px[x, y]):
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def apply_round_mask(im: Image.Image, radius_ratio: float = RADIUS_RATIO) -> Image.Image:
    side = max(im.size)
    # Squash to exact square first so radius matches both axes.
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(im.resize((side, side), Image.Resampling.LANCZOS), (0, 0))
    radius = max(1, int(round(side * radius_ratio)))
    mask = Image.new("L", (side, side), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, side - 1, side - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    out.paste(square, (0, 0))
    out.putalpha(mask)
    return out


def process_app_tile(src: Path, name: str) -> Image.Image:
    raw = Image.open(src).convert("RGBA")
    save(raw, SRC_DIR / f"{name}-source.png")
    cropped = raw.crop(detect_tile_bbox(raw))
    rounded = apply_round_mask(cropped)
    save(rounded, BRAND / f"{name}.png", 512)
    save(rounded, DOCS / f"{name}.png", 512)
    return rounded


def cut_lockup_bg(src: Path) -> Image.Image:
    raw = Image.open(src).convert("RGBA")
    save(raw, SRC_DIR / "logo-lockup-dark-source.png")
    px = raw.load()
    w, h = raw.size
    out = raw.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                opx[x, y] = (0, 0, 0, 0)
                continue
            lum = (r + g + b) / 3.0
            # Pure/near-black plate → transparent.
            if lum <= 18:
                opx[x, y] = (0, 0, 0, 0)
                continue
            # Keep copper accents fully.
            if r >= 95 and r >= g + 10 and r >= b + 12:
                opx[x, y] = (r, g, b, 255)
                continue
            # Keep dark charcoal wordmark/bars (above pure black).
            if lum <= 78:
                opx[x, y] = (r, g, b, min(255, max(a, 230)))
                continue
            # Soft anti-aliased edges against black.
            if lum <= 110:
                edge_a = int(min(255, (lum - 18) / 92 * 255))
                opx[x, y] = (r, g, b, edge_a)
                continue
            opx[x, y] = (r, g, b, 255)
    cut = trim_alpha(out, 4)
    save(cut, BRAND / "logo-lockup-on-dark.png", 1100)
    save(cut, DOCS / "logo-lockup-on-dark.png", 1100)
    # Also refresh lockup-dark as transparent cutout for dark plates.
    save(cut, BRAND / "logo-lockup-dark.png", 1100)
    return cut


def wordmark_from_lockup(lockup: Image.Image, drop_tagline: bool = False) -> Image.Image:
    """Crop wordmark band (drop emblem) for footer sunk mark."""
    w, h = lockup.size
    px = lockup.load()
    best = None
    x = 0
    while x < int(w * 0.55):
        opaque = sum(1 for y in range(h) if px[x, y][3] > 40)
        if opaque < 3:
            start = x
            while x < w and sum(1 for y in range(h) if px[x, y][3] > 40) < 3:
                x += 1
            run = x - start
            if run >= 6 and (best is None or run > best[0]):
                best = (run, x)
        else:
            x += 1
    left = best[1] if best is not None else int(w * 0.28)
    bottom = int(h * 0.72) if drop_tagline else h
    word = trim_alpha(lockup.crop((left, 0, w, bottom)), 6)
    if word.width < 900:
        scale = max(2, round(1000 / max(1, word.width)))
        word = word.resize((word.width * scale, word.height * scale), Image.Resampling.LANCZOS)
    return word


def compose_favicon(mark_tile: Image.Image, size: int) -> Image.Image:
    """Use the light rounded app tile as favicon (already has light bg + radius)."""
    return mark_tile.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    BRAND.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    SRC_DIR.mkdir(parents=True, exist_ok=True)

    light = process_app_tile(LIGHT_SRC, "logo-app-light")
    dark = process_app_tile(DARK_SRC, "logo-app-dark")
    lockup = cut_lockup_bg(LOCKUP_SRC)
    light_lockup_path = BRAND / "logo-lockup-light.png"
    if light_lockup_path.exists():
        light_word = wordmark_from_lockup(
            Image.open(light_lockup_path).convert("RGBA"),
            drop_tagline=True,
        )
        save(light_word, BRAND / "logo-wordmark.png")
        save(light_word, DOCS / "logo-wordmark.png")
        # Dark wordmark is recolored from the clean light wordmark (no emblem debris).
        dark = Image.new("RGBA", light_word.size, (0, 0, 0, 0))
        sp, dp = light_word.load(), dark.load()
        for y in range(light_word.height):
            for x in range(light_word.width):
                r, g, b, a = sp[x, y]
                if a < 12:
                    continue
                if r >= 95 and r >= g + 12 and r >= b + 18:
                    dp[x, y] = (r, g, b, 255)
                elif (r + g + b) / 3.0 >= 120:
                    dp[x, y] = (28, 36, 44, a if a < 230 else 255)
        bbox = dark.getbbox()
        if bbox:
            dark = dark.crop(bbox)
        save(dark, BRAND / "logo-wordmark-dark.png")
        save(dark, DOCS / "logo-wordmark-dark.png")
    else:
        # Fallback only if light lockup is missing.
        dark_word = wordmark_from_lockup(lockup)
        save(dark_word, BRAND / "logo-wordmark-dark.png")
        save(dark_word, DOCS / "logo-wordmark-dark.png")

    # Favicons + touch icons from light bg tile.
    for size, name in (
        (64, "favicon-64.png"),
        (32, "favicon-32.png"),
        (192, "logo-icon-192.png"),
        (512, "logo-icon-512.png"),
    ):
        tile = compose_favicon(light, size)
        save(tile, BRAND / name)

    # Keep a docs copy of dark tile too (already saved). Touch alternate.
    save(dark.resize((192, 192), Image.Resampling.LANCZOS), DOCS / "logo-icon-192-dark.png")
    print("done")


if __name__ == "__main__":
    main()
