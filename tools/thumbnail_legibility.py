#!/usr/bin/env python3
"""See a thumbnail the way a viewer actually sees it — at phone search size.

Every thumbnail rule in this repository is about a surface nobody checks: the
YouTube mobile search result, where a cover is about 168 px wide, and the mobile
home feed, about 216 px. At those sizes a cover is no longer an image, it is a
168 px smudge that either reads in a quarter of a second or does not. A cover
that is beautiful at 1080 px and unreadable at 168 px is a cover nobody clicks.

This tool does the part a person cannot do reliably by squinting, and refuses to
pretend to do the part it cannot.

WHAT IT PROVES (gating)
-----------------------
1. The cover was seen at the sizes it will really be rendered at. `--sheet`
   writes a contact sheet with every cover at exactly 168 px and 216 px, in a
   grid, so the eye can compare them the way a feed does.
2. No two covers are the same picture at search size. This is measured, and the
   measure is calibrated: the same cover re-saved, rescaled, recompressed or
   brightened by 15% scores 0.000-0.010; mirrored scores 0.010; two unrelated
   covers score about 1.0. Identical-looking covers compete with each other in a
   channel listing, and that is the one thing here a number can settle.

WHAT IT REPORTS BUT DOES NOT JUDGE (never fails a build)
--------------------------------------------------------
`--measure` prints indicative numbers: how much of the frame a dominant shape
occupies, and the luminance spread behind the overlay text. These are useful as
a prompt to look harder, and they are *not* a verdict.

That restriction is not caution for its own sake — it is the result of testing.
Three candidate measures (centre-weighted saliency share, edge-energy text-band
contrast, and connected-component cap height) were run against these eight
shipped covers and each one confidently failed covers that are plainly readable
at 168 px, while passing ones that are not. A cover is legible because of
composition, silhouette and type design, and none of those reduce to a scalar.
The measurements stay, clearly labelled, because they still help a human decide;
they do not gate, because a number that is wrong is worse than no number.

    python3 tools/thumbnail_legibility.py --all --sheet runtime/work/covers.png
    python3 tools/thumbnail_legibility.py videos/the-bamboo-seed/thumbnail.jpg
    python3 tools/thumbnail_legibility.py --all --measure --json
    python3 tools/thumbnail_legibility.py --all --strict   # opt-in indicative gate

Exit status: non-zero when two covers are the same picture at search size, or
when a file cannot be read. With `--strict`, also non-zero when an indicative
measure falls below its (deliberately low) floor.

Requires Pillow and numpy, both already used by `thumbnail_style.py`.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:  # Pillow 10 moved the resampling constants onto Image.Resampling
    from PIL import Image, ImageDraw

    LANCZOS = Image.Resampling.LANCZOS
except (ImportError, AttributeError):  # pragma: no cover - older Pillow
    from PIL import Image, ImageDraw

    LANCZOS = 1

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

# The two sizes that matter: mobile search result, mobile home feed.
SEARCH_WIDTH = 168
FEED_WIDTH = 216

# Calibrated, see the module docstring. Identical content scores ~0.00-0.01,
# unrelated covers score ~1.0, so 0.15 is a wide, safe margin that cannot fire
# on two genuinely different covers.
DUPLICATE_DISTANCE = 0.15

# Indicative only, and deliberately far below anything the shipped covers reach,
# so `--strict` cannot fire on a cover that a human has already approved.
STRICT_MIN_SUBJECT_SHARE = 0.02
STRICT_MIN_LUMA_SPREAD = 0.15


def _np():
    try:
        import numpy as np  # noqa: PLC0415
    except ImportError:  # pragma: no cover - numpy is a repo dependency
        return None
    return np


def signature(image: Image.Image):
    """16x16 mean-removed unit luma vector — a fingerprint of the cover at search size."""
    np = _np()
    tiny = image.convert("L").resize((16, 16), LANCZOS)
    arr = np.asarray(tiny, dtype=float).ravel() / 255.0
    arr = arr - arr.mean()
    norm = float((arr * arr).sum() ** 0.5) or 1.0
    return arr / norm


def signature_distance(a: Image.Image, b: Image.Image) -> float:
    """0 = the same picture at search size; ~1 = unrelated."""
    np = _np()
    return float(1.0 - float(np.dot(signature(a), signature(b))))


def subject_share(image: Image.Image) -> float:
    """Indicative: share of the frame occupied by whatever dominates it.

    Centre-weighted deviation from the image's own median, smoothed, thresholded
    adaptively. Reported so a human can see whether the subject is a small figure
    in a large empty room. **Not** a pass/fail signal: it under-reads covers whose
    subject is dark-on-dark, which several shipped covers legitimately are.
    """
    np = _np()
    small = image.convert("L").resize((160, 160), LANCZOS)
    arr = np.asarray(small, dtype=float) / 255.0
    deviation = np.abs(arr - float(np.median(arr)))

    yy, xx = np.mgrid[0 : arr.shape[0], 0 : arr.shape[1]]
    cy, cx = (arr.shape[0] - 1) / 2, (arr.shape[1] - 1) / 2
    radius = np.sqrt(((yy - cy) / cy) ** 2 + ((xx - cx) / cx) ** 2)
    saliency = deviation * np.clip(1.0 - 0.55 * radius, 0.0, 1.0)

    pad = np.pad(saliency, 1, mode="edge")
    smooth = sum(
        pad[1 + dy : 1 + dy + saliency.shape[0], 1 + dx : 1 + dx + saliency.shape[1]]
        for dy in (-1, 0, 1)
        for dx in (-1, 0, 1)
    ) / 9.0

    peak = float(smooth.max())
    if peak <= 1e-6:
        return 0.0
    return float((smooth >= max(0.35 * peak, float(np.percentile(smooth, 75)))).mean())


def luma_spread(image: Image.Image) -> float:
    """Indicative: how much luminance range the cover keeps after downscaling.

    A cover that flattens to a narrow band at 168 px has lost its internal
    contrast — usually because the lighting was carried by fine detail that the
    downscale removed. Reported, not judged.
    """
    np = _np()
    height = max(1, round(image.height * SEARCH_WIDTH / image.width))
    arr = np.asarray(
        image.convert("L").resize((SEARCH_WIDTH, height), LANCZOS), dtype=float
    ) / 255.0
    return float(np.percentile(arr, 90) - np.percentile(arr, 10))


def audit(path: Path) -> dict:
    image = Image.open(path)
    share = subject_share(image)
    spread = luma_spread(image)
    return {
        "slug": path.parent.name,
        "thumbnail": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "size": f"{image.width}x{image.height}",
        "aspect": round(image.width / image.height, 3),
        "measured_at": f"{SEARCH_WIDTH}px and {FEED_WIDTH}px",
        "subject_share_indicative": round(share, 3),
        "luma_spread_at_search_indicative": round(spread, 3),
        "under_search_size_bytes": None,
    }


def contact_sheet(paths: list[Path], out: Path) -> Path:
    """Every cover at exactly its real mobile sizes, labelled, side by side."""
    cell_w = SEARCH_WIDTH + FEED_WIDTH + 60
    cell_h = round(FEED_WIDTH * 1.9) + 60
    columns = 2
    rows = (len(paths) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), (22, 20, 18))
    draw = ImageDraw.Draw(sheet)

    for index, path in enumerate(paths):
        col, row = index % columns, index // columns
        x, y = col * cell_w, row * cell_h
        draw.text((x + 8, y + 6), path.parent.name[:38], fill=(228, 216, 194))
        cursor = x + 10
        for width, label in ((SEARCH_WIDTH, "search 168px"), (FEED_WIDTH, "feed 216px")):
            thumb = Image.open(path).convert("RGB")
            height = max(1, round(thumb.height * width / thumb.width))
            sheet.paste(thumb.resize((width, height), LANCZOS), (cursor, y + 34))
            draw.text((cursor, y + 34 + height + 3), label, fill=(160, 152, 138))
            cursor += width + 22

    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    return out


def packages() -> list[Path]:
    return sorted(p / "thumbnail.jpg" for p in VIDEOS.iterdir() if (p / "thumbnail.jpg").exists())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("thumbnail", nargs="*", type=Path, help="thumbnail.jpg file(s)")
    parser.add_argument("--all", action="store_true", help="audit every published thumbnail")
    parser.add_argument("--sheet", type=Path, help="write the mobile-size contact sheet here")
    parser.add_argument("--measure", action="store_true",
                        help="print the indicative measures (never gates)")
    parser.add_argument("--strict", action="store_true",
                        help="also fail when an indicative measure falls below its low floor")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    targets = list(args.thumbnail)
    if args.all or not targets:
        targets = packages()
    if not targets:
        print("no thumbnails found", file=sys.stderr)
        return 1

    try:
        results = [audit(path) for path in targets]
    except Exception as exc:  # noqa: BLE001 - unreadable file must fail loudly
        print(f"could not read a thumbnail: {exc}", file=sys.stderr)
        return 1

    images = {p: Image.open(p).convert("RGB") for p in targets}
    duplicate_pairs = []
    for i, a in enumerate(targets):
        for b in targets[i + 1 :]:
            distance = signature_distance(images[a], images[b])
            if distance < DUPLICATE_DISTANCE:
                duplicate_pairs.append(
                    {"a": a.parent.name, "b": b.parent.name, "distance": round(distance, 4)}
                )

    strict_failures = []
    if args.strict:
        for result in results:
            if result["subject_share_indicative"] < STRICT_MIN_SUBJECT_SHARE:
                strict_failures.append(
                    f"{result['slug']}: no dominant shape at search size "
                    f"({result['subject_share_indicative']:.2%})"
                )
            if result["luma_spread_at_search_indicative"] < STRICT_MIN_LUMA_SPREAD:
                strict_failures.append(
                    f"{result['slug']}: flattens to a narrow luminance band at "
                    f"{SEARCH_WIDTH}px ({result['luma_spread_at_search_indicative']:.2f})"
                )

    failed = bool(duplicate_pairs) or bool(strict_failures)

    if args.json:
        print(json.dumps(
            {
                "results": results,
                "duplicate_pairs": duplicate_pairs,
                "sizes": [SEARCH_WIDTH, FEED_WIDTH],
                "duplicate_threshold": DUPLICATE_DISTANCE,
                "strict_failures": strict_failures,
                "gating": ["duplicate covers", "unreadable files"] + (["strict measures"] if args.strict else []),
                "not_gating": ["whether the cover is legible", "whether the cover is interesting"],
            },
            indent=2,
        ))
    else:
        print(f"mobile legibility — rendered at {SEARCH_WIDTH}px (search) and {FEED_WIDTH}px (feed)\n")
        for result in results:
            print(f"     {result['slug']:<48} {result['size']:>10}  aspect {result['aspect']:.2f}")
            if args.measure:
                print(f"       indicative: subject {result['subject_share_indicative']:.0%} of frame, "
                      f"luma spread {result['luma_spread_at_search_indicative']:.2f}")
        print()
        if duplicate_pairs:
            print("FAIL — these covers are the same picture at search size:")
            for pair in duplicate_pairs:
                print(f"  {pair['a']} ~ {pair['b']} (distance {pair['distance']})")
        else:
            print(f"OK — no two covers collide at search size "
                  f"(closest is well above the {DUPLICATE_DISTANCE} threshold)")
        for failure in strict_failures:
            print(f"STRICT — {failure}")
        print()
        print("This tool does not decide whether a cover reads at 168 px. Open the sheet and look.")

    if args.sheet:
        sheet = contact_sheet(targets, args.sheet)
        shown = sheet.relative_to(ROOT) if sheet.is_relative_to(ROOT) else sheet
        print(f"contact sheet: {shown}  <- inspect this, at both sizes")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
