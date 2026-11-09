# Remotion-specific techniques — reference only, NOT adopted

> **Status: quarantine.** Every API in this document belongs to the Remotion/React ecosystem.
> **None of these packages are dependencies of this repository.** Do not copy these snippets into
> `universal_toolbook/engine/`, do not run `npm install remotion`, and do not create React
> components. The decision and evaluation are in
> [`docs/decisions/ADR-0001-remotion-evaluation.md`](../../../docs/decisions/ADR-0001-remotion-evaluation.md).
> Framework-independent ideas are adapted in [`frame-based-animation.md`](frame-based-animation.md).

## Evaluation questions and answers

| Question | Answer for this repository |
|---|---|
| Which techniques apply directly to the frame renderer? | Frame-based time, interpolation, easing, spring physics, sequencing by in/out points, composition metadata, screen-space typography, caption timing, asset loading before frame zero. Already present or adaptable. |
| Which improve animation timing? | A single frame clock and pure `f(frame)` functions; already implemented. Remotion's `useCurrentFrame()` / `interpolate()` / `spring()` are API shapes, not missing capabilities. |
| Which improve scene sequencing? | `Sequence` / `Series` map conceptually to `scenes[]` with compiled `startFrame`/`endFrame`. Dynamic `calculateMetadata` maps conceptually to speech-locked retiming done in Python before render. |
| Which improve transitions and camera? | `@remotion/transitions` would add prebuilt transitions; this renderer already has environment fades, cuts and camera shots. A new transition primitive belongs in `video_renderer.js` with a JS regression test. |
| Which improve captions/typography? | SRT import, transcription and `@remotion/captions` would add real caption-file workflows. Burned-in subtitles and word highlights already exist; SRT export is roadmap F4, not a runtime feature. |
| Which improve media synchronization? | Audio duration/dimension probing and `useVideoConfig()` metadata are conceptually covered by Python's `voice_engine.py`, `audio_mixer.py` and the validation reports. |
| Which features require an actual Remotion runtime? | React composition trees, `useCurrentFrame`, `useVideoConfig`, `<Sequence>`, `calculateMetadata`, `@remotion/three`/React Three Fiber, Lottie, Tailwind, Mediabunny decoding, Remotion Studio/bundler. |
| Would adopting Remotion improve quality enough? | **No, not on current evidence.** It would replace a deterministic, tested, dependency-light 2D renderer with a React build pipeline, add ~hundreds of MB of dependencies, and require re-implementing 15 JS modules plus the Python audio integration. See ADR-0001. |

## API → concept → Toolbook equivalent

| Remotion-specific API / package | General concept | Toolbook equivalent | Requires Remotion runtime? |
|---|---|---|---|
| `useCurrentFrame()`, `useVideoConfig({fps})` | read the frame clock and video config | `frameIdx / episode.fps`, `compileEpisode()` | Yes |
| `interpolate()`, `spring()`, `Easing` | normalised interpolation and spring easing | `clamp`, `lerp`, `ease`, `springEase`, `backEase` in `character_rig.js` | No (concept adapted) |
| `<Composition>`, `durationInFrames`, `defaultProps` | composition metadata | top-level `episode.json` + `config/studio_config.json` | Yes |
| `calculateMetadata()` | duration derived from media | `voice_engine.py` retimes scenes to measured speech before rendering | Yes |
| `<Sequence from durationInFrames>`, `<Series>` | scene in/out points | ordered `scenes[]`, compiled `startFrame`/`endFrame` | Yes |
| `<TransitionSeries>`, `@remotion/transitions` | prebuilt transitions | environment-change fades, `fade_to_black`, `cut_to_black_at`, `camera_shots[].cut` | Yes |
| `<Audio>`, `<Video>`, `<Img>`, `<Gif>`, `staticFile()` | declarative media | Python `audio_mixer.py`, `--voice-dir`, `--bgm`, canvas draw calls | Yes |
| `@remotion/google-fonts`, `measureText`, `fitText` | typography and text measurement | bundled Poppins fonts, `font.js`, canvas `measureText`, safe-area clamps | Yes for the package |
| `@remotion/captions`, `parseSrt`, `transcribe` | caption import/transcription | `line_timings`, `word_timings`, `accent_words`; SRT export is roadmap F4 | Yes |
| `@remotion/three`, React Three Fiber, Lottie, charts, Tailwind | 3D / vector animation / styling | 2D procedural props and boards only; not available | Yes |
| `canDecode`, `extractFrames`, `getAudioDuration`, `getVideoDimensions`, `getVideoDuration`, Mediabunny | media probing | `imageio-ffmpeg` binary, `*_validation_report.json`, `tools/audio_report.py`, `tools/produce_video.py` | Yes for the library |
| Remotion Studio / bundler / renderer | preview and render pipeline | `run_studio.py stills` / `render`, CI render-smoke job | Yes |

The supplied reference list (`animations.md`, `timing.md`, `sequencing.md`, `trimming.md`,
`compositions.md`, `calculate-metadata.md`, `assets.md`, `images.md`, `videos.md`, `audio.md`,
`gifs.md`, `text-animations.md`, `measuring-text.md`, `fonts.md`, `display-captions.md`,
`import-srt-captions.md`, `transcribe-captions.md`, `charts.md`, `3d.md`, `lottie.md`,
`transitions.md`, `tailwind.md`, `measuring-dom-nodes.md`, `can-decode.md`, `extract-frames.md`,
`get-audio-duration.md`, `get-video-dimensions.md`, `get-video-duration.md`) maps to the rows
above. It is **not reproduced** here: copying a second animation framework's documentation into
this repository would create unused instructions and a second, competing source of truth.

## Conditions for revisiting

An agent may propose adopting Remotion only if it produces a small, tested spike that:

1. renders the same `episode_minimal.json` with the same visual output and reports;
2. preserves Kokoro voiceover, BGM, foley, speech-locked cues, portrait framing and chunked resume;
3. passes every existing test in `tests/` without weakening a gate;
4. measures install size, render time and maintenance surface against the current renderer; and
5. records the result in a new ADR under `docs/decisions/` before any dependency is added.

Until then, Remotion is an **optional technology decision**, never a second animation engine.
