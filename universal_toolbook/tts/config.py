"""Configuration loading for the TTS subsystem.

Single source of truth: ``universal_toolbook/tts/config/voices.json``.
Environment overrides (kept minimal, for the temporary-session workflow):

* ``TTS_CONFIG``   — path to an alternate voices.json
* ``TTS_MODEL_DIR`` — directory containing Kokoro weights (default ``<repo>/cache/tts``)
* ``PIPER_VOICE_DIR`` — directory containing Piper voices (default ``~/.cache/piper_voices``)
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List

#: repo root = two levels up from this file (universal_toolbook/tts/config.py)
REPO_ROOT = Path(__file__).resolve().parents[2]
TTS_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = TTS_ROOT / "config" / "voices.json"


def load_config(path: str | os.PathLike | None = None) -> Dict[str, Any]:
    p = Path(path or os.environ.get("TTS_CONFIG") or DEFAULT_CONFIG_PATH)
    if not p.exists():
        raise FileNotFoundError(f"TTS config not found: {p}")
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def repo_root() -> Path:
    return REPO_ROOT


def resolve_path(p: str) -> Path:
    """Resolve a config path: ~ expansion + relative-to-repo-root."""
    pp = Path(p).expanduser()
    return pp if pp.is_absolute() else REPO_ROOT / pp


def kokoro_model_path(config: Dict[str, Any] | None = None) -> Path:
    cfg = (config or load_config())["engines"]["kokoro"]
    override = os.environ.get("TTS_MODEL_DIR")
    if override:
        return Path(override).expanduser() / "kokoro.onnx"
    return resolve_path(cfg["model"])


def kokoro_voices_path(config: Dict[str, Any] | None = None) -> Path:
    """Primary voice set (kept for backwards compatibility)."""
    return kokoro_voices_paths(config)[0]


def kokoro_voices_paths(config: Dict[str, Any] | None = None) -> List[Path]:
    """All voice files for Kokoro, in priority order (earlier files win on
    name collisions). The first entry is the default set (bare names, e.g.
    am_michael); later entries (e.g. the v1.0 re-recordings) are loaded with
    their own names as stored in the file."""
    cfg = (config or load_config())["engines"]["kokoro"]
    override = os.environ.get("TTS_MODEL_DIR")
    if override:
        base = Path(override).expanduser()
        # auto-discover every voices*.npz in the model dir, voices.npz first
        primary = base / "voices.npz"
        rest = sorted(p for p in base.glob("voices*.npz") if p.name != "voices.npz")
        paths = ([primary] if primary.exists() else []) + rest
        return paths or [primary]
    files = cfg.get("voice_files")
    if not files:
        files = [cfg["voices"]]
    return [resolve_path(f) for f in files]


def piper_voice_dir(config: Dict[str, Any] | None = None) -> Path:
    cfg = (config or load_config())["engines"]["piper"]
    override = os.environ.get("PIPER_VOICE_DIR")
    d = Path(override).expanduser() if override else resolve_path(cfg["voice_dir"])
    return d
