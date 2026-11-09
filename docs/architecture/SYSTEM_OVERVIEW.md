# System overview — one authoritative location per responsibility

This is the current architecture. The pre-reorganization evidence and dependency map are preserved
in [`BASELINE_INVENTORY.md`](BASELINE_INVENTORY.md); the measured current graph is in
[`DEPENDENCY_MAP.md`](DEPENDENCY_MAP.md).

## The two halves

```
COMPLETE DEVELOPMENT REPOSITORY
├── AGENTS.md, skills/, docs/, templates/, projects/, examples/, tests/,
│   tools/, scripts/, deliverables/, runtime/
│   = rules + permanent knowledge + technical docs + one folder per film +
│     regression protection + distributable evidence + ignored scratch space
│
└── universal_toolbook/          ← COPYABLE RUNTIME KIT
    ├── run_studio.py            ← single production CLI
    ├── engine/                  ← flat JS frame renderer + Python audio/TTS
    ├── tts/                     ← Kokoro / Piper / Edge subsystem
    ├── tools/                   ← kit-internal helpers
    ├── config/                  ← studio + voice configuration
    ├── assets/                  ← fonts + 7 CC music tracks + catalog + licences
    ├── templates/               ← minimal runnable episode spec
    ├── process/                 ← kit-internal technical procedure
    ├── README.md, 01_TOOLBOOK_REFERENCE.md
    └── requirements.txt, package.json, package-lock.json, setup_tts.py
```

**Boundary:** the kit resolves every runtime path relative to `run_studio.py`. It has no import,
subprocess or file dependency on `tools/`, `scripts/`, `skills/`, `docs/`, `tests/`, `projects/`,
`examples/` or `deliverables/` at the repository root. Skills are agent knowledge, not runtime
dependencies. Copying `universal_toolbook/` alone gives a working renderer; copying the whole
repository gives the full production system for autonomous agents.

## Responsibility table

| Responsibility | Authoritative location | Explicitly not duplicated in |
|---|---|---|
| Rules for agents | `AGENTS.md` | old operating-rules / start-here / session-prompt files (now short redirects or removed) |
| Production procedure | `skills/animation-production/SKILL.md` + 5 specialist skills | per-video prompts, docs, kit process index |
| Per-video creative brief | `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` | kit master prompt, project-specific prompt copies (they are instances, not templates) |
| English voiceover edit standard | `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` (byte-for-byte immutable) | anywhere else |
| Architecture / dependency map | `docs/architecture/` | `universal_toolbook/process/` (removed repo map) |
| Setup / commands | `docs/getting-started/INSTALL.md`, `universal_toolbook/README.md` | root README (links only) |
| Detailed production stages | `docs/production/` | skills (link to details) |
| Verified failures / fixes | `docs/troubleshooting/INDEX.md`, `docs/production/KNOWN_ISSUES.md`, `LESSONS_LEARNED.md`, `PIPELINE_CHANGELOG.md` | ad-hoc chat history |
| Decisions | `docs/decisions/` | scattered prose in stage docs |
| Engine behaviour | `universal_toolbook/engine/`, `tts/`, `config/` | individual episode specs |
| Studio / voice defaults | `universal_toolbook/config/studio_config.json`, `universal_toolbook/tts/config/voices.json` | prose claims in docs |
| Asset catalog | `universal_toolbook/assets/bgm/BGM_CATALOG.json` | `ASSET_MANIFEST.json` (per-video usage, not catalog) |
| Episode scenes | `projects/<slug>/episode.json` | `SCENE_PLAN.json` (derived by `tools/make_scene_plan.py`) |
| Per-video documentation | `projects/<slug>/` | shared docs (only links) |
| Reference specs | `examples/` | projects (projects are finished films, not templates) |
| Regression protection | `tests/` | CI (CI only *runs* tests) |
| Distributable evidence | `deliverables/`, `projects/<slug>/final.mp4` | source directories |
| Temporary files | `runtime/` (ignored) | tracked source anywhere |

## Data flow

```
user idea / title / script / reference
  → AGENTS.md + skills (classify, research, script, polish)
  → projects/<slug>/PROMPT.md (saved first) + RESEARCH/SCRIPT/STORYBOARD/CHARACTERS
  → projects/<slug>/episode.json (cast, scenes, dialogue, camera_shots, boards, sfx)
  → tools/validate_specs.py / run_studio.py validate
  → tts/ + engine/voice_engine.py (Kokoro am_michael → word timings → retimed episode)
  → engine/audio_mixer.py + bgm_library.py (voice + CC BGM + foley → master WAV)
  → engine/episode.js compileEpisode() (frame-indexed scenes, chapters, subtitles, cues)
  → engine/video_renderer.js renderEpisodeFrame() (pure f(frame), raw RGBA → ffmpeg)
  → projects/<slug>/final.mp4 + reports + chapters + QA frames
  → QA_REPORT.md, PRODUCTION_LOG.md, deliverables/
```

Everything generated during development that is not a durable deliverable goes to `runtime/`.
See [`RENDERING_PIPELINE.md`](RENDERING_PIPELINE.md),
[`AUDIO_TTS_PIPELINE.md`](AUDIO_TTS_PIPELINE.md) and
[`ENGINE_MODULES.md`](ENGINE_MODULES.md).

## Decisions

- Remotion evaluated, not adopted — [`../decisions/ADR-0001-remotion-evaluation.md`](../decisions/ADR-0001-remotion-evaluation.md).
- Flat `engine/` retained — [`../decisions/ADR-0002-engine-layout.md`](../decisions/ADR-0002-engine-layout.md).
- Repository layout and migration — [`../decisions/ADR-0003-repository-layout.md`](../decisions/ADR-0003-repository-layout.md).
