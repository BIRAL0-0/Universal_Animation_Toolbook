#!/usr/bin/env python3
"""One-time (idempotent) setup for the self-hosted TTS subsystem.

THE single documented setup command:

    python3 universal_toolbook/setup_tts.py            # everything
    python3 universal_toolbook/setup_tts.py --check    # readiness report only

What it does (each step is skipped when already done and verified):
  1. Environment checks: Python venv, disk space, RAM — with clear warnings.
  2. Installs Python packages if missing: core requirements,
     kokoro-onnx, piper-tts[alignment].
  3. Downloads Kokoro-82M int8 ONNX weights (92.4 MB) + voice set (5.8 MB)
     into cache/tts/ — from a pinned git blob on github.com, because
     huggingface.co and GitHub release assets are unreachable from the
     Arena sandbox. SHA-256 verified.
  4. Installs Piper voices (en_US-ryan-medium, en_GB-alan-medium) from the
     repo's standard GitHub mirror via tools/fetch_piper_voices.py.
  5. Verifies: loads each engine and synthesizes a one-line test into
     output/tts/_setup_check/, reports what works.

Safe to re-run after a session reset: existing valid files are kept, so a
warm run finishes in seconds. No permanent servers are started.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
sys.path.insert(0, str(HERE))

MIN_FREE_GB = 2.0
MIN_RAM_GB = 2.0

# Pinned weight sources. Kokoro-82M v0.19 int8 export, published as git
# objects (not LFS, not release assets — release-asset CDN is blocked in the
# sandbox) by puff-dayo/Kokoro-82M-Android. Fetching by blob SHA is
# content-addressed: the returned bytes must hash to the pinned SHA-256.
KOKORO_GIT = {
    "repo": "puff-dayo/Kokoro-82M-Android",
    "files": {
        "kokoro.onnx": {
            "blob": "fc4bccd2af2f86535ca66d5516d7a72d51d29d16",
            "sha256": "03e2815f4be9c8289b3b0919f40f5857acd24cfd121ca258cf042d309ee3a0cf",
            "size_mb": 92.4,
        },
        "voices.npz": {
            "blob": "e813f220d70a2531b2b4123741ed21cb14a726aa",
            "sha256": "157eab2fa1dd1c91b46599ea6f514bf86f66944c0c760250ed324e6cd99af075",
            "size_mb": 5.8,
        },
    },
}

PIPER_VOICES = ["en_US-ryan-medium", "en_GB-alan-medium"]
PIPER_MIRROR = ("007-Akira/Project-Rocky", "voices")


def log(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    print(f"  WARNING: {msg}", flush=True)


def step(n: int, title: str) -> None:
    print(f"\n=== [{n}] {title} ===", flush=True)


# ---------------------------------------------------------------------- 1
def check_environment(check_only: bool) -> bool:
    step(1, "Environment")
    ok = True
    if not (sys.prefix != sys.base_prefix):
        warn("running under the system Python. The toolbook uses a venv (.venv) — "
             "re-run from the venv: .venv/bin/python universal_toolbook/setup_tts.py")
        ok = False
    if check_only:
        return ok

    # disk
    usage = shutil.disk_usage(REPO_ROOT)
    free_gb = usage.free / 1e9
    log(f"  disk free: {free_gb:.1f} GB (need >= {MIN_FREE_GB} GB)")
    if free_gb < MIN_FREE_GB:
        warn(f"only {free_gb:.1f} GB free — downloads may fail")
        ok = False

    # ram
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal"):
                    ram_gb = int(line.split()[1]) / 1024 / 1024
                    log(f"  RAM: {ram_gb:.1f} GB (Kokoro needs ~0.7 GB)")
                    if ram_gb < MIN_RAM_GB:
                        warn(f"only {ram_gb:.1f} GB RAM — Kokoro may not fit")
                        ok = False
                    break
    except OSError:
        pass

    # pip works?
    r = subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True, text=True)
    log(f"  pip: {'ok' if r.returncode == 0 else 'UNAVAILABLE'} ({r.stdout.strip()[:60]})")
    return ok


# ---------------------------------------------------------------------- 2
def _pip_install(pkgs: list[str]) -> bool:
    log(f"  pip install {' '.join(pkgs)} ...")
    t0 = time.time()
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--quiet", *pkgs],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        warn("install failed:\n" + (r.stderr or r.stdout)[-800:])
        return False
    log(f"  installed in {time.time()-t0:.0f}s")
    return True


def check_import(name: str) -> bool:
    import importlib
    try:
        importlib.import_module(name)
        return True
    except Exception:
        return False


def install_packages(check_only: bool) -> None:
    step(2, "Python packages")
    if check_only:
        return
    # core toolbook requirements
    req = HERE / "requirements.txt"
    if req.exists() and not (check_import("numpy") and check_import("imageio_ffmpeg")):
        if not _pip_install([f"-r{req}"]):
            log("  (core requirements install failed — continuing, may surface later)")
    for pkg, mod in [("kokoro-onnx", "kokoro_onnx"),
                     ("piper-tts[alignment]", "piper")]:
        if check_import(mod):
            log(f"  {mod}: present — skipped")
        else:
            _pip_install([pkg])


# ---------------------------------------------------------------------- 3
def _download_git_blob(repo: str, blob_sha: str, dest: Path, size_mb: float) -> None:
    url = f"https://api.github.com/repos/{repo}/git/blobs/{blob_sha}"
    req = urllib.request.Request(url, headers={"User-Agent": "toolbook-tts-setup"})
    req.add_header("Accept", "application/vnd.github.raw")
    log(f"  downloading {dest.name} ({size_mb} MB) from github.com ...")
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=900) as r:
        data = r.read()
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    h = hashlib.sha256(data).hexdigest()
    log(f"  {len(data)/1e6:.1f} MB in {time.time()-t0:.0f}s, sha256 {h[:16]}...")
    tmp.replace(dest)


def install_kokoro_weights(check_only: bool) -> None:
    step(3, "Kokoro-82M weights (int8 ONNX, GitHub git-blob source)")
    d = REPO_ROOT / "cache" / "tts"
    ok = True
    if check_only:
        for name, meta in KOKORO_GIT["files"].items():
            p = d / name
            exists = p.exists() and hashlib.sha256(p.read_bytes()).hexdigest() == meta["sha256"]
            log(f"  {name}: {'verified' if exists else 'MISSING'}")
            ok = ok and exists
        return
    d.mkdir(parents=True, exist_ok=True)
    for name, meta in KOKORO_GIT["files"].items():
        p = d / name
        if p.exists():
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            if h == meta["sha256"]:
                log(f"  {name}: present + sha256 verified — skipped")
                continue
            warn(f"{name}: present but sha256 MISMATCH — re-downloading")
            p.unlink()
        _download_git_blob(KOKORO_GIT["repo"], meta["blob"], p, meta["size_mb"])
        h = hashlib.sha256(p.read_bytes()).hexdigest()
        if h != meta["sha256"]:
            p.unlink()
            raise SystemExit(f"  ERROR: {name} sha256 mismatch after download (got {h[:16]}...)")
        log(f"  {name}: sha256 verified")


# ---------------------------------------------------------------------- 4
def install_piper_voices(check_only: bool) -> None:
    step(4, "Piper voices (GitHub mirror)")
    script = HERE / "tools" / "fetch_piper_voices.py"
    if check_only:
        r = subprocess.run([sys.executable, str(script), "check"], capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
            log(f"  offline_voiceover_ready: {d.get('offline_voiceover_ready')} "
                f"({', '.join(d.get('models_found', []))})")
            return
        except Exception:
            log(f"  check output: {r.stdout.strip()[:200]}")
            return
    r = subprocess.run(
        [sys.executable, str(script), "install",
         "--github", PIPER_MIRROR[0], "--github-path", PIPER_MIRROR[1],
         "--voice", *PIPER_VOICES],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        warn("piper voice install failed:\n" + (r.stderr or r.stdout)[-800:])
        return
    r = subprocess.run([sys.executable, str(script), "check"], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout)
        log(f"  installed: {', '.join(d.get('models_found', []))}")
    except Exception:
        log(f"  (check output unparsable; see {r.stdout.strip()[:120]})")


# ---------------------------------------------------------------------- 5
def verify_engines(check_only: bool) -> dict:
    step(5, "Verification (real 1-line synthesis)")
    report = {}
    if check_only:
        from tts.providers import available_engines, list_engines
        avail = available_engines()
        log(f"  available engines: {', '.join(avail) or 'none'} (known: {', '.join(list_engines())})")
        for e in list_engines():
            report[e] = e in avail
        return report
    from tts import get_engine
    from tts import audio as A

    out = REPO_ROOT / "output" / "tts" / "_setup_check"
    for name in ("kokoro", "piper"):
        try:
            eng = get_engine(name)
            t0 = time.time()
            res = eng.synthesize("Setup check complete. One two three, TTS.", voice="")
            wav = out / f"{name}_check.wav"
            A.write_wav(wav, res.audio, res.sample_rate)
            an = A.analyze(wav)
            report[name] = an.ok
            log(f"  {name}: OK — {res.duration:.1f}s audio in {time.time()-t0:.1f}s "
                f"(peak {an.peak_dbfs:.1f} dBFS) -> {wav}")
        except Exception as e:
            report[name] = False
            warn(f"{name}: {type(e).__name__}: {e}")
    # edge: availability only (network-dependent, never block setup on it)
    try:
        eng = get_engine("edge")
        report["edge"] = eng.is_available()
        log(f"  edge: package {'present' if report['edge'] else 'missing'} "
            f"(cloud service — only usable where speech.platform.bing.com is reachable)")
    except Exception as e:
        report["edge"] = False
        warn(f"edge: {e}")
    return report


def main() -> None:
    check_only = "--check" in sys.argv
    t0 = time.time()
    print("TTS SETUP — Universal Animation Toolbook")
    ok = True
    ok &= check_environment(check_only)
    if check_only:
        install_packages(True)
        install_kokoro_weights(True)
        install_piper_voices(True)
        report = verify_engines(True)
    else:
        install_packages(False)
        install_kokoro_weights(False)
        install_piper_voices(False)
        report = verify_engines(False)

    print("\n" + "=" * 60)
    log("SETUP REPORT")
    for k, v in report.items():
        log(f"  {k:8}: {'READY' if v else 'NOT READY'}")
    log("=" * 60)
    if report.get("kokoro"):
        log("\nNext:  python3 universal_toolbook/generate_voiceover.py --input script.txt --voice af_bella")
    elif not check_only:
        log("\nKokoro is not ready — see warnings above. Fix and re-run (idempotent).")
    log(f"Total: {time.time()-t0:.0f}s")
    sys.exit(0 if report.get("kokoro", check_only) else 1)


if __name__ == "__main__":
    main()
