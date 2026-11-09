# Deliverable — self-hosted TTS upgrade (2026-11-03)

This ZIP is the **source deliverable**: the repository with the TTS subsystem,
integration, tests, and docs, minus heavy runtime artifacts.

## What's inside (highlights)

| Path | What |
| --- | --- |
| `universal_toolbook/tts/` | The TTS subsystem (Kokoro/Piper/Edge providers, audio processing, segmentation, manifests, configs, test suite) |
| `universal_toolbook/setup_tts.py` | One-time setup (packages + SHA-256-pinned Kokoro weights + Piper voices + verification) |
| `universal_toolbook/generate_voiceover.py` | The single generation command (resumable jobs, WAV/MP3, manifest) |
| `universal_toolbook/process_audio.py`, `validate_audio.py` | Reusable processing + validation |
| `universal_toolbook/engine/voice_engine.py` | Pipeline integration (`--voice kokoro`, Kokoro-first `auto` chain) |
| `docs/production-workflow/TTS_*.md` + `ENVIRONMENT_REPORT.md` | Benchmark, setup, architecture, troubleshooting, measured environment |
| `outputs/tts_benchmark/` | (in git, not in this ZIP) committed voice samples to listen to |

## What's NOT in this ZIP (and how to get it back)

| Artifact | How to restore |
| --- | --- |
| Kokoro/Piper model weights (~224 MB) | `python3 universal_toolbook/setup_tts.py` — re-downloads and SHA-256 verifies (~2 min from github.com). Deliberately **not** in the ZIP to keep it small. |
| Past films in `outputs/` (git-tracked) | `git clone` the repo — all 51 deliverable files are in git history. |
| Render output (`output/`, `work/`) | Re-run the render; voice caches make re-voicing cheap. |
| `.venv` / `node_modules` | `python3 -m venv .venv && .venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml && .venv/bin/python universal_toolbook/setup_tts.py` and `npm install --prefix universal_toolbook` |

## Verify it works (fresh machine, ~5 min)

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
.venv/bin/python universal_toolbook/setup_tts.py          # setup + self-verify
.venv/bin/python universal_toolbook/tts/test_tts.py       # 77 tests
```
