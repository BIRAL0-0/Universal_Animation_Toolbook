---
name: stickman-animation
description: "Choreograph expressive minimalist stick-figure performances, action beat chains, locomotion cycles, seated postures, and two-actor staging using the 70-action motion library."
---

# Skill: stickman-animation

## Purpose

Turn narrative beats into clear, grounded, physically expressive stickman performances using `universal_toolbook/engine/motion_library.js` and `universal_toolbook/engine/character_rig.js`. Every beat must read clearly even with audio muted, transition smoothly without pose popping, and keep feet grounded to world coordinates.

## Trigger Conditions

Activate whenever:
- authoring `scenes[].characters[].beats[]` in `episode.json`,
- adding or refining actions in `universal_toolbook/engine/motion_library.js`,
- staging locomotion (`walk`, `run`), seated postures (`sit_down`, `sit_chair`, `sit_desk_type`), gestures, or emotional reactions (`react_surprise`, `celebrate_arms_up`, `slump`),
- fixing robotic motion, pose jumps between beats, foot sliding, or stiff idle poses.

## Core Rules & Non-Negotiable Constraints

1. **Every action must exist in `SUPPORTED_ACTIONS`.** `universal_toolbook/engine/motion_library.js` exports 70 validated actions; unknown action names trigger validation warnings and are blocked by `tools/validate_specs.py`.
2. **Continuous beat-chain handoff.** Consecutive beats in `characters[].beats[]` must carry spatial continuity (`to_x` of a `walk` becomes the resting `x` of the next beat). `evaluateCharacterState` blends beat boundaries (`0.22s`, tightened automatically for sequential object manipulation) so limbs never teleport.
3. **World-locked gait cycles.** `walkMotion` and `runMotion` derive stride count from world distance (`dist / stepLen`) and lock stance feet to exact world coordinates (`0.0 px` foot slip). Match beat duration to distance (`~0.16–0.24` normalized stage width per `2.5–3.5s` walk).
4. **Expressive silhouette first.** Favour asymmetric stances, subtle spine curves, head leads, breathing micro-motion, and natural eye-lines (`lookX`, `lookY`) over symmetric mannequin poses.
5. **Maximum two characters per scene by default.** Keep silhouettes separated in `x` (`>= 0.16` stage width apart unless paired in `handshake`, `high_five`, `handoff`, or `hug`) so limbs and gestures never tangle.

## Practical Workflow

1. **Break each scene into 2–4 physical beats.** Map each spoken thought to a concrete physical action (`walk -> reach_phone -> pick_up_phone -> phone_scroll -> put_down_phone`), never leaving a character in `idle_stand` for 10+ seconds.
2. **Bind seated and object beats to real props.** Pair `sit_down` / `sit_chair` with a `chair` or `sofa` prop (`target_prop`), `sit_desk_type` with a `desk` + `laptop`/`computer`, and phone actions with a `phone` prop on a `table`/`desk`.
3. **Stage clear facing directions.** Set `facing: 1` (right) or `facing: -1` (left) toward the conversation partner or target prop.
4. **Inspect motion across multiple timestamps.** Render scene stills or a multi-frame contact sheet across beat transitions (`t = beatEnd - 0.1s`, `beatEnd`, `beatEnd + 0.15s`) to confirm smooth arcs and zero popping.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Moonwalking / skating feet | `walk` beat covers huge distance (`0.1 -> 0.9`) in `< 1.0s` | Give `walk` realistic travel time (`~2.5–4.0s` across mid-stage) or use `run` |
| Character teleports at beat boundary | Next beat sets a different `x` from previous `walk`'s `to_x` | Omit redundant `x` on the following beat (engine inherits `prevX`) or match `to_x` exactly |
| Floating seated character | `sit_chair` used with no `chair` prop in `props[]` | Place `{ "id": "ch1", "type": "chair", "x": 0.50 }` and set `"target_prop": "ch1"` |
| Robotic frozen listener | Second character left in static pose during dialogue | Use `listen_nod`, `idle_breathe`, `arms_crossed`, or `react_surprise` with speaker gaze tracking |

## Quality Checklist

- [ ] Every `action` in `episode.json` is in `SUPPORTED_ACTIONS` (`validate` reports `warnings: []`).
- [ ] Walk and run beats exhibit zero stance-foot sliding and natural counter-swinging arms.
- [ ] Beat transitions blend smoothly with no single-frame limb snaps or horizontal teleports.
- [ ] Characters read clearly on mute from body language and silhouette alone.

## External References & Attribution

- Williams, R. (2001), *The Animator's Survival Kit* — contact/down/passing/up walk-cycle mechanics and weight shifts (adapted in `walkMotion` / `runMotion`).
- Thomas, F. & Johnston, O. (1981), *The Illusion of Life* — staging, pose-to-pose clarity, and secondary action.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — deterministic frame-driven sequencing concepts; see `docs/decisions/ADR-0001-remotion-evaluation.md`.

## Concrete Engine Recipes

### Walk in -> sit on chair -> react (`episode.json`)

```json
{
  "props": [
    { "id": "study_chair", "type": "chair", "x": 0.52, "facing": "right" }
  ],
  "characters": [
    {
      "id": "alex",
      "beats": [
        { "start": 0.0, "end": 2.4, "action": "walk", "from_x": 0.24, "to_x": 0.48 },
        { "start": 2.4, "end": 4.2, "action": "sit_down", "target_prop": "study_chair" },
        { "start": 4.2, "end": 7.0, "action": "sit_chair", "target_prop": "study_chair" }
      ]
    }
  ]
}
```
