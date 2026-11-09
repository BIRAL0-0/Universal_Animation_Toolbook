# PRODUCTION LOG — video-001-twenty-three-minutes

Appended run records, newest last.

## Run 2026-11-09 07:37:55

```
[2026-11-09 07:34:53] STAGE A — validate (gate: warnings must be [])
[2026-11-09 07:34:53] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json
[2026-11-09 07:34:53]       "accent_colors_used": [
[2026-11-09 07:34:53]         "#22d3ee",
[2026-11-09 07:34:53]         "#34d399",
[2026-11-09 07:34:53]         "#38bdf8",
[2026-11-09 07:34:53]         "#64748b",
[2026-11-09 07:34:53]         "#f59e0b",
[2026-11-09 07:34:53]         "#fb7185",
[2026-11-09 07:34:53]         "#fbbf24"
[2026-11-09 07:34:53]       ],
[2026-11-09 07:34:53]       "sound_events": 77,
[2026-11-09 07:34:53]       "warnings": []
[2026-11-09 07:34:53]     }
[2026-11-09 07:34:53] validate OK — 164s, 10 scenes, 77 sound events, warnings []
[2026-11-09 07:34:53] STAGE B/C — stills 9x16
[2026-11-09 07:34:53] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py stills /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --out-dir /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_9x16 --width 1080 --height 1920
[2026-11-09 07:34:56]           "environment": "modern_office",
[2026-11-09 07:34:56]           "frame": 4143,
[2026-11-09 07:34:56]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_9x16/S09_modern_office.png"
[2026-11-09 07:34:56]         },
[2026-11-09 07:34:56]         {
[2026-11-09 07:34:56]           "sceneId": "S10",
[2026-11-09 07:34:56]           "environment": "sunrise_summit",
[2026-11-09 07:34:56]           "frame": 4668,
[2026-11-09 07:34:56]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_9x16/S10_sunrise_summit.png"
[2026-11-09 07:34:56]         }
[2026-11-09 07:34:56]       ]
[2026-11-09 07:34:56]     }
[2026-11-09 07:34:56] stills 9x16: 10 frames in assets/stills_9x16
[2026-11-09 07:34:56] STAGE B/C — stills 16x9
[2026-11-09 07:34:56] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py stills /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --out-dir /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_16x9 --width 1920 --height 1080
[2026-11-09 07:34:58]           "environment": "modern_office",
[2026-11-09 07:34:58]           "frame": 4143,
[2026-11-09 07:34:58]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_16x9/S09_modern_office.png"
[2026-11-09 07:34:58]         },
[2026-11-09 07:34:58]         {
[2026-11-09 07:34:58]           "sceneId": "S10",
[2026-11-09 07:34:58]           "environment": "sunrise_summit",
[2026-11-09 07:34:58]           "frame": 4668,
[2026-11-09 07:34:58]           "path": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/stills_16x9/S10_sunrise_summit.png"
[2026-11-09 07:34:58]         }
[2026-11-09 07:34:58]       ]
[2026-11-09 07:34:58]     }
[2026-11-09 07:34:58] stills 16x9: 10 frames in assets/stills_16x9
[2026-11-09 07:34:58] STAGE D — draft render 9:16
[2026-11-09 07:34:58] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --shorts --draft --voice auto --workers 2 --chunk-sec 20 --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/draft_9x16.mp4
[2026-11-09 07:37:55]               ],
[2026-11-09 07:37:55]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 07:37:55]               "duration_sec": 178.33,
[2026-11-09 07:37:55]               "size_mb": 2.04
[2026-11-09 07:37:55]             }
[2026-11-09 07:37:55]           ],
[2026-11-09 07:37:55]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 07:37:55]         }
[2026-11-09 07:37:55]       },
[2026-11-09 07:37:55]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/draft_9x16_chapters.txt",
[2026-11-09 07:37:55]       "elapsed_sec": 176.72
[2026-11-09 07:37:55]     }
[2026-11-09 07:37:55] draft OK — 10.2 MB
```

