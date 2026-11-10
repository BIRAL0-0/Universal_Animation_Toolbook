# PRODUCTION LOG — video-003-first-plank

- 2026-11-09 · Stage 1 input analysis: "another one" with no topic; automatic video-creation mode
  under `AGENTS.md` §3. Original 9:16 Short with a 16:9 secondary master; English narration.
- 2026-11-09 · Stage 2 research: dated evidence table, M / O / P labels, confidence column and
  rejected claims saved in `RESEARCH.md`. Page metadata only; no reference frames were claimed.
- 2026-11-09 · Stage 3 fact-checking: no measured number cleared for narration; all narration is
  original fable. See `RESEARCH.md` §5.
- 2026-11-09 · Stage 4 title/concept: "The First Plank", one thesis, one carried metaphor.
- 2026-11-09 · Stage 5 script: three short samples and a complete draft written in
  `runtime/work/video-003-first-plank/`; durable copies saved as `SCRIPT_ORIGINAL.md`.
- 2026-11-09 · Stage 6 polish: `docs/production/prompts/VOICEOVER_POLISH_PROMPT.md` applied exactly
  as stored; `SCRIPT_POLISHED.md` and `SCRIPT_CHANGELOG.md` saved. No word-level change required
  user approval because no user script was supplied.
- 2026-11-09 · Stage 7 production prompt: `PROMPT.md` customised from the master template and saved
  before final `episode.json`, stills, audio or renders.
- 2026-11-09 · Stage 8 storyboard: `STORYBOARD.md` saved with objective, action, camera, board,
  narration segment, SFX and transition for all seven scenes.
- 2026-11-09 · Stage 9 characters/assets: `CHARACTERS.md` mirrors `cast`; `ASSET_MANIFEST.json`
  records four CC tracks, Kokoro, bundled fonts and procedural SFX.
- 2026-11-09 · Stage 10 scene production: `episode.json` authored; `SCENE_PLAN.json` derived with
  `tools/make_scene_plan.py`.
- 2026-11-09 · Stage 11 animation: supported actions, boards, props, camera cuts and accent words
  authored in `episode.json`; no static-pose-plus-zoom scene.
- 2026-11-09 · Stage 12 voiceover: `am_michael` configured. Voiced render and report read pending.
- 2026-11-09 · Stage 13 music/SFX: `dynamic` BGM with per-act tracks and supported foley authored.
- 2026-11-09 · Stage 14 synchronisation: multi-word `cue_on` phrases for boards and camera shots
  authored; exact timings are resolved from measured Kokoro word timings by the renderer.
- 2026-11-10 · **Workspace recovery:** the session workspace was reset to the base commit and all
  uncommitted video-003 artifacts were lost. The project was rebuilt from the preserved session
  record. The 42-line script was re-authored from the recorded scene objectives, chapter labels,
  board texts and exact closing question; `SCRIPT_CHANGELOG.md` records this explicitly. This is a
  faithful reconstruction, not a byte-for-byte recovery of the earlier uncommitted files.
- 2026-11-10 · **S07 board timing correction:** the original S07 board used the same phrase for
  `cue_on` and `hide_on`, so it revealed near the end of the film and was already fading at
  cue + 1.6 s. It now reveals on "The bridge was not shorter" and hides on "Then she looked at
  you", giving a full-opacity reading window before the closing question.
- 2026-11-10 · **Chapter-label verification:** the engine generates chapters from each scene's
  singular `chapter` field. All seven original chapter titles are intentional; the earlier stray
  `CHAPTER SIX | CROSSING THE CANYON` card in S07's inert scene-local `chapters` array was
  removed. `CHAPTER SEVEN | THE OTHER SIDE` is the intended S07 card, not a defect.
- 2026-11-10 · **Runtime wording reconciliation:** scratch notes targeted 110–130 s, `PROMPT.md`
  says approximately 150 s, the authored spec is 140 s, and the final voiced master is retimed
  from real Kokoro speech to **126.038 s** (`QA_REPORT.md`). All are within the ≤180 s Shorts
  limit; authored durations are planning values, not measured output.
- 2026-11-10 · Stages 15–20: render, inspection, correction, export, archiving and reusable
  improvement are recorded below from produced reports and commands.

## Deviations and delegated gates

