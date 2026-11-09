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
  4. Downloads the Kokoro v1.0 English voice set (33 single-tensor .pt
     files, pinned per-file SHA-256) and converts it to
     cache/tts/voices-v1.0-en.npz with the torch-free decoder in
     tools/convert_kokoro_v1_voices.py. OPTIONAL extra: if this step
     fails, the 11-voice v0.19 set in step 3 still works (voices from the
     v1.0 set then report as unavailable; see TTS_TROUBLESHOOTING.md).
  5. Installs Piper voices (en_US-ryan-medium, en_GB-alan-medium) from the
     repo's standard GitHub mirror via tools/fetch_piper_voices.py.
  6. Verifies: loads each engine and synthesizes a one-line test into
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

# Pinned Kokoro v1.0 English voice sources. The official v1.0 voice set ships
# as PyTorch tensor pickles; remsky/Kokoro-FastAPI commits the full set as
# plain git objects (one .pt per voice, ~0.5 MB each). Each .pt is a single
# (510, 1, 256) float32 style-vector tensor — the same format kokoro-onnx
# loads from npz — and synthesizes correctly on the v0.19 int8 model.
# Fetched by blob SHA (content-addressed) and verified against the pinned
# SHA-256, then converted to voices-v1.0-en.npz (torch-free; see
# tools/convert_kokoro_v1_voices.py).
KOKORO_V1_GIT = {
    "repo": "remsky/Kokoro-FastAPI",
    "voices": {
        "af_alloy": ("36981f4235961aef478d49e3649cce9274af277d", "6d877149dd8b348fbad12e5845b7e43d975390e9f3b68a811d1d86168bef5aa3"),
        "af_amelia_inno": ("2233a688cabae55d79a6bfdb9008a68809492325", "05c6d048e769dbfeadb23e4b2edea83d3a1d19b14ba9b98dff638723c9038f73"),
        "af_aoede": ("df19f3b73257a7e799e9dd28f22164b0f15ec13b", "c03bd1a4c3716c2d8eaa3d50022f62d5c31cfbd6e15933a00b17fefe13841cc4"),
        "af_bella": ("02e687473f3f264b62189b78b938113ae2e66f9d", "8cb64e02fcc8de0327a8e13817e49c76c945ecf0052ceac97d3081480e8e48d6"),
        "af_goodall_inno": ("f1d480313d5703e56007205933e83694e3eb2a44", "77c6b3359988944a66022ba0a419465db77a596b58c6c21ce56453cefee0f6af"),
        "af_heart": ("508d04af178bce67520acae4cb82ff4964d26f9c", "0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff"),
        "af_jadzia": ("a96fbecf27b1fac565ed7d6ee2ed51d4bcbdcbaf", "5ab4713eabcc2180d18d36cbc7540eebad253639aa4413dc3aa96b87b7db1154"),
        "af_jessica": ("728ab1b15b9aebe440db301f1c2d27d3c133a923", "cdfdccb8cc975aa34ee6b89642963b0064237675de0e41a30ae64cc958dd4e87"),
        "af_kore": ("dd7524696885fb28aaf3ee7e51465bdaf9e87d74", "8bfbc512321c3db49dff984ac675fa5ac7eaed5a96cc31104d3a9080e179d69d"),
        "af_nicole": ("207da10703d354c2da0a73b0999902f41f59372b", "c5561808bcf5250fe8c5f5de32caf2d94f27e57e95befdb098c5c85991d4c5da"),
        "af_nova": ("bc0cb9e3845a8cf73a629dc7be4208f52a24c6ec", "e0233676ddc21908c37a1f102f6b88a59e4e5c1bd764983616eb9eda629dbcd2"),
        "af_river": ("dc044777209219d025b9f66e67fc8260d9c8acb2", "e149459bd9c084416b74756b9bd3418256a8b839088abb07d463730c369dab8f"),
        "af_sarah": ("b488607d7e5b9daaeb01a6281f0a8e0200c110dc", "49bd364ea3be9eb3e9685e8f9a15448c4883112a7c0ff7ab139fa4088b08cef9"),
        "af_sky": ("a047bc6b45a7b547e65e98775963f98a2d48246c", "c799548aed06e0cb0d655a85a01b48e7f10484d71663f9a3045a5b9362e8512c"),
        "am_adam": ("f36cd12528fd3b55ca2c2d5ef0474066f1899215", "ced7e284aba12472891be1da3ab34db84cc05cc02b5889535796dbf2d8b0cb34"),
        "am_echo": ("0607cbee88eeaaeaa4bda0827b83ac05079054a9", "8bcfdc852bc985fb45c396c561e571ffb9183930071f962f1b50df5c97b161e8"),
        "am_eric": ("3d63fab28bef81e93280af93cd4f32c28dd3b7e3", "ada66f0eefff34ec921b1d7474d7ac8bec00cd863c170f1c534916e9b8212aae"),
        "am_fenrir": ("7e83cfb9f248ec9c275cba2622e83b4a2a2f42ad", "98e507eca1db08230ae3b6232d59c10aec9630022d19accac4f5d12fcec3c37a"),
        "am_liam": ("7aeeb0f3fe7c8319d6feba5b9c98fdab522d94ac", "c82550757ddb31308b97f30040dda8c2d609a9e2de6135848d0a948368138518"),
        "am_michael": ("b755169debb4c8a0f99cf83f14f5e53a58e3cfa9", "9a443b79a4b22489a5b0ab7c651a0bcd1a30bef675c28333f06971abbd47bd37"),
        "am_onyx": ("90c3a3d0f5413ca58402898c90913d852cc53488", "e8452be16cd0f6da7b4579eaf7b1e4506e92524882053d86d72b96b9a7fed584"),
        "am_price_inno": ("69e4bc5df71002b756f2aed8ef3ef8279bfcf92b", "5ac7f1233cfedb2b8e4672c66c71cb106060df3ae28e61308437133081d67988"),
        "am_puck": ("837740e41a46ac01bbbcb3f94be324741a73dc58", "dd1d8973f4ce4b7d8ae407c77a435f485dabc052081b80ea75c4f30b84f36223"),
        "am_santa": ("26b612a01a9156055c6b3c50d296ea9e3590c6dd", "7f2f7582fa2b1f160e90aafe6d0b442a685e773608b6667e545d743b073e97a7"),
        "bf_alice": ("81c3819480cd99c006b29b42ce19d63c9f91df08", "d292651b6af6c0d81705c2580dcb4463fccc0ff7b8d618a471dbb4e45655b3f3"),
        "bf_emma": ("c020e8546bf59a99be537cdfe0a8e1ffea214d45", "d0a423deabf4a52b4f49318c51742c54e21bb89bbbe9a12141e7758ddb5da701"),
        "bf_isabella": ("c9e2d731d517f24b13827389bb2381834c4acc75", "cdd4c37003805104d1d08fb1e05855c8fb2c68de24ca6e71f264a30aaa59eefd"),
        "bf_lily": ("3f6019fe61b3fef36e37192ec422d7331dbf4c2e", "6e09c2e481e2d53004d7e5ae7d3a325369e130a6f45c35a6002de75084be9285"),
        "bm_atten_inno": ("6e31ebf71d8919126096205ab65d95bd22731823", "af3c136bb6f3af5fd175e64a2583948e3a5d13f9936768876227a2d58ef012ac"),
        "bm_daniel": ("babba456cb54854e0931f4b0e35949a660c434c7", "fc3fce4e9c12ed4dbc8fa9680cfe51ee190a96444ce7c3ad647549a30823fc5d"),
        "bm_fable": ("97ab30b543771f53dfc13d24dab447d2f16d0004", "d44935f3135257a9064df99f007fc1342ff1aa767552b4a4fa4c3b2e6e59079c"),
        "bm_george": ("30773413008d04b19772eb2548ed1229fca2fe63", "f1bc812213dc59774769e5c80004b13eeb79bd78130b11b2d7f934542dab811b"),
        "bm_lewis": ("529102a4d9ccaa2fea712e69a5e4fccdb568a138", "b5204750dcba01029d2ac9cec17aec3b20a6d64073c579d694a23cb40effbd0e"),
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
def _download_git_blob_bytes(repo: str, blob_sha: str) -> bytes:
    url = f"https://api.github.com/repos/{repo}/git/blobs/{blob_sha}"
    req = urllib.request.Request(url, headers={"User-Agent": "toolbook-tts-setup"})
    req.add_header("Accept", "application/vnd.github.raw")
    with urllib.request.urlopen(req, timeout=900) as r:
        return r.read()


def _download_git_blob(repo: str, blob_sha: str, dest: Path, size_mb: float) -> None:
    log(f"  downloading {dest.name} ({size_mb} MB) from github.com ...")
    t0 = time.time()
    data = _download_git_blob_bytes(repo, blob_sha)
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
def _validate_v1_voices_npz(p: Path) -> list[str] | None:
    """Voice names if the v1.0 npz is structurally valid, else None.

    Per-file integrity is guaranteed by the pinned .pt SHA-256 at build
    time; this validates the converted artifact so a corrupt/partial npz
    is rebuilt instead of served.
    """
    try:
        import numpy as np
        with np.load(p) as z:
            names = sorted(z.files)
            if len(names) != len(KOKORO_V1_GIT["voices"]):
                return None
            for n in names:
                a = z[n]
                if a.shape != (510, 1, 256) or a.dtype != np.float32:
                    return None
                if not np.isfinite(a).all():
                    return None
            return names
    except Exception:
        return None


def install_kokoro_v1_voices(check_only: bool) -> bool:
    step(4, "Kokoro v1.0 English voice set (33 voices, torch-free conversion)")
    d = REPO_ROOT / "cache" / "tts"
    p = d / "voices-v1.0-en.npz"
    if check_only:
        names = _validate_v1_voices_npz(p) if p.exists() else None
        if names:
            log(f"  voices-v1.0-en.npz: verified ({len(names)} voices)")
            return True
        log("  voices-v1.0-en.npz: MISSING (optional — the 11-voice v0.19 set "
            "still works; v1.0-only voices report as unavailable)")
        return False
    d.mkdir(parents=True, exist_ok=True)
    if p.exists():
        if _validate_v1_voices_npz(p):
            log("  voices-v1.0-en.npz: present + validated — skipped")
            return True
        warn("voices-v1.0-en.npz present but failed validation — rebuilding")
        p.unlink()

    from tools.convert_kokoro_v1_voices import build_v1_voices_npz

    log(f"  downloading {len(KOKORO_V1_GIT['voices'])} pinned .pt files from "
        f"{KOKORO_V1_GIT['repo']} and converting (no torch needed) ...")
    pt_bytes: dict[str, bytes] = {}
    t0 = time.time()
    try:
        for name, (blob, sha256) in KOKORO_V1_GIT["voices"].items():
            data = _download_git_blob_bytes(KOKORO_V1_GIT["repo"], blob)
            h = hashlib.sha256(data).hexdigest()
            if h != sha256:
                raise RuntimeError(f"{name}.pt sha256 mismatch (got {h[:16]}...)")
            pt_bytes[name] = data
        build_v1_voices_npz(pt_bytes, p)
    except Exception as e:
        p.unlink(missing_ok=True)
        warn(f"v1.0 voice set download/conversion failed: {e}")
        warn("continuing with the 11-voice v0.19 set only — v1.0 voices will "
             "report as unavailable (see docs/production-workflow/TTS_TROUBLESHOOTING.md)")
        return False
    names = _validate_v1_voices_npz(p)
    if not names:
        warn("converted npz failed post-build validation — removing")
        p.unlink(missing_ok=True)
        return False
    log(f"  {len(names)} voices -> {p.name} ({p.stat().st_size/1e6:.1f} MB) "
        f"in {time.time()-t0:.0f}s (all SHA-256 verified)")
    return True


# ---------------------------------------------------------------------- 5
def install_piper_voices(check_only: bool) -> None:
    step(5, "Piper voices (GitHub mirror)")
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


# ---------------------------------------------------------------------- 6
def verify_engines(check_only: bool) -> dict:
    step(6, "Verification (real 1-line synthesis)")
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
    # prove the v1.0 merge works: synthesize one v1.0-only voice if present
    try:
        eng = get_engine("kokoro")
        voices = eng.voices()
        if "af_heart" in voices:
            t0 = time.time()
            res = eng.synthesize("Extended voice set check: af heart, v1 point 0.", voice="af_heart")
            wav = out / "kokoro_v1_check.wav"
            A.write_wav(wav, res.audio, res.sample_rate)
            log(f"  kokoro v1.0 set: OK — {len(voices)} voices available, "
                f"af_heart spoke {res.duration:.1f}s in {time.time()-t0:.1f}s -> {wav}")
        else:
            log(f"  kokoro v1.0 set: not loaded ({len(voices)} voices — v0.19 set only)")
    except Exception as e:
        warn(f"kokoro v1.0 set check: {type(e).__name__}: {e}")
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
        install_kokoro_v1_voices(True)
        install_piper_voices(True)
        report = verify_engines(True)
    else:
        install_packages(False)
        install_kokoro_weights(False)
        install_kokoro_v1_voices(False)
        install_piper_voices(False)
        report = verify_engines(False)

    print("\n" + "=" * 60)
    log("SETUP REPORT")
    for k, v in report.items():
        log(f"  {k:8}: {'READY' if v else 'NOT READY'}")
    log("=" * 60)
    if report.get("kokoro"):
        log("\nNext:  python3 universal_toolbook/generate_voiceover.py --input script.txt   # default voice: am_michael")
    elif not check_only:
        log("\nKokoro is not ready — see warnings above. Fix and re-run (idempotent).")
    log(f"Total: {time.time()-t0:.0f}s")
    sys.exit(0 if report.get("kokoro", check_only) else 1)


if __name__ == "__main__":
    main()
