# PROMPT.md — video-001

> **This is the video-specific production prompt for `video-001-twenty-three-minutes`.**
> It was derived from [`templates/MASTER_VIDEO_PRODUCTION_PROMPT.md`](../../templates/MASTER_VIDEO_PRODUCTION_PROMPT.md)
> and **saved before production began**, as the master brief requires. It is frozen: production
> follows it step by step, and any deviation is recorded in [`PRODUCTION_LOG.md`](PRODUCTION_LOG.md)
> with a reason. This file is never overwritten by a later video.

---

## 0. Mission

Produce one complete, watchable, production-ready MP4 stickman animation from research through
render and QA, inside this repository, using the reusable pipeline. The deliverable is a video
file — not a plan, not a script, not a still.

## 1. Selected topic

**Title:** `What If Every Notification Cost You 23 Minutes?`
**Premise:** A thought experiment. One man starts a workday with a visible focus budget. Every
notification he answers costs him not the two seconds it takes to read, but the twenty-three
minutes it takes to get back. He watches the day collapse, discovers the real mechanism is
*switching* rather than the phone, changes one small thing, and the counter stops draining.
**Thesis (one sentence):** *Your attention is not free — every interruption has a price you pay in
minutes you do not get back.*
**Selection rationale:** see [`TOPIC_SELECTION.md`](TOPIC_SELECTION.md).
**Evidence:** see [`RESEARCH.md`](RESEARCH.md).

## 2. Research findings that constrain the script

- Only **High** and **Medium-High** confidence facts may be asserted (`RESEARCH.md` §5).
- Assert: 23 minutes to fully refocus after an interruption (Mark et al., UC Irvine, 2008).
- Assert: attention on a single screen fell from about 2.5 minutes to about 47 seconds.
- Assert: people rarely return directly — roughly two intervening tasks slip in first.
- **Do not assert** a universal daily focus budget. The 240-minute figure is explicitly
  hypothetical and must be introduced with "let's say" or equivalent.
- **Do not use** the 275-interruptions/day or 1h18m/day figures — Medium confidence only.

## 3. Creative direction (from `REFERENCE_ANALYSIS.md` §"Creative direction adopted")