## Run 2026-11-09 07:59:30

```
[2026-11-09 07:54:55] STAGE A — validate (gate: warnings must be [])
[2026-11-09 07:54:55] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json
[2026-11-09 07:54:55]       "accent_colors_used": [
[2026-11-09 07:54:55]         "#22d3ee",
[2026-11-09 07:54:55]         "#34d399",
[2026-11-09 07:54:55]         "#38bdf8",
[2026-11-09 07:54:55]         "#64748b",
[2026-11-09 07:54:55]         "#f59e0b",
[2026-11-09 07:54:55]         "#fb7185",
[2026-11-09 07:54:55]         "#fbbf24"
[2026-11-09 07:54:55]       ],
[2026-11-09 07:54:55]       "sound_events": 77,
[2026-11-09 07:54:55]       "warnings": []
[2026-11-09 07:54:55]     }
[2026-11-09 07:54:55] validate OK — 164s, 10 scenes, 77 sound events, warnings []
[2026-11-09 07:54:55] STAGE E — master 9:16 (final.mp4)
[2026-11-09 07:54:55] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --shorts --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 07:55:12]               ],
[2026-11-09 07:55:12]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 07:55:12]               "duration_sec": 178.33,
[2026-11-09 07:55:12]               "size_mb": 2.04
[2026-11-09 07:55:12]             }
[2026-11-09 07:55:12]           ],
[2026-11-09 07:55:12]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 07:55:12]         }
[2026-11-09 07:55:12]       },
[2026-11-09 07:55:12]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final_chapters.txt",
[2026-11-09 07:55:12]       "elapsed_sec": 16.89
[2026-11-09 07:55:12]     }
[2026-11-09 07:55:12] master validation OK: [1080, 1920] @ 9:16, voice_backend=kokoro-offline:af_bella,am_liam,am_michael
[2026-11-09 07:55:12] STAGE F — master 16:9
[2026-11-09 07:55:12] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --aspect-ratio 16:9 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9.mp4
[2026-11-09 07:59:19]               ],
[2026-11-09 07:59:19]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 07:59:19]               "duration_sec": 178.33,
[2026-11-09 07:59:19]               "size_mb": 2.04
[2026-11-09 07:59:19]             }
[2026-11-09 07:59:19]           ],
[2026-11-09 07:59:19]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 07:59:19]         }
[2026-11-09 07:59:19]       },
[2026-11-09 07:59:19]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9_chapters.txt",
[2026-11-09 07:59:19]       "elapsed_sec": 246.87
[2026-11-09 07:59:19]     }
[2026-11-09 07:59:19] master 9:16 OK — 14.3 MB; 16:9 ok=True
[2026-11-09 07:59:19] STAGE G — measure mixed audio
[2026-11-09 07:59:19] WARNING: no mixed WAV found to measure
[2026-11-09 07:59:19] STAGE H — extract QA frames from final.mp4
[2026-11-09 07:59:19] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 6.36 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t006.36.png
[2026-11-09 07:59:20] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 25.43 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t025.43.png
[2026-11-09 07:59:20] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 47.69 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t047.69.png
[2026-11-09 07:59:20] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 71.53 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t071.53.png
[2026-11-09 07:59:21] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 95.38 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t095.38.png
[2026-11-09 07:59:21] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 119.22 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t119.22.png
[2026-11-09 07:59:22] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 139.88 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t139.88.png
[2026-11-09 07:59:22] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 154.19 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t154.19.png
[2026-11-09 07:59:22] extracted 8 QA frames over 158.96s
[2026-11-09 07:59:22] STAGE I — verify container + full decode
[2026-11-09 07:59:22] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -hide_banner -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 07:59:22]   !     minor_version   : 512
[2026-11-09 07:59:22]   !     compatible_brands: isomiso2avc1mp41
[2026-11-09 07:59:22]   !     encoder         : Lavf63.1.102
[2026-11-09 07:59:22]   !   Duration: 00:02:38.96, start: 0.000000, bitrate: 717 kb/s
[2026-11-09 07:59:22]   !   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920, 513 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
[2026-11-09 07:59:22]   !     Metadata:
[2026-11-09 07:59:22]   !       handler_name    : VideoHandler
[2026-11-09 07:59:22]   !       encoder         : Lavc63.1.102 libx264
[2026-11-09 07:59:22]   !   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 195 kb/s (default)
[2026-11-09 07:59:22]   !     Metadata:
[2026-11-09 07:59:22]   !       handler_name    : SoundHandler
[2026-11-09 07:59:22]   ! At least one output file must be specified
[2026-11-09 07:59:22] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -f null -
[2026-11-09 07:59:30] verify: 1080x1920 @ 30 fps, full_decode_ok=True
```

