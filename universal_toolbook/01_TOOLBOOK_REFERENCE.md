# Universal Animation Toolbook v3 — Complete Technical Reference

This reference defines the complete JSON schema compiled by `engine/episode.js` and rendered by `run_studio.py`. Characters, hairstyles, hands, shoes, voices, settings, z-depth props, speech-locked boards, speech-locked camera moves, glowing subtitles, SFX, and BGM are **100% parameter-driven from JSON**.

## Output framing and short-form profiles

Aspect ratio is a render-time delivery choice, independent of episode JSON and script length. The
same spec can be rendered as 16:9 landscape (1920×1080) or 9:16 portrait (1080×1920); the renderer
preserves geometry and reframes rather than stretching. Choose the aspect according to the script
and destination. For short-form delivery, target 40–90 seconds total; `--shorts` specifically
selects 9:16 and checks the final speech-locked runtime (inclusive). A short landscape film or a
portrait film outside that range uses `--aspect-ratio` without the Shorts duration gate.

```bash
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/film_16x9.mp4 --full
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 9:16 --out output/film_9x16.mp4 --full
python3 universal_toolbook/run_studio.py render work/short_episode.json --shorts --out output/short_9x16.mp4 --full
```

---

## 1. Top-Level Episode Schema

```json
{
  "title": "Film or Episode Title",
  "channel_name": "",
  "thesis": "Core thematic takeaway.",
  "bgm": "dynamic",
  "subtitles_mode": "cinema",
  "voices": {
    "narrator": { "voice": "en-US-GuyNeural", "rate": "+1%", "pitch": "-1Hz" },
    "lead":     { "voice": "en-US-AndrewNeural", "rate": "+2%", "pitch": "+0Hz" },
    "partner":  { "voice": "en-US-JennyNeural", "rate": "+2%", "pitch": "+0Hz" }
  },
  "cast": { ... },
  "scenes": [ ... ],
  "outro": false
}
```

- **`bgm` modes**:
  - `"auto"` — Scores script keywords/moods against `assets/bgm/BGM_CATALOG.json` and loops seamlessly with `-9.5 dB` speech ducking.
  - `"dynamic"` — Crossfades per-scene `bgm_track` selections (`bgm_offset`, `bgm_gain`, `bgm_fade_out`) across multi-act mood shifts.
  - Bundled Track IDs (`assets/bgm/`): `"reflective_piano"`, `"suspense_tension"`, `"chill_focus"`, `"triumph_horizon"`, `"electronic_drive"`, `"upbeat_ncs_synth"`, `"retro_pulse"`.
  - Or a custom audio file path, `"procedural"`, or `"none"`.

---

## 2. V3 Biomechanical Character Creator (`cast`)

### Style A: Atmospheric Cinema Cel Characters (`style: "cel"` / `"glossy"` / `"flat"`)
```json
"lead": {
  "name": "DANIEL",
  "color": "#38bdf8",
  "style": "cel",
  "build": "standard",
  "hair": "short_neat",
  "hair_color": "#0f172a",
  "shoe_color": "#1e293b",
  "eyes": true,
  "expression": "focused",
  "posture": 0.25,
  "outline_width": "standard",
  "accessories": ["glasses", "watch"],
  "coat_color": "#134e4a",
  "scarf_color": "#e2e8f0",
  "scale": 1.58
}
```
- **`build` (7)**: `"standard"`, `"slim"`, `"lean"`, `"athletic"`, `"broad"`, `"heavy"`, `"compact"`.
- **`hair` (12)**: `"none"` / `"bald"`, `"buzz"`, `"short_neat"`, `"side_part"`, `"textured_messy"`, `"curly"`, `"spiky"`, `"long_straight"`, `"long_wavy"`, `"bob"`, `"bun"`, `"ponytail"`.
- **`posture` (`-1.0..+1.0`)**: Curved 3-joint spine (`hip -> spineMid -> shoulder -> neck -> head`). Positive values (`+0.2..+0.6`) lift the sternum into a tall, proud vertical stance; negative values (`-0.3..-0.9`) round the upper back forward with weary neck droop.
- **`expression`**: `"neutral"`, `"focused"`, `"determined"`, `"sad"`, `"tired"`, `"exhausted"`, `"worried"`, `"skeptical"`, `"tense"`, `"shocked"`, `"curious"`, `"hopeful"`, `"smile"`, `"relieved"`, `"excited"`.
- **`accessories` (18)**: `"glasses"`, `"sunglasses"`, `"headband"`, `"tie"`, `"bowtie"`, `"cap"`, `"hat"`, `"crown"`, `"helmet"`, `"scarf"`, `"badge"`, `"cape"`, `"coat"`, `"backpack"`, `"shoulder_bag"`, `"watch"`, `"headphones"`, `"halo"`.
- **Articulated Hands & Grounded Shoes**: Every action drives forearm-aligned wrist/finger shapes (`"relaxed"`, `"open"`, `"point"`, `"fist"`, `"grip"`, `"clasp"`, `"embrace"`) and heeled/soled shoes with dynamic heel-strike and toe-off pitch.

