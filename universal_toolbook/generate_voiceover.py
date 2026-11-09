#!/usr/bin/env python3
"""Generate self-hosted voiceover audio from an approved script.

THE single documented generation command for the TTS workflow:

    python3 universal_toolbook/generate_voiceover.py \
        --input script.txt --voice af_bella --out output/tts/my_video

Inputs
  --input X.txt     plain approved script text (auto sentence/paragraph split)
  --input X.json    scene file: {"scenes": [{"id": "S01", "text": "..."}]}
                    (also accepts "narration" or dialogue arrays as text source)

Engines (pluggable)
  --engine kokoro|piper|edge   default from tts/config/voices.json
  --voice NAME                 voice id or pipeline alias (see --voices)
  --speed 1.0                  1.0 = natural; >1.0 faster
  --language en-us

Outputs (per job directory, default output/tts/<input-stem>)
  manifest.json                 job metadata + per-segment status (resumable)
  segments/seg-NNN.wav|.mp3     raw engine output (originals, never modified)
  final/seg-NNN.wav|.mp3        processed: resampled, normalized, peak-limited
  final/full.wav|.mp3           concatenated with configured pauses

Resumability: existing valid segments are kept (verified, not just present);
failed segments are retried; one failure never regenerates the rest.
--force regenerates everything. Exit codes: 0 ok, 2 some failures, 1 fatal.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

# make the package importable both as `python3 universal_toolbook/generate_voiceover.py`
# and when the CWD is the repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tts import TTSError, EngineUnavailable, available_engines, get_engine, load_config  # noqa: E402
from tts import audio as A  # noqa: E402
from tts import manifest as M  # noqa: E402
from tts import segment as S  # noqa: E402


def log(msg: str) -> None:
    print(msg, flush=True)


def die(msg: str, code: int = 1) -> None:
    log(f"ERROR: {msg}")
    sys.exit(code)


def load_input(path: Path) -> tuple[str, list[dict] | None, str]:
    """Return (full_text, scenes_or_None, input_label)."""
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        scenes = data.get("scenes")
        if not isinstance(scenes, list) or not scenes:
            die(f"{path}: no non-empty 'scenes' list found")
        out = []
        for i, sc in enumerate(scenes):
            sid = str(sc.get("id") or f"S{i+1:02d}")
            text = str(sc.get("text") or sc.get("narration") or "").strip()
            if not text and isinstance(sc.get("dialogue"), list):
                text = " ".join(str(d.get("text") or "").strip() for d in sc["dialogue"]).strip()
            if not text:
                continue
            out.append({"id": sid, "text": text})
        full = "\n\n".join(f"{x['id']}: {x['text']}" for x in out)
        return full, out, f"scenes:{len(out)}"
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        die(f"{path}: empty input")
    return text, None, "text"


def build_segments(args, text: str, scenes: list[dict] | None, cfg: dict) -> list[S.Segment]:
    seg_cfg = cfg.get("segmentation", {})
    dictionary = S.load_dictionary(args.dictionary)
    if scenes is not None:
        segs = []
        for ci, sc in enumerate(scenes):
            g = S.split_text(sc["text"], scene_id=sc["id"],
                             paragraph_pause_s=seg_cfg.get("paragraph_pause_s", 0.6),
                             sentence_pause_s=seg_cfg.get("sentence_pause_s", 0.25),
                             max_segment_chars=seg_cfg.get("max_segment_chars", 220))[0]
            g.index = ci  # scene position -> unique segment ids
            g.tts_text, g.dictionary_changes = S.apply_dictionary(sc["text"], dictionary)
            segs.append(g)
        return segs
    return _apply_dict(
        S.split_text(
            text,
            paragraph_pause_s=seg_cfg.get("paragraph_pause_s", 0.6),
            sentence_pause_s=seg_cfg.get("sentence_pause_s", 0.25),
            max_segment_chars=seg_cfg.get("max_segment_chars", 220),
            min_segment_chars=seg_cfg.get("min_segment_chars", 2),
        ),
        dictionary,
    )


def _apply_dict(segs: list[S.Segment], dictionary: dict) -> list[S.Segment]:
    for g in segs:
        g.tts_text, g.dictionary_changes = S.apply_dictionary(g.text, dictionary)
    return segs


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", required=True, help="approved script: .txt or scenes .json")
    ap.add_argument("--engine", default=None, help="kokoro | piper | edge (default: config)")
    ap.add_argument("--voice", default=None, help="voice id or alias (default: engine config)")
    ap.add_argument("--speed", type=float, default=None)
    ap.add_argument("--language", default=None)
    ap.add_argument("--out", default=None, help="job directory (default output/tts/<input-stem>)")
    ap.add_argument("--dictionary", default=str(Path(__file__).resolve().parent / "tts/config/pronunciation_dictionary.json"))
    ap.add_argument("--formats", default="wav,mp3", help="comma list: wav,mp3 (mp3 needs ffmpeg)")
    ap.add_argument("--no-process", action="store_true", help="skip resample/normalize/limit")
    ap.add_argument("--force", action="store_true", help="regenerate all segments, ignore cache")
    ap.add_argument("--fail-fast", action="store_true", help="stop on first failed segment")
    ap.add_argument("--voices", action="store_true", help="list voices for the engine and exit")
    args = ap.parse_args()

    cfg = load_config()
    engines = cfg.get("engines", {})
    engine_name = (args.engine or cfg.get("default_engine", "kokoro")).lower()
    if engine_name not in engines:
        die(f"unknown engine '{engine_name}'. Known: {', '.join(sorted(engines))}")
    ecfg = engines[engine_name]
    voice = args.voice or ecfg.get("defaults", {}).get("voice")
    speed = args.speed if args.speed is not None else float(ecfg.get("defaults", {}).get("speed", 1.0))
    language = args.language or ecfg.get("defaults", {}).get("language", "en-us")
    proc_cfg = cfg.get("processing", {})
    do_formats = {f.strip().lower() for f in args.formats.split(",") if f.strip()}
    repo_root = Path(__file__).resolve().parents[1]

    if args.voices:
        try:
            eng = get_engine(engine_name)
            log(f"{engine_name} voices: {', '.join(eng.voices())}")
            log(f"aliases: {json.dumps(ecfg.get('aliases', {}), indent=2)}")
        except TTSError as e:
            die(str(e))
        return

    text, scenes, label = load_input(Path(args.input).expanduser())
    segs = build_segments(args, text, scenes, cfg)
    if not segs:
        die("no segments produced from input")

    out_dir = Path(args.out).expanduser() if args.out else repo_root / "output/tts" / Path(args.input).stem
    out_dir = out_dir if out_dir.is_absolute() else repo_root / out_dir
    (out_dir / "segments").mkdir(parents=True, exist_ok=True)
    (out_dir / "final").mkdir(parents=True, exist_ok=True)

    text_sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    jid = M.job_id_for(engine_name, voice, speed, language, text,
                       {"scene_mode": scenes is not None})

    # load engine (loud, single clear failure)
    try:
        eng = get_engine(engine_name)
    except EngineUnavailable as e:
        die(str(e))

    # manifest: resume a compatible previous job, else start fresh
    existing = M.load_manifest(out_dir)
    compatible = bool(
        existing and not args.force
        and existing.engine == engine_name
        and existing.voice == voice
        and abs(existing.speed - speed) < 1e-6
        and existing.language == language
        and existing.text_sha256 == text_sha
        and len(existing.segments) == len(segs)
    )
    if compatible:
        manifest = existing
        for s, g in zip(manifest.segments, segs):
            s.text, s.tts_text = g.text, g.tts_text
            s.scene_id, s.dictionary_changes = g.scene_id, g.dictionary_changes
            # a changed tts_text (e.g. dictionary edit) invalidates cached audio
            # via the signature check in segment_is_reusable()
    else:
        manifest = M.Manifest(
            job_id=jid, out_dir=str(out_dir), engine=engine_name, voice=voice,
            speed=speed, language=language,
            segments=[M.SegmentState(
                segment_id=f"seg-{g.index:03d}", text=g.text, tts_text=g.tts_text,
                audio_file=f"segments/seg-{g.index:03d}.wav",
                scene_id=g.scene_id,
                dictionary_changes=g.dictionary_changes,
            ) for g in segs],
            text_sha256=text_sha,
            engine_version=eng.engine_version(),
            model=os.environ.get("TTS_MODEL_DIR", "cache/tts") if engine_name == "kokoro" else "",
            processing={"enabled": not args.no_process,
                        **{k: v for k, v in proc_cfg.items() if not k.startswith("_")}},
        )
        manifest.save()
        if args.force:
            for f in (out_dir / "segments").glob("*"):
                f.unlink(missing_ok=True)
            for f in (out_dir / "final").glob("*"):
                f.unlink(missing_ok=True)

    pause_by_idx = {g.index: g.pause_after for g in segs}

    # ---------------- synthesis loop ----------------
    t_start = time.time()
    n_ok = n_fail = n_skip = 0
    for i, s in enumerate(manifest.segments, 1):
        g_idx = _seg_index(s)
        sig = manifest._signature(s)
        if not args.force and manifest.segment_is_reusable(s):
            log(f"[{i}/{len(manifest.segments)}] {s.segment_id} kept (cached, {s.duration_seconds:.2f}s)")
            n_skip += 1
            continue
        s.status = "pending"
        s.signature = sig
        s.started = _now()
        log(f"[{i}/{len(manifest.segments)}] {s.segment_id} synthesizing ({len(s.tts_text)} chars) ...")
        t0 = time.time()
        try:
            res = eng.synthesize(s.tts_text, voice, speed=speed, language=language)
            wav_path = out_dir / s.audio_file
            A.write_wav(wav_path, res.audio, res.sample_rate)
            if "mp3" in do_formats:
                try:
                    A.encode_mp3(wav_path, wav_path.with_suffix(".mp3"),
                                  proc_cfg.get("mp3_bitrate_kbps", 192))
                    s.mp3_file = s.audio_file.replace(".wav", ".mp3")
                except Exception:
                    s.mp3_file = ""
            s.status = "ok"
            s.duration_seconds = round(res.duration, 3)
            s.attempts += 1
            s.error = None
            s.finished = _now()
            manifest.save()
            n_ok += 1
            log(f"    ok  {s.duration_seconds:.2f}s audio in {time.time()-t0:.1f}s "
                f"(RTF { (time.time()-t0)/max(res.duration,1e-6):.2f})")
        except Exception as e:
            s.status = "failed"
            s.error = f"{type(e).__name__}: {e}"[:300]
            s.attempts += 1
            s.finished = _now()
            manifest.save()
            n_fail += 1
            log(f"    FAILED: {s.error}")
            if args.fail_fast:
                log("stopping (--fail-fast)")
                sys.exit(2)

    # ---------------- processing + concatenation ----------------
    ok_segs = [s for s in manifest.segments if s.status == "ok"]
    if not ok_segs:
        log(f"\nNo audio produced. {n_fail} segment(s) failed. See manifest: {manifest.path}")
        sys.exit(2)

    processed_paths = []
    if not args.no_process:
        for s in ok_segs:
            raw = out_dir / s.audio_file
            final_wav = out_dir / "final" / f"{s.segment_id}.wav"
            an, steps = A.process_audio(
                raw, final_wav,
                resample_rate=proc_cfg.get("resample_rate"),
                normalize_peak_dbfs=proc_cfg.get("normalize_peak_dbfs"),
                normalize_rms_dbfs=proc_cfg.get("normalize_rms_dbfs"),
                limit_dbfs=proc_cfg.get("limit_dbfs"),
            )
            if not an.ok:
                log(f"  warning: processed {s.segment_id} has issues: {an.errors}")
            if "mp3" in do_formats:
                try:
                    A.encode_mp3(final_wav, final_wav.with_suffix(".mp3"),
                                  proc_cfg.get("mp3_bitrate_kbps", 192))
                except Exception:
                    pass
            processed_paths.append((s, final_wav))
        use_paths = [p for _, p in processed_paths]
        concat_note = "processed (resampled/normalized/limited)"
    else:
        use_paths = [out_dir / s.audio_file for s in ok_segs]
        concat_note = "raw engine output"

    full_wav = out_dir / "final" / "full.wav"
    full_wav, full_dur = _concat(use_paths, [pause_by_idx.get(_seg_index(s), 0.0) for s in ok_segs], full_wav)
    full_mp3 = ""
    if "mp3" in do_formats:
        try:
            A.encode_mp3(full_wav, full_wav.with_suffix(".mp3"), proc_cfg.get("mp3_bitrate_kbps", 192))
            full_mp3 = str(full_wav.with_suffix(".mp3"))
        except Exception as e:
            log(f"  warning: mp3 encode failed: {e}")

    manifest.final = {
        "wav": "final/full.wav",
        "mp3": "final/full.mp3" if full_mp3 else "",
        "duration_seconds": round(full_dur, 3),
        "note": concat_note,
    }
    manifest.save()

    # ---------------- summary ----------------
    log("\n" + "=" * 64)
    log(f"VOICEOVER COMPLETE  ({n_ok} generated, {n_skip} cached, {n_fail} failed)")
    log(f"  engine    : {manifest.engine} / {manifest.engine_version}")
    log(f"  voice     : {manifest.voice}  speed {manifest.speed}  lang {manifest.language}")
    log(f"  job id    : {manifest.job_id}")
    log(f"  manifest  : {manifest.path}")
    log(f"  final     : {full_wav}  ({full_dur:.2f}s, {concat_note})")
    if full_mp3:
        log(f"              {full_mp3}")
    log(f"  segments  : {out_dir}/segments/   (raw originals)")
    log(f"  processed : {out_dir}/final/seg-*.wav")
    if n_fail:
        log(f"  RETRY     : re-run the same command — only failed segments regenerate")
    log("=" * 64)
    sys.exit(2 if n_fail else 0)


def _seg_index(s) -> int:
    return int(s.segment_id.split("-")[1])


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _concat(wavs: list[Path], pauses: list[float], out: Path) -> tuple[Path, float]:
    """Concatenate WAVs (any rates) with silence pauses in between."""
    pieces: list[tuple[np.ndarray, int]] = []
    for w in wavs:
        arr, sr = A.read_wav(w)
        pieces.append((arr, sr))
    if not pieces:
        raise ValueError("nothing to concatenate")
    target_sr = max(sr for _, sr in pieces)
    parts: list[np.ndarray] = []
    for i, (arr, sr) in enumerate(pieces):
        if sr != target_sr:
            arr = A.resample(arr, sr, target_sr)
        parts.append(arr)
        if i < len(pieces) - 1 and pauses[i] > 0:
            parts.append(np.zeros(int(pauses[i] * target_sr), dtype=np.float32))
    full = np.concatenate(parts)
    A.write_wav(out, full, target_sr)
    return out, len(full) / target_sr


if __name__ == "__main__":
    main()
