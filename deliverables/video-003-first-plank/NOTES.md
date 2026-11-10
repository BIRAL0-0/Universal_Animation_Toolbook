# NOTES — The First Plank

- **Master:** `deliverables/video-003-first-plank/final.mp4`
  - bytes: 12890634
  - SHA-256: `1ec6f53e7979683d8f2825fa0c47a2ea218b784c9158067ff24c1bbba76a3a72`
- **Secondary master:** `projects/video-003-first-plank/renders/final_16x9.mp4`
  - bytes: 9444918
  - SHA-256: `14a00dcf0dd1549fb3aaf408af9159eb98bac6aa29eae2228a6f85ad5252d317`
- **Measured master WAV:** `projects/video-003-first-plank/audio/master_audio.wav`
  - bytes: 22233148
  - SHA-256: `5917889328b1f6a7a929cc2019ff0be4640196341ce928daab36ffb972e5d1ae`
- **AAC master:** `deliverables/video-003-first-plank/audio/master_mix.m4a`
  - bytes: 3108524
  - SHA-256: `28d1344b6b9a6d337f29a7ced3dacaa8a4289e8cf0b06821d61a2199223bfb4f`
- **Poster:** `deliverables/video-003-first-plank/poster.jpg`
  - bytes: 59623
  - SHA-256: `dc3943dcc713e5ea66c80583a2ca779d952abfe21a8643e53cc43697d5ce87a6`
- **Storyboard:** `deliverables/video-003-first-plank/storyboard.svg`
  - bytes: 725151
  - SHA-256: `1dd7d16e26393e5eb1ded8d17cb8f27d418509c1b0054924d9abf34472b66199`
- **Release package:** `deliverables/releases/video-003-first-plank_RELEASE.zip`

## Exact rebuild command

```bash
.venv/bin/python tools/produce_video.py projects/video-003-first-plank \
  --workers 2 --chunk-sec 45 --preset veryfast --crf 24
```

The orchestrator validates, renders both still sets, the voiced 540×960 draft, the 1080×1920 and
1920×1080 masters, measures audio, extracts eight QA frames and verifies full decode. It clears
stale `.work_*` caches automatically when `episode.json` changes (PC-012). These masters were
re-rendered after the PC-013 / KI-012 portrait-crop label-pruning fix; the resume caches were
invalidated by removing the spec-SHA marker before the run.

- **Episode spec:** `projects/video-003-first-plank/episode.json`
- **Delivery branch:** `arena/d8a141d7-universal-animation-toolbook`
- **Delivery commit:** `PENDING_REPLACEMENT`
- **Voice backend actually used:** `kokoro-offline:am_michael`
- **Measured runtime:** 126.038 s (retimed from real Kokoro speech; authored spec is 140 s)
- **Chapters:** 7 lines + 4 CC music credits in `chapters.txt`
- **Full QA:** `QA_REPORT.md`

No publish, upload or YouTube API action was performed.
