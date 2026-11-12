#!/usr/bin/env python3
"""Score the search-facing metadata of every published video.

"Good SEO" is not a vibe, so this tool implements the rubric the repo publishes
([`docs/production/YOUTUBE_PUBLISHING.md`](../docs/production/YOUTUBE_PUBLISHING.md) §13.1)
and gives each package a 0–100 score with the specific reasons it lost points.

    python3 tools/seo_audit.py            # score every package
    python3 tools/seo_audit.py --verbose  # with per-video breakdown
    python3 tools/seo_audit.py --min 85   # fail under a stricter bar

The rubric, and what each block is actually testing:

    title       30  length, keyword placement, curiosity, no shouting
    description 30  hook inside the first 125 characters, body length, keyword
                    reuse, hashtags, an explicit call to action
    tags        20  count, total length, long-tail coverage, primary keyword
    pinned      10  does it earn a reply (a question, a concrete detail)
    slug        10  is the URL itself searchable

A video cannot reach 80 without a real primary keyword, so every record must
declare `primary_keyword` — the one phrase a viewer would actually type.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_THRESHOLD = 78

TITLE_MIN, TITLE_MAX = 40, 70
DESC_MIN, DESC_MAX = 900, 3200
HOOK_WINDOW = 125
TAG_MIN, TAG_MAX = 8, 15
TAG_BUDGET = 480  # YouTube's hard limit is 500 characters for the whole tag field


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _keyword_hits(text: str, keyword: str) -> int:
    if not keyword:
        return 0
    return len(re.findall(re.escape(keyword.lower()), text.lower()))


def score_title(record: dict) -> tuple[int, list[str]]:
    title = record.get("title", "")
    keyword = record.get("primary_keyword", "")
    notes = []
    points = 0

    if TITLE_MIN <= len(title) <= TITLE_MAX:
        points += 12
    else:
        notes.append(f"title is {len(title)} chars, outside {TITLE_MIN}–{TITLE_MAX}")

    if keyword and keyword.lower() in title.lower()[:40]:
        points += 8
    elif keyword and keyword.lower() in title.lower():
        points += 5
        notes.append("primary keyword appears late in the title — YouTube truncates around 40 chars in results")
    else:
        notes.append(f"title does not contain the primary keyword '{keyword}'")

    # curiosity without shouting: a question mark, a number, or a concrete noun phrase
    if "?" in title or re.search(r"\d", title):
        points += 5
    elif record.get("key_angle"):
        points += 3
        notes.append("title has no question or number — lower CTR signal, though a concrete angle can carry it")

    shouted = [word for word in title.split() if len(word) > 3 and word.isupper()]
    if not shouted:
        points += 5
    else:
        notes.append(f"all-caps words look like shouting: {', '.join(shouted)}")

    return points, notes


def score_description(record: dict) -> tuple[int, list[str]]:
    description = record.get("youtube_description", "")
    keyword = record.get("primary_keyword", "")
    notes = []
    points = 0

    hook = description[:HOOK_WINDOW]
    if keyword and keyword.lower() in hook.lower():
        points += 10
    elif hook.strip():
        points += 4
        notes.append(f"primary keyword '{keyword}' is missing from the first {HOOK_WINDOW} visible characters")
    else:
        notes.append("description has no opening hook")

    if DESC_MIN <= len(description) <= DESC_MAX:
        points += 6
    else:
        notes.append(f"description is {len(description)} chars, outside the helpful {DESC_MIN}–{DESC_MAX}")

    hits = _keyword_hits(description, keyword)
    if 2 <= hits <= 8:
        points += 5
    elif hits > 8:
        notes.append(f"primary keyword repeated {hits} times — reads as stuffing")
    else:
        notes.append(f"primary keyword appears {hits} time(s); aim for 2–4 natural mentions")

    hashtags = re.findall(r"#\w+", description)
    if 3 <= len(hashtags) <= 5:
        points += 5
    else:
        notes.append(f"{len(hashtags)} hashtags — 3 to 5 is the sweet spot (more dilutes them)")

    if re.search(r"\b(subscribe|watch next|playlist|full (video|film))\b", description, re.I):
        points += 4
    else:
        notes.append("description has no call to action")

    return points, notes


def score_tags(record: dict) -> tuple[int, list[str]]:
    tags = record.get("tags", [])
    keyword = record.get("primary_keyword", "")
    notes = []
    points = 0

    if TAG_MIN <= len(tags) <= TAG_MAX:
        points += 8
    else:
        notes.append(f"{len(tags)} tags, outside {TAG_MIN}–{TAG_MAX}")

    joined = ",".join(tags)
    if len(joined) <= TAG_BUDGET:
        points += 5
    else:
        notes.append(f"tag field is {len(joined)} chars — over the {TAG_BUDGET} budget, so tail tags get dropped")

    long_tail = [tag for tag in tags if len(tag.split("-")) >= 3 or len(tag.split()) >= 3]
    if len(long_tail) >= 2:
        points += 4
    else:
        notes.append("fewer than 2 long-tail tags — short single words are unwinnable alone")

    if keyword and any(keyword.lower().replace(" ", "-") in tag.lower() or keyword.lower() in tag.lower()
                       for tag in tags):
        points += 3
    else:
        notes.append(f"no tag carries the primary keyword '{keyword}'")

    return points, notes


def score_pinned(record: dict) -> tuple[int, list[str]]:
    comment = record.get("pinned_comment", "")
    notes = []
    points = 0

    if len(comment) >= 180:
        points += 4
    else:
        notes.append("pinned comment is thin — it should model the discussion you want")

    if "?" in comment:
        points += 3
    else:
        notes.append("pinned comment asks nothing — no reason to reply")

    if re.search(r"\b(this|the) (detail|moment|frame|line|moment|shot)|0?[0-9]+[:：]|dashed|specific", comment, re.I):
        points += 3
    else:
        notes.append("pinned comment does not point at a specific detail in the film")

    return points, notes


def score_slug(record: dict) -> tuple[int, list[str]]:
    slug = record.get("slug", "")
    keyword = record.get("primary_keyword", "")
    notes = []
    points = 0

    parts = slug.split("-")
    if len(parts) >= 3:
        points += 5
    else:
        notes.append("slug is too short to carry search terms")

    stem = slug.replace("-", " ")
    if keyword and all(word in stem for word in keyword.lower().split()):
        points += 5
    else:
        notes.append(f"slug does not contain every word of '{keyword}'")

    return points, notes


BLOCKS = (
    ("title", 30, score_title),
    ("description", 30, score_description),
    ("tags", 20, score_tags),
    ("pinned", 10, score_pinned),
    ("slug", 10, score_slug),
)


def audit(record: dict) -> dict:
    total = 0
    breakdown = {}
    notes = []
    for name, maximum, fn in BLOCKS:
        points, block_notes = fn(record)
        points = min(points, maximum)
        total += points
        breakdown[name] = {"score": points, "max": maximum}
        notes.extend(f"[{name}] {note}" for note in block_notes)

    if not record.get("primary_keyword"):
        total = min(total, 40)
        notes.append("[record] no primary_keyword declared — assign the phrase a viewer would type")

    return {"score": total, "breakdown": breakdown, "notes": notes}


def load_packages() -> list[Path]:
    return sorted(p for p in (ROOT / "videos").iterdir()
                  if p.is_dir() and (p / "record.json").exists())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--min", type=int, default=DEFAULT_THRESHOLD,
                        help=f"minimum acceptable score (default {DEFAULT_THRESHOLD})")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    results = []
    for package in load_packages():
        record = json.loads((package / "record.json").read_text())
        result = audit(record)
        result["slug"] = record.get("slug", package.name)
        results.append(result)

    if args.json:
        print(json.dumps(results, indent=2))
        return 0

    failing = []
    width = max((len(r["slug"]) for r in results), default=10)
    print(f"{'video':<{width}}  score  "
          + "  ".join(f"{name[:4]:>4}" for name, _, _ in BLOCKS))
    for result in results:
        block_scores = "  ".join(f"{result['breakdown'][name]['score']:>4}" for name, _, _ in BLOCKS)
        print(f"{result['slug']:<{width}}  {result['score']:>5}  {block_scores}")
        if result["score"] < args.min:
            failing.append(result)
        if args.verbose:
            for note in result["notes"]:
                print(f"    - {note}")

    if failing:
        print(f"\nFAIL — {len(failing)} of {len(results)} packages score below {args.min}")
        if not args.verbose:
            for result in failing:
                print(f"  {result['slug']} ({result['score']})")
                for note in result["notes"]:
                    print(f"    - {note}")
        return 1

    average = sum(r["score"] for r in results) / len(results)
    print(f"\nPASS — all {len(results)} packages score >= {args.min} "
          f"(average {average:.1f}/100)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
