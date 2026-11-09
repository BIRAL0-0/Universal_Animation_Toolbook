# QA report

- Episode validation: 9 scenes, warnings `[]`.
- Studio render reports COMPLETE, 1920×1080, 30 fps, 404.942 s, Kokoro offline, 9 voiced scenes, no render warnings, peak -3.56 dBFS and RMS -17.5 dBFS.
- Full video/audio stream decode with imageio-ffmpeg completed without reported errors.
- Nine authored representative stills and two final-render frames inspected, not a complete watch-through. No listening test was performed; voice pronunciation, mixing, synchronization and animation throughout remain unverified.
- Runtime is 6:45, below the user's 7–9 minute estimate due to speech-locked retiming. The existing spec adapts staging to the engine's cel animation; it does not reproduce every visual direction literally.
- Repo hygiene 6/6, engine tests and studio pipeline tests passed. The docs checker originally found five stale references to removed examples; these were corrected and the checker now passes.
- Master SHA-256: `577f4ebe443925b86de7664ebb54cd2110b3ec64f95fd5a12f281de623dce41c`.
