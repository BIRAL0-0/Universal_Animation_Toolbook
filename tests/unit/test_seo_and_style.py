"""Guards for the two rules that make a package publishable rather than merely complete:
the thumbnail must look like the film, and the metadata must be findable."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
VIDEOS = REPO_ROOT / "videos"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def seo():
    return _load("seo_audit")


@pytest.fixture(scope="module")
def style():
    pytest.importorskip("PIL")
    return _load("thumbnail_style")


def _records():
    return {p.parent.name: json.loads(p.read_text()) for p in VIDEOS.glob("*/record.json")}


# ------------------------------------------------------------------ SEO
def test_every_record_declares_a_primary_keyword():
    for slug, record in _records().items():
        assert record.get("primary_keyword"), f"{slug} has no primary_keyword"


def test_every_package_clears_the_seo_floor(seo):
    for slug, record in _records().items():
        result = seo.audit(record)
        assert result["score"] >= seo.DEFAULT_THRESHOLD, (slug, result["score"], result["notes"])


def test_keyword_stuffing_is_penalised(seo):
    base = {
        "slug": "limiting-beliefs-test-film",
        "primary_keyword": "limiting beliefs",
        "title": "Limiting Beliefs: Did You Agree to That Wall?",
        "tags": ["limiting beliefs", "growth mindset", "self imposed limits",
                 "psychology of stuck", "fear of failure", "motivation", "mindset shift",
                 "what holds you back"],
        "pinned_comment": "Which wall did you agree to, and when? The dashed detail is the tell. " * 3,
        "youtube_description": "Limiting beliefs arrive as facts. " * 40,
    }
    stuffed = seo.audit(base)
    assert any("stuffing" in note for note in stuffed["notes"])


def test_missing_keyword_caps_the_score(seo):
    record = {
        "slug": "the-first-plank",
        "title": "Procrastination: Why 1 Plank Beats a Whole Bridge",
        "tags": ["procrastination"] * 10,
        "youtube_description": "A film about procrastination. " * 40 + "\n#a #b #c",
        "pinned_comment": "What is your blank plank this week? " * 6,
    }
    assert seo.audit(record)["score"] <= 40


# ------------------------------------------------------- thumbnail style
def _film(saturation, value, hues, edges=0.075, polarity=0.2, chroma=0.9):
    return {"saturation": saturation, "value": value, "hues": hues,
            "edges": edges, "polarity": polarity, "chroma": chroma}


def test_a_cover_compared_with_itself_is_perfect(style):
    navy_film = _film(0.7, 0.2, [0, 0, 0, 0, 0, 0, 0, 0.1, 0.6, 0.3, 0, 0])
    assert style.compare(navy_film, navy_film)["score"] == pytest.approx(1.0)


def test_style_score_is_bounded(style):
    navy_film = _film(0.7, 0.2, [0, 0, 0, 0, 0, 0, 0, 0.1, 0.6, 0.3, 0, 0])
    # the real-world failure this checker exists to catch: a navy film, a warm poster
    sunset_poster = _film(0.35, 0.3, [0.05, 0.55, 0.35, 0, 0, 0, 0, 0, 0.05, 0, 0, 0],
                          polarity=0.9, edges=0.26)
    result = style.compare(navy_film, sunset_poster)
    assert result["score"] < style.THRESHOLD
    assert result["palette"] < 0.35


def test_inverting_a_cover_is_not_a_mismatch(style):
    """White line art on black is the house look and must not read as drift.

    This was a real bug: `value` compared mean brightness, so the black-and-white
    cover of a cream film scored 0.00 on that axis and failed the gate outright,
    while a flat beige cover of the same film scored 0.99. Contrast is the point
    of a thumbnail; the score must be invariant under inversion.
    """
    cream_film = _film(0.05, 0.90, [0] * 12, polarity=0.16, chroma=0.02)
    beige_cover = _film(0.05, 0.90, [0] * 12, polarity=0.16, chroma=0.02)
    inverted_cover = _film(0.05, 0.08, [0] * 12, polarity=0.16, chroma=0.02)

    beige = style.compare(cream_film, beige_cover)["polarity"]
    inverted = style.compare(cream_film, inverted_cover)["polarity"]
    assert beige == pytest.approx(inverted, abs=0.05)
    assert inverted > 0.9


def test_a_washed_out_cover_still_fails(style):
    """The relaxation above must not let a single flat tone through."""
    cream_film = _film(0.05, 0.90, [0] * 12, polarity=0.16, chroma=0.02)
    flat_fill = _film(0.05, 0.92, [0] * 12, polarity=0.01, chroma=0.02)
    assert style.compare(cream_film, flat_fill)["polarity"] < 0.6


def test_a_film_without_colour_is_not_scored_on_hue(style):
    """A cream-paper film has no palette to match; hue must not be consulted."""
    achromatic = _film(0.05, 0.90, [0] * 12, polarity=0.16, chroma=0.02)
    colourful_cover = _film(0.60, 0.50, [0.9, 0.1] + [0] * 10, polarity=0.16, chroma=0.70)
    assert style.compare(achromatic, colourful_cover)["achromatic_film"] is True


def test_published_thumbnails_match_their_films(style):
    """Score each cover the way CI and the manual actually score it.

    `style.report()` defaults to `art_fraction=None`, but the documented invocation
    is `thumbnail_style.py check ... --package <dir>`, which reads
    `thumbnail_spec.art_fraction` from the record because the cover reserves a text
    band and only the art above it belongs to the film. Calling report() bare
    therefore measured a different region than the gate does — it scored
    `the-two-inch-bridge` at 0.615 and would have failed it while the CI step
    printed MATCH at 0.627. This test must measure what the gate measures.
    """
    import imageio_ffmpeg  # noqa: F401  (skip cleanly when the decoder is absent)
    import json

    for package in sorted(p for p in VIDEOS.iterdir() if p.is_dir()):
        master = package / f"{package.name}.mp4"
        thumbnail = package / "thumbnail.jpg"
        if not master.exists():
            continue
        record = json.loads((package / "record.json").read_text())
        art_fraction = (record.get("thumbnail_spec") or {}).get("art_fraction")
        result = style.report(master, thumbnail, art_fraction=art_fraction)
        assert result["score"] >= style.THRESHOLD, (package.name, result)
