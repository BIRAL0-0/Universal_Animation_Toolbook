#!/usr/bin/env python3
"""Measure whether a thumbnail belongs to the same visual world as its video.

The publishing standard requires that a thumbnail look like it was cut from the
film it advertises: same palette family, same level of saturation, same kind of
lighting. Base art is generated separately from the frames — that is allowed and
usually better — but it must be *generated against the film's own frames as a
style reference*, and the result must be verifiable.

This tool makes that requirement objective instead of a vibe:

    python3 tools/thumbnail_style.py profile videos/the-first-plank/the-first-plank.mp4
    python3 tools/thumbnail_style.py check   videos/the-first-plank/the-first-plank.mp4 \
                                             videos/the-first-plank/thumbnail.jpg

`check` prints a 0–1 similarity score with its three components and exits
non-zero when the pair is too far apart to ship.

Scoring rubric (art region only — the type band is excluded):

    palette    0.55  mean nearest-neighbour distance between the thumbnail's
                     dominant colours and the film's dominant colours
    saturation 0.20  closeness of mean HSV saturation
    value      0.25  closeness of mean brightness, and only asymmetric: a
                     thumbnail may be *lifted* for stop-the-scroll contrast (that
                     is a deliberate craft choice) but it may not be dramatically
                     darker or flatter than the film

Matching is intentionally a floor, not a target: an art-directed thumbnail that
scores just above threshold is still the designer's call to approve or reject.
"""

from __future__ import annotations

import argparse
import colorsys
import sys
from pathlib import Path

try:  # Pillow 10 moved the resampling constants onto Image.Resampling
    from PIL import Image as _PILImage

    LANCZOS = _PILImage.Resampling.LANCZOS
except (ImportError, AttributeError):  # pragma: no cover - older Pillow
    LANCZOS = 1

ROOT = Path(__file__).resolve().parents[1]

# The art sits under the type band at the top of every cover, so we score the
# lower part of the frame where the imagery actually lives.
ART_TOP_FRACTION = 0.34
PALETTE_COLOURS = 6
SAMPLES_PER_VIDEO = 8
THRESHOLD = 0.62


import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)


def _rgb_to_hsv(px: tuple[int, int, int]) -> tuple[float, float, float]:
    return colorsys.rgb_to_hsv(px[0] / 255, px[1] / 255, px[2] / 255)


def art_region(image):
    """Crop to the lower band of the image, where the artwork (not the type) sits."""
    top = int(image.height * ART_TOP_FRACTION)
    return image.crop((0, top, image.width, image.height))


def hue_histogram(image) -> list[float]:
    """12-bin hue histogram, weighted by saturation so neutral ink and paper
    barely register while coloured light and accents dominate.

    This is the component that actually distinguishes a thumbnail cut from the
    film from one that merely happens to be dark: navy and rust sit in opposite
    hue bins even though an RGB distance calls them neighbours."""
    small = art_region(image.convert("RGB")).resize((96, 96), LANCZOS)
    bins = [0.0] * 12
    for pixel in small.getdata():
        hue, saturation, value = _rgb_to_hsv(pixel)
        # weight by chroma, with a floor so near-neutral art still votes a little
        weight = max(0.02, saturation) * max(0.05, value)
        bins[min(11, int(hue * 12))] += weight
    total = sum(bins) or 1.0
    return [value / total for value in bins]


