#!/usr/bin/env python3
"""Compose a finished thumbnail: base art on top, an auto-fitted text band below.

`make_thumbnail.py` typesets onto art at fixed fractions of the width, which is
why earlier covers either overflowed or sat timidly in a corner. This tool does
the two things a cover actually needs:

  1. reserves a clean band so the art never collides with the type, and
  2. fits each line to a target width, so "23 MINUTES" and "DON'T LOOK" come out
     at the same optical size instead of whatever the character count implies.

Keep the text to one to three words — see tools/thumbnail_copy.py for the evidence.

    python3 tools/compose_thumbnail.py art.jpg out.jpg --size 1080x1920 \\
        --line "#FFFFFF|DON'T" --line "#FF4B3E|LOOK"

Line syntax is `#RRGGBB|TEXT`. Lines are stacked and centred in the band.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FONT = ROOT / "universal_toolbook" / "assets" / "Poppins-Bold.ttf"


def fit_font(draw, text, target_width, largest, smallest=8):
    """Largest point size at which `text` still fits inside `target_width`."""
    low, high, best = smallest, largest, smallest
    while low <= high:
        mid = (low + high) // 2
        font = ImageFont.truetype(str(DEFAULT_FONT), mid)
        if draw.textlength(text, font=font) <= target_width:
            best, low = mid, mid + 1
        else:
            high = mid - 1
    return best


def compose(art_path, out_path, size, lines, art_fraction=0.76, fill=0.90,
            max_frac=0.155, leading=1.02, band_start=0.76, align="center",
            scrim=0.0, band_fill=False, band_darken=0.45):
    """Place `art_path` in the top `art_fraction` of a `size` canvas and typeset below."""
    width, height = size
    canvas = Image.new("RGB", (width, height), (0, 0, 0))

    art = Image.open(art_path).convert("RGB")
    overlay = art_fraction >= 0.999  # art fills the canvas; type sits on it
    band_height = int(height * (1.0 - art_fraction))
    # Height actually available to the type block. In overlay mode that is the
    # region below band_start; feeding the shrink loop a zero band collapsed every
    # landscape cover to 12pt on the first attempt.
    avail = height - int(height * band_start) if overlay else band_height
    target_h = height - band_height

    if overlay:
        # fill the canvas, cropping the overflow
        art = art.resize((width, int(width * art.height / art.width)), Image.LANCZOS)
        if art.height < height:
            art = art.resize((int(height * art.width / art.height), height), Image.LANCZOS)
        spare = art.height - height
        art = art.crop((0, int(spare * 0.25), art.width, int(spare * 0.25) + height))
        canvas.paste(art, (0, 0))
        target_w = width
    else:
        # Always fill the canvas WIDTH and crop the height. Fitting to height
        # instead produced pillarboxed covers with black bars down both sides.
        art = art.resize((width, int(width * art.height / art.width)), Image.LANCZOS)
        if art.height >= target_h:
            spare = art.height - target_h
            art = art.crop((0, int(spare * 0.30), art.width, int(spare * 0.30) + target_h))
        else:
            pad = Image.new("RGB", (width, target_h), art.getpixel((0, art.height - 1)))
            pad.paste(art, (0, (target_h - art.height) // 2))
            art = pad
        canvas.paste(art, (0, 0))
        target_w = width

    if not overlay and band_fill:
        # Bleed the band out of the art's own bottom edge, then darken it. A
        # straight edge sample on a two-tone image averages the two halves into
        # mud; darkening keeps it cohesive and gives the type contrast to sit on.
        edge = art.crop((0, art.height - 3, art.width, art.height)).resize((1, 1), Image.LANCZOS)
        r, g, b = edge.getpixel((0, 0))
        band_colour = (int(r * band_darken), int(g * band_darken), int(b * band_darken))
        canvas.paste(Image.new("RGB", (width, band_height), band_colour),
                     (0, height - band_height))

    draw = ImageDraw.Draw(canvas)
    rendered = []
    for text, colour in lines:
        upper = text.upper()
        points = fit_font(draw, upper, int(width * fill), int(width * max_frac))
        rendered.append((upper, colour, points))

    def line_height(points):
        return draw.textbbox((0, 0), "Ag", font=ImageFont.truetype(str(DEFAULT_FONT), points))[3]

    def block_metrics(rendered):
        heights = [line_height(p) for _, _, p in rendered]
        total = sum(int(h * leading) for h in heights) + int(max(heights) * 0.10) * (len(rendered) - 1)
        return heights, total

    heights, total = block_metrics(rendered)
    # Shrink until the whole block sits inside the band. Without this, a wide
    # 16:9 canvas computes a huge point size from its width and the type runs off
    # the bottom edge — which is exactly what happened on the first landscape pass.
    limit = int(avail * 0.90)
    guard = 0
    while total > limit and max(p for _, _, p in rendered) > 12 and guard < 60:
        rendered = [(t, c, max(12, int(pts * 0.94))) for t, c, pts in rendered]
        heights, total = block_metrics(rendered)
        guard += 1

    band_top = int(height * band_start) if overlay else height - band_height
    y = band_top + max(0, (avail - total) // 2)

    if scrim > 0:
        # a soft dark gradient behind the type, so it stays legible over art
        scrim_layer = Image.new("L", (1, height), 0)
        for row in range(band_top, height):
            depth = (row - band_top) / max(1, height - band_top)
            scrim_layer.putpixel((0, row), int(255 * scrim * min(1.0, depth * 2.4)))
        scrim_layer = scrim_layer.resize((width, height))
        canvas.paste(Image.new("RGB", (width, height), (0, 0, 0)), (0, 0), scrim_layer)

    left_x = int(width * (1.0 - fill) / 2)
    for (text, colour, points), h in zip(rendered, heights):
        font = ImageFont.truetype(str(DEFAULT_FONT), points)
        shadow = max(2, points // 12)
        if align == "left":
            anchor, x = "lt", left_x
        else:
            anchor, x = "mt", width // 2
        # a hard shadow keeps light type legible even if the art creeps into the band
        draw.text((x + shadow, y + shadow), text, font=font, fill=(0, 0, 0), anchor=anchor)
        draw.text((x, y), text, font=font, fill=colour, anchor=anchor)
        y += int(h * leading) + int(max(heights) * 0.10)

    canvas.save(out_path, quality=95)
    return Path(out_path)


def parse_size(value: str) -> tuple[int, int]:
    w, _, h = value.lower().partition("x")
    return int(w), int(h)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("art")
    parser.add_argument("out")
    parser.add_argument("--size", type=parse_size, default=(1080, 1920),
                        help="WxH, e.g. 1080x1920 or 1280x720")
    parser.add_argument("--line", action="append", required=True,
                        help="'#RRGGBB|TEXT' — repeat for each line")
    parser.add_argument("--art-fraction", type=float, default=0.76,
                        help="share of the canvas height given to the art")
    parser.add_argument("--fill", type=float, default=0.90,
                        help="share of the canvas width each line should occupy")
    parser.add_argument("--max-frac", type=float, default=0.155,
                        help="hard cap on the font size, as a fraction of width")
    parser.add_argument("--band-start", type=float, default=0.76,
                        help="with --art-fraction 1.0, where the type block may begin")
    parser.add_argument("--overlay", action="store_true",
                        help="let the art fill the canvas and set type over it")
    parser.add_argument("--align", choices=("center", "left"), default="center")
    parser.add_argument("--scrim", type=float, default=0.0,
                        help="opacity of a dark gradient behind the type (0-1)")
    parser.add_argument("--band-fill", action="store_true",
                        help="colour the text band from the art's own bottom edge")
    parser.add_argument("--band-darken", type=float, default=0.45,
                        help="how far to darken a blead band (0-1)")
    args = parser.parse_args(argv)

    lines = []
    for raw in args.line:
        colour, _, text = raw.partition("|")
        lines.append((text, colour))

    fraction = 1.0 if args.overlay else args.art_fraction
    written = compose(args.art, args.out, args.size, lines,
                      art_fraction=fraction, fill=args.fill,
                      max_frac=args.max_frac, band_start=args.band_start,
                      align=args.align, scrim=args.scrim, band_fill=args.band_fill, band_darken=args.band_darken)
    print(f"{written} — {args.size[0]}x{args.size[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
