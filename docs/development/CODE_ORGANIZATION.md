# Code organization

The production runtime is **flat on purpose**: `universal_toolbook/engine/` holds both the
JavaScript canvas renderer and the Python audio/TTS orchestration. ADR
[`0002`](../decisions/ADR-0002-engine-layout.md) records why splitting them into
`rendering/`, `animation/`, `audio/` etc. was rejected: the entry point, Node subprocess and
config loader use relative paths, and a cosmetic split would break the copyable kit without
adding capability.

| Layer | Authoritative location | Owns |
|---|---|---|
| CLI / orchestration | [`universal_toolbook/run_studio.py`](../../universal_toolbook/run_studio.py), [`setup_tts.py`](../../universal_toolbook/setup_tts.py), [`generate_voiceover.py`](../../universal_toolbook/generate_voiceover.py) | `check`, `stills`, `render`, TTS install and synthesis |
| Frame renderer | [`universal_toolbook/engine/video_renderer.js`](../../universal_toolbook/engine/video_renderer.js) and its sibling `.js` modules | frame clock, episode compiler, character rig, motion, environments, captions |
| Audio | `universal_toolbook/engine/{voice_engine,audio_mixer,bgm_library}.py` | speech, mix, music |
| TTS providers | `universal_toolbook/tts/` | Kokoro, Piper, Edge, pronunciation, manifests |
| Configuration | `universal_toolbook/config/studio_config.json`, `universal_toolbook/tts/config/voices.json` | fps/dimension/voice defaults |
| Kit operational helpers | `universal_toolbook/tools/` | voice downloads, format conversion, standalone delivery server |
| Repository dev tools | [`tools/`](../../tools/README.md) | structure, docs, CI, specs and producer helpers — **not** a kit dependency |
| Tests | [`tests/`](../../tests/README.md) | unit, integration, regression, production contracts |
| Skills | [`skills/`](../../skills/README.md) | agent instructions; no runtime imports |
| Projects | [`projects/`](../../projects/) | independent per-video source/evidence |
| Deliverables | [`deliverables/`](../../deliverables/README.md) | durable packages and benchmark evidence |
| Temporary state | [`runtime/`](../../runtime/README.md) | ignored renders, stills, logs and caches |

Full module-by-module responsibility and dependency graphs:
[`docs/architecture/ENGINE_MODULES.md`](../architecture/ENGINE_MODULES.md) and
[`docs/architecture/DEPENDENCY_MAP.md`](../architecture/DEPENDENCY_MAP.md). Baseline evidence:
[`docs/architecture/BASELINE_INVENTORY.md`](../architecture/BASELINE_INVENTORY.md).

## Change rules

1. Keep engine modules' relative imports and `run_studio.py` paths valid in a standalone kit copy.
2. A shared-component change must update docs, tests and every affected call site in the same
   change; see [`AGENTS.md`](../../AGENTS.md) §7.
3. Never import a repo-level `tools/` module from `universal_toolbook/`, and never import a
   project-specific file into the engine.
4. Generated artifacts go under `runtime/` until explicitly promoted to `projects/` or
   `deliverables/`.
