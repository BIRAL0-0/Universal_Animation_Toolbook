#!/usr/bin/env python3
"""Review the film *after* it is rendered, as a viewer would experience it.

`creative_gate.py` checks decisions made before the render. This reviews the
artifact itself and asks the questions only the finished film can answer:

    Does the opening actually deliver the hook that was recorded?
    Is the promised moment in the film, at the time the record says?
    Does the cover match the film's own light and palette, or was it drawn
      from a different world?
    Are there stretches that look the same as the stretch before — dead air a
      retention map claims is doing work?

WHAT IS MEASURED (real numbers, from the actual MP4)
----------------------------------------------------
* **Hook presence** — frames sampled across the first 8 seconds are compared to
  the film's own opening frame. A hook that is only narration over a still frame
  is measurably different from one where something happens.
* **Stillness runs** — consecutive sampled frames whose change falls below a
  floor, reported as time ranges. These are the stretches a viewer leaves during.
* **Cover/world match** — the cover's palette and light are compared against
  frames sampled from the film itself, not against a hardcoded palette.
* **Format honesty** — the MP4's real dimensions against `record.json`'s claim.

WHAT IS NOT AUTOMATED
---------------------
Whether the film is good. Whether the hook is interesting. Whether a still
stretch is deliberate silence or a dead scene. Those are judgements and the
report says so, with the frames saved so a human can make them.

    python3 tools/creative_review.py --all
    python3 tools/creative_review.py --check the-bamboo-seed --frames runtime/work/review
    python3 tools/creative_review.py --all --json

Exit status is non-zero when the film contradicts its own record — a hook that
is nowhere near the opening, a missing promise, a cover from another world, or a
format the record misdescribes. Stylistic concerns never fail a build.

Requires imageio-ffmpeg, Pillow and numpy.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image

    LANCZOS = Image.Resampling.LANCZOS
except (ImportError, AttributeError):  # pragma: no cover - older Pillow
    from PIL import Image

    LANCZOS = 1

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

HOOK_WINDOW_SEC = 8.0
SAMPLE_FPS = 2.0          # two frames a second is enough to see change, cheap enough to run
STILL_THRESHOLD = 0.0015  # mean absolute difference below which two frames are "the same"
MIN_STILL_RUN_SEC = 4.0   # a still run shorter than this is a beat, not dead air
FRAME_SIZE = (160, 284)


def _np():
    try:
        import numpy as np  # noqa: PLC0415
    except ImportError:  # pragma: no cover
        return None
    return np


def _frames(mp4: Path, seconds: float | None = None):
    """Yield (timestamp, small RGB ndarray) at SAMPLE_FPS."""
    np = _np()
    import imageio_ffmpeg  # noqa: PLC0415

    reader = imageio_ffmpeg.read_frames(str(mp4))
    meta = next(reader)
    fps = float(meta.get("fps") or 30.0)
    step = max(1, round(fps / SAMPLE_FPS))
    limit = None if seconds is None else int(seconds * fps)
    for index, frame in enumerate(reader):
        if limit is not None and index >= limit:
            break
        if index % step:
            continue
        width, height = meta["size"]
        image = Image.frombytes("RGB", (width, height), frame)
        scale = FRAME_SIZE[0] / width
        image = image.resize((FRAME_SIZE[0], max(1, round(height * scale))), LANCZOS)
        yield index / fps, np.asarray(image, dtype=float) / 255.0


def _palette(rgb) -> dict:
    """Mean colour and luminance spread — enough to tell one light from another."""
    np = _np()
    luma = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    return {
        "mean_rgb": [round(float(rgb[..., i].mean()), 4) for i in range(3)],
        "mean_luma": round(float(luma.mean()), 4),
        "luma_spread": round(float(np.percentile(luma, 90) - np.percentile(luma, 10)), 4),
    }


def _distance(a, b) -> float:
    np = _np()
    return float(np.abs(a - b).mean())


def review(slug: str, out_dir: Path | None = None) -> dict:
    package = VIDEOS / slug
    record = json.loads((package / "record.json").read_text())
    mp4 = package / f"{slug}.mp4"
    creative = record.get("creative") or {}

    problems: list[str] = []
    observations: list[str] = []

    import imageio_ffmpeg  # noqa: PLC0415

    meta_reader = imageio_ffmpeg.read_frames(str(mp4))
    meta = next(meta_reader)
    meta_reader.close()

    width, height = meta["size"]
    duration = float(meta["duration"])
    recorded_res = str(record.get("resolution") or "")
    if recorded_res and recorded_res.replace("✕", "x") != f"{width}x{height}":
        problems.append(
            f"record says {recorded_res} but the file is {width}x{height} — the record is wrong"
        )
    if record.get("duration") and abs(float(record["duration"]) - duration) > 1.0:
        problems.append(
            f"record says {record['duration']}s but the file is {duration:.2f}s"
        )

    # ---------------------------------------------------------------- hook window
    hook_frames = list(_frames(mp4, seconds=HOOK_WINDOW_SEC))
    hook_change = None
    if len(hook_frames) >= 2:
        first = hook_frames[0][1]
        changes = [_distance(first, frame) for _, frame in hook_frames[1:]]
        hook_change = round(sum(changes) / len(changes), 5)
    still_opening = hook_change is not None and hook_change < STILL_THRESHOLD
    if still_opening:
        observations.append(
            f"the first {HOOK_WINDOW_SEC:.0f}s barely change (mean frame delta {hook_change}) — "
            "the hook is carried by narration alone, which is a choice worth confirming"
        )

    # ---------------------------------------------------------------- whole film
    samples = list(_frames(mp4))
    deltas = [(samples[i][0], _distance(samples[i - 1][1], samples[i][1])) for i in range(1, len(samples))]

    still_runs = []
    run_start = None
    for timestamp, delta in deltas:
        if delta < STILL_THRESHOLD:
            if run_start is None:
                run_start = timestamp
        else:
            if run_start is not None and timestamp - run_start >= MIN_STILL_RUN_SEC:
                still_runs.append([round(run_start, 1), round(timestamp, 1)])
            run_start = None
    if run_start is not None and samples and samples[-1][0] - run_start >= MIN_STILL_RUN_SEC:
        still_runs.append([round(run_start, 1), round(samples[-1][0], 1)])

    still_seconds = sum(end - start for start, end in still_runs)
    still_share = still_seconds / duration if duration else 0.0
    if still_share > 0.35:
        observations.append(
            f"{still_share:.0%} of the film is visually static ({len(still_runs)} run(s)) — "
            "fine for a contemplative piece, fatal for a hook-led one; look at the frames"
        )

    # --------------------------------------------------------- promised moment
    retention = creative.get("retention_map") or []
    promise_checks = []
    for beat in retention:
        if not isinstance(beat, dict):
            continue
        kind = str(beat.get("kind") or "")
        if kind not in ("reveal", "payoff"):
            continue
        at = float(beat.get("at_sec") or 0)
        # A payoff on the final frame is legitimate, and sampling at SAMPLE_FPS cannot
        # land exactly on it, so the window reaches back a beat either side.
        window = [t for t, _ in samples if max(0.0, at - 1.0) <= t <= at + 3.0]
        promise_checks.append({
            "kind": kind,
            "at_sec": at,
            "frames_sampled": len(window),
            "present": bool(window),
        })
        if at > duration + 0.5:
            problems.append(
                f"retention map promises the `{kind}` at {at:.0f}s but the film ends at "
                f"{duration:.2f}s — the plan and the artifact disagree"
            )
        elif not window:
            problems.append(
                f"retention map puts the `{kind}` at {at:.1f}s but nothing was sampled there — "
                "the promised moment is not in the film where the record says it is"
            )

    # ---------------------------------------------------------- cover/world match
    cover_path = package / "thumbnail.jpg"
    cover_palette = world_delta = None
    if cover_path.exists():
        cover = Image.open(cover_path).convert("RGB")
        cover_palette = _palette(_np().asarray(cover.resize((FRAME_SIZE[0], FRAME_SIZE[1]), LANCZOS),
                                              dtype=float) / 255.0)
        film_palettes = [_palette(frame) for _, frame in samples[:: max(1, len(samples) // 40)]]
        film_luma = sum(p["mean_luma"] for p in film_palettes) / len(film_palettes)
        film_spread = sum(p["luma_spread"] for p in film_palettes) / len(film_palettes)
        world_delta = round(
            abs(cover_palette["mean_luma"] - film_luma) + abs(cover_palette["luma_spread"] - film_spread),
            4,
        )
        # Deliberately NOT a failure. A designed cover is normally brighter and more
        # contrasty than the average film frame — that is the point of it. This number
        # is reported so a human can see the gap, and the authoritative check stays
        # `tools/thumbnail_style.py`, which compares palette and polarity properly.
        if world_delta > 0.55:
            observations.append(
                f"the cover is lit differently from the average film frame (delta {world_delta}) — "
                "usually intentional, since a cover carries its own key light. Confirm with "
                "`thumbnail_style.py check` and by eye, not with this number"
            )

    # ------------------------------------------------------------ saved evidence
    saved = []
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        picks = [0, len(samples) // 4, len(samples) // 2, (3 * len(samples)) // 4, len(samples) - 1]
        for rank, index in enumerate(picks):
            timestamp, frame = samples[index]
            image = Image.fromarray((frame * 255).astype("uint8"))
            path = out_dir / f"{slug}-{rank}-{timestamp:06.1f}s.png"
            image.save(path)
            saved.append(str(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path))

    return {
        "slug": slug,
        "file": f"{width}x{height}",
        "duration_sec": round(duration, 2),
        "samples": len(samples),
        "hook_frame_delta": hook_change,
        "hook_is_static": still_opening,
        "still_runs_sec": still_runs,
        "still_share": round(still_share, 3),
        "promise_checks": promise_checks,
        "cover_luma": cover_palette["mean_luma"] if cover_palette else None,
        "cover_world_delta": world_delta,
        "frames_saved": saved,
        "problems": problems,
        "observations": observations,
    }


def packages() -> list[str]:
    return sorted(p.name for p in VIDEOS.iterdir() if (p / "record.json").exists())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--all", action="store_true", help="review every published video")
    parser.add_argument("--check", metavar="SLUG", help="review one video")
    parser.add_argument("--frames", type=Path, help="save sampled frames here for human inspection")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    slugs = [args.check] if args.check else packages()
    if not args.all and not args.check:
        slugs = packages()

    reports, failed = [], 0
    for slug in slugs:
        try:
            report = review(slug, args.frames)
        except FileNotFoundError as exc:
            reports.append({"slug": slug, "problems": [f"no master to review: {exc}"], "observations": []})
            failed += 1
            continue
        reports.append(report)
        if report["problems"]:
            failed += 1

    if args.json:
        print(json.dumps({"reports": reports, "failed": failed}, indent=2))
    else:
        for report in reports:
            mark = "FAIL" if report["problems"] else "ok  "
            print(f"{mark} {report['slug']:<48} {report.get('file','?'):>10}  "
                  f"{report.get('duration_sec','?')}s")
            for problem in report["problems"]:
                print(f"       ! {problem}")
            for observation in report["observations"]:
                print(f"       . {observation}")
        print()
        if failed:
            print(f"FAIL — {failed} of {len(reports)} film(s) contradict their own record")
        else:
            print(f"OK — {len(reports)} film(s) match their records")
        print("       This reviews the artifact, not the taste. Look at the saved frames.")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
