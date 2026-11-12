'use strict';

const {
  BONES,
  P,
  clamp,
  lerp,
  ease,
  eo,
  springEase,
  anticipationEase,
  arcPoint,
  lerpPose,
  skeleton,
  walkMotion,
  runMotion,
} = require('./character_rig');
const { computePropAnchors } = require('./world_props_and_boards');

const INTERACTION_PHASES = Object.freeze([
  'approach',
  'anticipation',
  'contact',
  'grip',
  'manipulation',
  'release',
  'recovery',
]);

const SUPPORTED_ACTIONS = Object.freeze([
  'idle_stand',
  'walk',
  'walk_sad',
  'run',
  'pace_think',
  'talk_explain',
  'listen_nod',
  'debate_gesture',
  'point_board',
  'write_board',
  'sit_down',
  'sit_chair',
  'sit_desk_type',
  'sit_desk_slump',
  'sit_bench',
  'sit_bed_edge',
  'sit_cafe_listen',
  'sit_cafe_talk',
  'sit_cafe_write',
  'reach_phone',
  'pick_up_phone',
  'hold_phone',
  'phone_scroll',
  'phone_type',
  'put_down_phone',
  'phone_call',
  'interact_table',
  'open_door',
  'react_surprise',
  'kneel_exhausted',
  'kneel_lookup',
  'stand_up_resolve',
  'push_boulder',
  'climb_stairs',
  'descend_stairs',
  'jump',
  'fall_down',
  'trip_stumble',
  'hug',
  'hug_kneel',
  'handshake',
  'meditate_focus',
  'handoff_give',
  'handoff_receive',
  'high_five',
  'celebrate_arms_up',
  'look_horizon',
  'head_in_hands',
  'stand_from_desk',
  'gather_pages',
  'hold_blueprint',
  'chest_hand_sincere',
  'point_emphasis',
  'sketch_desk',
  'cross_arms_skeptical',
  'walk_umbrella',
  'hold_umbrella',
  'close_shake_umbrella',
  'offer_umbrella',
  'wave_hand',
  'hold_drawing',
  'clench_fist',
  'drink_cup',
  'stretch_wake',
  'wipe_eyes',
  'check_watch',
  'nod_yes',
  'shake_head_no',
  'pick_up_floor',
  'open_curtains',
]);

/**
 * Exact closed-form binary-search foot touchdown finder inverting the eased gait clock `ease(u) * cycles`.
 */
function footstepTimesForWalk(startT, endT, x0, x1, floorY, scale = 1.0, isRun = false) {
  const dur = Math.max(0.05, endT - startT);
  const dist = Math.abs(x1 - x0);
  if (dist < 4) return [];
  const maxStride = (isRun ? 112 : 74) * scale;
  const cycles = Math.max(1, Math.ceil(dist / Math.max(isRun ? 36 : 24, maxStride * (isRun ? 0.90 : 0.85))));

  const out = [];
  for (let h = 1; h <= cycles * 2; h++) {
    const target = h / (cycles * 2);
    let lo = 0, hi = 1;
    for (let i = 0; i < 36; i++) {
      const m = (lo + hi) * 0.5;
      if (ease(m) < target) lo = m;
      else hi = m;
    }
    const u = (lo + hi) * 0.5;
    out.push({
      t: +(startT + dur * u).toFixed(3),
      x: lerp(x0, x1, ease(u)),
    });
  }
  return out;
}

/**
 * Compute `{ x, fy, s, flip, pose, ... }` for one choreography beat.
 * Note: In `character_rig.js`, local limb angles `[upper, lower]` are measured from straight down (`0`),
 * where positive angles swing forward (`+x` in local character space; `flip` mirrors to `-x` when facing left).
 */