## Run 2026-11-09 07:59:57

```
[2026-11-09 07:59:56] STAGE A — validate (gate: warnings must be [])
[2026-11-09 07:59:56] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json
[2026-11-09 07:59:57]       "accent_colors_used": [
[2026-11-09 07:59:57]         "#22d3ee",
[2026-11-09 07:59:57]         "#34d399",
[2026-11-09 07:59:57]         "#38bdf8",
[2026-11-09 07:59:57]         "#64748b",
[2026-11-09 07:59:57]         "#f59e0b",
[2026-11-09 07:59:57]         "#fb7185",
[2026-11-09 07:59:57]         "#fbbf24"
[2026-11-09 07:59:57]       ],
[2026-11-09 07:59:57]       "sound_events": 77,
[2026-11-09 07:59:57]       "warnings": []
[2026-11-09 07:59:57]     }
[2026-11-09 07:59:57] validate OK — 164s, 10 scenes, 77 sound events, warnings []
[2026-11-09 07:59:57] STAGE G — measure mixed audio
[2026-11-09 07:59:57] audio: 158.96s peak -1.72 dBFS rms -24.07 dBFS (targets peak -3..-1, rms -16..-19)
```

## Run 2026-11-09 08:02:10

```
[2026-11-09 08:01:23] STAGE A — validate (gate: warnings must be [])
[2026-11-09 08:01:23] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json
[2026-11-09 08:01:23]       "accent_colors_used": [
[2026-11-09 08:01:23]         "#22d3ee",
[2026-11-09 08:01:23]         "#34d399",
[2026-11-09 08:01:23]         "#38bdf8",
[2026-11-09 08:01:23]         "#64748b",
[2026-11-09 08:01:23]         "#f59e0b",
[2026-11-09 08:01:23]         "#fb7185",
[2026-11-09 08:01:23]         "#fbbf24"
[2026-11-09 08:01:23]       ],
[2026-11-09 08:01:23]       "sound_events": 77,
[2026-11-09 08:01:23]       "warnings": []
[2026-11-09 08:01:23]     }
[2026-11-09 08:01:23] validate OK — 164s, 10 scenes, 77 sound events, warnings []
[2026-11-09 08:01:23] STAGE E — master 9:16 (final.mp4)
[2026-11-09 08:01:23] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --shorts --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 08:01:41]               ],
[2026-11-09 08:01:41]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 08:01:41]               "duration_sec": 178.33,
[2026-11-09 08:01:41]               "size_mb": 2.04
[2026-11-09 08:01:41]             }
[2026-11-09 08:01:41]           ],
[2026-11-09 08:01:41]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 08:01:41]         }
[2026-11-09 08:01:41]       },
[2026-11-09 08:01:41]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final_chapters.txt",
[2026-11-09 08:01:41]       "elapsed_sec": 17.43
[2026-11-09 08:01:41]     }
[2026-11-09 08:01:41] master validation OK: [1080, 1920] @ 9:16, voice_backend=kokoro-offline:af_bella,am_liam,am_michael
[2026-11-09 08:01:41] STAGE F — master 16:9
[2026-11-09 08:01:41] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --aspect-ratio 16:9 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9.mp4
[2026-11-09 08:01:58]               ],
[2026-11-09 08:01:58]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 08:01:58]               "duration_sec": 178.33,
[2026-11-09 08:01:58]               "size_mb": 2.04
[2026-11-09 08:01:58]             }
[2026-11-09 08:01:58]           ],
[2026-11-09 08:01:58]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 08:01:58]         }
[2026-11-09 08:01:58]       },
[2026-11-09 08:01:58]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9_chapters.txt",
[2026-11-09 08:01:58]       "elapsed_sec": 17.25
[2026-11-09 08:01:58]     }
[2026-11-09 08:01:58] master 9:16 OK — 14.3 MB; 16:9 ok=True
[2026-11-09 08:01:58] STAGE G — measure mixed audio
[2026-11-09 08:01:58] audio: 158.96s peak -1.01 dBFS rms -23.37 dBFS (targets peak -3..-1, rms -16..-19)
[2026-11-09 08:01:58] STAGE H — extract QA frames from final.mp4
[2026-11-09 08:01:58] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 6.36 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t006.36.png
[2026-11-09 08:01:59] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 25.43 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t025.43.png
[2026-11-09 08:01:59] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 47.69 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t047.69.png
[2026-11-09 08:01:59] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 71.53 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t071.53.png
[2026-11-09 08:02:00] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 95.38 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t095.38.png
[2026-11-09 08:02:00] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 119.22 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t119.22.png
[2026-11-09 08:02:01] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 139.88 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t139.88.png
[2026-11-09 08:02:01] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 154.19 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t154.19.png
[2026-11-09 08:02:01] extracted 8 QA frames over 158.96s
[2026-11-09 08:02:01] STAGE I — verify container + full decode
[2026-11-09 08:02:01] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -hide_banner -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 08:02:01]   !     minor_version   : 512
[2026-11-09 08:02:01]   !     compatible_brands: isomiso2avc1mp41
[2026-11-09 08:02:01]   !     encoder         : Lavf63.1.102
[2026-11-09 08:02:01]   !   Duration: 00:02:38.96, start: 0.000000, bitrate: 717 kb/s
[2026-11-09 08:02:01]   !   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920, 513 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
[2026-11-09 08:02:01]   !     Metadata:
[2026-11-09 08:02:01]   !       handler_name    : VideoHandler
[2026-11-09 08:02:01]   !       encoder         : Lavc63.1.102 libx264
[2026-11-09 08:02:01]   !   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 195 kb/s (default)
[2026-11-09 08:02:01]   !     Metadata:
[2026-11-09 08:02:01]   !       handler_name    : SoundHandler
[2026-11-09 08:02:01]   ! At least one output file must be specified
[2026-11-09 08:02:01] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -f null -
[2026-11-09 08:02:10] verify: 1080x1920 @ 30 fps, full_decode_ok=True
```