### Style B: Warm Parchment & Hand-Inked Stick Characters (`style: "ink_stick"` or scene `style: "parchment"`)
Automatically active on any `"parchment_*"` backdrop or when `style: "parchment"` / `"ink_stick"`:
- **Ink Accessories / Silhouettes**: default 3 forehead hair tufts, or `"long_hair"`, `"side_wisps"`, `"tunic"` / `"dress"`, `"collar"` / `"coat"`, `"glasses"`.
- **Ink Cartoon Expressions**: `"burnout_cry"` (wide open mouth + flying sweat droplets), `"chin_doubt"` (hand-to-chin pose + wavy doubt mouth), `"shocked"` (wide eyes + 3 comic exclamation rays), `"smile"` / `"hopeful"`, `"determined"` / `"focused"`, `"sad"` / `"tired"` / `"exhausted"`.

---

## 3. Environments & Parametric Settings (`setting` / `environment`)

### Mode 1: Dark/Atmospheric Cinema Settings
```json
"setting": {
  "sky": ["#061414", "#0d2626"],
  "floor_color": "#071012",
  "light_color": "#2dd4bf",
  "backdrop": "windows",
  "weather": "snow",
  "lighting": "spotlights"
}
```
- **`backdrop`**: `"windows"`, `"city"`, `"mountains"`, `"hills"`, `"forest"`, `"ocean"`, `"desert"`, `"grid"`, `"arches"`, `"pillars"`, `"shelves"`, `"minimal"`.
- **`weather`**: `"clear"`, `"stars"`, `"rain"`, `"snow"`, `"particles"`.
- **`lighting`**: `"skylights"`, `"spotlights"`, `"sunbeams"`, `"sun_orb"`, `"horizon_glow"`, `"none"`.
- **Built-in Presets (`environment`)**: `"night_city"`, `"modern_office"`, `"bedroom_late"`, `"storm_road"`, `"lecture_stage"`, `"library_study"`, `"tech_lab"`, `"park_twilight"`, `"crossroads_duality"`, `"canyon_bridge"`, `"mind_space"`, `"sunrise_summit"` (plus aliases `"studio"`, `"dawn_road"`, `"city_rain"`, `"night_office"`).
- **Foreground Parallax (`foreground`)**: `"window_frame"`, `"street_railing"`, `"park_trees"`, `"diner_glass"`.

### Mode 2: Warm Kraft-Parchment & Hand-Inked Backdrops (`parchment_*` or `"style": "parchment"`)
- `"parchment_stage"`, `"parchment_room"`, `"parchment_studio"`, `"parchment_pedestals"`, `"parchment_hallway"`, `"parchment_drafting"`, `"parchment_chasm"`, `"parchment_cliff"`, `"parchment_sunrise"`.
- **Top Headline Formatting (`chapter`)**: In parchment scenes, `"chapter": "Two Years on | Page One"` renders `"Two Years on "` in dark ink and `"Page One"` in crimson `#cc292b`.

---

## 4. Speech-Locked Cinematography, Z-Depth Occlusion, Boards, 60 Actions & Subtitles

### Speech-Locked Multi-Shot Camera Cuts (`camera_shots`)
Shots can either specify fixed `start`/`end` seconds OR snap directly to spoken words via `cue_on` / `end_on` (plus optional `move_dur` so pans/pushes settle crisply on the dramatic beat instead of drifting slowly):
```json
"camera_shots": [
  { "start": 0.0, "zoom_from": 1.12, "zoom_to": 1.18, "focus_x": 0.50, "focus_y": 0.62, "cut": true },
  { "cue_on": "stopping at 9 PM", "zoom_from": 1.28, "zoom_to": 1.34, "focus_x": 0.34, "focus_y": 0.64, "move_dur": 2.2, "cut": true },
  { "cue_on": "turned into burnout", "zoom_from": 1.16, "zoom_to": 1.08, "focus_x_from": 0.34, "focus_x_to": 0.66, "move_dur": 1.8, "cut": false, "blend_sec": 0.55 }
]
```

### Per-scene portrait framing (`portrait_focus`, `portrait_focus_x`)

```json
{
  "portrait_focus": "lead",
  "portrait_focus_x": 0.42
}
```

These optional fields live on a scene. `portrait_focus` names a character id or `"board"`;
otherwise the automatic crop eases toward the active character speaker when possible. Set
`portrait_focus_x` to a normalized authored-stage position from `0` to `1` when narration needs a
specific point of interest; it takes precedence over `portrait_focus`. Portrait framing affects
only 9:16 output, and inactive characters outside the crop may not be visible. Inspect portrait
stills before rendering the master.

