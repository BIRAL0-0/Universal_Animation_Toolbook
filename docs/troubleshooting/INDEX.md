# Troubleshooting index

Start with the symptom, not with a random log. Every fix ends with the verification command that
proved it; never claim a repair without one.

| Symptom | Authoritative guide | Fast check |
|---|---|---|
| Missing Python package, PEP 668, `numpy` import failure | [`docs/getting-started/INSTALL.md`](../getting-started/INSTALL.md) §1 | `.venv/bin/python -c "import numpy, scipy, PIL, imageio_ffmpeg"` |
| `kokoro_ready: false`, `offline_voiceover_ready: false`, silent voice | [`docs/production/TTS_TROUBLESHOOTING.md`](../production/TTS_TROUBLESHOOTING.md) and [`docs/production/TTS_SETUP.md`](../production/TTS_SETUP.md) | `.venv/bin/python universal_toolbook/setup_tts.py --check` |
| Broken canvas/Node backend | [`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md) | `npm install --prefix universal_toolbook --no-audit --no-fund && python3 universal_toolbook/run_studio.py check` |
| Render reports `COMPLETE_SILENT` or warns `NO SPEECH WAS SYNTHESIZED` | [`docs/production/TTS_TROUBLESHOOTING.md`](../production/TTS_TROUBLESHOOTING.md), [`docs/production/VOICE_GENERATION.md`](../production/VOICE_GENERATION.md) | `python3 tools/validate_specs.py` then check the voice config |
| ffmpeg/ffprobe missing or a WAV measurement is empty | [`docs/production/VIDEO_ASSEMBLY.md`](../production/VIDEO_ASSEMBLY.md) §11.4, [`universal_toolbook/process/03_RENDER_PIPELINE.md`](../../universal_toolbook/process/03_RENDER_PIPELINE.md) §5 | `.venv/bin/python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"` |
| A quoted path or relative doc link does not resolve | [`tools/check_docs.py`](../../tools/check_docs.py), [`tools/validate_structure.py`](../../tools/validate_structure.py) | `python3 tools/check_docs.py --verbose` |
| CI workflow YAML or test path broken | [`tools/check_workflows.py`](../../tools/check_workflows.py), [`tests/README.md`](../../tests/README.md) | `python3 tools/check_workflows.py && python3 tools/validate_structure.py` |
| `runtime/` directories absent on a fresh clone | [`runtime/README.md`](../../runtime/README.md) | `mkdir -p runtime/cache runtime/work runtime/renders runtime/previews runtime/logs` |
| Standalone kit copy cannot find config, assets or weights | [`docs/getting-started/INSTALL.md`](../getting-started/INSTALL.md), [`universal_toolbook/README.md`](../../universal_toolbook/README.md) | `python3 scripts/verify_fresh_checkout.py` |
| Frame/audio sync, captions or camera issues | [`docs/architecture/RENDERING_PIPELINE.md`](../architecture/RENDERING_PIPELINE.md), [`docs/production/AUDIO_VISUAL_SYNCHRONIZATION.md`](../production/AUDIO_VISUAL_SYNCHRONIZATION.md) | `node tests/regression/run_all_tests.js` |
| Production-wide stage triage | [`docs/production/TROUBLESHOOTING.md`](../production/TROUBLESHOOTING.md) | locate the stage in [`docs/production/INDEX.md`](../production/INDEX.md) |
| Historical environment constraints / measured failures | [`docs/development/ENVIRONMENT_REPORT.md`](../development/ENVIRONMENT_REPORT.md), [`docs/architecture/BASELINE_INVENTORY.md`](../architecture/BASELINE_INVENTORY.md) | compare the current `check` JSON |

Legacy `output/`, `work/`, `.work_*`, `cache/` and old hand-off-folder paths remain ignored or
are mapped by `tools/check_docs.py`'s historical alias map. New code and documentation use
[`runtime/`](../../runtime/README.md) and [`deliverables/`](../../deliverables/README.md).
