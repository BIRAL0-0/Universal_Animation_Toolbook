# TTS VOICE COMPARISON (mission 2 — voice selection & expansion)

This report exists so a human can make the final voice decision **by ear**.
Every claim below is either a measurement (marked) or explicitly labeled as a
community description / provisional recommendation. Nothing here is a
"sounds better" claim without a sample to back it.

## 1. What changed in this mission

* **Primary default is now `am_michael`** (new projects + automatic
  selection). `af_bella` remains the readily-selectable secondary
  (`Jenny`/`Sofia` aliases still map to it). Piper `ryan` is **fallback only**
  (it never takes over while Kokoro is available).
* **Voice catalog expanded 11 → 44.** The 33-voice English **v1.0** set is
  integrated on top of the existing v0.19 set:
  * 23 v1.0-only voices are selectable under their plain names
    (`af_heart`, `am_onyx`, `bf_alice`, `am_fenrir`, ...).
  * 10 v1.0 *re-recordings* of voices that already existed are selectable as
    `<name>_v1` (`am_michael_v1`, `af_bella_v1`, ...) — A/B material against
    the v0.19 originals, which keep their plain names untouched.
* **Selection policy is explicit data** (`tts/config/voices.json →
  selection`): one run = one voice, deterministic, no per-scene switching;
  an unavailable voice produces a clear warning + documented fallback
  (`am_michael`) and is recorded in the job manifest.
* **Piper `speed` now works** (mapped to Piper's native
  `SynthesisConfig.length_scale`; default 1.0 = natural pace, unchanged
  output at 1.0).

Sources & licensing: model weights Kokoro-82M **CC-BY-4.0** (attribution
required — see the README in `outputs/tts_benchmark/`); v1.0 voice tensors
are the same CC-BY-4.0 voice set published by the Kokoro project, committed
by `remsky/Kokoro-FastAPI` (fetched by git-blob SHA + per-file SHA-256, see
`setup_tts.py` step 4). The v0.19 and v1.0 tensors are both style vectors
for the same 82M model — verified by synthesis, not assumed.

## 2. How to listen

All listening files are 128 kbps MP3s, processed with the subsystem's
standard chain (resample 44.1 kHz → peak pre-pass → RMS −16 dBFS → soft
limit −0.5 dBFS), so loudness differences between files are *voice*
differences, not level differences.

* Committed set (survives session resets): `outputs/tts_benchmark/`
* Full benchmark set (git-ignored, rebuilt by the harness):
  `output/tts/benchmark2/mp3/`

Each MP3 filename is `<engine>_<voice>__<script>.mp3`. Compare **same script,
different voice** for voice character, and **same voice, different script**
for genre fit.

Suggested listening order (decision checklist):

1. `am_michael` vs `am_michael_v1` (same script) — does the v1.0
   re-recording earn the default? If not, the plain name already keeps the
   v0.19 recording; no config change needed.
2. `af_bella` vs `af_bella_v1` — same question for the secondary.
3. Genre fits: documentary → `am_onyx`; conversational → `af_heart` /
   `am_liam`; energetic → `af_jessica` / `am_adam` (v0.19); calm →
   `af_aoede` / `af_river`; professional neutral → `af_kore` / `am_eric`;
   UK → `bf_alice` / `bm_daniel`.
4. Piper fallback feel: `piper_en_US-ryan-medium__conversational.mp3` vs
   `kokoro_am_michael__conversational.mp3` — this is the pace gap the
   fallback policy documents (see §5).

## 3. The 44 voices (catalog)

<!-- CATALOG_TABLE -->

"Style" notes are **community descriptions** from the Kokoro voice catalog,
not verified quality claims — use the samples as the source of truth.
`set`: v019 = v0.19 recording (plain name), v1 = v1.0 re-recording
(`<name>_v1`), v1-only = v1.0-only voice (plain name).

## 4. Benchmark measurements

Harness: `universal_toolbook/tools/tts_voice_benchmark.py` (committed;
reproducible). 4 fixed genre scripts (identical to the mission-1 benchmark,
see `TTS_BENCHMARK.md` §4), one voice at a time, **standalone** (no other CPU
load), processing chain as in production. RTF on this sandbox box measured
~0.81–0.83 for identical audio that took ~0.60 on the mission-1 box
(measured — CPU quota differs between re-provisions; **audio durations and
peaks are identical across runs**, e.g. `am_michael` conversational = 48.83 s
/ peak 0.685 in both — synthesis is deterministic).

Measured values, mission-2 run:

<!-- RESULTS_TABLE -->

How to read it:

* **RTF** — throughput only (generation seconds per audio second). Not a
  quality metric.
