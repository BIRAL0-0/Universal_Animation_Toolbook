---
name: character-design-and-rigging
description: "Author and maintain canonical single-colour characters, hierarchical FK/IK skeletons, tangent-capsule limbs, seamless joint welds, and hand/grip poses without segment gaps, stretching, or colour drift."
---

# Skill: character-design-and-rigging

## Purpose

Guarantee geometric, anatomical, and colour integrity for every character rendered by `universal_toolbook/engine/character_rig.js`. Characters must read instantly against the near-black studio stage with one unified base colour per character, invariant bone lengths, smooth elbow/knee/hip/shoulder silhouettes, and stable FK/IK pivots.

## Trigger Conditions

Activate whenever:
- creating or modifying character cast entries in `episode.json`,
- editing `universal_toolbook/engine/character_rig.js` or character rendering in `universal_toolbook/engine/video_renderer.js`,
- adding poses, hand shapes, IK solvers, builds, expressions, or seated/reaching body mechanics,
- diagnosing limb gaps, discoloured joints, thickness jumps, self-intersections, limb stretching, or silhouette flicker.

## Core Rules & Non-Negotiable Constraints

1. **One unified base colour per character.** `CANONICAL_CHARACTER_SPEC` locks `uniformBodyColor: true`. Torso, neck, head, upper limbs, forearms, thighs, shins, hands, shoes, and joint welds use the character's single `bodyFill` colour. Never darken back limbs, never recolour shoes or torso independently unless an explicit prop/costume flag requests it, and never draw dark crease circles inside elbows or knees.
2. **Default bald minimalist silhouette.** Default `hair` is `'none'` so the clean circular head silhouette remains iconic unless a script explicitly specifies a hairstyle.
3. **Invariant bone lengths (`< 1e-4 px` error).** `BONES` (`HEAD_R: 25`, `NECK: 10`, `TORSO: 76`, `UA: 48`, `FA: 46`, `UL: 58`, `LL: 57`) scaled by `s * build` must never stretch or compress across frames. `solveIK` clamps target distance to `L1 + L2 - 1e-4` so arms and legs never snap or elongate.
4. **Minkowski tangent-capsule segments + two-pass rendering.** Every limb segment is traced with `traceTangentCapsule` (`rStart -> rEnd`) and rendered in two passes across connected chains (outer `#060912` contour pass first across upper+lower+joint, uninterrupted `bodyFill` pass second). This eliminates internal dark seams, gaps, and overlap blobs at every joint angle.
5. **Continuous hip/shoulder socket welds.** Seated and bent-hip poses weld the rear thigh tangent smoothly into the pelvis capsule (`drawTorso` + hip weld disc) so acute hip flexion never creates notches or chair-seat overhang.

## Practical Workflow

1. **Select cast colours for contrast.** Assign distinct high-legibility `PALETTES` colours (`cyan`, `amber`, `emerald`, `coral`, `violet`, `rose`, `sky`, `gold`) in `cast` — maximum two characters per scene unless ensemble staging requires otherwise.
2. **Choose FK vs IK per limb.**
   - Use `fl` / `fr` with `legIkw: 1` whenever feet must stay planted on `FLOOR_Y` (standing, sitting, reaching, talking).
   - Use `hl` / `hr` with `ikwL` / `ikwR` (per-arm IK weights in `[0..1]`) when one or both hands contact a world prop, desk, phone, or door handle, and set `armBendL` / `armBendR` (`-1` natural anatomical elbow bend).
3. **Select expressive hand states.** Use `handL` / `handR` (`'relaxed'`, `'open'`, `'point'`, `'fist'`, `'grip'`, `'clasp'`) and `thumbScroll` / `thumbTap` for close-up manipulation.
4. **Verify invariants.** Run `node tests/regression/run_all_tests.js` (`bone_stretch_max_px === 0`, `stance_foot_slip_px === 0`) and inspect a rendered still sheet at `1920x1080` before committing rig changes.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Engine-level fix |
|---|---|---|
| Discoloured knee or elbow on bend | Legacy dark back-limb shading or joint crease stroke showing through joint | Keep `uniformBodyColor: true` and two-pass tangent-capsule fill in `universal_toolbook/engine/character_rig.js` |
| Rear pelvis notch when seated at 90° | Narrow hip radius vs thigh root radius | Keep pelvis socket radius matched to thigh root radius (`rHip = max(12.2 * s, rThighRoot)`) |
| Limb pops between frames | IK target crosses `L1 + L2` singularity | Keep reach within `~62 * s` via `alignStandingReach` or gradual `ikwL` ease |
| Hand draws over or behind held object | Flat post-pass prop drawing | Pass `frontHandOverlay` to `drawFigure` so palm draws behind prop and fingers/thumb wrap in front |

## Quality Checklist

- [ ] Character body, limbs, hands, and feet share one exact hex fill colour with zero per-limb shade drift.
- [ ] Elbows, knees, shoulders, and hips bend through `0°–135°` with zero gaps, notches, or dark overlap blobs.
- [ ] `BONES` distances measure within `1e-4 px` of canonical lengths on every frame.
- [ ] Planted stance feet have `0.0 px` horizontal slip on `FLOOR_Y`.
- [ ] Rendered PNG contact sheet visually inspected at full resolution.

## External References & Attribution

- Thomas, F. & Johnston, O. (1981), *The Illusion of Life: Disney Animation* — solid drawing, appeal, and clear silhouette readability (principles summarized in original prose).
- Williams, R. (2001), *The Animator's Survival Kit* — joint arcs, weight over planted feet, and pelvis-led posture (concepts adapted to 2D procedural FK/IK).
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — pure frame-indexed determinism (`f(frame)`); see `docs/decisions/ADR-0001-remotion-evaluation.md` (zero upstream text copied).

## Concrete Engine Recipes

### Canonical single-colour cast definition (`episode.json`)

```json
{
  "cast": {
    "alex": { "name": "Alex", "color": "cyan", "build": "standard", "hair": "none" },
    "maya": { "name": "Maya", "color": "amber", "build": "slim", "hair": "none" }
  }
}
```

### Independent front-arm IK reach with planted feet (`character_rig.js`)

```js
const pose = P({
  fl: [x + facing * 12 * s, floorY],
  fr: [x - facing * 13 * s, floorY],
  legIkw: 1,
  ikwL: 1.0,
  hl: [targetX, targetY],
  armBendL: -1,
  handL: 'grip',
  ikwR: 0,
  ar: [-0.06, 0.22],
  handR: 'relaxed',
});
```
