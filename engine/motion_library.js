'use strict';

const {
  BONES,
  P,
  clamp,
  lerp,
  ease,
  eo,
  lerpPose,
  skeleton,
  walkMotion,
  runMotion,
} = require('./character_rig');

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
  'sit_desk_type',
  'sit_desk_slump',
  'sit_bench',
  'sit_bed_edge',
  'sit_cafe_listen',
  'sit_cafe_talk',
  'sit_cafe_write',
  'phone_scroll',
  'phone_call',
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
    const edgeTaper = clamp(bt / 0.85) * clamp((bDur - bt) / 0.85);
    const span = rawSpan * edgeTaper;
    const phase = (bt / 3.6) % 2.0;
    const leg = phase < 1.0 ? phase : 2.0 - phase;
    const segStart = fromX - span;
    const segEnd = fromX + span;
    const goingRight = phase < 1.0;
    const wm = walkMotion({
      t: goingRight ? leg * 1.8 : (1.0 - leg) * 1.8,
      duration: 1.8,
      x0: goingRight ? segStart : segEnd,
      x1: goingRight ? segEnd : segStart,
      floor: gY,
      scale: s,
      style: 'normal',
    });
    wm.pose.head = 0.16;
    wm.pose.al = [0.55, 2.32];
    wm.pose.handL = 'open';
    return { x: wm.x, fy: gY, s, flip: wm.flip, pose: wm.pose };
  }

  if (action === 'climb_stairs' || action === 'descend_stairs') {
    // Exact world-space step-tread IK matching `stairs` prop geometry (`sw = 88*stairScale`, `sh = 42*stairScale`)
    const descending = action === 'descend_stairs';
    const steps = Math.max(2, Number(beat.steps || 5));
    const stScale = Number(beat.stair_scale ?? beat.prop_scale ?? s);
    const sw = 88 * stScale;
    const sh = 42 * stScale;
    const stairDir = beat.stair_dir === 'left' ? -1 : (beat.stair_dir === 'right' ? 1 : facing);
    const moveDir = descending ? -stairDir : stairDir;
    const moveFlip = moveDir < 0;

    // `fromX` is the base of step 0 (`prop.x * W` of the stairs prop)
    const basePx = beat.stairs_x !== undefined ? beat.stairs_x * W : fromX;
    const treadPt = (idx) => {
      if (idx < 0) {
        return [basePx - stairDir * sw * 0.42, gY];
      }
      const clampedIdx = Math.min(steps - 1, idx);
      return [
        basePx + stairDir * (clampedIdx + 0.50) * sw,
        gY - (clampedIdx + 1) * sh,
      ];
    };

    const totalTransitions = steps; // floor (-1) -> step 0 -> ... -> step (steps - 1)
    const prog = ease(u) * totalTransitions;
    const k = Math.min(totalTransitions - 1, Math.floor(prog));
    const sf = prog - k; // 0..1 within single step transition

    const srcIdx = descending ? (steps - 1 - k) : (k - 1);
    const dstIdx = descending ? (steps - 2 - k) : k;
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
      pushedBoulder: {
        x: (bx + dir * 56 * s) / W,
        scale: s,
        label: beat.boulder_label || beat.label || 'FRICTION',
      },
    };
  }

  // --- 2. STATIONARY, CONVERSATIONAL, INTERACTION & EVERYDAY ACTIONS ---
  const x = lerp(fromX, toX, ease(u));
  const phaseSeed = (fromX * 0.017) + (beat._actorSeed || 0);
  const breath = Math.sin(globalT * 2.05 + phaseSeed);
  const slowShift = Math.sin(globalT * 0.78 + phaseSeed * 1.7);
  // Strict speech-gating: characters only animate talking gestures when actively speaking (never during narrator lines!)
  const speakBoost = beat._isSpeaking ? 1.0 : (beat.force_gesture ? 0.65 : 0.0);

  // World-locked stance feet helper: tall, natural human leg extension (~3° soft knee) with zero foot drift
  const plantedStandingLegs = (spreadL = 8.5, spreadR = 10.5) => {
    const maxReach = 118.85;
    const maxSpread = Math.max(Math.abs(spreadL), Math.abs(spreadR));
    const safeHeight = Math.min(118.4, Math.sqrt(Math.max(96 * 96, maxReach * maxReach - maxSpread * maxSpread)) - 0.35);
    return {
      hipY: gY - safeHeight * s + breath * 0.28 * s,
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
    const pulse = Math.sin(globalT * 2.3 + phaseSeed) * 0.07 * speakBoost;
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.05 + 0.015 * slowShift,
        head: 0.05 + pulse * 0.5,
        spineCurve: 2.5 * s,
        al: [0.34 + pulse, 2.22 + pulse],
        ar: [0.20 - pulse * 0.5, 0.98 + pulse],
        handL: 'open',
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
    const wipe = 0.5 + 0.5 * Math.sin(bt * 4.2);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.10,
        head: 0.24,
        spineCurve: -4.0 * s,
        al: [1.18 + 0.06 * wipe, 2.58 + 0.08 * wipe],
        ar: [-0.06, 0.24],
        handL: 'open',
        handR: 'relaxed',
      }),
    };
  }

  if (action === 'check_watch') {
    const lift = ease(clamp(u * 2.4));
    return {
      x,
      fy: gY,
      s,
      flip,
      lookY: 0.45 * lift,
      pose: P({
        ...plantedStandingLegs(),
        lean: 0.06 * lift,
        head: 0.28 * lift,
        al: [lerp(0.14, 0.62, lift), lerp(0.35, 1.98, lift)],
        ar: [-0.08, 0.16],
        handL: 'relaxed',
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
    const eu = ease(u);
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: lerp(gY - 65 * s, gY - 115.5 * s, eu),
        lean: lerp(0.26, 0.03, eu),
        head: lerp(0.14, -0.02, eu),
        spineCurve: lerp(-2.0 * s, 3.0 * s, eu),
        fl: [x + facing * lerp(26, 8.5, eu) * s, gY],
        fr: [x + facing * lerp(18, -10.5, eu) * s, gY],
        bendL: 1,
        bendR: 1,
        legIkw: 1,
        footAngleL: 0,
        footAngleR: 0,
        al: [lerp(0.52, 0.14, eu), lerp(1.52, 0.38, eu)],
        ar: [lerp(0.44, -0.08, eu), lerp(1.44, 0.14, eu)],
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
    const stroke = Math.sin(globalT * 4.8 + phaseSeed);
    const sweep = Math.cos(globalT * 1.9 + phaseSeed);
    const pose = P({
      hipY: gY - 65 * s,
      lean: 0.20 + 0.03 * sweep,
      head: 0.24 + 0.04 * sweep,
      spineCurve: -2.5 * s,
      al: [0.64 + 0.13 * stroke, 1.54 - 0.11 * stroke],
      ar: [0.46, 1.44],
      ll: [1.46, 0.04],
      lr: [1.34, 0.14],
      legIkw: 0,
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

  if (action === 'sit_desk_type' || action === 'sit_desk_slump') {
    const slump = action === 'sit_desk_slump';
    const burstPhase = ((globalT + phaseSeed) % 3.7 + 3.7) % 3.7;
    const typingActive = burstPhase < 2.55 ? 1.0 : 0.12;
    const readLift = burstPhase >= 2.55 ? Math.sin(((burstPhase - 2.55) / 1.15) * Math.PI) * 0.10 : 0;
    const t1 = Math.sin(globalT * 12.4) * 0.08 * typingActive;
    const t2 = Math.cos(globalT * 10.6) * 0.08 * typingActive;
    return {
      x,
      fy: gY,
      s,
      flip,
      seatedAtDesk: true,
      pose: P({
        hipY: gY - 65 * s,
        lean: slump ? 0.36 + 0.02 * breath : 0.11 - readLift * 0.3,
        head: slump ? 0.36 + 0.02 * breath : 0.08 - readLift,
        spineCurve: slump ? -8.5 * s : 1.5 * s,
        al: slump ? [0.72, 2.34] : [0.56 + t1, 1.54 - t1],
        ar: slump ? [0.64, 2.26] : [0.46 + t2, 1.46 - t2],
        // Offset front vs back seated knee/shin slightly so BOTH legs are clearly visible!
        ll: [1.46, 0.03],
        lr: [1.34, 0.15],
        legIkw: 0,
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

  if (action === 'phone_scroll') {
    const thumb = Math.sin(globalT * 5.4) * 0.07;
    const pose = P({
      ...plantedStandingLegs(),
      lean: 0.16,
      head: 0.34,
      spineCurve: -3.5 * s,
      al: [0.48, 1.92 + thumb],
      ar: [0.36, 1.72],
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
      heldPhone: {
        x: sk.world.al[2][0] + facing * 6 * s,
        y: sk.world.al[2][1] - 5 * s,
        facing,
      },
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
    return {
      x,
      fy: gY,
      s,
      flip,
      pose: P({
        hipY: gY - 56 * s,
        lean: 0.42,
        head: 0.38,
        spineCurve: -7.5 * s,
        al: [0.65, 2.25],
        ar: [0.42, 0.25],
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
      pose: P({
        ...plantedStandingLegs(11, 13),
        lean: 0.015,
        head: -0.08,
        spineCurve: 3.5 * s,
        al: [0.08, 0.22],
        ar: [-0.08, 0.14],
        handL: 'relaxed',
        handR: 'relaxed',
      }),
    };
  }

  // Default: idle_stand (grounded IK stance feet, calm breathing, subtle micro-sway)
  return {
    x,
    fy: gY,
    s,
    flip,
    pose: P({
      ...plantedStandingLegs(10, 12),
      lean: 0.02 + 0.008 * slowShift,
      head: 0.018 * breath,
      spineCurve: 2.5 * s,
      al: [0.09, 0.22 + 0.02 * breath],
      ar: [-0.08, 0.14 - 0.02 * breath],
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
  const cur = {
    ...beats[activeIdx],
    _actorSeed: actorSeed,
    _isSpeaking: isSpeaking,
    _hasDialogueInScene: hasDialogueInScene,
  };
  const curDur = Math.max(0.05, cur.end - cur.start);
  const curState = computeBeatState(cur, clamp(ts - cur.start, 0, curDur), curDur, globalT, W, floorY, scale);

  const blendWin = 0.36;
  if (activeIdx > 0 && ts - cur.start < blendWin) {
    const prev = {
      ...beats[activeIdx - 1],
      _actorSeed: actorSeed,
      _isSpeaking: isSpeaking,
      _hasDialogueInScene: hasDialogueInScene,
    };
    const prevDur = Math.max(0.05, prev.end - prev.start);
    const prevState = computeBeatState(prev, prevDur, prevDur, globalT, W, floorY, scale);
    const k = ease(clamp((ts - cur.start) / blendWin));
    const flipChanged = prevState.flip !== curState.flip;
    // Smooth horizontal foreshortening turn when changing facing direction (eliminates 1-frame mirror pop!)
    const turnScaleX = flipChanged ? Math.max(0.56, Math.abs(Math.cos(k * Math.PI))) : 1.0;
    const pose = prevState.flip === curState.flip
      ? lerpPose(prevState.pose, curState.pose, k)
      : (k < 0.5 ? prevState.pose : curState.pose);

    return {
      x: lerp(prevState.x, curState.x, k),
      fy: lerp(prevState.fy, curState.fy, k),
      s: scale,
      flip: k < 0.5 ? prevState.flip : curState.flip,
      turnScaleX,
      pose,
      seatedAtDesk: curState.seatedAtDesk,
      interactionType: curState.interactionType,
      partnerId: curState.partnerId,
      wrapAmount: curState.wrapAmount,
      reachAmount: curState.reachAmount,
      heldPhone: curState.heldPhone,
      heldPen: curState.heldPen,
      heldCup: curState.heldCup,
      heldBlueprint: curState.heldBlueprint,
      heldUmbrella: curState.heldUmbrella,
      heldDrawing: curState.heldDrawing,
      wetShoulder: curState.wetShoulder,
      pushedBoulder: curState.pushedBoulder,
      callout: cur.callout,
      expression: cur.expression,
      actorSeed,
      lookX: curState.lookX ?? cur.look_x ?? cur.lookX ?? 0,
      lookY: curState.lookY ?? cur.look_y ?? cur.lookY ?? 0,
      posture: Number.isFinite(prev.posture) && Number.isFinite(cur.posture)
        ? lerp(prev.posture, cur.posture, k)
        : cur.posture,
    };
  }

  curState.turnScaleX = 1.0;
  curState.callout = cur.callout;
  curState.expression = cur.expression;
  curState.actorSeed = actorSeed;
  curState.lookX = curState.lookX ?? cur.look_x ?? cur.lookX ?? 0;
  curState.lookY = curState.lookY ?? cur.look_y ?? cur.lookY ?? 0;
  curState.posture = cur.posture;
  return curState;
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
  SUPPORTED_ACTIONS,
  normalizeBeats,
  evaluateCharacterState,
  resolveSceneInteractions,
  extractCharacterFootsteps,
};