- `COMPLETE_WORKFLOW.md` Stage 3 (user selects idea), Stage 4 (user picks sample direction) and
  Stage 6 (user approves narration) are hard human gates. Because `AGENTS.md` §3 says a bare video
  request activates the full workflow and ordinary implementation decisions must not interrupt the
  user, these three gates were resolved by the agent's documented automatic-mode authority. The
  scored shortlist, samples and decisions were saved before the project prompt. No user-supplied
  words were changed.
- No `channel_name` key, watermark or branding is used.
- No secondary voice is used: the fable has one speaking narrator and one silent actor. `af_bella`
  remains the configured preferred secondary voice but is not assigned.
- Subjective audio listening and full-film subjective review are not claimed. QA reports only
  measured container/audio values and frames actually inspected.
- Publishing is not authorised; no upload or YouTube API action will be taken.

## Run records

`tools/produce_video.py` appends ordered run records below this section.
## Run 2026-11-10 01:15:45

```
[2026-11-10 01:04:28] episode spec changed -> cleared stale .work_* render caches (9ce521e061e9)
[2026-11-10 01:04:28] STAGE A — validate (gate: warnings must be [])
[2026-11-10 01:04:28] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json
[2026-11-10 01:04:28]       "accent_colors_used": [
[2026-11-10 01:04:28]         "#22d3ee",
[2026-11-10 01:04:28]         "#34d399",
[2026-11-10 01:04:28]         "#60a5fa",
[2026-11-10 01:04:28]         "#93c5fd",
[2026-11-10 01:04:28]         "#a78bfa",
[2026-11-10 01:04:28]         "#f87171",
[2026-11-10 01:04:28]         "#fbbf24"
[2026-11-10 01:04:28]       ],
[2026-11-10 01:04:28]       "sound_events": 49,
[2026-11-10 01:04:28]       "warnings": []
[2026-11-10 01:04:28]     }
[2026-11-10 01:04:28] validate OK — 140s, 7 scenes, 49 sound events, warnings []
[2026-11-10 01:04:28] STAGE B/C — stills 9x16
[2026-11-10 01:04:28] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py stills /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json --out-dir /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_9x16 --width 1080 --height 1920
[2026-11-10 01:04:30]           "environment": "sunrise_summit",
[2026-11-10 01:04:30]           "frame": 3348,
[2026-11-10 01:04:30]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_9x16/S06_sunrise_summit.png"
[2026-11-10 01:04:30]         },
[2026-11-10 01:04:30]         {
[2026-11-10 01:04:30]           "sceneId": "S07",
[2026-11-10 01:04:30]           "environment": "sunrise_summit",
[2026-11-10 01:04:30]           "frame": 3948,
[2026-11-10 01:04:30]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_9x16/S07_sunrise_summit.png"
[2026-11-10 01:04:30]         }
[2026-11-10 01:04:30]       ]
[2026-11-10 01:04:30]     }
[2026-11-10 01:04:30] stills 9x16: 7 frames in assets/stills_9x16
[2026-11-10 01:04:30] STAGE B/C — stills 16x9
[2026-11-10 01:04:30] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py stills /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json --out-dir /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_16x9 --width 1920 --height 1080
[2026-11-10 01:04:32]           "environment": "sunrise_summit",
[2026-11-10 01:04:32]           "frame": 3348,
[2026-11-10 01:04:32]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_16x9/S06_sunrise_summit.png"
[2026-11-10 01:04:32]         },
[2026-11-10 01:04:32]         {
[2026-11-10 01:04:32]           "sceneId": "S07",
[2026-11-10 01:04:32]           "environment": "sunrise_summit",
[2026-11-10 01:04:32]           "frame": 3948,
[2026-11-10 01:04:32]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/stills_16x9/S07_sunrise_summit.png"
[2026-11-10 01:04:32]         }
[2026-11-10 01:04:32]       ]
[2026-11-10 01:04:32]     }
[2026-11-10 01:04:32] stills 16x9: 7 frames in assets/stills_16x9
[2026-11-10 01:04:32] STAGE D — draft render 9:16
[2026-11-10 01:04:32] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json --shorts --draft --voice auto --workers 2 --chunk-sec 20 --out /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/renders/draft_9x16.mp4
[2026-11-10 01:07:12]               ],
[2026-11-10 01:07:12]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-10 01:07:12]               "duration_sec": 178.33,
[2026-11-10 01:07:12]               "size_mb": 2.04
[2026-11-10 01:07:12]             }
[2026-11-10 01:07:12]           ],
[2026-11-10 01:07:12]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-10 01:07:12]         }
[2026-11-10 01:07:12]       },
[2026-11-10 01:07:12]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/renders/draft_9x16_chapters.txt",
[2026-11-10 01:07:12]       "elapsed_sec": 160.1
[2026-11-10 01:07:12]     }
[2026-11-10 01:07:12] draft OK — 13.4 MB
[2026-11-10 01:07:12] STAGE E — master 9:16 (final.mp4)
[2026-11-10 01:07:12] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json --shorts --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4
[2026-11-10 01:12:32]               ],
[2026-11-10 01:12:32]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-10 01:12:32]               "duration_sec": 178.33,
[2026-11-10 01:12:32]               "size_mb": 2.04
[2026-11-10 01:12:32]             }
[2026-11-10 01:12:32]           ],
[2026-11-10 01:12:32]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-10 01:12:32]         }
[2026-11-10 01:12:32]       },
[2026-11-10 01:12:32]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final_chapters.txt",
[2026-11-10 01:12:32]       "elapsed_sec": 319.99
[2026-11-10 01:12:32]     }
[2026-11-10 01:12:32] master validation OK: [1080, 1920] @ 9:16, voice_backend=kokoro-offline:am_michael
[2026-11-10 01:12:32] STAGE F — master 16:9
[2026-11-10 01:12:32] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/episode.json --aspect-ratio 16:9 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/renders/final_16x9.mp4
[2026-11-10 01:15:38]               ],
[2026-11-10 01:15:38]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-10 01:15:38]               "duration_sec": 178.33,
[2026-11-10 01:15:38]               "size_mb": 2.04
[2026-11-10 01:15:38]             }
[2026-11-10 01:15:38]           ],
[2026-11-10 01:15:38]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-10 01:15:38]         }
[2026-11-10 01:15:38]       },
[2026-11-10 01:15:38]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/renders/final_16x9_chapters.txt",
[2026-11-10 01:15:38]       "elapsed_sec": 185.34
[2026-11-10 01:15:38]     }
[2026-11-10 01:15:38] master 9:16 OK — 12.9 MB; 16:9 ok=True
[2026-11-10 01:15:38] STAGE G — measure mixed audio
[2026-11-10 01:15:38] audio: 126.04s peak -1.22 dBFS rms -17.5 dBFS (targets peak -3..-1, rms -16..-19)
[2026-11-10 01:15:38] STAGE H — extract QA frames from final.mp4
[2026-11-10 01:15:38] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 5.04 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t005.04.png
[2026-11-10 01:15:38] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 20.16 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t020.16.png
[2026-11-10 01:15:38] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 37.81 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t037.81.png
[2026-11-10 01:15:38] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 56.71 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t056.71.png
[2026-11-10 01:15:39] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 75.62 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t075.62.png
[2026-11-10 01:15:39] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 94.52 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t094.52.png
[2026-11-10 01:15:39] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 110.91 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t110.91.png
[2026-11-10 01:15:39] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 122.25 -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/assets/qa_frames/t122.25.png
[2026-11-10 01:15:40] extracted 8 QA frames over 126.03s
[2026-11-10 01:15:40] STAGE I — verify container + full decode
[2026-11-10 01:15:40] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -hide_banner -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4
[2026-11-10 01:15:40]   !     minor_version   : 512
[2026-11-10 01:15:40]   !     compatible_brands: isomiso2avc1mp41
[2026-11-10 01:15:40]   !     encoder         : Lavf63.1.102
[2026-11-10 01:15:40]   !   Duration: 00:02:06.03, start: 0.000000, bitrate: 819 kb/s
[2026-11-10 01:15:40]   !   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920, 615 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
[2026-11-10 01:15:40]   !     Metadata:
[2026-11-10 01:15:40]   !       handler_name    : VideoHandler
[2026-11-10 01:15:40]   !       encoder         : Lavc63.1.102 libx264
[2026-11-10 01:15:40]   !   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 196 kb/s (default)
[2026-11-10 01:15:40]   !     Metadata:
[2026-11-10 01:15:40]   !       handler_name    : SoundHandler
[2026-11-10 01:15:40]   ! At least one output file must be specified
[2026-11-10 01:15:40] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -i /home/user/Universal_Animation_Toolbook/projects/video-003-first-plank/final.mp4 -f null -
[2026-11-10 01:15:45] verify: 1080x1920 @ 30 fps, full_decode_ok=True
```

