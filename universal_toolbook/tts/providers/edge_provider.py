"""Microsoft Edge TTS provider — kept only as a fallback.

Why it exists: the animation pipeline historically used Edge TTS
(``edge_tts_to_file`` in ``engine/voice_engine.py``). It is retained as a
pluggable provider so machines *with* network access to
``speech.platform.bing.com`` can still use it, and so the provider interface
has a third reference implementation.

Why it is NOT the default:
* Proprietary cloud service — not self-hosted, not guaranteed free, no
  contractual right to use output in monetized videos.
* In the Arena sandbox the endpoint is unreachable; synthesis fails per line
  and the pipeline must fall back to the offline engines.
* Quality complaints motivated this whole subsystem (see TTS_BENCHMARK.md).
"""

from __future__ import annotations

import asyncio
import importlib
import io
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

import numpy as np

from ..base import AudioResult, EngineUnavailable, TTSProvider
from ..config import load_config

__all__ = ["EdgeProvider"]


class EdgeProvider(TTSProvider):
    name = "edge"

    _KNOWN_VOICES = [
        "en-US-AndrewNeural", "en-US-GuyNeural", "en-US-EricNeural", "en-US-JennyNeural",
        "en-US-AriaNeural", "en-US-AnaNeural", "en-US-EmmaNeural", "en-US-SofiaNeural",
        "en-GB-RyanNeural", "en-GB-LibbyNeural",
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(config)
        self.cfg = self.config or load_config()["engines"]["edge"]

    def _check_available(self) -> None:
        try:
            importlib.import_module("edge_tts")
        except ImportError as e:
            raise EngineUnavailable(
                "edge-tts package is not installed (pip install edge-tts)."
            ) from e

    def _load(self) -> None:
        pass  # stateless; each call is a fresh network request

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
        import edge_tts

        voice_id = self.resolve_voice(voice)
        rate_pct = int(round((float(speed) - 1.0) * 100))
        rate = f"{rate_pct:+d}%"

        async def _mp3() -> bytes:
            communicate = edge_tts.Communicate(text, voice_id, rate=rate)
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            return buf.getvalue()

        try:
            mp3 = asyncio.run(_mp3())
        except Exception as e:
            raise EngineUnavailable(
                f"Edge TTS synthesis failed ({type(e).__name__}). In the Arena sandbox "
                f"speech.platform.bing.com is unreachable — use --engine kokoro or piper."
            ) from e
        if not mp3:
            raise EngineUnavailable("Edge TTS returned no audio")

        arr, sr = self._mp3_to_pcm(mp3)
        return AudioResult(
            audio=arr, sample_rate=sr, timings=None,
            engine=self.name, voice=voice_id, meta={"cloud": True},
        )

    @staticmethod
    def _mp3_to_pcm(mp3: bytes) -> tuple[np.ndarray, int]:
        """Decode MP3 -> float32 mono via ffmpeg (system or imageio-ffmpeg)."""
        from ..audio import get_ffmpeg_exe

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(mp3)
            tmp = f.name
        try:
            # Edge TTS streams 24 kHz audio; decode explicitly to 24 kHz mono
            # so the returned sample rate is known exactly.
            cmd = [
                get_ffmpeg_exe(), "-y", "-i", tmp,
                "-ar", "24000", "-ac", "1",
                "-f", "f32le", "-acodec", "pcm_f32le", "pipe:1",
            ]
            out = subprocess.run(cmd, capture_output=True, check=True)
        finally:
            import os
            os.unlink(tmp)
        return np.frombuffer(out.stdout, dtype=np.float32), 24000

    def _voices(self) -> List[str]:
        return list(self._KNOWN_VOICES)

    def engine_version(self) -> str:
        try:
            import importlib.metadata as md
            return f"edge-tts {md.version('edge-tts')} (cloud, non-free)"
        except Exception:
            return "edge-tts ? (cloud, non-free)"

    def resolve_voice(self, requested: str) -> str:
        req = (requested or "").strip()
        aliases = self.cfg.get("aliases", {})
        return aliases.get(req, req)
