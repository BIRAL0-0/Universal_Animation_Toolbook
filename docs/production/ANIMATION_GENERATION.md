# ANIMATION GENERATION — Stage 9

**Status: IMPLEMENTED.** The "animation" is produced by authoring a scene graph that a
deterministic renderer executes. **There is no neural video-generation model in this
pipeline** — no image model, no video model, no per-scene generated footage. Everything on
screen is drawn by the engine from your JSON, which is why consistency between scenes is
guaranteed by construction instead of by prompting.

Deep reference: the full schema in
[`universal_toolbook/01_TOOLBOOK_REFERENCE.md`](../../universal_toolbook/01_TOOLBOOK_REFERENCE.md),
the authoring guide in
[`universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md`](../../universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md),
and the pixel rules in
[`universal_toolbook/process/04_VISUAL_GEOMETRY.md`](../../universal_toolbook/process/04_VISUAL_GEOMETRY.md).

## 9.1 What "generation" means here

One episode JSON is the complete description of the film:

- **cast** — each character defined once (build, hair, colour, posture, accessories, scale)
  and referenced by id everywhere → the consistency mechanism.
- **scenes** — in order; each with a location (preset `environment` or parametric
  `setting`), `characters[].beats[]` (which of the 60 actions, where, when),
  `camera_shots[]`, `boards[]`, `props[]`, `dialogue[]`, `accent_words`.
- **style** — `cel` (atmospheric cinema) or `parchment` (ink on paper), set once, optionally
  overridden per scene.

The renderer (`universal_toolbook/engine/video_renderer.js` + the rig/motion/environment
modules) executes that description at 30 fps on a 1920×1080 authoring stage, and delivers
16:9 or a subject-aware 9:16 crop — reframed, never stretched.

## 9.2 Scene breakdown procedure

Work per scene, in this order (mirrors the intake stage):

1. **Location & mood.** Pick a preset (12, listed in the toolbook reference) or write a
   parametric `setting` (sky, floor, light, backdrop, weather, lighting). A scene with no
   set dressing reads empty — `pure_black` exists and is off-limits as a rest state.
2. **Cast on screen.** ≤ 2 principal characters (3 collides at 1920; portrait crops may
   drop a non-focused actor). Face each other; pair spacing 0.42 / 0.68 (0.24 / 0.62 for
   wide establishing shots).
3. **Beats.** 2–4 per character, tiling the scene with no gaps: enter, cross, sit, point,
   hand off, react. Locomotion uses `from_x`/`to_x`; a seated-rig action on a standing actor
   is the classic floating-squat bug (see 04_VISUAL_GEOMETRY §4.4).
4. **Proof object.** One visual object that carries the scene's fact: a board, a prop,
   weather. No proof object and no camera move = two people talking in a void.
5. **Camera.** An opening shot + at least one push/cut, every later shot `cue_on` an exact
   multi-word phrase from the dialogue that motivates it. Zoom 1.0–1.25; `focus_x/y` 0.3–0.7.
6. **Dialogue.** One sentence per entry, ≤ 46 characters where possible, no one-word
   entries; `pause_after` 0.22–0.32 (0.35–0.45 at scene turns).
7. **Boards.** `y: 104, h: 168`, `build_dur ≤ 1.2`, `cue_on` the motivating phrase,
   `hold_sec` sized to the explanation. Portrait: optional `portrait_w` / `portrait_x`.
8. **Accent words.** Multi-word phrases that deserve the subtitle glow (`"9 PM"`,
   `"no excuses"`).

## 9.3 Character consistency across scenes

- **Structural, not statistical.** The `cast` entry *is* the character: same id in every
  scene draws the same body, hair, colour, accessories. There is nothing to "keep
  consistent" between scenes — there is only one definition.
- Make characters **distinguishable by design**: vary build, `scale` (1.52–1.65 for cinema
  presence), silhouette (coat/bag), and colour value (one light, one dark). Two figures
  sharing build + colour read as clones.
- The same `voices` map gives each speaker one voice for the whole film
  ([`VOICE_GENERATION.md`](VOICE_GENERATION.md)).
- Cross-scene *continuity* (a character holds an object from scene 3 to scene 5) is authored,
  not automatic: re-place the prop in each scene's `props[]` and use matching beats
  (`handoff_give` / `handoff_receive` for transfers, per the reference films in `examples/`).

## 9.4 The visual QA loop (quality before proceeding)

This is the engine's substitute for "checking a generated clip":

```bash
# 1. validate — structure + optional verbatim fidelity
python3 universal_toolbook/run_studio.py validate runtime/work/<slug>/episode.json

# 2. full-resolution stills in the delivery aspect (cheap — seconds, not minutes)
python3 universal_toolbook/run_studio.py stills runtime/work/<slug>/episode.json \
  --out-dir runtime/work/<slug>/stills_16x9 --width 1920 --height 1080
# portrait delivery: --width 1080 --height 1920 (and check portrait_focus / safe areas)

# 3. LOOK at every still (the checklist is process/06_QA_GATE.md §1)
# 4. draft render — boards and camera cuts are only visible mid-scene
python3 universal_toolbook/run_studio.py render runtime/work/<slug>/episode.json \
  --out /tmp/draft/film_draft.mp4 --draft --voice auto --workers 2 --chunk-sec 20
# frame at every cue_on + 1.5 s (boards) and + 2.5 s (cuts)
```

Two or three rounds of *stills → look → fix* is normal and cheap. A full render containing
an overlap is neither cheap nor recoverable in place. `--limit N` on stills renders only
the first N scenes while iterating.

## 9.5 Regeneration model

- **Re-time / re-block / re-cue:** edit `episode.json`, re-validate, re-still, re-render.
  Voice cache means re-renders don't re-synthesize unchanged lines
  ([`VOICE_GENERATION.md`](VOICE_GENERATION.md) §8.4).
- **New prop, board type, or set that does not exist:** the libraries are fixed. A bespoke
  object is drawn in `universal_toolbook/engine/world_props_and_boards.js` and registered in
  `SUPPORTED_PROPS`; a bespoke set extension follows the pattern of
  `universal_toolbook/engine/impossible_wall.js`, `universal_toolbook/engine/beacon_harbor.js` or `universal_toolbook/engine/bamboo_grove.js`
  (project-specific set modules dispatched from the style module). That is engine work —
  it belongs in its own PR with tests and docs, not inline in a film's session.
- **New action:** same story in `universal_toolbook/engine/motion_library.js`; the JS test
  suite (`tests/regression/run_all_tests.js`) verifies all 60 actions, IK stretch, and foot slip —
  run it after any engine change.

## 9.6 What this stage cannot do (engine limits, measured)

No 3D / rotation / walking away from camera; no crowds; vehicles only as `passing_car` /
`passing_bus` props; lip movement is amplitude-based (reads as "talking", not phonemes);
boards are screen-space and cannot animate internally beyond `build_dur`; aspect limited to
16:9 and 9:16 in the CLI; 30 fps; zero grain by design. Full table:
[`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md).