## Run 2026-11-09 08:05:59

```
[2026-11-09 08:05:02] STAGE A — validate (gate: warnings must be [])
[2026-11-09 08:05:02] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py validate /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json
[2026-11-09 08:05:03]       "accent_colors_used": [
[2026-11-09 08:05:03]         "#22d3ee",
[2026-11-09 08:05:03]         "#34d399",
[2026-11-09 08:05:03]         "#38bdf8",
[2026-11-09 08:05:03]         "#64748b",
[2026-11-09 08:05:03]         "#f59e0b",
[2026-11-09 08:05:03]         "#fb7185",
[2026-11-09 08:05:03]         "#fbbf24"
[2026-11-09 08:05:03]       ],
[2026-11-09 08:05:03]       "sound_events": 77,
[2026-11-09 08:05:03]       "warnings": []
[2026-11-09 08:05:03]     }
[2026-11-09 08:05:03] validate OK — 164s, 10 scenes, 77 sound events, warnings []
[2026-11-09 08:05:03] STAGE E — master 9:16 (final.mp4)
[2026-11-09 08:05:03] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --shorts --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 08:05:25]               ],
[2026-11-09 08:05:25]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 08:05:25]               "duration_sec": 178.33,
[2026-11-09 08:05:25]               "size_mb": 2.04
[2026-11-09 08:05:25]             }
[2026-11-09 08:05:25]           ],
[2026-11-09 08:05:25]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 08:05:25]         }
[2026-11-09 08:05:25]       },
[2026-11-09 08:05:25]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final_chapters.txt",
[2026-11-09 08:05:25]       "elapsed_sec": 22.06
[2026-11-09 08:05:25]     }
[2026-11-09 08:05:25] master validation OK: [1080, 1920] @ 9:16, voice_backend=kokoro-offline:af_bella,am_liam,am_michael
[2026-11-09 08:05:25] STAGE F — master 16:9
[2026-11-09 08:05:25] $ /home/user/Universal_Animation_Toolbook/.venv/bin/python /home/user/Universal_Animation_Toolbook/universal_toolbook/run_studio.py render /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/episode.json --aspect-ratio 16:9 --full --preset veryfast --crf 24 --chunk-sec 45 --workers 2 --resume --voice auto --out /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9.mp4
[2026-11-09 08:05:48]               ],
[2026-11-09 08:05:48]               "description": "Uplifting cinematic strings and horizon resolve for inspirational arcs, breakthroughs, and triumphant storytelling.",
[2026-11-09 08:05:48]               "duration_sec": 178.33,
[2026-11-09 08:05:48]               "size_mb": 2.04
[2026-11-09 08:05:48]             }
[2026-11-09 08:05:48]           ],
[2026-11-09 08:05:48]           "credits_text": "Music: \"Where Stars Fall\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_Where_Stars_Fall.oga\nMusic: \"Softly\" by Loyalty Freak Music (CC0 1.0 Public Domain) \u2014 https://commons.wikimedia.org/wiki/File:Loyalty_Freak_Music_-_06_-_Softly.ogg\nMusic: \"The Distant Sun (Monomyth 1)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Distant_Sun_(Monomyth_1).oga\nMusic: \"The Restoration (Monomyth 12)\" by Scott Buckley (CC BY 4.0) \u2014 https://commons.wikimedia.org/wiki/File:Scott_Buckley_-_The_Restoration_(Monomyth_12).oga"
[2026-11-09 08:05:48]         }
[2026-11-09 08:05:48]       },
[2026-11-09 08:05:48]       "chapters_file": "/home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/renders/final_16x9_chapters.txt",
[2026-11-09 08:05:48]       "elapsed_sec": 22.3
[2026-11-09 08:05:48]     }
[2026-11-09 08:05:48] master 9:16 OK — 14.3 MB; 16:9 ok=True
[2026-11-09 08:05:48] STAGE G — measure mixed audio
[2026-11-09 08:05:48] audio: 158.96s peak -1.17 dBFS rms -17.5 dBFS (targets peak -3..-1, rms -16..-19)
[2026-11-09 08:05:48] STAGE H — extract QA frames from final.mp4
[2026-11-09 08:05:48] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 6.36 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t006.36.png
[2026-11-09 08:05:48] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 25.43 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t025.43.png
[2026-11-09 08:05:48] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 47.69 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t047.69.png
[2026-11-09 08:05:49] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 71.53 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t071.53.png
[2026-11-09 08:05:49] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 95.38 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t095.38.png
[2026-11-09 08:05:50] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 119.22 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t119.22.png
[2026-11-09 08:05:50] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 139.88 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t139.88.png
[2026-11-09 08:05:50] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -ss 154.19 -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -frames:v 1 -y /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/assets/qa_frames/t154.19.png
[2026-11-09 08:05:50] extracted 8 QA frames over 158.96s
[2026-11-09 08:05:50] STAGE I — verify container + full decode
[2026-11-09 08:05:50] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -hide_banner -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4
[2026-11-09 08:05:50]   !     minor_version   : 512
[2026-11-09 08:05:50]   !     compatible_brands: isomiso2avc1mp41
[2026-11-09 08:05:50]   !     encoder         : Lavf63.1.102
[2026-11-09 08:05:50]   !   Duration: 00:02:38.96, start: 0.000000, bitrate: 718 kb/s
[2026-11-09 08:05:50]   !   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1080x1920, 513 kb/s, 30 fps, 30 tbr, 15360 tbn (default)
[2026-11-09 08:05:50]   !     Metadata:
[2026-11-09 08:05:50]   !       handler_name    : VideoHandler
[2026-11-09 08:05:50]   !       encoder         : Lavc63.1.102 libx264
[2026-11-09 08:05:50]   !   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 196 kb/s (default)
[2026-11-09 08:05:50]   !     Metadata:
[2026-11-09 08:05:50]   !       handler_name    : SoundHandler
[2026-11-09 08:05:50]   ! At least one output file must be specified
[2026-11-09 08:05:50] $ /home/user/Universal_Animation_Toolbook/.venv/lib/python3.11/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2 -v error -i /home/user/Universal_Animation_Toolbook/projects/video-001-twenty-three-minutes/final.mp4 -f null -
[2026-11-09 08:05:59] verify: 1080x1920 @ 30 fps, full_decode_ok=True
```


