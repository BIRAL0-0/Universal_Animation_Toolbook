# Changelog

All notable changes to this repository. Historical workflow and pipeline records are preserved in
[`docs/production/WORKFLOW_CHANGELOG.md`](docs/production/WORKFLOW_CHANGELOG.md) and
[`docs/production/PIPELINE_CHANGELOG.md`](docs/production/PIPELINE_CHANGELOG.md); this file is the
authoritative repository-level change index. A change that affects the documented pipeline updates
its documentation and its regression tests in the same task.

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