### Unified Z-Depth Layering & Automatic Furniture / Embrace Occlusion
- Every prop, board, vehicle, and character accepts optional numeric `"z"` (default: boards `-18`, back lane `-12`, standard props `-4`, characters `0`, front lane `+18`) or `"layer": "far_back" | "back" | "mid" | "front" | "far_front"`.
- **Split-Depth Furniture**: When a character sits/stands at `"desk"`, `"clean_desk"`, `"messy_desk"`, `"cafe_table"`, `"judge_table"`, or `"podium"`, the renderer automatically splits the prop into `back_only` (chair behind character) and `front_only` (tabletop over legs/waist, underneath typing/gesturing hands).
- **Supported Props (`31`)**: `"desk"`, `"podium"`, `"bench"`, `"door"`, `"boulder"`, `"stairs"` (alias `"staircase"`), `"signpost"`, `"clock"`, `"digital_clock"`, `"pocket_watch"`, `"streetlamp"`, `"bed"`, `"cafe_table"`, `"ankle_chain"`, `"goal_silhouette"`, `"pedestal"`, `"books"`, `"umbrella_stand"`, `"water_trail"`, `"bus_shelter"`, `"passing_bus"` (`lane: "back" | "front"`), `"passing_car"` (`lane: "back" | "front"`, `body_color`), `"headlights"`, `"photo_table"`, `"clean_desk"`, `"messy_desk"`, `"wall_calendar"`, `"framed_certificate"`, `"judge_table"`, `"curtain_window"`, `"park_tree"`.

### Speech-Locked In-World Boards (`board` or `boards`) — Safe-Zone Clamped & Auto-Hiding
- **Types (`13`)**: `"stat_cards"` (`cards: [{ "value": "9 PM", "label": "..." }]`), `"line_graph"`, `"flow_chain"`, `"bar_chart"`, `"cycle_loop"`, `"iceberg"`, `"checklist_card"`, `"notebook_page"`, `"sketch_card"`, `"child_drawing"`, `"phone_card"`, `"obsessive_rule_card"`, `"photo_back_card"`.
- **`x`, `y`, `w`, `h`**: Accept EITHER normalized `0..1` viewport fractions OR pixel values, automatically clamped inside safe screen margins so boards never clip edges or overlap subtitles.
- **Portrait-only overrides**: `portrait_w` sets an authored-stage width; `portrait_x` sets its authored-stage horizontal center (normalized `0..1` or pixels). Omit both to fit and center the board automatically. Reframing scales the complete board uniformly, including typography.
- **Timing**: Set `"cue_on": "multi-word spoken phrase"` and `"hide_on": "closing phrase"` (or `"hold_sec": 6.0`). Unless `"persist": true` is set, boards automatically fade out after a clean reading window (`build_dur + 4.0s`) rather than lingering for the rest of the scene.

### All 60 Zero-Stretch Biomechanical Actions (`action` / `beats[j].action`)
- **Locomotion & Dynamic Movement**: `"walk"` (`from_x`, `to_x`), `"walk_sad"`, `"run"` (true aerial flight phase), `"climb_stairs"` (`stairs_x`, `steps`), `"descend_stairs"`, `"jump"` (`jump_height`), `"trip_stumble"`, `"fall_down"`, `"push_boulder"`, `"walk_umbrella"`, `"pace_think"`.
- **Dual-Actor World-Space Interactions**: `"hug"` (3-pass interleaved embrace), `"hug_kneel"`, `"handshake"` (world-locked palm clasp), `"high_five"`, `"handoff_give"`, `"handoff_receive"`, `"offer_umbrella"`.
- **Seated & Desk Work**: `"sit_desk_type"` (aliases `"type_desk"`, `"sit_desk"`), `"sit_desk_slump"`, `"sketch_desk"`, `"stand_from_desk"`, `"sit_bench"`, `"sit_bed_edge"`, `"sit_cafe_listen"`, `"sit_cafe_talk"`, `"sit_cafe_write"`.
- **Dialogue, Gesture & Everyday Acting**: `"idle_stand"`, `"talk_explain"`, `"listen_nod"`, `"nod_yes"`, `"shake_head_no"`, `"debate_gesture"`, `"point_board"`, `"write_board"`, `"point_emphasis"`, `"chest_hand_sincere"`, `"cross_arms_skeptical"`, `"wave_hand"`, `"clench_fist"`, `"celebrate_arms_up"` (alias `"celebrate"`), `"meditate_focus"`, `"look_horizon"`, `"head_in_hands"`, `"kneel_exhausted"`, `"kneel_lookup"`, `"stand_up_resolve"`, `"phone_scroll"`, `"phone_call"`, `"drink_cup"`, `"stretch_wake"`, `"wipe_eyes"`, `"check_watch"`, `"pick_up_floor"`, `"open_curtains"`, `"gather_pages"`, `"hold_blueprint"`, `"hold_drawing"`, `"hold_umbrella"`, `"close_shake_umbrella"`.

