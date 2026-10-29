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

Check or install more: `python3 tools/fetch_piper_voices.py check` / `install`.

## 5.2 Picking voices so they are distinguishable

- Two voices from the **same gender + same accent** blur together in a dialogue scene. Mix
  accents (US + GB) or pitch before adding a third.
- Rates: narrator `+1%`, energetic character `+3%`, authority `-3%` to `-4%`.
- Pitch nudges (±2 Hz) are enough to separate two otherwise similar voices.
- Every speaker id in `dialogue[].speaker` must exist in `voices`, or the line falls back to
  the narrator voice.

## 5.3 Pacing

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
python3 run_studio.py bgm-list        # id, moods, keywords, licence, source
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
w = wave.open("output/.work_final_film_1080p/master_audio.wav", "rb")
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
