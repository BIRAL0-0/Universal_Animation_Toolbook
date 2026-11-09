# Deliverable — self-hosted TTS upgrade + voice expansion (2026-11-03 / 2026-11-09)

This ZIP is the **source deliverable**: the repository with the TTS subsystem,
pipeline integration, tests, and docs, minus heavy runtime artifacts.

Mission 2 (2026-11-09) adds on top of mission 1:
* **44 selectable Kokoro voices** — the 11-voice v0.19 set plus the 33-voice
  English v1.0 set (23 new voices under plain names, 10 re-recordings as
  `<name>_v1` for A/B), downloaded as pinned `.pt` files and converted
  torch-free by `universal_toolbook/tools/convert_kokoro_v1_voices.py`.
* **`am_michael` primary default**, explicit selection policy in
  `universal_toolbook/tts/config/voices.json` (one run = one voice, deterministic, clear
  fallback with manifest recording).
* **Piper `speed` wired to the native `length_scale`** (default 1.0
  unchanged), fallback-only by policy.
* Voice comparison report + listening set: `docs/production-workflow/TTS_VOICE_COMPARISON.md`.

## What's inside (highlights)

| Path | What |
| --- | --- |
| `universal_toolbook/tts/` | The TTS subsystem (Kokoro/Piper/Edge providers, audio processing, segmentation, manifests, configs, test suite) |
| `universal_toolbook/setup_tts.py` | One-time setup (packages + SHA-256-pinned Kokoro weights + 33 pinned v1.0 voices + Piper voices + verification) |
| `universal_toolbook/tools/convert_kokoro_v1_voices.py` | Torch-free decoder for the v1.0 `.pt` voice tensors |
| `universal_toolbook/tools/tts_voice_benchmark.py` | Reproducible voice benchmark harness (same 4 genre scripts as mission 1) |
| `universal_toolbook/generate_voiceover.py` | The single generation command (resumable jobs, WAV/MP3, manifest) |
| `universal_toolbook/process_audio.py`, `validate_audio.py` | Reusable processing + validation |
| `universal_toolbook/engine/voice_engine.py` | Pipeline integration (`--voice kokoro`, Kokoro-first `auto` chain) |
| `docs/production-workflow/TTS_*.md` | Benchmark, setup, architecture, troubleshooting, **voice comparison**, measured environment |
| `outputs/tts_benchmark/` | (in git, not in this ZIP) committed voice samples to listen to |

## What's NOT in this ZIP (and how to get it back)

| Artifact | How to restore |
| --- | --- |
| Kokoro weights + v0.19 voices + v1.0 voices + Piper voices (~242 MB) | `python3 universal_toolbook/setup_tts.py` — re-downloads everything pinned and SHA-256 verifies (~2–3 min from github.com). Deliberately **not** in the ZIP to keep it small. |
| Past films in `outputs/` (git-tracked) | `git clone` the repo — all deliverable files are in git history. |
| Render output (`output/`, `work/`) | Re-run the render; voice caches make re-voicing cheap. |
| `.venv` / `node_modules` | `python3 -m venv .venv && .venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml && .venv/bin/python universal_toolbook/setup_tts.py` and `npm install --prefix universal_toolbook` |

## Verify it works (fresh machine, ~6 min)

```bash
python3 -m venv .venv
.venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
.venv/bin/python universal_toolbook/setup_tts.py          # setup + self-verify (incl. one v1.0 voice)
.venv/bin/python universal_toolbook/tts/test_tts.py       # full suite (91+ tests)
.venv/bin/python universal_toolbook/generate_voiceover.py --voices   # expect 44 Kokoro voices
```
