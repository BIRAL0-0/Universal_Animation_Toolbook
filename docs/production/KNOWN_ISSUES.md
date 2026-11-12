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

### KI-020 — held poses were nearly motionless, with no deliberate stillness control (resolved)
- **Stage:** animation / motion evaluation
- **Symptom:** after KI-019 improved `idle_stand`, other frequent held poses remained nearly static. An isolated 8 s render audit of 15 actions measured character-region median frame delta at 0.132 for `sit_bench`, 0.213 for `hold_blueprint`, 0.290 for `cross_arms_skeptical`, 0.431 for `listen_nod` and 0.491 for `look_horizon`; the moving `sit_desk_type` control measured 1.969.
- **Root cause:** these actions supplied a static base pose and relied on speech-specific movement or camera motion for life. `idle_stand` had its own oscillators, but every other held action did not; layering another source onto idle made the result worse.
- **Fix:** `applySecondaryMotion` adds deterministic, actor-seeded weight shift, head attention, arm resettling and gaze drift for 17 named held actions. Locomotion, typing, sketching and other already-moving actions are excluded. It is applied once on both steady-state and beat-blend returns; `idle_stand`'s private oscillator copy is removed. A 0.4 s eased envelope removes edge snaps and the shared phase does not reset at a beat boundary.
- **Intentional stillness:** `secondary_motion` accepts `full` (default), `subtle` (0.35×) or `none` on an actor or beat; beat-level values override actor-level values. `none` removes only this shared layer, leaving base-pose motion intact. This is suitable for a deliberately quiet beat, but is not a literal freeze-frame switch.
- **Verification:** `tests/unit/test_secondary_motion.py` executes the evaluator for determinism, both return paths, defaults, actor/beat overrides, moving-action exclusion and transition behavior. The 15-action render audit after the layer measured 0.53–1.04 for the previously dead cluster and unchanged moving-action controls. Six character-region strips were inspected at multiple timestamps.
- **Honest limit:** pixel-difference magnitude establishes that pixels move, not that the motion is natural or emotionally correct. The layer makes a hold alive, not expressive; action selection and story fit remain human judgment. It is not a replacement for per-action animation refinement.
- **Status:** RESOLVED for shared secondary motion and authorable stillness strength.

### KI-019 — a film that passed every gate still looked like a slideshow (resolved)
- **Stage:** master visual QA, motion review
- **First seen:** video-003, 2026-11-10
- **Symptom:** `the-first-plank` v3 (130.62 s) satisfied every gate yet read as a still. A figure
  stood with its arms at its sides, unchanged, for six seconds at a time.
- **Root cause:** three rules each pulled toward stillness, and the review gate could not see the
  result.
  1. `motion_library` set `speakBoost = 0.0` for any character who was not speaking. Only 378
     dialogue lines exist across `examples/`, and just 112 (30%) are spoken by a character, so for
     70% of every film every on-screen actor was frozen.
  2. `idle_stand` — the pose almost every hold resolves to — animated only a ribcage breath.
     Character-region frame delta measured **0.500** against **9.753** for `walk`: a 20x gap that
     is invisible to the eye.
  3. `video_renderer` required a **0.10** zoom delta for a shot to count as significant, so
     **169 of 192 (88%)** authored shots had their zoom smeared across the whole scene, while
     `episode.js` separately gave every camera-less scene a silent `zoom_to ?? 1.04` creep. That
     creep moved enough pixels to clear `creative_review`'s absolute `0.0015` threshold, which is
     why the gate reported 0% static on a slideshow.
- **Fix:** `LISTEN_BOOST = 0.45` gives a non-speaking actor listening body language; `idle_stand`
  carries weight shift, head attention and arm resettle on four desynchronised periods; shot
  thresholds became `0.015/0.015/0.02` with a 2.6 s settle and the scene-level camera path now
  shares the significance test it never had; the `zoom_to` default creep is gone. `validate_specs`
  gained a `MAX_SINGLE_BEAT_SEC = 6.0` motion budget (15 specs held one pose for a whole scene;
  `discipline-vs-obsession` held `celebrate_arms_up` for 64.8 s). `creative_review` now measures
  relative motion in the stage band, because a typing board and subtitle glow change every frame
  and masked a motionless stage.
- **Regression check / verification:** rendered, not scored. `idle_stand` character-region motion
  rose from 0.500 to 0.601 median (p90 0.881 -> 1.418) and frame-strip inspection shows the figure
  shifting weight onto one hip and turning its head. `tests/unit/test_static_authoring.py` pins the
  listen boost, the idle oscillator count, the motion budget and that re-timed beats remain a valid
  partition of their scene.
