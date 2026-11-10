#!/usr/bin/env python3
"""Build a finished, platform-sized YouTube thumbnail from base art plus minimal text.

This codifies the thumbnail process that the publishing standard requires
([`docs/production/YOUTUBE_PUBLISHING.md`](../docs/production/YOUTUBE_PUBLISHING.md) §13.0):

    concept → generate base art → cap the short edge ("3 AM" lockup, "PLANK", …)
    → fit/crop to the platform size → save `thumbnail.jpg` → inspect at small size

The tool never invents imagery: it only crops, resizes and typesets the base art you give it.
Inspection is still a human/agent step — run it, open the file, look at it, and only then copy it
into `videos/<slug>/thumbnail.jpg`.

Examples::

    # 16:9 long-form (1280x720), one line of text
    python3 tools/make_thumbnail.py runtime/thumbs/base-004.jpg /tmp/thumb.jpg \\
        --size 1280x720 --text "#7dd3fc|2 INCHES" --text "#ffffff|IS NOTHING" --top-fade

    # 9:16 Shorts cover (1080x1920)
    python3 tools/make_thumbnail.py runtime/thumbs/base-006b.jpg /tmp/thumb.jpg \\
        --size 1080x1920 --text "#ffffff|NEVER CHECK" --text "#ffcc66|AT 3 AM"

Text spec syntax: ``"#rrggbb|THE TEXT"`` (``|`` separates colour from the string). Text is
centred horizontally, placed by ``--y`` fractions of the image height, in reading order.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:  # Pillow 10 moved the resampling constants onto Image.Resampling
    from PIL import Image as _PILImage

    LANCZOS = _PILImage.Resampling.LANCZOS
except (ImportError, AttributeError):  # pragma: no cover - older Pillow
    LANCZOS = 1

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FONT = ROOT / "universal_toolbook" / "assets" / "Poppins-Bold.ttf"
MAX_BYTES = 2 * 1024 * 1024  # YouTube's hard limit


def parse_size(value: str) -> tuple[int, int]:
    try:
        width, height = (int(part) for part in value.lower().split("x"))
    except ValueError:
        raise argparse.ArgumentTypeError("size must look like 1280x720") from None
    return width, height


def fit_to_aspect(image, width: int, height: int):
    """Centre-crop to the target aspect, then resize — never stretch."""
    target = width / height
    source = image.width / image.height
    if source > target:
        new_width = int(image.height * target)
        left = (image.width - new_width) // 2
        image = image.crop((left, 0, left + new_width, image.height))
    elif source < target:
        new_height = int(image.width / target)
        top = (image.height - new_height) // 2
        image = image.crop((0, top, image.width, top + new_height))
    return image.resize((width, height), LANCZOS)


def apply_top_fade(image, strength: int = 190, depth: float = 0.34):
    """Darken the top band so overlaid text stays legible over busy art."""
    from PIL import Image

    height = image.height
    mask = Image.new("L", (1, height), 0)
    for y in range(height):
        ramp = max(0.0, 1.0 - (y / (height * depth)))
        mask.putpixel((0, y), int(strength * ramp * ramp))
    mask = mask.resize(image.size)
    shade = Image.new("RGB", image.size, (4, 10, 18))
    return Image.composite(shade, image, mask)


def parse_text(spec: str) -> tuple[str, str]:
    if "|" not in spec:
        return "#ffffff", spec
    colour, text = spec.split("|", 1)
    return colour.strip(), text


def render(base: Path, out: Path, size: tuple[int, int], texts, *, y_positions=None,
           size_fractions=None, stroke=7, font_path: Path = DEFAULT_FONT,
           top_fade: bool = False, quality: int = 90) -> Path:
    from PIL import Image, ImageDraw, ImageFont

    width, height = size
    image = fit_to_aspect(Image.open(base).convert("RGB"), width, height)
    if top_fade:
        image = apply_top_fade(image)

    draw = ImageDraw.Draw(image)
    default_y = (0.08, 0.20) if height > width else (0.09, 0.245)
    default_fraction = 0.078 if height > width else 0.115
    for index, spec in enumerate(texts):
        colour, text = parse_text(spec)
        y = (y_positions[index] if y_positions and index < len(y_positions) else default_y[
            min(index, len(default_y) - 1)])
        fraction = (size_fractions[index] if size_fractions and index < len(size_fractions)
                    else default_fraction)
        font = ImageFont.truetype(str(font_path), int(width * fraction))
        draw.text((width // 2, int(height * y)), text, font=font, fill=colour,
                  stroke_width=stroke, stroke_fill="black", anchor="mm")

    out.parent.mkdir(parents=True, exist_ok=True)
    image.save(out, "JPEG", quality=quality, optimize=True)
    if out.stat().st_size > MAX_BYTES:
        image.save(out, "JPEG", quality=78, optimize=True)
    if out.stat().st_size > MAX_BYTES:
        raise SystemExit(f"{out} is still over YouTube's 2 MB limit after re-encoding")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("base", type=Path, help="generated base art (no text)")
    parser.add_argument("out", type=Path, help="output thumbnail.jpg")
    parser.add_argument("--size", type=parse_size, default=(1280, 720),
                        help="1280x720 for 16:9 long-form, 1080x1920 for 9:16 Shorts")
    parser.add_argument("--text", action="append", default=[], metavar="'#rrggbb|TEXT'",
                        help="text line, repeated in reading order")
    parser.add_argument("--y", type=float, action="append", default=None,
                        help="vertical centre of each text line as a fraction of height")
    parser.add_argument("--text-size", type=float, action="append", default=None,
                        help="each text line's font size as a fraction of width")
    parser.add_argument("--stroke", type=int, default=7, help="outline width in pixels")
    parser.add_argument("--top-fade", action="store_true", help="darken the top band for legibility")
    parser.add_argument("--font", type=Path, default=DEFAULT_FONT)
    args = parser.parse_args(argv)

    if not args.base.exists():
        parser.error(f"base art not found: {args.base}")

    out = render(args.base, args.out, args.size, args.text, y_positions=args.y,
                 size_fractions=args.text_size, stroke=args.stroke,
                 font_path=args.font, top_fade=args.top_fade)
    print(f"{out} — {out.stat().st_size/1024:.0f} KB, {args.size[0]}x{args.size[1]}")
    print("Now open it and inspect it (full size and at phone size) before publishing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
