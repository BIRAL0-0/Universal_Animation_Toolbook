# SESSION PROMPT — the contract for a new session

This is the one authoritative brief. `universal_toolbook/MASTER_PROMPT.md` is the *creative*
intent (tone, style, what to ask for); this file is the *operative contract* (what to read,
what is fixed, what you may change, how to prove it worked).

Two ways to use it:

- **Agent with repository access** → paste §1 below, then your script.
- **Agent with no file access** → paste `universal_toolbook/MASTER_PROMPT.md`,
  [`02_AUTHORING_EPISODE_JSON.md`](02_AUTHORING_EPISODE_JSON.md) and
  [`03_RENDER_PIPELINE.md`](03_RENDER_PIPELINE.md) inline; those three are sufficient.

---

## §1 Copy-paste brief

```text
You are directing one animated film inside the repository "Universal_Animation_Toolbook".
Goal: ONE finished, zero-grain MP4 in the user's requested format — 16:9 landscape (1920x1080)
or 9:16 portrait (1080x1920), 30 fps — with multi-voice narration, Creative Commons BGM and
synchronised foley, built with the engine in universal_toolbook/. Reuse the same episode JSON for
both sizes when requested; aspect changes must reframe, never stretch.

STEP 0 — ORIENT (do not skip, do not guess paths)
  Read START_HERE.md at the repository root first. It contains the bootstrap commands and the
  reading order. Then read, in order:
    universal_toolbook/process/README.md
    universal_toolbook/process/01_INTAKE.md
    universal_toolbook/process/02_AUTHORING_EPISODE_JSON.md
    universal_toolbook/process/03_RENDER_PIPELINE.md
    universal_toolbook/process/04_VISUAL_GEOMETRY.md
    universal_toolbook/process/05_AUDIO.md
    universal_toolbook/process/06_QA_GATE.md
    universal_toolbook/process/08_LIMITS.md
  Reference: universal_toolbook/01_TOOLBOOK_REFERENCE.md (full schema),
  universal_toolbook/templates/episode_minimal.json (runnable skeleton),
  examples/ (five complete film specs to copy structure from).

STEP 1 — BOOTSTRAP
  python3 universal_toolbook/run_studio.py check
  If it is not "status": "OK", stop and follow universal_toolbook/process/07_TROUBLESHOOTING.md.
  If offline_voiceover_ready is false: pip install piper-tts &&
  python3 universal_toolbook/tools/fetch_piper_voices.py install --from-dir <dir>.
  mkdir -p work   (work/ is not in git; every command in the pipeline writes into it)

THREE TIERS OF RULE — know which one you are touching

  INVARIANTS — never changed, for any reason:
    - validate must print "warnings": [] before rendering
    - render and LOOK at full-resolution stills in every requested aspect ratio before any full render
    - film grain stays OFF
    - "status": "COMPLETE" alone is not proof of a film: the report must also say
      "voiced": true. COMPLETE_SILENT / exit code 3 means no narration was synthesized — fix the
      voice backend and re-render, never deliver it
    - never overwrite an existing master; new filename, and state it
    - never report a number that did not come from a file the run produced
    - if a verbatim script is supplied, preserve 100% of its words: run
      validate work/episode.json --script <script.txt> and report the fidelity result

  DEFAULTS — correct for almost every request; change only with a stated reason:
    - 1920x1080 / 30 fps, 16:9 when the user has not specified another aspect; otherwise honor the request (9:16 = 1080x1920)
    - Choose `--aspect-ratio 16:9` or `9:16` from the request and script; a short-form video may use either aspect
    - Short-form target runtime: 40–90 seconds total. `--shorts` is only for vertical Shorts delivery (9:16 + final-runtime check); landscape short-form uses `--aspect-ratio 16:9`
    - render flags: --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume
    - --voice auto (Edge/Azure is unreachable here; this resolves to local Piper voices)
    - default output paths output/final_film_16x9.mp4 and output/final_film_16x9_chapters.txt (use matching `_9x16` names for portrait)
    - derive scene count and pacing from the supplied script and requested total runtime; see 01_INTAKE.md
    - copy universal_toolbook/templates/episode_minimal.json as the starting skeleton

  ASK-FIRST — stop and ask the user rather than deciding alone:
    - when the user has not specified an aspect and landscape versus portrait would materially change the deliverable; if specified, select it directly
    - a non-English script (only English voice models are installed)
    - more than 3 distinct speaking characters (3 voices are installed)
    - a runtime over ~5 minutes, or a change that multiplies render time by 2x or more
    - publishing, pushing, or overwriting a previous deliverable

WORKFLOW
  check -> author work/episode.json -> validate -> stills -> inspect -> draft render ->
  inspect a frame at every board cue_on and every camera cut -> final render ->
  verify the master -> copy text artifacts to outputs/<film>/ -> report paths + measured numbers

DELIVERY
  output/final_film_16x9.mp4 / output/final_film_9x16.mp4 and their matching chapters files
  Plus the master and text mirrors in outputs/<film>/ (mp4 when it stays under ~50 MB,
  plus chapters, report, validation, cue sheet, storyboard, NOTES.md)
  because large binaries do not always survive a transfer. If a viewer refuses video:
    python3 universal_toolbook/tools/build_storyboard_svg.py <master.mp4> --out outputs/<film>/storyboard.svg
  Do not commit renders; *.mp4 and work/ are git-ignored on purpose.

SCRIPT
---
<paste your script here>
---
```

---

## §2 Why each clause exists

| Clause | Failure it prevents |
| --- | --- |
| "Read START_HERE.md first" | Sessions invent paths; the oldest docs quoted `process/…` from the root, where no such folder exists, so the reading step silently failed and the session improvised. |
| `mkdir -p work` | `work/` is git-ignored, so a fresh clone has no such directory and the very first `cp` command fails. |
| `--voice auto` | Edge/Azure TTS is unreachable here; without fallback the render stalls on line one. |
| `--script` in the invariants | A session told "turn this script into a film" will otherwise paraphrase it. Fidelity is checkable, so it is checked. |
| The three tiers | A flat list of seven hard rules leaves no room for "make it a 30-second parchment fable with no narration", so the session either breaks a rule silently or refuses a normal request. Tiering says exactly what may flex. |
| Draft pass before the master | Board and camera cues are only visible mid-scene; stills sample the scene opening and will not show them. |
| "Report only measured numbers" | Renders fail and reviews still get written; every claimed number must trace to a report file. |

## §3 What this prompt deliberately does *not* do

- It does not specify the story. That is the script's job.
- It does not pick voices or music. `voices` and `bgm` per scene decide that, guided by
  [`05_AUDIO.md`](05_AUDIO.md).
- It does not hand you a fixed scene count. [`01_INTAKE.md`](01_INTAKE.md) explains how to
  derive it from the script, and [`08_LIMITS.md`](08_LIMITS.md) gives the proven range.
- It does not forbid improvisation — it requires that any deviation be **stated and justified**,
  not silent.
