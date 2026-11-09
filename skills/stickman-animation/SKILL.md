---
name: stickman-animation
description: "Author episode specs, characters, poses, actions, environments, boards, storyboards and camera framing for the stickman canvas renderer."
---

# Skill: stickman-animation

**Activate when:** designing or changing characters, poses, actions, environments, props, boards,
camera framing, visual style, storyboards, `cast`, `beats[]`, `camera_shots[]` or any
`episode.json` visual field. Always activate alongside
[`animation-production`](../animation-production/SKILL.md) for a video request.

**Authority:** the engine is the only source of truth for what can be drawn. Full schema:
[`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](../../universal_toolbook/01_TOOLBOOK_REFERENCE.md).
Geometry rules: [`universal_toolbook/process/04_VISUAL_GEOMETRY.md`](../../universal_toolbook/process/04_VISUAL_GEOMETRY.md).
Worked specs: [`examples/`](../../examples/). Module map:
[`docs/architecture/ENGINE_MODULES.md`](../../docs/architecture/ENGINE_MODULES.md).

## Character consistency

- `episode.json` → `cast` is the single source of truth. Mirror it byte-for-byte into `CHARACTERS.md`;
  never maintain a second competing design.
- Hard constraint: **at most two characters in any scene**. Design the cast around that limit.
- Give each character a distinct `build`, `hair`, `hair_color`, `shoe_color`, `posture`
  (−1..+1), `scale` (1.52..1.65 for cinema presence), `accessories`, `color` and expression arc.
  Reuse the same `id` across scenes; `compileEpisode()` resolves the profile from `cast`.
- Choose one visual style: `cel` (cinematic) or parchment / `ink_stick` (hand-inked parable).
  Parchment backdrops come from `parchment_ink_style.js`, `beacon_harbor.js` and
  `impossible_wall.js`.
- Set `channel_name` to `""` or omit it entirely. No branding, watermark or channel name anywhere.

## Animation

- Every scene needs at least one real action. A static pose plus a zoom is not animation.
- Actions must be one of the 60 `SUPPORTED_ACTIONS` in
  [`universal_toolbook/engine/motion_library.js`](../../universal_toolbook/engine/motion_library.js)
  (`walk`, `run`, `climb_stairs`, `jump`, `hug`, `handshake`, `sit_desk_type`, `check_watch`,
  `hold_umbrella`, `point_board`, …). Unknown actions silently become `idle_stand`.
- Beats are time-boxed: `start`, `end` (seconds, scene-local), `action`, `from_x`/`to_x` or `x`,
  `facing`, `expression`, `seated`. Keep foot-grounded locomotion physically consistent; the rig's
  IK solver and footstep times are tested for 0 px bone stretch and 0 px stance foot slip.
- Paired interactions (`hug`, `handshake`, `high_five`, `handoff_give`/`receive`) use world-space
  midpoint locking. Prop occlusion (`desk`, `cafe_table`, `podium`, `passing_car`, etc.) is
  automatic; use `z` / `lane` for depth.
- Use only `SUPPORTED_BOARDS` (13 types: `stat_cards`, `notebook_page`, `line_graph`,
  `phone_card`, `checklist_card`, …) and `SUPPORTED_PROPS` in
  [`world_props_and_boards.js`](../../universal_toolbook/engine/world_props_and_boards.js).
  If a needed visual has no primitive, substitute an existing one and log it, or add a reusable
  primitive to the engine — never fake it per-video.

## Camera, framing and transitions

- `camera` drives a slow drift (`zoom_from`, `zoom_to`, `pan_from`, `pan_to`, `focus_x`, `focus_y`,
  `move_dur`). `camera_shots[]` drives motivated cuts (`start` or `cue_on`, zoom/focus range,
  `move_dur`, `cut`, `blend_sec`).
- Prefer multi-word `cue_on` phrases so pushes land on the spoken beat. Verify against a draft
  frame at the cue time.
- 16:9 is 1920×1080, 9:16 is 1080×1920, both 30 fps. Portrait reframing is uniform and
  subject-aware (`portrait_framing.js`). Boards are automatically fitted into the safe crop.
  Do not hand-author `portrait_focus`, `portrait_focus_x`, `portrait_w` or `portrait_x` unless a
  specific draft frame proves a defect (KI-009), and log the evidence.
- Transitions: automatic environment-change fades, `fade_to_black`, `cut_to_black_at`,
  `wind_blackout_at`, `flashback_window`, `split_screen`, `intertitle`, `end_card`, chapter ribbons.
  No generic cross-dissolve exists; adding one is an engine change with a regression test.

## Procedure

1. Read the polished script and `STORYBOARD.md`; assign one visual objective per scene.
2. Define `cast`, environments, props and boards; check every name against the engine lists.
3. Author beats and camera shots in `episode.json`; derive `SCENE_PLAN.json` with
   `python3 tools/make_scene_plan.py projects/<slug>`.
4. Run `validate` and require `warnings: []`.
5. Render full-resolution stills in **every** delivered aspect and actually look at them for
   anatomy, occlusion, subtitle/board collisions, clipped limbs and safe areas.
6. Draft-render to inspect cue-locked boards (`board_pop + ~1.6 s`) and camera cuts; stills do not
   contain TTS timings (KI-003).
7. Fix reusable defects in the engine and add a test in `tests/regression/run_all_tests.js`; do not
   patch one video's spec to hide a shared bug.
