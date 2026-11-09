"""Piper provider (piper1-gpl, the ``piper-tts`` PyPI package).

Voices: medium-quality English voices installed into ``~/.cache/piper_voices``
by the repo's ``universal_toolbook/tools/fetch_piper_voices.py --github
007-Akira/Project-Rocky --github-path voices`` (the Hugging Face source is not
reachable from the Arena sandbox). This is the animation pipeline's long-standing
offline fallback; it is kept here as a second engine + last-resort fallback.

Word timings: with ``piper-tts[alignment]`` installed, Piper reports
per-phoneme sample counts. This provider groups phonemes between space marks
into words and maps them back to the source text when the word counts agree;
otherwise it returns ``timings=None`` and the caller uses the
syllable-proportional + energy-refined fallback.
"""

from __future__ import annotations

import importlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ..base import AudioResult, EngineUnavailable, TTSProvider
from ..config import load_config, piper_voice_dir

__all__ = ["PiperProvider"]


class PiperProvider(TTSProvider):
    name = "piper"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.cfg = self.config or load_config()["engines"]["piper"]
        self.voice_dir = piper_voice_dir(self.config)
        self._voice = None
        self._known: Optional[List[str]] = None

    # -- availability ----------------------------------------------------
    def _check_available(self) -> None:
        try:
            importlib.import_module("piper")
        except ImportError as e:
            raise EngineUnavailable(
                "piper-tts package is not installed. Run: python3 universal_toolbook/setup_tts.py"
            ) from e
        if not self.voice_dir.exists() or not any(self.voice_dir.glob("*.onnx")):
            raise EngineUnavailable(
                f"No Piper voices in {self.voice_dir}. Run: "
                "python3 universal_toolbook/setup_tts.py"
            )

    def _load(self) -> None:
        importlib.import_module("piper")
        # Load the default voice to validate the runtime; per-voice loading
        # is lazy in _voice_for below (voices are 60 MB each).
        self._known = sorted(p.name[: -len(".onnx")] for p in self.voice_dir.glob("*.onnx"))
        first = self._known[0]
        self._voice = self._load_model(first)

    def _load_model(self, model_id: str):
        from piper import PiperVoice

        model = self.voice_dir / f"{model_id}.onnx"
        if not model.exists():
            raise EngineUnavailable(
                f"Piper voice '{model_id}' not found in {self.voice_dir}. "
                f"Available: {', '.join(self._known or [])}"
            )
        try:
            return PiperVoice.load(str(model), include_alignments=True)
        except Exception:
            # alignment extra missing — fall back to no alignments
            return PiperVoice.load(str(model))

    # -- synthesis ---------------------------------------------------------
    def synthesize(
        self,
        text: str,
        voice: str,
        speed: float = 1.0,
        language: str = "en",
        **kwargs: Any,
    ) -> AudioResult:
        self.load()
        if not text.strip():
            raise ValueError("empty text")
        model_id = self.resolve_voice(voice)
        pv = self._voice if self._voice and self._voice.config and self._current_id == model_id else None
        if pv is None:
            self._current_id = model_id
            self._voice = pv = self._load_model(model_id)

        length_scale = 1.0 / float(speed) if float(speed) > 0 else 1.0
        chunks = list(pv.synthesize(text, include_alignments=True))
        arr = np.concatenate([c.audio_float_array for c in chunks]).astype(np.float32)
        sr = int(chunks[0].sample_rate) if chunks else int(pv.config.sample_rate)

        timings = self._word_timings(text, chunks, sr)
        return AudioResult(
            audio=np.ascontiguousarray(arr),
            sample_rate=sr,
            timings=timings,
            engine=self.name,
            voice=model_id,
            meta={"native_timings": timings is not None},
        )

    def _word_timings(
        self, text: str, chunks: List[Any], sr: int
    ) -> Optional[List[Tuple[str, float, float]]]:
        """Derive (word, start_s, end_s) from per-phoneme sample counts.

        Returns None when the phoneme groups cannot be mapped 1:1 onto the
        source words (the caller then uses the proportional fallback).
        """
        # (start_sample, end_sample) per word, from per-phoneme sample counts.
        groups: List[Tuple[int, int]] = []
        pos = 0  # absolute sample offset
        cur_start: Optional[int] = None  # absolute start of current word
        cur_len = 0  # samples accumulated in current word
        for c in chunks:
            al = c.phoneme_alignments
            if al is None:
                return None
            for a in al:
                n = int(a.num_samples)
                if a.phoneme in (" ", "_"):
                    if cur_start is not None and cur_len > 0:
                        groups.append((cur_start, cur_start + cur_len))
                    cur_start, cur_len = None, 0
                elif a.phoneme not in ("^", "$", "#0", "#1", "#2", "#3", "#4"):
                    if cur_start is None:
                        cur_start = pos
                    cur_len += n
                pos += n
        if cur_start is not None and cur_len > 0:
            groups.append((cur_start, cur_start + cur_len))

        words = text.split()
        if not groups or len(words) != len(groups):
            return None
        return [(w, s / sr, e / sr) for w, (s, e) in zip(words, groups)]

    # -- metadata -----------------------------------------------------------
    def _voices(self) -> List[str]:
        return list(self._known or [])

    def engine_version(self) -> str:
        try:
            import importlib.metadata as md
            ver = md.version("piper-tts")
        except Exception:
            ver = "?"
        return f"piper-tts {ver} (piper1-gpl)"

    def resolve_voice(self, requested: str) -> str:
        req = (requested or "").strip()
        aliases = self.cfg.get("aliases", {})
        if req in aliases:
            return aliases[req]
        known = self._known or []
        if req in known:
            return req
        return self.cfg.get("defaults", {}).get("voice", "en_US-ryan-medium")

    # bookkeeping helper for model reuse
    _current_id: str = ""
