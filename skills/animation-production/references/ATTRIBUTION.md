# Source attribution and licence verification

## Sources considered

| Source | URL | Use made of it |
|---|---|---|
| Remotion documentation | `https://www.remotion.dev/docs` | identified the general concepts and API names listed in `remotion-techniques.md`; no text copied |
| Remotion Agent Skills repository | `https://github.com/remotion-dev/skills` | reviewed the supplied reference-file list; no file content copied into this repository |
| Remotion framework repository | `https://github.com/remotion-dev/remotion` | checked the repository licence metadata |

## Licence verification performed on 2026-11-09

The task brief stated "License information supplied: MIT" and required verification before
incorporating actual materials. Verification from the allowed GitHub endpoints returned:

- `GET https://api.github.com/repos/remotion-dev/skills` → `"license": null`.
- `GET https://api.github.com/repos/remotion-dev/skills/license` → HTTP 404 (no detected licence).
- `GET https://api.github.com/repos/remotion-dev/skills/contents/` → root contains `README.md`,
  `package.json`, `scripts/`, `skills/`, `tsconfig.json`; **no `LICENSE` file**.
- A source archive from `https://codeload.github.com/remotion-dev/skills/tar.gz/refs/heads/main`
  contains no `LICENSE`/`COPYING` file and no "MIT" string in its Markdown or JSON files.
- `GET https://api.github.com/repos/remotion-dev/remotion` → licence metadata is `NOASSERTION`
  ("Other"), not MIT.

**Conclusion:** the supplied MIT statement could not be confirmed for the actual upstream skill
materials. To avoid an unverified licence claim, **no upstream source text, code, or reference
file was copied**. All content under `skills/` is original prose written for this repository; the
Remotion names in `remotion-techniques.md` are used descriptively, as API identifiers. General
animation concepts (frame clocks, interpolation, easing, sequencing) are not copyrightable
implementations.

## Applicable notices

- This repository's original source has no declared upstream licence; see [`LICENSE`](../../../LICENSE).
- Bundled music and fonts retain their own licences:
  [`universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md`](../../../universal_toolbook/assets/bgm/CREATIVE_COMMONS_LICENSES.md).
- TTS model, voice and package licences are recorded in
  [`docs/production/TTS_BENCHMARK.md`](../../../docs/production/TTS_BENCHMARK.md) and
  [`deliverables/tts_benchmark/README.md`](../../../deliverables/tts_benchmark/README.md).
- If a future agent copies an upstream Remotion reference file, it must first verify the current
  upstream licence, include the required notice and attribution, and record the decision in a new
  ADR. Until then this repository carries no obligation to reproduce an MIT notice for copied
  code, because none was copied.
