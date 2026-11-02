# 02 — AUTHORING `episode.json`

The whole film is one JSON file. This page is the working guide; `01_TOOLBOOK_REFERENCE.md`
is the exhaustive schema, and `universal_toolbook/templates/episode_minimal.json` is a **validated, runnable**
2-scene skeleton — copy it, don't start from a blank file.

```bash
cp universal_toolbook/templates/episode_minimal.json work/episode.json
python3 universal_toolbook/run_studio.py validate work/episode.json      # "warnings": []
```

Delivery aspect is selected at render time; the same authored JSON can produce landscape and
portrait masters. Use 16:9 or 9:16 according to the script and publishing requirement, not merely
because a piece is short. For vertical composition, scenes may set `portrait_focus` to a cast id
or `"board"`, or `portrait_focus_x` to a normalized stage x from 0 to 1. See
`04_VISUAL_GEOMETRY.md` for how portrait focus and safe-area boards work.

---

## 2.1 Top level

```jsonc
{
  "title": "…",                 // shown on the title/outro cards
  "channel_name": "",           // optional watermark; leave empty for a clean frame
  "thesis": "…",                // one sentence; used by the outro/description
  "style": "cel",               // "cel" (cinema) or "parchment" (ink on paper)
  "bgm": "dynamic",             // "dynamic" | "auto" | a track id | "none"
  "subtitles_mode": "cinema",   // "cinema" | "off"
  "outro": false,               // true adds an end card
  "voices": { … },              // speaker id -> { voice, rate, pitch }
  "cast":   { … },              // character id -> body definition
  "scenes": [ … ]               // 2–12 scenes, in order
}
```

## 2.2 `cast` — one entry per character

Every field below is load-bearing; the two that people forget are `color` (body/garment
colour — omit it and the character renders in a default blue) and `eyes` (omit it and the
face is blank).

```jsonc
"hero": {
  "name": "RIN",                 // the on-screen name tag (UPPERCASE reads best)
  "style": "cel",
  "color": "#f8fafc",            // body / garment base colour
  "build": "lean",               // lean | average | broad | tall | stout | child | elderly
  "hair": "ponytail",            // short_neat | textured_messy | curly | bun | ponytail | side_part | bald | …
  "hair_color": "#2f1f18",
  "shoe_color": "#b91c1c",
  "eyes": true,
  "expression": "determined",    // default expression; scenes can override per beat
  "posture": 0.2,                // -1.0 slouched … +1.0 alert
  "scale": 1.55,                 // 1.52–1.65 gives cinema presence on a 1920 frame
  "accessories": ["watch", "shoulder_bag"],
  "bag_color": "#b91c1c",        // per-accessory colour keys: coat_color, scarf_color, tie_color, bag_color …
  "coat_color": "#0f3d3e",
  "scarf_color": "#fbbf24"
}
```

**Make them different.** Two characters that share build + colour read as clones. Vary build,
height (`scale`), silhouette (bag/coat), and colour value (one light, one dark) — that is what
makes a two-hander readable at a glance.

## 2.3 `voices`

```jsonc
"voices": {
  "narrator": { "voice": "en-US-GuyNeural",         "rate": "+1%", "pitch": "-1Hz" },
  "hero":     { "voice": "en-US-JennyNeural",       "rate": "+3%", "pitch": "+2Hz" },
  "mentor":   { "voice": "en-US-ChristopherNeural", "rate": "-3%", "pitch": "-2Hz" }
}
```

Keys must match `dialogue[].speaker` exactly. Rates `+0%…+4%` for pace, negative for weight.
See `05_AUDIO.md` for what actually happens to these names offline.

## 2.4 A scene, field by field

```jsonc
{
  "id": "S01",
  "chapter": "Chapter One | The Problem",   // on-screen chapter card, "A | B" reads well
  "environment": "modern_office",           // OR use "setting": { … } for a custom room
  "mood": "reflective",
  "bgm": "reflective_piano", "bgm_gain": 0.9,
  "accent_color": "#60a5fa",                // subtitles, trim, light cones
  "duration": 12.0,                         // planned length (speech retimes it)
  "min_duration": 10.0,
  "lead_in": 0.7, "tail_out": 0.6,
  "portrait_focus": "hero",           // optional: character id or "board"
  "portrait_focus_x": 0.42,           // optional: normalized stage x, overrides portrait_focus
  "props": [ { "type": "clock", "x": 0.88, "y": 110, "z": -12 } ],
  "camera_shots": [ … ],
  "characters":   [ … ],
  "boards":       [ … ],
  "accent_words": ["two weeks"],
  "dialogue":     [ … ]
}
```

