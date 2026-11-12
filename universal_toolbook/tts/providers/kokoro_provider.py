"""Kokoro-82M provider (int8 ONNX via the ``kokoro-onnx`` package).

Model files (``kokoro.onnx`` 92.4 MB int8, Kokoro-82M v0.19 export) are
downloaded by ``universal_toolbook/setup_tts.py`` into ``runtime/cache/tts/``.
Hugging Face is not reachable from the Arena sandbox, so the weights come
from a public GitHub repository's git objects (see ``setup_tts.py`` for the
exact source + SHA-256 pins).

Voice sets
----------
Two voice files are supported, both downloaded by ``setup_tts.py``:

* ``voices.npz`` — the 11-voice v0.19 set bundled with the model weights
  (af, af_bella, af_nicole, af_sarah, af_sky, am_adam, am_michael, bf_emma,
  bf_isabella, bm_george, bm_lewis). Loaded first, under their plain names.
* ``voices-v1.0-en.npz`` — the 33-voice English v1.0 set (released with the
  v1.0 model). The 23 v1.0-only voices are loaded under their plain names
  (``af_heart``, ``am_onyx``, ``bf_alice``, ...); the 10 re-recordings whose
  names collide with v0.19 voices are loaded with a ``_v1`` suffix
  (``am_michael_v1``, ``af_bella_v1``, ...) so the plain names always keep
  pointing at the v0.19 recordings the pipeline was benchmarked on.
  Both sets are style vectors for the same 82M model
  (``(510, 1, 256)`` float32), verified by synthesis.

Notes
-----
* Output: 24000 Hz mono float32.
* This export does NOT report per-phoneme durations, so ``timings`` is
  ``None``; callers use the syllable-proportional + energy-refined fallback
  (same path Piper uses in ``engine/voice_engine.py``).
* ``speed`` > 1.0 speaks faster (the package scales phoneme durations;
  measured non-linearly, see TTS_BENCHMARK.md).
"""

from __future__ import annotations

import importlib
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ..base import AudioResult, EngineUnavailable, TTSProvider
from ..config import kokoro_model_path, kokoro_voices_paths, load_config

__all__ = ["KokoroProvider"]


class KokoroProvider(TTSProvider):
    name = "kokoro"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.cfg = self.config or load_config()["engines"]["kokoro"]
        self.model_path = kokoro_model_path(self.config)
        self.voices_paths = kokoro_voices_paths(self.config)
        self.voices_path = self.voices_paths[0]  # backwards-compatible attribute
        self._engine: Any = None
        self._warned_fallbacks: set[str] = set()

    # -- availability --------------------------------------------------
    def _check_available(self) -> None:
        try:
            importlib.import_module("kokoro_onnx")
        except ImportError as e:
            raise EngineUnavailable(
                "kokoro-onnx package is not installed. Run: "
                "python3 universal_toolbook/setup_tts.py"
            ) from e
        if not self.model_path.exists() or not self.voices_path.exists():
            missing = [str(p) for p in (self.model_path, self.voices_path) if not p.exists()]
            raise EngineUnavailable(
                "Kokoro model files missing: " + ", ".join(missing)
                + ". Run: python3 universal_toolbook/setup_tts.py"
            )

    def _load(self) -> None:
        from kokoro_onnx import Kokoro

        self._engine = Kokoro(
            model_path=str(self.model_path),
            voices_path=str(self.voices_path),
        )
        # kokoro-onnx stores its voice set as a lazy npz file object that
        # forbids item assignment; materialize it as a plain dict (a few
        # tens of MB of float32) so additional voice sets can be merged in.
        # Both `get_voice_style` (item access) and `get_voices` (keys) work
        # identically on a dict.
        npzf = self._engine.voices
        self._engine.voices = {key: npzf[key] for key in npzf.files}
        # Merge any additional voice sets (v1.0 re-recordings). Name
        # collisions keep the earlier (v0.19) entry; the later file's
        # colliding voices are registered with a `_v1` suffix so both
        # recordings stay reachable and the plain names never change.
        for extra in self.voices_paths[1:]:
            if not extra.exists():
                continue
            with np.load(extra) as npz:
                for key in npz.files:
                    target = key if key not in self._engine.voices else f"{key}_v1"
                    self._engine.voices[target] = npz[key]

    # -- synthesis -------------------------------------------------------
    def synthesize(
        self,
        text: str,
        voice: str,
        speed: float = 1.0,
        language: str = "en-us",
        **kwargs: Any,
    ) -> AudioResult:
        self.load()
        if not text.strip():
            raise ValueError("empty text")
        voice_id = self.resolve_voice(voice)
        fallback = self.voice_fallback(voice)
        if fallback:
            # clear, documented fallback: one warning per process per voice
            if voice not in self._warned_fallbacks:
                self._warned_fallbacks.add(voice)
                import sys
                print(
                    f"WARNING [kokoro]: voice '{voice}' is not available "
                    f"(not installed in any voice set). Using documented "
                    f"fallback '{fallback}'. Available voices: "
                    f"{', '.join(self._engine.get_voices())}",
                    file=sys.stderr,
                )
        defaults = self.cfg.get("defaults", {})
        arr, sr = self._engine.create(
            text,
            voice=voice_id,
            speed=float(speed),
            lang=kwargs.get("language", language or defaults.get("language", "en-us")),
            trim=True,
            sentence_pause=float(kwargs.get("sentence_pause", defaults.get("sentence_pause", 0.25))),
            clause_pause=float(kwargs.get("clause_pause", defaults.get("clause_pause", 0.10))),
        )
        meta: Dict[str, Any] = {
            "model": os.path.basename(str(self.model_path)),
            "native_timings": False,
        }
        if fallback:
            meta["voice_requested"] = voice
            meta["voice_fallback"] = True
        return AudioResult(
            audio=np.ascontiguousarray(arr, dtype=np.float32),
            sample_rate=int(sr),
            timings=None,  # this export has no duration output
            engine=self.name,
            voice=voice_id,
            meta=meta,
        )

    # -- metadata --------------------------------------------------------
    def _voices(self) -> List[str]:
        return list(self._engine.get_voices())

    def engine_version(self) -> str:
        try:
            import importlib.metadata as md
            ver = md.version("kokoro-onnx")
        except Exception:
            ver = "?"
        sets = " + ".join(
            f"{os.path.basename(str(p))}"
            for p in self.voices_paths
            if p == self.voices_path or p.exists()
        )
        return f"kokoro-onnx {ver} / Kokoro-82M v0.19 int8 ONNX / voices: {sets}"

    def resolve_voice(self, requested: str) -> str:
        req = (requested or "").strip()
        aliases = self.cfg.get("aliases", {})
        if req in aliases:
            return aliases[req]
        if req in self._known_voices():
            return req
        # last resort: the configured default voice (reported via voice_fallback)
        return self.cfg.get("defaults", {}).get("voice", "am_michael")

    def voice_fallback(self, requested: str) -> Optional[str]:
        """The fallback voice a request resolves to, or ``None`` if no
        fallback applies (empty request, alias, or directly available voice).
        Requires the engine to be loaded (call after ``load()``)."""
        req = (requested or "").strip()
        if not req or req in self.cfg.get("aliases", {}):
            return None
        if req in self._known_voices():
            return None
        return self.cfg.get("defaults", {}).get("voice", "am_michael")

    def _known_voices(self) -> List[str]:
        if self._engine is None:
            return []
        try:
            return list(self._engine.get_voices())
        except Exception:
            return []
