# 04 — VISUAL GEOMETRY (the pixel rules)

All world coordinates below are in the **1920×1080 authoring stage**. The renderer can deliver
that stage as 16:9 landscape or a subject-aware 9:16 portrait crop; it uses one uniform scale and
never distorts character or prop geometry. Portrait output has its own safe crop and typography rules below.

```
y=0    ┌──────────────────────────────────────────┐
       │ chapter strip  y ≈ 40 … 80               │
       │                                          │
       │ board band     y ≈ 104 … 272             │
       │                                          │
       │ heads / name tags   y ≈ 240 … 390        │
       │                                          │
       │ bodies          y ≈ 300 … 855            │
y=855  ├────────────── FLOOR_Y ────────────────────┤
       │ subtitle card  y ≈ 894 … 968             │
       │                                          │
y=1080 └──────────────────────────────────────────┘
```

## 4.1 Subtitles

- Cel: one-row card centred at `centerY = 930 − (lines−1) × 20`.
- Parchment: `centerY = 962 − (lines−1) × 18`.
- A one-row card occupies ≈ **y 894–968**; a two-row card climbs to ≈ 874 and starts covering
  shoes and lower legs.
- Consequence: keep dialogue lines **≤ 46 characters** where possible, and never write a
  one-word line — the renderer merges it with the next line into a two-row card.

## 4.2 Boards

```jsonc
{ "y": 104, "h": 168, "build_dur": 1.1 }
```

- `y: 74, h: 210` (a tempting guess) collides with the **chapter strip** at the top and with
  **name tags** at the bottom.
- `build_dur > 1.2` leaves a translucent empty panel on screen for seconds — reads as a bug.
- Left-hand boards (`x: 0.03`, `w ≈ 470`) sit under the chapter card; keep `y ≥ 100`.
- Boards are drawn in **screen space**, so a camera push does not clip them — but a board can
  still be *covered by an actor* if the actor's `x` is under it.

Board band × actor spacing:

| Board x | Safe actor range |
| --- | --- |
| 0.03 (left) | actors at ≥ 0.40 |
| 0.62 (right) | actors at ≤ 0.58 |

## 4.3 Actor spacing and framing

- Pair at **0.42 / 0.68** for normal two-handers; **0.24 / 0.62** for a wide establishing shot
  where one actor enters from frame left.
- Both actors at 0.30 / 0.68 on a 1920 frame leaves no room for a long subtitle line — the
  box is centred, so text runs off the right edge.
- Keep actors out of the outer 5 %: `x ∈ [0.12, 0.88]`, and never park a character at exactly
  the frame edge unless they are meant to be cropped.
- The camera zoom (1.04–1.25) combined with `focus_x` shifts everything horizontally. A prop at
  `x: 0.075` can be pushed off-frame by `focus_x: 0.36`. When a prop disappears, suspect the
  camera before the prop.

## 4.4 Poses: the seated-rig trap

Several actions default to a **seated** rig:

`sit_desk_type`, `head_in_hands`, `sketch_desk`, `gather_pages`, `drink_cup` (seated variant)…

Used on a standing actor they collapse into a deep floating squat — the single most common
"broken anatomy" report. Fixes:

1. pass `"seated": false` on the beat, or
2. pick a standing action instead: `point_board`, `handoff_give`, `handoff_receive`,
   `talk_explain`, `listen_nod`, `clench_fist`, `cross_arms_skeptical`, `check_watch`.

Meanwhile, if the beat *is* seated, there must be a desk/chair prop under them
(`clean_desk`, `messy_desk`, `cafe_table`, `judge_table`) at roughly the same `x`.

## 4.5 Props

- Props are drawn with `prop.x × W` but rendered at **base scale 1.0 ≈ 104 px** for small
  items; `scale` multiplies that. A wall item needs `height_above_floor` (~300–450) or it will
  sit at torso height.
- Props respect `z`: negative z draws behind characters, positive in front. A prop you "can't
  see" is usually behind an actor — move `x` or set `z` positive.
- Nothing may be half-cropped by the frame edge (trees, signposts, clocks). Pull them inside
  `x ∈ [0.06, 0.94]` or leave them out.

## 4.6 Cue anchoring — the rule that matters most

Every board and every camera cut is locked to an **exact multi-word phrase that is actually
spoken**, taken from the line that *motivates* the visual:

- ✅ `cue_on: "holds today"` → the rule card is up for the whole explanation.
- ❌ `cue_on: <last phrase of the scene>` → the graphic appears for the final two seconds.

Verify from the draft at `cue_on + 1.5 s` (boards) and `cue_on + 2.5 s` (camera). If the phrase
is never spoken verbatim, the cue silently never fires.

## 4.7 Backgrounds and floors

- No scene may sit on a flat black field. Cel scenes get a floor sheen + depth bands from
  `drawFloorBase`; if it still reads empty, add a prop, a backdrop, or weather.
- `canyon_bridge` draws a real chasm (rock lips, depth gradient, mist, suspension span) — put
  the actors on the deck, not in the gap.
- Custom settings need at least `backdrop` + one `lighting` mode, otherwise the room is bare.

## 4.8 Camera grammar

- Shot 1: `start: 0`, slow push (`zoom_from 1.03 → zoom_to 1.08`).
- Shot 2+: cued on a phrase, `move_dur: 2.2`, a bigger push (`1.10 → 1.18`) or a re-frame on
  the other actor.
- `focus_x` 0.30–0.70, `focus_y` 0.52–0.64 (eyes-level band). Outside that you crop heads.
- Two camera shots per scene minimum; a scene with one static shot reads as a slide.

## 4.9 Portrait / Shorts composition (9:16)

Render the same episode spec in either size; do not edit the base `1920×1080` coordinates to fake
portrait. The renderer uses an aspect-preserving crop, eases between active character speakers
when available, and otherwise focuses the character closest to the authored camera focus. Its
composition bounds include the character rig and carried objects, not just the actor's center. For
narration-led group shots, up to three nearby actors are considered; if the full group would require
excessive shrinkage, framing prioritizes the closer focal pair instead of adding letterbox bars. The
scene is uniformly zoomed out only as much as needed for a full-bleed 9:16 crop. No axis is stretched.
Subtitles and chapter labels are fitted to the visible crop, and boards are uniformly scaled and
repositioned inside its safe area.

```bash
# Review the intended vertical composition before the final render
python3 universal_toolbook/run_studio.py stills work/episode.json \
  --out-dir work/stills_9x16 --width 1080 --height 1920

# Optional per-scene override: choose a cast id, "board", or a normalized x focus
```

Scene-level framing fields are optional; automatic focus remains the default:

```jsonc
{
  "portrait_focus": "lead",       // a character id, or "board"
  "portrait_focus_x": 0.42,        // normalized stage x, 0..1; overrides the id
  "board": {
    "type": "line_graph",
    "portrait_w": 520,             // optional authoring-stage width; uniformly scaled with the board
    "portrait_x": 0.5              // optional normalized or authoring-stage center x
  }
}
```

In a multi-character scene, automatic portrait framing keeps nearby actors together during
narration, but a distant secondary actor may still be off-screen; active dialogue continues to
prioritize its speaker. Set `portrait_focus`/`portrait_focus_x` for a deliberate alternate
composition, then inspect that portrait still.
Use `--aspect-ratio 9:16` for any portrait runtime, or `--shorts` to additionally enforce a
40–90 second speech-locked final duration.
