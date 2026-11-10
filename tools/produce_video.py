#!/usr/bin/env python3
"""One-command production orchestrator for the Universal Animation Toolbook.

Implements the ordered stages of ``AGENTS.md`` §1.2 for a project whose
``episode.json`` already exists, and refuses to advance past a failed gate::

    Stage  A  validate          (gate: warnings must be [])
    Stage  B  stills, 9:16      (cheap QA loop — inspect before rendering)
    Stage  C  stills, 16:9
    Stage  D  draft render      (timing / boards / cuts / audio)
    Stage  E  master 9:16       (projects/<slug>/final.mp4)
    Stage  F  master 16:9       (projects/<slug>/renders/final_16x9.mp4)
    Stage  G  measure audio     (peak / RMS on the mixed WAV)
    Stage  H  extract QA frames (for real inspection, mute-legibility test)
    Stage  I  verify container  (dimensions, fps, duration, streams, full decode)

Usage::

    .venv/bin/python tools/produce_video.py projects/video-001-twenty-three-minutes
    .venv/bin/python tools/produce_video.py projects/<slug> --stop-after stills
    .venv/bin/python tools/produce_video.py projects/<slug> --skip draft

Everything it does is logged into ``<project>/PRODUCTION_LOG.md`` as an appended run record and a
machine-readable ``<project>/qa_measurements.json`` is written for the QA report. The tool never
edits creative content; it only runs the pipeline and measures the output.

Exit codes: 0 all requested stages passed · 2 a gate failed · 3 render produced no speech.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
import time
import wave
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
STUDIO = REPO_ROOT / "universal_toolbook" / "run_studio.py"

STAGES = ["validate", "stills", "draft", "master", "measure", "frames", "verify"]


def run(cmd: list[str], cwd: Path, log) -> subprocess.CompletedProcess:
    log(f"$ {' '.join(str(c) for c in cmd)}")
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.stdout.strip():
        for line in r.stdout.strip().splitlines()[-12:]:
            log("    " + line)
    if r.returncode != 0 and r.stderr.strip():
        for line in r.stderr.strip().splitlines()[-12:]:
            log("  ! " + line)
    return r


def ffmpeg_exe() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def invalidate_stale_work_dirs(proj: Path, spec: Path) -> tuple[str, bool]:
    """Clear resumed render caches whenever the authoritative episode spec changes.

    ``run_studio.py --resume`` reuses ``.work_*/episode_retimed.json``, chunk MP4s and the mixed
    WAV. Those artifacts encode the *old* spec, so a board/geometry edit can otherwise be
    silently omitted from a supposedly fresh master. A SHA-256 marker lives in an ignored
    ``.work_cache_state/`` directory and is compared at the start of every orchestrator run.
    """
    digest = hashlib.sha256(spec.read_bytes()).hexdigest()
    state_dir = proj / ".work_cache_state"
    marker = state_dir / "spec_sha256"
    previous = marker.read_text(encoding="utf-8").strip() if marker.exists() else None
    changed = previous != digest
    if changed:
        for root in (proj, proj / "renders"):
            for work in sorted(root.glob(".work_*")):
                if work.is_dir() and work != state_dir:
                    shutil.rmtree(work)
        state_dir.mkdir(parents=True, exist_ok=True)
        marker.write_text(digest + "\n", encoding="utf-8")
    return digest, changed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("project", help="path to projects/<slug>")
    ap.add_argument("--stop-after", choices=STAGES, default=None)
    ap.add_argument("--skip", action="append", default=[], choices=STAGES)
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--chunk-sec", type=int, default=45)
    ap.add_argument("--preset", default="veryfast")
    ap.add_argument("--crf", type=int, default=24)
    args = ap.parse_args()

    proj = (REPO_ROOT / args.project).resolve() if not Path(args.project).is_absolute() \
        else Path(args.project)
    spec = proj / "episode.json"
    if not spec.exists():
        print(f"ERROR: no episode.json in {proj}", file=sys.stderr)
        return 2
    (proj / "renders").mkdir(parents=True, exist_ok=True)
    (proj / "audio").mkdir(parents=True, exist_ok=True)
    (proj / "assets" / "qa_frames").mkdir(parents=True, exist_ok=True)
    spec_sha, caches_cleared = invalidate_stale_work_dirs(proj, spec)

    log_lines: list[str] = []

    def log(msg: str) -> None:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{stamp}] {msg}"
        print(line)
        log_lines.append(line)

    if caches_cleared:
        log(f"episode spec changed -> cleared stale .work_* render caches ({spec_sha[:12]})")

    py = sys.executable
    ff = ffmpeg_exe()
    measurements: dict = {"project": proj.name, "stages": {}}
    stop_at = STAGES.index(args.stop_after) if args.stop_after else len(STAGES) - 1

    def stage(name: str):
        return STAGES.index(name) <= stop_at and name not in args.skip

    # ---------------------------------------------------------- A validate
    if stage("validate"):
        log("STAGE A — validate (gate: warnings must be [])")
        r = run([py, str(STUDIO), "validate", str(spec)], REPO_ROOT, log)
        if r.returncode != 0:
            log("GATE FAILED: validate returned non-zero")
            _append_log(proj, log_lines)
            return 2
        try:
            info = json.loads(r.stdout[r.stdout.index("{"):])
        except ValueError:
            info = {}
        warnings = info.get("warnings", ["<unparseable>"])
        measurements["stages"]["validate"] = {
            "duration_sec": info.get("duration_sec"),
            "scene_count": info.get("scene_count"),
            "sound_events": info.get("sound_events"),
            "warnings": warnings,
        }
        if warnings:
            log(f"GATE FAILED: validate warnings {warnings}")
            _append_log(proj, log_lines)
            return 2
        log(f"validate OK — {info.get('duration_sec')}s, {info.get('scene_count')} scenes, "
            f"{info.get('sound_events')} sound events, warnings []")

    # ---------------------------------------------------------- B/C stills
    if stage("stills"):
        for label, w, h in (("9x16", 1080, 1920), ("16x9", 1920, 1080)):
            out = proj / "assets" / f"stills_{label}"
            out.mkdir(parents=True, exist_ok=True)
            log(f"STAGE B/C — stills {label}")
            r = run([py, str(STUDIO), "stills", str(spec), "--out-dir", str(out),
                     "--width", str(w), "--height", str(h)], REPO_ROOT, log)
            n = len(list(out.glob("*.png")))
            measurements["stages"].setdefault("stills", {})[label] = n
            if r.returncode != 0 or n == 0:
                log(f"GATE FAILED: stills {label} produced nothing")
                _append_log(proj, log_lines)
                return 2
            log(f"stills {label}: {n} frames in {out.relative_to(proj)}")

    # ---------------------------------------------------------- D draft
    if stage("draft"):
        draft = proj / "renders" / "draft_9x16.mp4"
        log("STAGE D — draft render 9:16")
        r = run([py, str(STUDIO), "render", str(spec), "--shorts", "--draft",
                 "--voice", "auto", "--workers", str(args.workers),
                 "--chunk-sec", "20", "--out", str(draft)], REPO_ROOT, log)
        if r.returncode == 3:
            log("GATE FAILED: COMPLETE_SILENT — no voice backend produced speech")
            _append_log(proj, log_lines)
            return 3
        if r.returncode != 0 or not draft.exists():
            log("GATE FAILED: draft render did not produce a file")
            _append_log(proj, log_lines)
            return 2
        measurements["stages"]["draft"] = {"path": str(draft.relative_to(proj)),
                                           "bytes": draft.stat().st_size}
        log(f"draft OK — {draft.stat().st_size/1e6:.1f} MB")

    # ---------------------------------------------------------- E/F masters
    final = proj / "final.mp4"
    if stage("master"):
        log("STAGE E — master 9:16 (final.mp4)")
        r = run([py, str(STUDIO), "render", str(spec), "--shorts", "--full",
                 "--preset", args.preset, "--crf", str(args.crf),
                 "--chunk-sec", str(args.chunk_sec), "--workers", str(args.workers),
                 "--resume", "--voice", "auto", "--out", str(final)], REPO_ROOT, log)
        if r.returncode == 3:
            log("GATE FAILED: COMPLETE_SILENT on master")
            _append_log(proj, log_lines)
            return 3
        if r.returncode != 0 or not final.exists():
            log("GATE FAILED: master 9:16 missing")
            _append_log(proj, log_lines)
            return 2
        # KI-007 gate: the encoded pixels must agree with the declared aspect. The validation
        # report is the authority; never trust the request flags.
        measurements["stages"].setdefault("master", {})
        vrep = final.with_name(f"{final.stem}_validation_report.json")
        if vrep.exists():
            vd = json.loads(vrep.read_text(encoding="utf-8"))
            measurements["stages"]["master"]["validation"] = {
                "valid": vd.get("valid"),
                "dimensions": vd.get("dimensions"),
                "aspect_ratio": vd.get("aspect_ratio"),
                "dimensions_match_aspect": vd.get("dimensions_match_aspect"),
                "voice_backend": vd.get("voice_backend"),
            }
            if not vd.get("valid") or vd.get("dimensions_match_aspect") is False:
                log(f"GATE FAILED: master validation report invalid: {vd.get('dimensions')} "
                    f"vs {vd.get('aspect_ratio')} — {vd.get('warnings')}")
                _append_log(proj, log_lines)
                return 2
            log(f"master validation OK: {vd.get('dimensions')} @ {vd.get('aspect_ratio')}, "
                f"voice_backend={vd.get('voice_backend')}")
        else:
            log(f"WARNING: no validation report at {vrep}")
        wide = proj / "renders" / "final_16x9.mp4"
        log("STAGE F — master 16:9")
        r2 = run([py, str(STUDIO), "render", str(spec), "--aspect-ratio", "16:9", "--full",
                  "--preset", args.preset, "--crf", str(args.crf),
                  "--chunk-sec", str(args.chunk_sec), "--workers", str(args.workers),
                  "--resume", "--voice", "auto", "--out", str(wide)], REPO_ROOT, log)
        measurements["stages"]["master"] = {
            "9x16": {"path": "final.mp4", "bytes": final.stat().st_size},
            "16x9": ({"path": "renders/final_16x9.mp4", "bytes": wide.stat().st_size}
                     if wide.exists() else None),
            "wide_ok": r2.returncode == 0 and wide.exists(),
        }
        log(f"master 9:16 OK — {final.stat().st_size/1e6:.1f} MB; 16:9 ok={r2.returncode == 0}")

    # ---------------------------------------------------------- G measure
    if stage("measure"):
        log("STAGE G — measure mixed audio")
        # The mix lives beside the master it belongs to: runtime/renders/.work_<stem>/ for renders written
        # into runtime/renders/, or <project>/.work_<stem>/ for project-local masters (the normal case now).
        wav_candidates = [final.parent / f".work_{final.stem}" / "master_audio.wav"]
        wav_candidates += sorted((REPO_ROOT / "output").glob(f".work_{final.stem}/master_audio.wav"))
        wav_candidates += sorted(final.parent.glob(".work_*/master_audio.wav"))
        wav_candidates = [w for w in wav_candidates if w.exists()]
        m = {}
        if wav_candidates:
            wav = wav_candidates[-1]
            with wave.open(str(wav), "rb") as w:
                frames = w.readframes(w.getnframes())
                n, rate, sw = w.getnframes(), w.getframerate(), w.getsampwidth()
            peak = _peak_db(frames, sw)
            rms = _rms_db(frames, sw)
            m = {"wav": str(wav), "channels": _channels(wav), "rate": rate,
                 "duration_sec": round(n / rate, 2), "peak_dbfs": peak, "rms_dbfs": rms,
                 "peak_in_target": -3.0 <= peak <= -1.0,
                 "rms_in_target": -19.0 <= rms <= -16.0}
            shutil.copy(wav, proj / "audio" / "master_audio.wav")
            log(f"audio: {m['duration_sec']}s peak {peak} dBFS rms {rms} dBFS "
                f"(targets peak -3..-1, rms -16..-19)")
        else:
            log("WARNING: no mixed WAV found to measure")
        measurements["stages"]["measure"] = m

    # ---------------------------------------------------------- H frames
    if stage("frames"):
        log("STAGE H — extract QA frames from final.mp4")
        if not final.exists():
            log("skip frames: final.mp4 absent")
        else:
            dur = _duration(ff, final)
            qadir = proj / "assets" / "qa_frames"
            times = [round(dur * f, 2) for f in (0.04, 0.16, 0.30, 0.45, 0.60, 0.75, 0.88, 0.97)]
            paths = []
            for t in times:
                out = qadir / f"t{t:06.2f}.png"
                run([ff, "-v", "error", "-ss", str(t), "-i", str(final),
                     "-frames:v", "1", "-y", str(out)], REPO_ROOT, log)
                if out.exists():
                    paths.append(str(out.relative_to(proj)))
            measurements["stages"]["frames"] = {"times": times, "paths": paths,
                                                "duration_sec": dur}
            log(f"extracted {len(paths)} QA frames over {dur}s")

    # ---------------------------------------------------------- I verify
    if stage("verify"):
        log("STAGE I — verify container + full decode")
        v = {}
        if final.exists():
            probe = run([ff, "-hide_banner", "-i", str(final)], REPO_ROOT, log)
            meta = probe.stderr
            v["probe_lines"] = [l.strip() for l in meta.splitlines()
                                if "Duration" in l or "Stream" in l]
            dec = run([ff, "-v", "error", "-i", str(final), "-f", "null", "-"], REPO_ROOT, log)
            v["full_decode_ok"] = dec.returncode == 0
            v["dimensions"], v["fps"] = _dims_fps(meta)
            log(f"verify: {v.get('dimensions')} @ {v.get('fps')} fps, "
                f"full_decode_ok={v['full_decode_ok']}")
        measurements["stages"]["verify"] = v

    (proj / "qa_measurements.json").write_text(json.dumps(measurements, indent=2),
                                               encoding="utf-8")
    _append_log(proj, log_lines)
    print("\nSUMMARY " + json.dumps({k: (list(v) if isinstance(v, dict) else v)
                                    for k, v in measurements["stages"].items()}))
    return 0


def _channels(wav: Path) -> int:
    with wave.open(str(wav), "rb") as w:
        return w.getnchannels()


def _peak_db(frames: bytes, sampwidth: int) -> float:
    import audioop
    return round(20 * math.log10(audioop.max(frames, sampwidth) / 32768.0), 2)


def _rms_db(frames: bytes, sampwidth: int) -> float:
    import audioop
    return round(20 * math.log10(max(audioop.rms(frames, sampwidth), 1) / 32768.0), 2)


def _duration(ff: str, path: Path) -> float:
    r = subprocess.run([ff, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    for line in r.stderr.splitlines():
        if "Duration" in line:
            h, m, s = line.split("Duration:")[1].split(",")[0].strip().split(":")
            return round(int(h) * 3600 + int(m) * 60 + float(s), 2)
    return 0.0


def _dims_fps(meta: str):
    import re
    dims = re.search(r"(\d{3,4})x(\d{3,4})", meta)
    fps = re.search(r"(\d+(?:\.\d+)?)\s*fps", meta)
    return (f"{dims.group(1)}x{dims.group(2)}" if dims else None,
            fps.group(1) if fps else None)


def _append_log(proj: Path, lines: list[str]) -> None:
    path = proj / "PRODUCTION_LOG.md"
    header = ""
    if not path.exists():
        header = f"# PRODUCTION LOG — {proj.name}\n\nAppended run records, newest last.\n\n"
    with path.open("a", encoding="utf-8") as f:
        f.write(header + "## Run " + time.strftime("%Y-%m-%d %H:%M:%S") + "\n\n```\n")
        f.write("\n".join(lines))
        f.write("\n```\n\n")


if __name__ == "__main__":
    sys.exit(main())
