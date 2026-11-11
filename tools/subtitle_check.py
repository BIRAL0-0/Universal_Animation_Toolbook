#!/usr/bin/env python3
"""Verify the burned-in subtitles really follow the voices (not a fixed 3-second cadence).

Three independent checks against the compiled episode + the voice manifest of a finished render:

  1. every subtitle word's [tStart, tEnd] lies inside a measured speech interval (from the TTS),
  2. every spoken line of the script appears in the subtitle stream exactly once, in order,
  3. subtitle cue occupancy covers >= 70 % of measured speech time and does not overlap itself.

    python3 tools/subtitle_check.py [work_dir]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "universal_toolbook"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Verify subtitle timing against the real speech track.",
        epilog=(
            "work_dir must contain episode_retimed.json and vo_manifest.json from a previous "
            "render. It is a work directory, not an episode path — there is no default that "
            "exists on a fresh clone."
        ),
    )
    parser.add_argument(
        "work_dir", nargs="?", default=None,
        help="render work dir holding episode_retimed.json + vo_manifest.json",
    )
    args = parser.parse_args(argv)

    work_dir = Path(args.work_dir).resolve() if args.work_dir else (
        ROOT / "runtime/renders/.work_final_film_1080p").resolve()
    retimed = work_dir / "episode_retimed.json"
    if not retimed.exists():
        parser.error(
            f"{work_dir} has no episode_retimed.json — pass the work dir from a completed "
            f"render, e.g. runtime/work/preview/.work_<slug>_draft"
        )
    manifest = json.loads((work_dir / "vo_manifest.json").read_text())

    js = (
        "const fs=require('fs');"
        "const {compileEpisode}=require('./engine/episode');"
        "const spec=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));"
        "console.log(JSON.stringify(compileEpisode(spec,{width:1920,height:1080,subtitlesMode:'cinema'})));"
    )
    comp = json.loads(subprocess.check_output(["node", "-e", js, str(retimed)], cwd=str(STUDIO), text=True))
    # Subtitles live per scene and are scene-relative; flatten them onto the master timeline.
    subs: list[dict] = []
    for sc in comp["scenes"]:
        base = float(sc.get("startSec", 0.0))
        for sub in sc.get("subtitles") or []:
            subs.append(
                {
                    "start": base + float(sub["start"]),
                    "end": base + float(sub["end"]),
                    "tokens": [
                        {**t, "tStart": base + float(t["tStart"]), "tEnd": base + float(t["tEnd"])}
                        if t.get("tStart") is not None
                        else t
                        for t in sub.get("tokens", [])
                    ],
                }
            )
    subs.sort(key=lambda s: s["start"])

    speech = []
    for seg in manifest["segments"]:
        for a, b in seg.get("speech_intervals") or []:
            speech.append((float(a), float(b)))
    speech.sort()

    def inside_speech(t0: float, t1: float, pad: float = 0.08) -> bool:
        return any(t0 >= a - pad and t1 <= b + pad for a, b in speech)

    # Speaker badges ("ANYA:", "MARA:") are UI, not speech: exclude them from both checks.
    tokens = [
        t
        for sub in subs
        for t in sub.get("tokens", [])
        if t.get("tStart") is not None and not t.get("isSpeakerLabel")
    ]
    outside = [
        {
            "raw": t["raw"],
            "tStart": round(float(t["tStart"]), 2),
            "tEnd": round(float(t["tEnd"]), 2),
        }
        for t in tokens
        if not inside_speech(float(t["tStart"]), float(t["tEnd"]))
    ]

    # 2. line coverage / order
    spoken = [
        d["text"].strip()
        for sc in json.loads(retimed.read_text())["scenes"]
        for d in (sc.get("dialogue") or [])
        if d.get("text", "").strip()
    ]
    sub_text = " ".join(
        " ".join(t["raw"] for t in s.get("tokens", []) if not t.get("isSpeakerLabel")) for s in subs
    )
    norm = lambda s: [w for w in "".join(c.lower() if (c.isalnum() or c == "'") else " " for c in s).split()]
    sub_words, spoken_words = norm(sub_text), norm(" ".join(spoken))
    in_order = sub_words == spoken_words

    # 3. coverage / overlap
    covered = sum(float(s["end"]) - float(s["start"]) for s in subs)
    speech_total = sum(b - a for a, b in speech)
    overlaps = sum(
        1 for i in range(1, len(subs)) if float(subs[i]["start"]) < float(subs[i - 1]["end"]) - 1e-6
    )

    out = {
        "subtitle_cues": len(subs),
        "timed_words": len(tokens),
        "words_outside_measured_speech": len(outside),
        "first_offenders": outside[:6],
        "words_in_subtitles": len(sub_words),
        "words_in_script": len(spoken_words),
        "script_words_in_order": in_order,
        "subtitle_time_sec": round(covered, 2),
        "measured_speech_sec": round(speech_total, 2),
        "coverage_percent": round(100.0 * covered / speech_total, 1) if speech_total else None,
        "overlapping_cues": overlaps,
    }
    ok = not outside and in_order and overlaps == 0 and (out["coverage_percent"] or 0) >= 70.0
    out["verdict"] = "PASS" if ok else "FAIL"
    print(json.dumps(out, indent=2))
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
