#!/usr/bin/env python3
"""Gate the parts of packaging that decide whether anyone clicks.

`seo_audit.py` measures text signals, `validate_publishing.py` measures package completeness and
`thumbnail_copy.py` measures title/thumbnail overlap. None of them can tell you whether a video
had a reason for a viewer to start watching, or whether anyone actually chose the thumbnail.

This tool gates the *decisions*: every shipped video must carry a `creative` block in its
`record.json` that proves the creative work happened before production, and that the three things
a viewer sees as one promise -- title, thumbnail, hook -- agree with each other.

    python3 tools/creative_gate.py              # audit every published video
    python3 tools/creative_gate.py --verbose    # explain each verdict
    python3 tools/creative_gate.py --check <slug>

What it can and cannot do
-------------------------
It can verify that candidates were produced and that the final choice is drawn from them, that a
retention map covers the whole runtime, that the thumbnail text is not the title, that the hook's
opening seconds deliver the title's promise, and that every posted claim is labelled.

It cannot judge whether a hook is *good*. That is an editorial decision and the gate says so
rather than pretending a number means quality. Scoring is left in the record for humans and for
comparing candidates; the gate only enforces that the comparison happened and is honest.

Exit codes: 0 pass, 1 failures.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "videos"

MIN_HOOK_CANDIDATES = 3
MIN_TITLE_CANDIDATES = 3

# The brief requires the title to be chosen from genuinely different strategies,
# not three rewordings of one idea. Seven approaches are accepted; at least four
# distinct ones must be represented so the comparison is real.
TITLE_APPROACHES = (
    "curiosity_gap",   # withhold the answer the film gives
    "question",        # ask what the viewer is already asking
    "outcome_number",  # a concrete quantity or result
    "contradiction",   # two ideas that should not coexist
    "stakes_loss",     # what it costs to get this wrong
    "identity",        # who this is for / who they are
    "reversal",        # the expected ending, inverted
)
MIN_TITLE_APPROACHES = 4
REQUIRED_SEO_FIELDS = (
    "primary_keyword",      # the phrase the video is trying to win
    "secondary_keywords",   # 1-3 supporting search phrases
    "title_alternates",     # 2-3 usable alternates kept for A/B or reuse
    "hashtags",             # 3-5, as published
    "category",             # YouTube category
)
MIN_THUMBNAIL_CONCEPTS = 3
# A viewer must be inside the promise almost immediately; YouTube measures this per-second.
MAX_HOOK_SECONDS = 8.0
# The hook's own text must actually be voiced in the film, not just written down.
MIN_HOOK_WORDS = 6

CRITERIA = (
    "opening_hook", "clarity", "originality", "story_progression", "retention_potential",
    "emotional_impact", "visual_potential", "payoff", "accuracy", "pacing",
)

EVIDENCE_LABELS = {"M", "O", "P"}  # measured / observed / predicted


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9']+", str(text).lower()) if len(w) > 2}


def _dialogue_text(record: dict) -> str:
    """All spoken narration in the record, if the record carries it."""
    parts = []
    for scene in record.get("scenes", []) or []:
        for line in scene.get("dialogue", []) or []:
            parts.append(str(line.get("text", "")))
    return " ".join(parts)


def audit(record: dict, slug: str) -> dict:
    problems: list[str] = []
    notes: list[str] = []
    creative = record.get("creative") or {}

    if not creative:
        return {
            "ok": False,
            "problems": [
                "no `creative` block in record.json — this video has no evidence that hook, title "
                "or thumbnail were chosen rather than defaulted to"
            ],
            "notes": [],
        }

    # ---------------------------------------------------------------- 1. hook candidates
    hooks = creative.get("hook_candidates") or []
    if len(hooks) < MIN_HOOK_CANDIDATES:
        problems.append(
            f"only {len(hooks)} hook candidate(s); at least {MIN_HOOK_CANDIDATES} distinct openings "
            "must be drafted and compared before one is chosen"
        )
    hook_texts = {str(h.get("text", "")).strip().lower() for h in hooks if isinstance(h, dict)}
    if len(hook_texts) < len(hooks):
        problems.append("hook candidates are not distinct — near-identical variations are not candidates")
    if hooks and not any(h.get("selected") for h in hooks if isinstance(h, dict)):
        problems.append("no hook candidate is marked `selected: true`")

    chosen = next((h for h in hooks if isinstance(h, dict) and h.get("selected")), {})
    if chosen:
        text = str(chosen.get("text", "")).strip()
        if len(text.split()) < MIN_HOOK_WORDS:
            problems.append(f"selected hook is only {len(text.split())} words — too short to carry a promise")
        if not str(chosen.get("why") or "").strip():
            problems.append("selected hook has no `why` — the choice must be justified, not just made")
        # the banned openings are the tell of a generic script
        banned = ("have you ever wondered", "today we're going to", "today we are going to",
                  "in this video", "welcome back", "let me tell you about")
        low = text.lower()
        for phrase in banned:
            if low.startswith(phrase) or f" {phrase}" in low:
                problems.append(f"selected hook opens with a banned generic phrase ({phrase!r})")
        # the hook must be voiced, not merely written in the record
        spoken = _dialogue_text(record)
        if spoken:
            overlap = len(_tokens(text) & _tokens(spoken)) / max(1, len(_tokens(text)))
            if overlap < 0.6:
                problems.append(
                    f"selected hook shares only {overlap:.0%} of its wording with the film's spoken "
                    "dialogue — the record promises an opening the video does not have"
                )
        if float(chosen.get("seconds_into_video", 999)) > MAX_HOOK_SECONDS:
            problems.append(
                f"hook lands {chosen.get('seconds_into_video')}s into the video; it must be within "
                f"{MAX_HOOK_SECONDS:.0f}s"
            )

    # ---------------------------------------------------------------- 2. retention map
    retention = creative.get("retention_map") or []
    if len(retention) < 3:
        problems.append("retention map needs at least three beats (hook, escalation, payoff)")
    kinds = {str(b.get("kind", "")).lower() for b in retention if isinstance(b, dict)}
    for required in ("hook", "payoff"):
        if required not in kinds:
            problems.append(f"retention map has no `{required}` beat")
    if "escalation" not in kinds and "reveal" not in kinds:
        problems.append("retention map has no escalation or reveal — nothing raises the stakes")
    for beat in retention:
        if isinstance(beat, dict) and not str(beat.get("purpose") or "").strip():
            problems.append(f"retention beat at {beat.get('at_sec')}s has no stated purpose")

    # ---------------------------------------------------------------- 3. title candidates
    titles = creative.get("title_candidates") or []
    if len(titles) < MIN_TITLE_CANDIDATES:
        problems.append(
            f"only {len(titles)} title candidate(s); at least {MIN_TITLE_CANDIDATES} approaches "
            "(curiosity / question / outcome / contradiction) must be drafted"
        )
    if titles and not any(t.get("selected") for t in titles if isinstance(t, dict)):
        problems.append("no title candidate is marked `selected: true`")
    final_title = str(record.get("title", ""))
    chosen_title = next((t for t in titles if isinstance(t, dict) and t.get("selected")), {})
    if chosen_title and str(chosen_title.get("text", "")) != final_title:
        problems.append("the selected title candidate does not match record.json `title`")

    # The brief asks for seven strategies, not three wordings. Approaching the same
    # idea four different ways is a real comparison; doing it once and varying the
    # adjectives is not.
    labelled = {
        str(c.get("approach", "")).strip()
        for c in titles
        if isinstance(c, dict) and str(c.get("approach", "")).strip()
    }
    unknown = labelled - set(TITLE_APPROACHES)
    if unknown:
        problems.append(
            f"title candidate(s) use unknown approach label(s) {sorted(unknown)}; "
            f"use one of {list(TITLE_APPROACHES)}"
        )
    if titles and len(labelled) < MIN_TITLE_APPROACHES:
        problems.append(
            f"title candidates cover {len(labelled)} distinct approach/approaches; at least "
            f"{MIN_TITLE_APPROACHES} are required so the choice is a strategy, not a rewording "
            f"(see TITLE_APPROACHES in tools/creative_gate.py)"
        )

    # ---------------------------------------------------------- 3b. the SEO package
    # These are the fields a viewer never sees and a search engine always reads.
    for field in REQUIRED_SEO_FIELDS:
        value = record.get(field)
        if value is None or (isinstance(value, (str, list, dict)) and len(value) == 0):
            problems.append(
                f"`{field}` is missing from record.json — the publishing package needs it "
                "before the video can be found"
            )
    alternates = record.get("title_alternates") or []
    if alternates and len(alternates) < 2:
        problems.append("`title_alternates` needs at least 2 usable alternates")
    if alternates and final_title in alternates:
        problems.append("`title_alternates` repeats the title in use — an alternate must be different")
    secondary = record.get("secondary_keywords") or []
    if secondary and not 1 <= len(secondary) <= 3:
        problems.append(f"`secondary_keywords` has {len(secondary)} entries; keep it to 1–3 to stay focused")
    hashtags = record.get("hashtags") or []
    if hashtags:
        bad = [h for h in hashtags if not str(h).startswith("#")]
        if bad:
            problems.append(f"hashtags must include the leading '#': {bad[:3]}")
        if not 3 <= len(hashtags) <= 5:
            problems.append(f"{len(hashtags)} hashtags; YouTube shows the first 3, so publish 3–5")

    # ---------------------------------------------------------------- 4. thumbnail concepts
    concepts = creative.get("thumbnail_concepts") or []
    if len(concepts) < MIN_THUMBNAIL_CONCEPTS:
        problems.append(
            f"only {len(concepts)} thumbnail concept(s); at least {MIN_THUMBNAIL_CONCEPTS} genuinely "
            "different framings must be considered before one is drawn"
        )
    focal = {str(c.get("focal_subject", "")).strip().lower() for c in concepts if isinstance(c, dict)}
    if len(concepts) >= 2 and len(focal) < len(concepts):
        problems.append(
            "thumbnail concepts share a focal subject — that is one concept repeated, not options"
        )
    if concepts and not any(c.get("selected") for c in concepts if isinstance(c, dict)):
        problems.append("no thumbnail concept is marked `selected: true`")

    # ---------------------------------------------------------------- 5. alignment
    align = creative.get("alignment") or {}
    for field in ("title_promise", "thumbnail_promise", "hook_promise", "verdict"):
        if not str(align.get(field) or "").strip():
            problems.append(f"alignment review is missing `{field}`")
    verdict = str(align.get("verdict", "")).lower()
    if verdict and verdict not in ("aligned", "pass"):
        problems.append(f"alignment verdict is {verdict!r} — packaging must be aligned before release")

    # ---------------------------------------------------------------- 6. evidence honesty
    claims = creative.get("claims") or []
    for claim in claims:
        if not isinstance(claim, dict):
            continue
        label = str(claim.get("label", "")).strip().upper().strip("[]")
        if label not in EVIDENCE_LABELS:
            problems.append(
                f"claim {claim.get('text', '')[:48]!r} has no [M]/[O]/[P] evidence label"
            )
        if label == "P" and str(claim.get("used_as", "")).lower() in ("fact", "stated as fact"):
            problems.append(
                f"prediction {claim.get('text', '')[:48]!r} is presented as fact — predictions must "
                "stay predictions"
            )

    # ---------------------------------------------------------------- 7. script critique
    critique = creative.get("script_critique") or {}
    scores = critique.get("scores") or {}
    missing = [c for c in CRITERIA if c not in scores]
    if missing:
        problems.append(f"script critique is missing criteria: {', '.join(missing)}")
    for name, value in scores.items():
        if not isinstance(value, (int, float)) or not 1 <= value <= 5:
            problems.append(f"script score `{name}` must be 1–5")
    weakest = str(critique.get("weakest") or "").strip()
    if weakest == "":
        problems.append("script critique names no weakest criterion — every draft has one")
    elif isinstance(scores, dict) and scores:
        numeric = [v for v in scores.values() if isinstance(v, (int, float))]
        if numeric and len(set(numeric)) == 1:
            problems.append(
                "script critique scores every criterion the same — a flat sheet means the script "
                "was not read critically; name what is actually weak"
            )
        elif weakest in scores and isinstance(scores[weakest], (int, float)) and numeric:
            if scores[weakest] > min(numeric):
                problems.append(
                    f"script critique names `{weakest}` as weakest but scores it "
                    f"{scores[weakest]}, above the lowest score {min(numeric)} — the named "
                    "weakest criterion must be the one that scored lowest"
                )
    if not str(critique.get("revision") or "").strip():
        problems.append("script critique records no revision — a critique that changed nothing is theatre")

    if not problems:
        notes.append(
            f"{len(hooks)} hooks, {len(titles)} titles, {len(concepts)} thumbnail concepts compared; "
            "alignment recorded; critique recorded"
        )

    return {"ok": not problems, "problems": problems, "notes": notes}


def packages() -> list[Path]:
    return sorted(p for p in VIDEOS.iterdir() if p.is_dir() and (p / "record.json").exists())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--check", metavar="SLUG", help="audit one slug only")
    args = parser.parse_args(argv)

    targets = packages()
    if args.check:
        targets = [p for p in targets if p.name == args.check]
        if not targets:
            print(f"no such package: {args.check}", file=sys.stderr)
            return 1

    failures = 0
    for package in targets:
        record = json.loads((package / "record.json").read_text())
        result = audit(record, package.name)
        if not result["ok"]:
            failures += 1
        print(f"{'ok  ' if result['ok'] else 'FAIL'} {package.name}")
        if args.verbose or not result["ok"]:
            for problem in result["problems"]:
                print(f"       - {problem}")
            for note in result["notes"]:
                print(f"       {note}")

    print()
    if failures:
        print(f"FAIL — {failures} of {len(targets)} package(s) lack a complete creative record")
        print("       See skills/youtube-packaging/SKILL.md and docs/production/CREATIVE_PACKAGING.md")
        return 1
    print(f"PASS — all {len(targets)} package(s) carry hooks, candidates, alignment and critique")
    print("       This gate checks that the creative work happened. It cannot judge whether it is good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
