# VIDEO ASSEMBLY — Stage 11

**Status: IMPLEMENTED.** Engine: `universal_toolbook/run_studio.py render` orchestrating
`universal_toolbook/engine/voice_engine.py` (audio), `universal_toolbook/engine/episode.js`
(timeline), `universal_toolbook/engine/video_renderer.js` (frames), and
`universal_toolbook/engine/audio_mixer.py` (mix + mux).
Deep command reference: [`universal_toolbook/process/03_RENDER_PIPELINE.md`](../../universal_toolbook/process/03_RENDER_PIPELINE.md).

Assembly in this pipeline is not a post step: the master is produced by one render command
that already contains the mixed audio, the locked timeline, and the chapter file. There is
no separate "editor" stage.

## 11.1 The master command

```bash
# 16:9 landscape master
python3 universal_toolbook/run_studio.py render runtime/work/<slug>/episode.json \
  --aspect-ratio 16:9 --out runtime/renders/<slug>_master_16x9.mp4 --full --preset veryfast \
  --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto

# 9:16 portrait master (same episode, reframed — never stretched)
python3 universal_toolbook/run_studio.py render runtime/work/<slug>/episode.json \
  --aspect-ratio 9:16 --out runtime/renders/<slug>_master_9x16.mp4 --full --preset veryfast \
  --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto
```

Draft for review: `--draft` (960×540 landscape / 540×960 portrait, crf 18 forced).
Duration-gated deliveries: add `--short-form` (final runtime must be 40–90 s inclusive,
aspect-independent) or `--shorts` (selects 9:16, final runtime > 0 and ≤ 180 s).

## 11.2 What happens inside, in order

1. **Dependency check** (node, canvas backend, ffmpeg, fonts, BGM; auto-installs what it can).
2. **Voice pass** — `prepare_episode_voiceover`: per-line synthesis (each line cached by
   content hash), dead-air compaction, word timings, scene stitching, and all speech-locked
   alignment. Writes `episode_retimed.json` + `vo_manifest.json` into
   `runtime/renders/.work_<stem>/`. *(With `--resume`, skipped if both files exist.)*
3. **Compile** — Node loads `universal_toolbook/engine/episode.js`; `compileEpisode`
   produces the frame-accurate timeline (beats → tracks, cues resolved, sound events) and
   `formatYouTubeChapters` the chapter text.
4. **Duration gate** — for `--short-form` / `--shorts`: out-of-range final runtime exits 2
   with `INVALID_SHORT_FORM_DURATION` / `INVALID_SHORTS_DURATION` **before any encoding**.
5. **Chunked frame render** — the film splits into `--chunk-sec` chunks (min 5 s); each
   chunk is one Node invocation of `video_renderer.js --mode render` encoding an MP4 slice
   (`runtime/renders/.work_<stem>/chunks_WxH/chunk_NNNN_start_end.mp4`), up to `--workers` in
   parallel.
6. **Concat** — ffmpeg concat demuxer, stream copy → `runtime/renders/.work_<stem>/silent_WxH.mp4`.
7. **Mix** — `build_master_soundtrack`: BGM bed (mood-matched, seamless-looped,
   crossfaded at scene joins) + environmental ambience + stereo-panned foley from the
   compiled sound events + narration with phrase-accurate −9.5 dB ducking →
   `runtime/renders/.work_<stem>/master_audio.wav`.
8. **Mux** — video + audio → the master MP4 (H.264 + AAC 44.1 kHz stereo).
9. **Report** — writes the four sidecar files (below) and prints `report.json` to stdout;
   exits 0 (clean), 2 (gate/aspect error), or 3 (silent master).

## 11.3 What gets written where

| File | Where | What it is |
| --- | --- | --- |
| `runtime/renders/<stem>.mp4` | `runtime/renders/` (git-ignored) | The master |
| `runtime/renders/<stem>_chapters.txt` | `runtime/renders/` | YouTube-chapter timestamps + auto-generated CC music credits for the tracks actually used |
| `runtime/renders/<stem>_report.json` | `runtime/renders/` | `status`, resolution, fps, `duration_sec`, `scene_count`, `voice_backend`, `voiced`, BGM/sfx audio stats, `elapsed_sec`, warnings |
| `runtime/renders/<stem>_validation_report.json` | `runtime/renders/` | `valid`, `frames`, `dimensions`, `aspect_ratio`, `fps`, `film_grain`, `voiced`, `voice_backend`, `warnings` — the machine-readable QC gate |
| `runtime/renders/<stem>_visual_audio_cues.json` | `runtime/renders/` | Every foley/visual cue with its time |
| `runtime/renders/.work_<stem>/` | `runtime/renders/` (git-ignored) | Build area: `episode_retimed.json`, `vo_manifest.json`, voice cache, chunks, `master_audio.wav`, `silent_WxH.mp4` |
| `deliverables/<film>/…` | `deliverables/` (committed) | The durable text mirror (+ master if < 50 MB) — see [`deliverables/RESULTS.md`](../../deliverables/RESULTS.md) and [`ASSET_MANAGEMENT.md`](ASSET_MANAGEMENT.md) |

