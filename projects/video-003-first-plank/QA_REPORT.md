# QA REPORT — The First Plank

Status: **PASS — signed off for delivery on 2026-11-10**. Every value below was read from a
produced report, measurement file or an image actually opened with `read_file`. No subjective
listening or full-film real-time viewing is claimed.

| Gate | Result | Evidence |
|---|---|---|
| `validate` warnings `[]` | PASS | `run_studio.py validate`: 140 s planning duration, 7 scenes, 42 lines, 49 sound events, `warnings: []`; `qa_measurements.json` Stage A. |
| Full-resolution 9:16 stills inspected | PASS | 7 PNGs in `assets/stills_9x16/`; min std 25.28, max near-black fraction 0.426, 0 flat-black; `assets/stills_pixel_measurements.json`. |
| Full-resolution 16:9 stills inspected | PASS | 7 PNGs in `assets/stills_16x9/`; `assets/final_review/stills_9x16_contact_sheet.png` and
  `assets/final_review/stills_16x9_contact_sheet.png` opened. |
| Draft voiced, `warnings: []` | PASS | `renders/draft_9x16_report.json`: `COMPLETE`, `voiced: true`, `kokoro-offline:am_michael`, `warnings: []`, 126.038 s, 540×960, 30 fps. |
| Draft board/camera frames inspected | PASS | `assets/draft_review/board_contact_sheet.png` opened; all seven board cards are inside the safe crop and readable. |
| 9:16 master voiced, `warnings: []` | PASS | `final_report.json`: `COMPLETE`, `voiced: true`, `kokoro-offline:am_michael`, `warnings: []`, 126.038 s, 1080×1920, 30 fps, `film_grain: false`. |
| 16:9 master voiced, `warnings: []` | PASS | `renders/final_16x9_report.json`: same backend/warnings, 126.038 s, 1920×1080, 30 fps. |
| Dimensions match declared aspect | PASS | `final_validation_report.json`: `valid: true`, `[1080,1920]`, 3781 frames; 16:9 validation `[1920,1080]`, 3781 frames. |
| Full decode | PASS | `ffmpeg -v error -i … -f null -` exited 0 for both masters; `assets/final_review/measurements.json` `full_decode`. |
| Measured container and audio | PASS | H.264 High + AAC 44.1 kHz stereo; mixed WAV 2 ch / 44,100 Hz / 126.04 s; WAV peak -1.22 dBFS, RMS -17.50 dBFS; muxed AAC peak -1.27 dBFS, RMS -17.51 dBFS; all in target. |
| At least six inspected final frames | PASS | 8 `assets/qa_frames/t*.png`, 7 `board_XX.png`, `start.png`, `closing_question.png`, `closing_question_full.png`, `s07_board_fade.png`, `end.png`, and four contact sheets opened. |
| Mute-legibility and no black sections | PASS | `mute_legibility_contact_sheet.png`, `wide_qa_contact_sheet.png` and `board_contact_sheet.png` opened; one-fps grayscale over 126 samples: 9:16 min std 20.30, 16:9 min std 13.91, 0 black/flat frames in either master. |
| Audio tools | PASS | `tools/audio_report.py` PASS (true peak -1.25, RMS -17.51, 0 clipping); `tools/subtitle_check.py` PASS (358 script words, 0 overlaps, 104.9 % coverage); `tools/mix_probe.py` PASS (18.59 dB / 23.59 dB separation). |
| Chapters and credits | PASS | `final_chapters.txt`: 7 chapter lines at 00:00, 00:19, 00:37, 00:53, 01:11, 01:30, 01:48, all within 126.038 s, plus four music credits. |
| Repository gates | PASS | `tools/validate_structure.py`, `tools/check_docs.py`, `tools/check_workflows.py`, `tools/validate_specs.py`, `pytest tests/unit/test_repository_structure.py`, JS regression and `git diff --check` recorded in `PRODUCTION_LOG.md`. |

## Visual findings actually inspected

- `board_01.png`: the `MIRA` tag is clearly below the "THE BRIDGE" card; the earlier 9:16
  collision is resolved on the **final master**, not just the draft.
- `board_contact_sheet.png`: all seven cards fit with `h=250`, `y=74`, `portrait_w=460`,
  `portrait_x=0.5`; S04's strike-through rewrite and S05's four lines are legible.
- `board_07.png`: S07's "THE CROSSING" board is fully opaque at cue + 1.6 s. The rebuilt spec
  reveals on "The bridge was not shorter" and hides on "Then she looked at you", so it no longer
  appears pre-faded at the end of the film.
- `s07_board_fade.png`: the intentional exit fade is legible and occurs before the closing
  question, not over it.
- `start.png`, `closing_question.png`, `closing_question_full.png`, `end.png`: chapter one card,
  the split closing-question subtitle and a clean end frame; the exact scripted question is
  preserved in `SCRIPT_POLISHED.md` and `episode.json`.
- `mute_legibility_contact_sheet.png` and `wide_qa_contact_sheet.png`: the seven-chapter arc reads
  without audio in both aspects. `CHAPTER SEVEN | THE OTHER SIDE` is the intended S07 card; the
  earlier stray second S07 card is gone.
- `audio_waveform.png`: continuous speech/music with a measured quiet fade tail; no silent middle.

## Limitations

- No subjective listening test was performed; audio conclusions are measured only.
- No full-film real-time viewing was performed; visual conclusions come from the listed extracted
  frames and contact sheets.
- Publishing, upload and YouTube API actions were not performed and are not authorised.
