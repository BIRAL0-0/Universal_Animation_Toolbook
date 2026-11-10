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
def test_style_score_is_bounded(style):
    navy_film = {"saturation": 0.7, "value": 0.2, "hues": [0, 0, 0, 0, 0, 0, 0, 0.1, 0.6, 0.3, 0, 0]}
    assert style.compare(navy_film, navy_film)["score"] == pytest.approx(1.0)

    # the real-world failure this checker exists to catch: a navy film, a warm poster
    sunset_poster = {"saturation": 0.35, "value": 0.3,
                     "hues": [0.05, 0.55, 0.35, 0, 0, 0, 0, 0, 0.05, 0, 0, 0]}
    result = style.compare(navy_film, sunset_poster)
    assert result["score"] < style.THRESHOLD
    assert result["palette"] < 0.35


def test_lifting_exposure_is_not_penalised_like_crushing_it(style):
    film = {"saturation": 0.4, "value": 0.30, "hues": [1 / 12] * 12}
    lifted = {"saturation": 0.4, "value": 0.55, "hues": [1 / 12] * 12}
    crushed = {"saturation": 0.4, "value": 0.05, "hues": [1 / 12] * 12}
    assert style.compare(film, lifted)["value"] > style.compare(film, crushed)["value"]


def test_published_thumbnails_match_their_films(style):
    import imageio_ffmpeg  # noqa: F401  (skip cleanly when the decoder is absent)

    for package in sorted(p for p in VIDEOS.iterdir() if p.is_dir()):
        master = package / f"{package.name}.mp4"
        thumbnail = package / "thumbnail.jpg"
        if not master.exists():
            continue
        result = style.report(master, thumbnail)
        assert result["score"] >= style.THRESHOLD, (package.name, result)
