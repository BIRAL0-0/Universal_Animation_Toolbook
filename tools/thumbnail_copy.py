#!/usr/bin/env python3
"""Check that a thumbnail's overlay text COMPLEMENTS its title instead of repeating it.

The rule this enforces is not a style preference. The thumbnail and the title sit
side by side on every YouTube surface — search results, the homepage feed, the
suggested sidebar. If both say the same thing, one of the two most valuable pieces
of real estate on the platform is doing nothing.

The evidence, from a study of 16,152 million-view videos (`overseeros.com`,
Aug 2026): among 217 thumbnails with classifiable text, only 4.1% reproduced the
title exactly and 25.3% mostly repeated it, while 46.1% used completely
complementary wording and 74.7% did not mostly repeat the title. Word count
matters as much: 1-2 words measured +10-20% CTR, 3-4 words +5-15%, 5-7 words
-5-10%, and 8+ words -20-30%.

So the rule is:

    record.json must carry "thumbnail_text": 1-3 words, at least one of which
    does not appear in the title.

    python3 tools/thumbnail_copy.py            # audit every package
    python3 tools/thumbnail_copy.py --verbose  # explain each verdict

Exit status is non-zero when any package fails, so this can gate a release.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

MAX_WORDS = 3
# A hook may share *some* wording with the title (28.6% of the sample did) but it
# must carry something new. Above this share it is a restatement, not a hook.
MAX_OVERLAP = 0.5

STOPWORDS = {
    "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are",
    "was", "were", "it", "its", "you", "your", "my", "we", "us", "that", "this",
    "at", "by", "with", "vs", "why", "what", "how", "when", "as", "be",
}


def _stem(word: str) -> str:
    """Crude plural stripping, enough to see "inches" == "inch" and "seconds" == "second".

    Without this, "2 INCHES IS NOTHING" only shared the digit "2" with its title and
    slipped through as complementary — even though it is a straight restatement.
    """
    if len(word) > 4 and word.endswith("es") and word[-3] in "chshxz":
        return word[:-2]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def content_words(text: str) -> list[str]:
    """Lower-case word tokens, keeping numbers, dropping punctuation and stopwords."""
    words = re.findall(r"[a-z0-9']+", text.lower().replace("-", " "))
    return [w for w in words if w not in STOPWORDS]


def audit(record: dict) -> dict:
    """Score one record's thumbnail copy against its title."""
    title = record.get("title", "")
    hook = (record.get("thumbnail_text") or "").strip()
    notes: list[str] = []

    if not hook:
        return {
            "ok": False,
            "hook": "",
            "words": 0,
            "overlap": 1.0,
            "notes": ["no thumbnail_text declared — the cover cannot be typeset from the record"],
        }

    hook_words = content_words(hook)
    title_words = content_words(title)

    if len(hook_words) > MAX_WORDS:
        notes.append(
            f"{len(hook_words)} content words; anything past {MAX_WORDS} is unreadable at phone size"
        )

    title_stems = {_stem(w) for w in title_words}
    shared = [w for w in hook_words if _stem(w) in title_stems]
    overlap = len(shared) / len(hook_words) if hook_words else 1.0
    new_words = [w for w in hook_words if _stem(w) not in title_stems]

    if overlap >= MAX_OVERLAP:
        notes.append(
            f"{overlap:.0%} of the cover text already appears in the title "
            f"({', '.join(shared)}) — one of the two is wasted"
        )
    if not new_words:
        notes.append("every cover word is already in the title, so the cover adds no information")

    if len(hook_words) <= MAX_WORDS and overlap < MAX_OVERLAP and new_words:
        notes.append("complements the title: adds wording the title does not carry")

    return {
        "ok": len(hook_words) <= MAX_WORDS and overlap < MAX_OVERLAP and bool(new_words),
        "hook": hook,
        "words": len(hook_words),
        "overlap": round(overlap, 2),
        "new_words": new_words,
        "notes": notes,
    }


def packages() -> list[Path]:
    return sorted(p for p in VIDEOS.iterdir() if p.is_dir() and (p / "record.json").exists())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verbose", action="store_true", help="explain every verdict")
    args = parser.parse_args(argv)

    failures = 0
    for package in packages():
        record = json.loads((package / "record.json").read_text())
        result = audit(record)
        mark = "ok  " if result["ok"] else "FAIL"
        if not result["ok"]:
            failures += 1
        print(f"{mark} {package.name}  ->  \"{result['hook']}\"  ({result['words']}w, "
              f"{result['overlap']:.0%} title overlap)")
        if args.verbose or not result["ok"]:
            for note in result["notes"]:
                print(f"       {note}")

    print()
    if failures:
        print(f"FAIL — {failures} package(s) repeat their title or use too many words")
        return 1
    print("PASS — every thumbnail text complements its title in 1-3 words")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
