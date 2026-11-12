---
name: animation-scriptwriting
description: "Write visual-first animation scripts where physical character actions carry meaning, planned duration determines 9:16 vs 16:9 format up front, and narration stays concise and TTS-ready."
---

# Skill: animation-scriptwriting

## Purpose

Write scripts specifically engineered for minimalist character animation — where every spoken sentence pairs with an observable physical action, object interaction, or spatial shift rather than static talking heads, and where target narration duration drives format selection (`9:16` vs `16:9`) before storyboarding begins. Complements [`scriptwriting`](../scriptwriting/SKILL.md) and [`docs/production/prompts/VOICEOVER_POLISH_PROMPT.md`](../../docs/production/prompts/VOICEOVER_POLISH_PROMPT.md).

## Trigger Conditions

## Inputs

The approved narration or the beat outline it has to become, plus the target duration and format. A script with no target duration cannot be paced.

Activate whenever:
- turning a topic, premise, or outline into an animated video script,
- rewriting prose or essay text into scene-by-scene visual beats + concise voiceover,
- planning target runtime and selecting `9:16` (`< 60s`) vs `16:9` (`>= 60s`) before storyboarding,
- polishing dialogue for Kokoro TTS (`am_michael`).

## Core Rules & Non-Negotiable Constraints

1. **Determine video format from planned narration duration FIRST.**
   - Estimate spoken duration (`word_count / 2.55` seconds + deliberate punctuation pauses).
   - `< 60.0s` -> plan native vertical **Portrait `9:16` (`1080x1920`)** staging (tighter single/pair framing, brisk 4–7s scenes).
   - `>= 60.0s` -> plan **Landscape `16:9` (`1920x1080`)** staging (wider spatial geography, multi-prop room blocking).
   - **Word budgets at the 2.55 words/s planning rate, pauses excluded:** 60 s is ~153 words.
     Portrait is safe up to **~140 words** (54.9 s, ~5 s of pause headroom); landscape starts at
     **~160 words** (62.7 s). The 140–160 band is not a target — it is where sentence pauses decide
     the format, so stay out of it unless you are deliberately testing the boundary.
     (`tests/production/test_skill_contracts.py` recomputes these figures and fails if they no
     longer straddle 60 s. An earlier revision of this page published 135/150, which is 52.9 s and
     58.8 s — both portrait. Following it planned landscape staging for a portrait render.)
   - Store `selected_video_format` in the episode plan before writing `characters[].beats[]` or `camera`.
2. **Show the action; never narrate what the viewer already sees.** If the character reaches for a buzzing phone, scrolls, hesitates, and sets it face-down, *do not* say "He reaches out and picks up his phone from the table." Let the physical animation show the habit while narration delivers the insight, stakes, or inner conflict.
3. **Every scene needs a physical verb.** Anchor each scene around concrete actions from `SUPPORTED_ACTIONS` (`walk`, `sit_down`, `pick_up_phone`, `phone_scroll`, `put_down_phone`, `sit_desk_type`, `interact_table`, `open_door`, `react_surprise`). Avoid generic abstract metaphors that cannot be staged cleanly with 1–2 characters and canonical props.
4. **Spoken-English cadence & exact polish prompt.** Use short active sentences (`8–18` words), contractions where natural, and intentional punctuation pauses (`.` `>= 0.42s`, `,` `>= 0.24s`). Polish with `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` untouched byte-for-byte, and copy polished lines verbatim into `episode.json`.
5. **No channel branding.** Never insert channel names, "subscribe" calls, or creator sign-offs unless explicitly requested by the user.

## Practical Workflow

1. **Lock target runtime & format.** Choose Shorts (`30–55s` -> `9:16`) or Long-Form (`65s+` -> `16:9`) based on scope, leaving a `~4–5s` buffer away from `60.0s` unless testing the boundary so post-TTS retiming matches the planned format cleanly.
2. **Draft a two-column Action / Voice table.** Write the **Physical Action & Prop Beat** column *first*, then write the **Spoken Line** column so visuals lead words.
3. **Verify mute legibility on paper.** Read only the Physical Action column from top to bottom: if a viewer watching on mute cannot tell what happened and how the character changed, sharpen the physical staging before finalizing words.
4. **Polish for TTS and validate fidelity.** Apply `VOICEOVER_POLISH_PROMPT.md` and verify word-for-word parity in `episode.json`.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Radio-play / podcast with a motionless stickman | Essay written first, `idle_stand` slapped on afterward | Rewrite each scene around a physical prop/posture change (`walk -> sit_down -> pick_up_phone -> put_down_phone`) |
| Redundant literal narration | Describing on-screen mechanics ("He sits on the chair") | Cut literal description; use voiceover for cause, contrast, or emotional stakes |
| Unintended `59s -> 61s` format flip after TTS | Script written at `148` words without accounting for pauses | Budget `2.4–2.55` words/sec + `0.35s` per sentence pause during planning; if crossing `60s`, recompose for the new format |
| Long Breathless 35-word sentences | Print-essay syntax | Split into punchy `10–16` word spoken beats |

## Quality Checklist

- [ ] Planned word count + pauses maps unambiguously to `< 60s` (`9:16`) or `>= 60s` (`16:9`), recorded in `selected_video_format`.
- [ ] Every scene pairs concise narration with at least one concrete physical action or prop interaction.
- [ ] Story turn is understandable with sound muted.
- [ ] Sentences average `10–16` words with clean TTS pronunciation and zero channel branding.

## External References & Attribution

- Mamet, D. (1991), *On Directing Film* — telling the story through uninflected physical shots/actions rather than explanatory dialogue.
- McKee, R. (1997), *Story* — scene turns driven by action/reaction and value shifts.
- Internal studio authority: `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` and `skills/scriptwriting/SKILL.md`.

## Examples

### A sentence that cannot be said in one breath

The narration line runs 31 words with three subordinate clauses. Split it into three short lines and let `pause_after` carry the beat.

## Concrete Engine Recipes

### Visual-first scene pairing physical habit with concise voiceover (`episode.json`)

```json
{
  "id": "S01",
  "location_id": "desk_room",
  "duration": 6.5,
  "props": [
    { "id": "desk_1", "type": "table", "x": 0.56 },
    { "id": "phone_1", "type": "phone", "x": 0.53, "elevation": 108 }
  ],
  "dialogue": [
    { "speaker": "narrator", "text": "You did not lose three hours all at once.", "pause_after": 0.35 },
    { "speaker": "narrator", "text": "You traded them away in ten-second checks.", "pause_after": 0.40 }
  ],
  "accent_words": ["three hours", "ten-second checks"],
  "characters": [
    {
      "id": "alex",
      "beats": [
        { "start": 0.0, "end": 1.6, "action": "reach_phone", "x": 0.47, "target_prop": "phone_1" },
        { "start": 1.6, "end": 3.8, "action": "pick_up_phone", "target_prop": "phone_1" },
        { "start": 3.8, "end": 6.5, "action": "phone_scroll", "target_prop": "phone_1" }
      ]
    }
  ]
}
```
