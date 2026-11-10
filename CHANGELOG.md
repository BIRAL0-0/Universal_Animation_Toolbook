# Universal Animation Toolbook — Changelog

## [Unreleased]

### 2026-11-10 — Lean Repository Architecture Correction
- **Established authoritative video location**: `videos/` now contains all completed videos.
- **Migrated 4 completed videos**:
  - `video-001`: "What If Every Notification Cost You 23 Minutes?" (from `projects/video-001-twenty-three-minutes/`)
  - `video-002`: "Discipline vs Obsession — The Man Who Sacrificed Everything" (from `projects/video-002-discipline-vs-obsession/`)
  - `video-003`: "The First Plank" (from `deliverables/video-003-first-plank/`)
  - `video-004`: "The Two-Inch Bridge" (from `deliverables/two_inch_bridge_cel/`)
- **Created compact metadata records**: `record.json` for each video containing ID, title, topic, format, duration, status, date, filename, summary, fingerprint, tags, and version.
- **Created central catalog**: `videos/index.json` for duplicate prevention.
- **Established Git-ignored temporary workspace**: `runtime/` with subdirectories for jobs, cache, and temp.
- **Added duplicate detection system**: `universal_toolbook/config/duplicate_detection.py`
- **Added unit tests**: `tests/unit/test_video_index.py` and `tests/unit/test_cleanup_procedure.py`
- **Documented lean repository policy**: `universal_toolbook/process/09_LEAN_REPOSITORY_POLICY.md`
- **Updated .gitignore**: Excluded `runtime/`, old `projects/`, `deliverables/`, and `output/` locations.
- **Preserved permanent content**: Engine code, skills, templates, docs, tests, and tools remain intact.

[Previous entries...]
