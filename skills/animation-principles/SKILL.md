---
name: animation-principles
description: "Apply the 12 classical animation principles (anticipation, timing, spacing, slow in/out, arcs, follow-through, overlapping action, secondary action, pose-to-pose, exaggeration, staging, appeal) in deterministic 2D code."
---

# Skill: animation-principles

## Purpose

Eliminate mechanical, linear, robotic motion across all actions in `universal_toolbook/engine/character_rig.js`, `universal_toolbook/engine/motion_library.js`, and `universal_toolbook/engine/video_renderer.js` by translating classical animation principles into deterministic mathematical timing curves, spatial arcs, phase offsets, and clear silhouettes.

## Trigger Conditions

## Inputs

An action name or beat from `episode.json`, the motion curve that currently drives it, and a rendered still or preview showing the problem. You do not need the whole film to fix one beat.

Activate whenever:
- designing or tuning motion curves, action beats, reactions, transitions, or camera drifts,
- implementing new actions in `universal_toolbook/engine/motion_library.js`,
- reviewing rendered previews for stiffness, linear interpolation, simultaneous limb stops, jitter, or flat emotional beats.

## Core Rules & Non-Negotiable Constraints

1. **Never use raw linear progress `u` for organic motion.** Route every limb, torso lean, camera push, and prop lift through easing primitives in `universal_toolbook/engine/character_rig.js`: `ease` (smoothstep slow-in/out), `eio` (cubic ease-in-out), `eo` (cubic ease-out), `anticipationEase` (wind-up dip before forward drive), `springEase` (damped physical settle), or `backOut`.
2. **Hands and feet travel on arcs (`arcPoint`), never straight lines.** Reaching for a phone, lifting a cup, swinging a foot during gait, and lowering an arm must use `arcPoint(p0, p1, u, liftPx)` so trajectories curve naturally around shoulder/hip pivots.
3. **Anticipation precedes every major action.** Before standing up, jumping, reaching (`reach_phone`), sitting (`sit_down`), opening a door (`open_door`), or reacting (`react_surprise`), dedicate `15–22%` of the beat to a subtle preparatory weight shift or counter-dip.
4. **Lead and follow-through (staggered phase offsets).** Eyes and head lead (`head` angle + `lookX`/`lookY` arrive first), torso leans second, upper arm drives third, and forearm/wrist/hand settle last (`springEase` with `bounce: 0.08–0.14`). Never start and stop all joints on the exact same frame.
5. **Alive holds (secondary micro-motion).** Even during still holds (`hold_phone`, `sit_chair`, `listen_nod`), maintain low-amplitude physiological breathing (`Math.sin(globalT * 2.1 + phaseSeed)`), periodic blinks (`blinkSeed`), and subtle gaze focus — never high-frequency random jitter.

## Practical Workflow

1. **Define key storytelling poses first (Pose-to-Pose).** Establish crisp start, anticipation, contact, extreme, and settle poses (`P({ ... })`) with unmistakable silhouettes.
2. **Assign non-uniform beat timing.** Fast actions (`react_surprise` snap, thumb flick reset) use tight windows (`0.18–0.30s`) followed by a readable Cushion/Hold (`0.8–1.5s`) so the audience registers the change.
3. **Verify arc & velocity continuity.** Sample frames at `30 fps` across action transitions and check that horizontal and vertical velocities (`vx`, `vy`) decelerate smoothly into contacts without abrupt direction reversals.

## Common Failure Modes & Fixes

| Failure mode | Root cause | Fix |
|---|---|---|
| Robotic "tweened" arm reach | Linear `[lerp(x0,x1,u), lerp(y0,y1,u)]` | Replace with `arcPoint(p0, p1, anticipationEase(u, 0.06), -18 * s)` |
| All limbs freeze simultaneously | Single `u` applied identically to head, spine, and wrists | Offset head lead (`clamp(u * 1.25)`), spine (`ease(u)`), and wrist (`springEase(u)`) |
| Jittery shimmer during idle | High-frequency oscillator (`sin(globalT * 25)`) or unseeded noise | Restrict idle breathing frequency to `1.8–2.4` rad per second at `<= 1.5 px` amplitude |
| Unreadable rushed beat | 4 actions crammed into a `2.0s` scene | Budget `>= 1.6–2.5s` per distinct physical beat so anticipation and settle read clearly |

## Quality Checklist

- [ ] Every action exhibits clear slow-in / slow-out spacing (`ease` / `eio` / `springEase`).
- [ ] Major actions include visible anticipation and damped follow-through settle.
- [ ] Hand and foot trajectories follow curved `arcPoint` paths rather than straight chords.
- [ ] Head and gaze lead arm/body motion by `3–6` frames.
- [ ] Holds breathe calmly with zero high-frequency jitter or flicker.

## External References & Attribution

- Thomas, F. & Johnston, O. (1981), *The Illusion of Life: Disney Animation* — the 12 foundational principles of animation (squash/stretch via posture compression, anticipation, staging, pose-to-pose, follow-through/overlapping action, slow in/out, arcs, secondary action, timing, exaggeration, solid drawing, appeal).
- Lasseter, J. (1987), *Principles of Traditional Animation Applied to 3D Computer Animation* (SIGGRAPH) — translating traditional timing, anticipation, and overlapping action into spline/procedural curves.
- Official Remotion Agent Skills (`https://github.com/remotion-dev/skills`) — spring and interpolation timing concepts adapted in original code (`docs/decisions/ADR-0001-remotion-evaluation.md`).

## Examples

### A reach that reads as robotic

The hand travels in a straight line at constant speed and stops dead. Fix: route it through `arcPoint` with a lift, drive it with `anticipationEase` then `springEase`, and stagger the head and torso a few frames earlier. The stills before and after show the arc; the eye reads the difference immediately.

## Concrete Engine Recipes

### Anticipation + curved arc reach + damped spring settle (`motion_library.js`)

```js
const reachU = anticipationEase(clamp(u / 0.42), 0.06);
const handTarget = u < 0.42
  ? arcPoint(restHand, propGripAnchor, reachU, -20 * s)
  : arcPoint(propGripAnchor, viewHand, springEase(clamp((u - 0.42) / 0.58), { bounce: 0.08 }), -14 * s);
```