- **Known limit:** locomotion still moves ~10x more than any rest pose. The rig animates travel
  well and holds at secondary-animation scale; closing that gap is per-action animation work.
  Which action belongs at a story beat remains human judgment — the gate can prove a pose changes,
  never that it changes well.

### KI-017 — a render reported COMPLETE while encoding no video at all

**Symptom.** `run_studio.py render --shorts --draft --workers 4` finished in 75 s, wrote
`status: COMPLETE`, `warnings: []`, and a validation report reading `valid: true` and
`frames: 3919`. The MP4 contained **one audio stream and no video stream**. The same spec
rendered correctly seconds later with `--workers 1`.

**Two defects, and the second is the dangerous one.**

1. **An intermittent encoder race.** Under four workers the frame pipe occasionally produced
   no video output while the audio muxed normally. The workaround is fewer workers — but a
   flaky encoder must never be allowed to pass silently.

2. **Every gate was computed from the plan, not the file.** `valid` was
   `compiled.errors == [] and dimensions_match_aspect`; `dimensions` and `frames` were read
   from the compiled episode. Nothing opened the output. The report described what the
   renderer *intended*, so a completely unplayable file scored as valid.

**Fix.** `_probe_output_streams()` asks ffprobe (falling back to imageio-ffmpeg) what was
actually written. `valid` now ANDs `artifact_ok`, a missing video stream appends a hard
warning, `status` becomes `INCOMPLETE_ENCODE`, and the command exits **3**.

**Regression test.** `tests/production/test_ki017_encoded_artifact.py` builds a real
audio-only MP4 with ffmpeg and asserts the probe reports zero video streams; it also checks
that `valid` is derived from the artifact and that every shipped master contains a video
stream. Verified to fail against the reintroduced defect before being trusted.

**Follow-on defect, same day.** The fix itself shipped broken: `artifact_ok` was referenced
before it was assigned, so *every* render crashed with `NameError`. All seven KI-017 tests
passed against the broken file, because six of them read the source as text. A seventh was
added that **executes** `render` on a two-second spec and requires the report to exist; it was
verified to fail against the reintroduced ordering bug.

**Lesson.** A validation report is only worth what it measures — and a test that greps source
code is not a test of behaviour. Both failures in this entry share one shape: confidence
derived from reading rather than running.

**Related, found while inspecting the re-render.** A `notebook_page` board placed at `y: 0.055`
has its top edge under the chapter-label strip, which sits at the top of the frame. `y: 0.105`
clears it at every board height from four to five lines.



### KI-015 — the style test measured a different region than the style gate

**Symptom.** `pytest` failed `test_published_thumbnails_match_their_films` on
`the-two-inch-bridge` at 0.615, while the CI step `thumbnail_style.py check ... --package`
printed **MATCH** at 0.627 for the same film and the same `thumbnail.jpg`.

**Cause.** `thumbnail_style.report()` defaults `art_fraction=None`. The documented invocation
reads `thumbnail_spec.art_fraction` from `record.json` (e.g. `0.72`) because a cover reserves a
text band and only the art above it belongs to the film. The test called `report()` bare, so it
profiled the whole cover including the typography band. Two measurements, one name.

**Fix.** The test now reads `art_fraction` from the record exactly as the CLI does. Verified in
both directions: it still fails a deliberately foreign cover (0.423 against a 0.62 threshold), so
the corrected path is not toothless.

**Lesson — the fifth occurrence in this repository of a check that did not exercise the code path
it claimed to.** When a test and a CLI disagree about the same artifact, one of them is measuring
something else; find out which before either is trusted.

### KI-016 — a package fingerprint must be computed after the last edit

**Symptom.** `validate_publishing.py` reported `content_fingerprint is stale` on a package that had
just been updated.

**Cause.** `package_video.fingerprint()` hashes `<slug>.mp4`, `script.md` and `thumbnail.jpg`. The
re-cut hashed the package, then edited `script.md` to document the re-cut — invalidating the hash
it had just written.

**Rule.** The fingerprint is the **last** write to a package. Any edit to those three files
requires recomputing it in `record.json` and `videos/index.json`.


### KI-013 — Two tools treated `--help` as a directory path (resolved)

- **Symptom:** `python3 tools/subtitle_check.py --help` died with
  `FileNotFoundError: '--help/vo_manifest.json'`; `mix_probe.py` did the same against its
  historical default work dir. Asking a tool what it does crashed it.