### `characters[].beats[]`

```jsonc
{ "start": 0.0, "end": 6.0, "action": "walk",
  "from_x": 0.28, "to_x": 0.42, "facing": 1, "expression": "determined" }
```

- `start`/`end` are seconds **inside the scene**, and must tile the scene with no gaps.
- `action` must be one of the 60 names in `01_TOOLBOOK_REFERENCE.md` (a typo silently falls
  back to a standing idle — the scene looks frozen, not broken).
- `x` for stationary beats, `from_x`/`to_x` for locomotion. Keep pairs at ≈0.42 / 0.68, or
  0.24 / 0.62 on wide establishing shots.
- `facing`: `1` right, `-1` left. Two characters should face each other.
- Poses that are seated by default (`sit_desk_type`, `head_in_hands`, `sketch_desk`,
  `stand_from_desk`'s counterpart…) need `"seated": true`, and must NOT be used on a standing
  actor — see `04_VISUAL_GEOMETRY.md`.

### `camera_shots[]`

```jsonc
{ "start": 0.0, "zoom_from": 1.04, "zoom_to": 1.08, "focus_x": 0.44, "focus_y": 0.58, "cut": true },
{ "cue_on": "two weeks", "zoom_from": 1.1, "zoom_to": 1.16,
  "focus_x": 0.52, "focus_y": 0.58, "move_dur": 2.2, "cut": true }
```

First shot uses `start: 0`; every later shot uses `cue_on` with the **exact multi-word phrase**
from the dialogue that motivates it. `zoom` 1.0–1.25 only; `focus_x/y` 0.3–0.7 keeps the frame
from drifting off the cast. In portrait output, `portrait_focus` / `portrait_focus_x` controls the
separate 9:16 crop; automatic focus follows the speaking character when possible, without changing
the authored camera or stretching the scene.

### `boards[]`

```jsonc
{ "type": "notebook_page", "x": 0.64, "y": 104, "w": 560, "h": 168,
  "portrait_w": 520, "portrait_x": 0.5,  // optional 9:16 width and normalized horizontal center
  "build_dur": 1.1, "bold_first": true,
  "lines": ["THE PLAN, IN INK:", "Two weeks.", "Nobody will check."],
  "cue_on": "two weeks", "hold_sec": 5.5 }
```

Board types: `notebook_page`, `stat_cards`, `bar_chart`, `line_graph`, `flow_chain`,
`cycle_loop`, `iceberg`, `checklist_card`, `sketch_card`, `child_drawing`, `phone_card`,
`obsessive_rule_card`, … (full list in the reference). Keep `y: 104`, `h: 168`, `build_dur ≤ 1.2`.
The portrait compositor automatically fits each board into its visible crop. Optional `portrait_w`
(authored-stage width) and `portrait_x` (authored-stage or normalized `0..1` center) override the
automatic width and horizontal placement for portrait renders only; the whole board, including its
text, is scaled uniformly.

### `dialogue[]`

```jsonc
{ "speaker": "mentor", "text": "You have two weeks. Write it down.", "pause_after": 0.3 }
```

One sentence per entry. Keep subtitles **≤ 46 characters** where the wording allows; the
renderer splits long lines, and a split line becomes a two-row card that sits lower on screen.
Avoid one-word entries — they get merged with the following line.

## 2.5 Custom settings instead of a preset

```jsonc
"setting": {
  "sky": ["#071022", "#16304f"],
  "floor_color": "#132131",
  "light_color": "#7dd3fc",
  "backdrop": "mountains",     // mountains|city|forest|hills|ocean|windows|shelves|horizon|pure_black
  "weather": "rain",           // rain|snow|stars|embers|clear
  "rain_intensity": 1.15,
  "lighting": "spotlights"     // skylights|spotlights|streetlamps|sun_orb|moon_orb
}
```

Use presets when they fit (`python3 universal_toolbook/run_studio.py` environments list in the reference); use a
custom setting when the story needs weather or a specific sky. `pure_black` exists but the
brief forbids leaving a scene on it.

## 2.6 Validation is strict about structure, silent about intent

`validate` will not tell you that:

- a board is cued on a phrase nobody says (it simply never appears);
- two characters overlap (they will);
- a pose is seated on a standing actor (they float);
- a line is 60 characters (it wraps into the lower safe zone).

Those four are caught by the stills/draft review, which is why `06_QA_GATE.md` exists.
