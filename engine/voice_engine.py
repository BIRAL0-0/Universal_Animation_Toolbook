#!/usr/bin/env python3
"""
Multi-Speaker Neural Voiceover, Internal Silence Compactor, Exact Word-Level Timestamp Sync,
Speech-Locked Visual Boards & Speech-Locked Camera Cuts Engine (v3).

Supports:
  1. Multi-speaker `scene.dialogue` arrays with distinct neural voices & crisp conversational pacing
  2. Internal TTS dead-air compactor (`compact_internal_silences_with_words`) that eliminates sluggish mid-sentence TTS gaps while keeping `WordBoundary` timestamps 100% locked
  3. Exact post-reveal `cue_on` / `hide_on` speech-locked timing for `board` / `boards` AND `camera_shots`
  4. Classic single-string `scene.narration`, external `--voice-dir`, or offline OS TTS fallback
"""

from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import re
import shutil
import struct
import subprocess
import wave
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

SAMPLE_RATE = 44100

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
    "of", "by", "is", "it", "be", "as", "so", "we", "he", "she", "you", "they",
    "his", "her", "our", "not", "no", "one", "two", "was", "are", "had", "has",
    "have", "that", "this", "with", "from", "just", "when", "what", "who", "how",
}


def get_ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError(
            "FFmpeg binary not found on PATH and imageio-ffmpeg is unavailable."
        ) from exc


