# VOICE GENERATION — Stage 8

**Status: IMPLEMENTED.** Engine: `universal_toolbook/engine/voice_engine.py`
(entry point `prepare_episode_voiceover`), invoked automatically by `run_studio.py render`.
Deep engine detail: [`universal_toolbook/process/05_AUDIO.md`](../../universal_toolbook/process/05_AUDIO.md).

**Framing.** This is not a separate step you run — it is the first pass inside the render
command. "Regenerating a voiceover section" therefore means: change one line's text (or
voice/rate), re-run the render, and let the per-line cache do the rest. That cache is the
whole cost model, so it gets its own section below.

## 8.1 Backends

| Backend | Selection | How it works | Notes |
| --- | --- | --- | --- |
| **Kokoro (self-hosted) — default** | `--voice kokoro`, or `--voice auto` when Kokoro is set up (it is, after `setup_tts.py`) | Kokoro-82M int8 ONNX via `kokoro-onnx` (CPU, ~0.7 GB RAM, faster than realtime on a 2-vCPU box); 11 voices; word timings via the syllable-proportional + energy-refined fallback (this export has no native boundaries) | **Completely free, local, no account.** Setup: `python3 universal_toolbook/setup_tts.py`. No word-boundary timestamps in the ONNX export — see `TTS_ARCHITECTURE.md` §2 for how timings are derived honestly. |
| Edge/Azure neural | `--voice edge`, or `--voice auto` fallback for lines Kokoro missed | `edge-tts` (Python library, no API key); word-boundary timestamps per line | Cloud; **unreachable in restricted sandboxes** (`speech.platform.bing.com:443`). Not self-hosted, not guaranteed free — retained as a fallback only, and no longer the default. |
| Piper offline | `--voice piper`, or last-resort fallback line by line | Local `.onnx` models via `piper-tts`; syllable-weighted word timings (native phoneme alignments) | The fast, small-footprint fallback; 2 voices installed by default (see below). |
| OS TTS | `--voice offline` (with `espeak-ng` installed) | System espeak synthesis | Robotic; last resort, documented for completeness. |
| External audio | `--voice-dir <dir>` with `<sceneId>.wav` files (`S01.wav`…) | Engine measures your files and retimes to them | The Stage 7 exception path (user-recorded narration). |
| Text-led (silent) | `--voice none` | No speech; choreography and subtitles still render | Timing tests only. |

`--voice auto` (the documented default here) tries **Kokoro first** (when
`setup_tts.py` has been run), then Edge for any line it did not cover, then
Piper — so the episode JSON keeps the Edge names you designed and the report
says what actually ran:

```
"voice_backend": "kokoro-offline:am_michael,af_bella"
```

On machines without Kokoro set up, the legacy order (Edge → Piper) applies
exactly as before. **Always read that field back.** One model in the list =
two characters share a speaker.

### The installed voices

**Kokoro (default engine)** — 11 voices in the installed weight set:
`af, af_bella, af_nicole, af_sarah, af_sky` (female), `am_adam, am_michael`
(male), `bf_emma, bf_isabella` (British female), `bm_george, bm_lewis`
(British male). Pipeline alias resolution (Edge-style name in the episode JSON
→ Kokoro voice):

| Requested (Edge id in JSON) | Kokoro | Piper fallback |
| --- | --- | --- |
| `en-US-AndrewNeural`, `en-US-EricNeural` | `am_michael` | `en_US-ryan-medium` |
| `en-US-GuyNeural` | `am_adam` | `en_US-ryan-medium` |
| `en-US-JennyNeural` | `af_bella` | `en_GB-alan-medium` |
| `en-US-AriaNeural` | `af_sky` | — |
| `en-US-AnaNeural`, `en-GB-LibbyNeural` | `af_nicole` | — |
| `en-US-EmmaNeural` | `bf_emma` | — |
| `en-GB-RyanNeural` | `am_michael` | — |
| `narrator` / `host` | `af_bella` | `en_US-ryan-medium` |

A Kokoro voice id (e.g. `"voice": "af_bella"`) works directly in the episode
JSON. The alias tables live in `universal_toolbook/tts/config/voices.json`
(`engines.kokoro.aliases` / `engines.piper.aliases`) — extend them there.
List everything at runtime:

```bash
python3 universal_toolbook/generate_voiceover.py --voices --engine kokoro
python3 universal_toolbook/generate_voiceover.py --voices --engine piper
```

That is **11 distinguishable Kokoro speakers** with the default install (Piper
alone: 2). More:

```bash
pip install piper-tts
python3 universal_toolbook/tools/fetch_piper_voices.py check
python3 universal_toolbook/tools/fetch_piper_voices.py install
python3 universal_toolbook/tools/fetch_piper_voices.py install --github <owner>/<repo> --github-path <dir>   # github-only network
python3 universal_toolbook/tools/fetch_piper_voices.py install --from-dir /path/to/voices                     # offline copy
```

