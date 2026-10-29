# PRODUCTION PROMPT — "The Two-Inch Bridge" (cel style, 1080p)

> This file is written **as a prompt**: paste it (plus the repo checkout) into a fresh
> session and a competent model should be able to rebuild this film, or swap the story and
> keep every technical decision intact. It records the brief, the cast, the scene table, the
> cue anchoring rules, the render commands and the acceptance gate.

---

## 0. Mission

Produce **one** complete, zero-grain, 16:9 animated `.mp4` at **1920×1080 / 30 fps** with
expressive multi-voice narration and dialogue, Creative Commons background music, and
synchronised foley — then deliver it with a chapter file.

Chosen style for this run: **`style: "cel"` — Atmospheric Cinema Cel Style**
(the alternative, `parchment`, is the hand-inked sketchbook look; do not mix them).

Deliverables:

| Path | What |
| --- | --- |
| `output/final_film_1080p.mp4` | the master |
| `output/final_film_1080p_chapters.txt` | chapters + CC music credits |
| `outputs/` | text-native mirrors (reports, validation, cue sheets, chapters) |

---

## 1. Hard constraints

1. **Always run `check` → `validate` → 1080p `stills` → inspect → draft → inspect → final.**
   Never call a render finished without looking at frames.
2. `validate` must report `warnings: []`.
3. Film grain **off**. Zero grain.
4. Final render flags: `--full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume`.
   Add `--voice auto` in this sandbox.
5. **Do not overwrite an existing project or render.** New unique output names.
6. Back up any engine file before editing it (`cp engine/x.js /tmp/x.js.bak.$(date +%s)`).
7. Temp frames/logs to `/tmp`; only deliverables and text artifacts in the repo.
8. No fabricated results: every number quoted must come from a file produced by the run.
9. If a verbatim script is supplied, preserve **100 %** of it (`validate --script`).
   None was supplied here, so the script below is original.

---

## 2. Story + script (original, keep or replace wholesale)

Logline: a young engineer shaves two inches off every joint to finish a canyon bridge five
weeks early; the flood proves why margin matters, and the rebuild puts three inches back.

Eight scenes, 121 s declared (≈103 s after speech-driven retiming):

| # | Chapter card | Setting | Mood / BGM | Key line |
| --- | --- | --- | --- | --- |
| S01 | `Kessa Chasm \| Twelve Weeks` | `modern_office` | reflective / `reflective_piano` | "The chasm at Kessa was eight hundred metres of nothing." |
| S02 | `The Shortcut \| Two Inches` | `tech_lab` | focused / `chill_focus` | "Two inches off every joint. Nobody would measure." |
| S03 | `Ahead of Schedule \| Too Fast` | `canyon_bridge` | focused / `chill_focus` | "Five weeks early, it met the far side." |
| S04 | `Inspection \| Check It Again` | `lecture_stage` | tense / `suspense_tension` | "Then check them a third time. With me." |
| S05 | `June \| The Deck Sings` | custom rain setting | tense / `suspense_tension` | "In June, the river came up four metres." |
| S06 | `The Rule \| Margin` | `library_study` | reflective / `reflective_piano` | "A structure isn't safe because it holds today. It's safe because it survives a bad day." |
| S07 | `Rebuild \| Margin Restored` | `tech_lab` | resolved / `triumph_horizon` | "They rebuilt every joint with three inches of margin." |
| S08 | `August \| The Crossing` | `sunrise_summit` | warm / `triumph_horizon` | "Leave room to be wrong, and it will hold." |

Full dialogue lives in `work/episode.json` (source of truth). Keep subtitle lines **≤ 46
characters** where possible; avoid one-word lines (the renderer merges a very short line with
its neighbour, producing a two-row card that can collide with legs).

---

## 3. Cast (distinct bodies, not recolours)

```json
"nia":   { "build": "lean",   "hair": "bun",       "hair_color": "#3f2a20",
           "shoe_color": "#b91c1c", "posture": 0.22,  "scale": 1.55,
           "accessories": ["watch", { "type": "shoulder_bag", "color": "#b91c1c" }] }

"okoro": { "build": "broad",  "hair": "side_part", "hair_color": "#cbd5e1",
           "shoe_color": "#0f172a", "posture": -0.14, "scale": 1.62,
           "accessories": ["glasses", { "type": "coat", "color": "#0f3d3e" },
                            { "type": "scarf", "color": "#fbbf24" }] }
```

Voices (resolved to local Piper in this sandbox — keep the *named* voices in the JSON and let
the alias map resolve them):

| Speaker | Requested | Rate | Piper fallback |
| --- | --- | --- | --- |
| narrator | `en-US-GuyNeural` | +1 % | `en_US-ryan-medium` |
| nia | `en-US-JennyNeural` | +3 % | `en_US-amy-medium` |
| okoro | `en-US-ChristopherNeural` | −3 % | `en_GB-alan-medium` |

Turn pauses `0.22 s – 0.32 s` (0.35–0.45 s at scene ends). BGM gains 0.86–0.92.

---

## 4. Blocking rules that actually matter on a 1920 frame

- **Subtitle safe band.** Cel subtitles are centred at `centerY = 930 − (lines−1)×20`
  (`engine/video_renderer.js`), parchment at `962 − (lines−1)×18`. A one-row card therefore
  occupies roughly y 894–968 — legs and shoes may pass behind it, faces never should.
