# Changelog

All notable changes to this repository. Historical workflow and pipeline records are preserved in
[`docs/production/WORKFLOW_CHANGELOG.md`](docs/production/WORKFLOW_CHANGELOG.md) and
[`docs/production/PIPELINE_CHANGELOG.md`](docs/production/PIPELINE_CHANGELOG.md); this file is the
authoritative repository-level change index. A change that affects the documented pipeline updates
its documentation and its regression tests in the same task.

## 2026-11-10 — video-003 reusable pipeline fixes

### Added
- `tools/produce_video.py` now ties `.work_*` resume caches to the `episode.json` SHA-256 and
  clears them on change, with `test_produce_video_invalidates_stale_render_caches`.
- `tools/check_docs.py` ignores evidence-taxonomy labels and ffprobe's `(und)` tag in copied
  production logs, with `test_docs_checker_ignores_evidence_taxonomy_and_ffprobe_language_tags`.
- `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` documents `h>=250`, `y~74`, 42-pixel spacing,
  `portrait_w:460`, `portrait_x:0.5` and final-master board-frame inspection, guarded by
  `test_master_prompt_documents_multiline_board_geometry`.

### Recorded
- PC-009 / PC-010 / PC-011 / PC-012, KI-010 / KI-011 and L-10 / L-11 capture the video-003
  board-geometry, docs-checker and stale-cache findings with their verification evidence.

### Delivered
- `projects/video-003-first-plank/` and `deliverables/video-003-first-plank/`: "The First Plank",
  7 scenes / 42 lines, voiced `kokoro-offline:am_michael`, measured 126.038 s, primary 1080×1920
  and secondary 1920×1080 masters, 30 fps, `warnings: []`, full decode PASS, `QA_REPORT.md`
  signed off from opened frames and measured audio.
- `deliverables/releases/video-003-first-plank_RELEASE.zip`: both masters, text mirrors, poster,
  SVG storyboard, authoring set, QA contact sheets and rebuild notes.

## 2026-11-09 — post-reorganization validation and delivery evidence

### Added
- `docs/architecture/MIGRATION_REPORT.md`: complete architecture explanation, file-by-file
  migration table, before/after counts, Remotion decision, skills explanation and future-agent map.
- `docs/architecture/FINAL_TREE.md`: complete final tree of tracked, non-ignored files.
- `docs/development/VALIDATION_REPORT.md`: measured local gates, production smoke, fresh-checkout
  simulation, standalone-kit verification and explicit unverified items.

### Verified
- `tools/validate_structure.py`, `tools/check_docs.py`, `tools/check_workflows.py`,
  `tools/validate_specs.py`, `run_studio.py check`, JS regression, Python integration and
  `pytest tests/unit tests/production -q` all passed.
- `scripts/new_project.py` and `tools/produce_video.py --stop-after stills` passed on a temporary
  project; a silent 24-second draft rendered with a clean validation report.
- Seven generated images were actually inspected. WAV peak/RMS/clipping were measured; no
  subjective listening test was claimed.
- `scripts/verify_fresh_checkout.py` passed all 16 steps on commit
  `a2d311c79aaf359b265de56eb8a9e789011a6b07`, including a standalone kit validate and a silent
  draft render in a fresh clone.