def profile(image) -> dict:
    """Summarise an image's colour world: mean RGB, HSV and a hue signature."""
    small = art_region(image.convert("RGB")).resize((96, 96), LANCZOS)
    pixels = list(small.getdata())
    count = len(pixels)

    mean = tuple(sum(p[i] for p in pixels) // count for i in range(3))
    hsv = [_rgb_to_hsv(p) for p in pixels]

    return {
        "mean_rgb": mean,
        "saturation": round(sum(h[1] for h in hsv) / count, 3),
        "value": round(sum(h[2] for h in hsv) / count, 3),
        "hues": hue_histogram(image),
    }


def hue_similarity(left: dict, right: dict) -> float:
    """Histogram intersection of two hue signatures (1 = identical worlds).

    Circular: the twelfth bin is a neighbour of the first, so reds at 355° and
    5° are scored as the same red."""
    left_hist = left["hues"]
    right_hist = right["hues"]
    direct = sum(min(a, b) for a, b in zip(left_hist, right_hist))
    # allow one bin of hue drift (lighting, tint) before penalising
    drifted = [
        (right_hist[i - 1] + right_hist[i] + right_hist[(i + 1) % 12]) / 3 for i in range(12)
    ]
    tolerant = sum(min(a, b) for a, b in zip(left_hist, drifted))
    return round(max(direct, tolerant * 0.92), 3)


def compare(video_profile: dict, thumb_profile: dict) -> dict:
    palette = hue_similarity(video_profile, thumb_profile)
    saturation = 1.0 - min(1.0, abs(video_profile["saturation"] - thumb_profile["saturation"]) / 0.5)

    # Asymmetric on purpose: lifting exposure is craft, crushing it is a mismatch.
    lift = thumb_profile["value"] - video_profile["value"]
    if lift >= 0:
        value = 1.0 - min(1.0, lift / 0.55)
    else:
        value = 1.0 - min(1.0, abs(lift) / 0.30)

    score = 0.55 * palette + 0.20 * saturation + 0.25 * value
    return {
        "score": round(score, 3),
        "palette": round(palette, 3),
        "saturation": round(saturation, 3),
        "value": round(value, 3),
        "passes": score >= THRESHOLD,
    }


def frame_paths(video: Path) -> list[Path]:
    """Sample a handful of stills spread through the film (cached beside the video)."""
    import imageio_ffmpeg
    import subprocess

    meta = imageio_ffmpeg.read_frames(str(video)).__next__()
    duration = float(meta["duration"]) if isinstance(meta, dict) else float(meta[1]["duration"])
    cache = Path("runtime/work/style-cache")
    cache.mkdir(parents=True, exist_ok=True)
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    paths = []
    for index in range(SAMPLES_PER_VIDEO):
        moment = duration * (index + 0.5) / SAMPLES_PER_VIDEO
        out = cache / f"{video.stem}-{index:02d}.jpg"
        if not out.exists():
            subprocess.run(
                [ffmpeg, "-y", "-ss", f"{moment:.2f}", "-i", str(video),
                 "-frames:v", "1", "-q:v", "3", str(out)],
                capture_output=True,
            )
        if out.exists():
            paths.append(out)
    return paths


def video_profile(video: Path) -> dict:
    """Aggregate a film's colour world across samples spread through its runtime."""
    from PIL import Image

    profiles = [profile(Image.open(path)) for path in frame_paths(video)]
    if not profiles:
        raise SystemExit(f"could not sample any frames from {video}")

    hues = [0.0] * 12
    for film in profiles:
        for index, share in enumerate(film["hues"]):
            hues[index] += share / len(profiles)
    return {
        "mean_rgb": tuple(sum(p["mean_rgb"][i] for p in profiles) // len(profiles) for i in range(3)),
        "saturation": round(sum(p["saturation"] for p in profiles) / len(profiles), 3),
        "value": round(sum(p["value"] for p in profiles) / len(profiles), 3),
        "hues": [round(value, 4) for value in hues],
    }


def report(video: Path, thumbnail: Path) -> dict:
    from PIL import Image

    film = video_profile(video)
    result = compare(film, profile(Image.open(thumbnail)))
    result["video_value"] = film["value"]
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    prof = sub.add_parser("profile", help="print a film's visual profile")
    prof.add_argument("video", type=Path)

    check = sub.add_parser("check", help="score a thumbnail against its film")
    check.add_argument("video", type=Path)
    check.add_argument("thumbnail", type=Path)
    check.add_argument("--threshold", type=float, default=THRESHOLD)

    args = parser.parse_args(argv)

    if args.command == "profile":
        data = video_profile(args.video)
        print(f"mean rgb   {data['mean_rgb']}")
        print(f"saturation {data['saturation']}")
        print(f"value      {data['value']}")
        labels = ["red", "orange", "yellow", "yellow-green", "green", "spring", "cyan",
                  "azure", "blue", "violet", "magenta", "rose"]
        print("hue signature:")
        for label, share in zip(labels, data["hues"]):
            if share >= 0.02:
                print(f"  {label:<13}{share:5.1%}  {'#' * round(share * 40)}")
        return 0

    if not args.video.exists():
        print(f"missing video: {args.video}", file=sys.stderr)
        return 2
    if not args.thumbnail.exists():
        print(f"missing thumbnail: {args.thumbnail}", file=sys.stderr)
        return 2

    result = report(args.video, args.thumbnail)
    print(f"style similarity {result['score']:.3f}  (threshold {args.threshold})")
    print(f"  hue        {result['palette']:.3f}  weight 0.55")
    print(f"  saturation {result['saturation']:.3f}  weight 0.20")
    print(f"  value      {result['value']:.3f}  weight 0.25")
    if result["score"] >= args.threshold:
        print("MATCH — thumbnail shares the film's visual world")
        return 0
    print("MISMATCH — regenerated base art must use the film's frames as a style reference")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