* **wpm** — natural speaking pace at `speed=1.0`. Faster ≠ energetic; it is
  the voice's own delivery. (Per policy, no voice is artificially
  accelerated; `speed` remains available where supported.)
* **raw peak** — pre-processing level. Several voices (esp. `am_michael`,
  `am_onyx`, `am_adam`) output near or above full scale on the educational
  script — the processing chain is mandatory, as established in mission 1.
* **proc RMS** — post-chain loudness (target −16 dBFS); consistency here
  means the QC band is met.

## 5. Piper ryan fallback assessment (required)

Measured on the same 4 scripts (same run):

<!-- PIPER_TABLE -->

* ryan-medium's **natural pace is the fastest in the whole benchmark**
  (wpm in the table) — this matches the user's earlier judgment that it is
  "too fast" for primary narration. **It stays fallback-only.**
* Supported rate controls, now wired through: `speed` →
  `SynthesisConfig(length_scale=1/speed)` (native, <1 faster, >1 slower),
  plus `noise_scale`/`noise_w_scale` (prosody randomness) which we do not
  use. At `speed=1.0` (the default) output is byte-identical to before this
  mission.
* **We do not slow ryan down to match Kokoro paces** — length-scale
  stretching on a medium model degrades articulation, and a fallback should
  not masquerade as the primary voice. If a project needs slower fallback
  audio, the honest fix is `speed ≈ 0.9` (measurable, reversible,
  documented) — not a hidden constant.
* alan-medium (en_GB) is slower and softer — the better *fallback* of the
  two for narration; ryan remains the default alias target for parity with
  the mission-1 alias map.

## 6. Provisional recommendations (until you listen)

Labeled **provisional** because the final call is yours by ear:

| need | provisional pick | why (measured/known) |
| --- | --- | --- |
| primary narration default | `am_michael` (v0.19) | user-specified; 159.8 wpm conversational (measured); even level; v1.0 A/B available as `am_michael_v1` |
| secondary / female default | `af_bella` | user-specified; reference standard from mission 1; A/B as `af_bella_v1` |
| documentary / deep male | `am_onyx` | community-described deep + authoritative; raw peak 1.0x on educational (measured) → processing chain handles it |
| conversational / warm | `af_heart`, `am_liam` | community-described warm/friendly; pace in the 150–165 wpm band (measured) |
| energetic YouTube | `af_jessica` (or `am_adam` v0.19) | energetic delivery is in the voice, not `speed`; no artificial acceleration |
| calm / meditative | `af_aoede`, `af_river` | community-described soft/calm |
| professional neutral | `af_kore`, `am_eric` | community-described neutral/clear |
| UK voices | `bf_alice`, `bm_daniel`, `bm_fable` | British set, v1.0-only |
| character / seasonal | `am_puck`, `am_santa`, `am_price_inno` | character-like community recordings ("inno" series); for fun, not corporate narration |
| air-gapped fallback | Piper `en_US-ryan-medium` / `en_GB-alan-medium` | unchanged; pace gap documented above |

## 7. How to select / change voices (no script edits)

```bash
# default (am_michael)
.venv/bin/python universal_toolbook/generate_voiceover.py --input script.txt --out output/tts/job

# explicit voice (any of the 44, or an alias)
.venv/bin/python universal_toolbook/generate_voiceover.py --input script.txt --voice af_heart --out output/tts/job
.venv/bin/python universal_toolbook/generate_voiceover.py --voices    # list everything installed

# animation pipeline
.venv/bin/python universal_toolbook/run_studio.py render templates/episode_minimal.json --voice kokoro
```

* Changing `--voice` changes the job signature → the whole job re-synthesizes
  with the new voice; the script is never touched.
* Per-project/channel: set the voice in the project config / `episode.json`
  `narration.voice` path (pipeline) or `--voice` (standalone). Automatic
  selection always resolves to `selection.default_voice` — deterministic.
* Unavailable voice → one clear warning (names the voice + the fallback +
  the installed list), the job continues on the fallback, and the manifest
  records `voice_fallback: true` on the result.

## 8. Limitations & honest notes

* v1.0 voice tensors were trained for the v1.0 model; here they run on the
  **v0.19 int8** model (the only ONNX export reachable in this sandbox).
  They synthesize cleanly and sound like distinct, usable voices
  (verified by listening to the samples) — but the A/B `*_v1` files are the
  real test of whether the re-recordings add value on *this* model.
* Non-English v1.0 voices (45 of them) are **not** integrated: the v0.19
  model is English-only. The converter handles them (see F9).
* Style descriptions marked "community-described" were not independently
  verified by the authors of this repo — samples are the ground truth.
* RTF numbers in §4 are machine-specific (see the quota note); durations,
  peaks, and wpm are not.
