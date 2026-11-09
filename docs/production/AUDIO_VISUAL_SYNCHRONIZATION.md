# AUDIO–VISUAL SYNCHRONIZATION — Stages 7 & 10

**Status: IMPLEMENTED.** This document answers two questions: (7) *in what order should
audio and animation be produced*, and (10) *how are they locked together once produced*.
Both answers are properties of the engine's measured-speech design, so they hold for every
film, not just the next one.

---

## Stage 7 — the production-order decision

### The two approaches, evaluated against this engine

**Approach A — audio first.**
Finalize narration → generate voiceover → measure duration, pauses, sentence boundaries →
plan scenes against measured speech → render → sync is a byproduct.

**Approach B — animation first.**
Finalize scene descriptions → generate visuals → determine scene durations → generate or
adapt narration to fit → sync audio to pre-made visuals.

**Hybrid.**
Storyboard/stills first for composition, then voiceover, then timed animation against the
measured audio.

### The decision for this pipeline: A, by construction

The engine's timeline is **created by the voiceover pass**, not by the author:

1. `prepare_episode_voiceover` (voice_engine.py) synthesizes each line and measures it —
   the scene's true length is `max(min_duration, measured speech + lead-in/tail-out)`.
2. Beats, boards, and camera shots are then **snapped to the measured word timings**
   (`align_character_beats_to_speech`, `align_scene_board_to_speech`,
   `align_scene_cameras_to_speech`).
3. The compiled `episode_retimed.json` is what the renderer draws.

Approach B is therefore **not supported** in its classic form: there is no path that takes
pre-made visuals and writes narration to fit them. The engine cannot ingest a video and
time audio to it. (The 4K/3D/live-action cases in 08_LIMITS point the same way.)

The **hybrid** *is* supported and is in fact the documented workflow: the stills and draft
renders (Stage 9) give you a visual storyboard you can inspect **before** the master — but
the timeline they inspect has already been retimed to speech. So the hybrid resolves to:
*audio first for timing, storyboard-first for composition*.

### The one exception: user-supplied audio

If the user provides their own narration, Approach B's spirit is achievable via
`--voice-dir <dir>` with `<sceneId>.wav` files: the engine measures the supplied audio and
retimes to it (backend `external-audio`). The visuals are still authored in JSON and locked
to the measured file — but the *audio* predates the *render*, which is the property that
matters. Record this choice in `runtime/work/<slug>/decisions.md` at Stage 7.

### Why A wins on the user's own criteria

| Criterion | Audio-first here |
| --- | --- |
| Timing accuracy | Exact — word boundaries drive subtitles, cues, and mouth movement |
| Visual quality | Full stills/draft review before the master; geometry never compromises to fit audio |
| Audio quality | Independent of render; per-line cache; re-voice one line without re-rendering frames |
| Lip sync | Amplitude envelope from the actual audio (best the engine can do — see 08_LIMITS) |
| Scene consistency | One cast definition; retiming scales beats rather than regenerating scenes |
| Production speed / cost | Voice cache + chunk resume; no regeneration loop between two models |
| Reliability / ease of revision | Change a line → only that line re-synthesizes → re-render chunks |

---

## Stage 10 — how the lock works

After the voice pass, synchronization is not an assembly step — it is already inside
`episode_retimed.json`:

| Element | Lock mechanism |
| --- | --- |
| Scene duration | `max(min_duration, stitched speech + lead_in + tail_out)` — declared `duration` was only a plan |
| Character beats | Scaled/aligned to line timings (`align_character_beats_to_speech`) |
| Boards | `cue_on` phrase resolved to the measured word time; `hide_on` / `hold_sec` / smart auto-hide |
| Camera shots | `cue_on` resolved to the measured phrase; `move_dur` unchanged |
| Subtitles | Per-word timestamps → the active-word glow follows real speech; no fixed cadence |
| Mouth movement | Amplitude envelope (`_compute_speech_envelope_30fps`) — a viseme per frame from the actual audio level |
| Foley | Derived from scene actions + weather into `*_visual_audio_cues.json`; the mixer places them at cue times |
| BGM | Mood-matched per scene, crossfaded at joins, ducked −9.5 dB under speech phrases (`bgm_gain` 0.86–0.92) |
| Chapters | `formatYouTubeChapters` from the compiled scene starts — always matches the master |

### Scenes too short or too long for the narration

- **Narration shorter than declared** → the scene shortens to the speech; beats compress
  proportionally. The film's total lands under the declared sum — that is normal, not a
  bug (01_INTAKE §1.3).
- **Narration longer** → the scene stretches; beats spread. Watch that stretched beats stop
  reading as "sliding" — if they do, the fix is in the script (fewer words) or the block
  (smaller `from_x`/`to_x` distances), not a render flag.
- **Floor:** `min_duration` holds a scene open (for an intertitle, a held board, a
  `hold_silent_tail` ending). Without one of those, an inflated `min_duration` is capped to
  `stitched + 2.4 s` specifically to prevent accidental giant silent padding.
- **Delivery gates:** after retiming, `--short-form` refuses anything outside 40–90 s and
  `--shorts` anything outside >0–180 s, *before encoding* (`INVALID_SHORT_FORM_DURATION` /
  `INVALID_SHORTS_DURATION`, exit 2). The engine never truncates dialogue to hit a runtime —
  it refuses, and the script gets shortened.

### Verifying the sync (automated + human)

- `python3 tools/subtitle_check.py runtime/renders/.work_<stem>` — three independent checks
  (reads `episode_retimed.json` + `vo_manifest.json` from the work directory): every
  subtitle word sits inside a measured speech interval; every spoken line appears exactly
  once in order; subtitle occupancy ≥ 70 % of measured speech time without self-overlap.
  Verdict `PASS`/`FAIL`, exit 2 on failure.
- `python3 tools/audio_report.py runtime/renders/.work_<stem>/master_audio.wav
  runtime/renders/.work_<stem>/vo_manifest.json` — peak, loudness, narration-vs-bed separation,
  silence gaps, clipping, computed from the PCM.
- `python3 tools/mix_probe.py <episode.json> runtime/renders/.work_<stem>` — narration-vs-bed
  separation *without rendering any video*; verdict `PASS`/`RECHECK` (pass bar: ≥ 8 dB under
  speech, ≥ 4 dB in gaps, true peak ≤ −1 dBFS).
- Draft by ear: subtitle appears on the first syllable (not before it); no audible speech
  without a subtitle; no line truncated at the end; BGM does not pump at scene joins
  ([`universal_toolbook/process/05_AUDIO.md`](../../universal_toolbook/process/05_AUDIO.md) §5.7).

**The quiet-failure check:** a dialogue line that failed *all* TTS backends is dropped from
the audio while the film still reports `voiced: true`
([`VOICE_GENERATION.md`](VOICE_GENERATION.md) §8.5). The draft listen is the only gate that
catches a missing sentence — run it on every master-bound draft.
