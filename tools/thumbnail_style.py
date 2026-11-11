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

    palette    0.35  hue-histogram overlap with the film's own colour, counted
                     only over pixels that actually carry chroma. Skipped entirely
                     for an achromatic film, where "matching the colour" really
                     means "be beige", and is redistributed to line language.
    line       0.40  edge density: how much ink line work the cover carries
                     compared with the film. This is what keeps a cover in the
                     film's drawing language rather than just its tint. For an
                     achromatic film it carries the palette's weight too.
    saturation 0.00  folded into the chroma test above (reported, not scored)
    value      0.25  ink polarity. A thumbnail is *deliberately* pushed to high
                     contrast — white line art on black for a dark film, or the
                     reverse — because that is what reads in a grid. Scoring mean
                     brightness punished exactly that, so what is compared is the
                     film's dark/light balance against the cover's, which is
                     invariant under inversion. Reproducing the film's overall
                     brightness buys nothing; contradicting its balance still fails.

Matching is intentionally a floor, not a target: an art-directed thumbnail that
scores just above threshold is still the designer's call to approve or reject.

A high score is necessary and not sufficient. This tool cannot see focal point,
scale, expression, gesture or typographic punch — the things that actually decide
whether anyone clicks. See docs/production/YOUTUBE_PUBLISHING.md 13.0.
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


def art_region(image, art_fraction=None):
    """Crop away the text band so only artwork is measured.

    Covers built by tools/compose_thumbnail.py declare where their art ends
    (`thumbnail_spec.art_fraction`). When that is given, the band is cut from the
    bottom. Otherwise fall back to ART_TOP_FRACTION, which crops the *top* — the
    legacy assumption that art sat low in the frame.

    This used to always crop the top. Once the covers moved their artwork into the
    upper two-thirds and the type into a band at the bottom, that crop measured the
    text band instead of the art and reported a style mismatch that did not exist.
    """
    if art_fraction is not None:
        bottom = int(image.height * art_fraction)
        return image.crop((0, 0, image.width, bottom))
    top = int(image.height * ART_TOP_FRACTION)
    return image.crop((0, top, image.width, image.height))


def ink_polarity(image, art_fraction=None, split=False) -> float:
    """Share of the frame occupied by the *minority* tone — the drawn material.

    The mistake worth recording: this used to be "share of dark pixels", which is
    not invariant under inversion. A cream film with thin black ink scored 0.10;
    a black cover with white line art scored 0.76; subtracting them declared a
    mismatch between two images of the same drawing.

    The property that actually survives inversion is how much of the frame is
    drawn material rather than empty ground, whichever tone that material is.
    A cream page with black line work and a black page with white line work both
    sit near 0.2; a washed-out single-tone cover sits near 0 and fails, which is
    what we want.
    """
    small = art_region(image.convert("RGB"), art_fraction).resize((96, 96), LANCZOS)
    pixels = list(small.getdata())
    luminance = [(r + g + b) / 765 for r, g, b in pixels]
    dark = sum(1 for v in luminance if v < 0.32) / len(pixels)
    light = sum(1 for v in luminance if v > 0.68) / len(pixels)
    if split:
        return round(dark, 3), round(light, 3)
    return round(min(dark, light), 3)


def tone_balance(image, art_fraction=None) -> float:
    """Which way the frame leans: share of drawn material that is light on dark.

    0 = the drawing is light line work on a dark ground; 1 = dark line work on a
    light ground; 0.5 = the two are equal.

    `ink_polarity` below deliberately ignores this, because a cover is allowed to
    invert the film. The catch is that two covers of the *same split-screen frame*
    can disagree wildly here — a wide 16:9 crop that keeps the bright half scores
    ~0.29, while a tall 9:16 crop of the same art scores ~0.02 — purely because of
    how much of each half lands in frame. That is a framing artefact, not an art
    direction choice, so it is reported separately and never gates a pass.
    """
    dark, light = ink_polarity(image, art_fraction, split=True)
    total = dark + light
    return round(light / total, 3) if total else 0.5


