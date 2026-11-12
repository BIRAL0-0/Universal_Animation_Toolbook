'use strict';

// Universal Procedural Character Rig (v3 Biomechanical & Expressive Cinema Rig)
// Fixed-length mathematical skeleton (0.000px stretch), angle-space FK/IK blending,
// world-contact walk & aerial run solvers, sculpted curved spine & posture, tapered limbs,
// articulated hands & grounded shoes, 11 procedural hairstyles, micro-detail faces,
// combinable wardrobe accessories, and split-depth occlusion support.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => { const c = clamp(k); return c * c * (3 - 2 * c); };

/**
 * Spring physics easing — damped harmonic oscillator (inspired by GSAP/Manim spring rate functions).
 * Provides natural, organic overshoot and settle for idle animations and transitions.
 * @param {number} t - normalized time [0, 1]
 * @param {object} opts - { stiffness, damping, mass } or { bounce } for simplified API
 * @returns {number} eased value, may overshoot 1.0 briefly
 */
function springEase(t, opts = {}) {
  const tn = clamp(t);
  let stiffness, damping, mass;
  if (opts.bounce !== undefined) {
    // Simplified bounce parameter: 0 = no bounce (critically damped), 1 = lots of bounce
    const b = clamp(opts.bounce);
    stiffness = 180 - b * 120; // 180 (stiff) to 60 (soft)
    damping = 12 + b * 18;     // 12 (damped) to 30 (bouncy) — wait, this is backwards
    // Actually: low damping = bouncy, high damping = no bounce
    damping = 26 - b * 20;     // 26 (no bounce) to 6 (very bouncy)
    mass = 1;
  } else {
    stiffness = opts.stiffness ?? 180;
    damping = opts.damping ?? 12;
    mass = opts.mass ?? 1;
  }
  // Damped harmonic oscillator: x(t) = 1 - e^(-ζωt) * (cos(ωdt) + (ζω/ωd)*sin(ωdt))
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta >= 1) {
    // Overdamped or critically damped — no oscillation
    const r1 = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
    const r2 = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
    const c2 = (r1) / (r1 - r2);
    const c1 = 1 - c2;
    return clamp(1 - c1 * Math.exp(r1 * tn) - c2 * Math.exp(r2 * tn));
  }
  // Underdamped — oscillates then settles
  const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
  const expPart = Math.exp(-zeta * omega0 * tn);
  return clamp(1 - expPart * (Math.cos(omegaD * tn) + (zeta * omega0 / omegaD) * Math.sin(omegaD * tn)));
}

/**
 * Back easing — configurable overshoot (inspired by GSAP back.out).
 * Anticipates before moving, or overshoots at the end.
 */
function backEase(t, overshoot = 1.70158) {
  const c = clamp(t);
  const s = overshoot;
  return c * c * ((s + 1) * c - s);
}

function backOut(t, overshoot = 1.70158) {
  const c = clamp(t);
  const s = overshoot;
  const t1 = c - 1;
  return t1 * t1 * ((s + 1) * t1 + s) + 1;
}

/**
 * Classical anticipation + slow-in/slow-out curve:
 * Dips gently to `-antiDepth` during `[0..antiFrac]` (anticipation), then accelerates smoothly
 * and settles into `1.0` with zero robotic linear segments.
 */
function anticipationEase(t, antiFrac = 0.18, antiDepth = 0.10) {
  const c = clamp(t);
  const af = clamp(antiFrac, 0.05, 0.40);
  if (c < af) {
    const u = c / af;
    return -antiDepth * Math.sin(u * Math.PI);
  }
  const u = (c - af) / (1 - af);
  // Asymmetric cubic/quintic slow-out for crisp drive and cushioned settle
  return 1 - Math.pow(1 - u, 2.6) * (1 - 0.35 * u * u);
}

/**
 * Natural parabolic/curved arc interpolation between two 2D points `[x0, y0]` and `[x1, y1]`.
 * Prevents robotic straight-line point-to-point hand reaches and transfers.
 */
function arcPoint(p0, p1, u, arcLiftPx = -18) {
  const k = clamp(u);
  const lift = Math.sin(k * Math.PI) * arcLiftPx;
  return [
    lerp(p0[0], p1[0], k),
    lerp(p0[1], p1[1], k) + lift,
  ];
}

const eio = ease;
const eo = (k) => 1 - Math.pow(1 - clamp(k), 3);
const ca = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0)).toFixed(3);
const angle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

const BONES = Object.freeze({
  THIGH: 60,
  SHIN: 60,
  TORSO: 92,
  UPPER_ARM: 57,
  FOREARM: 55,
  HEAD_R: 25,
  NECK: 9,
});

const CANONICAL_CHARACTER_SPEC = Object.freeze({
  defaultBaseColor: '#f5f7fb',
  outlineColor: '#070a11',
  strokeWidthPx: 2.35,
  thinStrokeWidthPx: 1.80,
  defaultHairstyle: 'textured_sweep',
  defaultHairColor: '#2c1f19',
  defaultShoeColor: '#0a0d13',
  singleColorBody: true,
  uniformLimbFill: true,
  bones: BONES,
  radii: Object.freeze({
    torsoHip: 13.4,
    torsoMid: 15.6,
    torsoShoulder: 18.2,
    neckBase: 7.4,
    neckTop: 6.4,
    upperArmTop: 8.2,
    elbow: 6.9,
    wrist: 5.5,
    thighTop: 12.2,
    knee: 9.1,
    ankle: 6.7,
  }),
});

const BUILDS = Object.freeze({
  standard: { torsoW: 1.0, shoulderW: 1.0, limbW: 1.0, headW: 1.0 },
  slim:     { torsoW: 0.86, shoulderW: 0.88, limbW: 0.88, headW: 0.96 },
  lean:     { torsoW: 0.90, shoulderW: 0.92, limbW: 0.90, headW: 0.98 },
  athletic: { torsoW: 1.08, shoulderW: 1.14, limbW: 1.06, headW: 1.0 },
  broad:    { torsoW: 1.18, shoulderW: 1.24, limbW: 1.12, headW: 1.04 },
  heavy:    { torsoW: 1.26, shoulderW: 1.26, limbW: 1.16, headW: 1.05 },
  compact:  { torsoW: 0.95, shoulderW: 0.96, limbW: 0.95, headW: 1.06 },
});

const SUPPORTED_ACCESSORIES = Object.freeze([
  'none',
  'glasses',
  'sunglasses',
  'headband',
  'tie',
  'bowtie',
  'cap',
  'hat',
  'crown',
  'helmet',
  'scarf',
  'badge',
  'cape',
  'coat',
  'headphones',
  'halo',
  'backpack',
  'work_bag',
  'watch',
]);

const SUPPORTED_HAIRSTYLES = Object.freeze([
  'none',
  'textured_sweep',
  'short',
  'parted',
  'messy',
  'curly',
  'spiky',
  'slick',
  'long',
  'ponytail',
  'bun',
  'buzz',
  'receding',
]);

const DEF = Object.freeze({
  lean: 0.02,
  head: 0,
  dy: 0,
  ikw: 0,
  legIkw: 1,
  al: [0.09, 0.22],
  ar: [-0.08, 0.14],
  ll: [-0.09, 0.02],
  lr: [0.10, -0.01],
  bendL: 1,
  bendR: 1,
  armBendL: -1,
  armBendR: -1,
  handL: 'relaxed',
  handR: 'relaxed',
  footAngleL: 0,
  footAngleR: 0,
  spineCurve: 0,
  thumbScroll: 0,
  thumbTap: 0,
});

const P = (o = {}) => ({
  ...DEF,
  ...o,
  al: Array.isArray(o.al) ? [...o.al] : [...DEF.al],
  ar: Array.isArray(o.ar) ? [...o.ar] : [...DEF.ar],
  ll: Array.isArray(o.ll) ? [...o.ll] : [...DEF.ll],
  lr: Array.isArray(o.lr) ? [...o.lr] : [...DEF.lr],
});

const ANGULAR_KEYS = new Set(['lean', 'head', 'al', 'ar', 'll', 'lr', 'footAngleL', 'footAngleR']);
const DISCRETE_KEYS = new Set(['bendL', 'bendR', 'armBendL', 'armBendR', 'handL', 'handR']);
const POINT_KEYS = new Set(['fl', 'fr', 'hl', 'hr']);

function fk(root, angles, l1, l2) {
  const joint = [root[0] + l1 * Math.sin(angles[0]), root[1] + l1 * Math.cos(angles[0])];
  return [root, joint, [joint[0] + l2 * Math.sin(angles[1]), joint[1] + l2 * Math.cos(angles[1])]];
}

function solveIK(root, target, l1, l2, bend = -1) {
  if (![...root, ...target, l1, l2].every(Number.isFinite) || l1 <= 0 || l2 <= 0) {
    throw new Error('Invalid IK input');
  }
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const raw = Math.hypot(dx, dy);
  const d = clamp(raw, Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6);
  const direction = raw > 1e-9 ? Math.atan2(dx, dy) : 0;
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a = direction + (bend < 0 ? -1 : 1) * off;
  const joint = [root[0] + l1 * Math.sin(a), root[1] + l1 * Math.cos(a)];
  const end = [root[0] + d * Math.sin(direction), root[1] + d * Math.cos(direction)];
  const a2 = Math.atan2(end[0] - joint[0], end[1] - joint[1]);
  return {
    points: [root, joint, [joint[0] + l2 * Math.sin(a2), joint[1] + l2 * Math.cos(a2)]],
    angles: [a, a2],
    clamped: Math.abs(raw - d) > 1e-4,
  };
}

function blendLimb(root, fkAngles, target, weight, l1, l2, bend = -1) {
  const w = clamp(weight ?? 0);
  if (!target || w <= 0) {
    return { points: fk(root, fkAngles, l1, l2), angles: fkAngles, clamped: false };
  }
  const solved = solveIK(root, target, l1, l2, bend);
  const blendedAngles = [
    angle(fkAngles[0], solved.angles[0], w),
    angle(fkAngles[1], solved.angles[1], w),
  ];
  return {
    points: fk(root, blendedAngles, l1, l2),
    angles: blendedAngles,
    clamped: solved.clamped,
  };
}

function lerpPose(a0, b0, k) {
  const t = clamp(k);
  const a = P(a0);
  const b = P(b0);
  const out = {};

  // Pre-resolve explicit per-limb IK weights so IK <-> FK transitions blend smoothly across [0..1]
  // instead of snapping at t = 0.5 when a target point (`hl`/`hr`/`fl`/`fr`) turns `undefined`!
  const aIkwL = a.hl ? (a.ikwL ?? a.ikw ?? 0) : 0;
  const bIkwL = b.hl ? (b.ikwL ?? b.ikw ?? 0) : 0;
  const aIkwR = a.hr ? (a.ikwR ?? a.ikw ?? 0) : 0;
  const bIkwR = b.hr ? (b.ikwR ?? b.ikw ?? 0) : 0;
  const aLegIkw = (a.fl || a.fr) ? (a.legIkw ?? 1) : 0;
  const bLegIkw = (b.fl || b.fr) ? (b.legIkw ?? 1) : 0;

  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key];
    const y = b[key];
    if (POINT_KEYS.has(key)) {
      if (x && y) out[key] = [lerp(x[0], y[0], t), lerp(x[1], y[1], t)];
      else out[key] = x || y;
    } else if (DISCRETE_KEYS.has(key)) {
      out[key] = t < 0.5 ? x : y;
    } else if (key === 'hipY') {
      if (Number.isFinite(x) && Number.isFinite(y)) out.hipY = lerp(x, y, t);
      else out.hipY = t < 0.5 ? x : y;
    } else if (ANGULAR_KEYS.has(key)) {
      out[key] = Array.isArray(x) ? x.map((v, i) => angle(v, y[i], t)) : angle(x ?? 0, y ?? 0, t);
    } else if (typeof x === 'number' && typeof y === 'number') {
      out[key] = lerp(x, y, t);
    } else {
      out[key] = t < 0.5 ? x : y;
    }
  }

  if (a.hl || b.hl) out.ikwL = lerp(aIkwL, bIkwL, t);
  if (a.hr || b.hr) out.ikwR = lerp(aIkwR, bIkwR, t);
  if (a.fl || b.fl || a.fr || b.fr) out.legIkw = lerp(aLegIkw, bLegIkw, t);

  return out;
}

function applyPostureToPose(p0 = {}, postureRaw = 0, s = 1.0) {
  const posture = Number.isFinite(postureRaw) ? clamp(postureRaw, -1, 1) : 0;
  if (Math.abs(posture) < 1e-4) return P(p0);
  const base = P(p0);
  if (posture > 0) {
    // Proud, upright, confident posture: tall vertical spine, lifted sternum, calm level chin (NEVER tips backward!)
    const targetLean = clamp(base.lean, -0.02, 0.04);
    const uprightLean = lerp(base.lean, targetLean, posture * 0.62);
    const levelHead = lerp(base.head, clamp(base.head - 0.04, -0.08, 0.08), posture * 0.55);
    return {
      ...base,
      lean: uprightLean,
      head: levelHead,
      spineCurve: (base.spineCurve || 0) + posture * 6.5 * s,
    };
  }
  // Exhausted / burdened / slumped posture (`posture < 0`): rounded upper back, forward neck droop, slightly weary knees
  const slump = -posture;
  return {
    ...base,
    hipY: Number.isFinite(base.hipY) ? base.hipY + slump * 2.0 * s : base.hipY,
    lean: base.lean + slump * 0.20,
    head: base.head + slump * 0.26,
    spineCurve: (base.spineCurve || 0) - slump * 10.5 * s,
  };
}

