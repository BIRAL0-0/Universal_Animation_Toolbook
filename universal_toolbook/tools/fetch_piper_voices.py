#!/usr/bin/env python3
"""
Offline neural voice setup for the Universal Animation Toolbook (Piper backend).

The toolbook's primary voice path is Microsoft Edge neural TTS (`edge-tts`). Sandboxes, CI
runners and air-gapped editing machines often cannot reach that endpoint — in those cases
`engine/voice_engine.py` transparently falls back to **Piper**, a fully local neural TTS
runtime, as long as `.onnx` voices are available:

    python3 tools/fetch_piper_voices.py check
    python3 tools/fetch_piper_voices.py list
    python3 tools/fetch_piper_voices.py install --voice en_US-ryan-medium --url-base <mirror>
    python3 tools/fetch_piper_voices.py install --from-dir /media/usb/piper_voices

Voice models are ~60 MB each and are deliberately NOT stored in this repository.
Canonical source (public domain / MIT licensing per voice):
    https://huggingface.co/rhasspy/piper-voices

Resolution order used by the engine (`engine/voice_engine.py::piper_voice_dir`):
    1. the directory in the `PIPER_VOICE_DIR` environment variable
    2. `~/.cache/piper_voices`
    3. `assets/voices/` inside this repository (git-ignored by convention)
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Voice id -> (language, quality, gender, notes)
BUNDLED_VOICE_INFO = {
    "en_US-ryan-medium": ("en-US", "medium", "male", "Narrator / documentary lead (Edge: Guy, Andrew, Eric)"),
    "en_US-amy-medium": ("en-US", "medium", "female", "Female lead / young voice (Edge: Jenny, Aria, Ana)"),
    "en_GB-alan-medium": ("en-GB", "medium", "male", "Older, gravelled mentor voice (Edge: Christopher, Thomas)"),
}
DEFAULT_URL_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US"


def target_dir(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    env = os.environ.get("PIPER_VOICE_DIR")
    if env:
        return Path(env).expanduser()
    return Path.home() / ".cache" / "piper_voices"


def voice_files(directory: Path) -> list[Path]:
    return sorted(directory.glob("*.onnx")) if directory.is_dir() else []


def cmd_check(args: argparse.Namespace) -> int:
    from engine.voice_engine import _piper_available, piper_voice_dir, PIPER_EDGE_ALIASES

    directory = piper_voice_dir()
    try:
        import piper  # noqa: F401
        piper_installed = True
    except ImportError:
        piper_installed = False

    status = {
        "piper_package_installed": piper_installed,
        "piper_voice_dir": str(directory) if directory else None,
        "models_found": [p.name for p in voice_files(directory)] if directory else [],
        "offline_voiceover_ready": bool(piper_installed and _piper_available()),
        "edge_voice_aliases": PIPER_EDGE_ALIASES,
    }
    print(json.dumps(status, indent=2))
    if not status["offline_voiceover_ready"]:
        print(
            "\nOffline voiceover is NOT ready.\n"
            "  1. pip install piper-tts\n"
            "  2. python3 tools/fetch_piper_voices.py install --from-dir /path/to/piper_voices\n",
            file=sys.stderr,
        )
    return 0 if status["offline_voiceover_ready"] else 1


def cmd_list(_args: argparse.Namespace) -> int:
    print(json.dumps({"recommended_offline_voices": BUNDLED_VOICE_INFO}, indent=2))
    return 0


def _download(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + ".partial")
    with urllib.request.urlopen(url, timeout=120) as resp, tmp.open("wb") as fh:
        shutil.copyfileobj(resp, fh)
    tmp.replace(dst)


def cmd_install(args: argparse.Namespace) -> int:
    dest = target_dir(args.dir)
    dest.mkdir(parents=True, exist_ok=True)
    voices = args.voice or list(BUNDLED_VOICE_INFO)
    installed: list[str] = []

    if args.from_dir:
        src_dir = Path(args.from_dir).expanduser()
        for name in voices:
            for suffix in (".onnx", ".onnx.json"):
                src = src_dir / f"{name}{suffix}"
                if src.exists():
                    shutil.copyfile(src, dest / src.name)
                    installed.append(src.name)
        print(json.dumps({"voice_dir": str(dest), "copied": installed}, indent=2))
        return 0 if installed else 1

    if not args.url_base:
        print(
            "No download source given.\n"
            "Piper voices are hosted at https://huggingface.co/rhasspy/piper-voices — if this\n"
            "machine can reach it, run:\n\n"
            "  python3 tools/fetch_piper_voices.py install \\\n"
            "      --url-base https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US\n\n"
            "If it cannot (air-gapped sandbox), download the .onnx/.onnx.json pair on a connected\n"
            "machine and copy them in with --from-dir.",
            file=sys.stderr,
        )
        return 1

    for name in voices:
        for suffix in (".onnx", ".onnx.json"):
            url = f"{args.url_base.rstrip('/')}/{name}{suffix}"
            try:
                _download(url, dest / f"{name}{suffix}")
                installed.append(f"{name}{suffix}")
            except Exception as exc:  # noqa: BLE001 - report and continue
                print(f"failed: {url} ({exc})", file=sys.stderr)
    print(json.dumps({"voice_dir": str(dest), "downloaded": installed}, indent=2))
    return 0 if installed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Set up offline Piper voices for the animation toolbook.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    pc = sub.add_parser("check", help="Report whether offline voiceover is ready")
    pc.add_argument("--dir", default=None)
    pc.set_defaults(func=cmd_check)

    pl = sub.add_parser("list", help="List recommended offline voices & Edge voice aliases")
    pl.set_defaults(func=cmd_list)

    pi = sub.add_parser("install", help="Install .onnx voices into the Piper voice directory")
    pi.add_argument("--voice", nargs="*", default=None, help="Voice ids (default: all recommended)")
    pi.add_argument("--from-dir", default=None, help="Copy voices from a local directory")
    pi.add_argument("--url-base", default=None, help="Base URL to download <voice>.onnx[.json] from")
    pi.add_argument("--dir", default=None, help="Destination directory (default: ~/.cache/piper_voices)")
    pi.set_defaults(func=cmd_install)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
