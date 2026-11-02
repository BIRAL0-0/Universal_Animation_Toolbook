# 01 — INTAKE: turning a script into a scene plan

Nothing in this file is about a specific film. It is the decision procedure that runs before
a single line of `episode.json` is written.

## Delivery target — decide before blocking

Choose the output aspect from the script's composition and delivery requirement, not from duration
alone. Use **16:9** for landscape platforms, wide two-character staging, or a cinematic master;
use **9:16** when the requested destination is a vertical feed or the shot design benefits from a
single-subject close frame. Short-form can be either aspect when that is what delivery requires.
If the user has not specified a format and the choice would change the composition, ask before
blocking. Render QA stills in every requested format.

Short-form runtime target is **40–90 seconds total**, independent of aspect ratio. Use `--short-form`
to validate that final speech-locked range without changing the selected orientation; set
`--aspect-ratio 16:9` for landscape or `9:16` for portrait (the default without a flag is 16:9).
`--shorts` is specifically the YouTube Shorts profile: it selects 9:16 and applies the same runtime
gate. Aspect ratio never changes authored episode geometry by stretching; portrait reframes around
the active speaker or an optional scene-level `portrait_focus` / `portrait_focus_x`.

## 1.1 Pick the visual style

| Style value | Look | Use for |
| --- | --- | --- |
| `"cel"` | Atmospheric cinema: dark graded skies, spotlights, clean vector characters with distinct builds, glowing lower-third subtitles | drama, mystery, essay, tech/business story, anything "night" |
| `"parchment"` | Warm kraft-paper backdrops, hand-inked stick figures, red/black ink accents | parables, fables, sketchbook storytelling, period/folk tone |

Set it once on the episode (`"style": "cel"`) and, if needed, override per scene
(`"style": "parchment"` on a scene). Do not mix within a scene.

Rule of thumb: if the script has weather, cities, machines or tension → **cel**. If it has
"once upon a time", a moral, or a narrator sitting beside the reader → **parchment**.

## 1.2 Break the script into scenes

One scene = one location + one continuous stretch of time. Practical targets:

| Metric | Practical guidance | Why |
| --- | --- | --- |
| Short-form runtime | **40–90 s total** | The overall delivery target, not a per-scene duration |
| Scene length/count | Script-driven; often 4–8 scenes for short-form | Give each scene one location and one meaningful change; keep the whole runtime in range |
| Dialogue per scene | Enough for its story beat; each line is ~3–5 s | Speech retimes scenes, so budget from words and pauses rather than a fixed line count |
| Characters per scene | 2 (max 3) | Three or more can collide in landscape and a portrait crop may show only the focus actor |

> **Use the script to set scene lengths.** Count speech and allow for pauses plus roughly 1.3 s of
> lead-in/tail-out per scene; a 40–90 s short-form film will often need compact scenes rather than
> the earlier 10–20 s default. The bundled long-form specs (`examples/discipline_vs_obsession_episode.json`
> — 9 scenes, 48–74 s each, 520 s declared; `examples/red_umbrella_episode.json` — 9 scenes up to
> 40 s) prove longer scenes work, at the cost of render time and harder camera/beat timing. For a
> one-act piece or video essay, budget 30–60 s per scene and keep camera movement active so the
> shot never reads as a slide. See `08_LIMITS.md` for measured render cost.

Write down for each scene: **id, chapter title, location, who is on screen, what changes**
(a fact is revealed / a decision is made / a thing breaks). A scene where nothing changes is
a candidate for deletion — this is also the single best defence against "talking heads".

## 1.3 Budget the duration before writing dialogue

Speech drives the real runtime. Rough numbers from this engine:

- narrator voice ≈ **2.6 words/second**; dialogue lines ≈ 2.4 w/s;
- inter-line pause 0.22–0.32 s (0.35–0.45 s at scene ends);
- scene adds `lead_in` (~0.7 s) + `tail_out` (~0.6 s).

So a 15-word narration line ≈ 6 s. If a scene's dialogue totals 40 words, declare the scene at
≈ 17–19 s, not 12. **The renderer retimes scenes to speech**, so an undersized `duration` just
gets stretched and your `camera_shots`/`beats` timings drift; an oversized one leaves silence.

Declared `duration` is a *planning* number. Expect the final master to land a little under the
sum of declared scene durations. For a 40–90 second short-form target, let speech retiming settle,
then use `--short-form` to check the final duration inclusively before video encoding. It reports
an error rather than truncating or rewriting dialogue when the runtime is out of range. Use
`--shorts` instead when delivering specifically to vertical YouTube Shorts.

## 1.4 Cast the speakers

- **Number of distinct voices = number of speakers**, minimum two (narrator + character).
  Reusing one voice for two characters is the most common quality failure.
- Each character also needs a **distinct body**: `build`, `hair`, `hair_color`, `shoe_color`,
  `posture` (−1.0 laconic … +1.0 alert), `accessories` (glasses / watch / tie / coat / scarf,
  plus bag/hat where supported) and `scale` 1.52–1.65 for cinema presence.
- Give every speaker a rate: `+0%` to `+4%` for narrator and brisk characters, `-3%` to `-5%`
  for authority/age. Keep turn pauses 0.22–0.32 s so dialogue overlaps like conversation.

Write the voice map into the episode's `voices` and the bodies into `cast` **before** writing
scenes — scenes reference these ids, and a typo is silent until render time.

## 1.5 Map mood → BGM

Pick a track per scene from `python3 universal_toolbook/run_studio.py bgm-list` (id, moods, keywords, licence).
Keep `bgm_gain` 0.86–0.92 so narration stays on top. Typical mapping:

| Scene feeling | Track family |
| --- | --- |
| reflective / aftermath / dawn | `reflective_piano` |
| focus / work / systems | `chill_focus`, `electronic_drive` |
| tension / danger / flood | `suspense_tension` |
| resolve / victory / reveal | `triumph_horizon`, `upbeat_ncs_synth` |

Credits are generated automatically from the tracks actually used — never hand-write them.

## 1.6 Decide what the audience *sees*, per scene

For every scene, fill these three columns before authoring:

| Where | What | Engine field |
| --- | --- | --- |
| Body language | 2–4 beats per character (enter, cross, sit, point, hand off, react) | `characters[].beats[]` |
| Proof | one visual object that carries the fact (board, chart, prop, weather) | `boards[]`, `props[]`, `setting` |
| Camera | an opening frame + one push/cut cued on a spoken phrase | `camera_shots[]` |

If a scene has no "proof" object and no camera move, it will read as two people talking in a
void — go back and give it one.

## 1.7 Sanity check before authoring

- [ ] Script words preserved 100 % (if it was supplied verbatim) — no paraphrase, no reordering
- [ ] Every scene has: location, ≥ 2 beats of choreography, ≥ 2 camera shots, a spoken cue
- [ ] Every spoken line has a speaker that exists in `voices`
- [ ] Total declared duration ≈ words ÷ 2.5 + 1.3 s per scene
- [ ] No scene is set on a pure-black empty stage
