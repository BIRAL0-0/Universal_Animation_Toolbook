"""Provider interface for the self-hosted TTS subsystem.

Every engine (Kokoro, Piper, Edge fallback, future engines) implements
:class:`TTSProvider`. The rest of the toolbook never talks to an engine
directly — it goes through :mod:`universal_toolbook.tts.providers.get_engine`.

Design rules
------------
* Lazy imports: importing this package must never require an engine's
  heavy dependencies. ``kokoro_onnx`` / ``piper`` / ``edge_tts`` are only
  imported when a provider is actually constructed.
* A provider is stateful once loaded (model in memory); keep one instance
  per process and reuse it across many syntheses.
* ``synthesize`` returns float32 mono audio plus *optional* word timings.
  Engines without native word boundaries (Kokoro v0.19 int8 export) return
  ``timings=None`` and the caller applies the syllable-proportional +
  energy-refined fallback used for Piper.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

__all__ = ["AudioResult", "TTSProvider", "TTSError", "EngineUnavailable"]


class TTSError(Exception):
    """Base class for TTS subsystem errors."""


class EngineUnavailable(TTSError):
    """Raised when a requested engine is not installed or its weights are missing.

    The message must say exactly what is missing and how to fix it
    (usually: ``python3 universal_toolbook/setup_tts.py``).
    """


@dataclass
class AudioResult:
    """Output of one synthesis call.

    Attributes
    ----------
    audio: float32 mono samples in [-1, 1].
    sample_rate: output rate in Hz (24000 for Kokoro, 22050 for Piper medium).
    timings: optional list of ``(word, start_s, end_s)`` in audio time.
        ``None`` means the engine has no native word boundaries.
    engine / voice: identity for manifests and logs.
    meta: engine-specific extras (e.g. raw phoneme alignments).
    """

    audio: np.ndarray
    sample_rate: int
    timings: Optional[List[Tuple[str, float, float]]] = None
    engine: str = ""
    voice: str = ""
    meta: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration(self) -> float:
        return len(self.audio) / float(self.sample_rate) if self.sample_rate else 0.0


class TTSProvider(ABC):
    """Abstract self-hosted text-to-speech engine."""

    #: short engine name, e.g. "kokoro"
    name: str = "abstract"

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config: Dict[str, Any] = dict(config or {})
        self._loaded = False

    # -- lifecycle -----------------------------------------------------
    def load(self) -> None:
        """Load model(s) into memory. Idempotent."""
        if self._loaded:
            return
        self._check_available()
        self._load()
        self._loaded = True

    def is_available(self) -> bool:
        """Cheap check: package importable + weights present. No model load."""
        try:
            self._check_available()
            return True
        except EngineUnavailable:
            return False

    def _check_available(self) -> None:  # pragma: no cover - overridden
        raise NotImplementedError

    def _load(self) -> None:  # pragma: no cover - overridden
        raise NotImplementedError

    # -- synthesis -----------------------------------------------------
    @abstractmethod
    def synthesize(
        self,
        text: str,
        voice: str,
        speed: float = 1.0,
        language: str = "en",
        **kwargs: Any,
    ) -> AudioResult:
        """Synthesize ``text`` with ``voice`` at ``speed`` (1.0 = natural)."""

    # -- metadata ------------------------------------------------------
    def voices(self) -> List[str]:
        """Voice ids this engine can speak (requires load)."""
        self.load()
        return self._voices()

    def _voices(self) -> List[str]:  # pragma: no cover - overridden
        raise NotImplementedError

    def engine_version(self) -> str:
        """Human-readable engine/model version for manifests and reports."""
        return self.name

    def resolve_voice(self, requested: str) -> str:
        """Map a pipeline voice name (e.g. an Edge alias) to a native voice id.

        Default: identity. Providers with alias tables override this.
        Raises EngineUnavailable with a clear message if the voice is unknown.
        """
        return requested

    # -- misc ------------------------------------------------------------
    def __repr__(self) -> str:
        state = "loaded" if self._loaded else "unloaded"
        return f"<{self.__class__.__name__} {self.name} ({state})>"
