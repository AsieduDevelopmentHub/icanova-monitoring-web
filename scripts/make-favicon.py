"""Build favicons from the designed dark app tile — large, optically centered mark."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
DOCS = ROOT / "docs" / "brand" / "logo"
# Prefer the designed dark app tile; fall back to transparent mark.
SOURCES = (
    BRAND / "logo-app-dark.png",
    DOCS / "logo-mark.png",
    BRAND / "logo-mark.png",
)
NAVY = (17, 24, 32, 255)


def content_bbox(im: Image.Image, threshold: int = 36) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 18:
                continue
            # Ignore near-navy / near-black plate pixels.
            if r <= 40 and g <= 48 and b <= 58:
                continue
            # Keep bright bars and copper rings.
            bright = (r + g + b) / 3.0 >= 95
            copper = r >= 90 and r > g + 5 and r > b + 8
            if not (bright or copper):
                continue
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if maxx < 0:
        bbox = im.getbbox()
        return bbox if bbox else (0, 0, w, h)
    pad = 2
    return (
        max(0, minx - pad),
        max(0, miny - pad),
        min(w, maxx + 1 + pad),
        min(h, maxy + 1 + pad),
    )


def opacity_centroid(im: Image.Image) -> tuple[float, float]:
    px = im.load()
    w, h = im.size
    mass = cx = cy = 0.0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if r <= 40 and g <= 48 and b <= 58:
                continue
            bright = (r + g + b) / 3.0 >= 95
            copper = r >= 90 and r > g + 5 and r > b + 8
            if not (bright or copper):
                continue
            wgt = (a / 255.0) * (1.35 if bright else 1.0)
            mass += wgt
            cx += x * wgt
            cy += y * wgt
    if mass <= 0:
        return (w / 2.0, h / 2.0)
    return (cx / mass, cy / mass)


def boost(im: Image.Image) -> Image.Image:
    out = im.convert("RGBA").copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 12 or (r <= 40 and g <= 48 and b <= 58):
                px[x, y] = (0, 0, 0, 0)
                continue
            if (r + g + b) / 3 >= 95:
                px[x, y] = (min(255, r + 45), min(255, g + 45), min(255, b + 40), 255)
            elif r >= 90 and r > g:
                px[x, y] = (min(255, r + 50), min(255, g + 22), min(255, b + 10), 255)
            else:
                px[x, y] = (r, g, b, 0)
    return out


def solid_tile(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), NAVY)


def rounded_tile(size: int, radius: int) -> Image.Image:
    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=NAVY)
    return tile


def compose(mark: Image.Image, size: int, fill: float, rounded: bool, cover: bool = False) -> Image.Image:
    # contain = fit inside; cover = fill tile (may crop edges) for tiny favicons.
    usable = size * fill
    basis = min(mark.width, mark.height) if cover else max(mark.width, mark.height)
    ratio = usable / basis
    mw = max(1, int(round(mark.width * ratio)))
    mh = max(1, int(round(mark.height * ratio)))
    scaled = mark.resize((mw, mh), Image.Resampling.LANCZOS)

    tile = rounded_tile(size, max(1, size // 5)) if rounded else solid_tile(size)
    cx, cy = opacity_centroid(scaled)
    x = int(round(size / 2.0 - cx))
    y = int(round(size / 2.0 - cy))
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    layer.alpha_composite(scaled, (x, y))
    tile.alpha_composite(layer)
    return tile


def main() -> None:
    src = next(p for p in SOURCES if p.exists())
    raw = Image.open(src).convert("RGBA")
    mark = boost(raw.crop(content_bbox(raw)))
    print(f"source={src.name} mark={mark.size}")

    # Clean square transparent mark for UI.
    side = max(mark.size) + 12
    clean = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    cx, cy = opacity_centroid(mark)
    clean.alpha_composite(
        mark,
        (int(round(side / 2.0 - cx)), int(round(side / 2.0 - cy))),
    )
    for dest in (BRAND / "logo-mark.png", DOCS / "logo-mark.png"):
        dest.parent.mkdir(parents=True, exist_ok=True)
        clean.save(dest, "PNG", optimize=True)
    print(f"rewrote logo-mark.png {clean.size}")

    # Favicons: solid square, cover-scale so the mark reads large in-tab.
    for size, name, fill in (
        (64, "favicon-64.png", 0.90),
        (32, "favicon-32.png", 0.94),
    ):
        tile = compose(mark, size, fill=fill, rounded=False, cover=True)
        tile.save(BRAND / name, "PNG", optimize=True)
        print(f"wrote {name}")

    # App / OG icons keep rounded corners and safer contain fit.
    for size, name, fill in (
        (512, "logo-icon-512.png", 0.80),
        (192, "logo-icon-192.png", 0.80),
    ):
        tile = compose(mark, size, fill=fill, rounded=True, cover=False)
        tile.save(BRAND / name, "PNG", optimize=True)
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
