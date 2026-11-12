"""Job manifests: per-script job IDs, per-segment status, resumability.

One job directory holds everything for one (script, engine, voice, settings)
combination:

    <out_dir>/
      manifest.json          # this schema
      segments/seg-000.wav   # per-segment audio (original engine output)
      segments/seg-000.mp3   # optional
      final/full.wav         # concatenated + processed
      final/full.mp3         # optional

Resume rule: a segment is SKIPPED on re-run iff its file exists, passes
:func:`universal_toolbook.tts.audio.check_file`, and its stored signature
matches the job's signature (engine/voice/speed/language/text). A single
failed segment never forces regeneration of the others. Failed segments are
retried automatically on the next run.

The manifest also stores model/config metadata so a file produced in one
session can be identified and reproduced in another.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .audio import check_file

__all__ = ["Manifest", "job_id_for", "load_manifest", "save_manifest"]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def job_id_for(
    engine: str,
    voice: str,
    speed: float,
    language: str,
    text: str,
    settings: Optional[dict] = None,
) -> str:
    """Stable 12-hex job id for a script+settings combination."""
    sig = "|".join([
        engine, voice, f"{float(speed):.3f}", language,
        hashlib.sha256(text.encode("utf-8")).hexdigest(),
        json.dumps(settings or {}, sort_keys=True, default=str),
    ])
    return hashlib.sha1(sig.encode("utf-8")).hexdigest()[:12]


@dataclass
class SegmentState:
    segment_id: str
    text: str
    tts_text: str
    audio_file: str = ""
    mp3_file: str = ""
    status: str = "pending"          # pending | ok | failed
    duration_seconds: float = 0.0
    attempts: int = 0
    error: Optional[str] = None
    scene_id: Optional[str] = None
    signature: str = ""
    dictionary_changes: List[str] = field(default_factory=list)
    started: Optional[str] = None
    finished: Optional[str] = None

    def to_dict(self) -> dict:
        d = self.__dict__.copy()
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "SegmentState":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in d.items() if k in known})


@dataclass
class Manifest:
    job_id: str
    out_dir: str
    engine: str
    voice: str
    speed: float
    language: str
    segments: List[SegmentState] = field(default_factory=list)
    text_sha256: str = ""
    created: str = field(default_factory=_now)
    updated: str = field(default_factory=_now)
    engine_version: str = ""
    model: str = ""
    processing: Dict[str, Any] = field(default_factory=dict)
    final: Dict[str, Any] = field(default_factory=dict)

    # -- io -------------------------------------------------------------
    @property
    def path(self) -> Path:
        return Path(self.out_dir) / "manifest.json"

    def save(self) -> Path:
        self.updated = _now()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "job_id": self.job_id,
            "created": self.created,
            "updated": self.updated,
            "engine": self.engine,
            "engine_version": self.engine_version,
            "model": self.model,
            "voice": self.voice,
            "speed": self.speed,
            "language": self.language,
            "text_sha256": self.text_sha256,
            "processing": self.processing,
            "segments": [s.to_dict() for s in self.segments],
            "final": self.final,
        }
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)
        return self.path

    @property
    def out_path(self) -> Path:
        return Path(self.out_dir)

    # -- resume -----------------------------------------------------------
    def segment_is_reusable(self, s: SegmentState) -> bool:
        """True when the stored file for ``s`` can be kept as-is."""
        if s.status != "ok":
            return False
        if s.signature and s.signature != self._signature(s):
            return False
        if not s.audio_file:
            return False
        p = self.out_path / s.audio_file
        if not p.exists():
            return False
        ok, _errs = check_file(p)
        return ok

    def _signature(self, s: SegmentState) -> str:
        return hashlib.sha1(
            f"{self.engine}|{self.voice}|{self.speed:.3f}|{self.language}|{s.tts_text}".encode()
        ).hexdigest()[:12]

    def mark(self, s: SegmentState, **kw) -> None:
        for k, v in kw.items():
            setattr(s, k, v)
        self.save()

    def summary(self) -> dict:
        from collections import Counter

        c = Counter(s.status for s in self.segments)
        total = sum(s.duration_seconds for s in self.segments if s.status == "ok")
        return {
            "job_id": self.job_id,
            "engine": self.engine,
            "voice": self.voice,
            "segments": dict(c),
            "total_audio_seconds": round(total, 2),
            "final": self.final,
        }


def load_manifest(out_dir: str | Path) -> Optional[Manifest]:
    p = Path(out_dir) / "manifest.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        m = Manifest(
            job_id=d.get("job_id", ""),
            out_dir=str(Path(out_dir)),
            engine=d.get("engine", ""),
            voice=d.get("voice", ""),
            speed=float(d.get("speed", 1.0)),
            language=d.get("language", "en"),
            segments=[SegmentState.from_dict(x) for x in d.get("segments", [])],
            text_sha256=d.get("text_sha256", ""),
            created=d.get("created", _now()),
            updated=d.get("updated", _now()),
            engine_version=d.get("engine_version", ""),
            model=d.get("model", ""),
            processing=d.get("processing", {}),
            final=d.get("final", {}),
        )
        return m
    except Exception:
        return None


def save_manifest(m: Manifest) -> Path:
    return m.save()
