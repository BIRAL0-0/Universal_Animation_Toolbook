#!/usr/bin/env python3
"""Build a self-contained, animated SVG storyboard from a rendered master.

Why: an SVG is *text*. When a workspace/file viewer refuses binaries (mp4/gif), a
single .svg carrying base64 stills + SMIL cross-fades still shows the film — no media
transfer, no plugin, no player.

Usage:
    python3 tools/build_storyboard_svg.py runtime/renders/final_film_1080p.mp4 \
        --out runtime/work/deliverables/film_storyboard.svg

Options:
    --stills  comma separated timestamps (seconds) or a .json scene spec
    --seconds seconds per slide (default 4)
    --width   frame width in px (default 1280)
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import tempfile

DEFAULT_CAPTIONS = [
    ("Kessa Chasm | Twelve Weeks", "The chasm at Kessa was eight hundred metres of nothing."),
    ("The Shortcut | Two Inches", "Two inches off every joint. Nobody would measure."),
    ("Ahead of Schedule | Too Fast", "Five weeks early, it met the far side."),
    ("Inspection | Check It Again", "The callipers answered before she did."),
    ("June | The Deck Sings", "In June, the river came up four metres."),
    ("The Rule | Margin", "Safe is surviving a bad day."),
    ("Rebuild | Margin Restored", "They rebuilt every joint with three inches of margin."),
    ("August | The Crossing", "Leave room to be wrong, and it will hold."),
]


def ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def grab(mp4: str, t: float, width: int, out: str) -> None:
    cmd = [
        ffmpeg_exe(), "-v", "error", "-ss", f"{t}", "-i", mp4,
        "-frames:v", "1", "-vf", f"scale={width}:-1", "-q:v", "5", "-y", out,
    ]
    subprocess.run(cmd, check=True)


def captions_from_spec(path: str):
    spec = json.load(open(path))
    caps = []
    for sc in spec.get("scenes", []):
        line = ""
        for d in sc.get("dialogue", []):
            if len(d.get("text", "")) > 22:
                line = d["text"]
                break
        if not line and sc.get("dialogue"):
            line = sc["dialogue"][0].get("text", "")
        caps.append((sc.get("chapter", sc.get("id", "")), line))
    return caps


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("master")
    ap.add_argument("--out", default="runtime/work/deliverables/film_storyboard.svg")
    ap.add_argument("--stills", default="", help="comma separated seconds")
    ap.add_argument("--spec", default="", help="episode json; timestamps from scene starts")
    ap.add_argument("--seconds", type=float, default=4.0)
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    args = ap.parse_args()

    if not os.path.isfile(args.master):
        print(f"missing master: {args.master}", file=sys.stderr)
        return 2

    captions = list(DEFAULT_CAPTIONS)
    if args.spec and os.path.isfile(args.spec):
        captions = captions_from_spec(args.spec)

    if args.stills:
        times = [float(x) for x in args.stills.split(",") if x.strip()]
    elif args.spec and os.path.isfile(args.spec):
        spec = json.load(open(args.spec))
        acc, times = 0.0, []
        for sc in spec.get("scenes", []):
            times.append(acc + min(3.0, (sc.get("duration") or 10) * 0.25))
            acc += float(sc.get("duration") or 10)
    else:
        span = 103.0 / max(1, len(captions))
        times = [span * i + 3 for i in range(len(captions))]

    captions = (captions + DEFAULT_CAPTIONS)[: len(times)]
    W, H = args.width, args.height
    total = args.seconds * len(times)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="storyboard_")

    chunks = [
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n'
        f'     width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'font-family="Helvetica, Arial, sans-serif">\n'
        f'  <title>Storyboard</title>\n'
        f'  <rect width="{W}" height="{H}" fill="#04070d"/>\n'
    ]

    fade = 0.5  # seconds of cross-fade at each edge
    for i, t in enumerate(times):
        jpg = os.path.join(tmp, f"f{i}.jpg")
        grab(args.master, t, W, jpg)
        b64 = base64.b64encode(open(jpg, "rb").read()).decode()
        chapter, line = captions[i]
        chapter = re.sub(r"[<&]", "", chapter)
        line = re.sub(r"[<&]", "", line)
        k0 = round(fade / total, 5)
        k1 = round((args.seconds - fade) / total, 5)
        k2 = round(args.seconds / total, 5)
        chunks.append(
            f'  <g opacity="0">\n'
            f'    <animate attributeName="opacity" values="0;1;1;0;0"\n'
            f'             keyTimes="0;{k0};{k1};{k2};1" dur="{total:g}s"\n'
            f'             begin="{i * args.seconds:g}s" repeatCount="indefinite"/>\n'
            f'    <image x="0" y="0" width="{W}" height="{H}" '
            f'preserveAspectRatio="xMidYMid slice"\n'
            f'           xlink:href="data:image/jpeg;base64,{b64}"/>\n'
            f'    <rect x="0" y="{H - 118}" width="{W}" height="118" '
            f'fill="#04070d" opacity="0.72"/>\n'
            f'    <text x="44" y="{H - 74}" fill="#f8fafc" font-size="30" '
            f'font-weight="700" letter-spacing="1">{chapter}</text>\n'
            f'    <text x="44" y="{H - 34}" fill="#94a3b8" font-size="24">{line}</text>\n'
            f'    <text x="{W - 52}" y="56" fill="#475569" font-size="22" '
            f'text-anchor="end" letter-spacing="2">{i + 1:02d} / {len(times):02d}</text>\n'
            f'  </g>\n'
        )

    chunks.append("</svg>\n")
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("".join(chunks))

    size = os.path.getsize(args.out)
    print(f"wrote {args.out} ({size / 1024:.0f} KB, {len(times)} slides, {total:g}s loop)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
