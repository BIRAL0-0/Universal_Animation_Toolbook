#!/usr/bin/env python3
"""Tests for the bamboo cutaway set (engine/bamboo_grove.js).

The set exists to put two things in one frame at once: an empty soil line above, and a root
system doing all the work below. That only reads if the drawing's own clock is trustworthy, so
these tests pin the clock, the growth burst, and the two ways the composition previously broke
in a portrait crop.
"""

import json
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

MODULE = ROOT / "universal_toolbook" / "engine" / "bamboo_grove.js"

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")


def _canvas_backend_available() -> bool:
    """The 2D canvas backend is an optional npm dependency, not a pip one.

    CI's structure job installs only pyyaml + pytest, so the rasterising test below has to
    stand down rather than fail the build on a missing compile target.
    """
    script = (
        "try { require(%s); console.log('yes'); } catch (e) { console.log('no'); }"
        % json.dumps(str(ROOT / "universal_toolbook/engine/canvas_backend.js"))
    )
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=60)
    return "yes" in proc.stdout


def run_js(body: str) -> str:
    """Evaluate a snippet against the real module and return stdout."""
    script = textwrap.dedent(
        f"""
        const m = require({json.dumps(str(MODULE))});
        {body}
        """
    )
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    return proc.stdout.strip()


def test_prop_and_backdrop_sets_are_registered():
    out = run_js("console.log(JSON.stringify([m.BAMBOO_PROPS, m.BAMBOO_BACKDROPS]));")
    props, backdrops = json.loads(out)
    assert "bamboo_cutaway" in props
    assert "bamboo_label" in props
    assert backdrops == ["parchment_bamboo"]


def test_year_clock_spans_five_years_across_a_scene():
    out = run_js(
        "const f=(t,d)=>m.yearProgress(t,d).toFixed(2);"
        "console.log([f(0,10),f(5,10),f(10,10)].join(','));"
    )
    assert out == "0.00,2.50,5.00"


def test_year_clock_never_divides_by_zero():
    out = run_js("console.log(m.yearProgress(1,0).toFixed(2));")
    assert float(out) == 5.0


def test_nothing_grows_before_the_fifth_year():
    """The whole parable depends on four years of visible nothing."""
    out = run_js("console.log([0,1,2,3,4.2].map(y=>m.burst(y).toFixed(3)).join(','));")
    assert out.split(",") == ["0.000"] * 5


def test_growth_burst_completes_and_overshoots_at_most_slightly():
    out = run_js("console.log([m.burst(4.9).toFixed(3), m.burst(5.5).toFixed(3)].join(','));")
    mid, done = (float(v) for v in out.split(","))
    assert 0.9 < mid <= 1.05, f"burst should be nearly complete just after year four, got {mid}"
    assert 0.99 <= done <= 1.02, f"burst must settle at 1, overshooting only a hair, got {done}"


@pytest.mark.skipif(not _canvas_backend_available(), reason="no 2D canvas backend installed")
def test_engine_modules_still_load_together():
    """The two dispatch hooks must not introduce a require cycle.

    Both modules reach the optional 2D canvas backend at require time, so this cannot run in
    a job that installs only the Python side.
    """
    script = textwrap.dedent(
        f"""
        require({json.dumps(str(ROOT / 'universal_toolbook/engine/world_props_and_boards.js'))});
        require({json.dumps(str(ROOT / 'universal_toolbook/engine/parchment_ink_style.js'))});
        console.log('loaded');
        """
    )
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=90)
    assert proc.returncode == 0, proc.stderr
    assert "loaded" in proc.stdout


@pytest.mark.skipif(not _canvas_backend_available(), reason="no 2D canvas backend installed")
def test_backdrop_covers_an_overscanned_camera():
    """A zoomed-out camera must not reveal the paper edge behind the stage rectangle."""
    script = textwrap.dedent(
        f"""
        const {{ createCanvas }} = require({json.dumps(str(ROOT / 'universal_toolbook/engine/canvas_backend.js'))});
        const {{ drawBambooBackdrop }} = require({json.dumps(str(MODULE))});
        const W = 1920, H = 1080;
        const c = createCanvas(W, H); const g = c.getContext('2d');
        // sample the four corners: the sky/soil washes must reach them
        g.fillStyle = '#ff00ff'; g.fillRect(0, 0, W, H);   // magenta sentinel
        drawBambooBackdrop(g, {{ _sceneDuration: 12, soil_y: 0.54 }}, 0, 4, 0, 855, W, H);
        const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
        console.log(JSON.stringify([px(2, 2), px(W - 3, 2), px(2, H - 3), px(W - 3, H - 3)]));
        """
    )
    proc = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=90)
    assert proc.returncode == 0, proc.stderr
    corners = json.loads(proc.stdout.strip())
    for corner in corners:
        assert corner != [255, 0, 255], f"backdrop left the stage rectangle unpainted at {corner}"


def test_episode_stands_its_characters_on_the_soil_line():
    """The first cut had the farmer buried to the knees inside the earth."""
    episode = json.loads((ROOT / "examples" / "the_bamboo_seed_episode.json").read_text())
    floor_y = 855.0
    stage_h = 1080.0
    for scene in episode["scenes"]:
        soil = scene["setting"]["soil_y"]
        expected = round(floor_y - soil * stage_h, 1)
        for actor in scene.get("characters", []):
            for beat in actor["beats"]:
                assert beat["elevation"] == pytest.approx(expected, abs=0.15), (
                    f"{scene['id']}/{actor['id']} stands at {beat['elevation']} but the ground "
                    f"line is at {expected}"
                )
