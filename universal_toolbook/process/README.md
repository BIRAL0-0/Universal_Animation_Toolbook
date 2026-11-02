# process/ — the universal production procedure

> **First landing page for any session: [`START_HERE.md`](../../START_HERE.md)** at the
> repository root — bootstrap commands and the reading order in one place.

Everything here is **film-agnostic**. It does not describe any particular story; it describes
how to turn *any* script into a finished 16:9 landscape or 9:16 portrait `.mp4` with this engine. If you are a fresh
session that was handed a script and has never seen this repository, read these in order:

| # | File | Read it when |
| --- | --- | --- |
| — | [`SESSION_PROMPT.md`](SESSION_PROMPT.md) | You need a copy-paste prompt for a new session. |
| 01 | [`01_INTAKE.md`](01_INTAKE.md) | You have a script and must turn it into scenes, timing and a cast. |
| 02 | [`02_AUTHORING_EPISODE_JSON.md`](02_AUTHORING_EPISODE_JSON.md) | You are writing `work/episode.json`. |
| 03 | [`03_RENDER_PIPELINE.md`](03_RENDER_PIPELINE.md) | You are ready to run commands. |
| 04 | [`04_VISUAL_GEOMETRY.md`](04_VISUAL_GEOMETRY.md) | Something overlaps, clips, or sits in the wrong place. |
| 05 | [`05_AUDIO.md`](05_AUDIO.md) | Voices, pacing, BGM, foley, or the audio sounds wrong. |
| 06 | [`06_QA_GATE.md`](06_QA_GATE.md) | Before you call anything finished. |
| 07 | [`07_TROUBLESHOOTING.md`](07_TROUBLESHOOTING.md) | A command failed or a render looks broken. |
| 08 | [`08_LIMITS.md`](08_LIMITS.md) | You are about to promise something the engine cannot do. |
| — | [`REPO_MAP.md`](REPO_MAP.md) | You need to know which folder stores what, or what is not in git. |

> **Where things are.** The engine is one self-contained folder: `universal_toolbook/`.
> Commands below are written for the **repository root**; `cd universal_toolbook` and drop the
> prefix if you prefer, or copy the folder somewhere else entirely — it resolves its own
> `universal_toolbook/engine/`, `universal_toolbook/assets/` and
> `universal_toolbook/config/` relative to `run_studio.py`.

Companion material already in the repo:

- `MASTER_PROMPT.md` — the director's brief (creative intent, what to ask for).
- `00_START_HERE.md` — CLI surface and capabilities.
- `01_TOOLBOOK_REFERENCE.md` — the full JSON schema and every action/environment name.
- `universal_toolbook/templates/episode_minimal.json` — a **runnable 2-scene episode**; start by copying it.
- `examples/*.json` — complete reference films (cel and parchment) to copy structure and pacing from.
- `tests/` — engine regression suite. **Development only**; you never need it to render a film.
- `tools/check_docs.py` — verifies every path quoted in these docs actually exists.

---

## The pipeline in seven lines

```bash
python3 universal_toolbook/run_studio.py check                                     # env, fonts, ffmpeg, BGM, voices
cp universal_toolbook/templates/episode_minimal.json work/episode.json             # then author it
python3 universal_toolbook/run_studio.py validate work/episode.json                # must print warnings: []
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_16x9 --width 1920 --height 1080
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out /tmp/draft/film.mp4 --draft --voice auto
# For portrait, also inspect a 1080x1920 still/draft; fix framing and repeat
python3 universal_toolbook/run_studio.py stills work/episode.json --out-dir work/stills_9x16 --width 1080 --height 1920
# inspect every still and every board cue, fix, repeat the target-aspect render
python3 universal_toolbook/run_studio.py render work/episode.json --aspect-ratio 16:9 --out output/final_film_16x9.mp4 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
# Choose --aspect-ratio 16:9 or 9:16 independently; add --short-form for the 40–90s gate.
# --shorts is specifically 9:16 YouTube Shorts plus that duration gate.
```

The loop that matters is **stills → look → fix → stills**, at the target aspect ratio. Rendering the
master is the last 10 % of the work; catch framing and safe-area issues before paying for the encode.

## Ground rules

1. Never declare a render finished without opening frames from it.
2. `validate` must show `warnings: []`.
3. Grain stays off; the output is zero-grain.
4. Never overwrite a previous master — new filename, and say so.
5. Back up engine files before editing (`cp f /tmp/f.bak.$(date +%s)`).
6. Scratch files live in `/tmp`; only deliverables, text artifacts and docs go in the repo.
7. Nothing is reported that a file did not produce.
