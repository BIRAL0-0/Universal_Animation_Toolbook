#!/usr/bin/env python3
"""
Universal Script Analyzer & Fidelity Verifier.

Segments any user-provided script into natural narrative beats while preserving
100% of the exact script wording, recommends matching Creative Commons / NCS-style
BGM from `assets/bgm/`, and leaves cast + scene settings open for the AI prompt
to design dynamically from the script's world and requirements.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from engine.bgm_library import load_bgm_catalog, score_script_for_bgm

STOPWORDS = {
    "the", "and", "that", "this", "with", "from", "your", "have", "they", "what",
    "when", "where", "which", "their", "there", "about", "into", "more", "than",
    "them", "then", "were", "been", "will", "would", "could", "should", "because",
    "just", "very", "only", "over", "also", "most", "some", "every", "never",
}


def split_sentences(raw_text: str) -> List[str]:
    cleaned = re.sub(r"\r\n?", "\n", raw_text).strip()
    cleaned = re.sub(r"(?m)^(\s*(?:\[.*?\]|#+\s+.*))\s*$", r"\n\n\1\n\n", cleaned)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", cleaned) if p.strip()]
    sentences: List[str] = []
    for para in paragraphs:
        if re.match(r"^(\[.*\]|#+\s+.*)$", para):
            sentences.append(para)
            continue
        parts = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", para))
        for pt in parts:
            if pt.strip():
                sentences.append(pt.strip())
    return sentences


def pick_accent_words(text: str, limit: int = 3) -> List[str]:
    words = re.findall(r"[A-Za-z0-9%+-]+", text)
    candidates: List[str] = []
    for w in words:
        lw = w.lower()
        if len(lw) >= 5 and lw not in STOPWORDS and lw not in candidates:
            candidates.append(lw)
    return candidates[:limit]


def segment_user_script(
    raw_text: str,
    title: str = "Visual Story Episode",
    target_words_per_scene: int = 34,
) -> Dict[str, Any]:
    items = split_sentences(raw_text)
    scenes: List[Dict[str, Any]] = []
    pending_chapter: str | None = None
    buf: List[str] = []
    buf_words = 0

    def flush_scene() -> None:
        nonlocal buf, buf_words, pending_chapter
        if not buf:
            return
        narration = " ".join(buf).strip()
        w_count = len(narration.split())
        dur = round(max(6.0, w_count / 2.45 + 0.7), 1)
        idx = len(scenes)

        scene_obj: Dict[str, Any] = {
            "id": f"S{idx + 1:02d}",
            "setting": {
                "sky": ["#081224", "#12294a"],
                "floor_color": "#07101d",
                "light_color": "#38bdf8",
                "backdrop": "windows",
                "weather": "clear",
                "lighting": "skylights",
            },
            "duration": dur,
            "narration": narration,
            "accent_words": pick_accent_words(narration),
            "camera": {
                "zoom_from": 1.0,
                "zoom_to": 1.04,
                "pan_from": -0.01 if idx % 2 == 0 else 0.01,
                "pan_to": 0.01 if idx % 2 == 0 else -0.01,
            },
            "props": [],
            "characters": [
                {
                    "id": "role_1",
                    "x": 0.36,
                    "facing": 1,
                    "action": "talk_explain" if idx % 2 == 0 else "listen_nod",
                },
                {
                    "id": "role_2",
                    "x": 0.64,
                    "facing": -1,
                    "action": "listen_nod" if idx % 2 == 0 else "talk_explain",
                },
            ],
        }
        if pending_chapter:
            scene_obj["chapter"] = pending_chapter
            pending_chapter = None
        scenes.append(scene_obj)
        buf = []
        buf_words = 0

    for item in items:
        heading_match = re.match(r"^(?:\[(?:chapter\s*:?\s*)?(.*)\]|#+\s+(.*))$", item, re.I)
        if heading_match:
            flush_scene()
            pending_chapter = (heading_match.group(1) or heading_match.group(2) or "").strip()
            continue

        wc = len(item.split())
        if buf and (buf_words + wc > target_words_per_scene * 1.25):
            flush_scene()
        buf.append(item)
        buf_words += wc
        if buf_words >= target_words_per_scene:
            flush_scene()

    flush_scene()

    catalog = load_bgm_catalog()
    rec_bgm = score_script_for_bgm(raw_text, scenes, catalog) if catalog else {"id": "auto"}

    total_words = sum(len(s["narration"].split()) for s in scenes)
    total_dur = round(sum(s["duration"] for s in scenes), 1)

    return {
        "title": title,
        "thesis": scenes[-1]["narration"] if scenes else title,
        "bgm": rec_bgm.get("id", "auto"),
        "subtitles_mode": "cinema",
        "cast": {
            "role_1": {"name": "CHARACTER 1", "color": "cyan", "build": "standard", "accessories": []},
            "role_2": {"name": "CHARACTER 2", "color": "coral", "build": "standard", "accessories": []},
        },
        "scenes": scenes,
        "outro": {
            "duration": 4.0,
            "title": title,
            "accent_color": "#38bdf8",
        },
        "_script_stats": {
            "word_count": total_words,
            "scene_count": len(scenes),
            "estimated_duration_sec": total_dur,
            "estimated_minutes": round(total_dur / 60.0, 2),
            "recommended_bgm": rec_bgm.get("id", "auto"),
            "note": "Populate `cast` names/colors/builds/accessories and per-scene `setting`/`environment`, `props`, `board`, and `characters` dynamically to match the script.",
        },
    }


def _norm_tokens(text: str) -> List[str]:
    lines = [
        ln for ln in text.splitlines()
        if not re.match(r"^\s*(\[.*\]|#+\s+.*)\s*$", ln)
    ]
    return re.findall(r"[a-z0-9']+", " ".join(lines).lower())


def verify_script_fidelity(script_text: str, episode: Dict[str, Any]) -> Dict[str, Any]:
    src_tokens = _norm_tokens(script_text)
    ep_narration = " ".join(sc.get("narration", "") for sc in episode.get("scenes", []))
    ep_tokens = _norm_tokens(ep_narration)

    src_count = len(src_tokens)
    ep_count = len(ep_tokens)
    exact_match = src_tokens == ep_tokens

    matched = sum(1 for a, b in zip(src_tokens, ep_tokens) if a == b)
    seq_ratio = round(matched / float(max(1, max(src_count, ep_count))), 4)

    return {
        "exact_word_match": exact_match,
        "source_word_count": src_count,
        "episode_word_count": ep_count,
        "sequential_alignment": seq_ratio,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Universal Script Beat Parser & Fidelity Verifier")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="Segment raw script into beat-aligned JSON skeleton")
    p_parse.add_argument("script_file", type=Path, help="Path to plain-text or markdown script")
    p_parse.add_argument("--out", type=Path, required=True, help="Output episode JSON path")
    p_parse.add_argument("--title", default="Visual Story Episode", help="Episode title")
    p_parse.add_argument("--words-per-scene", type=int, default=34, help="Target words per scene beat")

    p_ver = sub.add_parser("verify", help="Verify 100% word-for-word script fidelity")
    p_ver.add_argument("script_file", type=Path)
    p_ver.add_argument("episode_json", type=Path)

    args = parser.parse_args()
    if args.cmd == "parse":
        raw = args.script_file.read_text(encoding="utf-8")
        skeleton = segment_user_script(raw, title=args.title, target_words_per_scene=args.words_per_scene)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(skeleton, indent=2), encoding="utf-8")
        print(json.dumps(skeleton["_script_stats"], indent=2))
        return 0

    if args.cmd == "verify":
        raw = args.script_file.read_text(encoding="utf-8")
        ep = json.loads(args.episode_json.read_text(encoding="utf-8"))
        res = verify_script_fidelity(raw, ep)
        print(json.dumps(res, indent=2))
        return 0 if res["exact_word_match"] else 2

    return 1


if __name__ == "__main__":
    sys.exit(main())
