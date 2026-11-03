# 05 — AUDIO: voices, pacing, BGM, foley

Audio is generated per line, then mixed to `master_audio.wav` and muxed to the master. The
film's *true* duration comes from this pass — scene `duration` values are only a plan.

---

## 5.1 Voice backends

| Backend | How it is selected | Notes |
| --- | --- | --- |
| Edge/Azure neural | `--voice edge` or `auto` when reachable | best quality; **unreachable in this sandbox** (`speech.platform.bing.com:443` refused) |
| Piper (offline) | `--voice piper`, or `auto` as fallback | local `.onnx` voices in `~/.cache/piper_voices`; 3 installed |
| none | `--voice none` | silent render for timing tests |

**Use `--voice auto`.** With Edge unreachable it resolves each requested Edge voice id to a
local Piper model through an alias map, so the JSON keeps the names you want and the render
log reports what actually ran:

```
"voice_backend": "piper-offline:en_GB-alan-medium,en_US-amy-medium,en_US-ryan-medium"
```

Always read that field back. If it shows a single voice, two characters are sharing a speaker
and you will hear it immediately.

Installed offline voices and how the alias map resolves common Edge ids:

| Requested name | Resolves to |
| --- | --- |
| `en-US-GuyNeural`, `en-US-AndrewNeural`, `en-US-EricNeural` | `en_US-ryan-medium` |
| `en-US-ChristopherNeural` | `en_GB-alan-medium` |
| `en-US-JennyNeural`, `en-US-AriaNeural`, `en-US-AnaNeural` | `en_US-amy-medium` |

Check or install more: `python3 universal_toolbook/tools/fetch_piper_voices.py check` / `install`.
`run_studio.py check` prints `offline_voiceover_ready` next to the node/ffmpeg/edge probes, so
you know before you spend a render whether offline narration is possible.

### A silent master fails loudly

If a voice mode produces no speech at all, the render is **not** reported as a clean finish:

| What you see | Meaning |
| --- | --- |
| `"status": "COMPLETE"` + `"voiced": true` | narration exists — deliverable |
| `"status": "COMPLETE_SILENT"` + exit code **3** + `!` banner | the file has subtitles/music only; `"voice_diagnosis"` lists the missing pieces |
| `"status": "COMPLETE"` + `"voiced": false` + `--allow-silent` | you explicitly accepted a silent master |
| `"status": "COMPLETE"` + `"voiced": false` + `--voice none` | a deliberately silent timing draft |

The same `voiced` / `warnings` fields are copied into `<film>_validation_report.json`, so a
downstream check can refuse a silent file without re-reading the console. Never deliver a
master whose report says `"voiced": false`; fix the backend and re-render:

```bash
pip install piper-tts
python3 universal_toolbook/tools/fetch_piper_voices.py install          # huggingface.co
python3 universal_toolbook/tools/fetch_piper_voices.py install \
    --github 007-Akira/Project-Rocky --github-path voices               # github-only network
python3 universal_toolbook/tools/fetch_piper_voices.py check            # expect true
```

`install` understands three sources: the canonical Hugging Face repository (voices nested by
language / region / name / quality, derived automatically from the voice id), a flat mirror via
`--url-base`, and a public GitHub repository via `--github` (handy when huggingface.co is
blocked, since GitHub serves the same MIT/CC0 voice files). `--dry-run` shows the exact URLs.

## 5.2 Picking voices so they are distinguishable

- Two voices from the **same gender + same accent** blur together in a dialogue scene. Mix
  accents (US + GB) or pitch before adding a third.
- Rates: narrator `+1%`, energetic character `+3%`, authority `-3%` to `-4%`.
- Pitch nudges (±2 Hz) are enough to separate two otherwise similar voices.
- Every speaker id in `dialogue[].speaker` must exist in `voices`, or the line falls back to
  the narrator voice.

## 5.3 Pacing

For Edge, Piper, and OS-generated line audio, long internal TTS dead air is compacted without
rewriting the words. Runs over **0.32 s** are reduced to about **0.12 s** when unpunctuated;
commas retain at least **0.24 s**, sentence punctuation **0.42 s**, and an explicit ellipsis keeps
its full pause. Word timings move with the audio. This improves pacing, not the voice model's
acoustic quality. Configured pauses between dialogue lines remain separate and are not compacted.

- `pause_after`: **0.22–0.32 s** between lines of the same conversation; 0.35–0.45 s at a
  scene turn (that gap is where the cut, the board and the BGM change land).
- One sentence per `dialogue` entry. Two sentences in one entry produce a single long
  subtitle card.
- Speech length rule of thumb: `words ÷ 2.5 ≈ seconds`. A scene's dialogue should fill
  70–85 % of its declared duration.
- If the film finishes far shorter than planned, the scene `duration`s were padded; if it
  overruns, the dialogue is too dense for the declared length.

## 5.4 BGM

```bash
python3 universal_toolbook/run_studio.py bgm-list        # id, moods, keywords, licence, source
```

- `"bgm": "dynamic"` at episode level → each scene picks from its `bgm` id.
- `"bgm": "auto"` → engine chooses by `mood`.
- A scene may override with `"bgm": "<track id>"` and `"bgm_gain": 0.86–0.92`.
- All bundled tracks are Creative Commons; **credits are generated automatically** into the
  chapters file from the tracks actually used. Never hand-write them.

Mood → family:

| Mood | Tracks that fit |
| --- | --- |
| reflective, aftermath, dawn | `reflective_piano` |
| focus, build, systems | `chill_focus`, `electronic_drive` |
| tension, danger, flood | `suspense_tension` |
| resolve, triumph, reveal | `triumph_horizon`, `upbeat_ncs_synth` |

## 5.5 Foley

The engine emits synchronised cues (`visual_audio_cues.json`) for scene events — footsteps,
hand-offs, sit/stand, rain, board reveals. They come from the scene's actions and setting, not
from a separate audio file, so:

- choreograph more, and you get more foley;
- a scene with no motion has no foley and sounds dead;
- weather in `setting` (`rain`, `snow`) adds ambience automatically.

## 5.6 Measuring the mix

`ffmpeg -af volumedetect` prints nothing in this environment. Parse the WAV instead:

```python
import wave, audioop, math
w = wave.open("output/.work_final_film_16x9/master_audio.wav", "rb")
d = w.readframes(w.getnframes())
print("dur", round(w.getnframes() / w.getframerate(), 2))
print("peak dBFS", round(20*math.log10(audioop.max(d, w.getsampwidth()) / 32768.0), 2))
print("rms  dBFS", round(20*math.log10(max(audioop.rms(d, w.getsampwidth()), 1) / 32768.0), 2))
```

Healthy targets: peak **−3 … −1 dBFS** (no clipping), RMS **−16 … −19 dBFS**. A peak of 0 dBFS
means a clipped master; re-render rather than "fixing it in post".

## 5.7 Sync checks

- Subtitle appears on the first syllable, not before it.
- Board appears on the motivating phrase; camera cut lands within ~0.3 s of it.
- No line is truncated (last word missing) — compare the subtitle text against the JSON.
- No gap where speech is audible but no subtitle is shown.
