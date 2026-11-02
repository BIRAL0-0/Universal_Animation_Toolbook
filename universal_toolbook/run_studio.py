#!/usr/bin/env python3
"""
Universal Animation Toolbook — End-to-End Video Orchestrator CLI.

Commands:
  check      Verify Node/Python/FFmpeg/fonts/BGM & run zero-grain render smoke check
  bgm-list   List bundled Creative Commons / NCS-style BGM tracks & mood keywords
  validate   Validate episode JSON (and optional 100% source script word fidelity)
  stills     Render razor-sharp scene stills for landscape or portrait visual QA
  render     Synthesize voiceover, render zero-grain 16:9 or 9:16 video, mix CC/NCS BGM & foley
  player     Package an MP4 into a self-contained HTML5 video player + download file
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import importlib.util
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

STUDIO_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(STUDIO_ROOT))


def _render_dimensions(aspect_ratio: str, draft: bool = False) -> Tuple[int, int]:
    """Choose 16:9 landscape or 9:16 portrait output without changing either axis independently."""
    sizes = {
        "16:9": ((960, 540), (1920, 1080)),
        "9:16": ((540, 960), (1080, 1920)),
    }
    if aspect_ratio not in sizes:
        raise ValueError(f"Unsupported aspect ratio {aspect_ratio!r}; choose 16:9 or 9:16.")
    return sizes[aspect_ratio][0 if draft else 1]


def _resolve_aspect_ratio(aspect_ratio: Optional[str], shorts: bool = False) -> str:
    """Resolve output orientation; the short-form runtime gate does not affect this choice."""
    if shorts and aspect_ratio not in (None, "9:16"):
        raise ValueError(
            "--shorts selects 9:16; use --short-form with --aspect-ratio 16:9 for landscape short-form."
        )
    if shorts:
        return "9:16"
    return aspect_ratio or "16:9"


def _is_short_form_duration(duration_sec: float) -> bool:
    """Generic short-form target is 40–90 seconds, inclusive, independent of aspect ratio."""
    try:
        seconds = float(duration_sec)
        return math.isfinite(seconds) and 40.0 <= seconds <= 90.0
    except (TypeError, ValueError):
        return False


def _is_shorts_duration(duration_sec: float) -> bool:
    """YouTube Shorts accepts any positive duration through 180 seconds (3 minutes), inclusive."""
    try:
        seconds = float(duration_sec)
        return math.isfinite(seconds) and 0.0 < seconds <= 180.0
    except (TypeError, ValueError):
        return False


def ensure_dependencies(auto_install: bool = True) -> Dict[str, Any]:
    """Verify (and auto-install in fresh AI sandboxes if needed) Node canvas & Python packages."""
    status: Dict[str, Any] = {}
    node_bin = shutil.which("node")
    if not node_bin:
        status["node"] = None
        status["missing"] = status.get("missing", []) + ["node"]
        status["python"] = sys.version.split()[0]
        return status
    status["node"] = subprocess.check_output([node_bin, "-v"], text=True).strip()

    # Either 2D backend is fine: node-canvas (needs cairo/pango) or @napi-rs/canvas (prebuilt).
    canvas_dir = STUDIO_ROOT / "node_modules" / "canvas"
    napi_canvas_dir = STUDIO_ROOT / "node_modules" / "@napi-rs" / "canvas"
    if not canvas_dir.exists() and not napi_canvas_dir.exists() and auto_install:
        npm_bin = shutil.which("npm")
        status["canvas_backend_installed"] = False
        if npm_bin:
            try:
                subprocess.run(
                    [npm_bin, "install", "--no-audit", "--no-fund"],
                    cwd=str(STUDIO_ROOT),
                    check=True,
                    timeout=600,
                    capture_output=True,
                )
                status["canvas_backend_installed"] = True
            except Exception as exc:
                status["missing"] = status.get("missing", [])
                status["missing"].append("canvas backend")
                status["canvas_error"] = f"{type(exc).__name__}: {exc}"[:300]

    def _ffmpeg():
        from engine.voice_engine import get_ffmpeg_exe
        return get_ffmpeg_exe()

    try:
        status["ffmpeg"] = _ffmpeg()
    except Exception:
        # A fresh machine (or a PEP 668 system Python) may have no imageio-ffmpeg and
        # refuse to install it. Never raise from here: report what is missing so the
        # caller can print an actionable message instead of a traceback.
        if auto_install:
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "--quiet", "imageio-ffmpeg"],
                    check=True,
                    timeout=180,
                    capture_output=True,
                )
                status["ffmpeg"] = _ffmpeg()
            except Exception as exc:
                status["ffmpeg"] = None
                status["missing"] = status.get("missing", [])
                status["missing"].append("imageio-ffmpeg")
                status["ffmpeg_error"] = f"{type(exc).__name__}: {exc}"[:300]
        else:
            raise

    try:
        import edge_tts  # noqa: F401
        status["edge_tts"] = True
    except ImportError:
        if auto_install:
            try:
                subprocess.run(
                    [sys.executable, "-m", "pip", "install", "--quiet", "edge-tts"],
                    check=True,
                    timeout=120,
                    capture_output=True,
                )
                status["edge_tts"] = True
            except Exception:
                status["edge_tts"] = False
        else:
            status["edge_tts"] = False

    status["python"] = sys.version.split()[0]

    # Voice readiness: a render with no voices silently produces a silent film, so the
    # bootstrap check reports it up front.
    try:
        from engine.voice_engine import _piper_available  # type: ignore
        piper = bool(_piper_available())
    except Exception:
        piper = False
    status["offline_voiceover_ready"] = piper
    return status


def _compile_episode_via_node(
    ep_path: Path, width: int = 1920, height: int = 1080, subtitles: Optional[str] = None
) -> Dict[str, Any]:
    js_code = (
        "const fs=require('fs');"
        "const {compileEpisode,formatYouTubeChapters}=require('./engine/episode');"
        "const spec=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));"
        "const ep=compileEpisode(spec,{width:Number(process.argv[2]),height:Number(process.argv[3]),subtitlesMode:process.argv[4]||null});"
        "console.log(JSON.stringify({episode:ep,chaptersTxt:formatYouTubeChapters(ep)}));"
    )
    cmd = ["node", "-e", js_code, str(ep_path), str(width), str(height), subtitles or ""]
    out = subprocess.check_output(cmd, cwd=str(STUDIO_ROOT), text=True)
    return json.loads(out)


def cmd_bgm_list(_args: argparse.Namespace) -> int:
    from engine.bgm_library import load_bgm_catalog
    print(json.dumps({"bgm_tracks": load_bgm_catalog()}, indent=2))
    return 0


def cmd_check(_args: argparse.Namespace) -> int:
    t0 = time.time()
    deps = ensure_dependencies(auto_install=True)

    # Report a missing dependency as a status, never as a traceback: the first command a
    # new session runs must tell it what to install and how, not hand it a stack trace.
    if deps.get("missing"):
        cfg = json.loads((STUDIO_ROOT / "config" / "studio_config.json").read_text(encoding="utf-8"))
        print(json.dumps({
            "status": "NEEDS_DEPS",
            "missing": sorted(set(deps["missing"])),
            "node": deps.get("node"),
            "python": deps.get("python"),
            "film_grain": cfg.get("film_grain"),
            "fix": [
                "python3 -m venv .venv && . .venv/bin/activate   # if pip is blocked (PEP 668)",
                "pip install -r universal_toolbook/requirements.txt",
                "npm install --prefix universal_toolbook",
                "pip install piper-tts   # offline voices, when the Edge endpoint is unreachable",
                "python3 universal_toolbook/tools/fetch_piper_voices.py install "
                "# or --github <owner>/<repo> / --from-dir <dir> behind a blocked network",
                "python3 universal_toolbook/tools/fetch_piper_voices.py check",
            ],
            "detail": {k: v for k, v in deps.items() if k.endswith("_error")},
        }, indent=2))
        return 2

    cfg = json.loads((STUDIO_ROOT / "config" / "studio_config.json").read_text(encoding="utf-8"))
    assert cfg.get("film_grain") is False, "studio_config.json must keep film_grain: false!"

    from engine.bgm_library import load_bgm_catalog
    bgm_cat = load_bgm_catalog()
    assert len(bgm_cat) >= 5, "Expected bundled Creative Commons BGM catalog in assets/bgm/"

    smoke_spec = {
        "title": "System Smoke Verification",
        "bgm": "chill_focus",
        "cast": {
            "a": {"name": "SPEAKER A", "color": "cyan", "build": "slim", "accessories": ["glasses"]},
            "b": {"name": "SPEAKER B", "color": "emerald", "build": "athletic", "accessories": ["scarf"]},
        },
        "scenes": [
            {
                "id": "S01",
                "setting": {
                    "sky": ["#071224", "#122a48"],
                    "floor_color": "#060e1a",
                    "light_color": "#38bdf8",
                    "backdrop": "grid",
                    "weather": "particles",
                    "lighting": "skylights",
                },
                "duration": 2.0,
                "narration": "Testing sharp multi-character rendering, custom setting, and Creative Commons BGM.",
                "characters": [
                    {"id": "a", "fromX": 0.24, "toX": 0.38, "action": "walk"},
                    {"id": "b", "x": 0.62, "facing": -1, "action": "talk_explain"},
                ],
                "board": {"type": "line_graph", "title": "Proof Check", "x": 0.48, "y": 130, "w": 700, "h": 350},
            }
        ],
        "outro": False,
    }
    with tempfile.TemporaryDirectory() as tmp:
        td = Path(tmp)
        ep_json = td / "smoke.json"
        ep_json.write_text(json.dumps(smoke_spec), encoding="utf-8")
        comp = _compile_episode_via_node(ep_json, 960, 540)["episode"]
        silent_mp4 = td / "silent.mp4"
        subprocess.run(
            [
                "node",
                str(STUDIO_ROOT / "engine" / "video_renderer.js"),
                "--mode", "render",
                "--episode", str(ep_json),
                "--out", str(silent_mp4),
                "--width", "960",
                "--height", "540",
                "--ffmpeg", deps["ffmpeg"],
            ],
            cwd=str(STUDIO_ROOT),
            check=True,
        )
        from engine.audio_mixer import build_master_soundtrack, mux_video_and_audio
        wav_path = td / "mix.wav"
        audio_info = build_master_soundtrack(comp, [], wav_path)
        final_mp4 = td / "smoke_final.mp4"
        mux_video_and_audio(silent_mp4, wav_path, final_mp4)
        assert final_mp4.exists() and final_mp4.stat().st_size > 10_000

    elapsed = round(time.time() - t0, 2)
    print(
        json.dumps(
            {
                "status": "OK",
                "elapsed_sec": elapsed,
                "bgm_tracks_available": len(bgm_cat),
                "smoke_bgm_mode": audio_info["bgm"]["mode"],
                "environment": deps,
            },
            indent=2,
        )
    )

    # A green `check` still cannot narrate without a voice model. Say so once, here, instead
    # of letting the next render end in a silent master or an exit code 3.
    if not deps.get("offline_voiceover_ready"):
        print(
            "\nNOTE: no offline voice models -- if the Edge endpoint is unreachable, renders will "
            "have no narration.\n"
            "  pip install piper-tts && python3 universal_toolbook/tools/fetch_piper_voices.py install\n"
            "  (behind a blocked network: ... install --github <owner>/<repo> --github-path <dir>)\n"
            "  silent drafts on purpose: render ... --voice none",
            file=sys.stderr,
        )
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    ensure_dependencies(auto_install=True)
    ep_path = Path(args.episode).resolve()
    comp_wrap = _compile_episode_via_node(ep_path)
    ep = comp_wrap["episode"]

    report: Dict[str, Any] = {
        "title": ep["title"],
        "duration_sec": ep["totalDuration"],
        "duration_min": round(ep["totalDuration"] / 60.0, 2),
        "scene_count": len(ep["scenes"]),
        "bgm": ep.get("bgm", "auto"),
        "cast": list(ep["cast"].keys()),
        "settings_used": sorted({s["settingSignature"] for s in ep["scenes"]}),
        "accent_colors_used": sorted({s["accentColor"] for s in ep["scenes"]}),
        "sound_events": len(ep["soundEvents"]),
        "warnings": ep["warnings"],
    }

    if args.script:
        from tools.script_helper import verify_script_fidelity
        raw_script = Path(args.script).read_text(encoding="utf-8")
        spec = json.loads(ep_path.read_text(encoding="utf-8"))
        report["script_fidelity"] = verify_script_fidelity(raw_script, spec)

    print(json.dumps(report, indent=2))
    return 0 if not ep["errors"] else 1


def cmd_stills(args: argparse.Namespace) -> int:
    ensure_dependencies(auto_install=True)
    ep_path = Path(args.episode).resolve()
    out_dir = Path(args.out_dir).resolve()
    subprocess.run(
        [
            "node",
            str(STUDIO_ROOT / "engine" / "video_renderer.js"),
            "--mode", "stills",
            "--episode", str(ep_path),
            "--out-dir", str(out_dir),
            "--width", str(args.width),
            "--height", str(args.height),
            "--limit", str(args.limit),
        ],
        cwd=str(STUDIO_ROOT),
        check=True,
    )
    return 0


def _voice_diagnosis(deps: Dict[str, Any]) -> List[str]:
    """Explain *why* a voice mode produced no speech, in the order the engine tries backends."""
    out: List[str] = []
    if not deps.get("edge_tts"):
        out.append("edge-tts is not installed -> pip install -r universal_toolbook/requirements.txt")
    else:
        out.append(
            "edge-tts is installed but every line failed (normally no internet access to the "
            "neural speech endpoint)"
        )
    try:
        from engine.voice_engine import piper_voice_dir  # type: ignore

        have_pkg = importlib.util.find_spec("piper") is not None
        voice_dir = piper_voice_dir()
        if have_pkg and voice_dir is not None:
            out.append(
                f"piper-tts is installed and voice models were found in {voice_dir}, "
                "but offline synthesis still failed"
            )
        elif have_pkg:
            out.append(
                "piper-tts is installed but no .onnx voice models were found -> "
                "python3 universal_toolbook/tools/fetch_piper_voices.py install"
            )
        elif voice_dir is not None:
            out.append(
                f"piper-tts is not installed, although local voice models exist in {voice_dir} "
                "-> pip install piper-tts"
            )
        else:
            out.append(
                "piper-tts and local voice models are both missing -> pip install piper-tts && "
                "python3 universal_toolbook/tools/fetch_piper_voices.py install"
            )
    except Exception as exc:  # pragma: no cover - diagnostics must never crash a render
        out.append(f"offline voice probe failed: {exc}")
    return out


def cmd_render(args: argparse.Namespace) -> int:
    try:
        aspect_ratio = _resolve_aspect_ratio(args.aspect_ratio, args.shorts)
        width, height = _render_dimensions(aspect_ratio, args.draft)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    short_form = bool(args.short_form or args.shorts)
    output_profile = "shorts" if args.shorts else ("portrait" if aspect_ratio == "9:16" else "landscape")

    t0 = time.time()
    deps = ensure_dependencies(auto_install=True)
    ffmpeg_bin = deps["ffmpeg"]

    ep_path = Path(args.episode).resolve()
    out_mp4 = Path(args.out).resolve()
    out_mp4.parent.mkdir(parents=True, exist_ok=True)

    crf = 18 if args.draft else args.crf
    preset = "veryfast" if args.draft else args.preset

    work_dir = out_mp4.parent / f".work_{out_mp4.stem}"
    work_dir.mkdir(parents=True, exist_ok=True)

    raw_spec = json.loads(ep_path.read_text(encoding="utf-8"))

    from engine.voice_engine import prepare_episode_voiceover
    retimed_ep_file = work_dir / "episode_retimed.json"
    vo_meta_file = work_dir / "vo_manifest.json"

    if args.resume and retimed_ep_file.exists() and vo_meta_file.exists():
        retimed_spec = json.loads(retimed_ep_file.read_text(encoding="utf-8"))
        vo_meta = json.loads(vo_meta_file.read_text(encoding="utf-8"))
        vo_segments = vo_meta["segments"]
        vo_backend = vo_meta["backend"]
    else:
        voice_dir = Path(args.voice_dir).resolve() if args.voice_dir else None
        retimed_spec, vo_segments, vo_backend = prepare_episode_voiceover(
            raw_spec,
            work_dir=work_dir,
            mode=args.voice,
            voice=args.voice_name,
            rate=args.voice_rate,
            voice_dir=voice_dir,
        )
        retimed_ep_file.write_text(json.dumps(retimed_spec, indent=2), encoding="utf-8")
        vo_meta_file.write_text(
            json.dumps({"backend": vo_backend, "segments": vo_segments}, indent=2),
            encoding="utf-8",
        )

    comp_wrap = _compile_episode_via_node(retimed_ep_file, width, height, args.subtitles)
    compiled = comp_wrap["episode"]
    chapters_txt = comp_wrap["chaptersTxt"]
    if short_form:
        duration_sec = float(compiled["totalDuration"])
        duration_valid = (
            _is_shorts_duration(duration_sec) if args.shorts else _is_short_form_duration(duration_sec)
        )
        if not duration_valid:
            if args.shorts:
                status = "INVALID_SHORTS_DURATION"
                duration_policy = "Shorts duration must be greater than 0 and at most 180 seconds (3 minutes)."
                duration_range = [0, 180]
                range_bounds = {"minimum": "exclusive", "maximum": "inclusive"}
            else:
                status = "INVALID_SHORT_FORM_DURATION"
                duration_policy = "Short-form duration must be from 40 to 90 seconds, inclusive."
                duration_range = [40, 90]
                range_bounds = {"minimum": "inclusive", "maximum": "inclusive"}
            print(
                json.dumps(
                    {
                        "status": status,
                        "duration_sec": round(duration_sec, 3),
                        "aspect_ratio": aspect_ratio,
                        "required_range_sec": duration_range,
                        "range_bounds": range_bounds,
                        "hint": duration_policy,
                    },
                    indent=2,
                ),
                file=sys.stderr,
            )
            return 2

    total_frames = int(compiled["totalFrames"])
    fps = int(compiled["fps"])
    chunk_frames = max(fps * 5, int(args.chunk_sec * fps))
    num_chunks = math.ceil(total_frames / chunk_frames)

    chunks_dir = work_dir / f"chunks_{width}x{height}"
    chunks_dir.mkdir(parents=True, exist_ok=True)

    chunk_files: List[Path] = []
    pending_tasks: List[Tuple[int, int, int, Path]] = []
    for c_idx in range(num_chunks):
        sf = c_idx * chunk_frames
        ef = min(total_frames, (c_idx + 1) * chunk_frames)
        c_file = chunks_dir / f"chunk_{c_idx:04d}_{sf}_{ef}.mp4"
        chunk_files.append(c_file)
        if args.resume and c_file.exists() and c_file.stat().st_size > 2048:
            continue
        pending_tasks.append((c_idx, sf, ef, c_file))

    if args.max_chunks and len(pending_tasks) > args.max_chunks:
        to_run = pending_tasks[: args.max_chunks]
        pause_after = True
    else:
        to_run = pending_tasks
        pause_after = False

    def _render_one_chunk(task: Tuple[int, int, int, Path]) -> None:
        c_idx, sf, ef, c_file = task
        print(
            f"[toolbook] Rendering chunk {c_idx + 1}/{num_chunks} (frames {sf}..{ef} @ {width}x{height})...",
            file=sys.stderr,
        )
        cmd = [
            "node",
            str(STUDIO_ROOT / "engine" / "video_renderer.js"),
            "--mode", "render",
            "--episode", str(retimed_ep_file),
            "--out", str(c_file),
            "--width", str(width),
            "--height", str(height),
            "--start-frame", str(sf),
            "--end-frame", str(ef),
            "--crf", str(crf),
            "--preset", preset,
            "--ffmpeg", ffmpeg_bin,
        ]
        if args.subtitles:
            cmd.extend(["--subtitles", args.subtitles])
        subprocess.run(cmd, cwd=str(STUDIO_ROOT), check=True)

    workers = max(1, int(args.workers or min(4, os.cpu_count() or 2)))
    if workers == 1 or len(to_run) <= 1:
        for task in to_run:
            _render_one_chunk(task)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_render_one_chunk, task) for task in to_run]
            for fut in futures:
                fut.result()

    if pause_after:
        remaining = sum(1 for f in chunk_files if not f.exists())
        print(
            json.dumps(
                {
                    "status": "PARTIAL_CHUNK_PAUSE",
                    "completed_chunks": num_chunks - remaining,
                    "total_chunks": num_chunks,
                    "remaining_chunks": remaining,
                    "resume_hint": "Re-run the exact same command with --resume to finish.",
                },
                indent=2,
            )
        )
        return 0

    silent_master = work_dir / f"silent_{width}x{height}.mp4"
    if len(chunk_files) == 1:
        shutil.copyfile(chunk_files[0], silent_master)
    else:
        concat_txt = work_dir / "concat.txt"
        concat_txt.write_text(
            "".join(f"file '{cf.resolve()}'\n" for cf in chunk_files),
            encoding="utf-8",
        )
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_txt),
                "-c", "copy",
                str(silent_master),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    from engine.audio_mixer import build_master_soundtrack, mux_video_and_audio
    master_wav = work_dir / "master_audio.wav"
    audio_stats = build_master_soundtrack(compiled, vo_segments, master_wav, bgm_override=args.bgm)
    mux_video_and_audio(silent_master, master_wav, out_mp4)

    bgm_credits = audio_stats.get("bgm", {}).get("credits_text", "")
    full_chapters = chapters_txt
    if bgm_credits:
        full_chapters += f"\n---\n{bgm_credits}\n"

    chapters_path = out_mp4.with_name(f"{out_mp4.stem}_chapters.txt")
    chapters_path.write_text(full_chapters, encoding="utf-8")

    cues_path = out_mp4.with_name(f"{out_mp4.stem}_visual_audio_cues.json")
    cues_path.write_text(json.dumps(compiled.get("soundEvents", []), indent=2), encoding="utf-8")

    warnings: List[str] = []
    voice_diagnosis = _voice_diagnosis(deps) if (
        vo_backend == "text-led" and args.voice not in (None, "none")
    ) else []
    silent_render = vo_backend == "text-led" and args.voice not in (None, "none")
    if silent_render:
        msg = (
            "NO SPEECH WAS SYNTHESIZED: the backend is 'text-led', so this file has "
            "subtitles and music but no narration. Fix with "
            "`pip install piper-tts` + "
            "`python3 universal_toolbook/tools/fetch_piper_voices.py install` "
            "(or an internet-connected edge-tts run), then re-render. "
            "Pass --voice none for a deliberately silent draft, "
            "or --allow-silent to accept this one."
        )
        warnings.append(msg)
        print("\n" + "!" * 78 + f"\nWARNING: {msg}", file=sys.stderr)
        for line in voice_diagnosis:
            print(f"  - {line}", file=sys.stderr)
        print("!" * 78 + "\n", file=sys.stderr)

    # Written after the voice check so the gate artifact records whether speech exists.
    val_path = out_mp4.with_name(f"{out_mp4.stem}_validation_report.json")
    val_path.write_text(
        json.dumps(
            {
                "valid": len(compiled.get("errors", [])) == 0,
                "duration": compiled["totalDuration"],
                "frames": compiled["totalFrames"],
                "dimensions": [width, height],
                "aspect_ratio": aspect_ratio,
                "output_profile": output_profile,
                "short_form": short_form,
                "fps": fps,
                "film_grain": False,
                "voiced": vo_backend != "text-led",
                "voice_backend": vo_backend,
                "warnings": list(compiled.get("warnings", [])) + warnings,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    report = {
        "status": "COMPLETE_SILENT" if (silent_render and not args.allow_silent) else "COMPLETE",
        "title": compiled["title"],
        "output_mp4": str(out_mp4),
        "size_mb": round(out_mp4.stat().st_size / (1024 * 1024), 3),
        "resolution": f"{width}x{height}",
        "aspect_ratio": aspect_ratio,
        "output_profile": output_profile,
        "short_form": short_form,
        "fps": fps,
        "film_grain": False,
        "duration_sec": compiled["totalDuration"],
        "duration_min": round(compiled["totalDuration"] / 60.0, 2),
        "scene_count": len(compiled["scenes"]),
        "voice_backend": vo_backend,
        "voiced": vo_backend != "text-led",
        "voice_mode": args.voice,
        "voice_diagnosis": voice_diagnosis,
        "warnings": warnings,
        "audio": audio_stats,
        "chapters_file": str(chapters_path),
        "elapsed_sec": round(time.time() - t0, 2),
    }
    report_path = out_mp4.with_name(f"{out_mp4.stem}_report.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if silent_render and not args.allow_silent:
        return 3
    return 0


def cmd_player(args: argparse.Namespace) -> int:
    deps = ensure_dependencies(auto_install=True)
    ffmpeg_bin = deps["ffmpeg"]
    src_mp4 = Path(args.mp4).resolve()
    out_html = Path(args.out).resolve()
    out_html.parent.mkdir(parents=True, exist_ok=True)

    max_mp4_bytes = int(args.max_mb * 0.72 * 1024 * 1024)
    chosen_mp4 = src_mp4

    if src_mp4.stat().st_size > max_mp4_bytes:
        probe = subprocess.run(
            [ffmpeg_bin, "-i", str(src_mp4)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr)
        dur = 300.0
        if m:
            dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
        target_total_kbps = max(260, int((max_mp4_bytes * 8 / 1000) / max(1.0, dur) * 0.92))
        audio_kbps = 96
        video_kbps = max(160, target_total_kbps - audio_kbps)
        scale_vf = "scale=1280:720:flags=lanczos" if video_kbps < 900 else "scale=1920:1080:flags=lanczos"

        slim_mp4 = out_html.with_suffix(".slim.mp4")
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-i", str(src_mp4),
                "-vf", scale_vf,
                "-c:v", "libx264",
                "-preset", "fast",
                "-tune", "animation",
                "-b:v", f"{video_kbps}k",
                "-maxrate", f"{int(video_kbps * 1.25)}k",
                "-bufsize", f"{int(video_kbps * 2)}k",
                "-c:a", "aac",
                "-b:a", f"{audio_kbps}k",
                "-movflags", "+faststart",
                str(slim_mp4),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        chosen_mp4 = slim_mp4

    b64 = base64.b64encode(chosen_mp4.read_bytes()).decode("ascii")
    dl_name = src_mp4.name
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{dl_name} — Universal Animation Toolbook</title>
<style>
  body {{ margin:0; background:#070c18; color:#f8fafc; font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; padding:28px 18px; }}
  .card {{ max-width:980px; width:100%; background:#0f172a; border:1px solid rgba(56,189,248,0.28); border-radius:16px; padding:22px; box-shadow:0 20px 50px rgba(0,0,0,0.45); }}
  h1 {{ margin:0 0 6px; font-size:20px; color:#38bdf8; }}
  p {{ margin:0 0 16px; font-size:14px; color:#94a3b8; }}
  video {{ width:100%; border-radius:10px; background:#000; display:block; }}
  .actions {{ margin-top:16px; display:flex; gap:12px; align-items:center; }}
  a.btn {{ background:#38bdf8; color:#06101e; font-weight:700; text-decoration:none; padding:11px 22px; border-radius:10px; font-size:14px; }}
</style>
</head>
<body>
  <div class="card">
    <h1>{dl_name}</h1>
    <p>16:9 Crisp Zero-Grain Long-Form Video • Universal Animation Toolbook</p>
    <video id="player" controls playsinline></video>
    <div class="actions">
      <a id="dl" class="btn" download="{dl_name}" href="#">Download MP4 Video</a>
    </div>
  </div>
<script>
  const b64 = "{b64}";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], {{ type: "video/mp4" }});
  const url = URL.createObjectURL(blob);
  document.getElementById("player").src = url;
  document.getElementById("dl").href = url;
</script>
</body>
</html>
"""
    out_html.write_text(html, encoding="utf-8")
    if chosen_mp4 != src_mp4 and chosen_mp4.exists():
        chosen_mp4.unlink(missing_ok=True)

    size_mb = round(out_html.stat().st_size / (1024 * 1024), 3)
    print(json.dumps({"player_html": str(out_html), "size_mb": size_mb}, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Universal Animation Toolbook Orchestrator")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("check", help="Run environment, BGM, and zero-grain render smoke check")
    sub.add_parser("bgm-list", help="List bundled Creative Commons / NCS-style BGM tracks")

    pv = sub.add_parser("validate", help="Validate episode JSON & optional source script")
    pv.add_argument("episode")
    pv.add_argument("--script", default=None, help="Optional raw script file to verify 100% fidelity")

    ps = sub.add_parser("stills", help="Render landscape or portrait PNG scene stills for visual QA")
    ps.add_argument("episode")
    ps.add_argument("--out-dir", default="output/stills")
    ps.add_argument("--width", type=int, default=1920)
    ps.add_argument("--height", type=int, default=1080)
    ps.add_argument("--limit", type=int, default=12)

    pr = sub.add_parser("render", help="Render a voiced 16:9 landscape or 9:16 portrait MP4")
    pr.add_argument("episode")
    pr.add_argument("--out", default="output/story_episode.mp4")
    pr.add_argument(
        "--aspect-ratio", "--aspect", dest="aspect_ratio", choices=["16:9", "9:16"], default=None,
        help="Output composition: 16:9 landscape (default) or 9:16 portrait. Geometry is preserved; frames are reframed, never stretched.",
    )
    pr.add_argument(
        "--short-form", action="store_true",
        help="Validate final speech-locked runtime is 40–90 seconds without changing the selected aspect ratio.",
    )
    pr.add_argument(
        "--shorts", action="store_true",
        help="YouTube Shorts profile: selects 9:16 and allows any positive final runtime up to 180 seconds.",
    )
    pr.add_argument("--draft", action="store_true", help="Fast preview: 960x540 (landscape) or 540x960 (portrait)")
    pr.add_argument("--full", action="store_true", help="Full master: 1920x1080 landscape or 1080x1920 portrait")
    pr.add_argument(
        "--bgm",
        default=None,
        help="BGM mode/track: auto, dynamic, electronic_drive, upbeat_ncs_synth, chill_focus, retro_pulse, reflective_piano, suspense_tension, triumph_horizon, procedural, none, or /path/to/track.mp3",
    )
    pr.add_argument("--voice", choices=["auto", "edge", "piper", "offline", "none"], default="auto")
    pr.add_argument("--voice-name", default="en-US-AndrewNeural")
    pr.add_argument("--voice-rate", default="+2%")
    pr.add_argument("--voice-dir", default=None)
    pr.add_argument(
        "--allow-silent",
        action="store_true",
        help="Accept a render with no synthesized speech (otherwise it exits 3 and reports status COMPLETE_SILENT).",
    )
    pr.add_argument("--subtitles", choices=["cinema", "off"], default=None)
    pr.add_argument("--crf", type=int, default=17)
    pr.add_argument("--preset", default="veryfast")
    pr.add_argument("--chunk-sec", type=int, default=30)
    pr.add_argument("--workers", type=int, default=0, help="Parallel chunk render workers (0 = auto)")
    pr.add_argument("--max-chunks", type=int, default=0)
    pr.add_argument("--resume", action="store_true")

    pa = sub.add_parser("player", help="Create self-contained HTML5 player + download wrapper")
    pa.add_argument("mp4")
    pa.add_argument("--out", default="output/video_player_download.html")
    pa.add_argument("--max-mb", type=float, default=14.5)

    return p


if __name__ == "__main__":
    parser = build_parser()
    parsed = parser.parse_args()
    sys.exit(
        {
            "check": cmd_check,
            "bgm-list": cmd_bgm_list,
            "validate": cmd_validate,
            "stills": cmd_stills,
            "render": cmd_render,
            "player": cmd_player,
        }[parsed.cmd](parsed)
    )
