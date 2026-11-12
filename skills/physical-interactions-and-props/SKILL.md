---
name: physical-interactions-and-props
description: "Implement and author physically grounded hand-to-object contact, prop parent switching, grip layering, phone pickup/scroll/put-down lifecycles, seating, desk typing, table contact, and hinged door interactions."
---

# Skill: physical-interactions-and-props

## Purpose

Ensure every physical interaction between a character and a world prop in `universal_toolbook/engine/motion_library.js`, `universal_toolbook/engine/world_props_and_boards.js`, and `universal_toolbook/engine/video_renderer.js` obeys real spatial contact, explicit interaction phases, believable wrist/elbow IK geometry, accurate draw-order layering, and persistent post-release placement.

## Trigger Conditions

## Inputs

The prop's canonical ID, the character's grip anchors, and frames from before, during and after the contact. A single frame cannot show whether a hand ever actually held anything.

Activate whenever:
- authoring or debugging scenes where a character reaches, picks up, holds, scrolls, types on, or puts down a phone, cup, laptop, computer, book, or prop,
- staging characters sitting on chairs/sofas, typing at desks, touching tables, or opening doors,
- adding new interactive props or anchors to `CANONICAL_ASSET_LIBRARY` / `computePropAnchors`,
- diagnosing floating objects, missed hand grabs, duplicate world+hand props, or broken draw order.

## Core Rules & Non-Negotiable Constraints

1. **Follow the 7-phase interaction state machine.** Every physical manipulation progresses deterministically through `INTERACTION_PHASES`:
   `approach -> anticipation -> contact -> grip -> manipulation -> release -> recovery`.
2. **Interact with actual prop coordinates (`computePropAnchors`).** Never guess prop heights or hardcode arbitrary hand offsets. `resolveScenePropInteractions` queries `computePropAnchors(prop, W, floorY)` for exact `gripAnchor`, `surfaceTopY`, `seatTopY`, `keyboardContact`, and `handleGrip` coordinates.
3. **Single-instance parent switching (`_attachedToActor`).** At the exact `grip` frame of `pick_up_phone`, the world prop switches parent from the surface to the character's hand (`_attachedToActor` suppresses duplicate world drawing while `frontHandOverlay` renders the prop inside the gripping hand). At the `release` frame of `put_down_phone`, ownership returns to the world at `release_x` / `release_elevation`.
4. **Split-hand grip layering (`frontHandOverlay`).** Held phones (`drawHeldPhoneInHand`) and cups (`drawHeldCupInHand`) draw *between* the back palm capsule and the wrapping front fingers + animated thumb (`thumbScroll` / `thumbTap`), never pasted flat over a closed fist.
5. **Natural bent-elbow reach (`alignStandingReach`).** Standing actors automatically align within comfortable arm reach (`~58 * s`) and outside solid table spans (`obstacleBounds`) so elbows remain naturally bent (`armBendL = -1`) and characters never clip inside furniture.

## Practical Workflow

1. **Declare interactive props with stable `id`s.** Give every interactive prop (`phone`, `table`, `desk`, `chair`, `laptop`, `door`) a unique `id` and realistic surface `elevation` (e.g., `elevation: 108` for a phone/laptop/cup resting on a `table`, `elevation: 112` on a `desk`).
2. **Chain the complete manipulation sequence.** For phone scenes, chain `reach_phone -> pick_up_phone -> hold_phone / phone_scroll / phone_type -> put_down_phone` referencing `"target_prop": "<prop_id>"`.
3. **Specify moved release coordinates when relocating an object.** Pass `release_x` and `release_elevation` on `put_down_phone` so the prop persists at its new world coordinate across the remainder of the scene and into subsequent shots.
4. **Verify contact frames visually.** Render contact-frame stills at reach (`u ≈ 0.95`), grip transfer, active thumb scroll, and release to verify `0.0 px` air gaps and single-instance rendering.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Two phones visible at once (on table and in hand) | World prop lacked `id` or `target_prop` binding | Give the `phone` prop an `id` and set `target_prop` (or place within auto-match range) so `_attachedToActor` suppresses the table copy while held |
| Phone hovers above table surface | `elevation` omitted on `phone` (`elevation: 0` puts it on `FLOOR_Y`) | Set `elevation: 108` on `table` or `elevation: 112` on `desk` to match `CANONICAL_ASSET_LIBRARY` surface height |
| Stiff straight locked arm during pickup | Actor authored too far from prop (`dx > 95 px`) | Place actor near table edge (`~0.06` normalized units from prop) and let `alignStandingReach` maintain bent-elbow distance |
| Seated knees draw in front of desk modesty panel | Non-split prop type used for desk | Use `desk`, `clean_desk`, `messy_desk`, or `cafe_table` (`SPLIT_FURNITURE_TYPES`) for two-plane back/front occlusion |

## Quality Checklist

- [ ] Hand meets `computePropAnchors` contact point cleanly before object lift begins.
- [ ] Object never duplicates or vanishes for a frame during parent switching.
- [ ] Wrapping fingers and swiping/tapping thumb layer visibly in front of the held phone screen.
- [ ] Seated pelvis rests squarely on `seatTopY` and feet rest flat on `FLOOR_Y`.
- [ ] Hinged `door` handle tracks hand position throughout `open_door`.

## External References & Attribution

- Thomas, F. & Johnston, O. (1981), *The Illusion of Life* — anticipation before reach, follow-through on release, and weight in object handling.
- Craig, J. J. (2005), *Introduction to Robotics: Mechanics and Control* — analytical 2-link planar inverse kinematics and workspace clamping (adapted in `solveIK`).
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — pure frame-function state evaluation without mutable inter-frame state (`docs/decisions/ADR-0001-remotion-evaluation.md`).

## Examples

### A phone held two inches from the hand

The hand follows the prop's origin instead of its grip anchor. Switch the parent to the anchor, then move the prop.

## Concrete Engine Recipes

### Complete 14-step phone reach -> pickup -> thumb scroll -> type -> put down (`episode.json`)

```json
{
  "props": [
    { "id": "desk_table", "type": "table", "x": 0.56 },
    { "id": "hero_phone", "type": "phone", "x": 0.53, "elevation": 108 }
  ],
  "characters": [
    {
      "id": "alex",
      "beats": [
        { "start": 0.0, "end": 1.8, "action": "reach_phone", "x": 0.47, "target_prop": "hero_phone" },
        { "start": 1.8, "end": 4.0, "action": "pick_up_phone", "target_prop": "hero_phone" },
        { "start": 4.0, "end": 6.8, "action": "phone_scroll", "target_prop": "hero_phone" },
        { "start": 6.8, "end": 8.6, "action": "phone_type", "target_prop": "hero_phone" },
        { "start": 8.6, "end": 10.8, "action": "put_down_phone", "target_prop": "hero_phone", "release_x": 0.58, "release_elevation": 108 }
      ]
    }
  ]
}
```
