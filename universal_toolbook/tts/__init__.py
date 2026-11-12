"""Self-hosted TTS subsystem for the Universal Animation Toolbook.

Pluggable engines (``providers``), reusable audio processing (``audio``),
natural segmentation (``segment``) and resumable job manifests (``manifest``).

Quick start
-----------
    python3 universal_toolbook/setup_tts.py          # one-time setup
    python3 universal_toolbook/generate_voiceover.py \\
        --input script.txt --voice af_bella --out runtime/renders/tts/my_video

Importing this package never loads any model; heavy dependencies are imported
lazily by the providers.
"""

from .base import AudioResult, EngineUnavailable, TTSProvider, TTSError
from .config import load_config, repo_root
from .manifest import Manifest, SegmentState, job_id_for, load_manifest
from .providers import available_engines, get_engine, list_engines

__all__ = [
    "AudioResult",
    "EngineUnavailable",
    "TTSProvider",
    "TTSError",
    "Manifest",
    "SegmentState",
    "job_id_for",
    "load_manifest",
    "load_config",
    "repo_root",
    "available_engines",
    "get_engine",
    "list_engines",
]

__version__ = "1.0.0"
