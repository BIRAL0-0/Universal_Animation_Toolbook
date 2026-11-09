# TTS SETUP

One-time setup for the self-hosted TTS subsystem. It is **idempotent** — re-run
it after any session reset and it skips what is already present and verified.

> The Arena sandbox is temporary: Python packages, model weights, and generated
> audio do **not** persist between sessions. This setup is the single command
> that rebuilds a working environment. Budget ~3–5 min cold (one ~98 MB weight
> download + 33 small voice files), seconds when warm.

## The one command

```bash
# from the repo root, using the toolbook venv
.venv/bin/python universal_toolbook/setup_tts.py
```

Readiness-only (no installs, no downloads):

```bash
.venv/bin/python universal_toolbook/setup_tts.py --check
```

## What it does (each step skipped when already done + verified)

| step | action |
| --- | --- |
| 1 Environment | warns if running under system Python (use the venv), checks free disk (≥ 2 GB) and RAM (≥ 2 GB) |
| 2 Packages | installs `requirements.txt` if missing, then `kokoro-onnx` and `piper-tts[alignment]` if not importable |
| 3 Kokoro weights | downloads `kokoro.onnx` (92.4 MB, int8) + `voices.npz` (5.8 MB, 11-voice v0.19 set) into `runtime/cache/tts/`, **SHA-256 verified** |
| 4 Kokoro v1.0 voices | downloads 33 pinned v1.0 `.pt` voice files (one per voice, ~0.5 MB each, **SHA-256 verified**) from `remsky/Kokoro-FastAPI` and converts them torch-free into `runtime/cache/tts/voices-v1.0-en.npz` (17.2 MB). **Optional extra** — if it fails, the 11-voice v0.19 set still works |
| 5 Piper voices | installs `en_US-ryan-medium` + `en_GB-alan-medium` via `universal_toolbook/tools/fetch_piper_voices.py --github 007-Akira/Project-Rocky` |
| 6 Verify | loads each engine and synthesizes a one-line test into `runtime/renders/tts/_setup_check/` (incl. one v1.0 voice when present), reports what works |

Exit code 0 = Kokoro ready. The end-of-run report lists each engine READY /
NOT READY.

## If the venv itself is gone (fresh sandbox)

```bash
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
.venv/bin/python universal_toolbook/setup_tts.py     # adds the TTS extras
```

## Where things live

| path | what | git |
| --- | --- | --- |
| `runtime/cache/tts/kokoro.onnx` | Kokoro-82M int8 model (92.4 MB) | ignored |
| `runtime/cache/tts/voices.npz` | Kokoro v0.19 voice set, 11 voices (5.8 MB) | ignored |
| `runtime/cache/tts/voices-v1.0-en.npz` | Kokoro v1.0 English voice set, 33 voices (17.2 MB), built from pinned `.pt` files | ignored |
| `~/.cache/piper_voices/*.onnx` | Piper medium voices (~60 MB each) | n/a (home) |
| `runtime/renders/tts/_setup_check/` | setup verification audio | ignored (`runtime/renders/`) |
| `runtime/renders/tts/<name>/` | generated voiceover jobs | ignored (`runtime/renders/`) |

`cache/` and `*.npz` are git-ignored. **Do not commit model weights.** To move
to a fresh machine, just re-run `setup_tts.py` (it re-downloads and
re-verifies). The deliverable workspace travels with the weights already
present, so a user who copies the folder does not need to re-download — but a
brand-new checkout does.

## Verifying a warm setup

```bash
.venv/bin/python universal_toolbook/setup_tts.py --check
# -> Kokoro-82M weights: verified   |   offline_voiceover_ready: True
.venv/bin/python universal_toolbook/generate_voiceover.py --voices   # list voices
```

## Environment overrides (minimal, for the temporary-session workflow)

| variable | effect | default |
| --- | --- | --- |
| `TTS_CONFIG` | alternate `voices.json` | `universal_toolbook/tts/config/voices.json` |
| `TTS_MODEL_DIR` | directory holding Kokoro weights | `<repo>/runtime/cache/tts` |
| `PIPER_VOICE_DIR` | directory holding Piper voices | `~/.cache/piper_voices` |

## No server is started

Setup and generation are on-demand: a process loads the model, synthesizes,
and exits. Nothing listens on a port and nothing is meant to keep running.