- **Actor x spacing.** Pairs sit at 0.42 / 0.68 (or 0.24 / 0.62 on wide establishing shots).
  Putting both actors near 0.30 / 0.68 while a long line is up pushes text off the right edge.
- **Board band.** Boards live at `y: 104, h: 168`. Above that is the chapter strip
  (`y ≈ 40–80`); below that are the name tags at `y ≈ 290–340`. Boards at `y: 74` collide with
  the chapter card, boards with `h: 210` collide with name tags.
- **Board build.** `build_dur: 1.1` — anything longer leaves an empty translucent panel on
  screen and reads as a rendering bug.
- **Camera.** Every scene has ≥ 2 `camera_shots`; the second is cued on a **multi-word spoken
  phrase** (`cue_on`) with `move_dur` 2.2. Camera focus also shifts props: a prop placed at
  `x: 0.075` can be pushed off-frame by a `focus_x: 0.36` pan.
- **Poses.** `head_in_hands` and `sketch_desk` default to **seated** rigs; used on a standing
  actor they collapse into a floating squat. Pass `seated: false` or pick a standing action
  (`point_board`, `handoff_give`, `talk_explain`, `listen_nod`).
- **Choreography is mandatory.** No static talking heads: each scene mixes walk / turn /
  point / handoff / seated typing / looking to horizon, and props carry the story
  (calendar, notebook board, stat cards, bar chart, cut pin, flood, controller).

---

## 5. Cue anchoring (the rule that broke twice before it worked)

Every board and every camera cut is locked to **an exact multi-word phrase that is actually
spoken**, taken from the line that *motivates* the graphic — not from the last line of the
scene.

- ✅ board on `"holds today"` → the rule card is up for the whole explanation.
- ❌ board on the final phrase → the graphic appears for the last two seconds.

Verify by rendering the draft and sampling a frame **at each `cue_on` + 1.5 s**: the board
must be fully built, inside the safe band, and not touching a name tag or a face.

`accent_words` includes multi-word phrases (`"not safe"`, `"survives a bad day"`,
`"work nobody can see"`) so the subtitle highlight matches the delivery.

---

## 6. Scene construction recipe

For each scene in `work/episode.json`:

```jsonc
{
  "id": "S03",
  "chapter": "Ahead of Schedule | Too Fast",
  "environment": "canyon_bridge",           // or "setting": { ... } for a custom set
  "mood": "focused",
  "bgm": "chill_focus", "bgm_gain": 0.9,
  "accent_color": "#60a5fa",
  "duration": 14, "min_duration": 12, "lead_in": 0.7, "tail_out": 0.6,
  "props":       [ { "type": "streetlamp", "x": 0.88, "z": -12 } ],
  "camera_shots":[ { "start": 0, "zoom_from": 1.04, "zoom_to": 1.08, "focus_x": 0.46, "cut": true },
                   { "cue_on": "met the far side", "zoom_from": 1.1, "zoom_to": 1.16,
                     "focus_x": 0.52, "move_dur": 2.2, "cut": true } ],
  "characters":  [ { "id": "nia", "show_name": true,
                     "beats": [ { "start": 0, "end": 8, "action": "walk", "from_x": 0.3, "to_x": 0.42,
                                  "facing": 1, "expression": "confident" } ] } ],
  "boards":      [ { "type": "stat_cards", "x": 0.03, "y": 104, "w": 470, "h": 168,
                     "build_dur": 1.1, "cue_on": "five weeks early", "hold_sec": 5.8 } ],
  "accent_words":["five weeks early"],
  "dialogue":    [ { "speaker": "narrator", "text": "Five weeks early, it met the far side.",
                     "pause_after": 0.35 } ]
}
```

Custom sets (`"setting": {...}`) accept `sky[]`, `floor_color`, `light_color`, `backdrop`
(`mountains|city|forest|hills|ocean|windows|shelves|horizon|pure_black`), `weather`
(`rain|snow|stars|embers|clear`), `rain_intensity`, `lighting`
(`spotlights|skylights|streetlamps|sun_orb|moon_orb`). Never leave a scene on a flat black
background — the S05 storm road uses `mountains` + `rain` + `spotlights` and a wet floor.

---

## 7. Command sequence (copy-paste)

```bash
python3 run_studio.py check
python3 run_studio.py validate work/episode.json                     # warnings: []
python3 run_studio.py stills   work/episode.json --out-dir work/stills --width 1920 --height 1080

python3 run_studio.py render work/episode.json --out /tmp/draft/film_draft.mp4 \
  --draft --voice auto --workers 2 --chunk-sec 20                    # fast QA pass

python3 run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

Sample frames from a render without re-encoding:

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -v error -ss 62.5 -i output/final_film_1080p.mp4 -frames:v 1 -y /tmp/qa.png
```

Serve the master to a browser (Range-capable, seeking works):

```bash
python3 tools/serve_deliverables.py 8000 output
```

---

## 8. Result of this run (numbers to compare against)

- `validate`: 121 s declared, 8 scenes, 8 settings, 30 sound events, `warnings: []`
- master: 1920×1080, 30 fps, **3087 frames, 102.915 s**, 8.3 MB, H.264 High + AAC 44.1 kHz
- audio: peak **−2.87 dBFS**, RMS **−17.4 dBFS**, 28 foley events, 4 CC tracks
- `validation_report`: `valid: true`, `film_grain: false`, `warnings: []`
- full decode (`ffmpeg -f null -`) clean
- chapters: 8 (see `outputs/final_film_1080p_chapters.txt`)