def wav_duration_seconds(wav_path: Path) -> float:
    with wave.open(str(wav_path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(max(1, rate))


def trim_leading_trailing_silence_ex(wav_path: Path, threshold: int = 240) -> Tuple[float, float]:
    """Trim leading/trailing silence and return `(trimmed_duration_sec, leading_trimmed_sec)`."""
    with wave.open(str(wav_path), "rb") as wf:
        params = wf.getparams()
        raw = wf.readframes(params.nframes)

    if params.sampwidth != 2 or len(raw) < 4:
        return wav_duration_seconds(wav_path), 0.0

    count = len(raw) // 2
    samples = struct.unpack(f"<{count}h", raw)
    sr = params.framerate

    start_idx = 0
    while start_idx < count and abs(samples[start_idx]) < threshold:
        start_idx += 1
    end_idx = count - 1
    while end_idx > start_idx and abs(samples[end_idx]) < threshold:
        end_idx -= 1

    pad = int(0.030 * sr)
    start_idx = max(0, start_idx - pad)
    end_idx = min(count, end_idx + pad)
    trimmed = samples[start_idx:end_idx]
    if len(trimmed) < int(0.10 * sr):
        return wav_duration_seconds(wav_path), 0.0

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{len(trimmed)}h", *trimmed))

    return len(trimmed) / float(sr), start_idx / float(sr)


def trim_leading_trailing_silence(wav_path: Path, threshold: int = 240) -> float:
    dur, _ = trim_leading_trailing_silence_ex(wav_path, threshold=threshold)
    return dur


def compact_internal_silences_with_words(
    wav_path: Path,
    words: List[Dict[str, Any]],
    max_silence_sec: float = 0.32,
    target_silence_sec: float = 0.22,
    threshold: int = 220,
) -> Tuple[float, List[Dict[str, Any]]]:
    """
    Eliminate sluggish internal TTS pauses (> `max_silence_sec`) inside a synthesized clip
    by compacting them to `target_silence_sec` while shifting subsequent `WordBoundary` offsets
    by the exact removed sample delta!
    """
    with wave.open(str(wav_path), "rb") as wf:
        params = wf.getparams()
        raw = wf.readframes(params.nframes)

    if params.sampwidth != 2 or len(raw) < 4:
        return wav_duration_seconds(wav_path), words

    sr = params.framerate
    count = len(raw) // 2
    samples = list(struct.unpack(f"<{count}h", raw))

    win = max(1, int(0.010 * sr))  # 10ms energy blocks
    n_blocks = count // win
    if n_blocks < 10:
        return count / float(sr), words

    silent_flags = []
    for b in range(n_blocks):
        chunk = samples[b * win : (b + 1) * win]
        peak = max(abs(chunk[0]), abs(chunk[len(chunk) // 2]), max(abs(v) for v in chunk[::4]))
        silent_flags.append(peak < threshold)

    max_blocks = int(round(max_silence_sec / 0.010))
    keep_blocks = int(round(target_silence_sec / 0.010))

    # Identify internal silent runs `[b0, b1)` strictly inside `(2, n_blocks - 2)` exceeding `max_blocks`
    cuts: List[Tuple[int, int]] = []  # sample ranges `[cut_start_sample, cut_end_sample)` to excise
    b = 2
    while b < n_blocks - 2:
        if not silent_flags[b]:
            b += 1
            continue
        b_end = b
        while b_end < n_blocks - 2 and silent_flags[b_end]:
            b_end += 1
        run_len = b_end - b
        if run_len > max_blocks and keep_blocks < run_len:
            keep_half = keep_blocks // 2
            c0 = (b + keep_half) * win
            c1 = (b_end - (keep_blocks - keep_half)) * win
            if c1 > c0:
                cuts.append((c0, c1))
        b = b_end

    if not cuts:
        return count / float(sr), words

    out_samples: List[int] = []
    prev_s = 0
    # Track cumulative removed time `(orig_sec_cut_end, cumulative_removed_sec)`
    shifts: List[Tuple[float, float]] = []
    removed_samples = 0

    for c0, c1 in cuts:
        out_samples.extend(samples[prev_s:c0])
        removed_samples += (c1 - c0)
        shifts.append((c1 / float(sr), removed_samples / float(sr)))
        prev_s = c1
    out_samples.extend(samples[prev_s:])

    with wave.open(str(wav_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{len(out_samples)}h", *out_samples))

    new_dur = len(out_samples) / float(sr)

    def _map_time(t_orig: float) -> float:
        delta = 0.0
        for (c0, c1) in cuts:
            t0 = c0 / float(sr)
            t1 = c1 / float(sr)
            if t_orig >= t1:
                delta += (t1 - t0)
            elif t_orig > t0:
                delta += (t_orig - t0)
        return max(0.0, t_orig - delta)

    updated_words: List[Dict[str, Any]] = []
    for w in words:
        ws = round(_map_time(float(w["start"])), 3)
        we = round(min(new_dur, max(ws + 0.04, _map_time(float(w["end"])))), 3)
        updated_words.append({**w, "start": ws, "end": we})

    return new_dur, updated_words


def convert_to_mono_wav_ex(src_path: Path, dst_wav: Path, sample_rate: int = SAMPLE_RATE) -> Tuple[float, float]:
    ffmpeg = get_ffmpeg_exe()
    dst_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg,
        "-y",
        "-i", str(src_path),
        "-ac", "1",
        "-ar", str(sample_rate),
        "-sample_fmt", "s16",
        str(dst_wav),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return trim_leading_trailing_silence_ex(dst_wav)


def convert_to_mono_wav(src_path: Path, dst_wav: Path, sample_rate: int = SAMPLE_RATE) -> float:
    dur, _ = convert_to_mono_wav_ex(src_path, dst_wav, sample_rate=sample_rate)
    return dur


def _fallback_proportional_words(text: str, dur: float) -> List[Dict[str, Any]]:
    tokens = [t for t in re.split(r"\s+", text.strip()) if t]
    if not tokens or dur <= 0.02:
        return []
    weights = [max(1.5, len(re.sub(r"[^A-Za-z0-9]", "", t)) + (1.6 if re.search(r"[,.;:!?—-]$", t) else 0.0)) for t in tokens]
    total_w = sum(weights) or 1.0
    out: List[Dict[str, Any]] = []
    cur = 0.0
    for tok, w in zip(tokens, weights):
        span = (w / total_w) * dur
        out.append({
            "word": tok,
            "start": round(cur, 3),
            "end": round(min(dur, cur + span * 0.96), 3),
        })
        cur += span
    return out


async def _edge_tts_to_file(
    text: str, voice: str, rate: str, pitch: str, out_mp3: Path
) -> List[Dict[str, Any]]:
    import edge_tts

    kwargs: Dict[str, Any] = {
        "text": text,
        "voice": voice,
        "rate": rate,
        "boundary": "WordBoundary",
    }
    if pitch and pitch != "+0Hz":
        kwargs["pitch"] = pitch

    comm = edge_tts.Communicate(**kwargs)
    audio_chunks: List[bytes] = []
    word_events: List[Dict[str, Any]] = []

    async for chunk in comm.stream():
        ctype = chunk.get("type")
        if ctype == "audio":
            audio_chunks.append(chunk["data"])
        elif ctype == "WordBoundary":
            off_sec = float(chunk.get("offset", 0)) / 1e7
            dur_sec = max(0.04, float(chunk.get("duration", 0)) / 1e7)
            w_txt = str(chunk.get("text") or "").strip()
            if w_txt:
                word_events.append({
                    "word": w_txt,
                    "start": off_sec,
                    "end": off_sec + dur_sec,
                })

    out_mp3.parent.mkdir(parents=True, exist_ok=True)
    out_mp3.write_bytes(b"".join(audio_chunks))
    return word_events


async def _batch_synthesize_lines(jobs: List[Dict[str, Any]], concurrency: int = 5) -> None:
    sem = asyncio.Semaphore(concurrency)

    async def _worker(job: Dict[str, Any]) -> None:
        out_wav: Path = job["wav"]
        meta_txt: Path = job["meta"]
        words_json: Path = out_wav.with_suffix(".words.json")
        sig: str = job["sig"]
        if (
            out_wav.exists()
            and meta_txt.exists()
            and words_json.exists()
            and meta_txt.read_text(encoding="utf-8") == sig
        ):
            job["ok"] = True
            job["dur"] = wav_duration_seconds(out_wav)
            try:
                job["words"] = json.loads(words_json.read_text(encoding="utf-8"))
            except Exception:
                job["words"] = _fallback_proportional_words(job["text"], job["dur"])
            return

        tmp_mp3 = out_wav.with_suffix(".mp3")
        async with sem:
            for attempt in range(2):
                try:
                    raw_words = await _edge_tts_to_file(
                        job["text"], job["voice"], job["rate"], job["pitch"], tmp_mp3
                    )
                    if tmp_mp3.exists() and tmp_mp3.stat().st_size >= 256:
                        dur, lead_trim = convert_to_mono_wav_ex(tmp_mp3, out_wav)
                        tmp_mp3.unlink(missing_ok=True)
                        adjusted_words: List[Dict[str, Any]] = []
                        for w in raw_words:
                            ws = max(0.0, round(float(w["start"]) - lead_trim, 3))
                            we = min(round(dur, 3), max(round(ws + 0.04, 3), round(float(w["end"]) - lead_trim, 3)))
                            adjusted_words.append({"word": w["word"], "start": ws, "end": we})
                        if not adjusted_words:
                            adjusted_words = _fallback_proportional_words(job["text"], dur)
                        # Compact sluggish internal mid-clip TTS pauses while keeping WordBoundary sync exact!
                        dur, adjusted_words = compact_internal_silences_with_words(out_wav, adjusted_words)
                        meta_txt.write_text(sig, encoding="utf-8")
                        words_json.write_text(json.dumps(adjusted_words), encoding="utf-8")
                        job["ok"] = True
                        job["dur"] = dur
                        job["words"] = adjusted_words
                        return
                except Exception:
                    tmp_mp3.unlink(missing_ok=True)
                    if attempt == 0:
                        await asyncio.sleep(0.4)
        job["ok"] = False

    await asyncio.gather(*(_worker(j) for j in jobs))


def try_synthesize_os_tts(text: str, out_wav: Path) -> Optional[float]:
    espeak = shutil.which("espeak-ng") or shutil.which("espeak")
    if espeak:
        tmp_wav = out_wav.with_suffix(".raw.wav")
        try:
            subprocess.run(
                [espeak, "-s", "168", "-w", str(tmp_wav), text],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            dur = convert_to_mono_wav(tmp_wav, out_wav)
            tmp_wav.unlink(missing_ok=True)
            return dur
        except Exception:
            tmp_wav.unlink(missing_ok=True)
    return None


def scale_scene_choreography(scene: Dict[str, Any], old_dur: float, new_dur: float) -> None:
    """Proportionally scale character beat, camera shot, board & prop timestamps when retiming a scene."""
    if "visual_board" in scene and "board" not in scene:
        scene["board"] = scene.pop("visual_board")

    if old_dur <= 0.05 or abs(new_dur - old_dur) < 0.02:
        scene["duration"] = round(new_dur, 3)
        return
    ratio = new_dur / old_dur
    scene["duration"] = round(new_dur, 3)
    if not scene.get("lock_beats"):
        for ch in scene.get("characters", []):
            if isinstance(ch.get("beats"), list):
                for b in ch["beats"]:
                    if "start" in b:
                        b["start"] = round(float(b["start"]) * ratio, 3)
                    if "end" in b:
                        b["end"] = round(float(b["end"]) * ratio, 3)
    if isinstance(scene.get("camera_shots"), list) and not scene.get("lock_camera_shots"):
        for shot in scene["camera_shots"]:
            if "start" in shot:
                shot["start"] = round(float(shot["start"]) * ratio, 3)
            if "end" in shot:
                shot["end"] = round(float(shot["end"]) * ratio, 3)
    for pr in scene.get("props", []):
        for k in ("from_t", "to_t", "spin_after", "break_at", "sheet_reveal_at"):
            if k in pr:
                pr[k] = round(float(pr[k]) * ratio, 3)
    if isinstance(scene.get("sfx"), list):
        for sfx_ev in scene["sfx"]:
            if isinstance(sfx_ev, dict) and "at" in sfx_ev and not sfx_ev.get("lock_timing"):
                sfx_ev["at"] = round(float(sfx_ev["at"]) * ratio, 3)
    all_boards = []
    if isinstance(scene.get("board"), dict):
        all_boards.append(scene["board"])
    if isinstance(scene.get("boards"), list):
        all_boards.extend([b for b in scene["boards"] if isinstance(b, dict)])
    for bd in all_boards:
        if bd.get("lock_timing"):
            continue
        for k in ("reveal_at", "appear_at", "start_at", "hide_at", "disappear_at", "end_at"):
            if k in bd and bd[k] is not None:
                bd[k] = round(float(bd[k]) * ratio, 3)
    if isinstance(scene.get("intertitle"), dict) and "start_at" in scene["intertitle"]:
        scene["intertitle"]["start_at"] = round(float(scene["intertitle"]["start_at"]) * ratio, 3)


def _norm_token(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def _find_phrase_time(
    scene_words: List[Dict[str, Any]],
    phrase: str,
    use_end: bool = False,
    min_time: float = 0.0,
) -> Optional[float]:
    """
    Locate the exact timestamp of `phrase` in `scene_words` occurring at or after `min_time`.
    Never falls back to stopwords (e.g. 'the', 'no', 'we', 'two'), preventing premature board/camera triggers!
    """
    if not phrase or not scene_words:
        return None
    target = [_norm_token(tok) for tok in re.split(r"[\s—\-]+", phrase.strip()) if _norm_token(tok)]
    if not target:
        return None

    filtered = [w for w in scene_words if float(w.get("start", 0.0)) >= min_time - 0.05]
    if not filtered:
        return None

    norm_words = [_norm_token(w.get("word", "")) for w in filtered]
    n = len(target)

    # 1. Exact contiguous phrase match
    for i in range(0, len(norm_words) - n + 1):
        if all(norm_words[i + k] == target[k] or (len(target[k]) >= 4 and norm_words[i + k].startswith(target[k])) for k in range(n)):
            return float(filtered[i + n - 1]["end"] if use_end else filtered[i]["start"])

    # 2. Multi-token fuzzy sliding window (>= 66% token overlap for >= 2-word phrases)
    if n >= 2:
        win_len = min(len(norm_words), n + 1)
        best_score = 0.0
        best_span: Optional[Tuple[int, int]] = None
        for i in range(0, len(norm_words) - n + 1):
            sub = norm_words[i : i + win_len]
            hits = sum(1 for t in target if any(sw == t or (len(t) >= 4 and sw.startswith(t)) for sw in sub))
            score = hits / float(n)
            if score > best_score and score >= 0.66:
                best_score = score
                best_span = (i, min(len(filtered) - 1, i + n - 1))
        if best_span is not None:
            return float(filtered[best_span[1]]["end"] if use_end else filtered[best_span[0]]["start"])

    # 3. Safe content-word fallback ONLY on non-stopword tokens (>= 4 chars)
    content_toks = [t for t in target if t not in STOPWORDS and len(t) >= 4]
    for ct in content_toks:
        for i, nw in enumerate(norm_words):
            if nw == ct or (len(ct) >= 5 and nw.startswith(ct)):
                return float(filtered[i]["end"] if use_end else filtered[i]["start"])

    return None


def _align_single_board(
    bd: Dict[str, Any],
    scene_words: List[Dict[str, Any]],
    scene_dur: float,
) -> None:
    min_rev = float(bd.get("min_reveal_at", 0.0))
    if bd.get("cue_on"):
        hit = _find_phrase_time(scene_words, str(bd["cue_on"]), use_end=False, min_time=min_rev)
        if hit is not None:
            # Reveal right on the spoken word (tiny 0.03s anticipation so it never feels premature!)
            bd["reveal_at"] = round(max(0.15, hit - 0.03), 3)
            bd.pop("appear_at", None)

    rev_raw = bd.get("reveal_at")
    if rev_raw is None:
        rev_raw = bd.get("appear_at", 0.35)
    rev = float(rev_raw)

    if bd.get("hide_on"):
        # Anchor `hide_on` slightly BEFORE phrase start (`hit - 0.38s`) so boards fade out cleanly
        # before any close-up camera cut triggered on the same phrase!
        start_hit = _find_phrase_time(scene_words, str(bd["hide_on"]), use_end=False, min_time=rev + 0.35)
        if start_hit is not None and start_hit > rev + 0.8:
            bd["hide_at"] = round(min(scene_dur - 0.25, max(rev + 1.0, start_hit - 0.38)), 3)
        else:
            end_hit = _find_phrase_time(scene_words, str(bd["hide_on"]), use_end=True, min_time=rev + 0.35)
            if end_hit is not None and end_hit > rev + 0.6:
                bd["hide_at"] = round(min(scene_dur - 0.25, end_hit + 0.25), 3)
    if bd.get("hide_at") is None:
        if bd.get("hold_sec") is not None:
            bd["hide_at"] = round(min(scene_dur - 0.25, rev + float(bd["hold_sec"])), 3)
        elif not bd.get("persist"):
            build_dur = float(bd.get("build_dur", 2.6))
            auto_hold = max(4.8, build_dur + 3.4)
            if scene_dur > rev + auto_hold + 1.2:
                bd["hide_at"] = round(min(scene_dur - 0.30, rev + auto_hold), 3)

    if isinstance(bd.get("bars"), list):
        for bar in bd["bars"]:
            if isinstance(bar, dict) and bar.get("cue_on"):
                bhit = _find_phrase_time(scene_words, str(bar["cue_on"]), use_end=False, min_time=rev)
                if bhit is not None:
                    bar["at"] = round(max(rev, bhit - 0.04), 3)
    if isinstance(bd.get("item_cues"), list):
        item_ats: List[Optional[float]] = []
        for cue_phrase in bd["item_cues"]:
            ihit = _find_phrase_time(scene_words, str(cue_phrase), use_end=False, min_time=rev)
            item_ats.append(round(max(rev, ihit - 0.04), 3) if ihit is not None else None)
        bd["item_ats"] = item_ats


def align_scene_board_to_speech(
    scene: Dict[str, Any],
    scene_words: List[Dict[str, Any]],
    scene_dur: float,
) -> None:
    """Snap `board` and `boards` `reveal_at` / `hide_at` directly to spoken words."""
    if "visual_board" in scene and "board" not in scene:
        scene["board"] = scene.pop("visual_board")
    if isinstance(scene.get("board"), dict):
        _align_single_board(scene["board"], scene_words, scene_dur)
    if isinstance(scene.get("boards"), list):
        for bd in scene["boards"]:
            if isinstance(bd, dict):
                _align_single_board(bd, scene_words, scene_dur)
    for pr in scene.get("props", []):
        if isinstance(pr, dict) and pr.get("sheet_cue_on"):
            shit = _find_phrase_time(scene_words, str(pr["sheet_cue_on"]), use_end=False, min_time=0.0)
            if shit is not None:
                pr["sheet_reveal_at"] = round(max(0.1, shit - 0.05), 3)


def align_character_beats_to_speech(
    scene: Dict[str, Any],
    line_timings: List[Dict[str, Any]],
    scene_words: List[Dict[str, Any]],
    scene_dur: float,
) -> None:
    """
    Snap character beats that specify `sync_speaker_lines` (`[first_idx, last_idx]` among that actor's spoken lines)
    or `cue_on` / `end_on` directly to exact synthesized speech timestamps, chaining neighbor beats cleanly.
    """
    chars = scene.get("characters")
    if not isinstance(chars, list):
        return

    by_speaker: Dict[str, List[Dict[str, Any]]] = {}
    for lt in (line_timings or []):
        spk = str(lt.get("speaker") or "").lower()
        if spk:
            by_speaker.setdefault(spk, []).append(lt)

    for ch in chars:
        if not isinstance(ch, dict):
            continue
        actor_id = str(ch.get("id") or "").lower()
        beats = ch.get("beats")
        if not isinstance(beats, list) or not beats:
            continue
        actor_lines = by_speaker.get(actor_id, [])

        anchored: List[Tuple[int, Optional[float], Optional[float]]] = []
        for b_idx, b in enumerate(beats):
            if not isinstance(b, dict):
                anchored.append((b_idx, None, None))
                continue
            s_override: Optional[float] = None
            e_override: Optional[float] = None
            sync_spec = b.get("sync_speaker_lines")
            if sync_spec is not None and actor_lines:
                idxs = sync_spec if isinstance(sync_spec, list) else [int(sync_spec)]
                valid = [actor_lines[i] for i in idxs if 0 <= int(i) < len(actor_lines)]
                if valid:
                    s_override = max(0.0, float(valid[0]["start"]) - 0.06)
                    e_override = min(scene_dur, float(valid[-1]["end"]) + 0.08)
            if b.get("cue_on"):
                hit = _find_phrase_time(scene_words, str(b["cue_on"]), use_end=False, min_time=0.0)
                if hit is not None:
                    s_override = max(0.0, hit + float(b.get("cue_offset", -0.05)))
            if b.get("end_on"):
                ehit = _find_phrase_time(scene_words, str(b["end_on"]), use_end=True, min_time=s_override or 0.0)
                if ehit is not None:
                    e_override = min(scene_dur, ehit + float(b.get("end_offset", 0.08)))
            anchored.append((b_idx, s_override, e_override))

        for b_idx, s_ov, e_ov in anchored:
            b = beats[b_idx]
            if s_ov is not None:
                b["start"] = round(s_ov, 3)
                if b_idx > 0 and isinstance(beats[b_idx - 1], dict):
                    beats[b_idx - 1]["end"] = round(s_ov, 3)
            if e_ov is not None:
                b["end"] = round(e_ov, 3)
                if b_idx + 1 < len(beats) and isinstance(beats[b_idx + 1], dict):
                    beats[b_idx + 1]["start"] = round(e_ov, 3)

        # Ensure monotonic non-overlapping [0 .. scene_dur] coverage
        beats[0]["start"] = round(max(0.0, float(beats[0].get("start", 0.0))), 3)
        for i in range(len(beats) - 1):
            cur_s = float(beats[i].get("start", 0.0))
            nxt_s = max(cur_s + 0.12, float(beats[i + 1].get("start", beats[i].get("end", cur_s + 0.5))))
            beats[i]["end"] = round(min(scene_dur, nxt_s), 3)
            beats[i + 1]["start"] = beats[i]["end"]
        beats[-1]["end"] = round(max(float(beats[-1]["start"]) + 0.10, scene_dur), 3)


def align_scene_cameras_to_speech(
    scene: Dict[str, Any],
    scene_words: List[Dict[str, Any]],
    scene_dur: float,
) -> None:
    """
    Snap `camera_shots` `start` / `end` directly to spoken `cue_on` / `end_on` phrases
    and chain consecutive shots seamlessly so camera cuts & movements happen on exact dramatic beats!
    """
    shots = scene.get("camera_shots")
    if not isinstance(shots, list) or not shots:
        return

    cursor_min = 0.0
    for idx, sh in enumerate(shots):
        if not isinstance(sh, dict):
            continue
        if idx == 0 and not sh.get("cue_on"):
            sh["start"] = round(float(sh.get("start", 0.0)), 3)
        elif sh.get("cue_on"):
            hit = _find_phrase_time(scene_words, str(sh["cue_on"]), use_end=False, min_time=cursor_min)
            if hit is not None:
                sh["start"] = round(max(cursor_min, hit - 0.06), 3)
        cursor_min = float(sh.get("start", cursor_min)) + 0.35

    # Chain `end` of each shot cleanly to the next shot's `start` (unless `end_on` overrides)
    for idx, sh in enumerate(shots):
        if not isinstance(sh, dict):
            continue
        s_t = float(sh.get("start", 0.0))
        if sh.get("end_on"):
            ehit = _find_phrase_time(scene_words, str(sh["end_on"]), use_end=True, min_time=s_t + 0.3)
            if ehit is not None:
                sh["end"] = round(min(scene_dur, ehit + 0.25), 3)
                continue
        if idx + 1 < len(shots) and isinstance(shots[idx + 1], dict):
            nxt_s = float(shots[idx + 1].get("start", s_t + 1.5))
            sh["end"] = round(max(s_t + 0.25, nxt_s), 3)
        else:
            sh["end"] = round(scene_dur, 3)


def _resolve_speaker_voice(
    speaker: str,
    spec: Dict[str, Any],
    default_voice: str,
    default_rate: str,
) -> Tuple[str, str, str]:
    voices_map = spec.get("voices") or {}
    cast_map = spec.get("cast") or {}
    sp_key = (speaker or "narrator").lower()

    if sp_key in voices_map:
        v_cfg = voices_map[sp_key]
        if isinstance(v_cfg, str):
            return v_cfg, default_rate, "+0Hz"
        return (
            v_cfg.get("voice", default_voice),
            v_cfg.get("rate", default_rate),
            v_cfg.get("pitch", "+0Hz"),
        )
    if sp_key in cast_map and isinstance(cast_map[sp_key], dict) and cast_map[sp_key].get("voice"):
        c_cfg = cast_map[sp_key]
        return (
            c_cfg["voice"],
            c_cfg.get("rate", default_rate),
            c_cfg.get("pitch", "+0Hz"),
        )
    return default_voice, default_rate, "+0Hz"


def _smart_default_pause_after(speaker: str, next_speaker: Optional[str], text: str) -> float:
    """Natural human conversational turn timing (replaces sluggish 0.50s blanket pauses)."""
    spk = (speaker or "narrator").lower()
    nxt = (next_speaker or "").lower() if next_speaker else None
    if nxt is None:
        return 0.18
    if spk != "narrator" and nxt != "narrator" and spk != nxt:
        # Snappy back-and-forth character conversation
        return 0.22 if text.endswith("?") else 0.25
    return 0.32


def _classify_word_viseme(word: str) -> str:
    w = re.sub(r"[^a-z]", "", (word or "").lower())
    if not w:
        return "open"
    if w in {"m", "b", "p", "mm", "uhm"}:
        return "closed"
    if any(p in w for p in ("oo", "ow", "ou", "oa", "oy", "wh")) or w.startswith(("w", "o", "u")):
        return "round"
    if any(p in w for p in ("ee", "ea", "ie", "ei", "sh", "ch")) or w.endswith(("y", "s", "z", "ce")):
        return "wide"
    return "open"


def _compute_speech_envelope_30fps(raw_pcm: bytes, sr: int = SAMPLE_RATE, fps: int = 30) -> List[float]:
    """Compute a smooth 30fps normalized acoustic amplitude envelope [0..1] from 16-bit mono PCM."""
    n_s = len(raw_pcm) // 2
    if n_s < 4:
        return []
    samples = struct.unpack(f"<{n_s}h", raw_pcm)
    hop = max(1, int(round(sr / float(fps))))
    n_frames = max(1, (n_s + hop - 1) // hop)
    rms_vals: List[float] = []
    for f in range(n_frames):
        i0 = f * hop
        i1 = min(n_s, i0 + hop)
        if i1 <= i0:
            rms_vals.append(0.0)
            continue
        acc = 0.0
        for s_val in samples[i0:i1]:
            acc += float(s_val) * float(s_val)
        rms_vals.append((acc / float(i1 - i0)) ** 0.5)

    sorted_rms = sorted(v for v in rms_vals if v > 80.0)
    ref = sorted_rms[int(0.88 * (len(sorted_rms) - 1))] if sorted_rms else 4000.0
    ref = max(900.0, ref)

    smoothed: List[float] = []
    prev = 0.0
    for r_val in rms_vals:
        norm_v = 0.0 if r_val < 180.0 else min(1.0, (r_val - 150.0) / ref)
        # Fast vocal opening attack (0.68), smooth natural jaw closure release (0.42)
        cur = prev + (norm_v - prev) * (0.68 if norm_v >= prev else 0.42)
        if cur < 0.035:
            cur = 0.0
        smoothed.append(round(cur, 3))
        prev = cur
    if smoothed:
        smoothed[-1] = 0.0
    return smoothed


def _stitch_scene_lines_wav(
    items: List[Dict[str, Any]],
    lead_in: float,
    tail_out: float,
    dst_wav: Path,
) -> Tuple[float, List[Dict[str, Any]], List[Dict[str, Any]], List[Tuple[float, float]]]:
    """Concatenate synthesized line WAVs + exact pauses into a single scene WAV (starts at t=0 of scene)."""
    chunks_pcm: List[bytes] = []
    line_timings: List[Dict[str, Any]] = []
    scene_words: List[Dict[str, Any]] = []
    speech_rel_intervals: List[Tuple[float, float]] = []

    cursor = 0.0
    if lead_in > 0:
        n_lead = int(round(lead_in * SAMPLE_RATE))
        chunks_pcm.append(b"\x00\x00" * n_lead)
        cursor += n_lead / float(SAMPLE_RATE)

    for idx, it in enumerate(items):
        pre = float(it.get("pause_before", 0.0))
        if pre > 0:
            n_pre = int(round(pre * SAMPLE_RATE))
            chunks_pcm.append(b"\x00\x00" * n_pre)
            cursor += n_pre / float(SAMPLE_RATE)

        wpath: Optional[Path] = it.get("wav")
        if wpath and wpath.exists():
            with wave.open(str(wpath), "rb") as wf:
                raw = wf.readframes(wf.getnframes())
                n_s = len(raw) // 2
            dur = n_s / float(SAMPLE_RATE)
            chunks_pcm.append(raw)
            start_t = cursor
            end_t = cursor + dur
            cursor = end_t

            raw_line_words = it.get("words") or _fallback_proportional_words(it.get("text", ""), dur)
            spk = it.get("speaker", "narrator")
            shifted_words: List[Dict[str, Any]] = []
            for w in raw_line_words:
                ws = round(start_t + float(w["start"]), 3)
                we = round(min(end_t, max(ws + 0.04, start_t + float(w["end"]))), 3)
                w_entry = {
                    "word": w["word"],
                    "start": ws,
                    "end": we,
                    "speaker": spk,
                    "viseme": _classify_word_viseme(w["word"]),
                }
                shifted_words.append(w_entry)
                scene_words.append(w_entry)

            env_30 = _compute_speech_envelope_30fps(raw) if spk.lower() != "narrator" else []
            line_timings.append(
                {
                    "speaker": spk,
                    "text": it.get("text", ""),
                    "start": round(start_t, 3),
                    "end": round(end_t, 3),
                    "words": shifted_words,
                    "env_30fps": env_30,
                }
            )
            speech_rel_intervals.append((round(start_t, 3), round(end_t, 3)))

        is_last = idx == len(items) - 1
        post = 0.0 if is_last else float(it.get("pause_after", 0.28))
        if post > 0:
            n_post = int(round(post * SAMPLE_RATE))
            chunks_pcm.append(b"\x00\x00" * n_post)
            cursor += n_post / float(SAMPLE_RATE)

    if tail_out > 0:
        n_tail = int(round(tail_out * SAMPLE_RATE))
        chunks_pcm.append(b"\x00\x00" * n_tail)
        cursor += n_tail / float(SAMPLE_RATE)

    dst_wav.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(dst_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(chunks_pcm))

    return cursor, line_timings, scene_words, speech_rel_intervals


def prepare_episode_voiceover(
    spec: Dict[str, Any],
    work_dir: Path,
    mode: str = "auto",
    voice: str = "en-US-AndrewNeural",
    rate: str = "+2%",
    voice_dir: Optional[Path] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], str]:
    """
    Synthesize or load per-scene narration/dialogue WAV files, compact dead internal pauses,
    extract exact `WordBoundary` timestamps for glowing subtitles & lip-sync, and align boards & cameras to speech.
    """
    retimed = copy.deepcopy(spec)
    vo_dir = work_dir / "vo_cache"
    vo_dir.mkdir(parents=True, exist_ok=True)

    if mode in ("none", "off"):
        return retimed, [], "text-led"

    edge_available = False
    if mode in ("auto", "edge"):
        try:
            import edge_tts  # noqa: F401
            edge_available = True
        except ImportError:
            edge_available = False

    scene_plans: List[Dict[str, Any]] = []
    batch_jobs: List[Dict[str, Any]] = []

    for idx, sc in enumerate(retimed.get("scenes", [])):
        sid = sc.get("id") or f"S{idx + 1:02d}"
        dialogue = sc.get("dialogue")
        lines: List[Dict[str, Any]] = []

        if isinstance(dialogue, list) and len(dialogue) > 0:
            valid_entries = [e for e in dialogue if str(e.get("text") or "").strip()]
            for l_idx, entry in enumerate(valid_entries):
                txt = str(entry.get("text") or "").strip()
                spk = str(entry.get("speaker") or "narrator")
                nxt_spk = str(valid_entries[l_idx + 1].get("speaker") or "narrator") if l_idx + 1 < len(valid_entries) else None
                v_name, v_rate, v_pitch = _resolve_speaker_voice(
                    spk, retimed, default_voice=voice, default_rate=entry.get("rate") or rate
                )
                eff_rate = entry.get("rate") or v_rate
                eff_pitch = entry.get("pitch") or v_pitch
                default_pa = _smart_default_pause_after(spk, nxt_spk, txt)
                raw_pa = float(entry["pause_after"]) if "pause_after" in entry else default_pa
                # Guard against unintentional long pauses unless `allow_long_pause` is set
                eff_pa = raw_pa if entry.get("allow_long_pause") else min(raw_pa, 0.85)

                h = hashlib.sha1(f"wb3|{v_name}|{eff_rate}|{eff_pitch}|{txt}".encode("utf-8")).hexdigest()[:12]
                l_wav = vo_dir / f"line_{idx:03d}_{l_idx:03d}_{h}.wav"
                l_meta = l_wav.with_suffix(".txt")
                job = {
                    "text": txt,
                    "speaker": spk,
                    "voice": v_name,
                    "rate": eff_rate,
                    "pitch": eff_pitch,
                    "pause_before": float(entry.get("pause_before", 0.0)),
                    "pause_after": eff_pa,
                    "wav": l_wav,
                    "meta": l_meta,
                    "sig": f"wb3|{v_name}|{eff_rate}|{eff_pitch}|{txt}",
                    "ok": False,
                    "dur": 0.0,
                    "words": [],
                }
                lines.append(job)
                batch_jobs.append(job)
        else:
            narration = str(sc.get("narration") or "").strip()
            if narration:
                v_name, v_rate, v_pitch = _resolve_speaker_voice("narrator", retimed, voice, rate)
                h = hashlib.sha1(f"wb3|{v_name}|{v_rate}|{v_pitch}|{narration}".encode("utf-8")).hexdigest()[:12]
                l_wav = vo_dir / f"line_{idx:03d}_000_{h}.wav"
                l_meta = l_wav.with_suffix(".txt")
                job = {
                    "text": narration,
                    "speaker": "narrator",
                    "voice": v_name,
                    "rate": v_rate,
                    "pitch": v_pitch,
                    "pause_before": 0.0,
                    "pause_after": 0.0,
                    "wav": l_wav,
                    "meta": l_meta,
                    "sig": f"wb3|{v_name}|{v_rate}|{v_pitch}|{narration}",
                    "ok": False,
                    "dur": 0.0,
                    "words": [],
                }
                lines.append(job)
                batch_jobs.append(job)

        scene_plans.append({"idx": idx, "sid": sid, "scene": sc, "lines": lines})

    backend_used = "text-led"
    if edge_available and batch_jobs and not (voice_dir and voice_dir.exists()):
        asyncio.run(_batch_synthesize_lines(batch_jobs, concurrency=5))
        if any(j["ok"] for j in batch_jobs):
            used_voices = sorted({j["voice"] for j in batch_jobs if j["ok"]})
            backend_used = "edge-tts:" + ",".join(used_voices)

    segments: List[Dict[str, Any]] = []
    for plan in scene_plans:
        idx = plan["idx"]
        sid = plan["sid"]
        sc = plan["scene"]
        lines = plan["lines"]
        orig_dur = float(sc.get("duration") or sc.get("min_duration") or 8.0)
        min_dur = float(sc.get("min_duration") or 2.2)
        out_wav = vo_dir / f"{idx:03d}_{sid}_master.wav"

        if voice_dir and voice_dir.exists():
            ext_found = False
            for ext in (".wav", ".mp3", ".m4a", ".ogg"):
                cand = voice_dir / f"{sid}{ext}"
                if cand.exists():
                    sp_dur = convert_to_mono_wav(cand, out_wav)
                    new_dur = max(min_dur, sp_dur + 0.55)
                    scale_scene_choreography(sc, orig_dur, new_dur)
                    full_text = sc.get("narration") or " ".join(j["text"] for j in lines)
                    fb_words = [
                        {**w, "start": round(w["start"] + 0.2, 3), "end": round(w["end"] + 0.2, 3), "speaker": "narrator"}
                        for w in _fallback_proportional_words(full_text, sp_dur)
                    ]
                    sc["word_timings"] = fb_words
                    align_scene_board_to_speech(sc, fb_words, new_dur)
                    align_scene_cameras_to_speech(sc, fb_words, new_dur)
                    segments.append(
                        {
                            "scene_id": sid,
                            "wav": str(out_wav),
                            "speech_dur": round(sp_dur, 3),
                            "lead_in": 0.2,
                            "speech_rel_intervals": [(0.2, round(0.2 + sp_dur, 3))],
                        }
                    )
                    backend_used = "external-audio"
                    ext_found = True
                    break
            if ext_found:
                continue

        if not lines:
            scale_scene_choreography(sc, orig_dur, orig_dur)
            segments.append({"scene_id": sid, "wav": None, "speech_dur": 0.0, "lead_in": 0.0, "speech_rel_intervals": []})
            continue

        if mode == "offline" and not any(j["ok"] for j in lines):
            for j in lines:
                d = try_synthesize_os_tts(j["text"], j["wav"])
                if d is not None:
                    j["ok"] = True
                    j["dur"] = d
                    j["words"] = _fallback_proportional_words(j["text"], d)
                    backend_used = "os-tts"

        if any(j["ok"] for j in lines):
            lead_in = float(sc.get("lead_in", 0.22))
            tail_out = float(sc.get("tail_out", 0.42))
            stitched_dur, line_timings, scene_words, rel_intervals = _stitch_scene_lines_wav(
                [j for j in lines if j["ok"]], lead_in, tail_out, out_wav
            )
            # Prevent accidental giant silent padding from inflated `min_duration` unless `hold_silent_tail` or `intertitle` is active
            has_closing_hold = bool(sc.get("hold_silent_tail") or sc.get("intertitle") or sc.get("end_card") or sc.get("cut_to_black_at"))
            capped_min_dur = min_dur if has_closing_hold else min(min_dur, stitched_dur + 2.4)
            new_dur = max(capped_min_dur, stitched_dur)

            scale_scene_choreography(sc, orig_dur, new_dur)
            sc["line_timings"] = line_timings
            sc["word_timings"] = scene_words
            sc["narration"] = " ".join(j["text"] for j in lines)
            align_character_beats_to_speech(sc, line_timings, scene_words, new_dur)
            align_scene_board_to_speech(sc, scene_words, new_dur)
            align_scene_cameras_to_speech(sc, scene_words, new_dur)
            segments.append(
                {
                    "scene_id": sid,
                    "wav": str(out_wav),
                    "speech_dur": round(stitched_dur, 3),
                    "lead_in": 0.0,
                    "speech_rel_intervals": rel_intervals,
                }
            )
        else:
            full_text = " ".join(j["text"] for j in lines)
            words = len(full_text.split())
            est = max(orig_dur, words / 2.6 + 0.6)
            scale_scene_choreography(sc, orig_dur, est)
            sc["narration"] = full_text
            fb_words = _fallback_proportional_words(full_text, est - 0.4)
            sc["word_timings"] = fb_words
            align_scene_board_to_speech(sc, fb_words, est)
            align_scene_cameras_to_speech(sc, fb_words, est)
            segments.append({"scene_id": sid, "wav": None, "speech_dur": 0.0, "lead_in": 0.0, "speech_rel_intervals": []})

    cursor = 0.0
    for sc, seg in zip(retimed.get("scenes", []), segments):
        seg["scene_start"] = round(cursor, 3)
        seg["start_sec"] = round(cursor + float(seg.get("lead_in", 0.0)), 3)
        seg["speech_intervals"] = [
            [round(cursor + a, 3), round(cursor + b, 3)]
            for (a, b) in seg.get("speech_rel_intervals", [])
        ]
        cursor += float(sc.get("duration", 8.0))

    return retimed, segments, backend_used
