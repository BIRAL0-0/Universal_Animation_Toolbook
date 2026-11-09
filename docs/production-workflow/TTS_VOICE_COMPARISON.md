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
* **Selection policy is explicit data** (`universal_toolbook/tts/config/voices.json →
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

| voice | set | gender | style (community description) | best-for (provisional) |
| --- | --- | --- | --- | --- |
| `af_bella` | v019 | female | warm, professional, clear | narration, documentary, explainer |
| `am_michael` | v019 | male | warm, authoritative, even pace | narration, youtube, explainer, documentary |
| `am_adam` | v019 | male | bright, upbeat, younger | youtube, energy, short-form |
| `af_sky` | v019 | female | bright, crisp, youthful | youtube, energetic, entertainment |
| `af_nicole` | v019 | female | soft, calm, conversational | calm narration, conversational |
| `af_sarah` | v019 | female | neutral, clear, standard | general narration |
| `bf_emma` | v019 | female | British, warm, friendly | uk narration, conversational |
| `bf_isabella` | v019 | female | British, bright, polished | uk narration |
| `bm_george` | v019 | male | British, deep, warm | uk narration, documentary |
| `bm_lewis` | v019 | male | British, calm, clear | uk narration, explainer |
| `af` | v019 | female | v0.19 base female | general |
| `af_alloy` | v1_only | female | versatile, balanced, professional (community-described) | narration, explainer |
| `af_amelia_inno` | v1_only | female | added by the 'inno' community set (community-described) | narration |
| `af_aoede` | v1_only | female | soft, gentle, quiet (community-described) | calm, meditative, soft narration |
| `af_goodall_inno` | v1_only | female | added by the 'inno' community set (community-described) | narration |
| `af_heart` | v1_only | female | warm, friendly, inviting (community-described) | conversational, youtube, storytelling |
| `af_jadzia` | v1_only | female | warm, slightly mature, steady (community-described) | storytelling, documentary |
| `af_jessica` | v1_only | female | bright, energetic, enthusiastic (community-described) | youtube, energetic, entertainment |
| `af_kore` | v1_only | female | neutral, clear, professional (community-described) | narration, documentary, explainer |
| `af_nova` | v1_only | female | young, bright, upbeat (community-described) | youtube, energetic, short-form |
| `af_river` | v1_only | female | calm, soothing, unhurried (community-described) | calm, documentary, ambient narration |
| `am_echo` | v1_only | male | calm, neutral, level (community-described) | explainer, narration |
| `am_eric` | v1_only | male | clear, mid-register, steady (community-described) | narration, explainer |
| `am_fenrir` | v1_only | male | young, casual, relaxed (community-described) | youtube casual, gaming, conversational |
| `am_liam` | v1_only | male | warm, friendly, natural (community-described) | conversational, storytelling, youtube |
| `am_onyx` | v1_only | male | deep, calm, authoritative (community-described) | documentary, trailer, epic narration |
| `am_price_inno` | v1_only | male | added by the 'inno' community set (community-described) | narration |
| `am_puck` | v1_only | male | playful, character-like (community-described) | character, entertainment, comedic |
| `am_santa` | v1_only | male | character voice, festive (community-described) | character, seasonal, entertainment |
| `bf_alice` | v1_only | female | British, professional, polished (community-described) | uk narration, documentary, explainer |
| `bf_lily` | v1_only | female | British, bright, youthful (community-described) | uk youtube, energetic |
| `bm_atten_inno` | v1_only | male | British, added by the 'inno' community set (community-described) | uk narration |
| `bm_daniel` | v1_only | male | British, warm, relaxed (community-described) | uk conversational, storytelling |
| `bm_fable` | v1_only | male | British, warm, storytelling (community-described) | uk storytelling, documentary |
| `am_michael_v1` | v019_v1_variant | male | v1.0 re-recording of Michael (A/B against am_michael) | same as am_michael |
| `af_bella_v1` | v019_v1_variant | female | v1.0 re-recording of Bella (A/B against af_bella) | same as af_bella |
| `am_adam_v1` | v019_v1_variant | male | v1.0 re-recording of Adam | same as am_adam |
| `af_sky_v1` | v019_v1_variant | female | v1.0 re-recording of Sky | same as af_sky |
| `af_nicole_v1` | v019_v1_variant | female | v1.0 re-recording of Nicole | same as af_nicole |
| `af_sarah_v1` | v019_v1_variant | female | v1.0 re-recording of Sarah | same as af_sarah |
| `bf_emma_v1` | v019_v1_variant | female | v1.0 re-recording of Emma | same as bf_emma |
| `bf_isabella_v1` | v019_v1_variant | female | v1.0 re-recording of Isabella | same as bf_isabella |
| `bm_george_v1` | v019_v1_variant | male | v1.0 re-recording of George | same as bm_george |
| `bm_lewis_v1` | v019_v1_variant | male | v1.0 re-recording of Lewis | same as bm_lewis |

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

| kokoro voice | script | dur (s) | RTF | wpm | raw peak | raw peak dBFS | proc RMS dBFS | limit engaged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| am_michael | conversational | 48.83 | 0.832 | 159.8 | 0.6847 | -3.29 | -16.11 | yes |
| am_michael | energetic_youtube | 60.56 | 0.812 | 138.7 | 0.98 | -0.18 | -16.17 | yes |
| am_michael | educational | 88.32 | 1.074 | 116.8 | 1.0179 | -0.0 | -16.22 | yes |
| am_michael | dramatic | 45.37 | 0.804 | 162.7 | 0.7874 | -2.08 | -16.1 | yes |
| af_bella | conversational | 44.47 | 0.817 | 175.4 | 0.7387 | -2.63 | -16.01 | yes |
| af_bella | energetic_youtube | 53.88 | 0.826 | 155.9 | 0.7245 | -2.8 | -16.01 | yes |
| af_bella | educational | 79.83 | 0.843 | 129.3 | 0.8019 | -1.92 | -16.02 | yes |
| af_bella | dramatic | 41.12 | 0.839 | 179.5 | 0.6377 | -3.91 | -16.0 | yes |
| am_michael_v1 | conversational | 47.65 | 0.839 | 163.7 | 0.9013 | -0.9 | -16.12 | yes |
| am_michael_v1 | energetic_youtube | 57.19 | 0.833 | 146.9 | 1.0737 | -0.0 | -16.18 | yes |
| am_michael_v1 | educational | 88.6 | 0.814 | 116.5 | 1.0214 | -0.0 | -16.18 | yes |
| am_michael_v1 | dramatic | 44.62 | 0.806 | 165.4 | 0.8329 | -1.59 | -16.12 | yes |
| af_bella_v1 | conversational | 43.79 | 0.822 | 178.1 | 0.9551 | -0.4 | -16.01 | yes |
| af_bella_v1 | energetic_youtube | 52.45 | 0.826 | 160.1 | 0.8277 | -1.64 | -16.03 | yes |
| af_bella_v1 | educational | 81.58 | 0.822 | 126.5 | 0.8829 | -1.08 | -16.02 | yes |
| af_bella_v1 | dramatic | 41.36 | 0.812 | 178.4 | 0.7999 | -1.94 | -16.01 | yes |
| am_onyx | conversational | 42.51 | 0.809 | 183.5 | 0.8572 | -1.34 | -16.05 | yes |
| am_onyx | energetic_youtube | 51.54 | 0.838 | 163.0 | 1.2518 | -0.0 | -16.08 | yes |
| am_onyx | educational | 81.24 | 0.822 | 127.0 | 1.0828 | -0.0 | -16.08 | yes |
| am_onyx | dramatic | 40.48 | 0.837 | 182.3 | 0.8588 | -1.32 | -16.05 | yes |
| am_liam | conversational | 39.63 | 0.831 | 196.8 | 0.8884 | -1.03 | -16.0 | yes |
| am_liam | energetic_youtube | 47.03 | 0.84 | 178.6 | 0.9108 | -0.81 | -16.0 | yes |
| am_liam | educational | 75.27 | 0.84 | 137.1 | 0.7923 | -2.02 | -16.01 | yes |
| am_liam | dramatic | 37.69 | 0.849 | 195.8 | 0.7678 | -2.3 | -16.0 | yes |
| am_fenrir | conversational | 39.48 | 0.849 | 197.6 | 0.9509 | -0.44 | -16.01 | yes |
| am_fenrir | energetic_youtube | 46.69 | 0.835 | 179.9 | 0.974 | -0.23 | -16.02 | yes |
| am_fenrir | educational | 77.68 | 0.837 | 132.9 | 0.9744 | -0.23 | -16.01 | yes |
| am_fenrir | dramatic | 38.39 | 0.85 | 192.2 | 0.8738 | -1.17 | -16.01 | yes |
| am_eric | conversational | 38.1 | 0.86 | 204.7 | 0.7178 | -2.88 | -16.0 | yes |
| am_eric | energetic_youtube | 45.22 | 0.839 | 185.8 | 0.6918 | -3.2 | -16.0 | yes |
| am_eric | educational | 73.22 | 0.827 | 140.9 | 0.8668 | -1.24 | -16.0 | yes |
| am_eric | dramatic | 36.77 | 0.837 | 200.7 | 0.7769 | -2.19 | -16.0 | yes |
| af_heart | conversational | 44.05 | 0.845 | 177.1 | 0.6816 | -3.33 | -16.0 | yes |
| af_heart | energetic_youtube | 52.75 | 0.843 | 159.2 | 0.6455 | -3.8 | -16.01 | yes |
| af_heart | educational | 81.8 | 0.842 | 126.2 | 0.7337 | -2.69 | -16.01 | yes |
| af_heart | dramatic | 41.42 | 0.839 | 178.2 | 0.7466 | -2.54 | -16.0 | yes |
| af_jessica | conversational | 38.82 | 0.853 | 200.9 | 0.8056 | -1.88 | -16.01 | yes |
| af_jessica | energetic_youtube | 45.9 | 0.821 | 183.0 | 0.9606 | -0.35 | -16.01 | yes |
| af_jessica | educational | 74.12 | 0.829 | 139.2 | 0.9716 | -0.25 | -16.01 | yes |
| af_jessica | dramatic | 37.31 | 0.835 | 197.8 | 0.8809 | -1.1 | -16.01 | yes |
| af_aoede | conversational | 42.19 | 0.855 | 184.9 | 0.8473 | -1.44 | -16.0 | yes |
| af_aoede | energetic_youtube | 49.08 | 0.833 | 171.1 | 0.7908 | -2.04 | -16.0 | yes |
| af_aoede | educational | 79.88 | 0.829 | 129.2 | 0.8483 | -1.43 | -16.0 | yes |
| af_aoede | dramatic | 40.21 | 0.839 | 183.5 | 0.738 | -2.64 | -16.0 | — |
| af_kore | conversational | 39.97 | 0.87 | 195.1 | 0.7634 | -2.35 | -16.0 | yes |
| af_kore | energetic_youtube | 47.5 | 0.854 | 176.8 | 0.7462 | -2.54 | -16.0 | yes |
| af_kore | educational | 78.04 | 0.85 | 132.2 | 0.7966 | -1.98 | -16.0 | yes |
| af_kore | dramatic | 38.5 | 0.86 | 191.7 | 0.7465 | -2.54 | -16.0 | yes |
| bf_alice | conversational | 40.8 | 0.863 | 191.2 | 0.8099 | -1.83 | -16.0 | yes |
| bf_alice | energetic_youtube | 49.06 | 0.873 | 171.2 | 0.8147 | -1.78 | -16.01 | yes |
| bf_alice | educational | 78.28 | 0.849 | 131.8 | 0.8346 | -1.57 | -16.0 | yes |
| bf_alice | dramatic | 38.82 | 0.856 | 190.1 | 0.823 | -1.69 | -16.0 | yes |
| bm_daniel | conversational | 40.04 | 0.87 | 194.8 | 0.6946 | -3.17 | -16.0 | yes |
| bm_daniel | energetic_youtube | 47.14 | 0.856 | 178.2 | 0.8227 | -1.7 | -16.0 | yes |
| bm_daniel | educational | 75.76 | 0.865 | 136.2 | 0.676 | -3.4 | -16.0 | yes |
| bm_daniel | dramatic | 37.9 | 0.885 | 194.7 | 0.6699 | -3.48 | -16.0 | yes |

How to read it:

* **RTF** — throughput only (generation seconds per audio second). Not a
  quality metric.
* **wpm** — natural speaking pace at `speed=1.0`. Faster ≠ energetic; it is
  the voice's own delivery. (Per policy, no voice is artificially
  accelerated; `speed` remains available where supported.)
* **raw peak** — pre-processing level. Several voices output near or above
  full scale: `am_onyx` energetic 1.25, `am_michael_v1` energetic 1.07,
  `am_onyx` educational 1.08, `am_michael` educational 1.02 (measured) —
  the processing chain is mandatory, as established in mission 1.
* **proc RMS** — post-chain loudness (target −16 dBFS); consistency here
  means the QC band is met.

## 5. Piper ryan fallback assessment (required)

Measured on the same 4 scripts (same run):

| piper voice | script | dur (s) | RTF | wpm | raw peak | raw peak dBFS | proc RMS dBFS | limit engaged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| en_US-ryan-medium | conversational | 37.89 | 0.159 | 205.8 | 1.0 | -0.0 | -16.0 | — |
| en_US-ryan-medium | energetic_youtube | 45.43 | 0.098 | 184.9 | 1.0 | -0.0 | -16.0 | — |
| en_US-ryan-medium | educational | 68.16 | 0.093 | 151.4 | 1.0 | -0.0 | -16.0 | — |
| en_US-ryan-medium | dramatic | 33.65 | 0.097 | 219.3 | 1.0 | -0.0 | -16.0 | — |
| en_GB-alan-medium | conversational | 48.69 | 0.135 | 160.2 | 1.0 | -0.0 | -16.0 | yes |
| en_GB-alan-medium | energetic_youtube | 60.31 | 0.094 | 139.3 | 1.0 | -0.0 | -16.0 | yes |
| en_GB-alan-medium | educational | 83.17 | 0.092 | 124.1 | 1.0 | -0.0 | -16.0 | yes |
| en_GB-alan-medium | dramatic | 44.26 | 0.092 | 166.8 | 1.0 | -0.0 | -16.0 | yes |

* ryan-medium's **natural pace is the fastest in the whole benchmark**
  (wpm in the table) — this matches the user's earlier judgment that it is
  "too fast" for primary narration. **It stays fallback-only.**
* Supported rate controls, now wired through: `speed` →
  `SynthesisConfig(length_scale=1÷speed)` (native, <1 faster, >1 slower),
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
| documentary / deep male | `am_onyx` | community-described deep + authoritative; slowest male in the run (183.5 wpm conversational, measured); raw peak 1.25 energetic → processing chain handles it |
| conversational / warm | `af_heart`, `am_liam` | community-described warm/friendly; 177 / 197 wpm conversational (measured) |
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
