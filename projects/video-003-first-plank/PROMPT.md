# Production prompt — The First Plank

This is a fully customised production brief, not a template with slots. It was written before the
final `episode.json`, stills, audio or renders.

## 1. Commission

Create one original English-language animated Short, primary 9:16 `1080×1920`, secondary 16:9
`1920×1080`, 30 fps, H.264 High + AAC 44.1 kHz stereo. Target **approximately 150 s** within the
180 s Shorts limit; the authored scene plan is 140 s and the measured voiced master is retimed
from real Kokoro speech. No channel name, watermark, channel branding or `channel_name` key.

## 2. Story

**Title:** The First Plank. **Thesis:** starting is a design problem — make the nearest step small
enough to trust. **Metaphor:** the nearest plank, carried to exhaustion and never explained.
Traveller Mira plus one off-screen narrator; exactly one on-screen character. The same conditions
appear with one variable changed: a perfect drawing of the far bridge versus one reachable piece
of wood at the near edge. Close on the exact direct-address question: “Before you ask for a bigger
bridge, what is the nearest plank you can step on?”

## 3. Non-negotiables

1. Seven scenes of roughly fifteen to twenty-five seconds; the hook — a bridge with only the
   first plank missing — lands inside the first ten seconds.
2. One metaphor, never explained: the desk page, checklist, scrap of wood and far lantern all
   serve that single physical idea.
3. Calm, conversational late-night storyteller. No lecturing, no list of productivity tips.
4. Mute-legibility: with audio off, the sequence still reads as missing first plank →
   over-planning → failed jump → naming/shrinking → placing one plank → crossing → looking back.
5. Music is load-bearing, shifts mood per act, and is ducked under narration.
6. Chapter labels double as on-screen cards and generated YouTube chapters.
7. Originality: no character, script, scene, chapter list or metaphor is reproduced from a
   reference. Existing repository films and public sources inform craft only.
8. No measured number, efficacy claim or virality prediction is narrated.
9. All 42 polished lines are copied verbatim from `SCRIPT_POLISHED.md` into `episode.json`.

## 4. Character

`episode.json` → `cast` is the single source of truth. `CHARACTERS.md` mirrors it. Exactly one
on-screen character and one off-screen narrator; no scene has more than two.

| id | Name | Role | build | hair | colour | posture | scale | accessories | expression arc |
|---|---|---|---|---|---|---:|---|---|---|
| mira | MIRA | traveller and draftswoman | lean | ponytail | `#f8fafc` | +0.15 | 1.55 | `watch`, `work_bag` | determined → tired → honest → resolved → quiet triumph |

## 5. Visual and audio grammar

- 9:16 primary safe crop; 16:9 secondary. Keep signposts, books, orbs and name tags inside the
  portrait-safe centre.
- Multi-line boards: `h>=250`, `y~74`, 42-pixel line spacing, `portrait_w:460`,
  `portrait_x:0.5`. Inspect final-master board-cue frames after any geometry edit.
- Boards are speech-locked by multi-word `cue_on` / `hide_on` phrases resolved from measured
  Kokoro word timings. S07's board reveals on “The bridge was not shorter” and hides on “Then she
  looked at you” so it is fully legible before the closing question.
- Seven original chapter titles; S01 carries one chapter card, S07 has no stray second card.
- Four Creative Commons BGM IDs per `ASSET_MANIFEST.json`; procedural SFX; Kokoro-82M
  `am_michael` narrator at `+1%` / `-1Hz`; Mira is silent.
- No `film_grain`; no outro card; no branding.

## 6. Scene map

| Scene | Chapter | Environment | BGM | Board | Turn |
|---|---|---|---|---|---|
| S01 | The Missing Plank | `canyon_bridge` | `reflective_piano` | THE BRIDGE | hook |
| S02 | The Perfect Far End | `library_study` | `chill_focus` | THE PLAN, IN INK | over-planning |
| S03 | Three Louder Answers | `storm_road` | `suspense_tension` | checklist | failed jump |
| S04 | Naming the Near Edge | `canyon_bridge` | `reflective_piano` | THE FEELING, IN INK | rewrite |
| S05 | A Plain First Plank | `library_study` | `chill_focus` | NEAREST PLANK | one plank |
| S06 | Crossing the Canyon | `sunrise_summit` | `triumph_horizon` | THE CROSSING | crossing |
| S07 | The Other Side | `sunrise_summit` | `reflective_piano` | THE CROSSING | look back + question |

## 7. Delivery

Primary master `projects/video-003-first-plank/final.mp4`; secondary
`renders/final_16x9.mp4`; durable text mirrors, poster, animated SVG storyboard, `NOTES.md` with
SHA-256 and exact rebuild command, and a release ZIP under `deliverables/releases/`. Publishing
is not authorised.
