---
name: youtube-storytelling-and-hooks
description: "Design immediate first-3-second visual+spoken hooks, high-retention narrative arcs, Shorts (<60s) vs long-form (>=60s) pacing, and resonant payoffs without clickbait."
---

# Skill: youtube-storytelling-and-hooks

## Purpose

Maximize viewer retention and emotional clarity across both YouTube Shorts (`< 60s`, `9:16`) and YouTube long-form (`>= 60s`, `16:9`) animated stories by opening on immediate visual tension in frame 1, escalating through concrete cause-and-effect beats, and landing an earned payoff. Works alongside [`youtube-research`](../youtube-research/SKILL.md) and [`animation-scriptwriting`](../animation-scriptwriting/SKILL.md).

## Trigger Conditions

Activate whenever:
- crafting opening hooks, titles, premises, or scene-1 staging,
- structuring narrative pacing for Shorts (`< 60s`) vs long-form (`>= 60s`) episodes,
- diagnosing slow openings, mid-video drop-off, repetitive exposition, or flat endings.

## Core Rules & Non-Negotiable Constraints

1. **Zero throat-clearing in the first 3 seconds.** Never open with greetings, meta-introductions ("In today's video we'll explore..."), or static title cards. Frame `0` must show a character already in a specific physical situation (`reach_phone`, `sit_desk_type`, `walk`, `open_door`) paired with a sharp 1-sentence tension hook (`<= 12` words).
2. **But / Therefore causality — never "And then".** Connect every scene to the next via conflict (`but`) or consequence (`therefore`). If two consecutive scenes make the same point in slightly different words, cut one.
3. **Format-specific pacing architecture.**
   - **YouTube Shorts (`< 60.0s`, `9:16` `1080x1920`):**
     - `0.0–3.0s`: Visual+spoken pattern interrupt & relatable tension.
     - `3.0–22.0s`: Escalation through 2–3 physical habit/choice beats (`4–7s` per cut).
     - `22.0–44.0s`: Insight pivot — show the visible shift in posture/object behaviour (`put_down_phone`, `open_door`, `sit_desk_type`).
     - `44.0–56.0s`: Crisp single-sentence resolution that loops cleanly back to the opening image.
   - **YouTube Long-Form (`>= 60.0s`, `16:9` `1920x1080`):**
     - `0–10s`: Concrete human moment + stakes question.
     - Act I (`10–30%`): Recognizable friction staged in room geography.
     - Act II (`30–75%`): Mechanism + contrasting case/character (`chapters` every `20–45s`, resets visual energy on every chapter transition).
     - Act III (`75–100%`): Quiet behavioural payoff + memorable closing line (`fade_to_black: true`).
4. **Honest hooks only.** Every promise made in the title and first sentence must be answered concretely by the story — never manufacture fake numbers or bait-and-switch claims (`[M]`/`[O]`/`[P]` discipline from `skills/youtube-research/SKILL.md`).

## Practical Workflow

1. **Write the first frame + first sentence + final sentence together.** Ensure the ending visually transforms the exact prop or posture introduced in Scene 1 (e.g., phone picked up compulsively in `S01` -> phone placed deliberately out of reach in final scene).
2. **Audit beat density.** Verify a distinct visual change (new action beat, prop state change, camera cut, or board reveal) occurs at least every `3.5–5.5s` in Shorts and every `5.0–8.0s` in long-form.
3. **Test silent comprehension.** Step through rendered scene stills in sequence without reading subtitles; the emotional trajectory (`tension -> recognition -> shift -> calm`) must be unmistakable.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Weak first 5 seconds | Abstract definition before showing a human moment | Start mid-action on a relatable micro-moment (e.g., reaching for the phone at midnight) |
| Sagging middle | Three scenes lecturing the same thesis | Replace lecture scenes with a contrasting physical choice or two-character exchange |
| Preachy ending | Moralizing summary + CTA clutter | End on a quiet, decisive physical action + one crisp 8–12 word closing thought |

## Quality Checklist

- [ ] Frame `0` opens directly on a character + prop in motion with zero intro fluff.
- [ ] Opening spoken hook lands in `<= 3.0s` (`<= 12` words).
- [ ] Visual state changes every `3.5–6.0s` (`9:16`) or `5.0–8.0s` (`16:9`).
- [ ] Final scene visually resolves the prop/posture tension opened in Scene 1.

## External References & Attribution

- McKee, R. (1997), *Story* — inciting incident, progressive complications, crisis, climax, and resolution.
- Heath, C. & Heath, D. (2007), *Made to Stick* — curiosity gaps, concrete sensory specifics, and emotional credibility.
- Internal studio references: `skills/youtube-research/SKILL.md` and `docs/production/VIRAL_POTENTIAL_EVALUATION.md`.

## Concrete Engine Recipes

### 3-second visual+spoken pattern-interrupt opening (`episode.json`)

```json
{
  "id": "S01",
  "duration": 5.5,
  "location_id": "night_desk",
  "props": [
    { "id": "desk_main", "type": "desk", "x": 0.56 },
    { "id": "laptop_main", "type": "laptop", "x": 0.57, "elevation": 112, "facing": "left" },
    { "id": "phone_main", "type": "phone", "x": 0.48, "elevation": 112 }
  ],
  "dialogue": [
    { "speaker": "narrator", "text": "Your brain does not get tired from hard work.", "pause_after": 0.30 },
    { "speaker": "narrator", "text": "It gets tired from switching.", "pause_after": 0.38 }
  ],
  "accent_words": ["hard work", "switching"],
  "characters": [
    {
      "id": "alex",
      "beats": [
        { "start": 0.0, "end": 2.2, "action": "sit_desk_type", "x": 0.56 },
        { "start": 2.2, "end": 5.5, "action": "pick_up_phone", "seated": true, "target_prop": "phone_main" }
      ]
    }
  ]
}
```
