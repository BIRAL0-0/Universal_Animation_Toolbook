---
name: environment-and-asset-continuity
description: "Maintain the locked near-black minimal studio visual identity, canonical furniture/prop asset definitions, restrained slate palettes, and shot-to-shot prop placement and moved-state continuity."
---

# Skill: environment-and-asset-continuity

## Purpose

Protect visual coherence across every scene and camera cut by enforcing the locked near-black minimal stage (`universal_toolbook/engine/environments.js` + `universal_toolbook/config/studio_config.json`), canonical prop geometry (`CANONICAL_ASSET_LIBRARY` in `universal_toolbook/engine/world_props_and_boards.js`), and cross-shot asset persistence (`propRegistry` in `universal_toolbook/engine/episode.js`).

## Trigger Conditions

## Inputs

The location ID, the props in play across the cuts being checked, and the canonical asset definitions. Continuity needs at least two shots to be meaningful.

Activate whenever:
- choosing scene `environment` or `setting` values in `episode.json`,
- placing or styling furniture and props (`phone`, `laptop`, `computer`, `desk`, `chair`, `bed`, `sofa`, `table`, `door`, `window`, `books`, `cup`),
- cutting between shots within the same room or location (`location_id`),
- editing `universal_toolbook/engine/environments.js`, `universal_toolbook/engine/world_props_and_boards.js`, or `universal_toolbook/engine/episode.js`.

## Core Rules & Non-Negotiable Constraints

1. **Locked near-black minimal studio background.** `studio_config.json` sets `visual_identity.mode: "near_black_minimal"` and `lock_identity: true`. `drawEnvironment` renders `renderNearBlackBackground` (`#080a0f -> #0b0e16 -> #07090e` sky gradient, `#06080d -> #04060a` floor plane, subtle `#94a3b8` horizon grounding line, zero film grain). Never introduce random per-scene background colour shifts.

   **The only way to leave the near-black default is a per-scene `setting` block with
   `override_visual_identity: true`.** There is no `allow_custom_backdrop` flag anywhere in the
   engine — earlier versions of this skill named one, and setting it did nothing, silently. The
   gate is `DEFAULT_VISUAL_IDENTITY.lock_identity` in `universal_toolbook/engine/environments.js`
   (line ~923); every preset environment *and* every custom `setting` collapses to
   `renderNearBlackBackground` without that key.

   ```json
   "setting": {
     "backdrop": "mountains",            // mountains | hills | horizon | desert | forest | city
                                          // | grid | arches | pillars | shelves | windows | pure_black
     "sky": ["#070d1a", "#152238", "#6b4423"],   // 2+ colour gradient stops
     "stars": true,                       // or "rain": true, "rain_intensity": 0.8
     "override_visual_identity": true,    // REQUIRED or the block is ignored
     "light_color": "#cbd5e1", "floor_color": "#06080d"
   }
   ```

   **A preset environment does not draw scenery.** `canyon_bridge`, `storm_road` and
   `sunrise_summit` are colour themes only — a canyon scene using `"environment": "canyon_bridge"`
   renders as a bare room with a slightly different tint. If the script says canyon, rain or
   sunrise, you must use a `setting` block. `the-first-plank` shipped for a full production cycle
   looking like an office for exactly this reason.
2. **Canonical Asset Library (`CANONICAL_ASSET_LIBRARY`).** All 12 core prop types (`phone`, `laptop`, `computer`, `desk`, `chair`, `bed`, `sofa`, `table`, `door`, `window`, `books`, `cup`) have canonical pixel dimensions, restrained architectural slate/charcoal palettes, `elevation` support, and deterministic anchors (`computePropAnchors`).
3. **Shot-to-shot prop continuity (`propRegistry` + `location_id`).**
   - Assign stable `id`s to recurring props (or declare them once in top-level `assets: { ... }`) and tag scenes in the same room with a shared `location_id` (e.g., `"location_id": "study_room"`).
   - `compileEpisode` automatically preserves canonical `type`, `scale`, `facing`, and coordinates across cuts — and carries forward **moved coordinates (`release_x`, `release_elevation`), opened door angles (`open_amount`), and held attachments (`_attachedToActor`)** from the end of one shot into the start of the next!
