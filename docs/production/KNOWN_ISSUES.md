# KNOWN ISSUES — production

A living register of problems encountered during real productions. **Recurring problems are never
hidden here.** An issue is closed only when a fix exists, a regression check exists, and the fix
has been verified. Format: open issues first, then resolved.

Every entry: **stage** · **symptom** · **root cause** · **status** · **regression check**.

---

## OPEN

### KI-001 — No above-the-head HUD / floating counter primitive
- **Stage:** asset generation / animation (visual vocabulary)
- **First seen:** video-001, authoring (2026-11-09)
- **Symptom:** A concept wanted a number floating above a character's head. The engine has no
  such primitive — boards are screen-space and props are a fixed registered library
  (`universal_toolbook/process/08_LIMITS.md`).
- **Root cause:** the prop/board vocabulary predates any "attached HUD" use case.
- **Current mitigation (deliberate, logged):** the counter is expressed with speech-locked
  `stat_cards` boards plus an in-world `digital_clock` prop used diegetically as time-of-day;
  the narration line was reworded to describe what the film shows
  (`projects/video-001-twenty-three-minutes/SCRIPT_CHANGELOG.md` change #1).
- **Status:** OPEN — mitigation is adequate and honest; a real fix would add a `focus_counter`
  prop to `universal_toolbook/engine/world_props_and_boards.js` and register it in `SUPPORTED_PROPS`, which should
  be done if a future video needs an attached HUD.
- **Regression check:** n/a (feature request, not a bug). `validate` warns on unknown props, so a
  half-registered prop cannot ship silently.

### KI-002 — Portrait 9:16 leaves headroom above the information band
- **Stage:** animation / framing
- **First seen:** video-001 stills pass (2026-11-09), stills S01/S03
- **Symptom:** in speech-less stills the top ~40% of a 9:16 frame reads as empty wall.
- **Investigation (2026-11-09):** this was first logged as a framing defect and then
  **re-scoped after measurement**. The 9:16 crop is the full 1080-tall authored stage, whose top
  band is exactly where speech-locked boards land once TTS timings exist — draft frames at
  `board_pop + 1.6 s` (see `projects/video-001-.../QA_REPORT.md`) show the stat cards, phone cards
  and charts occupying that band. So during the actual film the top is the **information band**,
  not dead space, and it sits clear of YouTube Shorts' bottom UI overlay.
- **Residual issue:** before a board builds, and in scenes with no board, the band is briefly
  empty. That is inherent to cue-locked boards (KI-003) and is cosmetic.
- **Root cause (residual):** the renderer crops the stage at 1:1 and upscales; there is no
  portrait zoom control, only `portrait_focus` / `portrait_focus_x`.
- **Decision:** no engine change. A crop-level `portrait_zoom` was designed and rejected because
  it would clip the board band it is meant to improve; touching the shared zoom-out math risked
  every existing spec for a cosmetic gain. Documented instead.
- **Status:** OPEN (cosmetic, understood, deliberately not "fixed" with a risky change).
- **Regression check:** draft-frame inspection at `board_pop + 1.6 s` per scene in each project's
  `QA_REPORT.md`.

### KI-003 — Stills cannot show cue-locked boards at all (either aspect)
- **Stage:** QA
- **First seen:** pre-existing; confirmed by measurement on 2026-11-09 (video-001)
- **Symptom:** a board whose `cue_on` phrase has already been spoken is still absent from that
  scene's still — in **both** 9:16 and 16:9 — which reads as "the board is missing".
- **Root cause:** stills are rendered **without TTS**, so there are no speech timings for `cue_on`
  to resolve against; a cue-locked board therefore has no build time and never draws. This is
  stronger than the older wording ("sampled near scene start") implied.
- **Status:** OPEN by design; not a defect. Boards are verified from the **draft render** at
  `board_pop + 1.6 s`, which is now the documented board-QA method.
- **Regression check:** `QA_REPORT.md` must state which pass verified each board, and must include
  the draft-frame timestamps used.

---

## RESOLVED

### KI-007 — 9:16 renders silently encoded landscape pixels behind a 9:16 label
- **Stage:** rendering / QA gate
- **First seen:** video-001 draft render (2026-11-09); affected **every** `--shorts` and
  `--aspect-ratio 9:16` render, draft and master alike
- **Symptom:** `draft_9x16_validation_report.json` reported `"aspect_ratio": "9:16"`,
  `"output_profile": "shorts"`, `"valid": true` — while `ffprobe` showed the encoded stream was
  **960×540 landscape**. Frames extracted for QA were landscape compositions.
- **Root cause:** `run_studio.py cmd_render` first computed the correct size via
  `_render_dimensions(aspect_ratio, draft)`, then a legacy branch overwrote it:
  `if getattr(args, "portrait", False): width, height = … else: width, height = (960,540)/(1920,1080)`.
  Without the legacy `--portrait` flag the else-branch always forced landscape. The validation
  report derived `aspect_ratio` from the *request*, not the pixels, so the gate agreed with the
  lie.
- **Fix (three parts):**
  1. legacy `--portrait` now only aliases the aspect request (`--aspect-ratio` wins on conflict);
  2. the overwriting branch was deleted — `_render_dimensions` is the single source of truth;
  3. the validation report now computes `dimensions_match_aspect` and sets `valid: false` plus a
     warning when encoded pixels contradict the declared aspect.
- **Verification:** `tests/production/test_ki007_aspect_pixels.py` (6 checks: dimension table,
  absence of the clobbering branch, legacy alias mapping, gate expression, shipped-master pixel
  audit, `run_studio.py check` still OK). A corrected portrait draft render was produced and
  measured; its report reads `dimensions: [540, 960]`, `dimensions_match_aspect: true`.
- **Regression check:** the same test file, plus `produce_video.py` now refuses to continue when a
  validation report says `valid: false` or `dimensions_match_aspect: false`.

### KI-009 — Hand-authored `portrait_focus*` / board `portrait_w|_x` overrides push characters out of the 9:16 crop
- **Stage:** episode authoring (portrait)
- **First seen:** video-001 draft QA (2026-11-09): at t=7.13 s Kai was half-clipped at the left edge
  (S01); at t=77.37 s Kai was **entirely absent** (S05) while his board rendered fine.
- **Root cause:** the author (me) pinned `portrait_focus: "board"` / `portrait_focus_x` and per-board
  `portrait_w`/`portrait_x` "to protect the boards". But the engine already solves both problems by
  default: auto-focus follows the active character, and `fitBoardToPortraitViewport`
  (`universal_toolbook/engine/portrait_framing.js` L181) re-fits any board wider than the safe crop
  (`maxWidth = viewport.width − 48`, centred, clamped ±12 px). The overrides only *removed* the
  character framing the defaults provide. 38 overrides deleted across S01–S10.
- **Rule going forward:** never author portrait overrides as a first instinct. Render a draft and
  measure a framing problem first; add an override only with a timestamped frame as evidence and a
  note in the project's PRODUCTION_LOG.
- **Verification:** re-rendered draft + masters; QA frames at board_pop+1.6 s show character and
  board together in every scene (`projects/video-001-twenty-three-minutes/assets/qa_frames/`, project `QA_REPORT.md` §4).

### KI-008 — Every mix rendered ~6 dB under the documented loudness band, and no report could see it
- **Stage:** audio mix / QA gate
- **First seen:** video-001 master measurement (2026-11-09): peak −1.72 dBFS (in band) but
  RMS **−24.07 dBFS** against the documented band of −16 … −19 dBFS
- **Diagnosis:** windowed RMS (1 s windows) showed **0% near-silent windows** and a median *active*
  window of −24.2 dBFS. So the deficit was not dead air — the entire mix was quiet. Secondary
  finding: the render report recorded `peak_dbfs` only (`rms_dbfs: null` in every previously
  shipped report), so the documented band had never been observable by any gate.
- **Root cause:** `universal_toolbook/engine/audio_mixer.py` applied a peak *ceiling* (soft limiter) but no loudness
  *target*, and never reported RMS.
- **Fix:** a bounded make-up stage after the limiter drives RMS toward the −17.5 dBFS midpoint,
  limited by the RMS target, the −1 dBFS peak ceiling and a hard +6 dB cap (so it can neither clip
  nor rescue a broken silent mix); the mixer now returns `rms_dbfs`,
  `rms_dbfs_before_makeup` and `loudness_makeup_gain_db`, which flow into every render report.
- **Verification:** re-rendered video-001 masters measure inside both bands (see the project's
  `qa_measurements.json`); `tests/production/test_ki008_mix_loudness.py` gates shipped masters on
  both bands and pins the make-up stage's bounds.
- **Regression check:** same test file.

### KI-004 — Fresh sandbox has no ffmpeg, no Python packages, no canvas backend
- **Stage:** environment / rendering
- **First seen:** video-001 session start (2026-11-09)
- **Symptom:** `ffmpeg: command not found`; `ModuleNotFoundError: numpy`; empty `node_modules`.
- **Root cause:** the Arena sandbox is ephemeral and PEP 668 blocks system-wide `pip install`.
- **Fix:** create the repo-conventional `.venv`, install `universal_toolbook/requirements.txt`
  plus `pyyaml` into it, `npm install --prefix universal_toolbook`, then run
  `universal_toolbook/setup_tts.py` (Kokoro weights come from `api.github.com` git blobs, which
  the sandbox allowlist permits). Verified: `run_studio.py check` → `status OK`,
  `setup_tts.py` → `kokoro READY / piper READY`, and a 60-frame smoke render at 63 fps.
- **Verification:** `run_studio.py check` printed `"status": "OK"`; `setup_tts.py` exit 0 with
  both engines READY; stills + draft renders succeeded afterwards.
- **Regression check:** `tests/production/test_environment_readiness.py` (documented bootstrap
  sequence) and the bootstrap block in `README.md` §2.

### KI-005 — A channel name was written into a project spec
- **Stage:** delivery / house rules
- **First seen:** video-001 episode.json (2026-11-09), corrected same day on client instruction
- **Symptom:** `"channel_name": "Universal Animation Toolbook"` — a value the client never
  supplied and does not want stored anywhere.
- **Root cause:** the authoring template shows the field and it was filled with a placeholder
  that read like a real brand.
- **Fix:** the key was removed from the spec entirely; every other occurrence in the repo was
  already the empty default. The house rule ("no channel name anywhere") was codified in
  `AGENTS.md` §4 and enforced by a repo-wide scan.
- **Verification:** `tests/production/test_repo_hygiene.py::test_no_channel_name_anywhere` passes
  and scans every JSON file in the repository.
- **Regression check:** same test, plus `test_project_specs_omit_channel_name_key`.

### KI-006 — YouTube reference videos cannot be frame-sampled from the sandbox
- **Stage:** research / reference analysis
- **First seen:** video-001 research (2026-11-09)
- **Symptom:** only page metadata (title, views, likes, dates, chapters, transcript) is
  retrievable; no video frames, no thumbnails.
- **Root cause:** sandbox egress is allowlisted to github/pypi/npm hosts; the agent's page reader
  returns metadata only.
- **Fix:** the analysis is written with an explicit evidence taxonomy — **[V]** verified from page
  metadata, **[I]** inferred, **[A]** assumption — and the craft questions that need frames are
  answered by verifiable substitutes (parameterised `cast` guarantees consistency; extracted
  render frames guarantee composition). No claim is made that frames were watched.
- **Verification:** `projects/video-001-twenty-three-minutes/REFERENCE_ANALYSIS.md` tags every
  line; the access limitation is stated at the top of that file.
- **Regression check:** `TOPIC_SELECTION.md` / `RESEARCH.md` templates require the [M]/[O]/[P] and
  [V]/[I]/[A] taxonomies.

### KI-007 — documentation referenced removed production outputs (resolved)
- **Stage:** repository verification. The docs checker found paths to removed beacon and staircase output directories.
- **Cause:** examples in workflow documentation were not updated when old outputs were removed.
- **Fix:** point guidance to existing tracked examples and avoid asserting missing artifacts exist.
- **Regression check / verification:** `python3 tools/check_docs.py` passed after the edit; this checker also runs in CI.
