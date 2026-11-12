# PIPELINE CHANGELOG

Every change to the *reusable* production system — process files, templates, tests, house rules.
Per-video creative decisions belong in each project's `PRODUCTION_LOG.md`, not here.

Format: date · type · what changed · why · verification.

---

## 2026-11-12

### PC-011 · ENGINE FIX — subtitles and speech are now separate registers (KI-023)
- **Type:** engine feature + bug fix + gate + docs
- **What:** added `universal_toolbook/tts/verbalize.py`, which turns VOICEOVER_POLISH_PROMPT
  rules 5–7 into code (cardinals, years, dates, clock times, ranges, multipliers, ordinals,
  currency, percentages, codec/version tails, symbols, and acronyms via the existing
  pronunciation dictionary) and returns the spoken string **plus a display-token →
  spoken-word alignment**. `engine/voice_engine.py` keeps `dialogue[].text` as the subtitle
  source and speaks the verbalized form, carrying the alignment on `line_timings[].align`
  and the written form as the display string; `engine/episode.js` gained
  `mapDisplayTokensByAlignment` so subtitle glow follows the alignment instead of fuzzy
  word matching (which could never match `254` to "two hundred and fifty four").
  New optional `dialogue[].spoken` pronunciation override, validated by
  `tools/validate_specs.py:register_problems()` so it can change pronunciation but never
  meaning. `tools/creative_gate.py` and `tools/subtitle_check.py` now read both registers;
  `_find_phrase_time` verbalizes its `cue_on` phrase so a numeral-authored script still
  speech-locks its boards.
- **Why:** one string served both the TTS engine and the subtitles, so the polish prompt's
  spoken-form rules had to be hand-baked into the text the viewer reads. A board reading
  `254 days` ended up directly above a subtitle reading *two hundred and fifty four* — two
  registers of one fact in one frame. 13 lines across 6 committed specs were affected.
- **Verification:** `tests/unit/test_verbalize.py` (29 tests: rules, idempotence, no digits in
  the spoken register, the reproducer) and `tests/unit/test_subtitle_registers.py` (5 tests
  exercising the real Python→JS seam with the real episode compiler). The verbalizer is
  idempotent over all 427 shipped dialogue lines, and every migrated line's spoken form was
  confirmed byte-identical, so no film's audio changes — only its subtitles.

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

### PC-003 · `AGENTS.md` added and linked from `README.md`
- **Type:** process (permanent behaviour)
- **What:** codifies AUTOMATIC VIDEO CREATION MODE — a bare "Create a new video." activates the
  full workflow — plus the five input cases, the 20 ordered stages, decide-without-asking policy,
  house content rules, self-healing obligation, session safety and git discipline.
  `README.md` now opens with a §0 pointer so every session loads it first.
- **Why:** Part 14 requires the behaviour to live in the repository's actual agent instructions,
  not only in a chat prompt.
- **Verification:** `test_automatic_video_creation_rule_is_wired_into_agent_instructions` checks
  both the file and the `README.md` link.

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
- **What:** `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` is unchanged — sha256
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

### 2026-11-09 — repair stale production documentation examples
- Documentation verification exposed references to removed output folders after repository cleanup.
- Updated the workflow and orientation examples to use existing tracked outputs or specs; retained the path-checking gate rather than weakening it.
- Verification: `python3 tools/check_docs.py` resolves the references.

### PC-009 · Multi-line board cards need explicit height and spacing
- **Type:** authoring rule
- **What:** 3–4-line `notebook_page`, `sketch_card` and `checklist_card` boards use `h>=250`,
  `y~74` and fixed 42-pixel line spacing so every intended line stays inside the card.
- **Why:** video-003's first draft clipped lines from short `h:168` cards; the fix was project
  authoring geometry, not a renderer change.
- **Verification:** corrected board-cue frames were extracted and every line was inspected.

### PC-010 · 9:16 portrait boards need explicit width, centre and final-master inspection
- **Type:** authoring rule + tooling
- **What:** adds `portrait_w:460` and `portrait_x:0.5` to the PC-009 rule; documents that a
  corrected voiced draft is not proof a corrected master was rendered, and requires final-master
  board-cue frames after any geometry edit.
- **Why:** `fitBoardToPortraitViewport` otherwise leaves a wide board behind the character name
  tag in 9:16. The first video-003 master re-render reused a stale retimed spec and still showed
  the collision.
- **Verification:** `test_master_prompt_documents_multiline_board_geometry` guards all four
  values; the corrected master's S01 board frame shows a clear `MIRA` tag below the card.

### PC-011 · Docs checker ignores evidence labels and ffprobe language tags
- **Type:** tooling / regression
- **What:** `tools/check_docs.py` ignores `[M]/[O]/[P]`, `[V]/[I]/[A]`, individual evidence
  labels and the `und` target emitted by ffprobe as `[0x1](und)` / `[0x2](und)`.
- **Why:** copied production logs were being reported as unresolved markdown links/paths.
- **Verification:** `test_docs_checker_ignores_evidence_taxonomy_and_ffprobe_language_tags`;
  `python3 tools/check_docs.py` passes with the fresh video-003 run records present.

### PC-012 · Orchestrator invalidates stale `--resume` caches on spec changes
- **Type:** tooling / regression
- **What:** `tools/produce_video.py` stores the authoritative `episode.json` SHA-256 in an
  ignored `.work_cache_state/` directory and deletes stale `.work_*` render caches before a run
  when that hash changes. A unit test guards the implementation.
- **Why:** video-003 changed board geometry, but a manually regenerated `.work_final` retimed
  spec from the previous version was reused by `--resume`; the corrected draft looked right while
  the first re-rendered master still contained the old boards.
- **Verification:** `test_produce_video_invalidates_stale_render_caches`; the delivered master
  was produced after that invalidation, and its board-cue frames were inspected.

### PC-013 · Portrait crops prune unreadable world-prop label fragments (KI-012)
- **Type:** engine fix + regression
- **What:** `universal_toolbook/engine/video_renderer.js` computes how much of each `signpost`
  label plate lies inside the portrait crop for the current camera frame, and drops labels whose
  visible fraction is below 70%. `pruneClippedSignpostLabels` is exported for testing; the 16:9
  path supplies a full-width viewport and is unchanged.
- **Why:** the 9:16 crop follows the camera, so a label that is off-screen in the stills can
  drift into the frame later as a clipped colour chip with no text. That fragment appeared in the
  closing frames of the first video-003 master. Moving the prop once cannot fix a moving crop.
- **Verification:** the JS regression suite asserts pruning, retention, non-mutation and
  landscape identity; a freshly rendered closing frame was opened and has no edge fragment.