function skeleton(x, fy, s, p0 = {}, flip = false) {
  const p = P(p0);
  const th = BONES.THIGH * s;
  const sh = BONES.SHIN * s;
  const T = BONES.TORSO * s;
  const ua = BONES.UPPER_ARM * s;
  const fa = BONES.FOREARM * s;
  const hr = BONES.HEAD_R * s;
  const mirror = (px) => (flip ? 2 * x - px : px);

  const defaultHipY =
    fy -
    Math.max(
      th * Math.cos(p.ll[0]) + sh * Math.cos(p.ll[1]),
      th * Math.cos(p.lr[0]) + sh * Math.cos(p.lr[1])
    ) -
    (p.dy || 0);

  const hy = Number.isFinite(p.hipY) ? p.hipY - (p.dy || 0) : defaultHipY;
  const hip = [x, hy];
  const shoulder = [x + T * Math.sin(p.lean), hy - T * Math.cos(p.lean)];

  // Curved anatomical mid-spine control point (positive spineCurve lifts chest forward; negative rounds thoracic back)
  const tdx = shoulder[0] - hip[0];
  const tdy = shoulder[1] - hip[1];
  const tLen = Math.max(1e-4, Math.hypot(tdx, tdy));
  const fwdNormalX = -tdy / tLen; // points in +x (character forward in local space) when spine is upright
  const fwdNormalY = tdx / tLen;
  const curveAmt = Number(p.spineCurve || 0);
  const spineMid = [
    lerp(hip[0], shoulder[0], 0.54) + fwdNormalX * curveAmt,
    lerp(hip[1], shoulder[1], 0.54) + fwdNormalY * curveAmt,
  ];

  const ha = p.lean + p.head;
  const neckTop = [
    shoulder[0] + Math.sin(ha) * (BONES.NECK * s),
    shoulder[1] - Math.cos(ha) * (BONES.NECK * s),
  ];
  const head = [
    shoulder[0] + Math.sin(ha) * (hr + BONES.NECK * s),
    shoulder[1] - Math.cos(ha) * (hr + BONES.NECK * s),
  ];

  const toLocal = (pt) => (pt ? [mirror(pt[0]), pt[1]] : undefined);
  const toWorldChain = (pts) => pts.map((pt) => [mirror(pt[0]), pt[1]]);

  const legL = blendLimb(hip, p.ll, toLocal(p.fl), p.fl ? (p.legIkw ?? 1) : 0, th, sh, p.bendL ?? 1);
  const legR = blendLimb(hip, p.lr, toLocal(p.fr), p.fr ? (p.legIkw ?? 1) : 0, th, sh, p.bendR ?? 1);
  const armL = blendLimb(shoulder, p.al, toLocal(p.hl), p.ikwL ?? p.ikw ?? 0, ua, fa, p.armBendL ?? -1);
  const armR = blendLimb(shoulder, p.ar, toLocal(p.hr), p.ikwR ?? p.ikw ?? 0, ua, fa, p.armBendR ?? -1);

  const computeGripLocal = (armPts) => {
    const elbow = armPts[1];
    const wrist = armPts[2];
    const ang = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]);
    return [wrist[0] + Math.cos(ang) * 7.5 * s, wrist[1] + Math.sin(ang) * 7.5 * s];
  };
  const gripL = computeGripLocal(armL.points);
  const gripR = computeGripLocal(armR.points);

  return {
    hip,
    spineMid,
    shoulder,
    neckTop,
    head,
    headAngle: ha,
    radius: hr,
    scale: s,
    flip,
    ll: legL.points,
    lr: legR.points,
    al: armL.points,
    ar: armR.points,
    gripL,
    gripR,
    legAnglesL: legL.angles,
    legAnglesR: legR.angles,
    armAnglesL: armL.angles,
    armAnglesR: armR.angles,
    world: {
      hip: [mirror(hip[0]), hip[1]],
      spineMid: [mirror(spineMid[0]), spineMid[1]],
      shoulder: [mirror(shoulder[0]), shoulder[1]],
      head: [mirror(head[0]), head[1]],
      ll: toWorldChain(legL.points),
      lr: toWorldChain(legR.points),
      al: toWorldChain(armL.points),
      ar: toWorldChain(armR.points),
      gripL: [mirror(gripL[0]), gripL[1]],
      gripR: [mirror(gripR[0]), gripR[1]],
    },
    mirror,
    pose: p,
  };
}

/**
 * Biomechanical World-Contact Walk Cycle:
 * - Zero stance foot-slip (`point: [anchor, floor]` locked throughout stance)
 * - Tall natural hip height (`114.5*s`) with 2-harmonic gait bounce (contact recoil -> passing lift)
 * - Heel-strike -> flat-stance -> toe-off foot pitch (`footAngleL`, `footAngleR`)
 * - Natural bent-elbow counter-swing
 */
function walkMotion({ t, duration = 4, x0 = 300, x1 = 600, floor = 900, scale = 1, cycles = null, style = 'normal' }) {
  const dist = Math.abs(x1 - x0);
  const maxStride = 74 * scale;
  const cyc = cycles && Number.isInteger(cycles) && cycles >= 1
    ? cycles
    : Math.max(1, Math.ceil(dist / Math.max(24, maxStride * 0.85)));

  const u = duration <= 0 ? 1 : clamp(t / duration);
  const eu = ease(u);
  const g = eu * cyc;
  const x = lerp(x0, x1, eu);
  const stride = (x1 - x0) / cyc;
  const direction = x1 >= x0 ? 1 : -1;
  const liftMul = style === 'trudging' ? 0.58 : style === 'brisk' ? 1.22 : 1.0;
  // Keep full gait amplitude through long walks; feather only the first/last 0.32s instead of easing every step beat to a stop.
  const env = clamp(Math.min(t, duration - t) / 0.32);

  const foot = (offset) => {
    const phase = g + offset;
    const k = Math.floor(phase);
    const p = phase - k;
    const anchor = x0 + (k - offset) * stride + stride * 0.25;
    if (p < 0.5) {
      // Grounded stance: 0.0px horizontal or vertical slip; subtle heel-rise right at push-off
      const sp = p * 2; // 0..1 across stance
      const pushOffPitch = sp > 0.78 ? ((sp - 0.78) / 0.22) * 0.18 : 0;
      return { point: [anchor, floor], stance: true, footAngle: pushOffPitch * env };
    }
    const sp = (p - 0.5) * 2; // 0..1 across swing
    // Sleek, natural shoe clearance (~9.5*s) while stance leg rises tall at mid-passing!
    const swingPitch = lerp(0.18, -0.16, ease(sp)) * env;
    return {
      point: [
        anchor + stride * ease(sp),
        floor - 9.5 * scale * liftMul * Math.sin(sp * Math.PI) * (0.35 + 0.65 * env),
      ],
      stance: false,
      footAngle: swingPitch,
    };
  };

  const l = foot(0);
  const r = foot(0.5);
  const swingAmp = style === 'trudging' ? 0.14 : style === 'brisk' ? 0.26 : 0.17;
  const swing = Math.sin(g * 2 * Math.PI) * swingAmp * env;
  // Canvas +Y is downward: at double-support contact (`g = 0, 0.5`, `cos = +1`) hip dips slightly (`+1.8*s`);
  // at mid-stance passing (`g = 0.25, 0.75`, `cos = -1`) stance leg stands tall (`-1.8*s`)!
  const stepBounce = Math.cos(g * 4 * Math.PI) * (style === 'trudging' ? 1.4 : 1.8) * scale * env;
  const baseHipH = style === 'trudging' ? 113.8 * scale : 116.8 * scale;
  const leanBase = style === 'trudging' ? 0.14 : (style === 'brisk' ? 0.075 : 0.026);
  const headBase = style === 'trudging' ? 0.22 : 0.01;

  // Natural 3/4 forearm bend: gentle counter-swing near the body with soft human elbow flex
  const elbowRest = 0.24;
  const alUpper = -swing;
  const arUpper = swing * 0.85;
  const alLower = Math.max(alUpper + 0.10, -swing * 0.65 + elbowRest + Math.max(0, -swing) * 0.18);
  const arLower = Math.max(arUpper + 0.10, swing * 0.65 + elbowRest + Math.max(0, swing) * 0.18);

  return {
    x,
    cycles: cyc,
    direction,
    flip: direction < 0,
    pose: P({
      hipY: floor - baseHipH + stepBounce,
      lean: leanBase,
      head: headBase,
      spineCurve: style === 'trudging' ? -5.5 * scale : 2.5 * scale,
      fl: l.point,
      fr: r.point,
      bendL: 1,
      bendR: 1,
      footAngleL: l.footAngle,
      footAngleR: r.footAngle,
      al: [alUpper, alLower],
      ar: [arUpper, arLower],
      handL: 'relaxed',
      handR: 'relaxed',
    }),
    stance: [l.stance, r.stance],
  };
}

/**
 * True Biomechanical Aerial Run Cycle:
 * - Stance duty factor 0.35 (< 0.50 -> genuine aerial flight phase where BOTH feet leave the ground!)
 * - High heel recovery kick toward glutes + strong forward knee drive
 * - 90-degree bent-elbow athletic arm pump + dynamic vertical flight bounce
 */
function runMotion({ t, duration = 3, x0 = 240, x1 = 900, floor = 900, scale = 1, cycles = null }) {
  const dist = Math.abs(x1 - x0);
  const maxStride = 112 * scale;
  const cyc = cycles && Number.isInteger(cycles) && cycles >= 1
    ? cycles
    : Math.max(1, Math.ceil(dist / Math.max(36, maxStride * 0.90)));

  const u = duration <= 0 ? 1 : clamp(t / duration);
  const eu = ease(u);
  const g = eu * cyc;
  const x = lerp(x0, x1, eu);
  const stride = (x1 - x0) / cyc;
  const direction = x1 >= x0 ? 1 : -1;
  const env = Math.sin(Math.PI * u);
  const stanceFrac = 0.35;

  const foot = (offset) => {
    const phase = g + offset;
    const k = Math.floor(phase);
    const p = phase - k;
    const anchor = x0 + (k - offset) * stride + stride * 0.22;
    if (p < stanceFrac) {
      const sp = p / stanceFrac;
      return {
        point: [anchor, floor],
        stance: true,
        footAngle: lerp(-0.10, 0.38, sp) * env,
      };
    }
    const sp = (p - stanceFrac) / (1 - stanceFrac);
    // Asymmetric swing lift: high heel kick in first half of swing, fast reach forward in second half
    const liftProfile = Math.sin(Math.pow(sp, 0.78) * Math.PI);
    const liftH = 44 * scale * liftProfile * env + 6 * scale * (1 - env);
    const pitch = sp < 0.55 ? lerp(0.45, 0.72, sp / 0.55) : lerp(0.72, -0.26, (sp - 0.55) / 0.45);
    return {
      point: [
        anchor + stride * ease(sp),
        floor - liftH,
      ],
      stance: false,
      footAngle: pitch * env,
    };
  };

  const l = foot(0);
  const r = foot(0.5);
  // Flight bounce: peaks during aerial window (between stance phases), dips smoothly on impact absorption
  const flightWave = Math.sin((g * 2 - 0.18) * 2 * Math.PI);
  const hipY = floor - (111 * scale + flightWave * 9.5 * scale * env);
  const pump = Math.sin(g * 2 * Math.PI) * 0.68 * env;
  const bothFeetClearPx = Math.max(0, Math.min(floor - l.point[1], floor - r.point[1]));

  return {
    x,
    cycles: cyc,
    direction,
    flip: direction < 0,
    pose: P({
      hipY,
      airLift: bothFeetClearPx / Math.max(0.4, scale),
      lean: 0.06 + 0.17 * env,
      head: -0.06 * env,
      spineCurve: 4.0 * scale,
      fl: l.point,
      fr: r.point,
      bendL: 1,
      bendR: 1,
      footAngleL: l.footAngle,
      footAngleR: r.footAngle,
      al: [-pump, -pump + 1.28],
      ar: [pump, pump + 1.28],
      handL: 'fist',
      handR: 'fist',
    }),
    stance: [l.stance, r.stance],
  };
}

// ---------------- COLOR PALETTE TOKENS (PLUS ANY CUSTOM #HEX) ----------------

const NAMED_COLORS = {
  cyan:     '#38bdf8',
  cobalt:   '#38bdf8',
  emerald:  '#34d399',
  coral:    '#fb7185',
  violet:   '#a78bfa',
  amber:    '#fbbf24',
  gold:     '#fbbf24',
  teal:     '#2dd4bf',
  rose:     '#f472b6',
  indigo:   '#818cf8',
  crimson:  '#f87171',
  lime:     '#a3e635',
  orange:   '#fb923c',
  sky:      '#7dd3fc',
  pearl:    '#f1f5f9',
  silver:   '#e2e8f0',
  slate:    '#94a3b8',
};

function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex;
  const clean = (NAMED_COLORS[String(hex || '').toLowerCase()] || hex || '#f1f5f9').replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 240,
      parseInt(clean[1] + clean[1], 16) || 244,
      parseInt(clean[2] + clean[2], 16) || 248,
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 240,
    parseInt(clean.slice(2, 4), 16) || 244,
    parseInt(clean.slice(4, 6), 16) || 248,
  ];
}

