---
name: sound-design
description: "Design restrained, story-synced audio mixes combining Kokoro voiceover, ducked Creative Commons BGM, stereo-panned footsteps, and tactile object foley within broadcast loudness targets."
---

# Skill: sound-design

## Purpose

Craft clean, emotionally supportive stereo soundtracks in `universal_toolbook/engine/audio_mixer.py`, `universal_toolbook/engine/bgm_library.py`, and `universal_toolbook/engine/episode.js` where Kokoro narration sits clearly in front, foley cues reinforce physical contacts without clutter, BGM ducks smoothly under speech, and master loudness hits broadcast targets (`-3..-1 dBFS` peak, `-19..-16 dBFS` RMS). Works alongside [`voiceover-audio`](../voiceover-audio/SKILL.md).

## Trigger Conditions

## Inputs

The voiceover manifest, the chosen BGM track, and the foley cue list. Mixing without the manifest means guessing at speech timing.

Activate whenever:
- choosing `bgm` modes/tracks or authoring `scenes[].sfx[]` in `episode.json`,
- adding or tuning synthesized foley in `universal_toolbook/engine/audio_mixer.py` or auto-cues in `universal_toolbook/engine/episode.js`,
- diagnosing loud/muddy music, clipping, missing interaction foley, or audio/visual sync drift.

## Core Rules & Non-Negotiable Constraints

1. **Voice clarity always wins (`-9.5 dB` speech ducking).** Narration (`am_michael` default via Kokoro) is the primary anchor. `audio_mixer.py` automatically ducks BGM under active speech intervals; never override gains to drown narration.
2. **Synchronize foley to physical frame contacts.**
   - Gait footsteps (`step`, `step_run`, `wet_step`) are extracted deterministically from `walkMotion`/`runMotion` touchdown clocks (`extractCharacterFootsteps`), never placed on a blind timer.
   - Object interactions (`phone_pickup`, `phone_setdown`, `phone_tap`, `keyboard_tap`, `door_open`, `chair_sit`, `cup_set`, `phone_buzz`) fire at the exact contact/grip/release fraction of the beat and pan subtly (`pan` in `[-0.85..0.85]`) to the actor's stage `x`.
3. **Restraint over noise.** Keep foley subtle (`0.05–0.12` linear amplitude) and purposeful — at most 1–3 distinct foley events per short scene so effects punctuate physical weight rather than competing with speech.
4. **Licensed CC0 / CC BY 4.0 music only.** Select from the 7 bundled tracks in `universal_toolbook/assets/bgm/BGM_CATALOG.json` (`chill_focus`, `reflective_piano`, `suspense_tension`, `electronic_drive`, `upbeat_ncs_synth`, `retro_pulse`, `triumph_horizon`) or `bgm: "dynamic"`. Attribution is emitted automatically from `universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md`.
5. **Verified master loudness.** Every rendered master WAV/MP4 must measure peak in `[-3.0, -1.0] dBFS` and RMS in `[-19.5, -15.5] dBFS` with zero clipping samples.

## Practical Workflow

1. **Match `mood` and `bgm` to narrative arc.** Use `calm` / `chill_focus` or `reflective_piano` for introspective openings, `tension` / `suspense_tension` for conflict, and `focus` or `triumph` for resolution.
2. **Let automatic contact foley handle standard beats, add `sfx[]` for story beats.** `episode.js` automatically schedules footsteps, `phone_pickup`, `phone_setdown`, `door_open`, and `chair_sit`. Add explicit `scenes[].sfx[]` only for narrative triggers (`{ "type": "phone_buzz", "at": 0.25, "pan": 0.12 }`, `clock_tick`, `cup_set`).
3. **Measure rendered audio.** Run `python3 tools/audio_report.py` / `python3 tools/mix_probe.py` or inspect `report["audio"]` beside the rendered MP4 to verify peak/RMS, speech ducking, and non-silent voiceover (`voiced: true`).

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Foley fires 0.5s before hand touches phone | Hardcoded `at: 0.2` guessed before TTS retiming | Let `compileEpisode` schedule `phone_pickup` at `b0 + span * 0.44` (exact grip transfer) or lock beat timing to retimed scene |
| Music overpowers quiet speech | Custom external MP3 bypassed mixer normalization | Always mux through `build_master_soundtrack` in `universal_toolbook/engine/audio_mixer.py` |
| Harsh repetitive clicking | Too many manual `clock_tick` / `phone_tap` events stacked | Space tactile taps `>= 0.35s` apart and keep amplitude `<= 0.06` |

## Quality Checklist

- [ ] `voiced: true` with `voice_backend: "kokoro"` (unless explicitly overridden).
- [ ] Every physical pickup, set-down, door swing, chair sit, and walk step has matching subtle foley.
- [ ] Master mix peak is within `-3..-1 dBFS` and RMS within `-19.5..-15.5 dBFS`.
- [ ] CC music credits are preserved in `*_chapters.txt` / `ASSET_MANIFEST.json`.

## External References & Attribution

- Sonnenschein, D. (2001), *Sound Design: The Expressive Power of Music, Voice, and Sound Effects in Cinema* — foreground/midground/background auditory hierarchy and tactile sync points.
- ITU-R BS.1770 / EBU R128 loudness principles — speech-anchored program loudness and true-peak headroom.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — declarative SFX/voiceover/audio timing concepts adapted to Python `audio_mixer.py` (`docs/decisions/ADR-0001-remotion-evaluation.md`).

## Examples

### A notification cue buried under the music

No ducking on that cue. Put the cue in the speech-ducked bus, or move it a beat later.

## Concrete Engine Recipes

### Pairing notification cue + automatic pickup/setdown foley (`episode.json`)

```json
{
  "id": "S01",
  "mood": "focus",
  "bgm": "chill_focus",
  "sfx": [
    { "type": "phone_buzz", "at": 0.20, "pan": 0.12 }
  ]
}
```
