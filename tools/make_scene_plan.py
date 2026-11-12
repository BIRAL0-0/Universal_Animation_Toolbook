#!/usr/bin/env python3
"""Derive a project's machine-readable SCENE_PLAN.json from its episode.json.

The episode spec is the single source of truth for what is on screen; SCENE_PLAN.json is the
structured, human-and-agent-readable projection of it required by the per-video archive
(see templates/MASTER_VIDEO_PRODUCTION_PROMPT.md §11). Deriving it means the two can never
drift: re-run this after any episode edit.

Usage::

    .venv/bin/python tools/make_scene_plan.py projects/<slug>

Prose fields that the JSON cannot express (scene objective, transition rationale, mute-legibility
notes) live in STORYBOARD.md; this file deliberately does not duplicate them.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def plan_from_spec(spec: dict) -> dict:
    planned_dur = sum(float(sc.get("duration") or 8.0) for sc in spec.get("scenes", []))
    explicit_fmt = spec.get("video_format_override") or spec.get("explicit_format")
    auto_fmt = "9:16" if planned_dur < 60.0 else "16:9"
    chosen_fmt = explicit_fmt if explicit_fmt in ("9:16", "16:9") else auto_fmt
    selected_format = spec.get("selected_video_format") or {
        "format": chosen_fmt,
        "master_resolution": [1080, 1920] if chosen_fmt == "9:16" else [1920, 1080],
        "planned_duration_sec": round(planned_dur, 3),
        "auto_recommended_format": auto_fmt,
        "overridden": bool(explicit_fmt and explicit_fmt in ("9:16", "16:9") and explicit_fmt != auto_fmt),
    }
    out = {
        "title": spec.get("title"),
        "thesis": spec.get("thesis"),
        "style": spec.get("style"),
        "selected_video_format": selected_format,
        "bgm_mode": spec.get("bgm"),
        "voices": spec.get("voices", {}),
        "cast": {cid: {k: v for k, v in prof.items()} for cid, prof in spec.get("cast", {}).items()},
        "scenes": [],
    }
    for sc in spec.get("scenes", []):
        scene = {
            "id": sc.get("id"),
            "chapter": sc.get("chapter"),
            "environment": sc.get("environment"),
            "mood": sc.get("mood"),
            "bgm_track": sc.get("bgm"),
            "bgm_gain": sc.get("bgm_gain"),
            "accent_color": sc.get("accent_color"),
            "planned_duration_sec": sc.get("duration"),
            "portrait_focus": sc.get("portrait_focus"),
            "portrait_focus_x": sc.get("portrait_focus_x"),
            "characters": [
                {
                    "id": ch.get("id"),
                    "show_name": ch.get("show_name"),
                    "beats": [
                        {
                            "start": b.get("start"),
                            "end": b.get("end"),
                            "action": b.get("action"),
                            "x": b.get("x", b.get("from_x")),
                            "to_x": b.get("to_x"),
                            "facing": b.get("facing"),
                            "expression": b.get("expression"),
                            "seated": b.get("seated", False),
                        }
                        for b in ch.get("beats", [])
                    ],
                }
                for ch in sc.get("characters", [])
            ],
            "props": sc.get("props", []),
            "camera_shots": sc.get("camera_shots", []),
            "boards": [
                {
                    "type": b.get("type"),
                    "cue_on": b.get("cue_on"),
                    "hold_sec": b.get("hold_sec"),
                    "payload": {k: v for k, v in b.items()
                                if k in ("cards", "bars", "nodes", "items", "incoming",
                                         "sender", "reply", "call_declined", "lines")},
                    "portrait": {"w": b.get("portrait_w"), "x": b.get("portrait_x")},
                }
                for b in sc.get("boards", [])
            ],
            "narration": [
                {"speaker": d.get("speaker"), "text": d.get("text"),
                 "pause_after": d.get("pause_after")}
                for d in sc.get("dialogue", [])
            ],
            "accent_words": sc.get("accent_words", []),
        }
        out["scenes"].append(scene)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    args = ap.parse_args()
    proj = Path(args.project)
    if not proj.is_absolute():
        proj = Path.cwd() / proj
    spec_path = proj / "episode.json"
    if not spec_path.exists():
        print(f"ERROR: {spec_path} not found", file=sys.stderr)
        return 2
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    plan = plan_from_spec(spec)
    dest = proj / "SCENE_PLAN.json"
    dest.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {dest} — {len(plan['scenes'])} scenes, "
          f"{sum(len(s['narration']) for s in plan['scenes'])} narration lines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
