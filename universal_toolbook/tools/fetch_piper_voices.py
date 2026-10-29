#!/usr/bin/env python3
"""
Offline neural voice setup for the Universal Animation Toolbook (Piper backend).

The toolbook's primary voice path is Microsoft Edge neural TTS (`edge-tts`). Sandboxes, CI
runners and air-gapped editing machines often cannot reach that endpoint — in those cases
`engine/voice_engine.py` transparently falls back to **Piper**, a fully local neural TTS
runtime, as long as `.onnx` voices are available:

    python3 tools/fetch_piper_voices.py check
    python3 tools/fetch_piper_voices.py list
    python3 tools/fetch_piper_voices.py install                      # from the canonical Hugging Face repo
    python3 tools/fetch_piper_voices.py install --voice en_US-ryan-medium
    python3 tools/fetch_piper_voices.py install --url-base <mirror>  # flat layout: <mirror>/<voice>.onnx
    python3 tools/fetch_piper_voices.py install --from-dir /media/usb/piper_voices
    python3 tools/fetch_piper_voices.py install --dry-run            # show the URLs, download nothing

Where huggingface.co is blocked but github.com is not (sandboxes, locked-down CI), any public
repository that carries the same .onnx pairs can be used instead:

    python3 tools/fetch_piper_voices.py install --github <owner>/<repo> [--github-ref main] \
        [--github-path voices]

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
# Canonical source. The repository is laid out as <lang>/<lang_REGION>/<name>/<quality>/<voice>.onnx,
# e.g. en/en_US/ryan/medium/en_US-ryan-medium.onnx -- NOT a flat directory.
HF_ROOT = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def hf_relpath(voice_id: str) -> str | None:
    """`en_US-ryan-medium` -> `en/en_US/ryan/medium`. None if the id is not in that shape."""
    lang_region, _, rest = voice_id.partition("-")
    name, _, quality = rest.rpartition("-")
    lang = lang_region.split("_")[0]
    if not (lang_region and name and quality):
        return None
    return f"{lang}/{lang_region}/{name}/{quality}"


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
            "  2. python3 universal_toolbook/tools/fetch_piper_voices.py install\n"
            "     huggingface.co blocked? add --github <owner>/<repo> --github-path <dir>,\n"
            "     or copy the files in with --from-dir /path/to/piper_voices\n",
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


def _github_api(path: str) -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"User-Agent": "universal-animation-toolbook"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"https://api.github.com{path}", headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def _github_raw(repo: str, sha: str) -> bytes:
    token = os.environ.get("GITHUB_TOKEN")
    headers = {
        "User-Agent": "universal-animation-toolbook",
        "Accept": "application/vnd.github.raw",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/git/blobs/{sha}", headers=headers
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        return resp.read()


def install_from_github(
    repo: str, ref: str, subdir: str, voices: list[str], dest: Path, dry_run: bool
) -> int:
    """Copy <voice>.onnx + .onnx.json out of a public GitHub repository (no git needed)."""
    try:
        tree = _github_api(f"/repos/{repo}/git/trees/{ref}?recursive=1")
    except Exception as exc:  # noqa: BLE001 - network/auth failure
        print(f"cannot read the file list of {repo}@{ref}: {exc}", file=sys.stderr)
        return 1

    by_path = {
        e["path"]: e["sha"]
        for e in tree.get("tree", [])
        if e.get("type") == "blob" and e["path"].endswith((".onnx", ".onnx.json"))
    }
    plan: list[tuple[str, str, str]] = []  # (voice, remote path, sha)
    missing: list[str] = []
    for name in voices:
        for suffix in (".onnx", ".onnx.json"):
            want = f"{subdir.strip('/')}/{name}{suffix}" if subdir else f"{name}{suffix}"
            path = want if want in by_path else next(
                (p for p in by_path if p.endswith("/" + f"{name}{suffix}")), None
            )
            if path is None:
                missing.append(f"{name}{suffix}")
            else:
                plan.append((f"{name}{suffix}", path, by_path[path]))

    if dry_run:
        print(json.dumps({
            "voice_dir": str(dest),
            "source": f"github:{repo}@{ref}",
            "dry_run": True,
            "plan": [{"file": local, "path": remote} for local, remote, _ in plan],
            "missing": missing,
        }, indent=2))
        return 0 if plan else 1

    dest.mkdir(parents=True, exist_ok=True)
    copied: list[str] = []
    for local, remote, sha in plan:
        try:
            data = _github_raw(repo, sha)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"failed: {remote} ({exc})", file=sys.stderr)
            continue
        (dest / local).write_bytes(data)
        copied.append(f"{local} ({len(data) / 1e6:.1f} MB)")

    report = {"voice_dir": str(dest), "source": f"github:{repo}@{ref}", "copied": copied}
    if missing:
        report["missing"] = missing
    print(json.dumps(report, indent=2))
    if not copied:
        return 1
    print("\nNext: python3 universal_toolbook/tools/fetch_piper_voices.py check", file=sys.stderr)
    return 0


def cmd_install(args: argparse.Namespace) -> int:
    dest = target_dir(args.dir)
    dest.mkdir(parents=True, exist_ok=True)
    voices = args.voice or list(BUNDLED_VOICE_INFO)
    installed: list[str] = []

    if getattr(args, "github", None):
        return install_from_github(
            args.github,
            args.github_ref,
            args.github_path or "",
            voices,
            dest,
            args.dry_run,
        )

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

    base = (args.url_base or HF_ROOT).rstrip("/")
    explicit_base = bool(args.url_base)

    planned: list[tuple[str, list[str]]] = []
    for name in voices:
        rel = hf_relpath(name)
        urls: list[str] = []
        if explicit_base:
            # A user-supplied mirror is usually a flat directory; the canonical layout is
            # tried second so a mirror of the whole HF tree also works.
            urls.append(f"{base}/{name}")
            if rel:
                urls.append(f"{base}/{rel}/{name}")
        elif rel:
            urls.append(f"{base}/{rel}/{name}")
        else:
            urls.append(f"{base}/{name}")
        planned.append((name, urls))

    if args.dry_run:
        print(json.dumps({
            "voice_dir": str(dest),
            "dry_run": True,
            "plan": [
                {"voice": name, "urls": [f"{base_url}{suffix}" for base_url in urls
                                         for suffix in (".onnx", ".onnx.json")]}
                for name, urls in planned
            ],
        }, indent=2))
        return 0

    failures: list[str] = []
    for name, urls in planned:
        for suffix in (".onnx", ".onnx.json"):
            ok = False
            last: Exception | None = None
            for base_url in urls:
                url = f"{base_url}{suffix}"
                try:
                    _download(url, dest / f"{name}{suffix}")
                    installed.append(f"{name}{suffix}")
                    ok = True
                    break
                except Exception as exc:  # noqa: BLE001 - try the next candidate URL
                    last = exc
            if not ok:
                failures.append(f"{name}{suffix}: {last}")
                if not installed:
                    # Nothing has worked yet: this machine almost certainly cannot reach the
                    # source. Stop instead of waiting out six network timeouts.
                    print(
                        f"Could not download {name}{suffix} from {base}.\n"
                        f"  last error: {last}\n\n"
                        "This machine has no route to huggingface.co. Two ways out:\n\n"
                        "  1. If github.com is reachable, copy the same .onnx pairs from any\n"
                        "     public repository that carries them:\n\n"
                        "       python3 universal_toolbook/tools/fetch_piper_voices.py install \\\n"
                        "           --github 007-Akira/Project-Rocky --github-path voices\n\n"
                        "  2. Otherwise copy them in from a machine that can download them:\n\n"
                        "       python3 universal_toolbook/tools/fetch_piper_voices.py install \\\n"
                        "           --from-dir /path/to/piper_voices\n\n"
                        "Voices are ~60 MB each: https://huggingface.co/rhasspy/piper-voices",
                        file=sys.stderr,
                    )
                    return 1

    report = {"voice_dir": str(dest), "downloaded": installed}
    if failures:
        report["failed"] = failures
    print(json.dumps(report, indent=2))
    if not installed:
        return 1
    print("\nNext: python3 universal_toolbook/tools/fetch_piper_voices.py check", file=sys.stderr)
    return 0


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
    pi.add_argument(
        "--url-base",
        default=None,
        help="Base URL for downloads (default: the canonical Hugging Face repo, which nests "
        "voices as <lang>/<lang_REGION>/<name>/<quality>/). A custom mirror is tried flat first.",
    )
    pi.add_argument("--dry-run", action="store_true", help="Print the download plan and exit")
    pi.add_argument(
        "--github",
        default=None,
        metavar="OWNER/REPO",
        help="Copy the .onnx pairs from a public GitHub repository, for machines where "
        "huggingface.co is unreachable but github.com is not",
    )
    pi.add_argument("--github-ref", default="main", help="Branch/tag/commit for --github")
    pi.add_argument(
        "--github-path", default=None, help="Directory inside the repository that holds the voices"
    )
    pi.add_argument("--dir", default=None, help="Destination directory (default: ~/.cache/piper_voices)")
    pi.set_defaults(func=cmd_install)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