4. **Characters stand and sit on real geometry.** Props rest on `FLOOR_Y` (`elevation: 0`) or on exact furniture surface heights (`elevation: 108` for `table`, `elevation: 112` for `desk`), never floating in mid-air.

## Practical Workflow

1. **Declare shared room assets once.** Define `assets` at the top of `episode.json` (or give props stable `id`s in the opening establishing shot) and set `"location_id"` on every shot inside that space.
2. **Keep prop count focused (1–4 purposeful props per scene).** Only place furniture and objects that serve the story or spatial grounding — clutter weakens silhouette contrast.
3. **Check `continuityEvents` and `propRegistry` on compile.** Confirm moved phones or opened doors retain their state in cutaways and reverse shots unless deliberately reset (`allow_override: true`).

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Distracting coloured background appears in one scene | Scene injected custom bright `sky` without visual lock | Keep `visual_identity.lock_identity: true` in `universal_toolbook/config/studio_config.json` |
| Desk shrinks or flips between Shot 1 and Shot 2 | Prop re-authored with different `scale` or `facing` without `id` | Give the desk `"id": "main_desk"` and share `"location_id"` so `propRegistry` locks identity |
| Phone jumps back to old spot after cut | Next scene hardcoded original `x` on the moved phone | Omit `x` in the continuation scene (or inherit via `location_id`) so `propRegistry` keeps `release_x` |
| Bright rainbow book/prop colours steal focus from character | Unconstrained saturated prop fills | Use the muted slate palette enforced in `world_props_and_boards.js` |

## Quality Checklist

- [ ] Every scene shares the calm near-black subtle studio gradient (`film_grain: false`).
- [ ] Recurring props keep identical `type`, `scale`, `facing`, and style across cuts.
- [ ] Moved props (e.g. relocated phone, opened door) stay in their new state in subsequent shots.
- [ ] Tabletop items (`phone`, `laptop`, `computer`, `cup`, `books`) use matching surface `elevation`.

## External References & Attribution

- Block, B. (2020), *The Visual Story* — tonal control, limited palette hierarchy, and background subordination to figure silhouettes.
- Katz, S. D. (1991), *Film Directing Shot by Shot* — spatial continuity, master-scene prop geography, and match-on-action cuts.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — centralized asset/composition configuration concepts (`docs/decisions/ADR-0001-remotion-evaluation.md`).

## Examples

### A cup that refills between cuts

The prop registry keyed on the scene instead of the location. Key it on `location_id` so state survives the cut.

## Concrete Engine Recipes

### Cross-shot room & moved-prop continuity (`episode.json`)

```json
{
  "assets": {
    "study_table": { "type": "table", "x": 0.56, "scale": 1.0 },
    "hero_phone": { "type": "phone", "x": 0.53, "elevation": 108, "scale": 1.0 }
  },
  "scenes": [
    {
      "id": "S01",
      "location_id": "study",
      "duration": 5.0,
      "props": [{ "id": "study_table" }, { "id": "hero_phone" }],
      "characters": [
        {
          "id": "alex",
          "beats": [
            { "start": 0.0, "end": 2.4, "action": "pick_up_phone", "x": 0.47, "target_prop": "hero_phone" },
            { "start": 2.4, "end": 5.0, "action": "put_down_phone", "target_prop": "hero_phone", "release_x": 0.60, "release_elevation": 108 }
          ]
        }
      ]
    },
    {
      "id": "S02",
      "location_id": "study",
      "duration": 4.0,
      "characters": [
        { "id": "alex", "beats": [{ "start": 0.0, "end": 4.0, "action": "talk_explain", "x": 0.44 }] }
      ]
    }
  ]
}
```