1. Runtime ≈2:40; beats of 10–20 s.
2. Hook lands inside the first 10 seconds. Start in the middle of the premise.
3. **One metaphor, never explained:** a draining focus counter expressed as a number.
4. Documentary narrator + exactly three short character lines. No lecturing dialogue.
5. Closing act replays the same conditions with one variable changed (reference 2's A/B structure).
6. **Mute-legibility test:** the film must be understandable with the audio off.
7. Close on a direct-address question, originally worded.
8. Music is load-bearing and shifts mood per act, ducked under narration.
9. Chapter labels appear as on-screen cards and in the delivery notes as YouTube chapters.
10. **Originality:** no character, script, scene, chapter list or metaphor may be reproduced from
    any reference. Metaphor is *number*, not colour.

## 4. Character descriptions

Pinned once here; the engine's `cast` block is the single source of truth for consistency.
Full sheet: [`CHARACTERS.md`](CHARACTERS.md).

| id | Name | Role | Build | Hair | Colour | Expressions used |
|---|---|---|---|---|---|---|
| `kai` | KAI | protagonist, ~26, works at a desk | `lean` | `textured_messy` | `#f8fafc` | focused → curious → shocked → tired → exhausted → determined |
| `sam` | SAM | colleague, appears in **two scenes only** | `standard` | `bun` | `#f472b6` | focused, smile |

**Hard constraint:** never more than two characters in a scene (engine limit).

## 5. Animation style

- Style `cel` (Atmospheric Cinema Cel) — the engine's crisp vector look; zero film grain.
- Dark atmospheric settings with one accent colour per scene carrying the mood.
- Movement must come from the 58 named actions (`walk`, `phone_scroll`, `check_watch`,
  `sit_desk_type`, `sit_desk_slump`, `head_in_hands`, `stand_from_desk`, `meditate_focus`,
  `stand_up_resolve`, `look_horizon`, …). **No scene may rely on a static pose plus a zoom.**
- Camera: speech-locked `camera_shots` using `cue_on` so pushes and pans land on the spoken beat.
- Boards: `digital_clock` prop as the counter; `phone_card`, `stat_cards`, `bar_chart`,
  `flow_chain`, `checklist_card` for the arithmetic and the mechanism reveal.

## 6. Scene-by-scene instructions

| # | Scene | Environment | Objective | Characters | Key action | Board / prop | Narration segment | SFX | Transition |
|---|---|---|---|---|---|---|---|---|---|
| S01 | The Counter | `bedroom_late` → morning | Establish the visible budget | kai | `stretch_wake` → `idle_stand` | `digital_clock` `240` | Kai wakes; 240 minutes | room tone, wake | cut |
| S02 | The Rule | `mind_space` | State the mechanism | kai | `pace_think` | `stat_cards` 2 s vs 23 min | the rule nobody tells you | low pulse | cut |
| S03 | First Drain | `modern_office` | First cost, unfelt | kai | `sit_desk_type` → `phone_scroll` | `phone_card` + `digital_clock` `217` | nine a.m.; "two seconds" | notification ping | cut |
| S04 | Escalation | `modern_office` | Repeats, accelerating | kai | `phone_scroll` ×3 beats | `digital_clock` 194 → 171 | and another, and another | 3 pings, rising | cut |
| S05 | The Arithmetic | `tech_lab` | Make it countable | kai | `point_board` | `bar_chart` 11 × 23 min | eleven notifications | pen/whoosh | cut |
| S06 | Empty Afternoon | `bedroom_late` (dusk) | The anti-climax | kai | `sit_desk_slump` → `head_in_hands` | `digital_clock` `009` | three p.m.; where did the day go | silence drop | cross-fade |
| S07 | The Real Thief | `mind_space` | The revelation | kai | `kneel_lookup` → `stand_up_resolve` | `flow_chain` task→buzz→task→task→back | two tasks slip in first | reveal sting | cut |
| S08 | One Small Thing | `modern_office` | The change | kai | `pick_up_floor` → phone face-down | `phone_card` `call_declined` | turns it over, drawer | drawer thud | cut |
| S09 | One Hour Later | `modern_office` | A/B proof | kai + sam | `sit_desk_type` deep work | `digital_clock` `217` unchanged | counter has not moved; sam asks | warm room | cut |
| S10 | The Price | `sunrise_summit` | Conclusion + CTA | kai | `look_horizon` | `checklist_card` | attention is not free; the question | swell, resolve | fade out |

Every scene must define: objective, characters, poses/actions, background, camera position and
movement, animation timing, narration segment, SFX, and the transition out.

## 7. Narration voice and settings

| Speaker | Engine | Voice | Rate | Pitch | Why |
|---|---|---|---|---|---|
| `narrator` | Kokoro | **`am_michael`** | `+1%` | `-1Hz` | Repository PRIMARY default; warm, authoritative, even pace |
| `kai` | Kokoro | `am_liam` | `+3%` | `+1Hz` | warm/friendly/natural, reads younger than Michael |
| `sam` | Kokoro | **`af_bella`** | `+2%` | `+0Hz` | Repository preferred secondary; warm, professional, clear |

- Engine priority: **Kokoro first**, Piper only as fallback (per master brief Part 6).
- Natural speed, no rushed delivery, correct pronunciation, audible pauses, consistent volume,
  no clipping.
- Script must be polished with the repository's English-only voiceover polishing standard at
  `docs/production-workflow/prompts/VOICEOVER_POLISH_PROMPT.md` — **used exactly as it exists,
  byte-for-byte** (sha256 `aeef0850347ae43535379981d2cd9f4a90e747b7de63b6bb5bd93c31518dc1ea`).
- Save `SCRIPT_ORIGINAL.md`, `SCRIPT_POLISHED.md`, `SCRIPT_CHANGELOG.md`.

## 8. Audio requirements

- BGM mode `dynamic`, crossfading per-scene `bgm_track` from the 7 bundled Creative Commons tracks.
  Act mapping: reflective/opening → tension during escalation → quiet at the collapse → resolve.
- Speech ducking on; narration must sit clearly above music and effects.
- Foley derived from scene events (notification pings, footsteps, drawer, room tone).
- **Mix targets (measured on the rendered WAV, not assumed):** peak −3…−1 dBFS, RMS −16…−19 dBFS.
- Respect and record the CC licences of every track used (`ASSET_MANIFEST.json`).

## 9. Export settings

| | Primary | Secondary |
|---|---|---|
| Format | **YouTube Shorts 9:16** | Regular YouTube 16:9 |
| Resolution | 1080×1920 | 1920×1080 |
| Frame rate | 30 fps | 30 fps |
| Codec | H.264 High + AAC 44.1 kHz stereo | same |
| Preset / CRF | `veryfast` / `crf 24` | same |
| Flag | `--shorts` (accepts ≤180 s) | `--aspect-ratio 16:9` |
| Workers / chunk | 2 / 45 s, `--resume` on | same |
| Output | `projects/video-001-twenty-three-minutes/final.mp4` | `renders/final_16x9.mp4` |

Important visuals must sit inside mobile-safe areas; portrait stills are inspected before the
master render.

## 10. Quality requirements (all must actually pass, with evidence)

1. `run_studio.py validate` reports **`warnings: []`** before any render.
2. Portrait stills inspected for every scene: counter readable, boards inside the safe crop,
   no name-tag collision, no clipped limbs.
3. Draft render reviewed for timing, board build, camera cuts, subtitle speaker/highlight.
4. Master decodes end-to-end: `ffmpeg -v error -i final.mp4 -f null -` exits clean.
5. Measured container matches spec: 1080×1920, 30 fps, duration within target, one video + one
   audio stream.
6. **No black-screen sections** — sampled frames across the whole timeline are non-uniform.
7. Audio measured on the mixed WAV: peak and RMS inside target, no silent interior gaps longer
   than an authored pause.
8. Frames extracted and **actually looked at** at ≥6 timestamps; findings written into
   `QA_REPORT.md`.
9. Mute-legibility test: the extracted frame sequence tells the story without audio.
10. `tests/production/` passes.

**Never claim a visual or audio check passed if it was not performed.**

## 11. Mandatory artifacts for this project

`PROMPT.md` · `RESEARCH.md` · `TOPIC_SELECTION.md` · `REFERENCE_ANALYSIS.md` ·
`SCRIPT_ORIGINAL.md` · `SCRIPT_POLISHED.md` · `SCRIPT_CHANGELOG.md` · `STORYBOARD.md` ·
`CHARACTERS.md` · `SCENE_PLAN.json` · `VOICEOVER.md` · `ASSET_MANIFEST.json` ·
`PRODUCTION_LOG.md` · `QA_REPORT.md` · `episode.json` · `final.mp4` ·
`assets/` · `audio/` · `renders/`

## 12. Self-healing obligation

Any failure in research, asset generation, animation, TTS, rendering, encoding or QA must be
recorded in `PRODUCTION_LOG.md`, root-caused, fixed **reusably** (not worked around for this video
alone), covered by a regression check in `tests/production/`, and written up in
`docs/production/KNOWN_ISSUES.md` + `LESSONS_LEARNED.md` + `PIPELINE_CHANGELOG.md`. A failure is
never reported resolved without verification.