## 11.4 Flags that matter (all from `render --help`)

| Flag | Default | Meaning |
| --- | --- | --- |
| `--aspect-ratio` | 16:9 | `16:9` (1920×1080) or `9:16` (1080×1920); reframes, never stretches |
| `--short-form` | off | Final-runtime gate 40–90 s inclusive; does not select aspect |
| `--shorts` | off | YouTube Shorts profile: selects 9:16, runtime > 0 … 180 s inclusive |
| `--draft` / `--full` | — | 960×540 / 540×960 preview vs 1920×1080 / 1080×1920 master |
| `--voice` | `auto` | `auto` · `edge` · `piper` · `offline` · `none` |
| `--voice-dir` | — | External per-scene audio (`S01.wav`…; the Stage 7 exception path) |
| `--allow-silent` | off | Accept a no-speech master as clean (default: it exits 3) |
| `--bgm` | episode value | `auto` · `dynamic` · a track id · `procedural` · `none` · or a local `.mp3` path (your own licensed track) |
| `--subtitles` | episode value | `cinema` · `off` |
| `--crf` | 17 (18 draft) | The documented master path uses 24 (~8 MB per 2 min here) |
| `--preset` | veryfast | Keep it — slower presets buy nothing on flat vector art |
| `--chunk-sec` | 30 | Chunk length; 45 in the documented master path |
| `--workers` | auto (≤ 4) | 2 on this sandbox's 2 vCPU; more thrashes |
| `--resume` | off | Reuse finished voice artifacts and chunks |
| `--max-chunks` | 0 | Pause after N chunks (`PARTIAL_CHUNK_PAUSE` report; re-run with `--resume`) |
| `--portrait` | off | Legacy vertical flag — prefer `--aspect-ratio 9:16` |

## 11.5 Encoding & format

- Container/codec: MP4, H.264 High + AAC-LC 44.1 kHz stereo, 30 fps.
- Zero grain by design (asserted in the validation report and the test suite).
- No film grain, no post-processing step exists or is needed; "fix in post" is not part of
  this pipeline — a clipped or broken master is re-rendered
  ([`universal_toolbook/process/07_TROUBLESHOOTING.md`](../../universal_toolbook/process/07_TROUBLESHOOTING.md)).

## 11.6 Resume & recovery semantics (verified)

- **Interrupted render:** re-run the *exact same command* with `--resume`. Finished chunks
  (size > 2 KB) are reused; the voice pass is skipped if its two artifacts exist.
- **Edited episode:** `runtime/renders/.work_<stem>/` now belongs to a different film. Chunks are
  content-blind — delete `chunks_*` (and the two retimed artifacts) before re-rendering, or
  keep the `vo_cache` dir to save TTS calls. Full recipe in [`VOICE_GENERATION.md`](VOICE_GENERATION.md) §8.4.
- **Different output filename = fresh work dir.** The work dir is keyed on the output stem;
  a new name means a new `vo_cache` (everything re-synthesizes). Reusing the stem is the
  cheap path.
- **`--max-chunks N`** reports `PARTIAL_CHUNK_PAUSE` and exits 0; the same command with
  `--resume` finishes.

## 11.7 Measured timing (2-vCPU sandbox, landscape)

| Pass | 2-minute film | Notes |
| --- | --- | --- |
| stills | ~2 s | full-resolution, per scene |
| draft (960×540) | ~50 s | includes voice pass on a cold cache |
| master (1080p, veryfast, crf 24) | ~90 s | scales linearly; ~7 min for 8.5 min of film |

Portrait renders the authored 1920×1080 stage before the crop/composite, so portrait
masters do not render *faster* than landscape at the same duration — budget accordingly
(measured in [`universal_toolbook/process/08_LIMITS.md`](../../universal_toolbook/process/08_LIMITS.md)).

## 11.8 Immediately after the master (same command's job, do not skip)

```bash
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
"$FF" -hide_banner -i runtime/renders/<stem>.mp4 2>&1 | grep -E "Duration|Stream"
"$FF" -v error -i runtime/renders/<stem>.mp4 -f null - && echo FULL_DECODE_OK
cat runtime/renders/<stem>_validation_report.json
```

Then Stage 12: [`QUALITY_CONTROL.md`](QUALITY_CONTROL.md).