function computeBeatState(beat, bt, bDur, globalT, W, floorY, scale) {
  const action = SUPPORTED_ACTIONS.includes(beat.action) ? beat.action : 'idle_stand';
  const u = clamp(bDur > 0 ? bt / bDur : 0);
  const s = scale || 1.0;

  const rawFromX = beat.fromX ?? beat.from_x;
  const rawToX = beat.toX ?? beat.to_x;
  const fromX = (rawFromX ?? beat.x ?? 0.5) * W;
  const toX = (rawToX ?? beat.x ?? rawFromX ?? 0.5) * W;
  const gY = floorY - (beat.elevation ?? 0) * s;

  let facing = beat.facing ?? (toX >= fromX ? 1 : -1);
  if (rawFromX !== undefined && rawToX !== undefined && Math.abs(toX - fromX) > 6) {
    facing = toX >= fromX ? 1 : -1;
  }
  const flip = facing < 0;

  // --- 1. WORLD-CONTACT LOCOMOTION (WALK, SAD WALK, AERIAL RUN, UMBRELLA WALK, PACE, STAIRS, JUMP, FALL) ---

  if (action === 'walk_umbrella') {
    const style = beat.walk_style || 'normal';
    const wm = walkMotion({
      t: bt,
      duration: bDur,
      x0: fromX,
      x1: toX,
      floor: gY,
      scale: s,
      style,
    });
    const dir = wm.direction || facing;
    wm.pose.al = [0.58, 1.88];
    wm.pose.ar = [wm.pose.ar[0] * 0.55, wm.pose.ar[1] * 0.55];
    wm.pose.handL = 'grip';
    const sk = skeleton(wm.x, gY, s, wm.pose, wm.flip);
    return {
      x: wm.x,
      fy: gY,
      s,
      flip: wm.flip,
      pose: wm.pose,
      heldUmbrella: {
        x: sk.world.al[2][0],
        y: sk.world.al[2][1],
        color: beat.umbrella_color || '#ef4444',
        open: beat.umbrella_open !== false,
        // Keep the open canopy above the holder's face across body scales and portrait crops.
        shaftLength: beat.umbrella_open === false ? 108 : 136,
        tilt: (beat.umbrella_tilt ?? -0.06) * dir,
        facing: dir,
      },
    };
  }

  if (action === 'run') {
    const rm = runMotion({
      t: bt,
      duration: bDur,
      x0: fromX,
      x1: toX,
      floor: gY,
      scale: s,
    });
    return { x: rm.x, fy: gY, s, flip: rm.flip, pose: rm.pose };
  }

  if (action === 'walk' || action === 'walk_sad') {
    const style = action === 'walk_sad' ? 'trudging' : (beat.walk_style || 'normal');
    const wm = walkMotion({
      t: bt,
      duration: bDur,
      x0: fromX,
      x1: toX,
      floor: gY,
      scale: s,
      style,
    });
    return { x: wm.x, fy: gY, s, flip: wm.flip, pose: wm.pose };
  }

  if (action === 'pace_think') {
    const rawSpan = (beat.span ?? 0.065) * W;
    const edgeTaper = ease(clamp(bt / 0.85)) * ease(clamp((bDur - bt) / 0.85));
    const span = rawSpan * edgeTaper;
    const phase = (bt / 3.8) % 2.0;
    const leg = phase < 1.0 ? phase : 2.0 - phase;
    const segStart = fromX - span;
    const segEnd = fromX + span;
    const goingRight = phase < 1.0;
    // Smooth 3D turnaround pivot near phase 0.0 / 1.0 so pacing never mirror-snaps in 1 frame!
    const distToTurn = Math.min(phase, Math.abs(phase - 1.0), 2.0 - phase);
    const turnPivot = distToTurn < 0.11 ? lerp(0.26, 1.0, ease(distToTurn / 0.11)) : 1.0;
    const wm = walkMotion({
      t: goingRight ? leg * 1.9 : (1.0 - leg) * 1.9,
      duration: 1.9,
      x0: goingRight ? segStart : segEnd,
      x1: goingRight ? segEnd : segStart,
      floor: gY,
      scale: s,
      style: 'normal',
    });
    const chinWave = Math.sin(globalT * 2.1 + (beat._actorSeed || 0)) * 0.035;
    wm.pose.lean = 0.055 + 0.012 * Math.sin(globalT * 1.5);
    wm.pose.head = 0.16 + chinWave * 0.6;
    wm.pose.al = [0.55 + chinWave, 2.30 + chinWave * 1.2];
    wm.pose.handL = 'open';
    return {
      x: wm.x,
      fy: gY,
      s,
      flip: wm.flip,
      turnScaleX: turnPivot,
      lookX: 0.28,
      lookY: 0.22 + chinWave * 1.5,
      pose: wm.pose,
    };
  }

  if (action === 'climb_stairs' || action === 'descend_stairs') {
    // Exact world-space step-tread IK matching `stairs` prop geometry
    // Supports `step_offset` to chain consecutive climb beats without snap-back.
    const descending = action === 'descend_stairs';
    const steps = Math.max(2, Number(beat.steps || 5));
    const stScale = Number(beat.stair_scale ?? beat.prop_scale ?? s);
    // Match the stairs prop defaults (step_width=72, step_height=46)
    const sw = (beat.step_width ?? 72) * stScale;
    const sh = (beat.step_height ?? 46) * stScale;
    const stairDir = beat.stair_dir === 'left' ? -1 : (beat.stair_dir === 'right' ? 1 : facing);
    const moveDir = descending ? -stairDir : stairDir;
    const moveFlip = moveDir < 0;

    // `step_offset` allows consecutive climb beats to continue from where the previous ended
    const stepOffset = Number(beat.step_offset ?? 0);

    // `fromX` is the base of step 0 (`prop.x * W` of the stairs prop)
    const basePx = beat.stairs_x !== undefined ? beat.stairs_x * W : fromX;
    const treadPt = (idx) => {
      const adjusted = idx - stepOffset;
      if (adjusted < 0) {
        return [basePx - stairDir * sw * 0.42, gY];
      }
      return [
        basePx + stairDir * (adjusted + 0.50) * sw,
        gY - (adjusted + 1) * sh,
      ];
    };

    const totalTransitions = steps;
    const prog = ease(u) * totalTransitions + stepOffset;
    const k = Math.min(totalTransitions - 1 + stepOffset, Math.floor(prog));
    const sf = prog - k; // 0..1 within single step transition

    const srcIdx = descending ? (steps - 1 - (k - stepOffset)) : (k - 1);
    const dstIdx = descending ? (steps - 2 - (k - stepOffset)) : k;
    const prevIdx = descending ? Math.min(steps - 1, srcIdx + 1) : (srcIdx - 1);

    const stancePt = treadPt(srcIdx);
    const swingStart = treadPt(prevIdx);
    const swingEnd = treadPt(dstIdx);

    // Swing foot lifts cleanly ABOVE the riser nosing before landing flat on `swingEnd`
    const swingU = ease(sf);
    const arcLift = Math.sin(sf * Math.PI) * (sh * 0.95 + 14 * s);
    const swingPt = [
      lerp(swingStart[0], swingEnd[0], swingU),
      Math.min(swingStart[1], swingEnd[1]) - arcLift + (1 - Math.sin(sf * Math.PI)) * Math.max(0, swingStart[1] - swingEnd[1]) * (1 - swingU),
    ];

    const leftIsSwing = (k % 2 === 0);
    const flPt = leftIsSwing ? swingPt : stancePt;
    const frPt = leftIsSwing ? stancePt : swingPt;

    // Weight transfers smoothly from `stancePt` to `swingEnd` in second half of each step
    const weightU = ease(clamp((sf - 0.18) / 0.82));
    const curX = lerp(stancePt[0], swingEnd[0], weightU);
    const supportY = lerp(stancePt[1], swingEnd[1], weightU);
    const pushBounce = Math.sin(sf * Math.PI) * 5 * s;
    const armSwing = (leftIsSwing ? -1 : 1) * Math.sin(sf * Math.PI) * 0.38;

    return {
      x: curX,
      fy: supportY,
      s,
      flip: moveFlip,
      pose: P({
        hipY: supportY - 108 * s - pushBounce,
        lean: descending ? 0.06 : 0.16,
        head: descending ? 0.18 : -0.06,
        spineCurve: descending ? 1.5 * s : 3.0 * s,
        fl: flPt,
        fr: frPt,
        bendL: 1,
        bendR: 1,
        footAngleL: leftIsSwing ? Math.sin(sf * Math.PI) * (descending ? 0.28 : -0.18) : 0,
        footAngleR: !leftIsSwing ? Math.sin(sf * Math.PI) * (descending ? 0.28 : -0.18) : 0,
        al: [0.18 + armSwing, 0.88 + armSwing * 0.7],
        ar: [0.10 - armSwing, 0.76 - armSwing * 0.7],
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'jump') {
    // 4-phase biomechanical jump:
    // [0..0.22] Anticipation crouch -> [0.22..0.74] Parabolic launch & flight -> [0.74..0.88] Impact absorb -> [0.88..1.0] Stand
    const jumpH = (beat.jump_height ?? 118) * s;
    let curX = fromX;
    let hipY = gY - 115 * s;
    let flPt = [fromX - facing * 12 * s, gY];
    let frPt = [fromX + facing * 14 * s, gY];
    let lean = 0.04;
    let head = 0.0;
    let al = [0.10, 0.26];
    let ar = [-0.08, 0.16];
    let fAngL = 0, fAngR = 0;
    let handMode = 'relaxed';

    if (u < 0.22) {
      const cu = ease(u / 0.22);
      hipY = gY - lerp(115, 82, cu) * s;
      lean = lerp(0.04, 0.26, cu);
      head = lerp(0, -0.12, cu);
      al = [lerp(0.10, -0.58, cu), lerp(0.26, -0.22, cu)];
      ar = [lerp(-0.08, -0.64, cu), lerp(0.16, -0.28, cu)];
      handMode = 'fist';
    } else if (u < 0.74) {
      const fu = (u - 0.22) / 0.52; // 0..1 across flight
      curX = lerp(fromX, toX, fu);
      const parabola = 4 * fu * (1 - fu); // 0 -> 1 -> 0
      const airY = jumpH * parabola;
      const tuck = Math.sin(fu * Math.PI);
      hipY = gY - 114 * s - airY;
      // Feet lift off ground with athletic knee tuck at apex
      flPt = [curX - facing * (10 - 16 * tuck) * s, gY - airY - 26 * tuck * s];
      frPt = [curX + facing * (14 + 8 * tuck) * s, gY - airY - 18 * tuck * s];
      fAngL = 0.36 * Math.sin(fu * Math.PI);
      fAngR = 0.28 * Math.sin(fu * Math.PI);
      lean = lerp(0.18, 0.04, fu);
      head = -0.14 * parabola;
      al = [lerp(-0.4, 2.25, Math.sin(fu * Math.PI * 0.85)), lerp(-0.1, 2.65, Math.sin(fu * Math.PI * 0.85))];
      ar = [lerp(-0.5, 1.95, Math.sin(fu * Math.PI * 0.85)), lerp(-0.2, 2.40, Math.sin(fu * Math.PI * 0.85))];
      handMode = 'open';
    } else {
      curX = toX;
      flPt = [toX - facing * 12 * s, gY];
      frPt = [toX + facing * 15 * s, gY];
      if (u < 0.87) {
        const lu = ease((u - 0.74) / 0.13);
        const dip = Math.sin(lu * Math.PI);
        hipY = gY - (115 - 28 * dip) * s;
        lean = 0.04 + 0.22 * dip;
        al = [0.45 * dip + 0.10, 1.05 * dip + 0.25];
        ar = [0.32 * dip - 0.06, 0.85 * dip + 0.16];
      } else {
        const ru = ease((u - 0.87) / 0.13);
        hipY = gY - lerp(108, 115.5, ru) * s;
        lean = lerp(0.10, 0.03, ru);
      }
    }

    return {
      x: curX,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY,
        lean,
        head,
        spineCurve: 3.5 * s,
        fl: flPt,
        fr: frPt,
        bendL: 1,
        bendR: 1,
        footAngleL: fAngL,
        footAngleR: fAngR,
        al,
        ar,
        handL: handMode,
        handR: handMode,
      }),
    };
  }

  if (action === 'trip_stumble' || action === 'fall_down') {
    const fullFall = action === 'fall_down';
    if (!fullFall) {
      // `trip_stumble`: walks 40%, catches toe & pitches forward with windmilling arms (40..72%), catches balance on deep lunge (72..100%)
      if (u < 0.38) {
        const wm = walkMotion({
          t: bt,
          duration: bDur * 0.38,
          x0: fromX,
          x1: lerp(fromX, toX, 0.42),
          floor: gY,
          scale: s,
        });
        return { x: wm.x, fy: gY, s, flip: wm.flip, pose: wm.pose };
      }
      const su = ease((u - 0.38) / 0.62);
      const curX = lerp(lerp(fromX, toX, 0.42), toX, su);
      const lurch = Math.sin(clamp((u - 0.38) / 0.34) * Math.PI);
      const settle = u > 0.72 ? ease((u - 0.72) / 0.28) : 0;
      return {
        x: curX,
        fy: gY,
        s,
        flip,
        pose: P({
          hipY: gY - lerp(112 - 26 * lurch, 114, settle) * s,
          lean: lerp(0.52 * lurch + 0.18, 0.06, settle),
          head: lerp(0.32 * lurch, 0.04, settle),
          spineCurve: -6 * lurch * s,
          fl: [curX + facing * (28 * lurch + 12 * settle) * s, gY],
          fr: [curX - facing * (24 * lurch + 10 * settle) * s, gY - 12 * lurch * (1 - settle) * s],
          bendL: 1,
          bendR: 1,
          al: [lerp(1.45 * lurch + 0.12, 0.12, settle), lerp(1.95 * lurch + 0.25, 0.28, settle)],
          ar: [lerp(-0.95 * lurch - 0.08, -0.08, settle), lerp(-0.45 * lurch + 0.14, 0.16, settle)],
          handL: lurch > 0.3 ? 'open' : 'relaxed',
          handR: lurch > 0.3 ? 'open' : 'relaxed',
        }),
      };
    }

    // `fall_down`: loss of balance [0..0.32] -> drop to hands & knees [0.32..0.58] -> heavy breathing on hands & knees [0.58..1.0]
    const curX = lerp(fromX, toX, ease(clamp(u / 0.58)));
    if (u < 0.58) {
      const fu = ease(u / 0.58);
      const handReachX = curX + facing * lerp(18, 64, fu) * s;
      const handReachY = lerp(gY - 98 * s, gY - 8 * s, Math.pow(fu, 1.25));
      return {
        x: curX,
        fy: gY,
        s,
        flip,
        pose: P({
          hipY: gY - lerp(118, 56, fu) * s,
          lean: lerp(0.06, 1.08, fu),
          head: lerp(0.05, 0.28, fu),
          spineCurve: -7 * fu * s,
          ikw: fu,
          hl: [handReachX, handReachY],
          hr: [handReachX - facing * 12 * s, handReachY],
          armBendL: -1,
          armBendR: -1,
          ll: [lerp(-0.04, 1.06, fu), lerp(0.02, -1.54, fu)],
          lr: [lerp(0.06, 0.92, fu), lerp(-0.02, -1.56, fu)],
          legIkw: 0,
          handL: 'open',
          handR: 'open',
        }),
      };
    }
    const impactBounce = u < 0.72 ? Math.sin(((u - 0.58) / 0.14) * Math.PI) * 4 * s : 0;
    const breathBraced = Math.sin(globalT * 3.0) * 0.03;
    const bracedHandX = toX + facing * 64 * s;
    return {
      x: toX,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - (56 - impactBounce * 0.5) * s,
        lean: 1.08 + breathBraced,
        head: 0.32 + breathBraced,
        spineCurve: -8 * s,
        ikw: 1.0,
        hl: [bracedHandX, gY - 8 * s],
        hr: [bracedHandX - facing * 12 * s, gY - 8 * s],
        armBendL: -1,
        armBendR: -1,
        ll: [1.06, -1.54],
        lr: [0.92, -1.56],
        legIkw: 0,
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'push_boulder') {
    const dir = toX >= fromX ? 1 : -1;
    const wm = walkMotion({
      t: bt,
      duration: bDur,
      x0: fromX,
      x1: toX,
      floor: gY,
      scale: s,
      style: 'trudging',
    });
    const bx = wm.x + dir * 64 * s;
    wm.pose.lean = 0.28;
    wm.pose.head = 0.12;
    wm.pose.ikw = 0.96;
    wm.pose.hl = [bx, gY - 82 * s];
    wm.pose.hr = [bx, gY - 64 * s];
    wm.pose.armBendL = -1;
    wm.pose.armBendR = -1;
    wm.pose.handL = 'open';
    wm.pose.handR = 'open';
    return {
      x: wm.x,
      fy: gY,
      s,
      flip: wm.flip,
      pose: wm.pose,
      // `hide_boulder: true` keeps the push gesture but drops the prop, for beats where the
      // character is shoving something that already exists in the scene (a wall, a door).
      pushedBoulder: beat.hide_boulder
        ? null
        : {
            x: (bx + dir * 56 * s) / W,
            scale: s,
            label: beat.boulder_label || beat.label || 'FRICTION',
          },
    };
  }

  // --- 2. STATIONARY, CONVERSATIONAL, INTERACTION & EVERYDAY ACTIONS ---
  const x = lerp(fromX, toX, ease(u));
  const phaseSeed = (fromX * 0.017) + (beat._actorSeed || 0);
  const breath = Math.sin(globalT * 1.65 + phaseSeed);
  const breathLag = Math.sin(globalT * 1.65 + phaseSeed - 0.55); // Overlapping forearm/hand lag!
  const slowShift = Math.sin(globalT * 0.82 + phaseSeed * 1.7);
  const microGaze = Math.sin(globalT * 0.62 + phaseSeed * 2.3);
  // Strict speech-gating: characters only animate talking gestures when actively speaking (never during narrator lines!)
  // KI-019: this used to be 0.0 whenever the character was not speaking. In a documentary
  // narration style only ~30% of lines are character dialogue, so for 70% of the film every
  // on-screen character dropped to a frozen default pose with only a breathing offset. Measured
  // on a bare `idle_stand` probe: stage motion median 0.171, versus 3.406 for `walk` — a 20x
  // drop. That is the single biggest cause of "it looks like a slideshow".
  // An actor who is not talking is LISTENING, and listening has body language. 0.45 keeps the
  // conversational phrases alive at roughly half amplitude without stealing focus from the
  // narrator, and `beat.force_gesture` still opts a beat into the stronger 0.65 read.
  const LISTEN_BOOST = 0.45;
  const speakBoost = beat._isSpeaking
    ? 1.0
    : (beat.force_gesture ? 0.65 : LISTEN_BOOST);

  // World-locked stance feet helper: tall, natural human leg extension (~3° soft knee) with zero foot drift
  // and living ribcage/pelvis breathing (`hipY` + subtle weight balance)
  const plantedStandingLegs = (spreadL = 8.5, spreadR = 10.5) => {
    const maxReach = 118.85;
    const maxSpread = Math.max(Math.abs(spreadL), Math.abs(spreadR));
    const safeHeight = Math.min(118.4, Math.sqrt(Math.max(96 * 96, maxReach * maxReach - maxSpread * maxSpread)) - 0.35);
    return {
      hipY: gY - safeHeight * s + breath * 0.85 * s,
      fl: [x + facing * spreadL * s, gY],
      fr: [x - facing * spreadR * s, gY],
      bendL: 1,
      bendR: 1,
      footAngleL: 0,
      footAngleR: 0,
    };
  };

  if (action === 'hug') {
    const wrap = ease(clamp(u * 3.4));
    return {
      x,
      fy: gY,
      s,
      flip,
      interactionType: 'hug',
      partnerId: beat.partner_id || null,
      wrapAmount: wrap,
      pose: P({
        ...plantedStandingLegs(9, 12),
        lean: 0.09 * wrap + 0.015 * breath,
        head: 0.08 * wrap,
        spineCurve: 2.5 * s,
        al: [lerp(0.24, 1.08, wrap), lerp(0.75, 1.54, wrap)],
        ar: [lerp(0.12, 0.98, wrap), lerp(0.55, 1.44, wrap)],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'hug_kneel') {
    const wrap = ease(clamp(u * 3.4));
    return {
      x,
      fy: gY,
      s,
      flip,
      interactionType: 'hug_kneel',
      partnerId: beat.partner_id || null,
      wrapAmount: wrap,
      pose: P({
        hipY: gY - 58 * s,
        lean: 0.20 + 0.02 * breath,
        head: 0.14,
        al: [lerp(0.65, 1.16, wrap), lerp(1.10, 1.62, wrap)],
        ar: [lerp(0.50, 1.02, wrap), lerp(0.95, 1.48, wrap)],
        ll: [1.44, 0.04],
        lr: [-0.26, -1.50],
        legIkw: 0,
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'handshake') {
    const reach = ease(clamp(u * 3.8));
    const pump = reach > 0.82 ? Math.sin(globalT * 11.0) * 0.08 : 0;
    return {
      x,
      fy: gY,
      s,
      flip,
      interactionType: 'handshake',
      partnerId: beat.partner_id || null,
      reachAmount: reach,
      pose: P({
        ...plantedStandingLegs(12, 13),
        lean: 0.06 * reach,
        head: 0.03 * reach,
        spineCurve: 3.0 * s,
        al: [lerp(0.14, 0.78 + pump, reach), lerp(0.38, 1.42 + pump * 1.4, reach)],
        ar: [-0.08, 0.16],
        handL: 'clasp',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'talk_explain') {
    const cyc = ((globalT * 0.42 + phaseSeed * 0.31) % 4 + 4) % 4;
    const pIdx = Math.floor(cyc);
    const pf = ease(cyc - pIdx);
    const phrases = [
      { lean: 0.04, head: 0.02, al: [0.46, 1.48], ar: [-0.06, 0.24], hL: 'open', hR: 'relaxed' },
      { lean: 0.06, head: -0.02, al: [0.58, 1.62], ar: [0.34, 1.26], hL: 'open', hR: 'open' },
      { lean: 0.03, head: 0.04, al: [0.32, 2.08], ar: [0.14, 0.72], hL: 'open', hR: 'relaxed' },
      { lean: 0.02, head: -0.02, al: [0.22, 0.88], ar: [-0.08, 0.16], hL: 'relaxed', hR: 'relaxed' },
    ];
    const curP = phrases[pIdx];
    const nxtP = phrases[(pIdx + 1) % 4];
    const microA = (Math.sin(globalT * 3.3 + phaseSeed) * 0.10 + Math.sin(globalT * 5.1) * 0.04) * speakBoost;
    const microB = (Math.cos(globalT * 2.6 + phaseSeed) * 0.08) * speakBoost;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(),
        lean: lerp(curP.lean, nxtP.lean, pf) * speakBoost + 0.012 * slowShift,
        head: lerp(curP.head, nxtP.head, pf) * speakBoost + 0.02 * Math.sin(globalT * 1.9 + phaseSeed),
        spineCurve: 2.8 * s,
        al: [
          lerp(0.14, lerp(curP.al[0], nxtP.al[0], pf), speakBoost) + microA,
          lerp(0.42, lerp(curP.al[1], nxtP.al[1], pf), speakBoost) + microB * 1.3,
        ],
        ar: [
          lerp(-0.08, lerp(curP.ar[0], nxtP.ar[0], pf), speakBoost) - microB * 0.7,
          lerp(0.16, lerp(curP.ar[1], nxtP.ar[1], pf), speakBoost) + microA * 0.8,
        ],
        handL: speakBoost > 0.5 ? curP.hL : 'relaxed',
        handR: speakBoost > 0.5 ? curP.hR : 'relaxed',
      }),
    };
  }

  if (action === 'listen_nod' || action === 'nod_yes') {
    const isExplicitNod = action === 'nod_yes';
    const nodCycle = ((globalT + phaseSeed * 1.9) % 4.6 + 4.6) % 4.6;
    const nod = isExplicitNod
      ? Math.pow(Math.sin(clamp(u * 1.5) * Math.PI * 2), 2) * 0.18
      : (nodCycle < 0.85 ? Math.pow(Math.sin((nodCycle / 0.85) * Math.PI * 2), 2) * 0.13 : 0);
    const thoughtful = !isExplicitNod && ((globalT * 0.22 + phaseSeed) % 2) > 1.15
      ? ease(clamp((((globalT * 0.22 + phaseSeed) % 2) - 1.15) / 0.35))
      : 0;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(10, 11),
        lean: 0.025 + 0.015 * slowShift,
        head: nod + 0.02 * slowShift,
        spineCurve: 2.5 * s,
        al: [lerp(0.14, 0.42, thoughtful), lerp(0.68, 1.95, thoughtful)],
        ar: [-0.08, 0.18 + 0.05 * slowShift],
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'shake_head_no') {
    const shake = Math.sin(bt * 11.0) * 0.08 * (1 - clamp((u - 0.7) / 0.3));
    return {
      x,
      fy: gY,
      s,
      flip,
      lookX: Math.sin(bt * 11.0) * 0.85,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.02,
        head: shake,
        al: [0.32, 1.38],
        ar: [0.22, 1.12],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'debate_gesture') {
    const p1 = Math.sin(globalT * 3.7 + phaseSeed) * speakBoost;
    const p2 = Math.sin(globalT * 2.1 + phaseSeed * 0.7) * speakBoost;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(14, 15),
        lean: 0.10 * speakBoost + 0.025 * p2,
        head: -0.02 + 0.04 * p1,
        spineCurve: 3.0 * s,
        al: [0.58 + 0.22 * p1, 1.66 + 0.24 * p2],
        ar: [0.26 - 0.16 * p2, 1.18 + 0.16 * p1],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'chest_hand_sincere') {
    const liftIn = ease(clamp(u * 2.8));
    const pulse = Math.sin(globalT * 2.1 + phaseSeed) * 0.045 * (0.45 + 0.55 * speakBoost);
    return {
      x,
      fy: gY,
      s,
      flip,
      lookX: 0.18 + 0.08 * microGaze,
      lookY: 0.06 + 0.04 * breath,
      pose: P({
        ...plantedStandingLegs(10, 12),
        lean: 0.035 + 0.014 * breath + 0.012 * slowShift,
        head: 0.04 + 0.025 * breath + pulse * 0.4,
        spineCurve: (2.8 + 0.8 * breath) * s,
        al: [lerp(0.10, 0.34 + pulse, liftIn), lerp(0.26, 2.22 + pulse, liftIn)],
        ar: [-0.06 + 0.02 * breathLag, 0.22 + 0.04 * breathLag],
        handL: liftIn > 0.35 ? 'open' : 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'point_emphasis') {
    const reach = ease(clamp(u * 2.2));
    const bob = Math.sin(globalT * 3.2 + phaseSeed) * 0.05 * speakBoost;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(13, 14),
        lean: 0.08 * reach,
        head: -0.03 + bob * 0.5,
        spineCurve: 3.0 * s,
        al: [lerp(0.28, 1.18, reach) + bob, lerp(0.95, 1.46, reach) + bob],
        ar: [-0.09, 0.22],
        handL: 'point',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'cross_arms_skeptical') {
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(12, 12),
        lean: -0.02 + 0.012 * slowShift,
        head: 0.06 + 0.02 * slowShift,
        spineCurve: 3.2 * s,
        al: [0.36, 1.96],
        ar: [0.28, 1.88],
        handL: 'grip',
        handR: 'grip',
      }),
    };
  }

  if (action === 'drink_cup') {
    const sip = Math.sin(clamp(u * 1.25) * Math.PI);
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.02 - 0.03 * sip,
      head: -0.18 * sip,
      al: [lerp(0.32, 1.24, sip), lerp(1.25, 2.58, sip)],
      ar: [-0.08, 0.18],
      handL: 'grip',
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldCup: {
        x: sk.world.al[2][0] + facing * 4 * s,
        y: sk.world.al[2][1] - 2 * s,
        tilt: -facing * 0.55 * sip,
      },
    };
  }

  if (action === 'stretch_wake') {
    const str = Math.sin(u * Math.PI);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(12, 12),
        lean: -0.05 * str,
        head: -0.16 * str,
        spineCurve: 7.0 * str * s,
        al: [lerp(0.18, 2.65, str), lerp(0.45, 2.88, str)],
        ar: [lerp(-0.12, 2.45, str), lerp(0.20, 2.75, str)],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'wipe_eyes') {
    const raise = ease(clamp(u / 0.24)) * ease(clamp((1.04 - u) / 0.22));
    const wipe = Math.sin(bt * 3.8);
    return {
      x,
      fy: gY,
      s,
      flip,
      expression: 'sad',
      lookY: 0.32 * raise,
      pose: P({
        ...plantedStandingLegs(10, 12),
        lean: lerp(0.03, 0.08, raise) + 0.012 * breath,
        head: lerp(0.04, 0.22, raise) + 0.02 * wipe * raise,
        spineCurve: lerp(2.0, -3.2, raise) * s,
        al: [lerp(0.09, 1.14 + 0.05 * wipe, raise), lerp(0.24, 2.54 + 0.07 * wipe, raise)],
        ar: [-0.06 + 0.02 * breathLag, 0.22 + 0.03 * breathLag],
        handL: raise > 0.35 ? 'open' : 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'check_watch') {
    // 3-phase watch glance: [0..0.28] Crisp raise -> [0.28..0.82] Reading wrist with subtle tilt & breath -> [0.82..1.0] Gentle lower
    const liftIn = springEase(clamp(u / 0.28), { bounce: 0.06 });
    const releaseOut = u > 0.84 ? 1 - ease((u - 0.84) / 0.16) : 1.0;
    const lift = liftIn * releaseOut;
    const wristScan = Math.sin(bt * 2.8 + phaseSeed) * 0.035 * lift;
    return {
      x,
      fy: gY,
      s,
      flip,
      lookX: 0.32 * lift,
      lookY: (0.42 + 0.04 * Math.sin(bt * 2.2)) * lift,
      pose: P({
        ...plantedStandingLegs(10, 12),
        lean: 0.045 * lift + 0.01 * breath,
        head: (0.24 + wristScan * 0.5) * lift + 0.015 * breath,
        spineCurve: (2.4 - 1.2 * lift) * s,
        al: [lerp(0.10, 0.64 + wristScan, lift), lerp(0.26, 2.02 + wristScan * 1.4, lift)],
        ar: [-0.07 + 0.02 * breathLag, 0.16 + 0.03 * breathLag],
        handL: lift > 0.4 ? 'open' : 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'pick_up_floor') {
    const bend = Math.sin(u * Math.PI);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - lerp(115.5, 68, bend) * s,
        lean: lerp(0.03, 0.68, bend),
        head: lerp(0.0, 0.28, bend),
        spineCurve: -5.0 * bend * s,
        fl: [x + facing * 16 * s, gY],
        fr: [x - facing * 14 * s, gY],
        bendL: 1,
        bendR: 1,
        ikw: bend,
        hl: [x + facing * 34 * s, gY - 12 * s],
        armBendL: 1,
        al: [0.35, 0.85],
        ar: [-0.08, 0.35],
        handL: bend > 0.45 ? 'grip' : 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'open_curtains') {
    const spread = ease(u);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(14, 14),
        lean: -0.02 * spread,
        head: -0.08 * spread,
        spineCurve: 4.5 * spread * s,
        al: [lerp(0.85, 1.65, spread), lerp(1.55, 1.92, spread)],
        ar: [lerp(0.75, -0.95, spread), lerp(1.45, -1.25, spread)],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'hold_blueprint') {
    const glance = Math.sin(globalT * 1.55 + phaseSeed);
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.05,
      head: glance > 0.2 ? 0.20 : -0.02,
      al: [0.54, 1.62 + 0.04 * glance],
      ar: [0.42, 1.48],
      handL: 'grip',
      handR: 'grip',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldBlueprint: {
        x: sk.world.al[2][0] + facing * 10 * s,
        y: sk.world.al[2][1] - 6 * s,
        facing,
        open: Boolean(beat.open_sheet),
      },
    };
  }

  if (action === 'gather_pages') {
    const reachWave = Math.sin(bt * 3.4);
    const reachFwd = 0.5 + 0.5 * reachWave;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 56 * s,
        lean: 0.36 + 0.08 * reachFwd,
        head: 0.32 - 0.12 * (1 - reachFwd),
        al: [0.85 + 0.26 * reachFwd, 1.12 + 0.22 * (1 - reachFwd)],
        ar: [0.62 + 0.24 * (1 - reachFwd), 1.05 + 0.25 * reachFwd],
        ll: [1.44, 0.04],
        lr: [-0.26, -1.50],
        legIkw: 0,
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'head_in_hands') {
    const seated = beat.seated !== false;
    const sigh = Math.sin(globalT * 1.5 + phaseSeed) * 0.035;
    if (seated) {
      return {
        x,
        fy: gY,
        s,
        flip,
        pose: P({
          hipY: gY - 65 * s,
          lean: 0.36 + sigh,
          head: 0.40 + sigh,
          spineCurve: -7.5 * s,
          al: [0.86, 2.48],
          ar: [0.78, 2.40],
          ll: [1.46, 0.04],
          lr: [1.34, 0.14],
          legIkw: 0,
          handL: 'open',
          handR: 'open',
        }),
      };
    }
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.22 + sigh,
        head: 0.36 + sigh,
        spineCurve: -6.5 * s,
        ikw: 0.92,
        hl: [x + facing * 13 * s, gY - 196 * s],
        hr: [x + facing * 9 * s, gY - 192 * s],
        armBendL: 1,
        armBendR: 1,
        al: [0.95, 2.52],
        ar: [0.88, 2.46],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'stand_from_desk') {
    // 3-phase counterbalanced stand: [0..0.28] Nose-over-toes lean forward -> [0.28..0.76] Smooth leg extension -> [0.76..1.0] Balanced upright settle
    const leanIn = u < 0.30 ? ease(u / 0.30) : (1 - ease(clamp((u - 0.30) / 0.58)));
    const riseU = u < 0.14 ? 0 : ease(clamp((u - 0.14) / 0.72));
    return {
      x,
      fy: gY,
      s,
      flip,
      seatedAtDesk: u < 0.78,
      seatedOnChair: true,
      seatDescentProgress: 1 - riseU,
      targetPropId: beat.target_prop || null,
      pose: P({
        hipY: lerp(gY - 75.5 * s, gY - 115.5 * s, riseU),
        lean: lerp(0.08, 0.025, riseU) + 0.16 * leanIn,
        head: lerp(0.08, -0.01, riseU) + 0.08 * leanIn,
        spineCurve: lerp(1.2, 2.8, riseU) * s - 2.2 * s * leanIn,
        fl: [x + facing * lerp(34, 9.5, riseU) * s, gY],
        fr: [x + facing * lerp(24, -10.5, riseU) * s, gY],
        bendL: 1,
        bendR: 1,
        legIkw: 1,
        footAngleL: 0,
        footAngleR: 0,
        al: [lerp(0.46, 0.09, riseU), lerp(1.36, 0.22, riseU)],
        ar: [lerp(0.38, -0.07, riseU), lerp(1.28, 0.15, riseU)],
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'hold_umbrella') {
    const shelter = Boolean(beat.shelter_other);
    const sway = Math.sin(globalT * 1.6 + phaseSeed) * 0.025;
    const pose = P({
      ...plantedStandingLegs(),
      lean: shelter ? 0.06 : 0.02,
      head: (beat.head_tilt ?? (shelter ? 0.14 : 0.0)) + sway * 0.5,
      al: shelter ? [0.96 + sway, 1.54 + sway] : [0.58 + sway, 1.92 + sway],
      ar: [-0.10, 0.18],
      handL: 'grip',
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      wetShoulder: Boolean(beat.wet_shoulder),
      heldUmbrella: {
        x: sk.world.al[2][0],
        y: sk.world.al[2][1],
        color: beat.umbrella_color || '#ef4444',
        open: beat.umbrella_open !== false,
        shaftLength: beat.umbrella_open === false ? 108 : 136,
        tilt: (beat.umbrella_tilt ?? (shelter ? 0.18 : 0.0)) * facing,
        facing,
      },
    };
  }

  if (action === 'close_shake_umbrella') {
    const shake = u > 0.25 ? Math.sin(bt * 18.0) * 0.18 * (1 - clamp((u - 0.75) * 4)) : 0;
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.12 + Math.abs(shake) * 0.2,
      head: 0.18,
      al: [0.52 + shake, 1.18 + shake * 1.4],
      ar: [0.18, 0.68],
      handL: 'grip',
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldUmbrella: {
        x: sk.world.al[2][0],
        y: sk.world.al[2][1],
        color: beat.umbrella_color || '#ef4444',
        open: u < 0.22,
        shaftLength: u < 0.22 ? 136 : 108,
        tilt: facing * (0.95 + shake * 0.8),
        facing,
        shaking: u >= 0.25 && u <= 0.85,
      },
    };
  }

  if (action === 'offer_umbrella') {
    const ext = ease(clamp(u * 1.7));
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.08 * ext,
      head: 0.03,
      al: [lerp(0.46, 1.06, ext), lerp(1.55, 1.48, ext)],
      ar: [lerp(0.10, 0.42, ext), lerp(0.55, 1.12, ext)],
      handL: 'grip',
      handR: 'open',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldUmbrella: {
        x: sk.world.al[2][0],
        y: sk.world.al[2][1],
        color: beat.umbrella_color || '#1e293b',
        open: Boolean(beat.umbrella_open),
        // Raise an offered open canopy clear of the recipient's face while the hand stays on the grip.
        shaftLength: beat.umbrella_open ? 136 : 108,
        tilt: facing * (beat.umbrella_open ? 0.10 : 0.36),
        facing,
      },
    };
  }

  if (action === 'wave_hand') {
    const w = Math.sin(globalT * 6.8 + phaseSeed) * 0.22;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.01,
        head: -0.05,
        spineCurve: 3.0 * s,
        al: [2.25 + w, 2.65 + w * 1.35],
        ar: [-0.08, 0.16],
        handL: 'wave',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'hold_drawing') {
    const lookCycle = Math.sin(globalT * 1.4 + phaseSeed);
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.05,
      head: lookCycle > 0.0 ? 0.22 : 0.02,
      al: [0.56, 1.68],
      ar: [0.44, 1.54],
      handL: 'grip',
      handR: 'grip',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldDrawing: {
        x: sk.world.al[2][0] + facing * 8 * s,
        y: sk.world.al[2][1] - 4 * s,
        facing,
      },
    };
  }

  if (action === 'clench_fist') {
    const tremor = Math.sin(globalT * 14.0) * 0.012;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(13, 14),
        lean: 0.08,
        head: 0.08,
        al: [0.26 + tremor, 0.96 + tremor],
        ar: [-0.12 - tremor, 0.42],
        handL: 'fist',
        handR: 'fist',
      }),
    };
  }

  if (action === 'sketch_desk') {
    const stroke = Math.sin(globalT * 4.4 + phaseSeed);
    const sweep = Math.cos(globalT * 1.7 + phaseSeed);
    const pose = P({
      hipY: gY - 75.5 * s + breath * 0.35 * s,
      lean: 0.16 + 0.022 * sweep,
      head: 0.20 + 0.03 * sweep,
      spineCurve: -1.8 * s,
      al: [0.60 + 0.11 * stroke, 1.54 - 0.09 * stroke],
      ar: [0.46, 1.42],
      fl: [x + facing * 34 * s, gY],
      fr: [x + facing * 24 * s, gY],
      bendL: 1,
      bendR: 1,
      legIkw: 1,
      handL: 'write',
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      seatedAtDesk: true,
      seatedOnChair: true,
      seatDescentProgress: 1.0,
      sketchingAtDesk: true,
      sketchStroke: stroke,
      sketchSweep: sweep,
      targetPropId: beat.target_prop || null,
      lookX: 0.38 + 0.06 * stroke,
      lookY: 0.30,
      heldPen: { x: sk.world.al[2][0], y: sk.world.al[2][1], dir: facing },
    };
  }

  if (action === 'point_board' || action === 'write_board') {
    const isWrite = action === 'write_board';
    const tx = beat.targetX !== undefined ? beat.targetX * W : x + facing * 155 * s;
    const ty = beat.targetY !== undefined
      ? beat.targetY + (isWrite ? Math.sin(globalT * 6.5) * 18 * s : Math.sin(globalT * 2.4) * 7 * s)
      : gY - 235 * s + (isWrite ? Math.sin(globalT * 6.5) * 18 * s : 0);

    const pose = P({
      ...plantedStandingLegs(12, 13),
      lean: 0.05,
      head: -0.08,
      spineCurve: 3.0 * s,
      hl: [tx, ty],
      ikw: 0.94,
      armBendL: -1,
      ar: [0.14 + 0.08 * Math.sin(globalT * 3.0), 0.78],
      handL: isWrite ? 'write' : 'point',
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      heldPen: isWrite ? { x: sk.world.al[2][0], y: sk.world.al[2][1], dir: facing } : null,
    };
  }

  if (action === 'sit_down') {
    // 4-phase classical seating biomechanics:
    // [0..0.18] Preparation & glance -> [0.18..0.64] Counterbalanced hip descent -> [0.64..0.78] Seat contact -> [0.78..1.0] Cushioned settle
    const standHipY = gY - 115.5 * s;
    const seatHipY = gY - 75.5 * s;
    let hipY = standHipY;
    let lean = 0.03;
    let head = 0.02;
    let spineCurve = 2.5 * s;
    let al = [0.10, 0.24];
    let ar = [-0.08, 0.16];
    let handMode = 'relaxed';
    let footSpan = 10;
    let phase = 'approach';

    if (u < 0.18) {
      phase = 'anticipation';
      const pu = ease(u / 0.18);
      hipY = lerp(standHipY, standHipY + 5 * s, pu);
      lean = lerp(0.03, 0.16, pu);
      head = lerp(0.0, 0.14, pu);
      al = [lerp(0.10, 0.34, pu), lerp(0.24, 0.78, pu)];
      ar = [lerp(-0.08, 0.22, pu), lerp(0.16, 0.68, pu)];
      footSpan = lerp(10, 18, pu);
    } else if (u < 0.68) {
      phase = u < 0.58 ? 'manipulation' : 'contact';
      const du = ease((u - 0.18) / 0.50);
      const balanceArc = Math.sin(du * Math.PI);
      hipY = lerp(standHipY + 5 * s, seatHipY, du);
      // Forward torso counterbalance over knees during hip drop
      lean = lerp(0.16, 0.08, du) + 0.18 * balanceArc;
      head = lerp(0.14, 0.05, du) + 0.08 * balanceArc;
      spineCurve = (2.5 - 3.5 * balanceArc) * s;
      al = [lerp(0.34, 0.36, du) + 0.26 * balanceArc, lerp(0.78, 1.36, du) + 0.22 * balanceArc];
      ar = [lerp(0.22, 0.28, du) + 0.22 * balanceArc, lerp(0.68, 1.26, du) + 0.18 * balanceArc];
      handMode = balanceArc > 0.35 ? 'open' : 'relaxed';
      footSpan = lerp(18, 34, du);
    } else {
      phase = 'recovery';
      const su = (u - 0.68) / 0.32;
      const cushionDip = Math.sin(clamp(su * 2.2) * Math.PI) * (1 - clamp(su)) * 2.4 * s;
      const settle = ease(su);
      hipY = seatHipY + cushionDip;
      lean = lerp(0.08, 0.04, settle);
      head = lerp(0.05, 0.02, settle);
      spineCurve = lerp(1.0, 2.2, settle) * s;
      al = [lerp(0.36, 0.32, settle), lerp(1.36, 1.28, settle)];
      ar = [lerp(0.28, 0.24, settle), lerp(1.26, 1.18, settle)];
      footSpan = 34;
    }

    return {
      x,
      fy: gY,
      s,
      flip,
      seatedOnChair: true,
      seatDescentProgress: ease(clamp((u - 0.12) / 0.56)),
      targetPropId: beat.target_prop || null,
      interactionState: {
        phase,
        targetPropType: 'chair',
        targetPropId: beat.target_prop || null,
        attached: u >= 0.64,
        contactProgress: clamp((u - 0.18) / 0.50),
      },
      pose: P({
        hipY,
        lean,
        head,
        spineCurve,
        fl: [x + facing * footSpan * s, gY],
        fr: [x + facing * (footSpan - 9) * s, gY],
        bendL: 1,
        bendR: 1,
        legIkw: 1,
        footAngleL: 0,
        footAngleR: 0,
        al,
        ar,
        handL: handMode,
        handR: handMode,
      }),
    };
  }

  if (action === 'sit_chair') {
    const talkWave = speakBoost > 0.05 ? Math.sin(globalT * 3.4 + phaseSeed) * 0.14 * speakBoost : 0;
    return {
      x,
      fy: gY,
      s,
      flip,
      seatedOnChair: true,
      seatDescentProgress: 1.0,
      targetPropId: beat.target_prop || null,
      interactionState: {
        phase: 'manipulation',
        targetPropType: 'chair',
        targetPropId: beat.target_prop || null,
        attached: true,
        contactProgress: 1.0,
      },
      pose: P({
        hipY: gY - 75.5 * s + breath * 0.25 * s,
        lean: 0.04 + 0.01 * slowShift,
        head: 0.02 + 0.02 * breath,
        spineCurve: 2.2 * s,
        fl: [x + facing * 34 * s, gY],
        fr: [x + facing * 25 * s, gY],
        bendL: 1,
        bendR: 1,
        legIkw: 1,
        footAngleL: 0,
        footAngleR: 0,
        al: [0.32 + talkWave, 1.28 + talkWave * 0.8],
        ar: [0.24, 1.18],
        handL: speakBoost > 0.4 ? 'open' : 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'sit_desk_type' || action === 'sit_desk_slump') {
    const slump = action === 'sit_desk_slump';
    const burstPhase = ((globalT + phaseSeed) % 3.7 + 3.7) % 3.7;
    const typingActive = burstPhase < 2.55 ? 1.0 : 0.12;
    const readLift = burstPhase >= 2.55 ? Math.sin(((burstPhase - 2.55) / 1.15) * Math.PI) * 0.08 : 0;
    const t1 = Math.sin(globalT * 12.4) * 0.06 * typingActive;
    const t2 = Math.cos(globalT * 10.6) * 0.06 * typingActive;
    return {
      x,
      fy: gY,
      s,
      flip,
      seatedAtDesk: true,
      seatedOnChair: true,
      seatDescentProgress: 1.0,
      typingTapL: Math.sin(globalT * 13.2) * typingActive,
      typingTapR: Math.cos(globalT * 11.4) * typingActive,
      targetPropId: beat.target_prop || null,
      interactionState: {
        phase: 'manipulation',
        targetPropType: 'desk',
        targetPropId: beat.target_prop || null,
        attached: true,
        contactProgress: 1.0,
      },
      lookX: slump ? 0.15 : 0.35,
      lookY: slump ? 0.38 : 0.16 - readLift * 0.5,
      pose: P({
        hipY: gY - 75.5 * s,
        lean: slump ? 0.34 + 0.02 * breath : 0.10 - readLift * 0.25,
        head: slump ? 0.34 + 0.02 * breath : 0.09 - readLift,
        spineCurve: slump ? -7.5 * s : 1.8 * s,
        al: slump ? [0.72, 2.34] : [0.56 + t1, 1.52 - t1],
        ar: slump ? [0.64, 2.26] : [0.48 + t2, 1.46 - t2],
        fl: [x + facing * 34 * s, gY],
        fr: [x + facing * 24 * s, gY],
        bendL: 1,
        bendR: 1,
        legIkw: 1,
        handL: slump ? 'relaxed' : 'open',
        handR: slump ? 'relaxed' : 'open',
      }),
    };
  }

  if (action === 'sit_bed_edge') {
    const sigh = Math.sin(globalT * 1.4) * 0.03;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 58 * s,
        lean: 0.28 + sigh,
        head: 0.30 + sigh,
        spineCurve: -5.5 * s,
        al: [0.58, 1.84],
        ar: [0.48, 1.76],
        ll: [1.38, 0.05],
        lr: [1.26, 0.16],
        legIkw: 0,
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'sit_cafe_listen' || action === 'sit_cafe_talk' || action === 'sit_cafe_write') {
    const isTalk = action === 'sit_cafe_talk' && speakBoost > 0.05;
    const isWrite = action === 'sit_cafe_write';
    const gest = isTalk ? Math.sin(globalT * 3.4) * 0.16 * speakBoost : 0;
    const scrib = isWrite ? Math.sin(globalT * 7.2) * 0.08 : 0;
    const pose = P({
      hipY: gY - 64 * s,
      lean: isWrite ? 0.15 : 0.04,
      head: isWrite ? 0.22 : (isTalk ? 0.02 * Math.sin(globalT * 2.5) : 0.05),
      spineCurve: isWrite ? -2.0 * s : 2.0 * s,
      al: isWrite
        ? [0.58 + scrib, 1.56 - scrib]
        : (isTalk ? [0.46 + gest, 1.48 + gest * 0.8] : [0.42, 1.42]),
      ar: [0.34, 1.36],
      ll: [1.44, 0.04],
      lr: [1.32, 0.16],
      legIkw: 0,
      handL: isWrite ? 'write' : (isTalk ? 'open' : 'relaxed'),
      handR: 'relaxed',
    });
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      seatedAtDesk: true,
      heldPen: isWrite ? { x: sk.world.al[2][0], y: sk.world.al[2][1], dir: facing } : null,
    };
  }

  if (action === 'kneel_lookup') {
    const strain = Math.sin(globalT * 2.6) * 0.04;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 58 * s,
        lean: 0.24 + strain,
        head: -0.32,
        al: [0.88 + strain, 1.42],
        ar: [0.32, 0.24],
        ll: [1.44, 0.04],
        lr: [-0.26, -1.50],
        legIkw: 0,
        handL: 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'sit_bench') {
    const wave = beat.talking ? Math.sin(globalT * 4.0) * 0.20 : 0;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 63 * s,
        lean: 0.02,
        head: 0.03 * breath,
        spineCurve: 2.0 * s,
        al: [0.28 + wave, 1.25 + wave],
        ar: [0.12, 0.85],
        ll: [1.44, 0.06],
        lr: [1.32, 0.18],
        legIkw: 0,
        handL: beat.talking ? 'open' : 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  if (
    action === 'reach_phone' ||
    action === 'pick_up_phone' ||
    action === 'hold_phone' ||
    action === 'phone_scroll' ||
    action === 'phone_type' ||
    action === 'put_down_phone'
  ) {
    const isSeated = Boolean(beat.seated);
    const baseLegs = isSeated
      ? {
          hipY: gY - 75.5 * s + breath * 0.2 * s,
          fl: [x + facing * 34 * s, gY],
          fr: [x + facing * 25 * s, gY],
          bendL: 1,
          bendR: 1,
          legIkw: 1,
        }
      : plantedStandingLegs();

    // Default ergonomic world-space hand anchors for 3/4 rig:
    // `visAR` (far/facing-side arm) sits at `shFar` (+19.5*s forward of spine), so skeleton target `hr`
    // is offset by `-facing * 19.5 * s` so the rendered 3/4 hand lands at the exact world target!
    const shFarOffX = facing * 19.5 * s;
    const shApproxY = (baseLegs.hipY ?? (gY - 115 * s)) - BONES.TORSO * s;
    const restHand = [x + facing * 6 * s, shApproxY + 86 * s];
    const rawSurfaceContact = [
      beat.target_x !== undefined ? beat.target_x * W : x + facing * 62 * s,
      gY - (beat.surface_height ?? 108) * s,
    ];
    const surfaceContact = [rawSurfaceContact[0] - shFarOffX, rawSurfaceContact[1] - 2.6 * s];
    // Natural mid-rib/chest open-space phone viewing anchor (`visAR` wrist lands at `x + facing * 81 * s`, `shApproxY + 46 * s`)
    const viewHand = [
      x + facing * (isSeated ? 54 : 62) * s,
      shApproxY + (isSeated ? 44 : 46) * s,
    ];

    if (action === 'reach_phone') {
      const noticeU = ease(clamp(u / 0.28));
      const antiCoil = u >= 0.16 && u < 0.38 ? Math.sin(((u - 0.16) / 0.22) * Math.PI) : 0;
      const reachU = u < 0.34 ? 0 : ease(clamp((u - 0.34) / 0.56));
      const phase = u < 0.20 ? 'approach' : (u < 0.36 ? 'anticipation' : (u < 0.88 ? 'manipulation' : 'contact'));
      const curTarget = arcPoint(
        [restHand[0] - facing * 5 * s * antiCoil, restHand[1] - 4 * s * antiCoil],
        surfaceContact,
        reachU,
        -20 * s
      );
      return {
        x,
        fy: gY,
        s,
        flip,
        seatedAtDesk: isSeated,
        seatedOnChair: isSeated,
        targetPropId: beat.target_prop || null,
        phoneAction: 'reach_phone',
        phoneProgress: reachU,
        lookX: 0.48 * noticeU,
        lookY: 0.34 * noticeU,
        interactionState: {
          phase,
          targetPropType: 'phone',
          targetPropId: beat.target_prop || null,
          attached: false,
          contactProgress: reachU,
        },
        pose: P({
          ...baseLegs,
          lean: (isSeated ? 0.08 : 0.03) + 0.09 * reachU - 0.02 * antiCoil,
          head: 0.20 * ease(clamp((u - 0.08) / 0.34)),
          spineCurve: (2.0 - 2.2 * reachU) * s,
          ikwR: clamp((u - 0.16) / 0.22),
          hr: curTarget,
          armBendR: -1,
          al: isSeated ? [0.24, 1.12] : [-0.05, 0.18],
          ar: [0.16 - 0.08 * antiCoil, 0.38 + 0.12 * antiCoil],
          handL: 'relaxed',
          handR: reachU > 0.78 ? 'grip' : (reachU > 0.15 ? 'open' : 'relaxed'),
        }),
      };
    }

    if (action === 'pick_up_phone') {
      const fromReach = beat._prevAction === 'reach_phone';
      const reachFrac = fromReach ? 0.08 : 0.36;
      const gripEnd = fromReach ? 0.20 : 0.48;
      let phase = 'approach';
      let handTarget = restHand;
      let attached = false;
      let lean = isSeated ? 0.08 : 0.03;
      let head = 0.06;
      let handShape = 'open';

      if (u < reachFrac) {
        phase = u < reachFrac * 0.45 ? 'anticipation' : 'contact';
        const ru = fromReach ? 1 : ease(u / reachFrac);
        handTarget = fromReach ? surfaceContact : arcPoint(restHand, surfaceContact, ru, -18 * s);
        lean += 0.09 * ru;
        head = lerp(0.08, 0.20, ru);
        handShape = ru > 0.8 ? 'grip' : 'open';
      } else if (u < gripEnd) {
        phase = 'grip';
        handTarget = surfaceContact;
        attached = true;
        lean += 0.09;
        head = 0.20;
        handShape = 'grip';
      } else {
        phase = u < 0.88 ? 'manipulation' : 'recovery';
        const liftU = springEase(clamp((u - gripEnd) / (1 - gripEnd)), { bounce: 0.08 });
        handTarget = arcPoint(surfaceContact, viewHand, liftU, -14 * s);
        attached = true;
        lean = lerp((isSeated ? 0.16 : 0.11), (isSeated ? 0.08 : 0.05), liftU);
        head = lerp(0.20, 0.22, liftU);
        handShape = 'grip';
      }

      const pose = P({
        ...baseLegs,
        lean,
        head,
        spineCurve: -1.2 * s,
        ikwR: 1.0,
        hr: handTarget,
        armBendR: -1,
        al: isSeated ? [0.24, 1.14] : [-0.05, 0.18],
        ar: [0.16, 1.48],
        handL: 'relaxed',
        handR: handShape,
      });
      const sk = skeleton(x, gY, s, pose, flip);
      return {
        x,
        fy: gY,
        s,
        flip,
        seatedAtDesk: isSeated,
        seatedOnChair: isSeated,
        targetPropId: beat.target_prop || null,
        phoneAction: 'pick_up_phone',
        phoneReachFrac: reachFrac,
        phoneGripEnd: gripEnd,
        phoneProgress: u,
        lookX: 0.46,
        lookY: attached ? 0.28 : 0.36,
        interactionState: {
          phase,
          targetPropType: 'phone',
          targetPropId: beat.target_prop || null,
          attached,
          contactProgress: u < reachFrac ? u / Math.max(0.01, reachFrac) : 1.0,
        },
        pose,
        heldPhone: attached
          ? {
              inHand: true,
              hand: 'far',
              lit: u > gripEnd + 0.08,
              scrollPhase: 0,
              x: sk.world.gripR[0] + shFarOffX,
              y: sk.world.gripR[1] + 2.2 * s,
              facing,
            }
          : null,
      };
    }

    if (action === 'hold_phone' || action === 'phone_scroll' || action === 'phone_type') {
      const isScroll = action === 'phone_scroll';
      const isType = action === 'phone_type';
      const swipeCyc = ((bt * 0.92 + phaseSeed * 0.3) % 1 + 1) % 1;
      const thumbScroll = isScroll
        ? (swipeCyc < 0.64 ? lerp(-0.85, 0.90, ease(swipeCyc / 0.64)) : lerp(0.90, -0.85, ease((swipeCyc - 0.64) / 0.36)))
        : 0;
      const thumbTap = isType ? Math.sin(globalT * 14.0) * 0.85 : 0;
      const wristMicroY = isScroll
        ? Math.sin(swipeCyc * Math.PI * 2) * 2.2 * s
        : (isType ? Math.sin(globalT * 10.5) * 1.4 * s : Math.sin(globalT * 2.1 + phaseSeed) * 1.2 * s);
      const wristMicroX = facing * (breathLag * 1.4 * s + (isScroll ? Math.cos(swipeCyc * Math.PI * 2) * 1.1 * s : 0));
      const phoneHandMicro = [wristMicroX, breath * 1.6 * s + wristMicroY];
      const targetPt = [viewHand[0] + phoneHandMicro[0], viewHand[1] + phoneHandMicro[1]];
      // For two-handed typing, near arm (`visAL` at `shNear`) smoothly rises to meet `visAR`
      const typeRamp = isType ? ease(clamp(bt / 0.32)) : 0;
      const nearTypeTarget = [targetPt[0] + shFarOffX + facing * 12.0 * s, targetPt[1] + 4.5 * s];

      const pose = P({
        ...baseLegs,
        lean: (isSeated ? 0.08 : 0.045) + 0.012 * breath + 0.008 * slowShift,
        head: 0.21 + 0.02 * breath + (isScroll ? 0.024 * Math.sin(swipeCyc * Math.PI * 2) : 0),
        spineCurve: (-1.2 + 0.6 * breath) * s,
        ikwR: 1.0,
        hr: targetPt,
        armBendR: -1,
        ikwL: isType ? 0.92 * typeRamp : 0,
        hl: isType ? nearTypeTarget : undefined,
        armBendL: -1,
        al: isType ? [0.44, 1.62] : (isSeated ? [0.24, 1.14] : [-0.04 + 0.02 * breathLag, 0.18 + 0.03 * breathLag]),
        ar: [0.16, 1.48],
        handL: isType && typeRamp > 0.45 ? 'grip' : 'relaxed',
        handR: 'grip',
        thumbScroll,
        thumbTap,
      });
      const sk = skeleton(x, gY, s, pose, flip);
      return {
        x,
        fy: gY,
        s,
        flip,
        seatedAtDesk: isSeated,
        seatedOnChair: isSeated,
        targetPropId: beat.target_prop || null,
        phoneAction: action,
        phoneHandMicro,
        phoneTypeRamp: typeRamp,
        lookX: 0.48,
        lookY: 0.30 + (isScroll ? 0.04 * Math.sin(swipeCyc * Math.PI * 2) : 0),
        interactionState: {
          phase: 'manipulation',
          targetPropType: 'phone',
          targetPropId: beat.target_prop || null,
          attached: true,
          contactProgress: 1.0,
        },
        pose,
        heldPhone: {
          inHand: true,
          hand: 'far',
          twoHand: isType,
          lit: true,
          scrollPhase: isScroll ? bt * 1.25 : (isType ? bt * 0.3 : 0),
          x: sk.world.gripR[0] + shFarOffX,
          y: sk.world.gripR[1] + 2.2 * s,
          facing,
        },
      };
    }

    if (action === 'put_down_phone') {
      const releaseAt = 0.66;
      let phase = 'anticipation';
      let handTarget = viewHand;
      let attached = true;
      let ikWeight = 1.0;
      let lean = isSeated ? 0.08 : 0.05;
      let head = 0.22;
      let handShape = 'grip';

      if (u < 0.15) {
        phase = 'anticipation';
        const au = ease(u / 0.15);
        handTarget = [viewHand[0], viewHand[1] - 3 * s * Math.sin(au * Math.PI)];
        head = lerp(0.22, 0.20, au);
      } else if (u < releaseAt) {
        phase = 'manipulation';
        const du = ease((u - 0.15) / (releaseAt - 0.15));
        handTarget = arcPoint(viewHand, surfaceContact, du, -14 * s);
        lean = lerp((isSeated ? 0.08 : 0.05), (isSeated ? 0.16 : 0.11), du);
        head = lerp(0.20, 0.22, du);
      } else if (u < 0.78) {
        phase = 'release';
        attached = false;
        handTarget = surfaceContact;
        lean = isSeated ? 0.15 : 0.10;
        head = 0.18;
        handShape = 'open';
      } else {
        phase = 'recovery';
        attached = false;
        const ru = ease((u - 0.78) / 0.22);
        handTarget = arcPoint(surfaceContact, restHand, ru, -12 * s);
        ikWeight = 1 - ru;
        lean = lerp((isSeated ? 0.15 : 0.10), (isSeated ? 0.05 : 0.02), ru);
        head = lerp(0.18, 0.02, ru);
        handShape = ru > 0.5 ? 'relaxed' : 'open';
      }

      const pose = P({
        ...baseLegs,
        lean,
        head,
        spineCurve: lerp(-1.2, 2.0, clamp((u - 0.66) / 0.34)) * s,
        ikwR: ikWeight,
        hr: handTarget,
        armBendR: -1,
        al: isSeated ? [0.24, 1.14] : [-0.05, 0.18],
        ar: isSeated ? [0.26, 1.18] : [0.06, 0.20],
        handL: 'relaxed',
        handR: handShape,
      });
      const sk = skeleton(x, gY, s, pose, flip);
      return {
        x,
        fy: gY,
        s,
        flip,
        seatedAtDesk: isSeated,
        seatedOnChair: isSeated,
        targetPropId: beat.target_prop || null,
        phoneAction: 'put_down_phone',
        phoneReleaseAt: releaseAt,
        phoneProgress: u,
        releaseXNorm: beat.release_x,
        lookX: attached ? 0.45 : lerp(0.45, 0.10, clamp((u - 0.66) / 0.34)),
        lookY: attached ? 0.30 : lerp(0.30, 0.02, clamp((u - 0.66) / 0.34)),
        interactionState: {
          phase,
          targetPropType: 'phone',
          targetPropId: beat.target_prop || null,
          attached,
          contactProgress: attached ? 1.0 : 1 - clamp((u - releaseAt) / 0.34),
        },
        pose,
        heldPhone: attached
          ? {
              inHand: true,
              hand: 'far',
              lit: u < 0.48,
              scrollPhase: 0,
              x: sk.world.gripR[0] + shFarOffX,
              y: sk.world.gripR[1] + 2.2 * s,
              facing,
            }
          : null,
      };
    }
  }

  if (action === 'interact_table') {
    // Approach/anticipation [0..0.18] -> curved reach to tabletop [0.18..0.42] -> tactile manipulation [0.42..0.78] -> release/recovery [0.78..1.0]
    const shY = gY - 115 * s - BONES.TORSO * s;
    const restPt = [x + facing * 14 * s, shY + 86 * s];
    const tablePt = [
      beat.target_x !== undefined ? beat.target_x * W : x + facing * 54 * s,
      gY - (beat.surface_height ?? 104) * s - 4 * s,
    ];
    let handPt = restPt;
    let ikwL = 0;
    let lean = 0.03;
    let head = 0.04;
    let phase = 'approach';
    let hShape = 'relaxed';

    if (u < 0.18) {
      phase = 'anticipation';
      const au = ease(u / 0.18);
      lean = lerp(0.03, 0.08, au);
      head = lerp(0.02, 0.16, au);
    } else if (u < 0.42) {
      phase = u < 0.36 ? 'approach' : 'contact';
      const ru = ease((u - 0.18) / 0.24);
      handPt = arcPoint(restPt, tablePt, ru, -18 * s);
      ikwL = ru;
      lean = lerp(0.08, 0.15, ru);
      head = lerp(0.16, 0.22, ru);
      hShape = 'open';
    } else if (u < 0.78) {
      phase = 'manipulation';
      const mu = (u - 0.42) / 0.36;
      const slide = Math.sin(mu * Math.PI * 2) * 8 * s;
      handPt = [tablePt[0] + facing * slide, tablePt[1] - Math.abs(Math.cos(mu * Math.PI * 2)) * 2 * s];
      ikwL = 1.0;
      lean = 0.15;
      head = 0.22;
      hShape = 'open';
    } else {
      phase = u < 0.86 ? 'release' : 'recovery';
      const ku = ease((u - 0.78) / 0.22);
      handPt = arcPoint(tablePt, restPt, ku, -12 * s);
      ikwL = 1 - ku;
      lean = lerp(0.15, 0.03, ku);
      head = lerp(0.22, 0.03, ku);
      hShape = ku > 0.5 ? 'relaxed' : 'open';
    }

    return {
      x,
      fy: gY,
      s,
      flip,
      tableAction: 'interact_table',
      tableProgress: u,
      targetPropId: beat.target_prop || null,
      lookX: 0.42 * ikwL,
      lookY: 0.26 * ikwL,
      interactionState: {
        phase,
        targetPropType: 'table',
        targetPropId: beat.target_prop || null,
        attached: u >= 0.42 && u < 0.78,
        contactProgress: ikwL,
      },
      pose: P({
        ...plantedStandingLegs(10, 12),
        lean,
        head,
        spineCurve: (2.2 - 2.0 * ikwL) * s,
        ikwL,
        hl: handPt,
        armBendL: -1,
        al: [0.12, 0.28],
        ar: [-0.08, 0.18],
        handL: hShape,
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'open_door') {
    // Synchronized door handle reach, grip, lever turn + swing, and release:
    // [0..0.18] Notice & anticipation -> [0.18..0.40] Curved reach to handle -> [0.40..0.80] Grip & swing door -> [0.80..1.0] Release & recover
    const shY = gY - 115 * s - BONES.TORSO * s;
    const restPt = [x + facing * 14 * s, shY + 86 * s];
    const defaultHandle = [x + facing * 62 * s, gY - 132 * s];
    let ikwL = 0;
    let handPt = restPt;
    let hShape = 'relaxed';
    let lean = 0.03;
    let head = 0.02;
    let phase = 'approach';
    let doorOpenProgress = 0;

    if (u < 0.18) {
      phase = 'anticipation';
      const au = ease(u / 0.18);
      lean = lerp(0.03, 0.07, au);
      head = lerp(0.0, 0.08, au);
    } else if (u < 0.40) {
      phase = u < 0.34 ? 'approach' : 'contact';
      const ru = ease((u - 0.18) / 0.22);
      handPt = arcPoint(restPt, defaultHandle, ru, -14 * s);
      ikwL = ru;
      lean = lerp(0.07, 0.11, ru);
      head = 0.08;
      hShape = ru > 0.75 ? 'grip' : 'open';
    } else if (u < 0.80) {
      phase = u < 0.48 ? 'grip' : 'manipulation';
      doorOpenProgress = ease((u - 0.44) / 0.36);
      handPt = [defaultHandle[0] - facing * 18 * s * doorOpenProgress, defaultHandle[1]];
      ikwL = 1.0;
      lean = lerp(0.11, 0.06, doorOpenProgress);
      head = 0.04;
      hShape = 'grip';
    } else {
      phase = u < 0.88 ? 'release' : 'recovery';
      doorOpenProgress = 1.0;
      const ku = ease((u - 0.80) / 0.20);
      const openHandlePt = [defaultHandle[0] - facing * 18 * s, defaultHandle[1]];
      handPt = arcPoint(openHandlePt, restPt, ku, -10 * s);
      ikwL = 1 - ku;
      lean = lerp(0.06, 0.03, ku);
      hShape = ku > 0.45 ? 'relaxed' : 'open';
    }

    return {
      x,
      fy: gY,
      s,
      flip,
      doorAction: 'open_door',
      doorProgress: u,
      doorOpenProgress,
      targetPropId: beat.target_prop || null,
      lookX: 0.38 * ikwL,
      lookY: 0.08 * ikwL,
      interactionState: {
        phase,
        targetPropType: 'door',
        targetPropId: beat.target_prop || null,
        attached: u >= 0.38 && u < 0.80,
        contactProgress: ikwL,
      },
      pose: P({
        ...plantedStandingLegs(11, 13),
        lean,
        head,
        spineCurve: 2.5 * s,
        ikwL,
        hl: handPt,
        armBendL: -1,
        al: [0.12, 0.26],
        ar: [-0.08, 0.16],
        handL: hShape,
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'react_surprise') {
    // Classical 3-beat reaction: [0..0.24] Crisp intake recoil -> [0.24..0.50] Tense alert breath -> [0.50..1.0] Balanced forward recovery!
    let recoil = 0;
    let recovery = 0;
    if (u < 0.24) {
      recoil = ease(u / 0.24);
    } else if (u < 0.50) {
      recoil = 1.0 + 0.08 * Math.sin(((u - 0.24) / 0.26) * Math.PI);
    } else {
      recovery = ease((u - 0.50) / 0.50);
      recoil = lerp(1.0, 0.22, recovery);
    }
    const tenseBreath = Math.sin(globalT * 3.8 + phaseSeed) * 0.015;
    const rc = clamp(recoil, 0, 1.10);
    return {
      x: x - facing * 3.8 * s * rc,
      fy: gY,
      s,
      flip,
      lookX: lerp(0.50, 0.28 + 0.12 * Math.sin(bt * 2.2), recovery),
      lookY: lerp(-0.10, 0.06, recovery),
      expression: beat.expression || (u < 0.54 ? 'shocked' : 'curious'),
      pose: P({
        ...plantedStandingLegs(10.5, 12.5),
        hipY: gY - (116.2 - 2.4 * rc) * s + tenseBreath * 16 * s,
        lean: lerp(-0.042 * rc, 0.032, recovery) + tenseBreath,
        head: lerp(-0.075 * rc, 0.035, recovery) + tenseBreath,
        spineCurve: lerp(3.6 * s * rc, 2.4 * s, recovery),
        // Tucked, organic human startle reflex near upper ribs (never stiff straight-out sleepwalker arms!)
        al: [lerp(0.09, 0.24, rc), lerp(0.24, 1.88, rc)],
        ar: [lerp(-0.07, 0.14, rc), lerp(0.16, 1.66, rc)],
        handL: rc > 0.35 ? 'open' : 'relaxed',
        handR: rc > 0.35 ? 'open' : 'relaxed',
      }),
    };
  }

  if (action === 'phone_call') {
    const nod = Math.sin(globalT * 2.2 + phaseSeed) * 0.04;
    const isSeated = Boolean(beat.seated);
    const pose = P(
      isSeated
        ? {
            hipY: gY - 63 * s,
            lean: 0.06 + nod * 0.5,
            head: 0.06 + nod,
            spineCurve: 2.0 * s,
            al: [1.16, 3.82],
            ar: [0.34, 1.38],
            ll: [1.44, 0.06],
            lr: [1.32, 0.16],
            legIkw: 0,
            handL: 'grip',
            handR: 'relaxed',
          }
        : {
            ...plantedStandingLegs(),
            lean: 0.03,
            head: 0.04 + nod,
            spineCurve: 2.5 * s,
            al: [1.16, 3.82],
            ar: [-0.08, 0.22],
            handL: 'grip',
            handR: 'relaxed',
          }
    );
    const sk = skeleton(x, gY, s, pose, flip);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose,
      seatedAtDesk: isSeated,
      heldPhone: {
        x: sk.world.al[2][0] - facing * 4 * s,
        y: sk.world.al[2][1] - 8 * s,
        facing,
      },
    };
  }

  if (action === 'kneel_exhausted') {
    const heavyBreath = Math.sin(globalT * 2.1 + phaseSeed);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 56 * s + heavyBreath * 1.1 * s,
        lean: 0.42 + 0.024 * heavyBreath,
        head: 0.38 + 0.03 * heavyBreath,
        spineCurve: (-7.5 - 0.9 * heavyBreath) * s,
        al: [0.65 + 0.025 * heavyBreath, 2.25],
        ar: [0.42 + 0.02 * heavyBreath, 0.25],
        ll: [1.45, 0.04],
        lr: [-0.25, -1.52],
        legIkw: 0,
        handL: 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'stand_up_resolve') {
    const kneel = computeBeatState({ ...beat, action: 'kneel_exhausted' }, 0, 1, globalT, W, floorY, s);
    const stand = P({
      hipY: gY - 115.5 * s,
      lean: 0.03,
      head: -0.04,
      spineCurve: 4.5 * s,
      al: [0.38, 1.85],
      ar: [-0.10, 0.16],
      ll: [-0.08, 0.02],
      lr: [0.12, -0.02],
      legIkw: 0,
      handL: 'fist',
      handR: 'relaxed',
    });
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: lerpPose(kneel.pose, stand, ease(u)),
    };
  }

  if (action === 'meditate_focus') {
    const floatY = Math.sin(globalT * 1.8) * 5 * s;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 46 * s + floatY,
        lean: 0.01,
        head: 0.04,
        spineCurve: 3.5 * s,
        al: [0.35, 1.38],
        ar: [-0.35, -1.38],
        ll: [1.28, -1.15],
        lr: [-1.28, 1.15],
        legIkw: 0,
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'handoff_give' || action === 'handoff_receive') {
    const r = ease(clamp(u * 1.4));
    return {
      x,
      fy: gY,
      s,
      flip,
      interactionType: 'handoff',
      partnerId: beat.partner_id || null,
      reachAmount: r,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.07 * r,
        head: 0.02,
        al: [lerp(0.22, 1.05, r), lerp(0.95, 1.48, r)],
        ar: [-0.08, 0.16],
        handL: 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'high_five') {
    const r = eo(clamp(u * 1.8));
    return {
      x,
      fy: gY,
      s,
      flip,
      interactionType: 'high_five',
      partnerId: beat.partner_id || null,
      reachAmount: r,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.06,
        head: -0.08,
        spineCurve: 3.5 * s,
        al: [lerp(0.3, 1.95, r), lerp(1.1, 2.38, r)],
        ar: [-0.10, 0.18],
        handL: 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'celebrate_arms_up') {
    const w = Math.sin(globalT * 5.0) * 0.12;
    const hop = Math.abs(Math.sin(globalT * 4.0)) * 6 * s;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(13, 14),
        hipY: gY - 115.5 * s - hop,
        lean: 0.01,
        head: -0.12,
        spineCurve: 5.0 * s,
        al: [2.48 + w, 2.75 + w],
        ar: [-2.35 - w, -2.68 - w],
        handL: 'open',
        handR: 'open',
      }),
    };
  }

  if (action === 'look_horizon') {
    return {
      x,
      fy: gY,
      s,
      flip,
      lookX: 0.42 + 0.10 * microGaze,
      lookY: -0.14 + 0.04 * breath,
      pose: P({
        ...plantedStandingLegs(11, 13),
        lean: 0.018 + 0.012 * breath + 0.010 * slowShift,
        head: -0.075 + 0.024 * breath + 0.015 * microGaze,
        spineCurve: (3.6 + 0.8 * breath) * s,
        al: [0.08 + 0.022 * breathLag, 0.22 + 0.038 * breathLag],
        ar: [-0.07 - 0.018 * breathLag, 0.15 + 0.032 * breathLag],
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  // Default: idle_stand (grounded IK stance feet, calm ribcage breathing, overlapping forearm lag, subtle eye-life)
  return {
    x,
    fy: gY,
    s,
    flip,
    // KI-019: a held pose used to be breathing only. Measured on an 8 s probe, character-region
    // motion was 0.500 versus 9.753 for `walk` — a 20x gap, i.e. the rig was moving so little it
    // read as a freeze-frame. Real animation rests with WEIGHT AND ATTENTION, not just a ribcage:
    // the body drifts onto one hip, the head keeps checking its surroundings, and the hands
    // resettle. Three desynchronised periods keep it from pulsing like a metronome.
    // KI-020: weight shift, head attention and arm resettle now come from the shared
    // secondary-motion layer so every hold is alive, not just this one. Keeping a private
    // copy here made the two fight each other and measured WORSE (0.601 -> 0.560).
    lookX: 0.16 + 0.12 * microGaze,
    lookY: 0.03 + 0.04 * slowShift,
    pose: P({
      ...plantedStandingLegs(10, 12),
      lean: 0.022 + 0.018 * breath + 0.010 * slowShift,
      head: 0.015 + 0.024 * breath + 0.016 * slowShift,
      spineCurve: (2.6 + 0.7 * breath) * s,
      al: [0.09 + 0.022 * breathLag, 0.22 + 0.038 * breathLag],
      ar: [-0.07 - 0.018 * breathLag, 0.15 + 0.032 * breathLag],
      handL: 'relaxed',
      handR: 'relaxed',
    }),
  };
}

function normalizeBeats(actor, sceneDur) {
  if (Array.isArray(actor.beats) && actor.beats.length > 0) {
    let cursor = 0;
    return actor.beats.map((b, idx) => {
      const start = b.start !== undefined ? b.start : cursor;
      const end = b.end !== undefined
        ? b.end
        : idx === actor.beats.length - 1
          ? sceneDur
          : start + sceneDur / actor.beats.length;
      cursor = end;
      return {
        ...actor,
        ...b,
        start,
        end: Math.max(start + 0.05, end),
      };
    });
  }
  return [{ ...actor, start: 0, end: Math.max(0.1, sceneDur) }];
}


/**
 * KI-020: shared secondary motion for stationary poses.
 *
 * Auditing every action by rendering it in isolation showed the problem was not
 * one pose. Character-region frame delta, median over an 8 s probe:
 *
 *   sit_bench 0.132 | hold_blueprint 0.213 | cross_arms_skeptical 0.290
 *   listen_nod 0.431 | look_horizon 0.491 | head_in_hands 0.586 | idle_stand 0.601
 *   talk_explain 1.092 | sketch_desk 1.666 | sit_desk_type 1.969
 *
 * Everything that moves the body through space lands near 2.0. Everything the
 * author holds still lands near 0.2-0.6 — a 10x gap, and `listen_nod` and
 * `look_horizon` are two of the most-used actions in the corpus (79 and 43
 * beats). Hand-tuning each pose fixes one action at a time and rots the moment
 * somebody adds the next one.
 *
 * So the motion is layered on top instead: every stationary pose gets weight
 * shift, head attention and breathing, at several desynchronised periods so it
 * never pulses like a metronome. Actions that already carry their own secondary
 * motion (walking, typing, sketching, gestures) are left exactly as authored —
 * this adds life to a hold, it does not smear a performance.
 *
 * Continuity: oscillator phase depends only on the actor, never on the beat,
 * so a cut cannot reset the oscillation. The amplitude has a 0.4 s eased envelope
 * at beat edges and is interpolated across blends. (Seeding on beat.start would
 * jump the phase at every cut.)
 *
 * Stillness control (KI-020 Phase 3): `secondary_motion` on a beat — or on the
 * actor, to cover a whole scene — scales the layer:
 *   "full"   (default) the full layer, preserving the KI-020 improvement
 *   "subtle" 0.35x, for a calmer hold
 *   "none"   no layer at all, for a deliberately frozen beat (dramatic pause,
 *            suspense, shock). The base pose keeps whatever motion it was
 *            authored with, so "none" is near-frozen, not a hard freeze-frame.
 * Unknown values fall back to "full" so a typo degrades gracefully.
 */
const SECONDARY_MOTION_ACTIONS = new Set([
  'idle_stand', 'listen_nod', 'nod_yes', 'look_horizon', 'cross_arms_skeptical',
  'hold_blueprint', 'head_in_hands', 'sit_bench', 'sit_chair', 'sit_bed_edge',
  'sit_cafe_listen', 'kneel_lookup', 'chest_hand_sincere', 'hold_umbrella',
  'think_ponder', 'wait_patient', 'stand_wait',
]);

const SECONDARY_MOTION_SCALE = { full: 1.0, subtle: 0.35, none: 0.0 };

function secondaryMotionScale(beat) {
  const v = beat && beat.secondary_motion;
  return Object.prototype.hasOwnProperty.call(SECONDARY_MOTION_SCALE, v)
    ? SECONDARY_MOTION_SCALE[v]
    : 1.0;
}

function secondaryMotionStrength(beat, ts) {
  const action = beat.action || 'idle_stand';
  if (!SECONDARY_MOTION_ACTIONS.has(action)) return 0;
  const base = secondaryMotionScale(beat);
  if (base === 0) return 0;
  // Ease the layer over 0.4 s at beat edges. In blend windows the outgoing and
  // incoming strengths are interpolated together, so a held pose never drops its
  // motion abruptly when handing off to a moving action (or vice versa).
  const ramp = 0.4;
  const fadeIn = Math.max(0, Math.min(1, (ts - beat.start) / ramp));
  const fadeOut = Math.max(0, Math.min(1, (beat.end - ts) / ramp));
  const edge = Math.min(fadeIn, fadeOut);
  const eased = edge * edge * (3 - 2 * edge);
  return base * eased;
}

function applySecondaryMotion(state, beat, globalT, amount = null) {
  if (!state || !state.pose) return state;
  const scale = amount === null ? secondaryMotionStrength(beat, globalT) : amount;
  if (scale === 0) return state;
  // Actor-only seed: continuous across beats, deterministic for a given frame.
  const seed = (beat._actorSeed || 0) * 7.3;
  const w = Math.sin(globalT * 0.31 + seed);
  const w2 = Math.sin(globalT * 0.47 + seed * 1.9);
  const w3 = Math.sin(globalT * 0.23 + seed * 2.7);
  const breathe = Math.sin(globalT * 1.55 + seed * 0.6);

  const pose = { ...state.pose };
  // Amplitudes are silhouette-scale on purpose. At 0.05 rad the motion is a tremor you can
  // only see in a frame diff; these read as the body settling, at roughly 6-14 degrees.
  pose.lean = (pose.lean ?? 0) + scale * (0.105 * w + 0.022 * breathe);
  pose.head = (pose.head ?? 0) + scale * (0.135 * w2 + 0.035 * breathe);
  pose.spineCurve = (pose.spineCurve ?? 0) + scale * 3.4 * w3 * (state.s ?? 1);
  if (Array.isArray(pose.al)) {
    pose.al = [pose.al[0] + scale * (0.175 * w2 + 0.05 * w), pose.al[1] + scale * (0.245 * w3 + 0.045 * breathe)];
  }
  if (Array.isArray(pose.ar)) {
    pose.ar = [pose.ar[0] + scale * (0.155 * w3 - 0.05 * w), pose.ar[1] + scale * (0.215 * w + 0.045 * breathe)];
  }
  return {
    ...state,
    pose,
    lookX: (state.lookX ?? 0) + scale * (0.26 * w3 + 0.08 * w),
    lookY: (state.lookY ?? 0) + scale * 0.075 * w2,
  };
}

function evaluateCharacterState(actor, ts, sceneDur, globalT, W, floorY, speechCtx = null) {
  const beats = normalizeBeats(actor, sceneDur);
  const scale = actor.scale ?? 1.0;
  const actorIdStr = String(actor.id || 'char');
  let actorSeed = 0;
  for (let i = 0; i < actorIdStr.length; i++) actorSeed = (actorSeed * 31 + actorIdStr.charCodeAt(i)) % 997;
  actorSeed = actorSeed / 997;

  const isSpeaking = Boolean(speechCtx && speechCtx.activeSpeaker && speechCtx.activeSpeaker === actorIdStr.toLowerCase());
  const hasDialogueInScene = Boolean(speechCtx && speechCtx.hasCharacterDialogue);

  let activeIdx = 0;
  for (let i = 0; i < beats.length; i++) {
    if (ts >= beats[i].start) activeIdx = i;
  }
  const prevActionName = activeIdx > 0 ? (beats[activeIdx - 1].action || 'idle_stand') : null;
  const cur = {
    ...beats[activeIdx],
    _prevAction: prevActionName,
    _actorSeed: actorSeed,
    _isSpeaking: isSpeaking,
    _hasDialogueInScene: hasDialogueInScene,
  };
  const curDur = Math.max(0.05, cur.end - cur.start);
  const curState = computeBeatState(cur, clamp(ts - cur.start, 0, curDur), curDur, globalT, W, floorY, scale);

  const PHONE_CHAIN_ACTIONS = new Set([
    'reach_phone',
    'pick_up_phone',
    'hold_phone',
    'phone_scroll',
    'phone_type',
    'put_down_phone',
  ]);
  const SEAT_CHAIN_ACTIONS = new Set([
    'sit_down',
    'sit_chair',
    'sit_desk_type',
    'sit_desk_slump',
    'stand_from_desk',
  ]);
  const curAct = cur.action || 'idle_stand';
  const isTightHandoff =
    (prevActionName && PHONE_CHAIN_ACTIONS.has(prevActionName) && PHONE_CHAIN_ACTIONS.has(curAct)) ||
    (prevActionName && SEAT_CHAIN_ACTIONS.has(prevActionName) && SEAT_CHAIN_ACTIONS.has(curAct));

  const baseBlendWin = isTightHandoff ? 0.12 : 0.36;
  let blendWin = baseBlendWin;
  if (activeIdx > 0) {
    const prev = {
      ...beats[activeIdx - 1],
      _prevAction: activeIdx > 1 ? (beats[activeIdx - 2].action || 'idle_stand') : null,
      _actorSeed: actorSeed,
      _isSpeaking: isSpeaking,
      _hasDialogueInScene: hasDialogueInScene,
    };
    const prevDur = Math.max(0.05, prev.end - prev.start);
    const prevState = computeBeatState(prev, prevDur, prevDur, globalT, W, floorY, scale);
    const curDur_peek = Math.max(0.05, cur.end - cur.start);
    const curState_peek = computeBeatState(cur, 0, curDur_peek, globalT, W, floorY, scale);
    const heightDelta = Math.abs(prevState.fy - curState_peek.fy);
    blendWin = Math.min(0.8, baseBlendWin + heightDelta * 0.001);
  }
  if (activeIdx > 0 && ts - cur.start < blendWin) {
    const prev = {
      ...beats[activeIdx - 1],
      _prevAction: activeIdx > 1 ? (beats[activeIdx - 2].action || 'idle_stand') : null,
      _actorSeed: actorSeed,
      _isSpeaking: isSpeaking,
      _hasDialogueInScene: hasDialogueInScene,
    };
    const prevDur = Math.max(0.05, prev.end - prev.start);
    const prevState = computeBeatState(prev, prevDur, prevDur, globalT, W, floorY, scale);
    const k = ease(clamp((ts - cur.start) / blendWin));
    const flipChanged = prevState.flip !== curState.flip;
    const baseTurn = flipChanged ? Math.max(0.24, Math.abs(Math.cos(k * Math.PI))) : 1.0;
    const turnScaleX = baseTurn * lerp(prevState.turnScaleX ?? 1.0, curState.turnScaleX ?? 1.0, k);
    const pose = prevState.flip === curState.flip
      ? lerpPose(prevState.pose, curState.pose, k)
      : (k < 0.5 ? prevState.pose : curState.pose);
    const prevHasPropAlign = Boolean(prevState.phoneAction || prevState.tableAction || prevState.doorAction);
    const curHasPropAlign = Boolean(curState.phoneAction || curState.tableAction || curState.doorAction);

    return applySecondaryMotion({
      x: lerp(prevState.x, curState.x, k),
      fy: lerp(prevState.fy, curState.fy, k),
      s: scale,
      flip: k < 0.5 ? prevState.flip : curState.flip,
      turnScaleX,
      pose,
      propAlignWeight: lerp(prevHasPropAlign ? 1 : 0, curHasPropAlign ? 1 : 0, k),
      propAlignOnly: !curHasPropAlign && prevHasPropAlign,
      seatedAtDesk: curState.seatedAtDesk || (k < 0.45 && prevState.seatedAtDesk),
      seatedOnChair: curState.seatedOnChair || prevState.seatedOnChair,
      seatDescentProgress: lerp(
        prevState.seatedOnChair ? (prevState.seatDescentProgress ?? 1.0) : 0.0,
        curState.seatedOnChair ? (curState.seatDescentProgress ?? 1.0) : 0.0,
        k
      ),
      sketchingAtDesk: curState.sketchingAtDesk || prevState.sketchingAtDesk,
      sketchDeskWeight: lerp(prevState.sketchingAtDesk ? 1 : 0, curState.sketchingAtDesk ? 1 : 0, k),
      sketchStroke: curState.sketchStroke ?? prevState.sketchStroke,
      sketchSweep: curState.sketchSweep ?? prevState.sketchSweep,
      typingTapL: curState.typingTapL ?? prevState.typingTapL,
      typingTapR: curState.typingTapR ?? prevState.typingTapR,
      typingDeskWeight: lerp(prevState.typingTapL !== undefined ? 1 : 0, curState.typingTapL !== undefined ? 1 : 0, k),
      targetPropId: curState.targetPropId || prevState.targetPropId || null,
      phoneAction: curState.phoneAction || prevState.phoneAction || null,
      phoneHandMicro: curState.phoneHandMicro || prevState.phoneHandMicro,
      phoneTypeRamp: curState.phoneTypeRamp ?? prevState.phoneTypeRamp,
      phoneReachFrac: curState.phoneReachFrac,
      phoneGripEnd: curState.phoneGripEnd,
      phoneReleaseAt: curState.phoneReleaseAt,
      phoneProgress: curState.phoneProgress ?? prevState.phoneProgress,
      releaseXNorm: curState.releaseXNorm ?? prevState.releaseXNorm,
      tableAction: curState.tableAction || prevState.tableAction,
      tableProgress: curState.tableProgress ?? prevState.tableProgress,
      doorAction: curState.doorAction || prevState.doorAction,
      doorProgress: curState.doorProgress ?? prevState.doorProgress,
      doorOpenProgress: curState.doorOpenProgress,
      interactionState: curState.interactionState || prevState.interactionState || null,
      interactionType: curState.interactionType,
      partnerId: curState.partnerId,
      wrapAmount: curState.wrapAmount,
      reachAmount: curState.reachAmount,
      heldPhone: curState.heldPhone || (k < 0.45 ? prevState.heldPhone : null),
      heldPen: curState.heldPen || (k < 0.45 ? prevState.heldPen : null),
      heldCup: curState.heldCup,
      heldBlueprint: curState.heldBlueprint,
      heldUmbrella: curState.heldUmbrella,
      heldDrawing: curState.heldDrawing,
      wetShoulder: curState.wetShoulder,
      pushedBoulder: curState.pushedBoulder,
      callout: cur.callout,
      expression: curState.expression || cur.expression,
      actorSeed,
      lookX: lerp(prevState.lookX ?? prev.look_x ?? prev.lookX ?? 0, curState.lookX ?? cur.look_x ?? cur.lookX ?? 0, k),
      lookY: lerp(prevState.lookY ?? prev.look_y ?? prev.lookY ?? 0, curState.lookY ?? cur.look_y ?? cur.lookY ?? 0, k),
      posture: Number.isFinite(prev.posture) && Number.isFinite(cur.posture)
        ? lerp(prev.posture, cur.posture, k)
        : cur.posture,
    }, cur, globalT, lerp(
      secondaryMotionStrength(prev, ts),
      secondaryMotionStrength(cur, ts),
      k
    ));
  }

  curState.turnScaleX = curState.turnScaleX ?? 1.0;
  const prevWasPropAlign = Boolean(
    prevActionName && (PHONE_CHAIN_ACTIONS.has(prevActionName) || prevActionName === 'interact_table' || prevActionName === 'open_door')
  );
  curState.propAlignWeight = (curState.phoneAction || curState.tableAction || curState.doorAction)
    ? (activeIdx === 0 || prevWasPropAlign ? 1.0 : ease(clamp((ts - cur.start) / Math.max(0.24, blendWin))))
    : 0.0;
  curState.propAlignOnly = false;
  curState.sketchDeskWeight = curState.sketchingAtDesk ? 1.0 : 0.0;
  curState.typingDeskWeight = curState.typingTapL !== undefined ? 1.0 : 0.0;
  curState.callout = cur.callout;
  curState.expression = curState.expression || cur.expression;
  curState.actorSeed = actorSeed;
  curState.lookX = curState.lookX ?? cur.look_x ?? cur.lookX ?? 0;
  curState.lookY = curState.lookY ?? cur.look_y ?? cur.lookY ?? 0;
  curState.posture = cur.posture;
  // KI-020: shared secondary motion, so a held pose is a resting body not a freeze-frame.
  return applySecondaryMotion(curState, cur, globalT, secondaryMotionStrength(cur, ts));
}

/**
 * Pure deterministic prop + actor physical interaction solver at scene timestamp `ts`:
 *  1. Evaluates persistent prop timeline history across `[0..ts]` (so a phone picked up in beat 2
 *     stays attached in beat 3 and stays at its released tabletop position in beat 5 across parallel workers!).
 *  2. Binds actor IK hand targets, chair/desk seat heights, laptop keyboard contact, tabletop contact,
 *     and door-handle trajectories to the ACTUAL world coordinates of the scene's props!
 */
function resolveScenePropInteractions(rawProps, entries, actors, ts, sceneDur, W = 1920, floorY = 855) {
  const props = (rawProps || []).map((p) => ({ ...p }));
  if (props.length === 0) return props;

  // Auto-snap surface props (`phone`, `laptop`, `computer`, `cup`, `book`, `books`) resting over or near
  // a `desk`/`table` so they always sit flush on the real tabletop and never hover off the table edge!
  const surfaces = props
    .filter((p) => p.type === 'desk' || p.type === 'clean_desk' || p.type === 'messy_desk' || p.type === 'table' || p.type === 'cafe_table')
    .map((p) => computePropAnchors(p, W, floorY));
  for (const p of props) {
    if (
      p.elevation !== 0 &&
      (p.type === 'phone' || p.type === 'laptop' || p.type === 'computer' || p.type === 'cup' || p.type === 'book' || p.type === 'books')
    ) {
      const px = (p.x ?? 0.5) * W;
      const host = surfaces.find((sf) => sf && px >= (sf.tabletopLeft ?? sf.bounds.left) - 42 && px <= (sf.tabletopRight ?? sf.bounds.right) + 42);
      if (host && Number.isFinite(host.surfaceTopY)) {
        p.elevation = floorY - host.surfaceTopY;
        const leftLim = (host.tabletopLeft ?? host.bounds.left) + 18 * (host.scale || 1);
        const rightLim = (host.tabletopRight ?? host.bounds.right) - 18 * (host.scale || 1);
        if (rightLim > leftLim) {
          p.x = clamp(px, leftLim, rightLim) / W;
        }
      }
    }
  }

  const findMatchingProp = (typeSet, targetId, refX) => {
    if (targetId) {
      const exact = props.find((p) => p.id && String(p.id) === String(targetId));
      if (exact) return exact;
    }
    let best = null;
    let bestD = Infinity;
    for (const p of props) {
      if (!typeSet.has(p.type)) continue;
      const d = Math.abs(((p.x ?? 0.5) * W) - refX);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  };

  // Step A: Reconstruct deterministic persistent prop state up to `ts` from actor beat history
  for (const actor of (actors || [])) {
    const beats = normalizeBeats(actor, sceneDur);
    for (let bi = 0; bi < beats.length; bi++) {
      const b = beats[bi];
      if (ts < b.start) break;
      const bDur = Math.max(0.05, b.end - b.start);
      const localU = ts >= b.end ? 1.0 : clamp((ts - b.start) / bDur);
      const act = b.action || 'idle_stand';
      const actorX = ((b.toX ?? b.to_x ?? b.x ?? 0.5) * W);

      if (act === 'pick_up_phone' || act === 'hold_phone' || act === 'phone_scroll' || act === 'phone_type') {
        const phoneProp = findMatchingProp(new Set(['phone']), b.target_prop, actorX);
        if (phoneProp) {
          const prevAct = bi > 0 ? beats[bi - 1].action : null;
          const reachFrac = act === 'pick_up_phone' ? (prevAct === 'reach_phone' ? 0.08 : 0.36) : 0;
          if (localU >= reachFrac) {
            phoneProp._attachedToActor = actor.id || 'char';
          }
        }
      } else if (act === 'put_down_phone') {
        const phoneProp = findMatchingProp(new Set(['phone']), b.target_prop, actorX);
        if (phoneProp) {
          if (localU < 0.66) {
            phoneProp._attachedToActor = actor.id || 'char';
          } else {
            phoneProp._attachedToActor = null;
            if (b.release_x !== undefined) {
              phoneProp.x = b.release_x;
              const px = b.release_x * W;
              const host = surfaces.find((sf) => sf && px >= sf.bounds.left - 30 && px <= sf.bounds.right + 30);
              if (host && Number.isFinite(host.surfaceTopY)) {
                phoneProp.elevation = floorY - host.surfaceTopY;
              }
            }
          }
        }
      } else if (act === 'open_door') {
        const doorProp = findMatchingProp(new Set(['door']), b.target_prop, actorX);
        if (doorProp) {
          const initialOpen = Number(doorProp._baseOpen ?? doorProp.open ?? 0.0);
          doorProp._baseOpen = initialOpen;
          const targetOpen = Number(b.target_open ?? 0.85);
          if (localU >= 0.40) {
            const openU = localU >= 0.80 ? 1.0 : ease((localU - 0.40) / 0.40);
            doorProp.open = lerp(initialOpen, targetOpen, openU);
          } else {
            doorProp.open = initialOpen;
          }
        }
      }
    }
  }

  // Step B: Bind active character IK/seat/hand targets to exact live prop coordinates!
  for (const entry of (entries || [])) {
    const st = entry.state;
    const s = st.s || 1.0;
    let facing = st.flip ? -1 : 1;

    const alignStandingReach = (anchorX, maxReach = 60 * s, obstacleBounds = null) => {
      if (st.seatedOnChair || st.seatedAtDesk || !Number.isFinite(anchorX)) return;
      const dx = anchorX - st.x;
      if (Math.abs(dx) <= maxReach || Math.abs(dx) > 360 * s) return;
      const dir = dx >= 0 ? 1 : -1;
      let targetX = anchorX - dir * maxReach;
      // Never step inside the solid span of a table/desk while standing beside it
      if (obstacleBounds && targetX > obstacleBounds.left - 16 * s && targetX < obstacleBounds.right + 16 * s) {
        targetX = dir >= 0 ? obstacleBounds.left - 16 * s : obstacleBounds.right + 16 * s;
      }
      const alignW = clamp(st.propAlignWeight ?? 1.0);
      const newX = lerp(st.x, targetX, alignW);
      const shift = newX - st.x;
      st.x = newX;
      if (alignW > 0.35) {
        st.flip = dir < 0;
        facing = dir;
      }
      if (st.pose.fl) st.pose.fl = [st.pose.fl[0] + shift, st.pose.fl[1]];
      if (st.pose.fr) st.pose.fr = [st.pose.fr[0] + shift, st.pose.fr[1]];
      if (st.pose.hr) st.pose.hr = [st.pose.hr[0] + shift, st.pose.hr[1]];
    };

    // 1. Chair / Desk / Sofa seating grounding (exact thigh-to-seat + foot-to-floor contact!)
    if (st.seatedOnChair || st.seatedAtDesk) {
      const seatProp = findMatchingProp(
        new Set(['desk', 'clean_desk', 'messy_desk', 'chair', 'sofa', 'bench']),
        st.targetPropId,
        st.x
      );
      if (seatProp) {
        const anc = computePropAnchors(seatProp, W, floorY);
        if (anc && Math.abs(anc.seatX - st.x) < 240) {
          const targetSeatHipY = anc.seatTopY - 11.2 * s;
          const descU = clamp(st.seatDescentProgress ?? 1.0);
          const seatBlend = ease(descU);
          if (seatBlend > 0.001) {
            st.x = lerp(st.x, anc.seatX, seatBlend * 0.88);
            st.pose.hipY = lerp(st.pose.hipY ?? (st.fy - 116.2 * s), targetSeatHipY, seatBlend);
            const footReach = lerp(10 * s, 34 * s, seatBlend);
            const curFlX = st.pose.fl ? st.pose.fl[0] : (st.x + facing * 10 * s);
            const curFrX = st.pose.fr ? st.pose.fr[0] : (st.x - facing * 10 * s);
            st.pose.fl = [lerp(curFlX, st.x + facing * footReach, seatBlend), st.fy];
            st.pose.fr = [lerp(curFrX, st.x + facing * (footReach - 9 * s), seatBlend), st.fy];
            st.pose.legIkw = 1;
          }

          // Exact keyboard hand contact when typing at a desk or laptop!
          if (st.typingTapL !== undefined) {
            const laptopProp = findMatchingProp(new Set(['laptop', 'computer']), null, anc.centerX);
            const kbAnchor = laptopProp
              ? computePropAnchors(laptopProp, W, floorY).keyboardContact
              : anc.keyboardContact;
            if (kbAnchor) {
              const tw = ease(clamp(st.typingDeskWeight ?? 1.0));
              const tapL = Math.max(0, st.typingTapL || 0) * 3.2 * s;
              const tapR = Math.max(0, st.typingTapR || 0) * 3.2 * s;
              st.pose.ikwL = 0.96 * tw;
              st.pose.ikwR = 0.94 * tw;
              st.pose.hl = [kbAnchor[0] - facing * 4 * s, kbAnchor[1] - tapL];
              st.pose.hr = [kbAnchor[0] + facing * 5 * s, kbAnchor[1] - tapR - 1.5 * s];
              st.pose.armBendL = -1;
              st.pose.armBendR = -1;
            }
          } else if (st.sketchingAtDesk && Number.isFinite(anc.surfaceTopY)) {
            // Smooth pen-on-paper tabletop contact across any character/desk scale!
            const swDesk = ease(clamp(st.sketchDeskWeight ?? 1.0));
            const stroke = Number(st.sketchStroke || 0);
            const sweep = Number(st.sketchSweep || 0);
            const writeX = clamp(
              st.x + facing * (52 + 8.5 * stroke + 4.5 * sweep) * s,
              anc.bounds.left + 20,
              anc.bounds.right - 20
            );
            const restX = clamp(st.x + facing * 42 * s, anc.bounds.left + 16, anc.bounds.right - 24);
            const writeY = anc.surfaceTopY - (4.5 + Math.max(0, -stroke) * 2.2) * s;
            st.pose.ikwL = 0.95 * swDesk;
            st.pose.ikwR = 0.90 * swDesk;
            st.pose.hl = [writeX + facing * 16 * s, writeY];
            st.pose.hr = [restX - facing * 14 * s, anc.surfaceTopY - 4.0 * s];
            st.pose.armBendL = -1;
            st.pose.armBendR = -1;
            const skDesk = skeleton(st.x, st.fy, s, st.pose, st.flip);
            st.heldPen = swDesk > 0.35
              ? { x: skDesk.world.al[2][0] - facing * 16 * s, y: skDesk.world.al[2][1] + 2 * s, dir: facing }
              : null;
          }
        }
      }
    }

    // 2. Phone reach / pickup / hold / scroll / type / put-down world-prop binding
    if (st.phoneAction) {
      const phoneProp = findMatchingProp(new Set(['phone']), st.targetPropId, st.x);
      const surfaceProp = findMatchingProp(new Set(['table', 'desk', 'clean_desk', 'messy_desk', 'cafe_table']), null, st.x);
      const surfAnc = surfaceProp ? computePropAnchors(surfaceProp, W, floorY) : null;
      const phoneAnc = phoneProp ? computePropAnchors(phoneProp, W, floorY) : null;

      let contactPt = null;
      if (st.phoneAction === 'put_down_phone' && st.releaseXNorm !== undefined) {
        const rx = st.releaseXNorm * W;
        const ry = surfAnc ? surfAnc.surfaceTopY - 3 * s : (phoneAnc ? phoneAnc.gripAnchor[1] : st.fy - 106 * s);
        contactPt = [rx, ry];
      } else if (phoneAnc) {
        contactPt = phoneAnc.gripAnchor;
      } else if (surfAnc) {
        contactPt = [st.x + facing * 48 * s, surfAnc.surfaceTopY - 3 * s];
      }

      if (contactPt) {
        alignStandingReach(contactPt[0], 58 * s, surfAnc ? surfAnc.bounds : null);
        if (st.propAlignOnly) {
          // Exiting a phone/table/door beat into a non-prop beat: align `st.x` smoothly by `propAlignWeight` (`1 -> 0`)
          // without overwriting the blended `lerpPose` hand target!
          continue;
        }
        // Clamp release X inside reachable span of surface so arm never overstretches across a wide table
        if (st.phoneAction === 'put_down_phone' && Math.abs(contactPt[0] - st.x) > 78 * s) {
          contactPt = [st.x + facing * 74 * s, contactPt[1]];
        }
        const shFarOffX = facing * 19.5 * s;
        const shY = (st.pose.hipY ?? (st.fy - 115 * s)) - BONES.TORSO * s;
        const restHand = [st.x + facing * 6 * s, shY + 86 * s];
        const micro = st.phoneHandMicro || [0, 0];
        const viewHand = [st.x + facing * 62 * s + micro[0], shY + 46 * s + micro[1]];
        const adjContactPt = [contactPt[0] - shFarOffX, contactPt[1] - 2.6 * s];

        if (st.phoneAction === 'reach_phone') {
          const ru = clamp(st.phoneProgress ?? 1);
          st.pose.hr = arcPoint(restHand, adjContactPt, ru, -20 * s);
        } else if (st.phoneAction === 'pick_up_phone') {
          const u = clamp(st.phoneProgress ?? 1);
          const rf = st.phoneReachFrac ?? 0.36;
          const ge = st.phoneGripEnd ?? 0.48;
          if (u < rf) {
            st.pose.hr = rf <= 0.10 ? adjContactPt : arcPoint(restHand, adjContactPt, ease(u / rf), -18 * s);
          } else if (u < ge) {
            st.pose.hr = adjContactPt;
          } else {
            const liftU = springEase(clamp((u - ge) / (1 - ge)), { bounce: 0.08 });
            st.pose.hr = arcPoint(adjContactPt, viewHand, liftU, -14 * s);
          }
        } else if (st.phoneAction === 'hold_phone' || st.phoneAction === 'phone_scroll' || st.phoneAction === 'phone_type') {
          st.pose.hr = viewHand;
          if (st.phoneAction === 'phone_type') {
            const tr = clamp(st.phoneTypeRamp ?? 1.0);
            st.pose.ikwL = 0.92 * tr;
            st.pose.hl = [viewHand[0] + shFarOffX + facing * 12.0 * s, viewHand[1] + 4.5 * s];
          }
        } else if (st.phoneAction === 'put_down_phone') {
          const u = clamp(st.phoneProgress ?? 1);
          const relAt = st.phoneReleaseAt ?? 0.66;
          if (u < 0.15) {
            st.pose.hr = viewHand;
          } else if (u < relAt) {
            st.pose.hr = arcPoint(viewHand, adjContactPt, ease((u - 0.15) / (relAt - 0.15)), -14 * s);
          } else if (u < 0.78) {
            st.pose.hr = adjContactPt;
          } else {
            st.pose.hr = arcPoint(adjContactPt, restHand, ease((u - 0.78) / 0.22), -12 * s);
          }
        }
        if (st.heldPhone) {
          const sk = skeleton(st.x, st.fy, s, st.pose, st.flip);
          st.heldPhone.x = sk.world.gripR[0] + shFarOffX;
          st.heldPhone.y = sk.world.gripR[1] + 2.2 * s;
        }
      }
    }

    // 3. Table surface interaction binding
    if (st.tableAction === 'interact_table') {
      const tableProp = findMatchingProp(new Set(['table', 'cafe_table', 'desk', 'clean_desk']), st.targetPropId, st.x);
      if (tableProp) {
        const tAnc = computePropAnchors(tableProp, W, floorY);
        if (tAnc && Number.isFinite(tAnc.surfaceTopY)) {
          const nearEdgeX = st.x <= tAnc.centerX ? tAnc.bounds.left + 22 : tAnc.bounds.right - 22;
          alignStandingReach(nearEdgeX, 54 * s);
          if (st.propAlignOnly) continue;
          const shY = (st.pose.hipY ?? (st.fy - 115 * s)) - BONES.TORSO * s;
          const restPt = [st.x + facing * 14 * s, shY + 86 * s];
          const contactX = clamp(st.x + facing * 54 * s, tAnc.bounds.left + 18, tAnc.bounds.right - 18);
          const tablePt = [contactX, tAnc.surfaceTopY - 4 * s];
          const u = clamp(st.tableProgress ?? 0.5);
          if (u >= 0.18 && u < 0.42) {
            st.pose.hl = arcPoint(restPt, tablePt, ease((u - 0.18) / 0.24), -18 * s);
          } else if (u >= 0.42 && u < 0.78) {
            const mu = (u - 0.42) / 0.36;
            st.pose.hl = [tablePt[0] + facing * Math.sin(mu * Math.PI * 2) * 8 * s, tablePt[1]];
          } else if (u >= 0.78) {
            st.pose.hl = arcPoint(tablePt, restPt, ease((u - 0.78) / 0.22), -12 * s);
          }
        }
      }
    }

    // 4. Door handle tracking (`0.0px` miss throughout door swing!)
    if (st.doorAction === 'open_door') {
      const doorProp = findMatchingProp(new Set(['door']), st.targetPropId, st.x);
      if (doorProp) {
        const dAnc = computePropAnchors(doorProp, W, floorY);
        if (dAnc && dAnc.handleGrip) {
          alignStandingReach(dAnc.handleGrip[0], 56 * s);
          if (st.propAlignOnly) continue;
          const shY = (st.pose.hipY ?? (st.fy - 115 * s)) - BONES.TORSO * s;
          const restPt = [st.x + facing * 14 * s, shY + 86 * s];
          const u = clamp(st.doorProgress ?? 0.5);
          if (u >= 0.18 && u < 0.40) {
            st.pose.hl = arcPoint(restPt, dAnc.handleGrip, ease((u - 0.18) / 0.22), -14 * s);
          } else if (u >= 0.40 && u < 0.80) {
            st.pose.hl = dAnc.handleGrip;
          } else if (u >= 0.80) {
            st.pose.hl = arcPoint(dAnc.handleGrip, restPt, ease((u - 0.80) / 0.20), -10 * s);
          }
        }
      }
    }
  }

  return props;
}

/**
 * Paired 2-Actor World-Space Interaction & Eye-Line Solver:
 * - Resolves `hug` & `hug_kneel` into intimate embrace spacing + cross-torso IK arm wraps + interleaved draw group
 * - Resolves `handshake`, `high_five`, & `handoff` to exact shared world-space contact points (`0.0px` miss!)
 * - Automatically orients listener eye-lines (`lookX`, `lookY`) toward active speakers
 */
function resolveSceneInteractions(entries, globalT = 0, speechState = null) {
  // `entries` is `[{ actor, state }, ...]`
  const paired = new Set();
  let hugGroupCounter = 1;

  for (let i = 0; i < entries.length; i++) {
    if (paired.has(i)) continue;
    const A = entries[i];
    const iType = A.state.interactionType;
    if (!iType) continue;

    // Find best partner `j`
    let partnerIdx = -1;
    let bestDist = Infinity;
    for (let j = i + 1; j < entries.length; j++) {
      if (paired.has(j)) continue;
      const B = entries[j];
      const explicitMatch =
        (A.state.partnerId && String(B.actor.id) === String(A.state.partnerId)) ||
        (B.state.partnerId && String(A.actor.id) === String(B.state.partnerId));
      const compatibleType =
        B.state.interactionType === iType ||
        (iType === 'hug' && B.state.interactionType === 'hug_kneel') ||
        (iType === 'hug_kneel' && B.state.interactionType === 'hug');
      if (explicitMatch || compatibleType) {
        const d = Math.abs(A.state.x - B.state.x);
        if (explicitMatch || d < bestDist) {
          bestDist = d;
          partnerIdx = j;
          if (explicitMatch) break;
        }
      }
    }

    if (partnerIdx === -1) continue;
    paired.add(i);
    paired.add(partnerIdx);

    const B = entries[partnerIdx];
    const leftEntry = A.state.x <= B.state.x ? A : B;
    const rightEntry = A.state.x <= B.state.x ? B : A;
    const sL = leftEntry.state.s || 1.0;
    const sR = rightEntry.state.s || 1.0;
    const avgS = 0.5 * (sL + sR);
    const midX = 0.5 * (leftEntry.state.x + rightEntry.state.x);

    if (iType === 'hug' || iType === 'hug_kneel') {
      const wrap = Math.max(leftEntry.state.wrapAmount ?? 1, rightEntry.state.wrapAmount ?? 1);
      const halfSpan0 = Math.max(22 * avgS, 0.5 * Math.abs(rightEntry.state.x - leftEntry.state.x));
      const embraceHalf = 22 * avgS;
      const curHalf = lerp(halfSpan0, embraceHalf, wrap);

      leftEntry.state.x = midX - curHalf;
      rightEntry.state.x = midX + curHalf;
      leftEntry.state.flip = false; // faces right
      rightEntry.state.flip = true; // faces left

      // Re-anchor planted stance feet if standing so feet move with embrace step
      if (leftEntry.state.pose.fl && leftEntry.state.pose.fr) {
        leftEntry.state.pose.fl = [leftEntry.state.x + 10 * sL, leftEntry.state.fy];
        leftEntry.state.pose.fr = [leftEntry.state.x - 12 * sL, leftEntry.state.fy];
      }
      if (rightEntry.state.pose.fl && rightEntry.state.pose.fr) {
        rightEntry.state.pose.fl = [rightEntry.state.x - 10 * sR, rightEntry.state.fy];
        rightEntry.state.pose.fr = [rightEntry.state.x + 12 * sR, rightEntry.state.fy];
      }

      const skL = skeleton(leftEntry.state.x, leftEntry.state.fy, sL, leftEntry.state.pose, false);
      const skR = skeleton(rightEntry.state.x, rightEntry.state.fy, sR, rightEntry.state.pose, true);

      // Left character's front arm wraps across Right character's mid-back; Right character's front arm wraps across Left character's upper back!
      leftEntry.state.pose.ikw = 0.92 * wrap;
      leftEntry.state.pose.hl = [skR.world.shoulder[0] + 14 * sR, skR.world.shoulder[1] + 28 * sR];
      leftEntry.state.pose.hr = [skR.world.shoulder[0] + 6 * sR, skR.world.shoulder[1] + 8 * sR];
      leftEntry.state.pose.armBendL = -1;
      leftEntry.state.pose.armBendR = -1;

      rightEntry.state.pose.ikw = 0.92 * wrap;
      rightEntry.state.pose.hl = [skL.world.shoulder[0] - 14 * sL, skL.world.shoulder[1] + 18 * sL];
      rightEntry.state.pose.hr = [skL.world.shoulder[0] - 8 * sL, skL.world.shoulder[1] + 34 * sL];
      rightEntry.state.pose.armBendL = -1;
      rightEntry.state.pose.armBendR = -1;

      const gid = hugGroupCounter++;
      leftEntry.state.hugGroupId = gid;
      rightEntry.state.hugGroupId = gid;
    } else if (iType === 'handshake' || iType === 'high_five' || iType === 'handoff') {
      const reach = Math.min(leftEntry.state.reachAmount ?? 1, rightEntry.state.reachAmount ?? 1);
      const idealHalf = (iType === 'high_five' ? 52 : 55) * avgS;
      const curHalf0 = 0.5 * Math.abs(rightEntry.state.x - leftEntry.state.x);
      if (curHalf0 > idealHalf * 1.04) {
        const adjHalf = lerp(curHalf0, idealHalf, reach * 0.92);
        leftEntry.state.x = midX - adjHalf;
        rightEntry.state.x = midX + adjHalf;
        if (leftEntry.state.pose.fl && leftEntry.state.pose.fr) {
          leftEntry.state.pose.fl = [leftEntry.state.x + 12 * sL, leftEntry.state.fy];
          leftEntry.state.pose.fr = [leftEntry.state.x - 13 * sL, leftEntry.state.fy];
        }
        if (rightEntry.state.pose.fl && rightEntry.state.pose.fr) {
          rightEntry.state.pose.fl = [rightEntry.state.x - 12 * sR, rightEntry.state.fy];
          rightEntry.state.pose.fr = [rightEntry.state.x + 13 * sR, rightEntry.state.fy];
        }
      }
      leftEntry.state.flip = false;
      rightEntry.state.flip = true;

      const skL = skeleton(leftEntry.state.x, leftEntry.state.fy, sL, leftEntry.state.pose, false);
      const skR = skeleton(rightEntry.state.x, rightEntry.state.fy, sR, rightEntry.state.pose, true);
      const avgShY = 0.5 * (skL.world.shoulder[1] + skR.world.shoulder[1]);
      const pumpY = iType === 'handshake' && reach > 0.80 ? Math.sin(globalT * 11.5) * 5.2 * avgS : 0;
      const targetY = iType === 'high_five'
        ? avgShY - 46 * avgS
        : (avgShY + 42 * avgS + pumpY);
      const contactPt = [midX, targetY];

      leftEntry.state.pose.ikw = reach;
      leftEntry.state.pose.hl = contactPt;
      leftEntry.state.pose.armBendL = -1;
      leftEntry.state.pose.handL = iType === 'handshake' ? 'clasp' : 'open';

      rightEntry.state.pose.ikw = reach;
      rightEntry.state.pose.hl = contactPt;
      rightEntry.state.pose.armBendL = -1;
      rightEntry.state.pose.handL = iType === 'handshake' ? 'clasp' : 'open';
    }
  }

  // Automatic natural eye-line tracking toward active speaker when characters share a scene
  if (speechState && speechState.activeSpeaker && entries.length >= 2) {
    const speakerEntry = entries.find(
      (e) => String(e.actor.id || '').toLowerCase() === speechState.activeSpeaker
    );
    if (speakerEntry) {
      const spSk = skeleton(
        speakerEntry.state.x,
        speakerEntry.state.fy,
        speakerEntry.state.s || 1,
        speakerEntry.state.pose,
        speakerEntry.state.flip
      );
      for (const e of entries) {
        if (e === speakerEntry) continue;
        if (Math.abs(e.state.lookX || 0) > 0.05 || Math.abs(e.state.lookY || 0) > 0.05) continue;
        const mySk = skeleton(e.state.x, e.state.fy, e.state.s || 1, e.state.pose, e.state.flip);
        const dx = spSk.world.head[0] - mySk.world.head[0];
        const dy = spSk.world.head[1] - mySk.world.head[1];
        const forwardSign = e.state.flip ? -1 : 1;
        // Only nudge eye gaze if facing toward speaker
        if (dx * forwardSign > -40) {
          e.state.lookX = clamp((dx * forwardSign) / 280, -0.5, 0.75);
          e.state.lookY = clamp(dy / 160, -0.65, 0.65);
        }
      }
    }
  }

  return entries;
}

function extractCharacterFootsteps(actor, sceneStartSec, sceneDur, W) {
  const beats = normalizeBeats(actor, sceneDur);
  const scale = actor.scale ?? 1.0;
  const cues = [];

  for (const b of beats) {
    const act = b.action || 'idle_stand';
    if (act === 'walk' || act === 'walk_sad' || act === 'run' || act === 'push_boulder' || act === 'walk_umbrella') {
      const fX = b.fromX ?? b.from_x;
      const tX = b.toX ?? b.to_x;
      const x0 = (fX ?? b.x ?? 0.5) * W;
      const x1 = (tX ?? b.x ?? fX ?? 0.5) * W;
      if (Math.abs(x1 - x0) > 18) {
        const steps = footstepTimesForWalk(b.start, b.end, x0, x1, 855, scale, act === 'run');
        for (const st of steps) {
          cues.push({
            t: +(sceneStartSec + st.t).toFixed(3),
            type: act === 'run' ? 'step_run' : (act === 'walk_umbrella' ? 'wet_step' : 'step'),
            pan: clamp((st.x / W - 0.5) * 1.4, -0.85, 0.85),
            actor: actor.id || 'char',
            source: 'actual gait touchdown clock',
          });
        }
      }
    } else if (act === 'pace_think') {
      const basePx = (b.fromX ?? b.from_x ?? b.x ?? 0.5) * W;
      const spanPx = (b.span ?? 0.09) * W;
      const bDur = Math.max(0.1, b.end - b.start);
      let segT = 0;
      let goingRight = true;
      while (segT < bDur - 0.15) {
        const segEnd = Math.min(bDur, segT + 1.8);
        const x0 = goingRight ? basePx - spanPx : basePx + spanPx;
        const x1 = goingRight ? basePx + spanPx : basePx - spanPx;
        const steps = footstepTimesForWalk(b.start + segT, b.start + segEnd, x0, x1, 855, scale, false);
        for (const st of steps) {
          cues.push({
            t: +(sceneStartSec + st.t).toFixed(3),
            type: 'step',
            pan: clamp((st.x / W - 0.5) * 1.4, -0.85, 0.85),
            actor: actor.id || 'char',
            source: 'pace_think gait clock',
          });
        }
        segT += 1.8;
        goingRight = !goingRight;
      }
    } else if (act === 'climb_stairs' || act === 'descend_stairs') {
      const count = b.steps || 5;
      const dt = (b.end - b.start) / count;
      const midX = ((b.fromX ?? b.x ?? 0.5) + (b.toX ?? b.x ?? 0.5)) * 0.5;
      for (let i = 0; i < count; i++) {
        cues.push({
          t: +(sceneStartSec + b.start + (i + 0.65) * dt).toFixed(3),
          type: 'step',
          pan: clamp((midX - 0.5) * 1.4, -0.85, 0.85),
          actor: actor.id || 'char',
          source: 'stair cadence clock',
        });
      }
    } else if (act === 'jump') {
      const landT = b.start + (b.end - b.start) * 0.74;
      const landX = b.toX ?? b.x ?? 0.5;
      cues.push({
        t: +(sceneStartSec + landT).toFixed(3),
        type: 'step_run',
        pan: clamp((landX - 0.5) * 1.4, -0.85, 0.85),
        actor: actor.id || 'char',
        source: 'jump landing touchdown',
      });
    }
  }
  return cues;
}

module.exports = {
  INTERACTION_PHASES,
  SUPPORTED_ACTIONS,
  normalizeBeats,
  evaluateCharacterState,
  resolveScenePropInteractions,
  resolveSceneInteractions,
  extractCharacterFootsteps,
};
