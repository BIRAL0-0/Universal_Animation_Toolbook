# PIPELINE CHANGELOG

Every change to the *reusable* production system — process files, templates, tests, house rules.
Per-video creative decisions belong in each project's `PRODUCTION_LOG.md`, not here.

Format: date · type · what changed · why · verification.

---

## 2026-11-09

### PC-010 · ENGINE FIX — mixes now reach the documented loudness band (KI-008)
- **Type:** engine bug fix + reporting + gate
- **What:** `universal_toolbook/engine/audio_mixer.py` gained a loudness normalisation stage after the soft ceiling:
  a 3 ms fast-attack peak limiter (thr −10 dBFS, 6:1, 120 ms release) tames transients, then make-up
  gain lifts the body to the −17.5 dBFS midpoint, bounded by the RMS target, the −1 dBFS peak
  ceiling and a hard +8 dB cap. The mixer now reports `rms_dbfs`, `rms_dbfs_before_makeup` and
  `loudness_makeup_gain_db`; `tools/produce_video.py` measures the mixed WAV into
  `qa_measurements.json`; `tests/production/test_ki008_mix_loudness.py` gates every shipped master
  on both loudness bands and pins the limiter/make-up parameters.
- **Why:** video-001's first master measured −24.07 dBFS RMS (22 dB crest factor: brief transients
  pinned the peak while narration sat ~20 dB lower) — inaudible-thin on mobile speakers. An
  RMS-envelope compressor could not fix it (50 ms windows never see 3 ms transients); a fast peak
  limiter could. The house band existed in prose with no way to observe or enforce it.
- **Verification:** re-rendered masters measure peak −1.17 / RMS −17.50 dBFS (both in band),
  0 near-silent 1 s windows; engine suite plus KI-007/KI-008 tests pass.

### PC-009 · ENGINE FIX — 9:16 renders no longer encode landscape pixels (KI-007)
- **Type:** engine bug fix + gate
- **What:** removed the legacy `--portrait` branch in `run_studio.py cmd_render` that overwrote
  the dimensions computed by `_render_dimensions`, which had forced landscape pixels on every
  `--shorts` / `--aspect-ratio 9:16` render; made `--portrait` a pure alias; added
  `dimensions_match_aspect` to the validation report, which now hard-fails (`valid: false`) when
  pixels contradict the declared aspect; `tools/produce_video.py` refuses to continue past that
  gate.
- **Why:** the production system's own QA gate was reporting success for a wrong-orientation
  master. A gate that agrees with the bug is worse than no gate.
- **Verification:** `tests/production/test_ki007_aspect_pixels.py`; corrected portrait draft
  measured at 540×960 with `dimensions_match_aspect: true`; `run_studio.py check` still `OK`.
- **Blast radius checked:** existing specs never set `--portrait` at render time
  (`tools/build_wall_episode.py` consumes the flag itself to shape the spec), and with the flag
  absent the new code path returns exactly what `_render_dimensions` always returned for 16:9, so
  landscape masters are unchanged.

### PC-001 · `projects/` introduced as the permanent production library
- **Type:** structure
- **What:** new top-level `projects/` directory; each video gets an independent folder holding its
  prompt, research, topic selection, reference analysis, three script versions, storyboard,
  character sheet, scene plan, voiceover notes, asset manifest, logs, QA report, episode spec and
  final MP4. First occupant: `video-001-twenty-three-minutes`.
- **Why:** the master brief requires one video's changes never to damage the workflow for the
  next, and old prompts never to be overwritten.
- **Verification:** `tests/production/test_repo_hygiene.py::test_every_project_has_a_complete_archive`.

### PC-002 · `templates/MASTER_VIDEO_PRODUCTION_PROMPT.md` added
- **Type:** process
- **What:** the reusable per-video prompt template with `{{...}}` slots, the mandatory artifact
  list, the quality gate and the self-healing obligation.
- **Why:** Part 8 of the brief: every new video starts from a master template, saves a
  customised prompt before production, follows it step by step and logs deviations.
- **Verification:** `test_master_template_exists_with_required_sections`.

### PC-003 · `AGENT_OPERATING_RULES.md` added and linked from `START_HERE.md`
- **Type:** process (permanent behaviour)
- **What:** codifies AUTOMATIC VIDEO CREATION MODE — a bare "Create a new video." activates the
  full workflow — plus the five input cases, the 20 ordered stages, decide-without-asking policy,
  house content rules, self-healing obligation, session safety and git discipline.
  `START_HERE.md` now opens with a §0 pointer so every session loads it first.
- **Why:** Part 14 requires the behaviour to live in the repository's actual agent instructions,
  not only in a chat prompt.
- **Verification:** `test_automatic_video_creation_rule_is_wired_into_agent_instructions` checks
  both the file and the `START_HERE.md` link.

### PC-004 · House rule: no channel name anywhere
- **Type:** rule + enforcement
- **What:** no channel name, watermark or channel branding in any repository file. The engine's
  optional watermark field stays empty/omitted. Added after the client flagged a value written
  into video-001's spec.
- **Why:** client instruction, 2026-11-09.
- **Verification:** `test_no_channel_name_anywhere` (scans every JSON in the repo) and
  `test_project_specs_omit_channel_name_key`. Both pass; the only non-empty value in the repo was
  removed the same day.

### PC-005 · `docs/production/` self-healing logs created
- **Type:** structure
- **What:** `KNOWN_ISSUES.md`, `LESSONS_LEARNED.md`, `PIPELINE_CHANGELOG.md`, seeded from this
  session's real findings (KI-001…KI-006, L-01…L-09).
- **Why:** Part 10: recurring problems must be visible, fixes must be reusable, and nothing may be
  reported resolved without verification.
- **Verification:** entries cite the test or measured output that verifies each fix.

### PC-006 · `tests/production/` created
- **Type:** tests
- **What:** `test_repo_hygiene.py` (channel-name scan, polish-prompt sha256, project-archive
  completeness, template existence, auto-creation wiring) and
  `test_environment_readiness.py` (bootstrap checklist). Runnable via pytest or directly.
- **Why:** the master brief requires regression tests for fixed bugs and validation checks for the
  permanent rules.
- **Verification:** `.venv/bin/python tests/production/test_repo_hygiene.py` → all pass
  (see `PRODUCTION_LOG.md` of video-001 for the run record).

### PC-007 · Voiceover polish standard re-affirmed as immutable
- **Type:** rule
- **What:** `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md` is unchanged — sha256
  `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea`, 5256 bytes. A hash check now
  guards it.
- **Why:** Part 5: preserve it byte-for-byte; never silently rewrite, replace, weaken or remove.
- **Verification:** `test_voiceover_polish_prompt_is_byte_for_byte_intact`.

### PC-008 · `tools/produce_video.py` — one-command production orchestrator
- **Type:** tooling
- **What:** wraps the ordered stages for an existing project spec: validate → stills (both
  aspects) → draft → master render (9:16 primary, 16:9 secondary) → audio measurement → frame
  extraction for human/agent inspection → QA report skeleton. Prints a single machine-readable
  summary and refuses to continue past a failed gate.
- **Why:** Part 9/14: the workflow must be executable, not merely described, so future sessions
  follow the same steps without re-deriving them.
- **Verification:** used end-to-end for video-001; its summary is archived in that project's
  `PRODUCTION_LOG.md`.
