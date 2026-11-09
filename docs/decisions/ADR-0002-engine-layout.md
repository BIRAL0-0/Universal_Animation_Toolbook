# ADR-0002 — Keep the flat engine layout, document conceptual layers

**Date:** 2026-11-09 · **Status:** Accepted

## Context

The proposed target architecture showed `universal_toolbook/engine/` split into `rendering/`,
`animation/`, `composition/`, `audio/`, `voiceover/`, `synchronization/` and `orchestration/`.
The existing engine has 15 JavaScript modules plus 3 Python audio modules in one flat directory.

## Evidence

- Every JS module uses relative imports such as `require('./character_rig')` and
  `require('./world_props_and_boards')`. `video_renderer.js` alone imports 11 siblings.
- `tests/regression/run_all_tests.js` and `tools/make_poster.js` reference engine modules by path.
- `run_studio.py` inserts the kit root on `sys.path` and imports `engine.voice_engine`,
  `engine.audio_mixer`, `engine.bgm_library` and `tools.script_helper`.
- Conceptual layers overlap: `episode.js` compiles timing *and* composition; `video_renderer.js`
  draws frames *and* evaluates cameras *and* renders subtitles; `voice_engine.py` synthesizes
  speech *and* aligns cues. A strict folder split would force circular or cross-layer imports.
- The baseline suite passed; a physical move would touch every import, test and CI command without
  changing behaviour.

## Decision

**Do not physically split `universal_toolbook/engine/`.** Keep the working, tested module structure.
Publish the conceptual responsibility map in
[`../architecture/ENGINE_MODULES.md`](../architecture/ENGINE_MODULES.md) and the measured graph in
[`../architecture/DEPENDENCY_MAP.md`](../architecture/DEPENDENCY_MAP.md). The animation skill's
[`toolbook-renderer-map.md`](../../skills/animation-production/references/toolbook-renderer-map.md)
maps authoring fields to compiled fields and modules. New engine changes follow the extension rules
in `ENGINE_MODULES.md` and add a regression test.

## Consequences

- Zero broken imports; the copyable kit keeps its internal relative paths.
- Conceptual clarity is achieved through documentation and tests, not folder depth.
- A future split remains possible but requires its own ADR, a full import/test migration and a
  measured benefit.

## Verification

- Baseline and post-change `tests/regression/run_all_tests.js`,
  `tests/integration/test_studio_pipeline.py`, `tools/validate_specs.py` and the silent draft
  render all pass without modifying engine imports.
- `scripts/verify_fresh_checkout.py` proves the kit validates an episode from inside its own
  directory.