function mixRgb(a, b, k) {
  const t = clamp(k);
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

const rgbCss = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

function normalizeAccessoryList(acc) {
  if (!acc) return [];
  if (Array.isArray(acc)) return acc.filter((x) => x && x !== 'none');
  if (typeof acc === 'string') {
    return acc
      .split(/[+,]/)
      .map((s) => s.trim())
      .filter((x) => x && x !== 'none');
  }
  return [];
}

function resolveDefaultHairstyle(opts = {}, accList = []) {
  if (opts.hair !== undefined && opts.hair !== null && opts.hair !== '') {
    const requested = String(opts.hair).toLowerCase();
    if (requested === 'bald') return 'none';
    if (SUPPORTED_HAIRSTYLES.includes(requested)) {
      return requested;
    }
  }
  void accList;
  return CANONICAL_CHARACTER_SPEC.defaultHairstyle;
}

function resolveHairRgb(opts = {}) {
  if (opts.hairColor) return hexToRgb(opts.hairColor);
  // Warm dark espresso-chestnut default hair colour matching the 3/4 illustrated cinema protagonist
  return hexToRgb(CANONICAL_CHARACTER_SPEC.defaultHairColor || '#2c1f19');
}

// ---------------- HAIR RENDERING (BACK & FRONT LAYERS) ----------------

function drawHairBack(g, hd, hr, ha, s, hairStyle, hairRgb, outlineCol) {
  if (!hairStyle || hairStyle === 'none') return;
  g.save();
  g.translate(hd[0], hd[1]);
  g.rotate(clamp(ha * 0.28, -0.20, 0.24));
  g.fillStyle = rgbCss(mixRgb(hairRgb, [10, 8, 12], 0.22));
  g.strokeStyle = outlineCol;
  g.lineWidth = 2.0 * s;
  g.lineJoin = 'round';

  if (hairStyle === 'long') {
    g.beginPath();
    g.moveTo(-hr * 0.96, -hr * 0.25);
    g.quadraticCurveTo(-hr * 1.32, hr * 0.65, -hr * 1.05, hr * 1.55);
    g.quadraticCurveTo(-hr * 0.45, hr * 1.72, -hr * 0.15, hr * 1.25);
    g.lineTo(-hr * 0.25, -hr * 0.2);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (hairStyle === 'ponytail') {
    g.beginPath();
    g.moveTo(-hr * 0.88, -hr * 0.24);
    g.quadraticCurveTo(-hr * 1.62, -hr * 0.08, -hr * 1.58, hr * 0.88);
    g.quadraticCurveTo(-hr * 1.18, hr * 0.92, -hr * 0.92, hr * 0.20);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (hairStyle === 'bun') {
    g.beginPath();
    g.arc(-hr * 1.02, -hr * 0.34, hr * 0.42, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (hairStyle === 'textured_sweep' || hairStyle === 'parted' || hairStyle === 'short' || hairStyle === 'messy') {
    // Full tapered back-of-head & nape coverage behind the ear so zero white cranium peeks out at the nape
    g.beginPath();
    g.moveTo(-hr * 1.01, -hr * 0.16);
    g.quadraticCurveTo(-hr * 1.10, hr * 0.34, -hr * 0.82, hr * 0.80);
    g.quadraticCurveTo(-hr * 0.52, hr * 0.78, -hr * 0.44, hr * 0.42);
    g.lineTo(-hr * 0.54, -hr * 0.16);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawHairFront(g, hd, hr, ha, s, hairStyle, hairRgb, rimRgb, outlineCol, screenGlow = 0) {
  if (!hairStyle || hairStyle === 'none') return;
  const hiRgb = mixRgb(hairRgb, [138, 104, 86], 0.30);
  const deepStrandRgb = mixRgb(hairRgb, [8, 6, 8], 0.55);
  g.save();
  g.translate(hd[0], hd[1]);
  g.rotate(clamp(ha * 0.30, -0.22, 0.25));
  g.fillStyle = rgbCss(hairRgb);
  g.strokeStyle = outlineCol;
  g.lineWidth = 2.0 * s;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (hairStyle === 'buzz') {
    g.beginPath();
    g.arc(0, 0, hr * 1.02, Math.PI * 0.92, Math.PI * 1.92);
    g.quadraticCurveTo(hr * 0.32, -hr * 0.56, -hr * 0.48, -hr * 0.36);
    g.quadraticCurveTo(-hr * 0.78, -hr * 0.06, -hr * 0.96, hr * 0.24);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (hairStyle === 'receding') {
    g.beginPath();
    g.arc(-hr * 0.14, 0, hr * 1.02, Math.PI * 0.82, Math.PI * 1.62);
    g.quadraticCurveTo(-hr * 0.32, -hr * 0.52, -hr * 0.72, hr * 0.26);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (hairStyle === 'messy' || hairStyle === 'spiky') {
    const spk = hairStyle === 'spiky' ? 1.24 : 1.14;
    g.beginPath();
    g.moveTo(-hr * 0.96, hr * 0.22);
    g.quadraticCurveTo(-hr * 1.14, -hr * 0.42, -hr * 0.72, -hr * 0.96 * spk);
    g.lineTo(-hr * 0.42, -hr * 0.82);
    g.lineTo(-hr * 0.12, -hr * 1.15 * spk);
    g.lineTo(hr * 0.18, -hr * 0.88);
    g.lineTo(hr * 0.56, -hr * 1.12 * spk);
    g.lineTo(hr * 0.48, -hr * 0.76);
    g.lineTo(hr * 0.96, -hr * 0.86 * spk);
    g.quadraticCurveTo(hr * 0.72, -hr * 0.45, hr * 0.28, -hr * 0.52);
    g.quadraticCurveTo(-hr * 0.28, -hr * 0.58, -hr * 0.56, -hr * 0.18);
    g.quadraticCurveTo(-hr * 0.68, hr * 0.12, -hr * 0.96, hr * 0.22);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (hairStyle === 'curly') {
    const puffs = [
      [-0.78, -0.22, 0.36],
      [-0.58, -0.68, 0.40],
      [-0.14, -0.92, 0.44],
      [0.34, -0.86, 0.40],
      [0.68, -0.58, 0.34],
      [-0.86, 0.12, 0.28],
    ];
    for (const [px, py, pr] of puffs) {
      g.beginPath();
      g.arc(px * hr, py * hr, pr * hr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.fillStyle = rgbCss(hairRgb);
    for (const [px, py, pr] of puffs) {
      g.beginPath();
      g.arc(px * hr, py * hr, pr * hr - 1.1 * s, 0, Math.PI * 2);
      g.fill();
    }
  } else if (hairStyle === 'long' || hairStyle === 'ponytail' || hairStyle === 'bun') {
    g.beginPath();
    g.arc(0, -hr * 0.04, hr * 1.05, Math.PI * 0.88, Math.PI * 1.94);
    g.quadraticCurveTo(hr * 0.42, -hr * 0.40, -hr * 0.18, -hr * 0.52);
    g.quadraticCurveTo(-hr * 0.58, -hr * 0.28, -hr * 0.94, hr * 0.28);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    // 'textured_sweep', 'parted', 'short', 'slick' — sculpted 3/4 layered sweep with feathered front locks & sideburn
    const lift = hairStyle === 'slick' ? 0.94 : (hairStyle === 'short' ? 1.00 : 1.08);
    g.beginPath();
    // Start low behind the ear at the nape, sweep up rounded back cranium with layered silhouette
    g.moveTo(-hr * 0.72, hr * 0.52);
    g.quadraticCurveTo(-hr * 1.06, hr * 0.28, -hr * 1.08, -hr * 0.20);
    g.lineTo(-hr * 0.99, -hr * 0.26);
    g.quadraticCurveTo(-hr * 1.10, -hr * 0.64, -hr * 0.76, -hr * 0.94 * lift);
    g.lineTo(-hr * 0.66, -hr * 0.88 * lift);
    // Crown volume sweeping forward into feathered upturned front locks
    g.quadraticCurveTo(-hr * 0.26, -hr * 1.24 * lift, hr * 0.34, -hr * 1.16 * lift);
    g.quadraticCurveTo(hr * 0.78, -hr * 1.12 * lift, hr * 1.05, -hr * 0.92 * lift);
    g.quadraticCurveTo(hr * 0.88, -hr * 0.76 * lift, hr * 0.74, -hr * 0.74 * lift);
    g.quadraticCurveTo(hr * 0.94, -hr * 0.66 * lift, hr * 1.01, -hr * 0.58 * lift);
    g.quadraticCurveTo(hr * 0.74, -hr * 0.48, hr * 0.34, -hr * 0.54);
    // Forehead hairline curving back to temple & sideburn in front of the ear
    g.quadraticCurveTo(-hr * 0.12, -hr * 0.64, -hr * 0.38, -hr * 0.40);
    g.quadraticCurveTo(-hr * 0.33, -hr * 0.08, -hr * 0.37, hr * 0.18);
    g.quadraticCurveTo(-hr * 0.46, hr * 0.16, -hr * 0.47, -hr * 0.04);
    // Arch cleanly around the top & back of the C-ear to join the nape
    g.quadraticCurveTo(-hr * 0.64, -hr * 0.16, -hr * 0.75, hr * 0.08);
    g.quadraticCurveTo(-hr * 0.80, hr * 0.30, -hr * 0.72, hr * 0.52);
    g.closePath();
    g.fill();
    g.stroke();

    // Warm midtone crown sheen
    g.strokeStyle = `rgba(${hiRgb[0]},${hiRgb[1]},${hiRgb[2]},0.44)`;
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.moveTo(-hr * 0.62, -hr * 0.72 * lift);
    g.quadraticCurveTo(-hr * 0.06, -hr * 1.02 * lift, hr * 0.62, -hr * 0.84 * lift);
    g.stroke();

    // Internal sculpted hair lock strand lines
    g.strokeStyle = `rgba(${deepStrandRgb[0]},${deepStrandRgb[1]},${deepStrandRgb[2]},0.82)`;
    g.lineWidth = 1.45 * s;
    g.beginPath();
    g.moveTo(-hr * 0.76, -hr * 0.42);
    g.quadraticCurveTo(-hr * 0.26, -hr * 0.86 * lift, hr * 0.48, -hr * 0.78 * lift);
    g.moveTo(-hr * 0.52, -hr * 0.22);
    g.quadraticCurveTo(-hr * 0.04, -hr * 0.68 * lift, hr * 0.68, -hr * 0.62 * lift);
    g.stroke();

    // Subtle soft cyan bounce sheen on front hair tips when illuminated by phone/screen
    if (screenGlow > 0.02) {
      const glowA = clamp(screenGlow * 0.28, 0, 0.32);
      g.strokeStyle = `rgba(148, 218, 252, ${glowA.toFixed(3)})`;
      g.lineWidth = 1.2 * s;
      g.beginPath();
      g.moveTo(hr * 0.42, -hr * 0.53);
      g.quadraticCurveTo(hr * 0.74, -hr * 0.51, hr * 0.96, -hr * 0.59 * lift);
      g.stroke();
    }
    g.restore();
    return;
  }
  g.restore();
}

// ---------------- ACCESSORIES ----------------

function drawBackCape(g, r, mainRgb) {
  const sh = r.shoulder;
  const hip = r.hip;
  const s = r.scale;
  g.save();
  g.fillStyle = rgbCss(mixRgb(mainRgb, [20, 24, 42], 0.35));
  g.strokeStyle = '#060912';
  g.lineWidth = 2.4 * s;
  g.beginPath();
  g.moveTo(sh[0] - 6 * s, sh[1] + 2 * s);
  g.quadraticCurveTo(sh[0] - 42 * s, lerp(sh[1], hip[1], 0.55), hip[0] - 48 * s, hip[1] + 38 * s);
  g.lineTo(hip[0] - 12 * s, hip[1] + 26 * s);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

function drawSingleAccessory(g, r, accessory, mainRgb, rimRgb, extraOpts = {}) {
  const hd = r.head;
  const hr = r.radius;
  const s = r.scale;
  g.save();
  if (accessory === 'glasses' || accessory === 'sunglasses') {
    const dark = accessory === 'sunglasses';
    g.strokeStyle = '#090d16';
    g.fillStyle = dark ? 'rgba(9,13,22,0.88)' : 'rgba(255,255,255,0.22)';
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.roundRect(hd[0] + 1 * s, hd[1] - 6.5 * s, 11.5 * s, 8.5 * s, 2.5 * s);
    g.roundRect(hd[0] + 15 * s, hd[1] - 6.5 * s, 8.8 * s, 8.5 * s, 2.5 * s);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(hd[0] - 10 * s, hd[1] - 2.5 * s);
    g.lineTo(hd[0] + 1 * s, hd[1] - 2.5 * s);
    g.moveTo(hd[0] + 12.5 * s, hd[1] - 3 * s);
    g.lineTo(hd[0] + 15 * s, hd[1] - 3 * s);
    g.stroke();
  } else if (accessory === 'headband') {
    g.strokeStyle = rgbCss(rimRgb);
    g.lineWidth = 5.5 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hd[0] - hr * 0.92, hd[1] - hr * 0.34);
    g.lineTo(hd[0] + hr * 0.92, hd[1] - hr * 0.34);
    g.stroke();
    g.lineWidth = 3.8 * s;
    g.beginPath();
    g.moveTo(hd[0] - hr * 0.92, hd[1] - hr * 0.34);
    g.lineTo(hd[0] - hr * 1.45, hd[1] - hr * 0.05);
    g.moveTo(hd[0] - hr * 0.92, hd[1] - hr * 0.34);
    g.lineTo(hd[0] - hr * 1.38, hd[1] + hr * 0.24);
    g.stroke();
  } else if (accessory === 'tie') {
    const sh = r.shoulder;
    const mid = r.spineMid || [lerp(sh[0], r.hip[0], 0.5), lerp(sh[1], r.hip[1], 0.5)];
    const tx = mid[0] + 6 * s;
    const ty = mid[1];
    g.fillStyle = '#e11d48';
    g.strokeStyle = '#090d16';
    g.lineWidth = 1.6 * s;
    g.beginPath();
    g.moveTo(sh[0] + 4 * s, sh[1] + 5 * s);
    g.lineTo(tx + 5.5 * s, ty + 4 * s);
    g.lineTo(tx + 0.5 * s, ty + 16 * s);
    g.lineTo(tx - 4.5 * s, ty + 4 * s);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (accessory === 'bowtie') {
    const sh = r.shoulder;
    const bx = sh[0] + 5 * s, by = sh[1] + 6 * s;
    g.fillStyle = '#fb7185';
    g.strokeStyle = '#090d16';
    g.lineWidth = 1.5 * s;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx - 9 * s, by - 5 * s);
    g.lineTo(bx - 9 * s, by + 5 * s);
    g.closePath();
    g.moveTo(bx, by);
    g.lineTo(bx + 9 * s, by - 5 * s);
    g.lineTo(bx + 9 * s, by + 5 * s);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (accessory === 'cap') {
    g.fillStyle = rgbCss(mixRgb(mainRgb, [15, 23, 42], 0.45));
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.arc(hd[0], hd[1] - 4 * s, hr * 1.04, Math.PI, 0);
    g.lineTo(hd[0] + hr * 1.58, hd[1] - 4 * s);
    g.lineTo(hd[0] - hr * 1.04, hd[1] - 4 * s);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (accessory === 'hat') {
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.roundRect(hd[0] - hr * 1.35, hd[1] - hr * 0.72, hr * 2.7, 6 * s, 3);
    g.roundRect(hd[0] - hr * 0.82, hd[1] - hr * 1.48, hr * 1.64, hr * 0.80, [6, 6, 1, 1]);
    g.fill();
    g.stroke();
  } else if (accessory === 'crown') {
    g.fillStyle = '#fbbf24';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2 * s;
    const topY = hd[1] - hr * 0.88;
    g.beginPath();
    g.moveTo(hd[0] - 16 * s, topY);
    g.lineTo(hd[0] - 18 * s, topY - 16 * s);
    g.lineTo(hd[0] - 7 * s, topY - 7 * s);
    g.lineTo(hd[0], topY - 20 * s);
    g.lineTo(hd[0] + 7 * s, topY - 7 * s);
    g.lineTo(hd[0] + 18 * s, topY - 16 * s);
    g.lineTo(hd[0] + 16 * s, topY);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (accessory === 'helmet') {
    g.fillStyle = 'rgba(56,189,248,0.42)';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.roundRect(hd[0] - 2 * s, hd[1] - 9 * s, hr * 1.06, 15 * s, 5 * s);
    g.fill();
    g.stroke();
  } else if (accessory === 'scarf') {
    const sh = r.shoulder;
    const scarfFill = extraOpts.scarfColor || rgbCss(mixRgb(mainRgb, [255, 255, 255], 0.38));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [lw, col] of [[11.5 * s, '#060912'], [7.8 * s, scarfFill]]) {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(sh[0] - 11 * s, sh[1] - 1 * s);
      g.lineTo(sh[0] + 11 * s, sh[1] - 1 * s);
      g.stroke();
      g.beginPath();
      g.moveTo(sh[0] - 6 * s, sh[1] + 1 * s);
      g.lineTo(sh[0] - 11 * s, sh[1] + 22 * s);
      g.stroke();
    }
  } else if (accessory === 'badge') {
    const sh = r.shoulder;
    g.fillStyle = '#fbbf24';
    g.strokeStyle = '#090d16';
    g.lineWidth = 1.6 * s;
    g.beginPath();
    g.arc(sh[0] + 7 * s, sh[1] + 18 * s, 5.5 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (accessory === 'headphones') {
    g.strokeStyle = '#0f172a';
    g.lineWidth = 4.5 * s;
    g.beginPath();
    g.arc(hd[0], hd[1] - 2 * s, hr * 1.08, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.fillStyle = rgbCss(rimRgb);
    g.strokeStyle = '#090d16';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.roundRect(hd[0] - 9 * s, hd[1] - 7 * s, 10 * s, 15 * s, 4 * s);
    g.fill();
    g.stroke();
  } else if (accessory === 'halo') {
    g.strokeStyle = '#fde047';
    g.lineWidth = 3.2 * s;
    g.beginPath();
    g.ellipse(hd[0], hd[1] - hr * 1.36, 18 * s, 5 * s, 0, 0, Math.PI * 2);
    g.stroke();
  } else if (accessory === 'work_bag') {
    const sh = r.shoulder;
    const hip = r.hip;
    const bagCol = extraOpts.bagColor || '#9a3412';
    g.strokeStyle = '#090d16';
    g.lineWidth = 3.2 * s;
    g.beginPath();
    g.moveTo(sh[0] + 4 * s, sh[1] + 2 * s);
    g.lineTo(hip[0] - 8 * s, hip[1] + 4 * s);
    g.stroke();
    g.fillStyle = bagCol;
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.roundRect(hip[0] - 24 * s, hip[1] - 4 * s, 30 * s, 24 * s, 5 * s);
    g.fill();
    g.stroke();
  } else if (accessory === 'watch') {
    const wr = r.al[2];
    const el = r.al[1];
    const ang = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
    g.translate(lerp(el[0], wr[0], 0.86), lerp(el[1], wr[1], 0.86));
    g.rotate(ang);
    g.fillStyle = '#0f172a';
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 1.4 * s;
    g.beginPath();
    g.roundRect(-3 * s, -6 * s, 6 * s, 12 * s, 2 * s);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawBackBackpack(g, r, bagColor = '#eab308') {
  const sh = r.shoulder;
  const hip = r.hip;
  const s = r.scale;
  const mx = lerp(sh[0], hip[0], 0.42) - 18 * s;
  const my = lerp(sh[1], hip[1], 0.42);
  g.save();
  g.fillStyle = bagColor;
  g.strokeStyle = '#060912';
  g.lineWidth = 2.6 * s;
  g.beginPath();
  g.roundRect(mx - 12 * s, my - 24 * s, 24 * s, 44 * s, [8 * s, 4 * s, 6 * s, 8 * s]);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.roundRect(mx - 10 * s, my + 2 * s, 14 * s, 14 * s, 3 * s);
  g.fill();
  g.strokeStyle = '#060912';
  g.lineWidth = 3.2 * s;
  g.beginPath();
  g.moveTo(mx + 10 * s, my - 18 * s);
  g.lineTo(sh[0] + 5 * s, sh[1] + 8 * s);
  g.stroke();
  g.restore();
}

function drawTorsoCoat(g, r, build, coatColor = '#1e293b') {
  const sh = r.shoulder;
  const hip = r.hip;
  const mid = r.spineMid || [lerp(sh[0], hip[0], 0.5), lerp(sh[1], hip[1], 0.5)];
  const s = r.scale;
  const hw = 15.2 * s * build.torsoW;
  const dx = hip[0] - sh[0];
  const dy = hip[1] - sh[1];
  const len = Math.max(1e-4, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const extX = hip[0] + (dx / len) * 14 * s;
  const extY = hip[1] + (dy / len) * 14 * s;
  const baseRgb = hexToRgb(coatColor);
  const seamCss = rgbCss(mixRgb(baseRgb, [255, 255, 255], 0.22));

  g.save();
  g.fillStyle = rgbCss(baseRgb);
  g.strokeStyle = '#060912';
  g.lineWidth = 2.4 * s;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(sh[0] - nx * hw * 0.98, sh[1] - ny * hw * 0.98);
  g.lineTo(sh[0] + nx * hw * 1.02, sh[1] + ny * hw * 1.02);
  g.quadraticCurveTo(mid[0] + nx * hw * 1.04, mid[1] + ny * hw * 1.04, extX + nx * hw * 1.12, extY + ny * hw * 1.12);
  g.lineTo(extX - nx * hw * 1.16, extY - ny * hw * 1.16);
  g.quadraticCurveTo(mid[0] - nx * hw * 1.04, mid[1] - ny * hw * 1.04, sh[0] - nx * hw * 0.98, sh[1] - ny * hw * 0.98);
  g.closePath();
  g.fill();
  g.stroke();

  g.strokeStyle = seamCss;
  g.lineWidth = 1.8 * s;
  g.beginPath();
  g.moveTo(sh[0] + nx * 3 * s, sh[1] + 4 * s);
  g.lineTo(mid[0] + nx * 7 * s, mid[1]);
  g.lineTo(extX + nx * 4 * s, extY - 2 * s);
  g.stroke();
  g.restore();
}

// ---------------- 3/4 SCULPTED HEAD, EAR & EXPRESSIVE FACE ----------------

function traceHead3QPath(g, hr) {
  g.beginPath();
  // Top crown -> smooth back cranium -> nape -> jawline -> softly rounded 3/4 chin -> cheek -> forehead
  g.moveTo(0, -hr * 1.01);
  g.bezierCurveTo(-hr * 0.66, -hr * 1.01, -hr * 1.02, -hr * 0.56, -hr * 0.99, hr * 0.04);
  g.bezierCurveTo(-hr * 0.96, hr * 0.52, -hr * 0.66, hr * 0.88, -hr * 0.16, hr * 1.00);
  g.bezierCurveTo(hr * 0.22, hr * 1.08, hr * 0.62, hr * 0.98, hr * 0.84, hr * 0.66);
  g.bezierCurveTo(hr * 1.01, hr * 0.38, hr * 1.02, -hr * 0.14, hr * 0.93, -hr * 0.52);
  g.bezierCurveTo(hr * 0.80, -hr * 0.86, hr * 0.44, -hr * 1.01, 0, -hr * 1.01);
  g.closePath();
}

function drawSculpted3QHead(g, hd, hr, ha, s, colors) {
  const { outlineCol, sw, fillCol, screenGlow = 0 } = colors;
  const headRot = clamp(Number(ha || 0) * 0.30, -0.22, 0.25);

  g.save();
  g.translate(hd[0], hd[1]);
  if (Math.abs(headRot) > 0.002) g.rotate(headRot);

  // Outer ink outline + pure interior fill
  traceHead3QPath(g, hr);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = outlineCol;
  g.lineWidth = sw * 2;
  g.stroke();
  g.fillStyle = fillCol;
  g.fill();

  // Subtle 2.5D cool-slate back-edge shadow + interactive cyan screen bounce light on cheek & chin
  g.save();
  traceHead3QPath(g, hr);
  g.clip();
  const shGrad = g.createLinearGradient(-hr * 1.05, -hr * 0.3, hr * 0.45, hr * 0.2);
  shGrad.addColorStop(0, 'rgba(134, 158, 194, 0.28)');
  shGrad.addColorStop(0.55, 'rgba(134, 158, 194, 0.06)');
  shGrad.addColorStop(1, 'rgba(134, 158, 194, 0.00)');
  g.fillStyle = shGrad;
  g.fillRect(-hr * 1.2, -hr * 1.2, hr * 2.4, hr * 2.4);

  if (screenGlow > 0.02) {
    const glowA = clamp(screenGlow * 0.36, 0, 0.42);
    const faceGlow = g.createRadialGradient(hr * 0.68, hr * 0.42, hr * 0.05, hr * 0.52, hr * 0.30, hr * 1.05);
    faceGlow.addColorStop(0, `rgba(125, 211, 252, ${glowA.toFixed(3)})`);
    faceGlow.addColorStop(0.55, `rgba(186, 230, 253, ${(glowA * 0.38).toFixed(3)})`);
    faceGlow.addColorStop(1, 'rgba(186, 230, 253, 0.000)');
    g.fillStyle = faceGlow;
    g.fillRect(-hr * 1.2, -hr * 1.2, hr * 2.4, hr * 2.4);
  }
  g.restore();

  // Sculpted C-shaped ear on the 3/4 side of the head with inner tragus arc
  const earX = -hr * 0.56;
  const earY = hr * 0.08;
  g.fillStyle = fillCol;
  g.strokeStyle = outlineCol;
  g.lineWidth = Math.max(1.5 * s, sw * 0.78);
  g.beginPath();
  g.arc(earX, earY, hr * 0.20, Math.PI * 0.48, Math.PI * 1.56);
  g.fill();
  g.stroke();

  g.strokeStyle = 'rgba(13, 18, 28, 0.52)';
  g.lineWidth = 1.25 * s;
  g.beginPath();
  g.arc(earX + hr * 0.02, earY + hr * 0.01, hr * 0.095, Math.PI * 0.62, Math.PI * 1.48);
  g.stroke();

  g.restore();
}

function drawFaceExpression(g, hd, hr, s, rawExpression = 'neutral', anim = {}) {
  const EXPR_ALIASES = { exhausted: 'tired', worried: 'sad', anxious: 'tense', calm: 'neutral' };
  const expression = EXPR_ALIASES[rawExpression] || rawExpression || 'neutral';
  const lookX = clamp(Number(anim.lookX || 0), -1, 1) * 2.1 * s;
  const lookY = clamp(Number(anim.lookY || 0), -1, 1) * 1.8 * s;
  const talkAmt = clamp(Number(anim.talkAmount || 0), 0, 1);
  const viseme = String(anim.viseme || 'open');
  const headRot = clamp(Number(anim.headAngle || 0) * 0.30, -0.22, 0.25);
  const gT = Number(anim.globalT || 0);
  const seed = Number(anim.blinkSeed || 0);

  g.save();
  if (Math.abs(headRot) > 0.002) {
    g.translate(hd[0], hd[1]);
    g.rotate(headRot);
    g.translate(-hd[0], -hd[1]);
  }
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Deterministic, desynchronized natural eye blink (~0.13s every ~3.8s)
  const blinkPeriod = 3.55 + (Math.abs(Math.sin(seed * 19.7)) * 1.15);
  const blinkPhase = ((gT + seed * 2.31) % blinkPeriod + blinkPeriod) % blinkPeriod;
  const isBlinking = blinkPhase < 0.13;
  const blinkClose = isBlinking ? Math.sin((blinkPhase / 0.13) * Math.PI) : 0;

  const ex1 = hd[0] + hr * 0.14 + lookX;
  const ex2 = hd[0] + hr * 0.56 + lookX;
  const ey = hd[1] - hr * 0.01 + lookY;
  const er = 2.95 * s;

  g.fillStyle = '#0d1017';
  g.strokeStyle = '#0d1017';

  if (expression === 'slumped' || blinkClose > 0.72) {
    g.lineWidth = 2.1 * s;
    g.beginPath();
    g.moveTo(ex1 - 3.3 * s, ey + 0.8 * s); g.lineTo(ex1 + 3.3 * s, ey + 0.8 * s);
    g.moveTo(ex2 - 2.9 * s, ey + 0.8 * s); g.lineTo(ex2 + 2.9 * s, ey + 0.8 * s);
    g.stroke();
  } else {
    const baseScaleY = expression === 'shocked' ? 1.30 : (expression === 'sad' || expression === 'tired' ? 0.84 : 1.00);
    const scaleY = Math.max(0.22, baseScaleY * (1 - blinkClose * 0.85));
    // Subtle upper eyelid contour arcs
    g.strokeStyle = 'rgba(13, 16, 23, 0.55)';
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.arc(ex1, ey - 0.3 * s, er * 1.24, Math.PI * 1.12, Math.PI * 1.88);
    g.stroke();
    g.beginPath();
    g.arc(ex2, ey - 0.3 * s, er * 1.10, Math.PI * 1.12, Math.PI * 1.88);
    g.stroke();

    // Crisp dark pupil/iris
    g.fillStyle = '#0d1017';
    g.beginPath();
    g.ellipse(ex1, ey, er * 0.92, er * scaleY, 0, 0, Math.PI * 2);
    g.ellipse(ex2, ey, er * 0.82, er * 0.88 * scaleY, 0, 0, Math.PI * 2);
    g.fill();

    // Subtle specular eye catchlight dot
    if (scaleY > 0.45) {
      const catchAlpha = (expression === 'tired' || expression === 'sad') ? 0.42 : 0.85;
      g.fillStyle = `rgba(255,255,255,${catchAlpha})`;
      g.beginPath();
      g.arc(ex1 - 0.75 * s, ey - 0.85 * s * scaleY, 0.82 * s, 0, Math.PI * 2);
      g.arc(ex2 - 0.65 * s, ey - 0.75 * s * scaleY, 0.72 * s, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0d1017';
    }
  }

  // Subtle 3/4 nose bridge & rounded tip between and below the eyes
  const nx = hd[0] + hr * 0.42 + lookX * 0.52;
  const ny = ey + 2.8 * s;
  g.strokeStyle = 'rgba(13, 16, 23, 0.62)';
  g.lineWidth = 1.5 * s;
  g.beginPath();
  g.moveTo(nx - 0.4 * s, ny - 2.4 * s);
  g.quadraticCurveTo(nx + 2.9 * s, ny + 1.5 * s, nx - 0.3 * s, ny + 2.7 * s);
  g.stroke();

  // Gentle lower-lid / late-night under-eye contour (prominent when tired/tense/sad, delicate otherwise)
  const underEyeAlpha = (expression === 'tired' || expression === 'tense' || expression === 'sad') ? 0.62 : 0.24;
  g.strokeStyle = `rgba(13, 16, 23, ${underEyeAlpha})`;
  g.lineWidth = 1.25 * s;
  g.beginPath();
  g.arc(ex1, ey + 1.4 * s, er * 1.32, 0.20 * Math.PI, 0.80 * Math.PI);
  g.stroke();
  g.beginPath();
  g.arc(ex2, ey + 1.2 * s, er * 1.16, 0.20 * Math.PI, 0.80 * Math.PI);
  g.stroke();

  // Sculpted dark-espresso eyebrows
  g.strokeStyle = '#1f1614';
  g.lineWidth = 2.35 * s;
  const talkLift = talkAmt * 1.25 * s;
  const by = ey - 6.8 * s - talkLift;
  g.beginPath();
  if (expression === 'sad' || expression === 'tired' || expression === 'slumped') {
    g.moveTo(ex1 - 4.5 * s, by + 1.8 * s);
    g.quadraticCurveTo(ex1 - 0.6 * s, by + 0.5 * s, ex1 + 3.2 * s, by - 1.4 * s);
    g.moveTo(ex2 - 2.6 * s, by - 1.4 * s);
    g.quadraticCurveTo(ex2 + 0.6 * s, by + 0.4 * s, ex2 + 3.8 * s, by + 1.8 * s);
  } else if (expression === 'determined' || expression === 'focused' || expression === 'tense') {
    g.moveTo(ex1 - 4.3 * s, by - 1.4 * s);
    g.quadraticCurveTo(ex1 - 0.2 * s, by - 0.2 * s, ex1 + 3.4 * s, by + 1.2 * s);
    g.moveTo(ex2 - 2.8 * s, by + 1.2 * s);
    g.quadraticCurveTo(ex2 + 0.4 * s, by - 0.2 * s, ex2 + 3.8 * s, by - 1.4 * s);
  } else if (expression === 'excited' || expression === 'hopeful' || expression === 'shocked' || expression === 'curious') {
    const lift = expression === 'shocked' ? 3.2 * s : 1.7 * s;
    g.moveTo(ex1 - 3.9 * s, by - lift + 1.1 * s);
    g.quadraticCurveTo(ex1 - 0.3 * s, by - lift - 1.7 * s, ex1 + 3.2 * s, by - lift + 0.3 * s);
    g.moveTo(ex2 - 2.6 * s, by - lift + 0.3 * s);
    g.quadraticCurveTo(ex2 + 0.4 * s, by - lift - 1.7 * s, ex2 + 3.4 * s, by - lift + 1.1 * s);
  } else {
    g.moveTo(ex1 - 3.9 * s, by + 0.3 * s);
    g.quadraticCurveTo(ex1 - 0.3 * s, by - 1.2 * s, ex1 + 3.2 * s, by + 0.1 * s);
    g.moveTo(ex2 - 2.6 * s, by + 0.1 * s);
    g.quadraticCurveTo(ex2 + 0.3 * s, by - 1.2 * s, ex2 + 3.4 * s, by + 0.3 * s);
  }
  g.stroke();

  // Acoustic-envelope 4-viseme lip-sync mouth when character is speaking; naturally closed when silent/listening
  const mx = hd[0] + hr * 0.34 + lookX * 0.45;
  const my = ey + 8.6 * s - lookY * 0.25;
  g.strokeStyle = '#0d1017';
  g.lineWidth = 1.75 * s;
  if (talkAmt > 0.04 && viseme === 'closed') {
    g.beginPath();
    g.moveTo(mx - 3.8 * s, my + 0.9 * s);
    g.quadraticCurveTo(mx, my + 1.3 * s, mx + 3.8 * s, my + 0.9 * s);
    g.stroke();
  } else if (talkAmt > 0.04) {
    let openW, openH;
    if (viseme === 'round') {
      openW = (2.1 + talkAmt * 1.25) * s;
      openH = (1.5 + talkAmt * 2.85) * s;
    } else if (viseme === 'wide') {
      openW = (3.9 + talkAmt * 1.45) * s;
      openH = (0.85 + talkAmt * 1.95) * s;
    } else {
      openW = (3.2 + talkAmt * 1.40) * s;
      openH = (1.15 + talkAmt * 3.10) * s;
    }

    const cy = my + 0.85 * s;
    g.fillStyle = '#180e16';
    g.beginPath();
    if (viseme === 'round') {
      g.ellipse(mx, cy, openW, openH, 0, 0, Math.PI * 2);
    } else {
      g.moveTo(mx - openW, cy - openH * 0.42);
      g.quadraticCurveTo(mx, cy - openH * 0.68, mx + openW, cy - openH * 0.42);
      g.quadraticCurveTo(mx + openW * 0.92, cy + openH * 1.08, mx, cy + openH * 1.08);
      g.quadraticCurveTo(mx - openW * 0.92, cy + openH * 1.08, mx - openW, cy - openH * 0.42);
      g.closePath();
    }
    g.fill();

    if (viseme !== 'round' && openH > 1.55 * s) {
      g.fillStyle = 'rgba(241, 245, 249, 0.88)';
      g.beginPath();
      g.roundRect(mx - openW * 0.68, cy - openH * 0.48, openW * 1.36, Math.min(1.5 * s, openH * 0.42), 0.7 * s);
      g.fill();
    }
    if (openH > 2.25 * s) {
      g.fillStyle = '#be4b5c';
      g.beginPath();
      g.ellipse(mx, cy + openH * 0.52, openW * 0.58, openH * 0.34, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.strokeStyle = '#0d1017';
    g.lineWidth = 1.4 * s;
    g.beginPath();
    if (viseme === 'round') {
      g.ellipse(mx, cy, openW, openH, 0, 0, Math.PI * 2);
    } else {
      g.moveTo(mx - openW, cy - openH * 0.42);
      g.quadraticCurveTo(mx, cy - openH * 0.68, mx + openW, cy - openH * 0.42);
      g.quadraticCurveTo(mx + openW * 0.92, cy + openH * 1.08, mx, cy + openH * 1.08);
      g.quadraticCurveTo(mx - openW * 0.92, cy + openH * 1.08, mx - openW, cy - openH * 0.42);
      g.closePath();
    }
    g.stroke();
  } else {
    g.beginPath();
    if (expression === 'smile' || expression === 'hopeful' || expression === 'excited') {
      g.arc(mx, my - 1.5 * s, 4.5 * s, 0.16 * Math.PI, 0.84 * Math.PI);
    } else if (expression === 'shocked') {
      g.ellipse(mx, my + 0.6 * s, 2.1 * s, 2.4 * s, 0, 0, Math.PI * 2);
    } else if (expression === 'sad' || expression === 'tired' || expression === 'tense') {
      g.moveTo(mx - 4.2 * s, my + 1.8 * s);
      g.quadraticCurveTo(mx, my + 0.4 * s, mx + 3.6 * s, my + 2.0 * s);
    } else {
      g.moveTo(mx - 3.7 * s, my + 0.9 * s);
      g.quadraticCurveTo(mx, my + 1.35 * s, mx + 3.6 * s, my + 0.7 * s);
    }
    g.stroke();
  }
  g.restore();
}

// ---------------- CANONICAL SEAMLESS SINGLE-COLOUR CAPSULE RIG ----------------

/**
 * Exact convex hull (Minkowski tangent-capsule) of two circles `(pA, rA)` and `(pB, rB)`.
 * Strictly convex at every orientation and separation:
 *  - Zero self-intersection or nonzero-winding cancellation at any bend angle (0°..180°).
 *  - Expanding both radii by `sw` yields the exact Euclidean parallel offset at distance `sw`.
 */
function traceTangentCapsule(g, pA, rA0, pB, rB0) {
  const rA = Math.max(0.2, rA0);
  const rB = Math.max(0.2, rB0);
  const dx = pB[0] - pA[0];
  const dy = pB[1] - pA[1];
  const d = Math.hypot(dx, dy);
  g.beginPath();
  if (d <= Math.abs(rA - rB) + 1e-4) {
    const useA = rA >= rB;
    const c = useA ? pA : pB;
    g.arc(c[0], c[1], Math.max(rA, rB), 0, Math.PI * 2);
    g.closePath();
    return;
  }
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos(clamp((rA - rB) / d, -1, 1));
  g.arc(pA[0], pA[1], rA, theta + alpha, theta - alpha, false);
  g.arc(pB[0], pB[1], rB, theta - alpha, theta + alpha, false);
  g.closePath();
}

function fillTangentCapsule(g, pA, rA, pB, rB, colorCss) {
  g.fillStyle = colorCss;
  traceTangentCapsule(g, pA, rA, pB, rB);
  g.fill();
}

function traceHandSilhouette(g, handPose, s) {
  g.beginPath();
  if (handPose === 'point') {
    g.moveTo(-2.6 * s, -4.4 * s);
    g.lineTo(5.8 * s, -5.8 * s);
    g.quadraticCurveTo(8.0 * s, -5.4 * s, 7.2 * s, -3.4 * s);
    g.lineTo(16.8 * s, -2.8 * s);
    g.quadraticCurveTo(18.6 * s, -1.3 * s, 16.4 * s, 0.2 * s);
    g.lineTo(9.2 * s, 0.6 * s);
    g.quadraticCurveTo(10.0 * s, 4.6 * s, 4.8 * s, 5.0 * s);
    g.lineTo(-2.6 * s, 4.0 * s);
    g.closePath();
  } else if (handPose === 'fist' || handPose === 'grip') {
    g.roundRect(-2.5 * s, -4.8 * s, 11.2 * s, 9.6 * s, 3.8 * s);
  } else {
    // Articulated 4-finger + inner thumb silhouette ('relaxed', 'open', 'wave', 'clasp')
    const spread = (handPose === 'open' || handPose === 'wave') ? 1.18 : 1.0;
    // Wrist inner (-Y is forward/thumb side when arm hangs down at +PI/2)
    g.moveTo(-2.6 * s, -4.3 * s);
    // Thumb branching forward-down
    g.quadraticCurveTo(2.4 * s, -6.2 * s * spread, 7.6 * s, -6.8 * s * spread);
    g.quadraticCurveTo(9.4 * s, -6.3 * s * spread, 8.6 * s, -4.4 * s * spread);
    g.lineTo(5.4 * s, -3.3 * s);
    // Index finger
    g.lineTo(14.2 * s, -3.1 * s * spread);
    g.quadraticCurveTo(16.0 * s, -2.1 * s, 14.4 * s, -1.1 * s);
    // Middle finger (longest)
    g.lineTo(15.6 * s, -0.7 * s);
    g.quadraticCurveTo(17.2 * s, 0.4 * s, 15.4 * s, 1.5 * s);
    // Ring finger
    g.lineTo(14.3 * s, 1.9 * s);
    g.quadraticCurveTo(15.7 * s, 2.9 * s, 13.8 * s, 3.8 * s);
    // Little finger + outer palm heel
    g.lineTo(11.6 * s, 4.2 * s * spread);
    g.quadraticCurveTo(12.4 * s, 5.3 * s * spread, 9.8 * s, 5.5 * s * spread);
    g.quadraticCurveTo(4.2 * s, 5.2 * s, -2.6 * s, 4.1 * s);
    g.closePath();
  }
}

function drawHandFingerSeparators(g, handPose, s, outlineCol) {
  if (handPose === 'fist' || handPose === 'grip' || handPose === 'point') return;
  g.strokeStyle = outlineCol;
  g.lineWidth = 1.25 * s;
  g.lineCap = 'round';
  g.beginPath();
  // Subtle inter-finger separation creases for index / middle / ring / pinky
  g.moveTo(7.4 * s, -1.1 * s);
  g.lineTo(14.1 * s, -1.1 * s);
  g.moveTo(7.6 * s, 1.45 * s);
  g.lineTo(14.0 * s, 1.55 * s);
  g.moveTo(7.2 * s, 3.65 * s);
  g.lineTo(11.6 * s, 3.85 * s);
  g.stroke();
}

/**
 * Renders a complete seamless arm (`shoulder -> elbow -> wrist -> articulated hand`) with
 * subtle 2.5D cylindrical edge shading and optional cyan screen bounce rim-light.
 */
function drawSeamlessArm(g, points, radii, handPose, s, colors) {
  const { outlineCol, sw, fillCol, screenGlow = 0, shadeSide = -1 } = colors;
  const [p0, p1, p2] = points;
  const [r0, r1, r2] = radii;
  const forearmAngle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Pass 1: Unified outer silhouette border of exact thickness `sw`
  fillTangentCapsule(g, p0, r0 + sw, p1, r1 + sw, outlineCol);
  fillTangentCapsule(g, p1, r1 + sw, p2, r2 + sw, outlineCol);
  g.save();
  g.translate(p2[0], p2[1]);
  g.rotate(forearmAngle);
  traceHandSilhouette(g, handPose, s);
  g.fillStyle = outlineCol;
  g.fill();
  if (sw > 0.05) {
    g.strokeStyle = outlineCol;
    g.lineWidth = sw * 2;
    g.stroke();
  }
  g.restore();

  // Pass 2: Unified single-colour interior fill (seamless across elbow & wrist)
  fillTangentCapsule(g, p0, r0, p1, r1, fillCol);
  fillTangentCapsule(g, p1, r1, p2, r2, fillCol);
  g.save();
  g.translate(p2[0], p2[1]);
  g.rotate(forearmAngle);
  traceHandSilhouette(g, handPose, s);
  g.fillStyle = fillCol;
  g.fill();
  drawHandFingerSeparators(g, handPose, s, outlineCol);
  g.restore();

  // Subtle 2.5D cool-slate shadow along back edge of upper arm & forearm
  if (shadeSide !== 0) {
    g.save();
    traceTangentCapsule(g, p0, r0, p1, r1);
    g.clip();
    const gArm = g.createLinearGradient(p0[0] - r0 * 1.2, p0[1], p0[0] + r0 * 0.9, p0[1]);
    gArm.addColorStop(0, 'rgba(134, 158, 194, 0.26)');
    gArm.addColorStop(0.65, 'rgba(134, 158, 194, 0.04)');
    gArm.addColorStop(1, 'rgba(134, 158, 194, 0.00)');
    g.fillStyle = gArm;
    g.fillRect(Math.min(p0[0], p1[0]) - r0 * 2, Math.min(p0[1], p1[1]) - r0 * 2, Math.abs(p1[0] - p0[0]) + r0 * 4, Math.abs(p1[1] - p0[1]) + r0 * 4);
    g.restore();
  }

  // Interactive cyan screen bounce light along the active forearm when holding a lit phone
  if (screenGlow > 0.02) {
    g.save();
    traceTangentCapsule(g, p1, r1, p2, r2);
    g.clip();
    const glowA = clamp(screenGlow * 0.40, 0, 0.45);
    const fGlow = g.createLinearGradient(p2[0], p2[1] - r1 * 1.4, p1[0], p1[1] + r1 * 1.2);
    fGlow.addColorStop(0, `rgba(125, 211, 252, ${glowA.toFixed(3)})`);
    fGlow.addColorStop(0.65, `rgba(186, 230, 253, ${(glowA * 0.35).toFixed(3)})`);
    fGlow.addColorStop(1, 'rgba(186, 230, 253, 0.000)');
    g.fillStyle = fGlow;
    g.fillRect(Math.min(p1[0], p2[0]) - r1 * 2, Math.min(p1[1], p2[1]) - r1 * 2, Math.abs(p2[0] - p1[0]) + r1 * 4, Math.abs(p2[1] - p1[1]) + r1 * 4);
    g.restore();
  }

  // Subtle inner elbow crease when arm is noticeably bent
  const uAng = Math.atan2(p0[1] - p1[1], p0[0] - p1[0]);
  const bendDiff = Math.abs(Math.atan2(Math.sin(forearmAngle - uAng), Math.cos(forearmAngle - uAng)));
  if (bendDiff < Math.PI * 0.80) {
    const bis = Math.atan2(
      Math.sin(uAng) + Math.sin(forearmAngle),
      Math.cos(uAng) + Math.cos(forearmAngle)
    );
    g.strokeStyle = 'rgba(13, 18, 28, 0.45)';
    g.lineWidth = 1.35 * s;
    g.beginPath();
    g.moveTo(p1[0] + Math.cos(bis) * r1 * 0.25, p1[1] + Math.sin(bis) * r1 * 0.25);
    g.lineTo(p1[0] + Math.cos(bis) * r1 * 0.88, p1[1] + Math.sin(bis) * r1 * 0.88);
    g.stroke();
  }

  g.restore();
}

function traceSlipOnShoeUpper(g, s) {
  const heelX = -8.2 * s;
  const toeX = 22.8 * s;
  const soleBotY = 3.8 * s;
  g.beginPath();
  // Low-cut heel counter -> dipped ankle collar notch (revealing white ankle!) -> sleek loafer vamp -> rounded toe -> flat sole
  g.moveTo(heelX + 0.6 * s, -4.4 * s);
  g.quadraticCurveTo(-2.4 * s, -1.6 * s, 4.6 * s, -5.2 * s);
  g.quadraticCurveTo(13.4 * s, -4.6 * s, toeX - 1.2 * s, -1.8 * s);
  g.quadraticCurveTo(toeX + 2.6 * s, 0.6 * s, toeX + 0.4 * s, soleBotY);
  g.lineTo(heelX + 0.4 * s, soleBotY);
  g.quadraticCurveTo(heelX - 1.2 * s, -0.2 * s, heelX + 0.6 * s, -4.4 * s);
  g.closePath();
}

/**
 * Renders a complete seamless leg (`hip -> knee -> ankle -> sleek slip-on shoe with crisp white sole`):
 *  - Zero horizontal joint lines across thigh/knee/shin.
 *  - Subtle 2.5D cool-slate shadow along back of leg.
 *  - Grounded matte-black slip-on loafer with crisp white sole trim and visible white ankle opening.
 */
function drawSeamlessLeg(g, points, radii, fy, s, footAngle, colors) {
  const { outlineCol, sw, fillCol, footFillCol, barefoot = false } = colors;
  const [p0, p1, p2] = points;
  const [r0, r1, r2] = radii;
  const maxToeLen = 23.2 * s;
  const rawPitch = clamp(footAngle || 0, -0.55, 0.65);
  const sinkEstimate = Math.max(0, Math.sin(rawPitch) * maxToeLen);
  const liftGuard = (p2[1] + 2.8 * s + sinkEstimate > fy + 3.2 * s)
    ? (p2[1] + 2.8 * s + sinkEstimate) - (fy + 3.2 * s)
    : 0;
  const footCenter = [p2[0], p2[1] - liftGuard];
  // Tuck the lower shin capsule center inside the shoe collar so the ankle circle never pokes below the sole!
  const ankleTuck = barefoot ? p2 : [footCenter[0], footCenter[1] - 3.4 * s];
  const rAnkle = barefoot ? r2 : r2 * 0.88;

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Pass 1: Outer silhouette outline (`sw` border) for thigh + shin + ankle
  fillTangentCapsule(g, p0, r0 + sw, p1, r1 + sw, outlineCol);
  fillTangentCapsule(g, p1, r1 + sw, ankleTuck, rAnkle + sw, outlineCol);

  // Pass 2: Unified white interior fill across thigh, knee, shin, and ankle opening
  fillTangentCapsule(g, p0, r0, p1, r1, fillCol);
  fillTangentCapsule(g, p1, r1, ankleTuck, rAnkle, fillCol);

  // Subtle 2.5D cool-slate cylindrical shadow along left/back edge of leg (split cleanly at p1[1] so zero knee overlap circle forms!)
  const legLeftX = Math.min(p0[0], p1[0], ankleTuck[0]) - r0 * 1.1;
  const legRightX = Math.max(p0[0], p1[0], ankleTuck[0]) + r0 * 0.75;
  const legSh = g.createLinearGradient(legLeftX, p0[1], legRightX, p0[1]);
  legSh.addColorStop(0, 'rgba(134, 158, 194, 0.24)');
  legSh.addColorStop(0.62, 'rgba(134, 158, 194, 0.04)');
  legSh.addColorStop(1, 'rgba(134, 158, 194, 0.00)');

  g.save();
  g.beginPath();
  g.rect(legLeftX - r0 * 2, Math.min(p0[1], p1[1]) - r0 * 2, (legRightX - legLeftX) + r0 * 4, (p1[1] - Math.min(p0[1], p1[1])) + r0 * 2);
  g.clip();
  traceTangentCapsule(g, p0, r0, p1, r1);
  g.clip();
  g.fillStyle = legSh;
  g.fillRect(legLeftX - r0 * 2, p0[1] - r0 * 2, (legRightX - legLeftX) + r0 * 4, Math.abs(p1[1] - p0[1]) + r0 * 4);
  g.restore();

  g.save();
  g.beginPath();
  g.rect(legLeftX - r0 * 2, p1[1], (legRightX - legLeftX) + r0 * 4, Math.max(2, ankleTuck[1] - p1[1]) + r1 * 2);
  g.clip();
  traceTangentCapsule(g, p1, r1, ankleTuck, rAnkle);
  g.clip();
  g.fillStyle = legSh;
  g.fillRect(legLeftX - r0 * 2, p1[1] - r1, (legRightX - legLeftX) + r0 * 4, Math.abs(ankleTuck[1] - p1[1]) + r1 * 3);
  g.restore();

  // Pass 3: Grounded sleek slip-on shoe with crisp white sole trim (or unified foot when barefoot)
  g.save();
  g.translate(footCenter[0], footCenter[1]);
  g.rotate(rawPitch);

  // Delicate ankle malleolus contour tick right above the shoe collar
  g.strokeStyle = 'rgba(13, 18, 28, 0.38)';
  g.lineWidth = 1.2 * s;
  g.beginPath();
  g.arc(-1.2 * s, -4.4 * s, 2.2 * s, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();

  traceSlipOnShoeUpper(g, s);
  if (sw > 0.05) {
    g.strokeStyle = outlineCol;
    g.lineWidth = sw * 1.85;
    g.stroke();
  }
  g.fillStyle = barefoot ? fillCol : (footFillCol || CANONICAL_CHARACTER_SPEC.defaultShoeColor);
  g.fill();

  if (!barefoot) {
    // Crisp white vulcanized sole trim along the bottom of the black slip-on loafer
    g.save();
    traceSlipOnShoeUpper(g, s);
    g.clip();
    g.fillStyle = '#f4f7fb';
    g.fillRect(-10 * s, 1.35 * s, 35 * s, 2.8 * s);
    g.strokeStyle = outlineCol;
    g.lineWidth = 1.15 * s;
    g.beginPath();
    g.moveTo(-9 * s, 1.35 * s);
    g.lineTo(24 * s, 1.35 * s);
    g.stroke();
    // Subtle dark-slate sheen arc across the shoe vamp so black shoe reads cleanly on dark floors
    g.strokeStyle = 'rgba(148, 163, 184, 0.24)';
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.moveTo(5.2 * s, -3.6 * s);
    g.quadraticCurveTo(13.2 * s, -3.1 * s, 19.8 * s, -0.8 * s);
    g.stroke();
    g.restore();
  }
  g.restore();

  g.restore();
}

function computeTorsoRadii(s, build) {
  const spec = CANONICAL_CHARACTER_SPEC.radii;
  return {
    hipR: spec.torsoHip * s * build.torsoW,
    midR: spec.torsoMid * s * lerp(build.torsoW, build.shoulderW || build.torsoW, 0.52),
    shR: spec.torsoShoulder * s * (build.shoulderW || build.torsoW),
  };
}

function trace3QTorsoPath(g, geom) {
  const {
    sh, mid, shNear, shFar, hipL, hipR, legR0, armR0, neckBaseR, s,
  } = geom;
  const topShoulderY = sh[1] - 5.2 * s;
  const nearOuterX = shNear[0] - armR0 * 0.85;
  const farOuterX = shFar[0] + armR0 * 0.42;
  const waistY = lerp(sh[1], 0.5 * (hipL[1] + hipR[1]), 0.64);
  const waistNearX = lerp(nearOuterX + armR0 * 0.45, hipL[0] - legR0 * 0.96, 0.68) + (mid[0] - sh[0]) * 0.45;
  const waistFarX = lerp(farOuterX, hipR[0] + legR0 * 0.96, 0.68) + (mid[0] - sh[0]) * 0.45;
  const hipOuterLX = hipL[0] - legR0 * 0.98;
  const hipOuterRX = hipR[0] + legR0 * 0.98;
  const crotchX = 0.5 * (hipL[0] + hipR[0]) + 0.8 * s;
  const crotchY = Math.max(hipL[1], hipR[1]) + legR0 * 0.42;

  g.beginPath();
  // Start at left neck base -> slope smoothly across left trapezius right onto outer near deltoid cap
  g.moveTo(sh[0] - neckBaseR * 0.95, topShoulderY - 1.0 * s);
  g.quadraticCurveTo(lerp(sh[0], nearOuterX, 0.58), shNear[1] - armR0 * 0.98, nearOuterX, shNear[1] + 2.0 * s);
  // Left/near lat & tapered waist -> smooth flare to outer left hip socket
  g.bezierCurveTo(
    nearOuterX + armR0 * 0.35, lerp(shNear[1], waistY, 0.52),
    waistNearX, waistY - 8 * s,
    waistNearX, waistY
  );
  g.quadraticCurveTo(waistNearX - 0.4 * s, lerp(waistY, hipL[1], 0.55), hipOuterLX, hipL[1] + 4.0 * s);
  // Bridge across left thigh root -> single clean inverted-U pelvic crotch arch -> right thigh root
  g.lineTo(hipL[0] + legR0 * 0.88, hipL[1] + legR0 * 0.68);
  g.quadraticCurveTo(crotchX, crotchY - 3.0 * s, hipR[0] - legR0 * 0.88, hipR[1] + legR0 * 0.68);
  g.lineTo(hipOuterRX, hipR[1] + 3.8 * s);
  // Right/far hip -> right waist -> broad 3/4 chest contour -> far shoulder -> right trapezius -> right neck base
  g.quadraticCurveTo(waistFarX + 0.6 * s, lerp(waistY, hipR[1], 0.55), waistFarX, waistY);
  g.bezierCurveTo(
    waistFarX + 1.8 * s, lerp(shFar[1], waistY, 0.52),
    farOuterX + 2.2 * s, shFar[1] + 12 * s,
    farOuterX, shFar[1] + 1.8 * s
  );
  g.quadraticCurveTo(lerp(sh[0], farOuterX, 0.62), topShoulderY - 0.8 * s, sh[0] + neckBaseR * 0.95, topShoulderY - 1.0 * s);
  g.closePath();

  return { crotchX, crotchY, waistNearX, waistFarX, nearOuterX, farOuterX, hipOuterLX, hipOuterRX };
}

function drawSculpted3QTorsoAndPelvis(g, r, rig3Q, build, includeNeck, colors) {
  const { outlineCol, sw, fillCol, screenGlow = 0, legR0, armR0, weldLegs = true } = colors;
  const s = r.scale;
  const sh = r.shoulder;
  const mid = r.spineMid || [lerp(r.hip[0], sh[0], 0.54), lerp(r.hip[1], sh[1], 0.54)];
  const neckBaseR = CANONICAL_CHARACTER_SPEC.radii.neckBase * s * build.headW;
  const neckTopR = CANONICAL_CHARACTER_SPEC.radii.neckTop * s * build.headW;
  const neckEnd = [
    r.head[0] - Math.sin(r.headAngle) * r.radius * build.headW * 0.42,
    r.head[1] + Math.cos(r.headAngle) * r.radius * build.headW * 0.42,
  ];

  const geom = {
    sh,
    mid,
    shNear: rig3Q.shNear,
    shFar: rig3Q.shFar,
    hipL: rig3Q.visLL[0],
    hipR: rig3Q.visLR[0],
    legR0,
    armR0,
    neckBaseR,
    s,
  };

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Pass 1: Outer silhouette ink outline for 3/4 torso + neck
  if (includeNeck) {
    fillTangentCapsule(g, [sh[0], sh[1] + 2 * s], neckBaseR + sw, neckEnd, neckTopR + sw, outlineCol);
  }
  trace3QTorsoPath(g, geom);
  g.strokeStyle = outlineCol;
  g.lineWidth = sw * 2;
  g.stroke();
  g.fillStyle = outlineCol;
  g.fill();

  // Pass 2: Seamless single-colour interior fill bridging smoothly into neck & both thigh sockets
  const landmarks = trace3QTorsoPath(g, geom);
  g.fillStyle = fillCol;
  g.fill();
  if (includeNeck) {
    fillTangentCapsule(g, [sh[0], sh[1] + 3 * s], neckBaseR, neckEnd, neckTopR, fillCol);
    // Subtle shaded cast shadow directly beneath the chin/jawline on the front of the neck
    g.save();
    traceTangentCapsule(g, [sh[0], sh[1] + 3 * s], neckBaseR, neckEnd, neckTopR);
    g.clip();
    g.fillStyle = 'rgba(100, 122, 154, 0.28)';
    g.beginPath();
    g.ellipse(neckEnd[0] + 1.5 * s, neckEnd[1] + 4.5 * s, neckTopR * 1.25, 4.8 * s, 0.12, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Seamlessly erase any internal hip-capsule arc inside the pelvis so torso & legs form one continuous suit!
  if (weldLegs) {
    const [l0, l1] = rig3Q.visLL;
    const [r0, r1] = rig3Q.visLR;
    const lMid = [lerp(l0[0], l1[0], 0.44), lerp(l0[1], l1[1], 0.44)];
    const rMid = [lerp(r0[0], r1[0], 0.44), lerp(r0[1], r1[1], 0.44)];
    fillTangentCapsule(g, l0, legR0 - 0.1 * s, lMid, lerp(legR0, colors.legR1 || legR0, 0.44) - 0.1 * s, fillCol);
    fillTangentCapsule(g, r0, legR0 - 0.1 * s, rMid, lerp(legR0, colors.legR1 || legR0, 0.44) - 0.1 * s, fillCol);
  }

  // Clipped 2.5D cylindrical left-back shadow + interactive cyan screen bounce light on 3/4 chest
  g.save();
  trace3QTorsoPath(g, geom);
  g.clip();
  const bodySh = g.createLinearGradient(landmarks.nearOuterX, sh[1], landmarks.farOuterX, sh[1]);
  bodySh.addColorStop(0, 'rgba(134, 158, 194, 0.30)');
  bodySh.addColorStop(0.38, 'rgba(134, 158, 194, 0.08)');
  bodySh.addColorStop(1, 'rgba(134, 158, 194, 0.00)');
  g.fillStyle = bodySh;
  g.fillRect(landmarks.nearOuterX - 20 * s, sh[1] - 20 * s, (landmarks.farOuterX - landmarks.nearOuterX) + 40 * s, (landmarks.crotchY - sh[1]) + 45 * s);

  if (screenGlow > 0.02) {
    const glowA = clamp(screenGlow * 0.38, 0, 0.44);
    const chestGlow = g.createRadialGradient(
      landmarks.farOuterX - 4 * s,
      lerp(sh[1], landmarks.crotchY, 0.36),
      4 * s,
      landmarks.farOuterX - 10 * s,
      lerp(sh[1], landmarks.crotchY, 0.40),
      54 * s
    );
    chestGlow.addColorStop(0, `rgba(125, 211, 252, ${glowA.toFixed(3)})`);
    chestGlow.addColorStop(0.55, `rgba(186, 230, 253, ${(glowA * 0.38).toFixed(3)})`);
    chestGlow.addColorStop(1, 'rgba(186, 230, 253, 0.000)');
    g.fillStyle = chestGlow;
    g.fillRect(landmarks.nearOuterX - 10 * s, sh[1] - 10 * s, (landmarks.farOuterX - landmarks.nearOuterX) + 30 * s, (landmarks.crotchY - sh[1]) + 30 * s);
  }
  g.restore();

  g.restore();
}

function translateLimbChain(chain, dx, dy) {
  return [
    [chain[0][0] + dx, chain[0][1] + dy],
    [chain[1][0] + dx, chain[1][1] + dy],
    [chain[2][0] + dx, chain[2][1] + dy],
  ];
}

function compute3QVisualRig(r, x, fy, s, build, flip, turnScaleX) {
  const sh = r.shoulder;
  const hip = r.hip;
  const shW = build.shoulderW || build.torsoW || 1.0;
  const torsoW = build.torsoW || 1.0;

  // Broad 3/4 shoulder sockets: near (-X camera-side) & far (+X facing-side)
  const shNear = [sh[0] - 21.0 * s * shW, sh[1] + 3.2 * s];
  const shFar = [sh[0] + 19.5 * s * shW, sh[1] + 2.6 * s];

  const visAL = translateLimbChain(r.al, shNear[0] - r.al[0][0], shNear[1] - r.al[0][1]);
  const visAR = translateLimbChain(r.ar, shFar[0] - r.ar[0][0], shFar[1] - r.ar[0][1]);

  // 3/4 natural two-leg standing stance (C1-smooth continuous blend — ZERO binary frame snaps!):
  // Smoothly relaxes `stanceK` to `0` across wide walking/running strides (`strideSpread > 25*s..47*s`),
  // lifted swing/aerial feet (`liftPx > 1.5*s..10.5*s`), and seated/crouched hip heights (`hip[1] > fy - 109*s..91*s`),
  // so foot-plant contacts stay 0.000px exact during gait while standing/transitioning legs never jitter!
  const strideSpread = Math.abs(r.ll[2][0] - r.lr[2][0]);
  const crouchT = ease(clamp((hip[1] - (fy - 98 * s)) / (18 * s)));
  const liftPx = Math.max(Math.abs(fy - r.ll[2][1]), Math.abs(fy - r.lr[2][1]));
  const liftT = ease(clamp((liftPx - 1.5 * s) / (9.0 * s)));
  const spreadT = ease(clamp((strideSpread - 25 * s) / (22 * s)));
  const stanceK = (1 - crouchT) * (1 - liftT) * (1 - spreadT);

  const standHipL = [hip[0] - 13.2 * s * torsoW, hip[1] + 1.2 * s];
  const standAnkL = [x - 15.8 * s * torsoW, r.ll[2][1]];
  const standKneeL = [lerp(standHipL[0], standAnkL[0], 0.50) + 1.2 * s, lerp(standHipL[1], standAnkL[1], 0.51)];

  const standHipR = [hip[0] + 13.2 * s * torsoW, hip[1] + 0.6 * s];
  const standAnkR = [x + 19.2 * s * torsoW, r.lr[2][1]];
  const standKneeR = [lerp(standHipR[0], standAnkR[0], 0.50) + 1.8 * s, lerp(standHipR[1], standAnkR[1], 0.51)];

  const seatedShift = crouchT * 5.5 * s * torsoW;
  const visLL = [
    [lerp(r.ll[0][0] - seatedShift, standHipL[0], stanceK), lerp(r.ll[0][1], standHipL[1], stanceK)],
    [lerp(r.ll[1][0] - seatedShift, standKneeL[0], stanceK), lerp(r.ll[1][1], standKneeL[1], stanceK)],
    [lerp(r.ll[2][0] - seatedShift, standAnkL[0], stanceK), lerp(r.ll[2][1], standAnkL[1], stanceK)],
  ];
  const visLR = [
    [lerp(r.lr[0][0] + seatedShift, standHipR[0], stanceK), lerp(r.lr[0][1], standHipR[1], stanceK)],
    [lerp(r.lr[1][0] + seatedShift, standKneeR[0], stanceK), lerp(r.lr[1][1], standKneeR[1], stanceK)],
    [lerp(r.lr[2][0] + seatedShift, standAnkR[0], stanceK), lerp(r.lr[2][1], standAnkR[1], stanceK)],
  ];

  const fL = Math.atan2(visAL[2][1] - visAL[1][1], visAL[2][0] - visAL[1][0]);
  const fR = Math.atan2(visAR[2][1] - visAR[1][1], visAR[2][0] - visAR[1][0]);
  const visGripL = [visAL[2][0] + Math.cos(fL) * 6.5 * s, visAL[2][1] + Math.sin(fL) * 6.5 * s];
  const visGripR = [visAR[2][0] + Math.cos(fR) * 6.5 * s, visAR[2][1] + Math.sin(fR) * 6.5 * s];

  const signX = (flip ? -1 : 1) * turnScaleX;
  const toWorld = (pt) => [x + (pt[0] - x) * signX, pt[1]];

  return {
    shNear,
    shFar,
    stanceK: lerp(stanceK, 0.35, crouchT),
    visAL,
    visAR,
    visLL,
    visLR,
    visGripL,
    visGripR,
    world: {
      hl: toWorld(visAL[2]),
      hr: toWorld(visAR[2]),
      fl: toWorld(visLL[2]),
      fr: toWorld(visLR[2]),
      gripL: toWorld(visGripL),
      gripR: toWorld(visGripR),
      head: toWorld(r.head),
      sh: toWorld(r.shoulder),
      hip: toWorld(r.hip),
    },
  };
}

/**
 * Welds the near shoulder deltoid smoothly into the 3/4 chest while preserving the crisp
 * vertical inner-arm contour line where the hanging arm overlaps the ribcage.
 */
function weldNearShoulderIntoTorso(g, r, rig3Q, build, legR0, armR0, fillCol) {
  const s = r.scale;
  const sh = r.shoulder;
  const mid = r.spineMid || [lerp(r.hip[0], sh[0], 0.54), lerp(r.hip[1], sh[1], 0.54)];
  const neckBaseR = CANONICAL_CHARACTER_SPEC.radii.neckBase * s * build.headW;
  const geom = {
    sh,
    mid,
    shNear: rig3Q.shNear,
    shFar: rig3Q.shFar,
    hipL: rig3Q.visLL[0],
    hipR: rig3Q.visLR[0],
    legR0,
    armR0,
    neckBaseR,
    s,
  };
  const shNear = rig3Q.shNear;
  const elbowPt = rig3Q.visAL[1];
  const limbDir = Math.atan2(elbowPt[1] - shNear[1], elbowPt[0] - shNear[0]);

  g.save();
  // Clip strictly inside the 3/4 torso interior so outer shoulder ink outline is 100% preserved!
  trace3QTorsoPath(g, geom);
  g.clip();
  g.fillStyle = fillCol;
  g.beginPath();
  g.moveTo(shNear[0], shNear[1]);
  g.arc(shNear[0], shNear[1], armR0 * 1.35, limbDir - Math.PI * 0.98, limbDir - Math.PI * 0.22, false);
  g.closePath();
  g.fill();
  // Restore subtle left-edge 2.5D shading across the welded deltoid seam
  const shGrad = g.createLinearGradient(shNear[0] - armR0, sh[1], shNear[0] + armR0 * 1.4, sh[1]);
  shGrad.addColorStop(0, 'rgba(134, 158, 194, 0.24)');
  shGrad.addColorStop(1, 'rgba(134, 158, 194, 0.00)');
  g.fillStyle = shGrad;
  g.beginPath();
  g.arc(shNear[0], shNear[1], armR0 * 1.35, limbDir - Math.PI * 0.98, limbDir - Math.PI * 0.22, false);
  g.fill();
  g.restore();
}

function sScale(r0) {
  return Math.max(0.5, r0 / 8.2);
}

function drawFigure(g, x, fy, s, p0 = {}, flip = false, opts = {}) {
  const posed = applyPostureToPose(p0, opts.posture ?? 0, s);
  const r = skeleton(x, fy, s, posed, flip);
  const build = BUILDS[opts.build] || BUILDS.standard;
  const drawMode = opts.drawMode || 'full'; // 'full' | 'back_arm_only' | 'body_no_front_arm' | 'front_arm_only' | 'lower_and_torso' | 'upper_front'

  const sw = (opts.outlineWidth === 'thin'
    ? CANONICAL_CHARACTER_SPEC.thinStrokeWidthPx
    : CANONICAL_CHARACTER_SPEC.strokeWidthPx) * s;
  const mainRgb = hexToRgb(opts.color || CANONICAL_CHARACTER_SPEC.defaultBaseColor);
  const bodyFill = rgbCss(mainRgb);
  const footFill = opts.shoeColor
    ? rgbCss(hexToRgb(opts.shoeColor))
    : CANONICAL_CHARACTER_SPEC.defaultShoeColor;
  const barefoot = Boolean(opts.barefoot);
  const outlineCol = opts.outlineColor || CANONICAL_CHARACTER_SPEC.outlineColor;
  const rimRgb = mainRgb;
  const screenGlow = clamp(Number(opts.screenGlow || 0), 0, 1.2);
  const accList = normalizeAccessoryList(opts.accessories || opts.accessory);
  const hairStyle = resolveDefaultHairstyle(opts, accList);
  const hairRgb = resolveHairRgb(opts, mainRgb);

  const specR = CANONICAL_CHARACTER_SPEC.radii;
  const armRadii = [
    specR.upperArmTop * s * build.limbW,
    specR.elbow * s * build.limbW,
    specR.wrist * s * build.limbW,
  ];
  const legRadii = [
    specR.thighTop * s * build.limbW,
    specR.knee * s * build.limbW,
    specR.ankle * s * build.limbW,
  ];

  const turnScaleX = Number.isFinite(opts.turnScaleX) ? clamp(opts.turnScaleX, 0.25, 1.0) : 1.0;
  const rig3Q = compute3QVisualRig(r, x, fy, s, build, flip, turnScaleX);

  g.save();
  if (flip || turnScaleX !== 1.0) {
    g.translate(x, 0);
    g.scale((flip ? -1 : 1) * turnScaleX, 1);
    g.translate(-x, 0);
  }

  const drawShadowAndBack = drawMode === 'full' || drawMode === 'back_arm_only' || drawMode === 'body_no_front_arm' || drawMode === 'lower_and_torso';
  const drawLegsAndTorso = drawMode === 'full' || drawMode === 'body_no_front_arm' || drawMode === 'lower_and_torso';
  const drawHeadLayer = drawMode === 'full' || drawMode === 'body_no_front_arm' || drawMode === 'upper_front';
  const drawFrontArmLayer = drawMode === 'full' || drawMode === 'front_arm_only' || drawMode === 'upper_front';

  // 1. Grounded soft elliptical floor contact shadow + subtle individual shoe contact shadows
  if (drawMode === 'full' || drawMode === 'body_no_front_arm' || drawMode === 'lower_and_torso') {
    const shadowFootX = 0.5 * (rig3Q.visLL[2][0] + rig3Q.visLR[2][0]) + 4 * s;
    const lowestFootY = Math.max(rig3Q.visLL[2][1], rig3Q.visLR[2][1]);
    const airHeight = Math.max(0, fy - lowestFootY);
    const airFactor = clamp(1 - airHeight / (135 * s), 0.22, 1.0);
    g.save();
    const shGrad = g.createRadialGradient(shadowFootX, fy + 3 * s, 4 * s, shadowFootX, fy + 3 * s, 54 * s * build.torsoW * airFactor);
    shGrad.addColorStop(0, `rgba(0, 0, 0, ${(0.56 * airFactor).toFixed(3)})`);
    shGrad.addColorStop(0.65, `rgba(0, 0, 0, ${(0.28 * airFactor).toFixed(3)})`);
    shGrad.addColorStop(1, 'rgba(0, 0, 0, 0.000)');
    g.fillStyle = shGrad;
    g.beginPath();
    g.ellipse(shadowFootX, fy + 3 * s, 54 * s * build.torsoW * airFactor, 9.5 * s * airFactor, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // 2. Far/facing-side arm (`visAR` from `shFar`) + optional held prop overlay (e.g. one-handed 3/4 smartphone!)
  if (drawShadowAndBack) {
    drawSeamlessArm(g, rig3Q.visAR, armRadii, posed.handR || 'relaxed', s, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      screenGlow: typeof opts.farHandOverlay === 'function' ? screenGlow : screenGlow * 0.35,
      shadeSide: 0,
    });
    if (typeof opts.farHandOverlay === 'function') {
      const farForearmAngle = Math.atan2(rig3Q.visAR[2][1] - rig3Q.visAR[1][1], rig3Q.visAR[2][0] - rig3Q.visAR[1][0]);
      opts.farHandOverlay(g, {
        elbow: rig3Q.visAR[1],
        wrist: rig3Q.visAR[2],
        grip: rig3Q.visGripR,
        forearmAngle: farForearmAngle,
        scale: s,
        bodyFill,
        outlineCol,
        sw,
        thumbScroll: posed.thumbScroll || 0,
        thumbTap: posed.thumbTap || 0,
      });
    }
  }

  if (drawMode === 'back_arm_only') {
    g.restore();
    return rig3Q.world;
  }

  // 3. Back accessories, far leg, sculpted 3/4 torso + pelvis + crotch arch, and near leg
  if (drawLegsAndTorso) {
    if (accList.includes('cape')) {
      drawBackCape(g, r, mainRgb);
    }
    if (accList.includes('backpack')) {
      drawBackBackpack(g, r, opts.bagColor || '#eab308');
    }

    drawSeamlessLeg(g, rig3Q.visLR, legRadii, fy, s, posed.footAngleR || 0, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      footFillCol: footFill,
      barefoot,
    });

    drawSeamlessLeg(g, rig3Q.visLL, legRadii, fy, s, posed.footAngleL || 0, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      footFillCol: footFill,
      barefoot,
    });

    drawSculpted3QTorsoAndPelvis(g, r, rig3Q, build, drawHeadLayer, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      screenGlow,
      legR0: legRadii[0],
      legR1: legRadii[1],
      armR0: armRadii[0],
      weldLegs: !accList.includes('coat'),
    });

    if (accList.includes('coat')) {
      drawTorsoCoat(g, r, build, opts.coatColor || '#1e293b');
    }
  } else if (drawHeadLayer) {
    // In `upper_front` split-furniture mode, `lower_and_torso` already drew the torso behind the desk front;
    // draw only the neck bridge here so the lower pelvis never paints in front of the desk apron!
    const sh = r.shoulder;
    const neckBaseR = CANONICAL_CHARACTER_SPEC.radii.neckBase * s * build.headW;
    const neckTopR = CANONICAL_CHARACTER_SPEC.radii.neckTop * s * build.headW;
    const neckEnd = [
      r.head[0] - Math.sin(r.headAngle) * r.radius * build.headW * 0.42,
      r.head[1] + Math.cos(r.headAngle) * r.radius * build.headW * 0.42,
    ];
    fillTangentCapsule(g, [sh[0], sh[1] + 2 * s], neckBaseR + sw, neckEnd, neckTopR + sw, outlineCol);
    fillTangentCapsule(g, [sh[0], sh[1] + 4 * s], neckBaseR, neckEnd, neckTopR, bodyFill);
  }

  // 4. Sculpted 3/4 Head + Ear + Expressive Face + Layered Hair & Head Accessories
  const hd = r.head;
  const hr = r.radius * build.headW;
  if (drawHeadLayer) {
    drawHairBack(g, hd, hr, r.headAngle, s, hairStyle, hairRgb, outlineCol);

    drawSculpted3QHead(g, hd, hr, r.headAngle, s, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      screenGlow,
    });

    if (!opts.hideFace) {
      drawFaceExpression(g, hd, hr, s, opts.expression || 'neutral', {
        ...(opts.faceAnim || {}),
        headAngle: r.headAngle,
      });
    }

    if (!accList.includes('helmet') && !accList.includes('hat') && !accList.includes('cap')) {
      drawHairFront(g, hd, hr, r.headAngle, s, hairStyle, hairRgb, rimRgb, outlineCol, screenGlow);
    }

    for (const acc of accList) {
      if (acc !== 'cape' && acc !== 'coat' && acc !== 'backpack' && acc !== 'watch') {
        drawSingleAccessory(g, r, acc, mainRgb, rimRgb, opts);
      }
    }
  }

  // 5. Near/camera-side arm (`visAL` from `shNear`) + shoulder deltoid weld + optional front hand overlay
  if (drawFrontArmLayer) {
    drawSeamlessArm(g, rig3Q.visAL, armRadii, posed.handL || 'relaxed', s, {
      outlineCol,
      sw,
      fillCol: bodyFill,
      screenGlow: typeof opts.frontHandOverlay === 'function' ? screenGlow : 0,
      shadeSide: -1,
    });
    if ((drawLegsAndTorso || drawHeadLayer) && !accList.includes('coat')) {
      weldNearShoulderIntoTorso(g, r, rig3Q, build, legRadii[0], armRadii[0], bodyFill);
    }
    if (accList.includes('watch')) {
      drawSingleAccessory(g, { ...r, al: rig3Q.visAL }, 'watch', mainRgb, rimRgb, opts);
    }
    if (typeof opts.frontHandOverlay === 'function') {
      const forearmAngle = Math.atan2(rig3Q.visAL[2][1] - rig3Q.visAL[1][1], rig3Q.visAL[2][0] - rig3Q.visAL[1][0]);
      opts.frontHandOverlay(g, {
        elbow: rig3Q.visAL[1],
        wrist: rig3Q.visAL[2],
        grip: rig3Q.visGripL,
        forearmAngle,
        scale: s,
        bodyFill,
        outlineCol,
        sw,
        thumbScroll: posed.thumbScroll || 0,
        thumbTap: posed.thumbTap || 0,
      });
    }
  }

  g.restore();

  if (opts.nameTag && (drawMode === 'full' || drawMode === 'upper_front' || drawMode === 'body_no_front_arm')) {
    const wh = rig3Q.world.head;
    const extraLift = accList.includes('crown') || accList.includes('hat') || accList.includes('halo') ? 18 * s : 6 * s;
    let tagY = wh[1] - hr - 24 * s - extraLift;
    for (const wHand of [rig3Q.world.hl, rig3Q.world.hr]) {
      if (wHand && Math.abs(wHand[0] - wh[0]) < 62 * s && wHand[1] < wh[1]) {
        tagY = Math.min(tagY, wHand[1] - 44 * s);
      }
    }
    g.save();
    g.globalAlpha = clamp(opts.nameTagAlpha ?? 0.92);
    g.font = `bold ${Math.round(16 * Math.max(0.85, s))}px PopB`;
    const txt = String(opts.nameTag).toUpperCase();
    const tw = g.measureText(txt).width + 20;
    g.fillStyle = 'rgba(8,12,22,0.860)';
    g.strokeStyle = bodyFill;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(wh[0] - tw * 0.5, tagY - 14, tw, 28, 8);
    g.fill();
    g.stroke();
    g.fillStyle = bodyFill;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(txt, wh[0], tagY);
    g.restore();
  }

  return rig3Q.world;
}

module.exports = {
  BONES,
  CANONICAL_CHARACTER_SPEC,
  BUILDS,
  SUPPORTED_ACCESSORIES,
  SUPPORTED_HAIRSTYLES,
  DEF,
  NAMED_COLORS,
  PALETTES: NAMED_COLORS,
  P,
  clamp,
  lerp,
  ease,
  springEase,
  backEase,
  backOut,
  anticipationEase,
  arcPoint,
  eio,
  eo,
  ca,
  angle,
  lerpPose,
  applyPostureToPose,
  fk,
  solveIK,
  blendLimb,
  skeleton,
  walkMotion,
  runMotion,
  hexToRgb,
  mixRgb,
  rgbCss,
  traceTangentCapsule,
  drawFigure,
};
