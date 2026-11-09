VIDEO-001 RELEASE — "What If Every Notification Cost You 23 Minutes?"
Stickman animated short · 2:39 · YouTube Shorts 9:16 (1080x1920) + regular 16:9 (1920x1080) · 30 fps
Produced 2026-11-09 by the Universal Animation Toolbook autonomous pipeline.

CONTENTS
  final.mp4                  Shorts master (9:16) — the deliverable
  renders/final_16x9.mp4     regular YouTube master (16:9)
  audio/master_mix.m4a       final mixed soundtrack (AAC 192k)
  *.md / *.json              full production archive: prompt, research, topic selection,
                             reference analysis, script (original+polished+changelog),
                             characters, storyboard, scene plan, voiceover, asset manifest,
                             production log, QA report
  assets/                    character sheets, 9:16 + 16:9 stills, QA frames from the master
  final_chapters.txt         YouTube chapter list

REPRODUCE FROM SOURCE (repo: Universal_Animation_Toolbook, branch arena/0c65af06-universal-animation-toolbook)
  python3 -m venv .venv && .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r universal_toolbook/requirements.txt pyyaml
  npm install --prefix universal_toolbook
  .venv/bin/python universal_toolbook/setup_tts.py          # Kokoro weights (Apache-2.0)
  .venv/bin/python tools/produce_video.py projects/video-001-twenty-three-minutes
  ~35 min on 2 CPUs. Tests: tests/production/test_ki007_aspect_pixels.py,
  test_ki008_mix_loudness.py, test_repo_hygiene.py, test_environment_readiness.py.

LICENCES
  Music: Scott Buckley "Where Stars Fall", "The Distant Sun", "The Restoration" (CC BY 4.0,
  attributed in-video); Loyalty Freak Music "Softly" (CC0). Voices: Kokoro-82M (Apache-2.0).
  All animation, script and boards original. QA evidence: QA_REPORT.md (every number measured).
