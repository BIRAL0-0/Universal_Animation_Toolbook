"""Kokoro-82M provider (int8 ONNX via the ``kokoro-onnx`` package).

Model files (``kokoro.onnx`` 92.4 MB int8 + ``voices.npz`` 5.8 MB, Kokoro-82M
v0.19 export) are downloaded by ``universal_toolbook/setup_tts.py`` into
``cache/tts/``. Hugging Face is not reachable from the Arena sandbox, so the
weights come from a public GitHub repository's git objects (see
``setup_tts.py`` for the exact source + SHA-256 pins).

Notes
-----
* 11 voices in this weight set (af, af_bella, af_nicole, af_sarah, af_sky,
  am_adam, am_michael, bf_emma, bf_isabella, bm_george, bm_lewis).
* Output: 24000 Hz mono float32.
* This export does NOT report per-phoneme durations, so ``timings`` is
  ``None``; callers use the syllable-proportional + energy-refined fallback
  (same path Piper uses in ``engine/voice_engine.py``).
* ``speed`` > 1.0 speaks faster (the package scales phoneme durations).
"""

from __future__ import annotations

import importlib
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from ..base import AudioResult, EngineUnavailable, TTSProvider
from ..config import kokoro_model_path, kokoro_voices_path, load_config

__all__ = ["KokoroProvider"]


class KokoroProvider(TTSProvider):
    name = "kokoro"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.cfg = self.config or load_config()["engines"]["kokoro"]
        self.model_path = kokoro_model_path(self.config)
        self.voices_path = kokoro_voices_path(self.config)
        self._engine: Any = None

    # -- availability --------------------------------------------------
    def _check_available(self) -> None:
        try:
            importlib.import_module("kokoro_onnx")
        except ImportError as e:
            raise EngineUnavailable(
                "kokoro-onnx package is not installed. Run: "
                "python3 universal_toolbook/setup_tts.py"
            ) from e
        missing = [str(p) for p in (self.model_path, self.voices_path) if not p.exists()]
        if missing:
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
        return AudioResult(
            audio=np.ascontiguousarray(arr, dtype=np.float32),
            sample_rate=int(sr),
            timings=None,  # this export has no duration output
            engine=self.name,
            voice=voice_id,
            meta={"model": os.path.basename(str(self.model_path)), "native_timings": False},
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
        return f"kokoro-onnx {ver} / Kokoro-82M v0.19 int8 ONNX"

    def resolve_voice(self, requested: str) -> str:
        req = (requested or "").strip()
        aliases = self.cfg.get("aliases", {})
        if req in aliases:
            return aliases[req]
        if req in self._known_voices():
            return req
        # last resort: the configured default voice (with a clear warning)
        return self.cfg.get("defaults", {}).get("voice", "af_bella")

    def _known_voices(self) -> List[str]:
        if self._engine is None:
            return []
        try:
            return list(self._engine.get_voices())
        except Exception:
            return []
