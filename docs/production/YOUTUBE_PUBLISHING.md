# YOUTUBE PUBLISHING — Stage 13

**Status: PACKAGE COMPLETE, UPLOAD MANUAL.** Every completed video ships as a full publishing
package under `videos/<slug>/` and is validated by `tools/validate_publishing.py`. Platform
publishing is still **not automated** — there is no YouTube Data API integration and nothing in
this repository will upload without the user doing it explicitly. This is a standing rule from the
agent contract ([`AGENTS.md`](../../AGENTS.md), ASK-FIRST tier: "publishing, pushing, or
overwriting a previous deliverable").

---

## 13.0 The publishing package (NORMATIVE)

Every completed video is one directory, and nothing else:

```
videos/<slug>/
├── <slug>.mp4        # master; filename == directory slug (never final.mp4)
├── script.md         # final approved script, retained permanently
├── thumbnail.jpg     # designed thumbnail: 1280x720 (16:9) or 1080x1920 (9:16), <2 MB
└── record.json       # title, full description, pinned comment, technical metadata
```

plus one compact entry in `videos/index.json`. The authoritative retention rule is
[`universal_toolbook/process/09_LEAN_REPOSITORY_POLICY.md`](../../universal_toolbook/process/09_LEAN_REPOSITORY_POLICY.md).

**Gate:** `python3 tools/validate_publishing.py` must print `PASS` before a video may be called
complete. It verifies the MP4 plays and matches the recorded duration and dimensions, that
`script.md` matches the record, that the thumbnail exists at the right size and under 2 MB, that
`record.json` carries every required field, that the index entry and content fingerprint are
current, and that no temporary file is sitting in the package.

**`record.json`** (required keys): `id`, `slug`, `title`, `filename`, `script`, `thumbnail`,
`youtube_description`, `pinned_comment`, `format` (`portrait`|`landscape`), `aspect_ratio`
(`9:16`|`16:9`), `resolution` (`1080x1920`|`1920x1080`), `duration_seconds`, `created_at`, `topic`,
`summary`, `key_angle`, `tags`, `production_version`, `content_fingerprint`.

**Format policy.** `<60.0s` → 9:16 `1080x1920` Shorts. `>=60.0s` → 16:9 `1920x1080` long-form.
Approved exceptions are recorded in `record.json` and reported as `note` lines by the validator.

**Thumbnail style rule (NORMATIVE).** A thumbnail must look like it was cut out of the film it
advertises. Base art may be generated separately — that is usually better than a raw frame, which
is often too empty to carry a cover — but it must be generated **against the film's own frames as
style references**, and the result must be measured, not just felt:

```bash
python3 tools/thumbnail_style.py check videos/<slug>/<slug>.mp4 videos/<slug>/thumbnail.jpg
```

The checker samples eight stills spread through the master and scores the cover against them on
three axes. Below `0.62` the cover does not share the film's visual world and must be regenerated.

| Axis | Tests | Note |
| --- | --- | --- |
| line | edge density vs the film's — is this the same drawing language | ink line art against a painted or photographic cover fails |
| polarity | share of the frame that is drawn material rather than empty ground | **invariant under inversion**: white line art on black scores the same as black line art on cream |
| palette | hue-histogram overlap, counted only over pixels that carry real chroma | skipped for an achromatic film, where "matching the colour" only means "be beige" |

Two corrections are recorded here because the first version of this checker was actively harmful:

- **It scored mean brightness.** A cream-paper film against a flat beige cover scored `0.98`; the
  same film against a black cover carrying the same character in white line art scored `0.33` and
  was rejected. The gate was rewarding the cover nobody clicks. Contrast is the entire point of a
  thumbnail, so what is compared now is the dark/light *balance*, which inversion leaves untouched.
- **It counted the paper as a colour.** A cream page is 100% of the "hue signature", so the checker
  insisted every wall cover be beige. Hue is now read only from pixels above a chroma floor, and an
  achromatic film is not scored on hue at all.

**A high score is necessary and not sufficient.** This is the single most important sentence in this
section. The checker cannot see focal point, scale, expression, gesture or typographic punch. A
faithful reproduction of an empty wide shot scores highly and is still a bad thumbnail. The wall
film's first cover passed at `0.98` and had none of the instinct a thumbnail needs; the cover that
replaced it is the film's character at a third of the frame width, mid-push, on black, with the
title at 15% of frame width in the film's own red. Both pass the gate. Only one of them is worth
uploading.

Write the cover for the grid: it must read at **210 px wide**. Check it at that size before shipping.

Three consequences worth stating plainly, because they were all learned the hard way:

- **A generic illustration can never match.** A dark navy film with label pills and cyan accents
  must not get an orange sunset poster, however good the poster is.
- **Line quality is part of the style.** A flat ink-line film drawn with a uniform 4px pen looks
  nothing like a hatched pencil illustration, even at the same cream background colour. Match the
  drawing technique, not just the palette — the checker cannot see stroke weight, so this part is
  still your eyes.
- **The character must be the same character.** Not a figure in the same palette, not a shaded or
  three-dimensional cousin: the same head shape, the same eyes, the same silhouette. Viewers
  recognise the protagonist before they read a word, and a cover whose character is a redesign
  reads as a different film. Where the film is dark, the cover may render him as white line art on
  black — that is the same character under inversion, not a new one.
- **Borrow the film's own type device.** If the film captions itself on a white rounded card, the
  cover should use a card too (`make_thumbnail.py --plate`). If it uses clean unoutlined type,
  pass `--no-stroke`. A thumbnail that invents a new typographic voice reads as a different channel.

**Search rule (NORMATIVE).** Every `record.json` must declare `primary_keyword` — the one phrase a
real viewer would type. Metadata is scored 0–100 and may not fall below the floor:

```bash
python3 tools/seo_audit.py            # scorecard for every package
python3 tools/seo_audit.py --verbose  # with the specific points lost
```

| Block | Max | What it tests |
| --- | --- | --- |
| title | 30 | 40–70 chars, keyword in the first 40, a question or number, no all-caps shouting |
| description | 30 | keyword inside the first 125 visible characters, 900–3200 chars, 2–4 natural mentions, 3–5 hashtags, an explicit call to action |
| tags | 20 | 8–15 tags under 480 chars, at least 2 long-tail phrases, the keyword present |
| pinned comment | 10 | ≥180 chars, asks a real question, points at a specific detail in the film |
| slug | 10 | ≥3 hyphenated words carrying the keyword |

`validate_publishing.py` fails a package below `78`, so SEO is a gate rather than an aspiration.
The score is a floor too: `--min 85` is the target, and the current set averages 90.9.

---

## 13.0.1 The title and the thumbnail are one unit (NORMATIVE)

A thumbnail is not a decoration on a title, and a title is not a caption for a
thumbnail. Together they form the only thing a viewer sees before deciding
whether to click, and on most surfaces they appear side by side. So they must
divide the work: **the thumbnail provokes, the title explains.**

The thumbnail opens a curiosity gap that the title, and the video, closes. If the
cover already states the title, one of the two most valuable surfaces on the
platform is dead weight.

### The evidence

A study of **16,152 million-view videos** classified 217 thumbnails that carried
text (`overseeros.com`, 2026):

| Relationship to title | Share |
| --- | --- |
| Reproduces the title exactly | 4.1% |
| Mostly repeats the title | 25.3% |
| Mixed | 28.6% |
| **Completely complementary** | **46.1%** |

**74.7% of text-bearing covers did not mostly repeat their title**, and 76.0%
contained a meaningful term that was not in the title. Word count matters just as
much (`thumbnailcreator.com`): 1-2 words measured **+10-20% CTR**, 3-4 words
**+5-15%**, 5-7 words **-5-10%**, 8+ words **-20-30%**. Design at **168 px** — the
width a phone shows in search — and check that the emotion survives at that size.

### The rule

Every `record.json` declares `thumbnail_text`: **one to three content words**, at
least one of which does not appear in the `title`. `tools/thumbnail_copy.py`
enforces it, and CI fails without it.

```bash
python3 tools/thumbnail_copy.py            # audit every package
python3 tools/thumbnail_copy.py --verbose  # explain each verdict
```

Copy that breaks the rule, for the record — this is exactly what the seven covers
said before the rule existed:

| Title | Rejected cover text | Why |
| --- | --- | --- |
| Discipline vs Obsession: The 9 PM vs 2 AM Problem | DISCIPLINE / OBSESSION | restates the title |
| 3 AM Anxiety: Why Checking the Clock Makes It Worse | NEVER CHECK / AT 3 AM | restates the title |
| Procrastination: Why 1 Plank Beats a Whole Bridge | THE FIRST / PLANK | restates the title |
| Cutting Corners: What a 2-Inch Shortcut Really Costs | 2 INCHES / IS NOTHING | restates the title |
| Phone Distraction: The 2-Second Reach That Ends Focus | JUST / 2 SECONDS | restates the title |
| Limiting Beliefs: Did You Agree to That Wall? | THE WALL YOU / AGREED WITH | restates the title |
| Notifications Cost You 23 Minutes (Every Single Time) | EVERY BUZZ COSTS / 23 MINUTES | restates the title |

Their replacements, all in one to three words and all honest to the script:

| Title | Approved cover text |
| --- | --- |
| The Two-Inch Bridge: What a 2-Inch Shortcut Really Costs | NOBODY NOTICED |
| Limiting Beliefs: Did You Agree to That Wall? | IT WAS NEVER REAL |
| Discipline vs Obsession: The 9 PM vs 2 AM Problem | FIVE HOURS DIFFERENCE |
| 3 AM Anxiety: Why Checking the Clock Makes It Worse | DON'T LOOK |
| Phone Distraction: The 2-Second Reach That Ends Focus | TWO STEPS |
| Notifications Cost You 23 Minutes (Every Single Time) | ELEVEN BEFORE NOON |
| Procrastination: Why 1 Plank Beats a Whole Bridge | NEAR EDGE |

The cover text must also be **true to the script**. An early replacement used
"FIVE HOURS ONE PLANK", a figure that appears nowhere in the film; it was
rejected and replaced with the script's own phrase. A cover that lies is worse
than one that repeats: it costs retention, and the algorithm reads retention.

### Composing the cover

`tools/compose_thumbnail.py` builds the finished image. It reserves a band for
the type so the artwork is never covered, fits each line to a target width so
short and long words share one optical size, and can bleed the band colour out of
the art's own bottom edge.

```bash
python3 tools/compose_thumbnail.py art.jpg out.jpg --size 1080x1920 \
    --line "#FFFFFF|DON'T" --line "#FF4B3E|LOOK"
```

Portrait (`1080x1920`) keeps its artwork in the upper 78%, `art_fraction 0.78`.
Landscape (`1280x720`) uses `art_fraction 0.72` with `--band-fill --band-darken`.
`record.json` carries that `art_fraction`, and `thumbnail_style.py --package`
uses it to crop the type band away before measuring style — without it the
checker measures the lettering instead of the art.

---

## 13.0.2 The creative record (IMPLEMENTED)

§13.0 and §13.0.1 say *what* a package and its title/thumbnail pair must be. They did not, until
now, have anywhere to record *how the choice was made* — so a video could pass every publishing
rule having never compared two hooks, two titles or two thumbnail concepts.

That record now lives in `record.json` → `creative`, and is enforced by
[`tools/creative_gate.py`](../../tools/creative_gate.py):

| Field | Enforces |
| --- | --- |
| `hook_candidates[]` | ≥ 3 distinct hooks, one selected with a stated reason, landing ≤ 8 s, with words that are actually spoken |
| `retention_map[]` | ≥ 3 beats including `hook` and `payoff`, each with a purpose |
| `title_candidates[]` | ≥ 3 approaches; the selected one equals `record.json` `title` exactly |
| `thumbnail_concepts[]` | ≥ 3 concepts with **different focal subjects** |
| `alignment` | title promise / thumbnail promise / hook promise, verdict `aligned` |
| `claims[]` | every claim labelled `M`/`O`/`P`, and a prediction never used as a fact |
| `script_critique` | all ten criteria scored 1–5, weakest named, revision recorded |

Schema, evidence standard and the honest boundary of what this can and cannot judge:
[`CREATIVE_PACKAGING.md`](CREATIVE_PACKAGING.md). Procedure:
[`skills/youtube-packaging/SKILL.md`](../../skills/youtube-packaging/SKILL.md).

## 13.1 What the pipeline already produces (IMPLEMENTED)

| Artifact | Source | YouTube use |
| --- | --- | --- |
| `*_chapters.txt` | generated by `formatYouTubeChapters` at render, in `MM:SS Title` YouTube-chapter format | Paste into the description (chapters work when the description timestamp list matches the audio) |
| CC music credits | auto-appended to the chapters file from the tracks actually used (never hand-written) | Paste into the description / credits field — required by the CC licenses in `universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md` |
| The master MP4 | `runtime/renders/<stem>.mp4` (H.264 + AAC, 30 fps — an accepted upload codec) | The upload itself |
| Poster, 1920×1080 | `node tools/make_poster.js <hero.png> <out-dir> <stills…>` — drawn from a **real frame grabbed out of the master**, so it cannot drift from the film | Usable as the thumbnail (YouTube scales it; crop to 1280×720 if you want the standard size). There is **no dedicated thumbnail pipeline** — see gaps below |
| `report.json` / `validation_report.json` | the render | Source of truth for the description's honest facts (duration, resolution) |
| `storyboard.svg` | `universal_toolbook/tools/build_storyboard_svg.py` | A text-only preview of the film for people who can't play video |

**Delivery channels** (how the human actually gets the file — in order of reliability, from
[`deliverables/RESULTS.md`](../../deliverables/RESULTS.md)): the committed mirror in
`deliverables/<film>/` (master kept only under ~50 MB, plus the full text set);
`python3 tools/serve_downloads.py 8000 deliverables/the_wall_you_agreed_with` (Range-capable download page —
`deliverables/the_wall_you_agreed_with/index.html`); `python3 universal_toolbook/run_studio.py player <master> --out
runtime/renders/player.html`; and the SVG storyboard as the last resort.

## 13.2 What the agent prepares (PROCESS-STANDARD)

After the Stage 12 sign-off, the publishing package above is written **and** a
`deliverables/<film>/publishing.md` hand-off note is produced with:

```markdown
# <Film> — publishing kit
- master: <path>  (bytes, sha256 — from NOTES.md, not from memory)
- duration / resolution / fps: <from report.json, verbatim>
- title: <primary>   (+ 1–2 alternates)
- description: <draft — see rules below>
- chapters: <paste-ready block from *_chapters.txt, credits included>
- tags: <5–10, all true to the content>
- thumbnail: <poster path + note on crop>
- playlist: <suggested>   audience: <suggested — never "made for kids" by default>
- schedule: <suggested slot if the user has a pattern>
```

**Title.** Specific and honest; no clickbait that the video does not pay off; the claim in
the title must be visible in the film. One primary + alternates is the deliverable — the
user picks.

**Description.** Built from what the film actually is: the `thesis` sentence from the
episode JSON, the chapter block, and the generated CC credits. No keyword stuffing, no
misleading framing, no engagement bait ("like and subscribe" padding is fine as a courtesy
line at the end, never as the content).

**Tags.** Few, true, specific — the story's actual subjects and format. A tag is a claim
about the content; every tag must be verifiable in the film.

**Metadata must match the file.** Duration, aspect, and language (the voice) all come from
the report, not from the idea brief. If the brief promised 16:9 and the master is 9:16, that
is a Stage 12 finding, not a Stage 13 fix.

## 13.3 The publish gate (HARD)

1. The agent presents the publishing kit and says, explicitly: *publishing requires your
   authorization; nothing will be uploaded without it.*
2. The user uploads (or explicitly directs an authorized agent action if one is ever
   configured — see [`../development/ROADMAP.md`](../development/ROADMAP.md) for what that
   implementation would look like, including its approval design).
3. The agent records the outcome in `runtime/work/<slug>/decisions.md`: what was published where,
   when, and the final title/description as used.

## 13.4 Gaps (what "publishing preparation" does not include today)

| Missing | What building it would require | Roadmap item |
| --- | --- | --- |
| YouTube upload automation | YouTube Data API OAuth client, upload + metadata call behind an explicit per-video approval token, credentials stored outside the repo | F3 in [`../development/ROADMAP.md`](../development/ROADMAP.md) |
| SRT/VTT caption file | Small exporter from the compiled word timings (the data already exists in `episode_retimed.json` / `vo_manifest.json`) | F4 |
| Thumbnail *concept* automation | **Partly closed.** [`tools/make_thumbnail.py`](../../tools/make_thumbnail.py) composes base art plus capped text, `tools/thumbnail_style.py` verifies the palette match, and `tools/creative_gate.py` requires ≥ 3 distinct concepts. What remains manual is the concept itself and the 168 px human look — a script cannot judge whether a cover earns a click | F5 |
| Analytics feedback loop | Read back performance, append to the film's output folder, feed Stage 1/2 research | F1 |

None of these is required for a working pipeline today — the manual upload is the
designed, supported path.