- Opened [PR #18](https://github.com/BIRAL0-0/Universal_Animation_Toolbook/pull/18). GitHub
  Actions runs `42666120250` and `42666566679` both passed all five checks; merge is performed
  only after the final pushed commit's checks are green.

## 2026-11-09 — final verification and merge readiness

### Added
- `tools/validate_structure.py` and `tests/unit/test_repository_structure.py`: reject unresolved
  double-brace placeholders in the migration report, final tree, validation report and changelog.

### Verified
- Reconciled the local checkout with the pushed assigned branch after a snapshot restore; the
  staged tree matched `73cd477` exactly and the working tree is clean.
- A fresh-checkout simulation on `73cd477452042e68d52f44baed88a4d6d9161506` passed all 16
  steps, including standalone kit validation and a clean silent draft render; the last pushed
  commit is re-verified before merge.
- Local structure/doc/workflow/spec/environment/JS/Python/pytest gates all passed with the new
  placeholder guard. The final tree and migration counts were re-checked.

## 2026-11-09 — architecture reorganization, permanent skills, Remotion evaluation

### Added
- `AGENTS.md`: single authoritative rule set, architecture boundaries, skill activation map,
  automatic video-creation workflow, testing, generated-file and error-recovery rules.
- `skills/`: six permanent skills. `animation-production` is primary and teaches the **actual**
  frame renderer; specialist skills cover scriptwriting, stickman animation, voiceover/audio,
  YouTube research and production quality. References include the Toolbook renderer map,
  framework-independent animation principles, quarantined Remotion-specific techniques and
  source attribution with licence verification.
- `docs/architecture/`, `docs/getting-started/`, `docs/development/`, `docs/troubleshooting/`,
  `docs/decisions/`: authoritative technical documentation hierarchy and three ADRs.
- `scripts/new_project.py`, `templates/VIDEO_PROJECT_TEMPLATE/`, `tools/validate_structure.py`,
  `tests/unit/`: project creation, structure validation and regression protection.
- `runtime/`: a single git-ignored temporary workspace (`cache/`, `work/`, `renders/`,
  `previews/`, `logs/`).
- Root `CONTRIBUTING.md`, `LICENSE`, this `CHANGELOG.md`.

### Changed
- Consolidated five competing agent-instruction documents into `AGENTS.md` plus short redirects;
  the kit's duplicate master prompt, session prompt, repo map and second start page were removed
  and their unique content migrated into the skills, kit README and architecture docs.
- Moved the 25 stage documents from the former workflow-docs folder into `docs/production/` (the
  authoritative production-detail location), with setup, environment, roadmap and decision
  material moved to their owning directories. The English-only voiceover polish prompt was
  **relocated byte-for-byte**; its SHA-256 guard was updated to the new path.
- Unified distributable artifacts under `deliverables/` and removed the stale hand-off symlinks;
  all generated output paths now resolve under `runtime/`.
- Reorganized tests into `unit/`, `integration/`, `regression/`, `production/` and `fixtures/`;
  CI runs structure validation, doc links, Python tests, JS regression and render smoke.
- Updated the master production prompt, README, kit README, kit process index, CI and all
  canonical documentation paths.

### Decisions
- **Remotion not adopted** (ADR-0001): the custom renderer already provides frame-based timing,
  interpolation, sequencing, composition metadata, transitions, captions and speech-locked media
  sync. No React/Remotion/Three.js/Lottie/Tailwind dependency or code was added.
- **Flat `engine/` retained** (ADR-0002): relative CommonJS requires and regression tests make a
  physical split risky; conceptual responsibilities are documented instead.
- **Repository layout** (ADR-0003): one authoritative location per responsibility, self-contained
  kit, permanent skills, separated projects, docs, tests, deliverables and runtime.

## 2026-11-09 — production system (before this reorganization)

From `docs/production/PIPELINE_CHANGELOG.md`: engine fixes for speech-locked 9:16 pixel
dimensions (KI-007) and mix loudness (KI-008/PC-010); introduction of `projects/` as the
permanent production library; `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`; standing agent
rules; `docs/production/` self-healing logs; `tests/production/` hygiene suite; immutable
voiceover polish standard; `tools/produce_video.py` one-command orchestrator; house rule of no
channel name anywhere.

## 2026-11-03 — workflow documentation and TTS upgrade (historical)

From `docs/production/WORKFLOW_CHANGELOG.md`: codified the 13-stage content workflow, the
immutable English voiceover polish standard, the 10-criterion viral-potential rubric, the
`work/<slug>/` working convention, documented verified engine internals, and added the
self-hosted Kokoro TTS subsystem with 44 selectable voices, `am_michael` primary default,
Piper `length_scale` support, benchmark reports and committed listening samples.