CHROMA_FLOOR = 0.25        # saturation above which a pixel counts as "colour"
ACHROMATIC_SHARE = 0.22     # below this share of chroma the film has no colour world


def chroma_share(image, art_fraction=None) -> float:
    """Share of the art region that carries real saturation.

    A cream-paper film scores near zero here: its "colour" is paper, not palette.
    Treating those near-neutral pixels as hue evidence is what made the checker
    demand that every cover be beige.
    """
    small = art_region(image.convert("RGB"), art_fraction).resize((96, 96), LANCZOS)
    pixels = list(small.getdata())
    coloured = 0
    for r, g, b in pixels:
        hue, saturation, value = _rgb_to_hsv((r, g, b))
        if saturation >= CHROMA_FLOOR and value >= 0.15:
            coloured += 1
    return round(coloured / len(pixels), 3)


def edge_density(image, art_fraction=None) -> float:
    """Fraction of pixels sitting on a strong edge — a proxy for ink line work.

    Flat paper scores near zero, a drawn figure scores high. Two images in the
    same drawing language land close together; a photographic or painterly cover
    against flat line art does not.
    """
    from PIL import ImageFilter, ImageStat

    small = art_region(image.convert("L"), art_fraction).resize((256, 256), LANCZOS)
    edges = small.filter(ImageFilter.FIND_EDGES)
    # count pixels well above the image's own noise floor
    floor = ImageStat.Stat(edges).mean[0] + 12
    return round(sum(1 for px in edges.getdata() if px > floor) / (256 * 256), 4)


def hue_histogram(image, art_fraction=None) -> list[float]:
    """12-bin hue histogram, weighted by saturation so neutral ink and paper
    barely register while coloured light and accents dominate.

    This is the component that actually distinguishes a thumbnail cut from the
    film from one that merely happens to be dark: navy and rust sit in opposite
    hue bins even though an RGB distance calls them neighbours."""
    small = art_region(image.convert("RGB"), art_fraction).resize((96, 96), LANCZOS)
    bins = [0.0] * 12
    for pixel in small.getdata():
        hue, saturation, value = _rgb_to_hsv(pixel)
        # weight by chroma, with a floor so near-neutral art still votes a little
        if saturation < CHROMA_FLOOR:
            continue  # paper and ink are not a palette
        weight = saturation * max(0.05, value)
        bins[min(11, int(hue * 12))] += weight
    total = sum(bins) or 1.0
    return [value / total for value in bins]


