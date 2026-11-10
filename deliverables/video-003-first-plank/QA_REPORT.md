# QA REPORT — The First Plank (delivery summary)

Status: **PASS — signed off for delivery on 2026-11-10**.

The complete measured gate table and visual findings are in
`projects/video-003-first-plank/QA_REPORT.md`. Verbatim renderer outputs are `report.json`,
`validation.json`, `cues.json` and `chapters.txt` in this folder. The animated SVG storyboard,
poster, AAC master and full authoring set ship beside `final.mp4`; the secondary 1920×1080 master
and QA contact sheets are in `deliverables/releases/video-003-first-plank_RELEASE.zip`.

Key measured values: 126.038 s, 1080×1920 primary / 1920×1080 secondary, 30 fps, H.264 High +
AAC 44.1 kHz stereo, `voiced: true`, `kokoro-offline:am_michael`, `warnings: []`, full decode
PASS, mixed WAV peak -1.22 dBFS / RMS -17.50 dBFS, 7 chapters + 4 CC music credits, 0 black/flat
frames in one-fps sampling. Board-cue frames and contact sheets from the final master were opened
and inspected; S01's name tag is clear and S07's board is fully opaque before its intentional exit
fade. The closing frames were re-inspected after the KI-012 re-render and carry no clipped
world-prop label fragment.

No subjective listening or full-film real-time viewing is claimed. No publish, upload or YouTube
API action was performed.