---

## 2026-11-09 · Master production run — COMPLETE, QA PASS

**Pipeline:** `tools/produce_video.py` (validate → stills → draft → master 9:16 → master 16:9 →
measure → frames → verify). Draft 540×960/158.96 s; masters **1080×1920** and **1920×1080**, both
30 fps, full-decode clean, `dimensions_match_aspect: true`, validate warnings `[]`.

**Audio:** Kokoro offline — Bella `af_bella` (narrator), Michael `am_michael` (Kai), Liam `am_liam`
(Sam). Measured from the mixed WAV: peak **−1.17 dBFS**, RMS **−17.50 dBFS** (house band
peak −3…−1 / RMS −16…−19), 0 near-silent 1 s windows. BGM: 3× Scott Buckley CC BY 4.0 + Loyalty
Freak CC0, credited in-video and in `final_report.json`.

**Deviations from the project prompt (recorded per Part 8):**
1. *Portrait overrides removed (KI-009).* The prompt/STORYBOARD originally prescribed
   `portrait_focus*` + board `portrait_w/_x` overrides. Draft QA frames proved they clipped Kai
   (S01) or removed him (S05); engine defaults (auto-focus + `fitBoardToPortraitViewport`) frame
   both characters and boards correctly. All 38 overrides deleted; STORYBOARD rows rewritten.
2. *Loudness normalisation added mid-production (KI-008 / PC-010).* First master measured RMS
   −24.07 dBFS. Diagnosed 22 dB crest factor; fixed in the shared engine (fast peak limiter +
   bounded make-up), not per-video. Masters re-rendered and re-measured in band.
3. *Board QA method (KI-003).* Boards are cue-locked to narration, so stills cannot show them;
   boards were QA'd from draft/master frames at `board_pop + 1.6 s` instead. Timestamps:
   7.13, 25.43, 52.26, 71.53, 77.37, 95.38, 104.52, 119.22, 139.88, 154.19 s (see QA_REPORT §4).

**Verification:** 8 final-master QA frames opened and inspected (QA_REPORT §4 table); ffprobe +
full decode; loudness measured with wave/audioop; tests: `test_ki007_aspect_pixels.py` 6/6,
`test_ki008_mix_loudness.py` 4/4, `test_repo_hygiene.py` 6/6, engine suite PASSED.
