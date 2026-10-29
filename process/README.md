# process/ — the universal production procedure

Everything here is **film-agnostic**. It does not describe any particular story; it describes
how to turn *any* script into a finished 1080p `.mp4` with this engine. If you are a fresh
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
| — | [`REPO_MAP.md`](REPO_MAP.md) | You need to know which folder stores what, or what is not in git. |

Companion material already in the repo:

- `MASTER_PROMPT.md` — the director's brief (creative intent, what to ask for).
- `00_START_HERE.md` — CLI surface and capabilities.
- `01_TOOLBOOK_REFERENCE.md` — the full JSON schema and every action/environment name.
- `templates/episode_minimal.json` — a **runnable 2-scene episode**; start by copying it.
- `examples/*.json` — complete worked episodes (cel and parchment) to crib structure from.

---

## The pipeline in seven lines

```bash
python3 run_studio.py check                                     # env, fonts, ffmpeg, BGM, voices
cp templates/episode_minimal.json work/episode.json             # then author it
python3 run_studio.py validate work/episode.json                # must print warnings: []
python3 run_studio.py stills work/episode.json --out-dir work/stills --width 1920 --height 1080
python3 run_studio.py render work/episode.json --out /tmp/draft/film.mp4 --draft --voice auto
# inspect every still and every board cue, fix, repeat the two lines above
python3 run_studio.py render work/episode.json --out output/final_film_1080p.mp4 \
  --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

The loop that matters is **stills → look → fix → stills**. Rendering the master is the last
10 % of the work; 90 % is catching overlaps at 1920×1080 before paying for the encode.

## Ground rules

1. Never declare a render finished without opening frames from it.
2. `validate` must show `warnings: []`.
3. Grain stays off; the output is zero-grain.
4. Never overwrite a previous master — new filename, and say so.
5. Back up engine files before editing (`cp f /tmp/f.bak.$(date +%s)`).
6. Scratch files live in `/tmp`; only deliverables, text artifacts and docs go in the repo.
7. Nothing is reported that a file did not produce.
