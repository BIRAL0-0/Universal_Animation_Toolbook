# Universal Animation Toolbook — Changelog

## [Unreleased]

### 2026-11-10 — v4.0.0 Studio-Grade Character, Physical Interaction, Continuity, Subtitle, Format Policy & Skills Upgrade
- **Canonical single-colour character rig (`universal_toolbook/engine/character_rig.js`)**: Upgraded `drawFigure` to a pure single-colour Minkowski tangent-capsule silhouette (`CANONICAL_CHARACTER_SPEC`) with seamless hip/knee/shoulder/elbow/neck welds, zero mismatched grey limbs, and explicit `gripL`/`gripR` hand anchors.
- **Physical object interaction lifecycle & human-ergonomic asset library (`universal_toolbook/engine/motion_library.js`, `universal_toolbook/engine/world_props_and_boards.js`, `universal_toolbook/engine/video_renderer.js`)**: Added 70 `SUPPORTED_ACTIONS`, full 14-step phone lifecycle (`reach_phone`, `pick_up_phone`, `hold_phone`, `phone_scroll`, `phone_type`, `put_down_phone`, `phone_call`) with single-instance `_attachedToActor` parent-switching, wrapping finger overlays, human-scale `desk`/`chair`/`table`/`door` props, automatic tabletop surface snapping, and table-bounds obstacle clamping.
- **Cross-cut room & prop state continuity (`universal_toolbook/engine/episode.js`)**: Added canonical `propRegistry` tracking across `location_id` scenes so moved objects and opened doors persist across camera cuts and scene returns.
- **Locked near-black studio visual identity (`universal_toolbook/engine/environments.js`, `universal_toolbook/config/studio_config.json`)**: Standardized restrained near-black minimal background grading with 1200 px overscan for seamless `9:16` and `16:9` vector projection.
- **Collision-aware subtitles, highlight spacing & strict speech cutoff (`universal_toolbook/engine/render_layout.js`, `universal_toolbook/engine/episode.js`, `universal_toolbook/engine/video_renderer.js`)**: Implemented pre-placement text measurement (`measureAndPlaceSubtitle`), full-limb + prop obstacle avoidance (`0 px` overlap), generous highlight capsule spacing, unclipped `16:9` and `9:16` chapter ribbons, and strict removal of subtitles at the end of spoken audio.
- **Automatic Video Format & Duration Policy (`universal_toolbook/run_studio.py`, `universal_toolbook/engine/render_layout.js`, `tools/make_scene_plan.py`, `scripts/new_project.py`)**: Enforced `< 60.0s -> 9:16 (1080x1920)` for YouTube Shorts and `>= 60.0s -> 16:9 (1920x1080)` for YouTube long-form, post-TTS boundary re-evaluation, and explicit override reporting.
- **Tactile object foley (`universal_toolbook/engine/audio_mixer.py`)**: Added stereo-panned `phone_pickup`, `phone_setdown`, `phone_tap`, `keyboard_tap`, `door_open`, `door_latch`, and `chair_sit` foley cues.
- **16 permanent specialist skills (`skills/`, `AGENTS.md`)**: Authored/upgraded 11 specialist skills (`character-design-and-rigging`, `stickman-animation`, `physical-interactions-and-props`, `animation-principles`, `cinematic-composition`, `environment-and-asset-continuity`, `subtitles-and-typography`, `animation-scriptwriting`, `youtube-storytelling-and-hooks`, `sound-design`, `animation-quality-assurance`) with attributed Remotion concept adaptations (zero React/Remotion runtime dependencies).
- **17-scenario visual regression suite & completed Short (`tests/regression/visual_regression_suite.js`, `examples/the_two_second_reach.json`, `videos/video-005/`)**: Added automated + visual regression coverage across all 17 scenarios and delivered `video-005` ("The Two-Second Reach", `32.66s`, `1080x1920` `9:16`, Kokoro `am_michael`).

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