Voice resolution order: `PIPER_VOICE_DIR` → `~/.cache/piper_voices` → `assets/voices/`.
Any `.onnx` in the voice directory can also be addressed directly as
`"voice": "piper:<model-name>"` in the episode JSON.

## 8.2 Voice selection and consistency

- **One speaker id = one voice for the whole film.** The `voices` map
  (`{speaker: {voice, rate, pitch}}`) is resolved once per speaker; every scene reuses it.
  Consistency across scenes is structural, not a hope.
- Rates: narrator `+0%…+4%`, authority/age `-3%…-5%`; per-line `rate`/`pitch` overrides
  exist in `dialogue[]` entries but are rarely needed.
- Distinctness: mix accents (US + GB) or pitch before adding a third similar voice;
  same-gender + same-accent pairs blur in dialogue.
- Every `dialogue[].speaker` must exist in `voices` — an unknown speaker silently falls
  back to the narrator voice.
- `pause_after` per line: 0.22–0.32 s inside a conversation, 0.35–0.45 s at scene turns
  (that gap is where the cut/board/BGM change lands). The engine caps unflagged pauses at
  0.85 s (`allow_long_pause` overrides for deliberate silence).

## 8.3 What the voice pass produces

Per dialogue line (one sentence per `dialogue` entry — that is the authoring rule):

1. Synthesis → line WAVs under `runtime/renders/.work_<stem>/vo_cache` named by scene, line, and content hash (44.1 kHz mono)
2. Leading/trailing silence trim
3. **Internal dead-air compaction** — runs over 0.32 s shrink to ~0.12 s when
   unpunctuated; commas keep ≥ 0.24 s, sentence punctuation ≥ 0.42 s, ellipsis keeps its
   full pause. Word timestamps shift with the audio. (This is why the polish prompt shapes
   punctuation: it is the timing design.)
4. **Exact word timestamps** (Edge word boundaries; Piper syllable-weighted, refined
   against voiced onsets)
5. The line is stitched into the scene's audio bed; boards and camera shots snap to the
   measured phrase times; beats scale to the measured scene length.

Outputs that persist per render: `vo_manifest.json`, `episode_retimed.json`, the
voice-cache files, and finally `master_audio.wav` (mixed: voices + BGM + foley).

## 8.4 Regenerating one section without regenerating everything

The cache key is `sha1(voice | rate | pitch | text)` — so:

- **Reword one line** → only that line re-synthesizes; every other line's cache entry is
  reused (no TTS calls, no cost, no new latency).
- **Change one character's voice/rate** → only that character's lines re-synthesize.
- **Change nothing** → the whole pass is cache hits.

The catch: with `--resume`, if `episode_retimed.json` + `vo_manifest.json` exist, the voice
pass is **skipped entirely** — the retimed timeline is trusted. So the correct procedure to
re-voice changed lines is:

```bash
# 1. edit episode.json (one line's text, or one speaker's voice/rate)
# 2. drop the cached artifacts that make --resume skip the voice pass
rm runtime/renders/.work_<stem>/episode_retimed.json runtime/renders/.work_<stem>/vo_manifest.json
#    (keep vo_cache — unchanged lines still hit the cache)
# 3. chunks are content-blind: a re-time makes every chunk stale, so drop them too
rm -rf runtime/renders/.work_<stem>/chunks_*
# 4. re-run the exact same render command with --resume
```

If you changed nothing voice-related and only want to re-render, you can skip straight to
the render (the voice pass re-reads its cache in seconds).

## 8.5 Failure modes

| Symptom | Meaning | Fix |
| --- | --- | --- |
| Exit **3**, `"status": "COMPLETE_SILENT"`, `!` banner, `voice_diagnosis` list | No backend synthesized anything — the file is subtitles + music only | Install the backend (`pip install piper-tts` + voice install), re-render. Never deliver this file. `--allow-silent` / `--voice none` are the only paths to a *reported-clean* silent master. |
| One model in `voice_backend` | Two speakers share a voice | Assign distinct voices/rates; mix accents. |
| Words clipped at line ends | `pause_after` too small or lines too dense | Raise to 0.3 s; lengthen the scene. |
| A single very long line | 60+ words in one `dialogue` entry → one long unbreakable subtitle | Split the entry (one sentence per entry). |

**Error handling inside the pass (read this once).** Per line, a backend failure under
`auto` falls through to the next backend. The two failure shapes are different:

- **No line in the whole film synthesized** → the loud case: exit 3, `COMPLETE_SILENT`,
  `voice_diagnosis`.
- **One line fails all backends while others speak** → the *quiet* case: that line is
  **dropped from the audio** (the scene stitches only its successful lines, and its
  fallback word timings still drive a silent subtitle window), and the render still
  reports `COMPLETE` with `voiced: true`. The film simply skips that sentence.

So after any render with a flaky network, verify the draft **by ear**: every line of the
approved narration must be audible. `vo_manifest.json` in the work directory lists the
speech intervals actually produced — a count that is short of the episode's dialogue lines
is the tell.
