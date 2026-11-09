# QUALITY CONTROL — Stage 12

**Status: PARTIAL** — automated gates exist and are enforced; the human review on top of
them is mandatory, not optional. Definition of finished (checklist form):
[`universal_toolbook/process/06_QA_GATE.md`](../../universal_toolbook/process/06_QA_GATE.md).

Two questions per check: *can a machine prove it?* (→ automated gate) and *does a human
have to see/hear it?* (→ review item). A film is "complete" only when every automated gate
passes **and** the human review is signed off — recorded in `work/<slug>/decisions.md`.

---

## 12.1 Automated gates (run these, in this order)

### Before rendering (spec level)

```bash
python3 universal_toolbook/run_studio.py validate work/<slug>/episode.json
# + --script work/<slug>/script_polished.md  (verbatim projects)
```

- `warnings: []` is the gate. `duration_sec`, `scene_count`, `sound_events` must match the
  plan; `script_fidelity.exact_word_match: true` for verbatim projects.

### At render time (engine-enforced)

- **Duration gate** — out-of-range final runtime refuses to encode (exit 2).
- **Silent-master gate** — no synthesized speech ⇒ exit 3, `COMPLETE_SILENT`,
  `voice_diagnosis`. Never deliverable.
- **`validation_report.json`** — `valid: true`, `film_grain: false`, `voiced: true`,
  `warnings: []`, `frames ≈ duration × 30`, requested `dimensions`.

### After the master (measured, not claimed)

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -hide_banner -i output/<stem>.mp4 2>&1 | grep -E "Duration|Stream"   # 30 fps, h264+aac, requested dimensions
"$FF" -v error -i output/<stem>.mp4 -f null - && echo FULL_DECODE_OK       # zero decode errors
cat output/<stem>_validation_report.json
```

Audio (parse the WAV — `volumedetect` prints nothing in this environment):

```python
import wave, audioop, math
w = wave.open("output/.work_<stem>/master_audio.wav", "rb")
d = w.readframes(w.getnframes())
print("peak dBFS", round(20*math.log10(audioop.max(d, w.getsampwidth())/32768.0), 2))
print("rms  dBFS", round(20*math.log10(max(audioop.rms(d, w.getsampwidth()),1)/32768.0), 2))
```

Targets: **peak −3…−1 dBFS** (0 dBFS = clipped master → re-render), **RMS −16…−19 dBFS**.

Deeper measurements (all read the finished render's work directory):

```bash
python3 tools/audio_report.py output/.work_<stem>/master_audio.wav output/.work_<stem>/vo_manifest.json
python3 tools/subtitle_check.py output/.work_<stem>
python3 tools/mix_probe.py work/<slug>/episode.json output/.work_<stem>
```

### Engineering gates (for engine changes, in CI)

```bash
node tests/run_all_tests.js            # 60 actions, 12 hairstyles, 12 presets, IK, 0 px stretch/slip
python3 tests/test_studio_pipeline.py  # pipeline + speech-lock checks
python3 tools/validate_specs.py        # template + every examples/ spec, zero warnings
python3 tools/check_docs.py            # every path quoted in every doc resolves (also in CI)
```

CI (`.github/workflows/verify.yml`) runs docs, specs, engine tests, and a render smoke —
including a test that a voiceless render **must** fail loudly (exit 3).

## 12.2 Human review (mandatory; the gates above cannot see these)

Watch the **draft** (cheap) and spot-check the **master**:

**Frames** — ≥ 10 frames across the timeline: start, every scene head, every board at
`cue_on + 1.5 s`, every camera cut at `cue_on + 2.5 s`, the ending.

- [ ] No black/frozen/empty frames (a scene on a pure-black void stage is a script failure, rework)
- [ ] No visual artifacts: limbs through torsos, floating characters, clipped props, broken z-order
- [ ] Character design consistent (it must be — but verify after any engine edit)
- [ ] Scene order and content match the approved script
- [ ] Subtitles: correct line, correct speaker, correct highlight, inside safe margins, no clipping
- [ ] Boards: fully built, inside the band, not over a face/tag; gone when they should be

**Audio** — listen to the whole film once, start to finish:

- [ ] Every approved line is **audible** (the quiet-failure case: a line dropped when its
      TTS backend failed — see [`VOICE_GENERATION.md`](VOICE_GENERATION.md) §8.5)
- [ ] No clipped words, no swallowed sentence ends, no rushed overlaps
- [ ] Pronunciation spot-check: numbers, jargon, proper nouns (the polish prompt's territory)
- [ ] No unexpected silence; pauses intentional
- [ ] BGM: under the narration, no pumping at scene joins, credits-worthy tracks only (CC)
- [ ] Voices: distinct per character, consistent throughout

**Format** —

- [ ] Aspect + resolution match the delivery target (ffprobe line)
- [ ] Duration matches the delivery class (40–90 s / ≤ 180 s / long-form)
- [ ] Chapters file: timestamps inside the duration, CC credits present and unhand-edited

**Rights & honesty** —

- [ ] BGM only from the bundled CC catalog or a user-supplied licensed file (credits in the
      chapters file are generated from the tracks actually used — never hand-written)
- [ ] No real person's likeness or voice anywhere in the film (engine cannot do it, but
      confirm the script didn't ask for it)
- [ ] Script content the user approved — no unreviewed additions (verbatim projects:
      `script_fidelity` proves it)

## 12.3 The sign-off

Record in `work/<slug>/decisions.md`:

```markdown
## QC sign-off — <date>
- validation_report: valid=true, voiced=true, warnings=[], frames=<n>
- decode: 0 errors | peak <x> dBFS | rms <y> dBFS
- subtitle_check: PASS | audio_report: <summary>
- frames checked: <n> (list any anomalies found + fixed)
- full listen: completed, no missing lines
- approved by: <user>, <timestamp>
```

**Gate. HARD.** No Stage 13 work before the sign-off.

## 12.4 Failure → fix loop

| Found | Fix at |
| --- | --- |
| Framing/overlap/pose/subtitle geometry | Stage 9 — edit `episode.json`, validate, stills, draft |
| Missing/dropped/mispronounced line | Stage 6 (script) or 8 (voice backend), then 9's draft loop |
| Timing off (board late, cut early) | Stage 9 — `cue_on` must match a spoken phrase verbatim |
| Duration out of class | Stage 5/6 — shorten the *script*, never speed the voice past the documented range |
| Clipped audio | Re-render (no post fix in this pipeline); if it persists, check `bgm_gain` ≤ 0.92 |
| Silent master | [`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md) — voice backend |

The order is always validate → stills → draft → master. The cheap stages exist so the
expensive one is right the first time.
