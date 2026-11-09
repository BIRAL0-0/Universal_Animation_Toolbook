# ENVIRONMENT REPORT — Arena sandbox for the TTS upgrade

**Status: measured, not estimated.** Every value below was read from the actual
environment on 2026-11-03 (session date) with the commands shown. Re-run the commands if
the sandbox is re-provisioned; do not trust this file across sessions.

## 1. System

| Item | Value | Command |
| --- | --- | --- |
| OS | Debian GNU/Linux 12 (bookworm), kernel 6.1.158+ PREEMPT x86_64 | `cat /etc/os-release`, `uname -a` |
| CPU | Intel Xeon @ 2.60 GHz, **1 socket / 1 core / 2 threads = 2 vCPUs** | `lscpu`, `nproc` |
| RAM | **3.8 GiB total**, ~3.6 GiB available at measurement; **no swap** | `free -h` |
| GPU | **None** (no `nvidia-smi`, no `/dev/nvidia*`) | — |
| Disk | 21 GB root fs, **~20 GB free** at measurement | `df -h /` |

**Inference strategy consequence:** CPU-only, ONNX Runtime, **int8-quantized** model
(114 MB) to fit comfortably in 3.8 GB RAM. No PyTorch (a torch+GPU stack would exceed the
memory and disk budget and is pointless without a GPU).

## 2. Runtimes & package managers

| Item | Value | Notes |
| --- | --- | --- |
| Python | 3.11.2 at `/usr/bin/python3` | Meets `kokoro-onnx` requirement `>=3.10,<3.14` |
| pip | 23.0.1 (system, **PEP 668 externally-managed** → use a venv, never `--break-system-packages`) | `pip3 --version` |
| venv | `.venv/` in the repo root is the working interpreter (created this session) | wiped by session resets — see §6 |
| Node.js | v22.22.3, npm 10.9.8 | for the animation engine, not TTS |
| FFmpeg | **no system binary**; `imageio-ffmpeg` (pip) supplies one | `python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"` |
| espeak-ng | no system binary; **`espeakng-loader` (pip) bundles the library + data** | needed by Kokoro's phonemizer; no apt needed |
| torch | **not installed** (and not wanted here) | — |
| apt | **unreachable** (`deb.debian.org` blocked) | nothing can be installed via apt |
| piper voices | none installed in this fresh environment | the repo's `universal_toolbook/tools/fetch_piper_voices.py --github 007-Akira/Project-Rocky` mirror works |

## 3. Network (probed with curl, 2026-11-03)

| Host | Result | Consequence |
| --- | --- | --- |
| `pypi.org` / `files.pythonhosted.org` | 200 OK | **pip installs work** |
| `github.com` / `api.github.com` / `codeload.github.com` | 200 OK | **GitHub release downloads work** — this is what makes Kokoro feasible here |
| `huggingface.co` | **unreachable** | HF-hosted weights (Kokoro canonical repo, Chatterbox, MeloTTS, most Piper voices) are **not downloadable in this sandbox** |
| `speech.platform.bing.com` | **unreachable** | **Edge TTS cannot synthesize in this sandbox** — the quality complaint in the mission is about the cloud service; in-sandbox it fails per line and the engine falls back to Piper |
| `deb.debian.org` | unreachable | no apt packages |

**The decisive finding:** the `kokoro-onnx` project (MIT, 2.9k stars) publishes its model
files as **GitHub release assets** —

```
https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.int8.onnx   (114.1 MB)
https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin          (28.2 MB)
```

— which this sandbox **can** download. That single fact selects the whole inference
strategy: Kokoro-82M v1.0 **int8 ONNX** via the `kokoro-onnx` PyPI package, weights from
GitHub, CPU inference. (The same release also ships fp16/fp32 and the v1.1-zh model.)

## 4. Long-running processes & large downloads

- `bash` tool caps at 1800 s per call; use `start_process` for anything longer.
- A ~142 MB model download completes in well under a minute (measured).
- The repo's own convention for large artifacts: keep them **out of git** (`.gitignore`
  already ignores `*.onnx`, `assets/voices/`, `runtime/renders/`, `runtime/work/`). Model weights go to
  `runtime/cache/tts/` (new, git-ignored); the user downloads the whole workspace, so the weights
  travel with it without bloating git history.

## 5. Session persistence

- **Nothing persists between Arena sessions:** no venv, no pip packages, no model cache,
  no generated audio is guaranteed to survive. The repo's `.venv/` was wiped between two
  consecutive sessions of this same project (observed directly).
- Therefore the setup path is: `python3 universal_toolbook/setup_tts.py` (installs the
  pinned deps, downloads + verifies the weights, installs Piper voices, prints a
  readiness report). It is idempotent and fast when the cache exists.

## 6. Reproduction commands for this report

```bash
cat /etc/os-release; uname -a
lscpu | grep -E "Model name|CPU\(s\)|Thread|Core"; nproc
free -h; swapon --show
df -h /
python3 --version; pip3 --version; node --version; npm --version
for h in pypi.org api.github.com huggingface.co speech.platform.bing.com deb.debian.org; do
  curl -s -o /dev/null -w "%{http_code}\n" --max-time 8 "https://$h"; done
python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
```