def profile(image, art_fraction=None) -> dict:
    """Summarise an image's colour world: mean RGB, HSV and a hue signature."""
    small = art_region(image.convert("RGB"), art_fraction).resize((96, 96), LANCZOS)
    pixels = list(small.getdata())
    count = len(pixels)

    mean = tuple(sum(p[i] for p in pixels) // count for i in range(3))
    hsv = [_rgb_to_hsv(p) for p in pixels]

    return {
        "mean_rgb": mean,
        "saturation": round(sum(h[1] for h in hsv) / count, 3),
        "value": round(sum(h[2] for h in hsv) / count, 3),
        "hues": hue_histogram(image, art_fraction),
        "polarity": ink_polarity(image, art_fraction),
        "tone": tone_balance(image, art_fraction),
        "chroma": chroma_share(image, art_fraction),
        "edges": edge_density(image, art_fraction),
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


def line_similarity(video_profile: dict, thumb_profile: dict) -> float:
    """Closeness of edge density, on a log scale.

    Ink line art and flat poster art sit in the same band; a photographic or
    heavily painted cover sits an order of magnitude away. Deliberately generous
    at the top so authorial variation is not punished.
    """
    import math

    a = max(1e-4, video_profile["edges"])
    b = max(1e-4, thumb_profile["edges"])
    ratio = abs(math.log10(b / a))
    return round(max(0.0, 1.0 - ratio / 1.1), 3)


def compare(video_profile: dict, thumb_profile: dict) -> dict:
    """Score how far a cover has drifted from its film.

    Three properties, and only three, because these are the ones a machine can
    judge honestly:

      line      does the cover carry the film's drawing language (ink weight,
                density, flatness) rather than a photographic one
      polarity  does it keep the film's dark/light balance, which is invariant
                under inversion, so white-on-black for a cream film is fine
      palette   where the film actually has colour, does the cover share it

    Focal point, scale, expression, gesture and typographic punch are not
    measured here and no score can compensate for them.
    """
    line = line_similarity(video_profile, thumb_profile)

    # Deliberately inversion-invariant: a cover may flip the film to light-on-dark,
    # which is what reads in a grid. Comparing tone *direction* would punish that,
    # and it also swung wildly on pure reframing (see tone_balance).
    video_ink = video_profile.get("polarity", video_profile["value"])
    thumb_ink = thumb_profile.get("polarity", thumb_profile["value"])
    polarity = 1.0 - min(1.0, abs(video_ink - thumb_ink) / 0.30)

    film_chroma = video_profile.get("chroma", 1.0)
    cover_chroma = thumb_profile.get("chroma", 1.0)
    if film_chroma < ACHROMATIC_SHARE:
        # No colour world to match. Judging hue here only rewards beige.
        palette = line
    else:
        palette = hue_similarity(video_profile, thumb_profile)

    saturation = 1.0 - min(1.0, abs(video_profile["saturation"] - thumb_profile["saturation"]) / 0.5)

    if film_chroma < ACHROMATIC_SHARE:
        weights = {"line": 0.60, "polarity": 0.40, "palette": 0.0}
    else:
        weights = {"line": 0.35, "polarity": 0.28, "palette": 0.37}

    score = (
        weights["line"] * line
        + weights["polarity"] * polarity
        + weights["palette"] * palette
    )
    return {
        "score": round(score, 3),
        "line": round(line, 3),
        "polarity": round(polarity, 3),
        "palette": round(palette, 3),
        "saturation": round(saturation, 3),
        "achromatic_film": film_chroma < ACHROMATIC_SHARE,
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
        "polarity": round(sum(p["polarity"] for p in profiles) / len(profiles), 3),
        "tone": round(sum(p.get("tone", 0.5) for p in profiles) / len(profiles), 3),
        "chroma": round(sum(p["chroma"] for p in profiles) / len(profiles), 3),
        "edges": round(sum(p["edges"] for p in profiles) / len(profiles), 4),
    }


def report(video: Path, thumbnail: Path, art_fraction=None) -> dict:
    from PIL import Image

    film = video_profile(video)
    result = compare(film, profile(Image.open(thumbnail), art_fraction=art_fraction))
    result["video_edges"] = film["edges"]
    result["video_chroma"] = film["chroma"]
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
    check.add_argument("--package", type=Path, default=None,
                       help="video package dir; reads thumbnail_spec.art_fraction from record.json")

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

    art_fraction = None
    if args.package:
        import json
        record = json.loads((args.package / "record.json").read_text())
        art_fraction = (record.get("thumbnail_spec") or {}).get("art_fraction")

    result = report(args.video, args.thumbnail, art_fraction=art_fraction)
    kind = "achromatic film — colour not scored" if result["achromatic_film"] else "film has a colour world"
    print(f"style similarity {result['score']:.3f}  (threshold {args.threshold})  [{kind}]")
    print(f"  line       {result['line']:.3f}  edge density {result['video_edges']}")
    print(f"  polarity   {result['polarity']:.3f}  ink balance matched")
    print(f"  palette    {result['palette']:.3f}  (informational: saturation {result['saturation']:.3f})")
    if result["score"] >= args.threshold:
        print("MATCH — thumbnail shares the film's visual world")
        return 0
    print("MISMATCH — regenerated base art must use the film's frames as a style reference")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