- **Root cause:** both read `sys.argv[1]` / `sys.argv[2]` positionally and had no `argparse`, so
  `--help` was consumed as a path.
- **Fix:** both now use `argparse` with a real description and epilog, and `parser.error()` with a
  useful message when the work dir lacks `vo_manifest.json` or `episode_retimed.json`. `--help`
  prints usage instead of failing.
- **Why it mattered:** `docs/production/KNOWN_ISSUES.md` told readers these tools had broken
  argparse, so nobody ran them; the real requirement (a work dir from a previous render) was never
  stated where a reader would look. `master_prompt.md` §3.3 now documents the actual interface.

### KI-014 — A missing dependency was misdiagnosed as broken argparse and written into the manual (resolved)

- **Symptom:** `compose_thumbnail.py --help` and `audio_report.py --help` both raised
  `ModuleNotFoundError` for Pillow and numpy respectively. `master_prompt.md` originally recorded
  this as a broken argument parser and told readers not to call the tools blind.
- **Root cause:** the crash happened at import time, before any argument parsing ran. The tool was
  fine; the environment was missing packages. The error was read as a code defect and the wrong
  conclusion was published.
- **Fix:** with Pillow and numpy installed, `--help` works on both and always did. The manual's
  entries are corrected to their real interfaces, with the misdiagnosis recorded rather than
  quietly overwritten.
- **Lesson (now in `master_prompt.md`):** a crash at import is not a crash in argument parsing. One
  is a bug in the tool, the other a missing dependency — and reporting the first when it is the
  second sends every future reader around a bug that does not exist.


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

### KI-010 — Short board cards clip lines; wide portrait boards collide with name tags (resolved)
- **Stage:** stills / draft / master visual QA
- **First seen:** video-003, 2026-11-09/10
- **Symptom:** multi-line boards clipped their lower lines; in 9:16 the S01 `MIRA` tag touched
  the lower edge of "THE BRIDGE" card.
- **Root cause:** project authoring geometry. `h:168` was too short, and the default portrait
  board fit did not narrow/centre the 560-pixel card enough.
- **Fix:** `h>=250`, `y~74`, 42-pixel line spacing, `portrait_w:460`, `portrait_x:0.5`; see
  PC-009 / PC-010 and the master template. No shared-engine change was needed.
- **Regression check / verification:** corrected final-master board frames inspected; unit test
  guards the documented values.

### KI-011 — Stale `--resume` cache can omit a spec correction from a master (resolved)
- **Stage:** master re-render after an episode change
- **First seen:** video-003, 2026-11-10
- **Symptom:** a corrected voiced draft showed resized portrait boards, while the re-rendered
  master still showed the old boards and the S01 name-tag collision.
- **Root cause:** `produce_video.py` always passes `--resume`; an existing
  `.work_final/episode_retimed.json` and its chunk MP4s were reused instead of regenerating from
  the changed `episode.json`.
- **Fix:** PC-012 hash guard clears stale `.work_*` render caches when the spec changes. The
  delivered master was produced after that invalidation, and its board-cue frames were inspected.
- **Regression check / verification:** `test_produce_video_invalidates_stale_render_caches`;
  corrected final-master frames show the name tag below the board.

### KI-012 — Portrait crop leaves unreadable slivers of world-prop labels (resolved)
- **Stage:** master 9:16 visual QA, closing frames
- **First seen:** video-003, final-master verification, 2026-11-10
- **Symptom:** during the closing question and end frame, a small yellow rounded rectangle sat at
  the left edge with no readable text. Earlier scenes showed label plates with truncated words
  (`AIT` instead of `WAIT`).
- **Root cause:** the 9:16 master is a ~607 px crop of the 1920-wide authoring stage, and the crop
  follows the camera/speaker, so its left edge moves every frame. A `signpost` label plate is
  148 px wide; when the crop only intersects a few pixels of it, the renderer still painted that
  fragment. No static `x` can keep a plate readable for a whole scene.
- **Fix:** `pruneClippedSignpostLabels` in `universal_toolbook/engine/video_renderer.js` drops a
  label plate when less than 70% of it lies inside the portrait crop. The decision is per frame.
  Full-width (landscape) viewports bypass the guard, so 16:9 masters stay byte-identical. Fully
  readable plates such as S01's `NEAR` are retained.
- **Regression check / verification:** `tests/regression/run_all_tests.js` asserts pruning of
  mostly-clipped labels, retention of fully visible labels, no spec mutation and landscape
  identity; the re-rendered closing master frame was opened and has no edge fragment.