### Glowing Subtitles, Multi-Word Phrase Highlighting & Voice Sync
- **`accent_words`**: Supports both single words and **multi-word phrases** (e.g. `["discipline", "9 PM", "no excuses", "one more hour"]`) plus automatic ALL-CAPS emphasis detection.
- **Smooth Active-Word Glow**: Continuous-speech `WordBoundary` micro-gaps (`<= 0.28s`) are automatically bridged so the golden/accent active-word glow capsule glides smoothly from word to word without flickering, while pausing naturally across real sentence breaks.

### Screen-Space Graphics Boards (camera-independent)
Boards are composited through the *pre-camera* transform, so a `camera_shots` push or pan moves the
world (environment, props, characters) **behind** them while the board stays anchored in its
safe-zone rectangle and never clips off-frame. No JSON change is needed — this is how every board
type behaves now.

### Subtitle Chunking Rules (natural cue breaks)
A single `dialogue` line can still produce several cinematic subtitle cues. The splitter:
1. always breaks at sentence punctuation (`! ? .`) once a cue holds 2+ words;
2. breaks at clause punctuation (`, ; : —`) once a cue reaches 5 words / 34 characters;
3. only hard-cuts at the 11-word / 68-character cap, and when it must, it slices **after** the most
   recent punctuation or **before** the nearest function word (`and`, `the`, `she`, `that`, …) so a
   cue never starts or ends mid-phrase.

Write dialogue in short, one-breath sentences if you want broadcast-style single-line cues.

---

## Voice Backends & Offline Rendering

| Backend | Trigger | Notes |
| --- | --- | --- |
| `edge-tts` | default when the endpoint is reachable | Word-boundary-accurate timestamps, per-speaker neural voices |
| `piper-offline` | automatic fallback per line | Local `.onnx` voices, syllable-weighted timings refined against real voiced onsets |
| `os-tts` | `--voice offline` with `espeak-ng` installed | Robotic, last resort |
| `external-audio` | `--voice-dir <dir>` with `S01.wav` … `S07.wav` | Your own recorded narration |
| `text-led` | `--voice none` | Silence; choreography/captions still render |

```bash
pip install piper-tts
python3 universal_toolbook/tools/fetch_piper_voices.py check                       # is offline voiceover ready?
python3 universal_toolbook/tools/fetch_piper_voices.py install --from-dir ~/voices # copies .onnx + .onnx.json
python3 universal_toolbook/run_studio.py render work/episode.json --out out.mp4 --voice piper   # force offline
```

Voice resolution: `PIPER_VOICE_DIR` → `~/.cache/piper_voices` → `assets/voices/`. Edge voice ids in
existing episode JSON keep working — `en-US-GuyNeural`, `en-US-JennyNeural` and
`en-US-ChristopherNeural` map onto the three recommended Piper models. Any `.onnx` dropped in the
voice directory can be addressed directly as `"voice": "piper:en_GB-semaine-medium"`.

---

## Canvas Backends

`engine/canvas_backend.js` renders through **either** `node-canvas` (Cairo/Pango, needs a native
build) **or** `@napi-rs/canvas` (prebuilt binaries, no system libraries), whichever resolves first.
Both are declared as `optionalDependencies`, so `npm install` succeeds on a machine that can only
build one of them, and `python3 universal_toolbook/run_studio.py check` accepts either.

---

## Starting Spec

`templates/episode_minimal.json` is a complete, validated 2-scene episode (cel style, two
characters, one board, two camera shots per scene). Copy it, replace the story, and build up
from there — it renders as-is, so it doubles as a pipeline smoke test.

## Example Specs (`examples/`)

| Spec | Style | Length | Demonstrates |
| --- | --- | --- | --- |
| `examples/cel_two_inch_bridge_episode.json` | cel | ~1:43 | 8 scenes, notebook/stat boards, custom rain setting, speech-locked cuts |
| `examples/two_inch_bridge_episode.json` | parchment | ~1:47 | 2 ink-stick actors, 7 parchment backdrops, 4 board types, two-actor `handoff` |
| `examples/red_umbrella_episode.json` | cel | long-form | night-city weather, umbrellas, family cast |
| `examples/discipline_vs_obsession_episode.json` | cel | long-form | phone cards, desks, multi-act BGM switching |
| `examples/two_inch_bridge_fable_episode.json` | parchment | ~1:45 | same story, fable framing, different board cues |

Each is a complete, valid episode: validate it, render it, or copy it as the starting point for
a new film.
