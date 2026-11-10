# NOTES — The First Plank

- **Master:** `deliverables/video-003-first-plank/final.mp4`
  - bytes: 12911980
  - SHA-256: `7a21ad65b6185f814e1e55cf4e8fb87512611a0daf65ed4d58a9f3b840424ba4`
- **Secondary master:** `projects/video-003-first-plank/renders/final_16x9.mp4`
  - bytes: 9446336
  - SHA-256: `67c2512daf0795aa1d8f6f9744dd0253903d5f324697fa9493eeea081ccfb8ed`
- **Measured master WAV:** `projects/video-003-first-plank/audio/master_audio.wav`
  - bytes: 22233148
  - SHA-256: `e6e242953d8e450f6acc35288efe527d671d73f11dd78919a7ad975bf19f9393`
- **AAC master:** `deliverables/video-003-first-plank/audio/master_mix.m4a`
  - bytes: 3113521
  - SHA-256: `5a57c9d4e2412c5263b7eb376e40c0e2b4bbfbb14cdf158cdc8474704f8cba9a`
- **Poster:** `deliverables/video-003-first-plank/poster.jpg`
  - bytes: 46991
  - SHA-256: `fece687937aa967538acc44e6fc829ccaaea43b162f695acb537df557853a626`
- **Storyboard:** `deliverables/video-003-first-plank/storyboard.svg`
  - bytes: 725603
  - SHA-256: `494f80f803ade6b44685e0025c44523e2994dd69f7385037d5a0a86d4e781875`
- **Release package:** `deliverables/releases/video-003-first-plank_RELEASE.zip`

## Exact rebuild command

```bash
.venv/bin/python tools/produce_video.py projects/video-003-first-plank \
  --workers 2 --chunk-sec 45 --preset veryfast --crf 24
```

The orchestrator validates, renders both still sets, the voiced 540×960 draft, the 1080×1920 and
1920×1080 masters, measures audio, extracts eight QA frames and verifies full decode. It clears
stale `.work_*` caches automatically when `episode.json` changes (PC-012).

- **Episode spec:** `projects/video-003-first-plank/episode.json`
- **Delivery branch:** `arena/d8a141d7-universal-animation-toolbook`
- **Delivery commit:** `219a98b788f6899e8baae27c2173c782d13c0d25`
- **Voice backend actually used:** `kokoro-offline:am_michael`
- **Measured runtime:** 126.038 s (retimed from real Kokoro speech; authored spec is 140 s)
- **Chapters:** 7 lines + 4 CC music credits in `chapters.txt`
- **Full QA:** `QA_REPORT.md`

No publish, upload or YouTube API action was performed.
