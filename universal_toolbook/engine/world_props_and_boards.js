'use strict';

const { clamp, lerp, ease, eo, ca, hexToRgb, traceTangentCapsule } = require('./character_rig');
const { drawSoftGlow } = require('./environments');
// Harbor-beacon prop extension (lighthouse, lamp mechanism, boats, fog, oil flask, workbench).
// Drawn in its own module so this file keeps one dispatch line; see engine/beacon_harbor.js.
const { BEACON_PROPS, drawBeaconProp } = require('./beacon_harbor');
// Wall-fable set: ghost wall, impact/ripple FX, chalk door, crates, big captions.
const { WALL_PROPS, drawWallProp } = require('./impossible_wall');
// Bamboo set: the ground cutaway, its sun, labels and stalks.
const { BAMBOO_PROPS, drawBambooProp } = require('./bamboo_grove');
const WALL_PROP_SET = new Set(WALL_PROPS);
const BEACON_PROP_SET = new Set(BEACON_PROPS);
const BAMBOO_PROP_SET = new Set(BAMBOO_PROPS);

const K = (t, a, b) => (b <= a ? 1 : clamp((t - a) / (b - a)));

const SUPPORTED_PROPS = Object.freeze([
  'desk',
  'chair',
  'table',
  'phone',
  'laptop',
  'computer',
  'sofa',
  'window',
  'cup',
  'podium',
  'bench',
  'door',
  'boulder',
  'stairs',
  'signpost',
  'clock',
  'digital_clock',
  'pocket_watch',
  'streetlamp',
  'bed',
  'cafe_table',
  'ankle_chain',
  'goal_silhouette',
  'goal_orb',
  'pedestal',
  'book',
  'books',
  'umbrella_stand',
  'water_trail',
  'bus_shelter',
  'passing_bus',
  'passing_car',
  'headlights',
  'photo_table',
  'clean_desk',
  'messy_desk',
  'wall_calendar',
  'framed_certificate',
  'judge_table',
  'curtain_window',
  'park_tree',
  ...BEACON_PROPS,
  ...WALL_PROPS,
  ...BAMBOO_PROPS,
]);

/**
 * Canonical Asset Library — authoritative dimensions, restrained dark-studio palette,
 * pivots, layering rules, and interaction anchor definitions for reusable world props & furniture.
 */
const CANONICAL_ASSET_LIBRARY = Object.freeze({
  phone: Object.freeze({
    width: 15,
    height: 30,
    flatWidth: 28,
    flatHeight: 6.5,
    pivot: 'grip_center',
    layering: 'attachable_hand_or_surface',
    palette: { chassis: '#0f172a', bezel: '#94a3b8', screenOff: '#1e293b', screenOn: '#38bdf8', outline: '#05070c' },
  }),
  laptop: Object.freeze({
    width: 62,
    height: 44,
    pivot: 'surface_bottom',
    layering: 'surface_prop',
    palette: { body: '#334155', bezel: '#cbd5e1', screen: '#38bdf8', outline: '#05070c' },
  }),
  computer: Object.freeze({
    width: 78,
    height: 68,
    pivot: 'surface_bottom',
    layering: 'surface_prop',
    palette: { stand: '#334155', bezel: '#cbd5e1', screen: '#38bdf8', outline: '#05070c' },
  }),
  desk: Object.freeze({
    width: 276,
    height: 142,
    chairSeatHeight: 92,
    pivot: 'floor_center',
    layering: 'split_chair_back_apron_front',
    palette: { frame: '#1e293b', top: '#475569', chair: '#1e293b', outline: '#05070c' },
  }),
  chair: Object.freeze({
    width: 82,
    height: 196,
    seatHeight: 92,
    pivot: 'floor_center',
    layering: 'split_back_and_seat',
    palette: { frame: '#1e293b', cushion: '#334155', outline: '#05070c' },
  }),
  table: Object.freeze({
    width: 260,
    height: 148,
    pivot: 'floor_center',
    layering: 'surface_furniture',
    palette: { legs: '#1e293b', top: '#475569', trim: '#64748b', outline: '#05070c' },
  }),
  sofa: Object.freeze({
    width: 264,
    height: 148,
    seatHeight: 82,
    pivot: 'floor_center',
    layering: 'split_back_and_seat',
    palette: { base: '#1e293b', cushion: '#334155', arm: '#263449', outline: '#05070c' },
  }),
  bed: Object.freeze({
    width: 310,
    height: 92,
    pivot: 'floor_center',
    layering: 'background_furniture',
    palette: { frame: '#1e293b', mattress: '#334155', blanket: '#475569', outline: '#05070c' },
  }),
  door: Object.freeze({
    width: 184,
    height: 468,
    handleHeight: 214,
    pivot: 'hinge_edge',
    layering: 'architectural',
    palette: { frame: '#475569', leaf: '#1e293b', panel: '#263449', handle: '#cbd5e1', outline: '#05070c' },
  }),
  window: Object.freeze({
    width: 160,
    height: 190,
    elevation: 165,
    pivot: 'wall_center',
    layering: 'architectural_back',
    palette: { frame: '#334155', glass: '#0c121d', mullion: '#475569', outline: '#05070c' },
  }),
  book: Object.freeze({
    width: 84,
    height: 72,
    pivot: 'surface_or_floor',
    layering: 'surface_prop',
    palette: { spines: ['#334155', '#475569', '#64748b', '#1e293b', '#94a3b8'], outline: '#05070c' },
  }),
  books: Object.freeze({
    width: 84,
    height: 72,
    pivot: 'surface_or_floor',
    layering: 'surface_prop',
    palette: { spines: ['#334155', '#475569', '#64748b', '#1e293b', '#94a3b8'], outline: '#05070c' },
  }),
  cup: Object.freeze({
    width: 18,
    height: 20,
    pivot: 'surface_bottom',
    layering: 'attachable_hand_or_surface',
    palette: { body: '#cbd5e1', rim: '#f1f5f9', outline: '#05070c' },
  }),
});

/**
 * Computes exact world-space coordinates, bounding box, surface planes, seat heights,
 * and grip/contact anchors for any scene prop so character IK/FK interactions always target
 * the real prop coordinates rather than hardcoded guesses.
 */
function computePropAnchors(prop, W = 1920, floorY = 855) {
  if (!prop || !prop.type) return null;
  const px = (prop.x ?? 0.5) * W;
  const s = prop.scale ?? 1.0;
  const faceLeft = prop.facing === 'left';
  const baseY = floorY - Number(prop.elevation || 0);

  if (prop.type === 'desk' || prop.type === 'clean_desk' || prop.type === 'messy_desk') {
    const dw = 276 * s;
    const dh = 142 * s;
    const surfaceTopY = floorY - dh - 14 * s;
    const chOff = (prop.chair_offset ?? 102) * s;
    const seatX = px + (faceLeft ? chOff : -chOff);
    const seatTopY = floorY - 92 * s;
    const laptopX = px + (faceLeft ? -34 * s : 34 * s);
    const kbHomeX = laptopX + (faceLeft ? 16 * s : -16 * s);
    return {
      type: prop.type,
      id: prop.id || null,
      centerX: px,
      scale: s,
      surfaceTopY,
      tabletopLeft: px - dw * 0.5,
      tabletopRight: px + dw * 0.5,
      seatX,
      seatTopY,
      keyboardContact: [kbHomeX, surfaceTopY - 3 * s],
      propSlotNear: [px + (faceLeft ? 42 * s : -42 * s), surfaceTopY],
      propSlotFar: [px + (faceLeft ? -78 * s : 78 * s), surfaceTopY],
      bounds: { left: Math.min(px - dw * 0.5, seatX - 42 * s), top: surfaceTopY - 68 * s, right: Math.max(px + dw * 0.5, seatX + 42 * s), bottom: floorY },
    };
  }
  if (prop.type === 'chair') {
    const cw = 82 * s;
    const seatTopY = floorY - 92 * s;
    return {
      type: 'chair',
      id: prop.id || null,
      centerX: px,
      scale: s,
      seatX: px,
      seatTopY,
      backrestX: px + (faceLeft ? 34 * s : -34 * s),
      bounds: { left: px - cw * 0.56, top: floorY - 196 * s, right: px + cw * 0.56, bottom: floorY },
    };
  }
  if (prop.type === 'sofa' || prop.type === 'bench') {
    const sw = (prop.type === 'sofa' ? 264 : 240) * s;
    const seatTopY = floorY - (prop.type === 'sofa' ? 82 : 84) * s;
    return {
      type: prop.type,
      id: prop.id || null,
      centerX: px,
      scale: s,
      seatX: px,
      seatTopY,
      bounds: { left: px - sw * 0.5, top: floorY - 148 * s, right: px + sw * 0.5, bottom: floorY },
    };
  }
  if (prop.type === 'table' || prop.type === 'cafe_table' || prop.type === 'photo_table' || prop.type === 'judge_table') {
    const tw = (prop.type === 'table' ? 260 : 250) * s;
    const th = (prop.type === 'table' ? 148 : 146) * s;
    const surfaceTopY = floorY - th;
    return {
      type: prop.type,
      id: prop.id || null,
      centerX: px,
      scale: s,
      surfaceTopY,
      tabletopLeft: px - tw * 0.5,
      tabletopRight: px + tw * 0.5,
      propSlotLeft: [px - tw * 0.28, surfaceTopY],
      propSlotCenter: [px, surfaceTopY],
      propSlotRight: [px + tw * 0.28, surfaceTopY],
      gripAnchor: [px, surfaceTopY - 4 * s],
      bounds: { left: px - tw * 0.5, top: surfaceTopY - 20 * s, right: px + tw * 0.5, bottom: floorY },
    };
  }
  if (prop.type === 'phone') {
    const flat = prop.orientation !== 'upright';
    const pw = (flat ? 28 : 15) * s;
    const ph = (flat ? 7 : 30) * s;
    return {
      type: 'phone',
      id: prop.id || null,
      centerX: px,
      scale: s,
      surfaceY: baseY,
      gripAnchor: [px, baseY - ph * 0.55],
      screenCenter: [px, baseY - ph * 0.5],
      bounds: { left: px - pw * 0.6, top: baseY - ph - 4 * s, right: px + pw * 0.6, bottom: baseY + 2 * s },
    };
  }
  if (prop.type === 'laptop' || prop.type === 'computer') {
    const lw = (prop.type === 'computer' ? 78 : 62) * s;
    const lh = (prop.type === 'computer' ? 68 : 44) * s;
    const kbX = px + (faceLeft ? 12 * s : -12 * s);
    return {
      type: prop.type,
      id: prop.id || null,
      centerX: px,
      scale: s,
      surfaceTopY: baseY,
      keyboardContact: [kbX, baseY - 5 * s],
      screenCenter: [px + (faceLeft ? -14 * s : 14 * s), baseY - lh * 0.6],
      bounds: { left: px - lw * 0.55, top: baseY - lh, right: px + lw * 0.55, bottom: baseY },
    };
  }
  if (prop.type === 'cup') {
    const cw = 18 * s;
    const ch = 20 * s;
    return {
      type: 'cup',
      id: prop.id || null,
      centerX: px,
      scale: s,
      surfaceY: baseY,
      gripAnchor: [px, baseY - ch * 0.55],
      bounds: { left: px - cw * 0.65, top: baseY - ch, right: px + cw * 0.65, bottom: baseY },
    };
  }
  if (prop.type === 'door') {
    const dw = 184 * s;
    const dh = 468 * s;
    const open = clamp(prop.open ?? 0.0);
    const hingeLeft = prop.hinge !== 'right';
    const hingeX = hingeLeft ? px - dw * 0.5 + 6 * s : px + dw * 0.5 - 6 * s;
    const leafSpan = (dw - 12 * s) * clamp(1 - open * 0.72, 0.20, 1.0);
    const handleX = hingeLeft ? hingeX + leafSpan * 0.82 : hingeX - leafSpan * 0.82;
    const handleY = floorY - 214 * s;
    return {
      type: 'door',
      id: prop.id || null,
      centerX: px,
      scale: s,
      open,
      hingeX,
      handleGrip: [handleX, handleY],
      gripAnchor: [handleX, handleY],
      bounds: { left: px - dw * 0.52, top: floorY - dh, right: px + dw * 0.52, bottom: floorY },
    };
  }
  if (prop.type === 'bed') {
    const bw = 280 * s;
    const bh = 66 * s;
    return {
      type: 'bed',
      id: prop.id || null,
      centerX: px,
      scale: s,
      seatX: px,
      seatTopY: floorY - bh,
      bounds: { left: px - bw * 0.5, top: floorY - bh - 48 * s, right: px + bw * 0.5, bottom: floorY },
    };
  }
  return {
    type: prop.type,
    id: prop.id || null,
    centerX: px,
    scale: s,
    gripAnchor: [px, baseY - 36 * s],
    bounds: { left: px - 60 * s, top: baseY - 120 * s, right: px + 60 * s, bottom: baseY },
  };
}

/**
 * Split-layer canonical phone renderer inside the gripping hand:
 *  1. Drawn AFTER the front arm + back palm,
 *  2. Draws canonical phone body + live scrolling/typing UI screen,
 *  3. Draws wrapping single-colour fingertips on far bezel + articulated swiping/tapping thumb on top!
 */
function drawHeldPhoneInHand(g, handInfo, phoneOpts = {}) {
  const { wrist, forearmAngle, scale: s, bodyFill, outlineCol, sw, thumbScroll = 0, thumbTap = 0 } = handInfo;
  const pw = 13.5 * s;
  const ph = 33.5 * s;
  const palmX = wrist[0] + Math.cos(forearmAngle) * 7.8 * s;
  const palmY = wrist[1] + Math.sin(forearmAngle) * 7.8 * s;
  const phoneTilt = phoneOpts.tilt ?? -0.58; // Sleek ~33° 3/4 tilt angled back toward the character's eyes
  const isLit = phoneOpts.lit !== false;
  const scrollPhase = Number(phoneOpts.scrollPhase || 0);

  g.save();
  g.translate(palmX, palmY);
  g.rotate(phoneTilt);

  const px0 = -pw * 0.42;
  const py0 = -ph * 0.78;

  // 1. Volumetric upward cyan-blue screen light cone radiating toward face & upper chest
  if (isLit) {
    g.save();
    // Soft atmospheric screen bloom in the air between phone & face
    const bloom = g.createRadialGradient(px0 - 10 * s, py0 - 12 * s, 2 * s, px0 - 26 * s, py0 - 36 * s, 68 * s);
    bloom.addColorStop(0, 'rgba(125, 211, 252, 0.36)');
    bloom.addColorStop(0.45, 'rgba(56, 189, 248, 0.15)');
    bloom.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
    g.fillStyle = bloom;
    g.beginPath();
    g.arc(px0 - 24 * s, py0 - 32 * s, 68 * s, 0, Math.PI * 2);
    g.fill();

    // Upward-angled volumetric light cone from lit glass toward face (contained in front of torso, never leaking behind spine!)
    const beamGrad = g.createLinearGradient(px0 + 1 * s, py0 + ph * 0.45, px0 - 54 * s, py0 - 78 * s);
    beamGrad.addColorStop(0, 'rgba(186, 230, 253, 0.44)');
    beamGrad.addColorStop(0.32, 'rgba(56, 189, 248, 0.22)');
    beamGrad.addColorStop(0.72, 'rgba(56, 189, 248, 0.06)');
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.00)');
    g.fillStyle = beamGrad;
    g.beginPath();
    g.moveTo(px0 + 1.5 * s, py0 + 2.5 * s);
    g.lineTo(px0 - 34 * s, py0 - 86 * s);
    g.lineTo(px0 - 68 * s, py0 - 18 * s);
    g.lineTo(px0 + 1.5 * s, py0 + ph - 2.5 * s);
    g.closePath();
    g.fill();
    g.restore();
  }

  // 2. 3/4 Smartphone metallic side rail + dark glass chassis
  g.fillStyle = '#0d1422';
  g.strokeStyle = outlineCol;
  g.lineWidth = Math.max(1.7 * s, sw * 0.80);
  g.beginPath();
  g.roundRect(px0, py0, pw, ph, 3.4 * s);
  g.fill();
  g.stroke();

  // Brushed slate-blue metallic side edge + subtle rear camera module pill
  g.fillStyle = '#334155';
  g.beginPath();
  g.roundRect(px0 + pw - 3.6 * s, py0 + 1.2 * s, 2.8 * s, ph - 2.4 * s, 1.4 * s);
  g.fill();
  g.fillStyle = '#1e293b';
  g.strokeStyle = '#64748b';
  g.lineWidth = 0.9 * s;
  g.beginPath();
  g.roundRect(px0 + pw * 0.36, py0 + 3.0 * s, 3.6 * s, 7.2 * s, 1.4 * s);
  g.fill();
  g.stroke();

  // Glowing cyan screen face visible along the angled front (-X) edge
  const sx0 = px0 + 1.1 * s;
  const sy0 = py0 + 2.2 * s;
  const sw2 = pw * 0.42;
  const sh2 = ph - 4.4 * s;
  g.save();
  g.beginPath();
  g.roundRect(sx0, sy0, sw2, sh2, 1.5 * s);
  g.fillStyle = isLit ? '#38bdf8' : '#1e293b';
  g.fill();
  g.clip();
  if (isLit) {
    const feedShift = ((scrollPhase * 9.0 * s) % (7.8 * s) + 7.8 * s) % (7.8 * s);
    for (let row = -1; row < 5; row++) {
      const cy = sy0 + 2.0 * s + row * 7.8 * s - feedShift;
      g.fillStyle = row % 2 === 0 ? 'rgba(240, 249, 255, 0.92)' : 'rgba(125, 211, 252, 0.78)';
      g.fillRect(sx0 + 0.6 * s, cy, sw2 - 1.2 * s, 4.4 * s);
    }
  }
  g.restore();

  // Bright specular cyan edge line right along the lit glass border
  if (isLit) {
    g.strokeStyle = '#e0f2fe';
    g.lineWidth = 1.35 * s;
    g.beginPath();
    g.moveTo(px0 + 1.2 * s, py0 + 3.2 * s);
    g.lineTo(px0 + 1.2 * s, py0 + ph - 3.2 * s);
    g.stroke();
  }

  // 3. Four sculpted wrapping fingers curling cleanly around the far (+X) edge of the phone
  const fingerR = 2.05 * s;
  const fingerSw = sw * 0.74;
  for (const fyFrac of [0.30, 0.44, 0.58, 0.72]) {
    const fyPos = py0 + ph * fyFrac;
    const fxA = [px0 + pw - 2.2 * s, fyPos + 0.6 * s];
    const fxB = [px0 + pw + 1.9 * s, fyPos - 0.5 * s];
    g.fillStyle = outlineCol;
    traceTangentCapsule(g, fxA, fingerR + fingerSw, fxB, fingerR * 0.92 + fingerSw);
    g.fill();
    g.fillStyle = bodyFill;
    traceTangentCapsule(g, fxA, fingerR, fxB, fingerR * 0.92);
    g.fill();
  }

  // 4. Articulated thumb cradling & swiping the near bezel
  const thumbBase = [px0 - 1.6 * s, py0 + ph * 0.80];
  const scrollDy = -clamp(thumbScroll, -1, 1) * 5.8 * s;
  const tapDx = clamp(thumbTap, -1, 1) * 2.0 * s;
  const thumbTip = [px0 + pw * 0.36 + tapDx, py0 + ph * 0.54 + scrollDy];
  const thR0 = 2.9 * s;
  const thR1 = 2.2 * s;
  const thSw = sw * 0.78;

  g.fillStyle = outlineCol;
  traceTangentCapsule(g, thumbBase, thR0 + thSw, thumbTip, thR1 + thSw);
  g.fill();
  g.fillStyle = bodyFill;
  traceTangentCapsule(g, thumbBase, thR0, thumbTip, thR1);
  g.fill();

  g.restore();
}

function drawHeldCupInHand(g, handInfo) {
  const { wrist, forearmAngle, scale: s, bodyFill, outlineCol, sw } = handInfo;
  const cx = wrist[0] + Math.cos(forearmAngle) * 7.5 * s;
  const cy = wrist[1] + Math.sin(forearmAngle) * 7.5 * s;
  const cw = 17 * s;
  const ch = 19 * s;
  g.save();
  g.translate(cx, cy);
  g.fillStyle = '#cbd5e1';
  g.strokeStyle = outlineCol;
  g.lineWidth = Math.max(1.8 * s, sw * 0.82);
  g.beginPath();
  g.roundRect(-cw * 0.45, -ch * 0.72, cw, ch, [2 * s, 2 * s, 4 * s, 4 * s]);
  g.fill();
  g.stroke();
  // Thumb/finger grip wrap in front
  const thA = [-cw * 0.35, -ch * 0.25];
  const thB = [cw * 0.22, -ch * 0.25];
  g.fillStyle = outlineCol;
  traceTangentCapsule(g, thA, 2.8 * s + sw * 0.78, thB, 2.4 * s + sw * 0.78);
  g.fill();
  g.fillStyle = bodyFill;
  traceTangentCapsule(g, thA, 2.8 * s, thB, 2.4 * s);
  g.fill();
  g.restore();
}

const SUPPORTED_BOARDS = Object.freeze([
  'line_graph',
  'flow_chain',
  'bar_chart',
  'cycle_loop',
  'iceberg',
  'checklist_card',
  'notebook_page',
  'sketch_card',
  'child_drawing',
  'phone_card',
  'obsessive_rule_card',
  'photo_back_card',
  'stat_cards',
]);

function drawWorldProp(g, prop, W, floorY, t, sceneAccent = '#38bdf8', sceneT = null, propPass = 'full', propOpts = {}) {
  if (!prop || !prop.type || prop._attachedToActor) return;
  const ts = sceneT !== null ? sceneT : t;
  const px = (prop.x ?? 0.5) * W;
  const s = prop.scale ?? 1.0;
  const baseY = floorY - Number(prop.elevation || 0);
  const accent = prop.color || sceneAccent;

  // Harbor-beacon set: single-pass ink props, dispatched to engine/beacon_harbor.js
  if (BEACON_PROP_SET.has(prop.type)) {
    if (propPass === 'front_only') return;
    drawBeaconProp(g, prop, W, floorY, t, ts, s);
    return;
  }

  // Bamboo cutaway set: full-frame composition, so it takes the scene clock and the crop frame.
  if (BAMBOO_PROP_SET.has(prop.type)) {
    if (propPass === 'front_only') return;
    drawBambooProp(g, prop, W, floorY, t, ts, s, propOpts.sceneDuration, propOpts.frame);
    return;
  }

  // Wall-fable set, same single-dispatch pattern.
  if (WALL_PROP_SET.has(prop.type)) {
    if (propPass === 'front_only') return;
    // Captions are screen-space (see drawScreenCaptionPass in video_renderer.js).
    if (prop.type === 'ink_caption') return;
    drawWallProp(g, prop, W, floorY, t, ts, s);
    return;
  }

  g.save();
  if (prop.type === 'chair') {
    const faceLeft = prop.facing === 'left';
    const cw = 82 * s;
    const seatTopY = floorY - 92 * s;
    if (propPass === 'full' || propPass === 'back_only') {
      // Backrest & rear support behind seated character
      const backX = px + (faceLeft ? 30 * s : -42 * s);
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#05070c';
      g.lineWidth = 3 * s;
      g.beginPath();
      g.roundRect(backX, floorY - 196 * s, 12 * s, 108 * s, 5 * s);
      g.fill();
      g.stroke();
      // Legs & seat cushion
      g.fillStyle = '#1e293b';
      g.fillRect(px - cw * 0.38, seatTopY + 12 * s, 8.5 * s, 80 * s);
      g.fillRect(px + cw * 0.38 - 8.5 * s, seatTopY + 12 * s, 8.5 * s, 80 * s);
      g.fillStyle = '#334155';
      g.beginPath();
      g.roundRect(px - cw * 0.5, seatTopY, cw, 14 * s, 5 * s);
      g.fill();
      g.stroke();
    }
  } else if (prop.type === 'table') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const tw = 260 * s;
    const th = 148 * s;
    const topY = floorY - th;
    const bodyW = tw * 0.88;
    const bodyX = px - bodyW * 0.5;
    const legW = 12 * s;

    // Grounded soft floor shadow under the nightstand/side-table
    g.save();
    const tSh = g.createRadialGradient(px, floorY + 2 * s, 8 * s, px, floorY + 2 * s, tw * 0.56);
    tSh.addColorStop(0, 'rgba(0, 0, 0, 0.52)');
    tSh.addColorStop(0.7, 'rgba(0, 0, 0, 0.22)');
    tSh.addColorStop(1, 'rgba(0, 0, 0, 0.00)');
    g.fillStyle = tSh;
    g.beginPath();
    g.ellipse(px, floorY + 2 * s, tw * 0.54, 8 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = '#070a10';
    g.lineWidth = 2.3 * s;

    // Recessed dark lower shelf cubby interior
    const shelfTopY = topY + 52 * s;
    const shelfBotY = floorY - 22 * s;
    g.fillStyle = '#0e141e';
    g.beginPath();
    g.rect(bodyX + legW * 0.6, shelfTopY, bodyW - legW * 1.2, shelfBotY - shelfTopY);
    g.fill();
    g.stroke();

    // Lower-shelf illustrated book silhouettes (3 leaning/upright books on left + 2 flat stacked books on right)
    const bLeft = bodyX + legW + 8 * s;
    g.fillStyle = '#182232';
    g.fillRect(bLeft, shelfBotY - 46 * s, 11 * s, 46 * s);
    g.strokeRect(bLeft, shelfBotY - 46 * s, 11 * s, 46 * s);
    g.fillStyle = '#1e2b3e';
    g.fillRect(bLeft + 12 * s, shelfBotY - 50 * s, 12 * s, 50 * s);
    g.strokeRect(bLeft + 12 * s, shelfBotY - 50 * s, 12 * s, 50 * s);
    g.save();
    g.translate(bLeft + 27 * s, shelfBotY);
    g.rotate(-0.18);
    g.fillStyle = '#162030';
    g.fillRect(0, -45 * s, 11 * s, 45 * s);
    g.strokeRect(0, -45 * s, 11 * s, 45 * s);
    g.restore();

    const sRight = bodyX + bodyW - legW - 62 * s;
    g.fillStyle = '#1a2536';
    g.beginPath();
    g.roundRect(sRight, shelfBotY - 11 * s, 54 * s, 11 * s, 2 * s);
    g.fill();
    g.stroke();
    g.fillStyle = '#223046';
    g.beginPath();
    g.roundRect(sRight + 4 * s, shelfBotY - 21 * s, 46 * s, 10 * s, 2 * s);
    g.fill();
    g.stroke();

    // Left & right side legs + bottom shelf rail
    g.fillStyle = '#182230';
    g.fillRect(bodyX, topY + 12 * s, legW, th - 12 * s);
    g.strokeRect(bodyX, topY + 12 * s, legW, th - 12 * s);
    g.fillRect(bodyX + bodyW - legW, topY + 12 * s, legW, th - 12 * s);
    g.strokeRect(bodyX + bodyW - legW, topY + 12 * s, legW, th - 12 * s);
    g.fillStyle = '#1c2838';
    g.fillRect(bodyX + legW, shelfBotY, bodyW - legW * 2, 10 * s);
    g.strokeRect(bodyX + legW, shelfBotY, bodyW - legW * 2, 10 * s);

    // Upper drawer casing + inset drawer face + round center knob
    g.fillStyle = '#1b2636';
    g.fillRect(bodyX + legW, topY + 13 * s, bodyW - legW * 2, 39 * s);
    g.strokeRect(bodyX + legW, topY + 13 * s, bodyW - legW * 2, 39 * s);
    g.fillStyle = '#1f2c3f';
    g.beginPath();
    g.roundRect(bodyX + legW + 6 * s, topY + 18 * s, bodyW - legW * 2 - 12 * s, 29 * s, 2.5 * s);
    g.fill();
    g.stroke();
    g.fillStyle = '#33445c';
    g.beginPath();
    g.arc(px, topY + 32.5 * s, 4.2 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Beveled overhanging tabletop with subtle cool-slate top rim sheen
    g.fillStyle = '#253347';
    g.beginPath();
    g.roundRect(px - tw * 0.5, topY, tw, 13.5 * s, 3.5 * s);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    g.lineWidth = 1.3 * s;
    g.beginPath();
    g.moveTo(px - tw * 0.48, topY + 2.2 * s);
    g.lineTo(px + tw * 0.48, topY + 2.2 * s);
    g.stroke();

    // Subtle everyday bedside/study details (resting folded eyeglasses + draped charging cable)
    if (prop.minimal !== true) {
      // Folded eyeglasses resting on left side of tabletop
      const gx = px - tw * 0.28;
      const gy = topY - 1.5 * s;
      g.strokeStyle = '#64748b';
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.ellipse(gx - 7 * s, gy - 2 * s, 6.5 * s, 3.2 * s, -0.08, 0, Math.PI * 2);
      g.ellipse(gx + 7 * s, gy - 2 * s, 6.5 * s, 3.2 * s, 0.08, 0, Math.PI * 2);
      g.moveTo(gx - 0.8 * s, gy - 2.6 * s);
      g.lineTo(gx + 0.8 * s, gy - 2.6 * s);
      g.moveTo(gx - 13 * s, gy - 3 * s);
      g.lineTo(gx - 3 * s, gy - 6.5 * s);
      g.stroke();

      // Thin dark charging cord curving gracefully from right tabletop down past the drawer
      const cx0 = px + tw * 0.12;
      g.strokeStyle = '#090d14';
      g.lineWidth = 2.0 * s;
      g.beginPath();
      g.moveTo(cx0 - 6 * s, topY + 0.5 * s);
      g.bezierCurveTo(cx0 + 4 * s, topY + 18 * s, cx0 - 8 * s, topY + 46 * s, cx0 + 18 * s, topY + 64 * s);
      g.stroke();
    }
  } else if (prop.type === 'phone') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const isUpright = prop.orientation === 'upright';
    const isNotifying = Boolean(prop.notifying) || (prop.notify_at !== undefined && ts >= Number(prop.notify_at));
    if (isNotifying) {
      const pulse = 0.14 + 0.08 * Math.sin(t * 7.5);
      drawSoftGlow(g, px, baseY - 8 * s, 42 * s, '#38bdf8', pulse);
    }
    if (isUpright) {
      const pw = 15 * s, ph = 30 * s;
      g.fillStyle = '#0f172a';
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 1.8 * s;
      g.beginPath();
      g.roundRect(px - pw * 0.5, baseY - ph, pw, ph, 3.2 * s);
      g.fill();
      g.stroke();
      g.fillStyle = isNotifying ? '#38bdf8' : '#1e293b';
      g.fillRect(px - pw * 0.34, baseY - ph + 3 * s, pw * 0.68, ph - 6 * s);
    } else {
      // Sleek side-3/4 smartphone resting flat on tabletop/surface
      const pw = 28 * s, ph = 6.5 * s;
      g.fillStyle = '#0f172a';
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 1.8 * s;
      g.beginPath();
      g.roundRect(px - pw * 0.5, baseY - ph, pw, ph, 2.5 * s);
      g.fill();
      g.stroke();
      // Subtle top screen strip (lights softly when notifying)
      g.fillStyle = isNotifying ? '#7dd3fc' : '#334155';
      g.fillRect(px - pw * 0.38, baseY - ph + 0.8 * s, pw * 0.76, 2.0 * s);
    }
  } else if (prop.type === 'laptop' || prop.type === 'computer') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const faceLeft = prop.facing === 'left';
    const dir = faceLeft ? -1 : 1;
    const screenLit = prop.lit !== false;
    if (screenLit) {
      drawSoftGlow(g, px, baseY - 32 * s, 72 * s, '#cbd5e1', 0.12);
    }
    if (prop.type === 'computer') {
      // Minimalist desktop monitor + keyboard deck
      const mw = 58 * s, mh = 42 * s;
      const monX = px + dir * 12 * s;
      g.fillStyle = '#334155';
      g.fillRect(monX - 4 * s, baseY - 16 * s, 8 * s, 16 * s);
      g.fillRect(monX - 16 * s, baseY - 4 * s, 32 * s, 4 * s);
      g.fillStyle = '#0f172a';
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 2.4 * s;
      g.beginPath();
      g.roundRect(monX - mw * 0.5, baseY - 16 * s - mh, mw, mh, 4 * s);
      g.fill();
      g.stroke();
      // Keyboard deck in front
      const kbX = px - dir * 18 * s;
      g.fillStyle = '#475569';
      g.fillRect(kbX - 18 * s, baseY - 4.5 * s, 36 * s, 4.5 * s);
    } else {
      // Sleek open laptop in side-3/4 view
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 5.2 * s;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(px - dir * 26 * s, baseY - 3 * s);
      g.lineTo(px + dir * 4 * s, baseY - 3 * s);
      g.lineTo(px + dir * 18 * s, baseY - 44 * s);
      g.stroke();
    }
  } else if (prop.type === 'sofa') {
    const sw2 = 228 * s;
    const seatTopY = floorY - 56 * s;
    if (propPass === 'full' || propPass === 'back_only') {
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#05070c';
      g.lineWidth = 3 * s;
      g.beginPath();
      g.roundRect(px - sw2 * 0.48, floorY - 110 * s, sw2 * 0.96, 60 * s, 8 * s);
      g.fill();
      g.stroke();
      g.fillStyle = '#334155';
      g.beginPath();
      g.roundRect(px - sw2 * 0.46, seatTopY, sw2 * 0.92, 24 * s, 6 * s);
      g.fill();
      g.stroke();
      // Low armrests
      g.fillStyle = '#263449';
      g.beginPath();
      g.roundRect(px - sw2 * 0.5, floorY - 78 * s, 22 * s, 56 * s, 6 * s);
      g.roundRect(px + sw2 * 0.5 - 22 * s, floorY - 78 * s, 22 * s, 56 * s, 6 * s);
      g.fill();
      g.stroke();
      // Stubby legs
      g.fillStyle = '#0f172a';
      g.fillRect(px - sw2 * 0.42, floorY - 22 * s, 10 * s, 22 * s);
      g.fillRect(px + sw2 * 0.42 - 10 * s, floorY - 22 * s, 10 * s, 22 * s);
    }
  } else if (prop.type === 'window') {
    if (propPass === 'front_only') {
      g.restore();
      return;
    }
    const ww = 160 * s, wh = 190 * s;
    const wy = floorY - (prop.elevation ?? 355 * s);
    g.fillStyle = '#0a0e17';
    g.strokeStyle = '#334155';
    g.lineWidth = 4 * s;
    g.beginPath();
    g.roundRect(px - ww * 0.5, wy, ww, wh, 4 * s);
    g.fill();
    g.stroke();
    g.strokeStyle = '#1e293b';
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.moveTo(px, wy); g.lineTo(px, wy + wh);
    g.moveTo(px - ww * 0.5, wy + wh * 0.5); g.lineTo(px + ww * 0.5, wy + wh * 0.5);
    g.stroke();
  } else if (prop.type === 'cup') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const cw = 17 * s, ch = 19 * s;
    g.fillStyle = '#cbd5e1';
    g.strokeStyle = '#05070c';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.roundRect(px - cw * 0.5, baseY - ch, cw, ch, [2 * s, 2 * s, 4 * s, 4 * s]);
    g.fill();
    g.stroke();
    // Handle loop
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 2.4 * s;
    g.beginPath();
    g.arc(px + cw * 0.5, baseY - ch * 0.52, 4.2 * s, -Math.PI * 0.5, Math.PI * 0.5, false);
    g.stroke();
  } else if (prop.type === 'desk') {
    const dw = 276 * s;
    const dh = 142 * s;
    const topY = floorY - dh;
    const faceLeft = prop.facing === 'left';

    // Chair (back_only or full)
    if (propPass === 'full' || propPass === 'back_only') {
      const chOff = (prop.chair_offset ?? 102) * s;
      const chairX = px + (faceLeft ? chOff : -chOff);
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#090d16';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(chairX - 40 * s, floorY - 92 * s, 80 * s, 14 * s, 5);
      g.fill();
      g.stroke();
      g.fillRect(chairX - 6 * s, floorY - 78 * s, 12 * s, 78 * s);
      const backX = chairX + (faceLeft ? 30 * s : -42 * s);
      g.beginPath();
      g.roundRect(backX, floorY - 196 * s, 12 * s, 108 * s, 5);
      g.fill();
      g.stroke();
    }

    if (propPass === 'full' || propPass === 'front_only') {
      // Desk frame, modesty front apron & top
      g.fillStyle = '#263449';
      g.fillRect(px - dw * 0.42, topY, dw * 0.84, dh * 0.42);
      g.fillStyle = '#334155';
      g.fillRect(px - dw * 0.44, topY, 14 * s, dh);
      g.fillRect(px + dw * 0.44 - 14 * s, topY, 14 * s, dh);
      g.fillStyle = '#475569';
      g.strokeStyle = '#090d16';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(px - dw * 0.5, topY - 14 * s, dw, 16 * s, 5);
      g.fill();
      g.stroke();

      // Monitor / Laptop on desk (or warm midnight notebook & lamp when `hide_laptop` / `notebook` is set)
      const mx = px + (faceLeft ? -34 * s : 34 * s);
      if (!prop.hide_laptop) {
        const screenCol = prop.screen_color || accent;
        drawSoftGlow(g, mx, topY - 52 * s, 125 * s, screenCol, 0.24);
        g.strokeStyle = '#cbd5e1';
        g.lineWidth = 6 * s;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(mx - (faceLeft ? -30 * s : 30 * s), topY - 16 * s);
        g.lineTo(mx, topY - 16 * s);
        g.lineTo(mx + (faceLeft ? -18 * s : 18 * s), topY - 76 * s);
        g.stroke();
      } else if (prop.notebook) {
        // Warm low-glare study lamp + open notebook sheet on tabletop
        const lampX = px + (faceLeft ? -78 * s : 78 * s);
        drawSoftGlow(g, lampX - (faceLeft ? -18 * s : 18 * s), topY - 46 * s, 118 * s, '#f6c87a', 0.22);
        g.strokeStyle = '#1e293b';
        g.lineWidth = 3.2 * s;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(lampX, topY - 15 * s);
        g.quadraticCurveTo(lampX + (faceLeft ? -8 * s : 8 * s), topY - 56 * s, lampX - (faceLeft ? -18 * s : 18 * s), topY - 62 * s);
        g.stroke();
        g.fillStyle = '#334155';
        g.beginPath();
        g.ellipse(lampX - (faceLeft ? -20 * s : 20 * s), topY - 60 * s, 12 * s, 5.5 * s, faceLeft ? 0.35 : -0.35, 0, Math.PI * 2);
        g.fill();
        // Crisp notebook sheet resting flat on tabletop
        const sheetX = px + (faceLeft ? 8 * s : -28 * s);
        g.fillStyle = '#e2e8f0';
        g.strokeStyle = '#090d16';
        g.lineWidth = 1.8 * s;
        g.beginPath();
        g.roundRect(sheetX, topY - 18.5 * s, 44 * s, 4.5 * s, 1.5 * s);
        g.fill();
        g.stroke();
      }
    }
  } else if (prop.type === 'podium') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const pw = 88 * s, ph = 152 * s;
    g.fillStyle = '#1e293b';
    g.strokeStyle = accent;
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(px - pw * 0.5, floorY - ph, pw, ph, [8, 8, 2, 2]);
    g.fill();
    g.stroke();
    g.fillStyle = accent;
    g.fillRect(px - pw * 0.35, floorY - ph + 24 * s, pw * 0.7, 5 * s);
  } else if (prop.type === 'bench') {
    const bw = 220 * s;
    g.fillStyle = '#334155';
    g.strokeStyle = '#090d16';
    g.lineWidth = 3;
    g.fillRect(px - bw * 0.42, floorY - 52 * s, 12 * s, 52 * s);
    g.fillRect(px + bw * 0.42 - 12 * s, floorY - 52 * s, 12 * s, 52 * s);
    g.fillStyle = '#475569';
    g.beginPath();
    g.roundRect(px - bw * 0.5, floorY - 62 * s, bw, 14 * s, 5);
    g.roundRect(px - bw * 0.48, floorY - 106 * s, bw * 0.96, 26 * s, 5);
    g.fill();
    g.stroke();
  } else if (prop.type === 'door') {
    if (propPass === 'front_only') {
      g.restore();
      return;
    }
    const dw = 184 * s, dh = 468 * s;
    const open = clamp(prop.open ?? 0.0);
    const hingeLeft = prop.hinge !== 'right';
    const frameLeft = px - dw * 0.5;
    const frameTop = floorY - dh;

    // Dark recessed doorway opening with subtle restrained architectural light when open
    g.fillStyle = '#05070c';
    g.fillRect(frameLeft, frameTop, dw, dh);
    if (open > 0.03) {
      const openLight = g.createLinearGradient(0, frameTop, 0, floorY);
      openLight.addColorStop(0, `rgba(226, 232, 240, ${ca(0.11 * open)})`);
      openLight.addColorStop(1, `rgba(148, 163, 184, ${ca(0.05 * open)})`);
      g.fillStyle = openLight;
      g.fillRect(frameLeft + 6 * s, frameTop + 6 * s, dw - 12 * s, dh - 6 * s);
    }

    // Hinged door leaf foreshortens smoothly as `open` goes 0 -> 1
    const hingeX = hingeLeft ? frameLeft + 6 * s : frameLeft + dw - 6 * s;
    const leafSpan = (dw - 12 * s) * clamp(1 - open * 0.72, 0.20, 1.0);
    const leafX = hingeLeft ? hingeX : hingeX - leafSpan;
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#05070c';
    g.lineWidth = 2.8 * s;
    g.fillRect(leafX, frameTop + 6 * s, leafSpan, dh - 7 * s);
    g.strokeRect(leafX, frameTop + 6 * s, leafSpan, dh - 7 * s);

    // Subtle recessed architectural panels on door leaf
    if (leafSpan > 34 * s) {
      g.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      g.lineWidth = 1.6 * s;
      g.strokeRect(leafX + leafSpan * 0.18, frameTop + 34 * s, leafSpan * 0.64, dh * 0.34);
      g.strokeRect(leafX + leafSpan * 0.18, frameTop + dh * 0.50, leafSpan * 0.64, dh * 0.34);
    }

    // Door lever handle at exact `computePropAnchors` `handleGrip` coordinate
    const handleX = hingeLeft ? hingeX + leafSpan * 0.82 : hingeX - leafSpan * 0.82;
    const handleY = floorY - 214 * s;
    const leverLen = Math.max(6 * s, 16 * s * clamp(1 - open * 0.55, 0.4, 1.0));
    g.fillStyle = '#cbd5e1';
    g.strokeStyle = '#05070c';
    g.lineWidth = 2.0 * s;
    g.beginPath();
    g.arc(handleX, handleY, 4.2 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = '#e2e8f0';
    g.lineWidth = 3.2 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(handleX, handleY);
    g.lineTo(handleX + (hingeLeft ? -leverLen : leverLen), handleY + (open > 0.08 && open < 0.55 ? 2.5 * s : 0));
    g.stroke();

    // Outer architectural door casing
    g.strokeStyle = '#475569';
    g.lineWidth = 5.5 * s;
    g.strokeRect(frameLeft, frameTop, dw, dh);
    if (prop.label) {
      g.font = `bold ${Math.round(18 * s)}px PopB`;
      g.fillStyle = '#cbd5e1';
      g.textAlign = 'center';
      g.fillText(prop.label.toUpperCase(), px, frameTop - 16 * s);
    }
  } else if (prop.type === 'boulder') {
    const bw = 136 * s, bh = 98 * s;
    g.fillStyle = '#334155';
    g.strokeStyle = '#090d16';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(px - bw * 0.5, floorY);
    g.lineTo(px - bw * 0.42, floorY - bh * 0.65);
    g.lineTo(px - bw * 0.1, floorY - bh);
    g.lineTo(px + bw * 0.32, floorY - bh * 0.84);
    g.lineTo(px + bw * 0.5, floorY - bh * 0.34);
    g.lineTo(px + bw * 0.48, floorY);
    g.closePath();
    g.fill();
    g.stroke();
    if (prop.label) {
      g.font = `bold ${Math.round(20 * s)}px PopB`;
      g.fillStyle = '#cbd5e1';
      g.textAlign = 'center';
      g.fillText(prop.label, px, floorY - bh * 0.42);
    }
  } else if (prop.type === 'stairs') {
    // Each step is a single sh-tall block (tread + riser as one unit), offset by sw.
    // This draws a true staircase silhouette — NOT a bar chart.
    const steps = prop.steps || 8;
    const sw = (prop.step_width || 72) * s;
    const sh = (prop.step_height || 46) * s;
    const dir = prop.dir === 'left' ? -1 : 1;
    // Step colors: darker riser, lighter tread, subtle grey gradient rising
    const baseGrey = 22;
    for (let i = 0; i < steps; i++) {
      const sx = dir > 0 ? px + i * sw : px - (i + 1) * sw;
      const stepTopY = floorY - (i + 1) * sh;
      const stepBotY = floorY - i * sh;
      // Each block is exactly sh tall — proper staircase silhouette
      const depthT = i / Math.max(1, steps - 1);
      // Riser (vertical face): darker grey
      const riserGrey = Math.round(baseGrey + depthT * 30);
      // Tread (horizontal top): lighter grey
      const treadGrey = Math.round(baseGrey + 18 + depthT * 30);
      // Draw riser (front face)
      g.fillStyle = `rgb(${riserGrey}, ${riserGrey + 4}, ${riserGrey + 10})`;
      g.fillRect(sx + 1, stepTopY, sw - 3, sh);
      // Draw tread (top surface) — slightly lighter
      g.fillStyle = `rgb(${treadGrey}, ${treadGrey + 6}, ${treadGrey + 14})`;
      g.fillRect(sx, stepTopY, sw, Math.max(2, 4 * s));
      // Thin outline on each step — matches minimalist spec
      g.strokeStyle = `rgba(180, 180, 190, ${0.18 + depthT * 0.18})`;
      g.lineWidth = 1.2;
      g.strokeRect(sx + 1, stepTopY, sw - 3, sh);
    }
    // Top step: subtle white highlight (NOT yellow — yellow reserved for orb/sunrise/chest/BEGIN)
    if (steps > 0) {
      const topSx = dir > 0 ? px + (steps - 1) * sw : px - steps * sw;
      const topY = floorY - steps * sh;
      g.fillStyle = 'rgba(220, 220, 230, 0.22)';
      g.fillRect(topSx, topY, sw, Math.max(2, 3 * s));
    }
  } else if (prop.type === 'signpost') {
    const postHeight = Number(prop.post_height ?? 250) * s;
    const labelHeight = Number(prop.label_height ?? 238) * s;
    g.strokeStyle = '#64748b';
    g.lineWidth = 7 * s;
    g.beginPath();
    g.moveTo(px, floorY);
    g.lineTo(px, floorY - postHeight);
    g.stroke();
    if (prop.left_label) {
      g.fillStyle = '#fb7185';
      g.beginPath();
      g.roundRect(px - 155 * s, floorY - labelHeight, 148 * s, 38 * s, 6);
      g.fill();
      g.font = `bold ${Math.round(17 * s)}px PopB`;
      g.fillStyle = '#090d16';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(prop.left_label, px - 81 * s, floorY - labelHeight + 19 * s);
    }
    if (prop.right_label) {
      g.fillStyle = accent;
      g.beginPath();
      g.roundRect(px + 7 * s, floorY - labelHeight, 148 * s, 38 * s, 6);
      g.fill();
      g.font = `bold ${Math.round(17 * s)}px PopB`;
      g.fillStyle = '#090d16';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(prop.right_label, px + 81 * s, floorY - labelHeight + 19 * s);
    }
  } else if (prop.type === 'clock') {
    const cy = floorY - (prop.elevation || 470);
    const r = 42 * s;
    const isSpinning = prop.urgent || (prop.spin_after !== undefined && t >= prop.spin_after);
    g.fillStyle = '#0b1120';
    g.strokeStyle = isSpinning ? '#cbd5e1' : accent;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(px, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Minimalist hour ticks
    g.strokeStyle = 'rgba(203,213,225,0.45)';
    g.lineWidth = 2;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(px + Math.sin(ang) * r * 0.78, cy - Math.cos(ang) * r * 0.78);
      g.lineTo(px + Math.sin(ang) * r * 0.90, cy - Math.cos(ang) * r * 0.90);
      g.stroke();
    }
    const minAng = isSpinning ? t * 11.5 : Math.floor(t) * (Math.PI / 30);
    const hrAng = isSpinning ? t * 1.6 : 0.8 + t * 0.03;
    g.strokeStyle = '#f8fafc';
    g.lineCap = 'round';
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(px, cy);
    g.lineTo(px + Math.sin(hrAng) * r * 0.48, cy - Math.cos(hrAng) * r * 0.48);
    g.stroke();
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(px, cy);
    g.lineTo(px + Math.sin(minAng) * r * 0.74, cy - Math.cos(minAng) * r * 0.74);
    g.stroke();
  } else if (prop.type === 'bed') {
    const bw = 270 * s;
    const bh = 62 * s;
    const messy = Boolean(prop.messy);
    // Bed frame & headboard
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.8;
    g.fillRect(px - bw * 0.5, floorY - bh, bw, 22 * s);
    g.strokeRect(px - bw * 0.5, floorY - bh, bw, 22 * s);
    g.fillRect(px - bw * 0.5, floorY - bh - 54 * s, 18 * s, bh + 54 * s);
    g.strokeRect(px - bw * 0.5, floorY - bh - 54 * s, 18 * s, bh + 54 * s);
    g.fillRect(px + bw * 0.5 - 16 * s, floorY - bh, 16 * s, bh);
    g.strokeRect(px + bw * 0.5 - 16 * s, floorY - bh, 16 * s, bh);
    // Mattress & pillow
    g.fillStyle = '#94a3b8';
    g.beginPath();
    g.roundRect(px - bw * 0.5 + 18 * s, floorY - bh - 20 * s, bw - 26 * s, 22 * s, 6);
    g.fill();
    g.stroke();
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.roundRect(px - bw * 0.5 + 26 * s, floorY - bh - 34 * s, 58 * s, 16 * s, 7);
    g.fill();
    g.stroke();
    // Blanket (rumpled if messy, neat if clean)
    g.fillStyle = messy ? '#334155' : '#475569';
    g.beginPath();
    if (messy) {
      g.moveTo(px - 24 * s, floorY - bh - 20 * s);
      g.quadraticCurveTo(px + 20 * s, floorY - bh - 38 * s, px + 62 * s, floorY - bh - 16 * s);
      g.quadraticCurveTo(px + 96 * s, floorY - bh + 8 * s, px + 78 * s, floorY - 12 * s);
      g.lineTo(px - 10 * s, floorY - bh + 4 * s);
      g.closePath();
    } else {
      g.roundRect(px - 36 * s, floorY - bh - 22 * s, bw * 0.58, 24 * s, 5);
    }
    g.fill();
    g.stroke();
  } else if (prop.type === 'cafe_table') {
    const tw = 210 * s, th = 112 * s;
    const chairOff = (prop.chair_offset ?? 160) * s;
    if (propPass === 'full' || propPass === 'back_only') {
      // Two cafe chairs positioned comfortably under seated characters on left & right of table
      for (const dir of [-1, 1]) {
        const cx = px + dir * chairOff;
        g.strokeStyle = '#334155';
        g.lineWidth = 6.5 * s;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx - 32 * s, floorY - 62 * s); g.lineTo(cx + 32 * s, floorY - 62 * s);
        g.moveTo(cx - 24 * s, floorY - 62 * s); g.lineTo(cx - 28 * s, floorY);
        g.moveTo(cx + 24 * s, floorY - 62 * s); g.lineTo(cx + 28 * s, floorY);
        g.moveTo(cx + dir * 30 * s, floorY - 62 * s); g.lineTo(cx + dir * 34 * s, floorY - 138 * s);
        g.stroke();
      }
      if (propPass === 'back_only') {
        g.restore();
        return;
      }
    }
    // Bistro pedestal table; lifted warm-slate top edge keeps the tabletop readable beneath seated hands
    g.fillStyle = '#334155';
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3.5 * s;
    g.fillRect(px - 8 * s, floorY - th, 16 * s, th);
    g.fillRect(px - 48 * s, floorY - 8 * s, 96 * s, 8 * s);
    g.beginPath();
    g.roundRect(px - tw * 0.5, floorY - th - 10 * s, tw, 16 * s, 5);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(251, 191, 36, 0.42)';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(px - tw * 0.48, floorY - th - 8 * s);
    g.lineTo(px + tw * 0.48, floorY - th - 8 * s);
    g.stroke();
    // Warm table candle/lamp & steaming coffee cups + optional cream envelope or sliding blank sheet
    drawSoftGlow(g, px, floorY - th - 26 * s, 95 * s, '#f59e0b', 0.28);
    for (const cupX of prop.two_cups === false ? [px - 56 * s] : [px - 74 * s, px + 56 * s]) {
      g.fillStyle = '#e2e8f0';
      g.strokeStyle = '#090d16';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(cupX, floorY - th - 27 * s, 18 * s, 17 * s, 3);
      g.fill();
      g.stroke();
      // Rising steam wisp
      g.strokeStyle = 'rgba(241,245,249,0.28)';
      g.lineWidth = 1.6;
      const swisp = Math.sin(t * 2.4 + cupX) * 4 * s;
      g.beginPath();
      g.moveTo(cupX + 9 * s, floorY - th - 31 * s);
      g.quadraticCurveTo(cupX + 9 * s + swisp, floorY - th - 43 * s, cupX + 9 * s - swisp * 0.6, floorY - th - 54 * s);
      g.stroke();
    }
    if (prop.blank_sheet || prop.sheet_reveal_at !== undefined) {
      const revT = Number(prop.sheet_reveal_at ?? 0.5);
      if (ts >= revT - 0.1) {
        const slideU = ease(clamp((ts - revT) / 0.85));
        const sheetX = lerp(px + 34 * s, px - 22 * s, slideU);
        const sheetY = floorY - th - 16 * s;
        g.save();
        g.globalAlpha = clamp((ts - (revT - 0.1)) / 0.22);
        g.fillStyle = '#f8fafc';
        g.strokeStyle = '#64748b';
        g.lineWidth = 1.6 * s;
        g.beginPath();
        g.roundRect(sheetX - 22 * s, sheetY, 44 * s, 7 * s, 2 * s);
        g.fill();
        g.stroke();
        // Warm amber pencil beside the blank sheet
        g.strokeStyle = '#f59e0b';
        g.lineWidth = 2.4 * s;
        g.beginPath();
        g.moveTo(sheetX - 10 * s, sheetY - 2.5 * s);
        g.lineTo(sheetX + 14 * s, sheetY - 3.5 * s);
        g.stroke();
        g.restore();
      }
    }
    if (prop.envelope) {
      g.fillStyle = '#fef3c7';
      g.strokeStyle = '#78350f';
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(px - 18 * s, floorY - th - 19 * s, 36 * s, 10 * s, 2);
      g.fill();
      g.stroke();
    }
  } else if (prop.type === 'digital_clock') {
    const cy = floorY - (prop.elevation ?? 128 * s);
    const cw2 = 104 * s, ch2 = 52 * s;
    const ledCol = prop.led_color || '#ef4444';
    if (prop.stand !== false) {
      g.fillStyle = '#141b29';
      g.strokeStyle = '#090d16';
      g.lineWidth = 2.6;
      g.beginPath();
      g.roundRect(px - 68 * s, cy + ch2 * 0.5, 136 * s, floorY - (cy + ch2 * 0.5), [8, 8, 0, 0]);
      g.fill();
      g.stroke();
    }
    drawSoftGlow(g, px, cy, 85 * s, ledCol, 0.25);
    g.fillStyle = '#090d16';
    g.strokeStyle = '#475569';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.roundRect(px - cw2 * 0.5, cy - ch2 * 0.5, cw2, ch2, 12 * s);
    g.fill();
    g.stroke();
    const blink = Math.floor(t * 2) % 2 === 0 ? ':' : ' ';
    const rawTime = String(prop.time_text || '8:15');
    const disp = prop.blink ? rawTime.replace(':', blink) : rawTime;
    g.font = `bold ${Math.round(28 * s)}px PopB`;
    g.fillStyle = ledCol;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(disp, px, cy + 1 * s);
  } else if (prop.type === 'streetlamp') {
    const h = 365 * s;
    const flick = prop.flicker ? (Math.sin(t * 17) > 0.92 ? 0.55 : 1.0) : 1.0;
    g.strokeStyle = '#1e293b';
    g.lineWidth = 7 * s;
    g.beginPath();
    g.moveTo(px, floorY);
    g.lineTo(px, floorY - h);
    g.lineTo(px + (prop.arm_dir || 1) * 34 * s, floorY - h);
    g.stroke();
    const lx = px + (prop.arm_dir || 1) * 34 * s;
    drawSoftGlow(g, lx, floorY - h + 6 * s, 145 * s, accent, 0.34 * flick);
    g.fillStyle = '#fef3c7';
    g.beginPath();
    g.arc(lx, floorY - h + 6 * s, 9 * s, 0, Math.PI * 2);
    g.fill();
  } else if (prop.type === 'ankle_chain') {
    const x1 = (prop.anchor_x ?? 0.14) * W;
    const y1 = floorY - (prop.anchor_elev ?? 6);
    const x2 = (prop.target_x ?? 0.42) * W;
    const y2 = floorY - (prop.target_elev ?? 14);
    const links = prop.links || 8;
    const breaking = prop.break_at !== undefined && t >= prop.break_at;
    const breakProg = breaking ? clamp((t - prop.break_at) / 1.4, 0, 1) : 0;

    for (let i = 0; i < links; i++) {
      const f = i / Math.max(1, links - 1);
      let lx = lerp(x1, x2, f);
      let ly = lerp(y1, y2, f) + Math.sin(f * Math.PI) * 14 * s;
      if (breaking && (i === Math.floor(links * 0.5) || i === Math.floor(links * 0.5) + 1)) {
        ly += breakProg * breakProg * 48 * s;
        lx += (i % 2 === 0 ? -1 : 1) * breakProg * 28 * s;
        if (breakProg < 0.75) {
          drawSoftGlow(g, lx, ly, 36 * s, '#f59e0b', (1 - breakProg) * 0.55);
        }
      }
      g.save();
      g.globalAlpha = breaking ? Math.max(0.18, 1 - breakProg * 0.75) : 0.92;
      g.strokeStyle = '#475569';
      g.fillStyle = '#0f172a';
      g.lineWidth = 4.2 * s;
      g.beginPath();
      g.ellipse(lx, ly, 13 * s, 7 * s, (i % 2) * 0.45, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    }
  } else if (prop.type === 'goal_orb') {
    // Soft yellow glowing orb — the goal at the top of the staircase
    const orbX = prop.x * W;
    const orbY = prop.y || 180;
    const orbR = prop.size || 36;
    const pulse = 1.0 + 0.06 * Math.sin(t * 2.2);
    const glowR = orbR * 3.5 * pulse;
    const orbRgb = hexToRgb(prop.color || '#fbbf24'); // yellow default
    // Outer glow
    const orbGrad = g.createRadialGradient(orbX, orbY, 2, orbX, orbY, glowR);
    orbGrad.addColorStop(0, `rgba(${orbRgb[0]},${orbRgb[1]},${orbRgb[2]},0.38)`);
    orbGrad.addColorStop(0.4, `rgba(${orbRgb[0]},${orbRgb[1]},${orbRgb[2]},0.12)`);
    orbGrad.addColorStop(1, `rgba(${orbRgb[0]},${orbRgb[1]},${orbRgb[2]},0)`);
    g.save();
    g.fillStyle = orbGrad;
    g.beginPath();
    g.arc(orbX, orbY, glowR, 0, Math.PI * 2);
    g.fill();
    // Core orb
    g.fillStyle = `rgba(${orbRgb[0]},${orbRgb[1]},${orbRgb[2]},0.92)`;
    g.beginPath();
    g.arc(orbX, orbY, orbR * pulse, 0, Math.PI * 2);
    g.fill();
    // Bright inner highlight
    g.fillStyle = `rgba(255,255,240,${ca(0.55)})`;
    g.beginPath();
    g.arc(orbX - orbR * 0.15, orbY - orbR * 0.15, orbR * 0.35 * pulse, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else if (prop.type === 'goal_silhouette') {
    const gy = floorY - (prop.elevation || 210 * s);
    drawSoftGlow(g, px, gy - 85 * s, 165 * s, '#f59e0b', 0.36);
    g.save();
    g.strokeStyle = 'rgba(254,243,199,0.88)';
    g.fillStyle = 'rgba(254,243,199,0.92)';
    g.lineWidth = 9 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(px, gy - 142 * s, 15 * s, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(px, gy - 124 * s); g.lineTo(px, gy - 62 * s);
    g.moveTo(px, gy - 114 * s); g.lineTo(px - 22 * s, gy - 76 * s);
    g.moveTo(px, gy - 114 * s); g.lineTo(px + 22 * s, gy - 76 * s);
    g.moveTo(px, gy - 62 * s); g.lineTo(px - 14 * s, gy);
    g.moveTo(px, gy - 62 * s); g.lineTo(px + 14 * s, gy);
    g.stroke();
    g.restore();
  } else if (prop.type === 'pocket_watch') {
    const standH = prop.stand_h ?? 116 * s;
    // Wooden/brass watchmaker counter pedestal
    g.fillStyle = '#1c1917';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.8;
    g.beginPath();
    g.roundRect(px - 68 * s, floorY - standH, 136 * s, standH, [8, 8, 0, 0]);
    g.fill();
    g.stroke();
    g.fillStyle = '#7f1d1d';
    g.beginPath();
    g.roundRect(px - 42 * s, floorY - standH - 8 * s, 84 * s, 10 * s, 4);
    g.fill();
    // Silver railway pocket watch upright on velvet cushion
    const wy = floorY - standH - 42 * s;
    const wr = 32 * s;
    drawSoftGlow(g, px, wy, 95 * s, prop.glow_color || '#fbbf24', 0.30);
    // Crown & bow ring at top
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.arc(px, wy - wr - 10 * s, 9 * s, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#94a3b8';
    g.fillRect(px - 5 * s, wy - wr - 5 * s, 10 * s, 6 * s);
    // Silver bezel & warm ivory dial
    g.fillStyle = '#e2e8f0';
    g.strokeStyle = '#090d16';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.arc(px, wy, wr + 4 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fafaf9';
    g.beginPath();
    g.arc(px, wy, wr - 1 * s, 0, Math.PI * 2);
    g.fill();
    // Delicate railway minute ticks & hands (+5 min ahead)
    g.strokeStyle = '#334155';
    g.lineWidth = 1.6 * s;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(px + Math.sin(a) * wr * 0.74, wy - Math.cos(a) * wr * 0.74);
      g.lineTo(px + Math.sin(a) * wr * 0.88, wy - Math.cos(a) * wr * 0.88);
      g.stroke();
    }
    const secA = Math.floor(t) * (Math.PI / 30) + 0.52;
    g.strokeStyle = '#0f172a';
    g.lineCap = 'round';
    g.lineWidth = 2.8 * s;
    g.beginPath(); g.moveTo(px, wy); g.lineTo(px + Math.sin(0.95) * wr * 0.48, wy - Math.cos(0.95) * wr * 0.48); g.stroke();
    g.lineWidth = 2.0 * s;
    g.beginPath(); g.moveTo(px, wy); g.lineTo(px + Math.sin(secA) * wr * 0.72, wy - Math.cos(secA) * wr * 0.72); g.stroke();
  } else if (prop.type === 'pedestal') {
    g.fillStyle = '#1e293b';
    g.strokeStyle = accent;
    g.lineWidth = 2.5;
    g.fillRect(px - 38 * s, floorY - 120 * s, 76 * s, 120 * s);
    g.strokeRect(px - 38 * s, floorY - 120 * s, 76 * s, 120 * s);
    drawSoftGlow(g, px, floorY - 152 * s, 90 * s, accent, 0.42);
    g.fillStyle = accent;
    g.beginPath();
    g.arc(px, floorY - 152 * s, 20 * s, 0, Math.PI * 2);
    g.fill();
  } else if (prop.type === 'books' || prop.type === 'book') {
    if (propPass === 'back_only') {
      g.restore();
      return;
    }
    const cols = Array.isArray(prop.colors) && prop.colors.length > 0
      ? prop.colors
      : CANONICAL_ASSET_LIBRARY.books.palette.spines;
    for (let i = 0; i < (prop.count || 4); i++) {
      const by = baseY - (i + 1) * 16 * s;
      g.fillStyle = cols[i % cols.length];
      g.strokeStyle = '#05070c';
      g.lineWidth = 2 * s;
      g.beginPath();
      g.roundRect(px - 38 * s + (i % 2) * 4 * s, by, 76 * s, 15 * s, 3 * s);
      g.fill();
      g.stroke();
    }
  } else if (prop.type === 'umbrella_stand') {
    const sw = 48 * s, sh = 76 * s;
    const umbs = Array.isArray(prop.umbrellas) ? prop.umbrellas : [];
    if (umbs.includes('#ef4444') || umbs.includes('#e11d48')) {
      drawSoftGlow(g, px, floorY - sh - 22 * s, 95 * s, '#ef4444', 0.30);
    }
    // Folded umbrellas resting inside the stand
    umbs.forEach((uCol, idx) => {
      const spread = (idx - (umbs.length - 1) * 0.5) * 9.5 * s;
      const tilt = (idx - (umbs.length - 1) * 0.5) * 0.09;
      g.save();
      g.translate(px + spread, floorY - sh + 14 * s);
      g.rotate(tilt);
      // Shaft & folded canopy
      g.strokeStyle = '#060912';
      g.lineWidth = 11 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 26 * s);
      g.lineTo(0, -48 * s);
      g.stroke();
      g.strokeStyle = uCol;
      g.lineWidth = 7.5 * s;
      g.beginPath();
      g.moveTo(0, 24 * s);
      g.lineTo(0, -46 * s);
      g.stroke();
      // Curved J-handle sticking out top
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 3.6 * s;
      g.beginPath();
      g.moveTo(0, -46 * s);
      g.lineTo(0, -64 * s);
      g.arc(7 * s, -64 * s, 7 * s, Math.PI, 0, false);
      g.stroke();
      g.restore();
    });
    // Dark iron cylinder stand body in front
    g.fillStyle = 'rgba(15, 23, 42, 0.94)';
    g.strokeStyle = '#475569';
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.roundRect(px - sw * 0.5, floorY - sh, sw, sh, [6 * s, 6 * s, 3 * s, 3 * s]);
    g.fill();
    g.stroke();
    // Subtle drip tray rim
    g.strokeStyle = '#64748b';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(px - sw * 0.54, floorY - sh + 10 * s);
    g.lineTo(px + sw * 0.54, floorY - sh + 10 * s);
    g.stroke();

    // Optional community sign above the stand (Scene 8 finale!)
    if (prop.sign_text) {
      const sy = floorY - sh - 135 * s;
      const lines = String(prop.sign_text).split('|');
      const boxW = 310 * s, boxH = (26 + lines.length * 22) * s;
      drawSoftGlow(g, px, sy, 140 * s, '#fbbf24', 0.22);
      g.fillStyle = '#fefce8';
      g.strokeStyle = '#334155';
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.roundRect(px - boxW * 0.5, sy - boxH * 0.5, boxW, boxH, 7 * s);
      g.fill();
      g.stroke();
      g.font = `bold ${Math.round(13.5 * s)}px PopB`;
      g.fillStyle = '#0f172a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      lines.forEach((ln, li) => {
        const ly = sy - ((lines.length - 1) * 10.5 * s) + li * 21 * s;
        g.fillText(ln.trim(), px, ly);
      });
    }
  } else if (prop.type === 'water_trail') {
    const x0 = (prop.from_x ?? 0.35) * W;
    const x1 = (prop.to_x ?? 0.78) * W;
    const drops = prop.count || 9;
    for (let i = 0; i < drops; i++) {
      const f = i / Math.max(1, drops - 1);
      const dx = lerp(x0, x1, f);
      const dy = floorY + 5 + Math.sin(i * 2.3) * 4;
      const rw = (16 - f * 5) * s;
      const pulse = 0.48 + 0.22 * Math.sin(t * 2.6 + i);
      g.fillStyle = `rgba(125, 211, 252, ${ca(pulse)})`;
      g.beginPath();
      g.ellipse(dx, dy, rw, 3.6 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (prop.type === 'bus_shelter') {
    const sw = 320 * s, sh = 275 * s;
    const leftX = px - sw * 0.5;
    const topY = floorY - sh;
    // Frosted dark glass back panel
    g.fillStyle = 'rgba(15, 23, 42, 0.56)';
    g.strokeStyle = '#334155';
    g.lineWidth = 3 * s;
    g.fillRect(leftX + 14 * s, topY + 14 * s, sw - 28 * s, sh - 14 * s);
    g.strokeRect(leftX + 14 * s, topY + 14 * s, sw - 28 * s, sh - 14 * s);
    // Vertical steel pillars
    g.fillStyle = '#1e293b';
    g.fillRect(leftX + 6 * s, topY, 11 * s, sh);
    g.fillRect(leftX + sw - 17 * s, topY, 11 * s, sh);
    // Roof with broken gap (leaking shelter!)
    g.fillStyle = '#334155';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.5 * s;
    if (prop.broken_roof !== false) {
      // Left intact section + jagged gap + right edge
      g.beginPath();
      g.roundRect(leftX - 14 * s, topY - 12 * s, sw * 0.54, 15 * s, 4 * s);
      g.roundRect(leftX + sw * 0.76, topY - 10 * s, sw * 0.28, 13 * s, 4 * s);
      g.fill();
      g.stroke();
      // Rain streaks blowing through the broken roof gap
      if (prop.leaking !== false) {
        const gapX = leftX + sw * 0.63;
        g.strokeStyle = 'rgba(186, 230, 253, 0.36)';
        g.lineWidth = 1.6 * s;
        const maxDropY = prop.shielded ? topY + 95 * s : floorY - 10 * s;
        for (let rIdx = 0; rIdx < 8; rIdx++) {
          const rx = gapX - 24 * s + rIdx * 7 * s;
          const spanH = Math.max(24, maxDropY - (topY + 4 * s));
          const ry = topY + 4 * s + ((t * 430 + rIdx * 37) % spanH);
          g.beginPath();
          g.moveTo(rx, ry);
          g.lineTo(rx - 6 * s, Math.min(maxDropY, ry + 18 * s));
          g.stroke();
        }
      }
    } else {
      g.beginPath();
      g.roundRect(leftX - 14 * s, topY - 12 * s, sw + 28 * s, 15 * s, 4 * s);
      g.fill();
      g.stroke();
    }
    // Bench inside shelter
    const bw = sw * 0.64;
    g.fillStyle = '#334155';
    g.fillRect(px - bw * 0.44, floorY - 46 * s, 9 * s, 46 * s);
    g.fillRect(px + bw * 0.44 - 9 * s, floorY - 46 * s, 9 * s, 46 * s);
    g.fillStyle = '#475569';
    g.beginPath();
    g.roundRect(px - bw * 0.5, floorY - 56 * s, bw, 12 * s, 4 * s);
    g.fill();
    g.stroke();
    // Bus stop sign pole on right
    const poleX = leftX + sw + 38 * s;
    g.strokeStyle = '#475569';
    g.lineWidth = 5 * s;
    g.beginPath();
    g.moveTo(poleX, floorY);
    g.lineTo(poleX, topY + 25 * s);
    g.stroke();
    g.fillStyle = '#0f172a';
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.roundRect(poleX - 18 * s, topY + 4 * s, 36 * s, 42 * s, 6 * s);
    g.fill();
    g.stroke();
    g.font = `bold ${Math.round(13 * s)}px PopB`;
    g.fillStyle = '#bae6fd';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('BUS', poleX, topY + 25 * s);
  } else if (prop.type === 'passing_bus' || prop.type === 'passing_car') {
    const isCar = prop.type === 'passing_car';
    const isBackLane = prop.lane === 'back' || prop.layer === 'back' || (prop.z !== undefined && Number(prop.z) < 0);
    const laneScale = s * (isBackLane ? 0.80 : 1.0);
    const roadFloor = isBackLane ? floorY - 14 : floorY + 6;
    const t0 = Number(prop.from_t ?? 0);
    const t1 = Number(prop.to_t ?? (t0 + (isCar ? 2.1 : 2.8)));
    const prog = clamp((ts - t0) / Math.max(0.05, t1 - t0));
    const bx = lerp((prop.from_x ?? -0.38) * W, (prop.to_x ?? 1.38) * W, prog);
    const dir = (prop.to_x ?? 1.38) >= (prop.from_x ?? -0.38) ? 1 : -1;

    if (isCar) {
      const cw = 320 * laneScale, ch = 108 * laneScale;
      const bodyTop = roadFloor - ch - 18 * laneScale;
      // Headlight & taillight glows
      drawSoftGlow(g, bx + dir * (cw * 0.5 + 65 * laneScale), roadFloor - 48 * laneScale, 155 * laneScale, '#fef08a', 0.36);
      drawSoftGlow(g, bx - dir * (cw * 0.5 + 18 * laneScale), roadFloor - 48 * laneScale, 52 * laneScale, '#ef4444', 0.32);

      // Sleek sedan silhouette
      const carColor = prop.body_color || (isBackLane ? '#1e293b' : '#0f172a');
      g.fillStyle = carColor;
      g.strokeStyle = '#475569';
      g.lineWidth = 3 * laneScale;
      g.beginPath();
      g.roundRect(bx - cw * 0.5, bodyTop + ch * 0.38, cw, ch * 0.62, 14 * laneScale);
      g.fill();
      g.stroke();

      // Cabin greenhouse + tinted windows
      g.beginPath();
      g.moveTo(bx - cw * 0.28, bodyTop + ch * 0.40);
      g.lineTo(bx - cw * 0.14, bodyTop);
      g.lineTo(bx + cw * 0.18, bodyTop);
      g.lineTo(bx + cw * 0.34, bodyTop + ch * 0.40);
      g.closePath();
      g.fill();
      g.stroke();

      g.fillStyle = 'rgba(186, 230, 253, 0.28)';
      g.beginPath();
      g.moveTo(bx - cw * 0.23, bodyTop + ch * 0.37);
      g.lineTo(bx - cw * 0.11, bodyTop + 6 * laneScale);
      g.lineTo(bx + cw * 0.15, bodyTop + 6 * laneScale);
      g.lineTo(bx + cw * 0.28, bodyTop + ch * 0.37);
      g.closePath();
      g.fill();

      // Rotating wheels + hubcaps
      const wheelRot = (bx / Math.max(12, 26 * laneScale)) * dir;
      for (const wheelOff of [-cw * 0.31, cw * 0.31]) {
        const wx = bx + wheelOff, wy = roadFloor - 22 * laneScale, wr = 23 * laneScale;
        g.fillStyle = '#020617';
        g.strokeStyle = '#64748b';
        g.lineWidth = 3.5 * laneScale;
        g.beginPath();
        g.arc(wx, wy, wr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.strokeStyle = '#94a3b8';
        g.lineWidth = 2 * laneScale;
        for (let sp = 0; sp < 3; sp++) {
          const sa = wheelRot + (sp * Math.PI) / 3;
          g.beginPath();
          g.moveTo(wx - Math.cos(sa) * wr * 0.55, wy - Math.sin(sa) * wr * 0.55);
          g.lineTo(wx + Math.cos(sa) * wr * 0.55, wy + Math.sin(sa) * wr * 0.55);
          g.stroke();
        }
      }
    } else {
      const bw = 680 * laneScale, bh = 285 * laneScale;
      const topY = roadFloor - bh - 12 * laneScale;

      // Headlight beam ahead of bus
      const frontX = bx + dir * bw * 0.5;
      drawSoftGlow(g, frontX + dir * 95 * laneScale, roadFloor - 68 * laneScale, 220 * laneScale, '#fef08a', 0.42);
      // Bus body
      g.fillStyle = isBackLane ? '#131f35' : '#0f172a';
      g.strokeStyle = '#334155';
      g.lineWidth = 3.5 * laneScale;
      g.beginPath();
      g.roundRect(bx - bw * 0.5, topY, bw, bh, 18 * laneScale);
      g.fill();
      g.stroke();
      // Accent stripe
      g.fillStyle = '#1e3a8a';
      g.fillRect(bx - bw * 0.49, topY + bh * 0.56, bw * 0.98, 22 * laneScale);
      // Warm glowing passenger windows
      for (let wi = 0; wi < 6; wi++) {
        const wx = bx - bw * 0.43 + wi * (bw * 0.145);
        g.fillStyle = 'rgba(254, 240, 138, 0.26)';
        g.strokeStyle = '#475569';
        g.lineWidth = 2 * laneScale;
        g.beginPath();
        g.roundRect(wx, topY + 34 * laneScale, bw * 0.115, bh * 0.38, 6 * laneScale);
        g.fill();
        g.stroke();
      }
      // Rotating wheels
      const wheelRot = (bx / Math.max(16, 32 * laneScale)) * dir;
      for (const wheelOff of [-bw * 0.30, bw * 0.30]) {
        const wx = bx + wheelOff, wy = roadFloor - 22 * laneScale, wr = 32 * laneScale;
        g.fillStyle = '#020617';
        g.strokeStyle = '#64748b';
        g.lineWidth = 4 * laneScale;
        g.beginPath();
        g.arc(wx, wy, wr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.strokeStyle = '#94a3b8';
        g.lineWidth = 2.2 * laneScale;
        for (let sp = 0; sp < 3; sp++) {
          const sa = wheelRot + (sp * Math.PI) / 3;
          g.beginPath();
          g.moveTo(wx - Math.cos(sa) * wr * 0.5, wy - Math.sin(sa) * wr * 0.5);
          g.lineTo(wx + Math.cos(sa) * wr * 0.5, wy + Math.sin(sa) * wr * 0.5);
          g.stroke();
        }
      }
    }
  } else if (prop.type === 'headlights') {
    const dir = prop.dir === 'left' ? -1 : 1;
    const t0 = Number(prop.from_t ?? 0);
    const fade = clamp((ts - t0) / 1.1);
    const hx = px;
    const hy = floorY - 72 * s;
    drawSoftGlow(g, hx, hy, 260 * s, '#fde047', 0.38 * fade);
    const grad = g.createLinearGradient(hx, hy, hx + dir * 560 * s, hy);
    grad.addColorStop(0, `rgba(254, 240, 138, ${ca(0.42 * fade)})`);
    grad.addColorStop(1, 'rgba(254, 240, 138, 0.000)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(hx, hy - 18 * s);
    g.lineTo(hx + dir * 560 * s, hy - 115 * s);
    g.lineTo(hx + dir * 560 * s, hy + 72 * s);
    g.lineTo(hx, hy + 18 * s);
    g.closePath();
    g.fill();
  } else if (prop.type === 'photo_table') {
    const tw = 118 * s, th = 94 * s;
    const topY = floorY - th;
    // Small dark wood side table
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.6 * s;
    g.fillRect(px - tw * 0.38, topY, 9 * s, th);
    g.fillRect(px + tw * 0.38 - 9 * s, topY, 9 * s, th);
    g.fillStyle = '#334155';
    g.beginPath();
    g.roundRect(px - tw * 0.5, topY - 10 * s, tw, 12 * s, 4 * s);
    g.fill();
    g.stroke();
    // Warmly glowing framed photograph on table (Eli + younger brother under yellow umbrella!)
    const fw = 54 * s, fh = 64 * s;
    const fy0 = topY - 10 * s - fh;
    drawSoftGlow(g, px, fy0 + fh * 0.5, 88 * s, '#fbbf24', 0.34);
    g.fillStyle = '#1c1917';
    g.strokeStyle = '#d97706';
    g.lineWidth = 3 * s;
    g.beginPath();
    g.roundRect(px - fw * 0.5, fy0, fw, fh, 4 * s);
    g.fill();
    g.stroke();
    g.fillStyle = '#292524';
    g.fillRect(px - fw * 0.5 + 5 * s, fy0 + 5 * s, fw - 10 * s, fh - 10 * s);
    // Tiny yellow umbrella arc + 2 stick figures inside frame
    g.fillStyle = '#eab308';
    g.beginPath();
    g.arc(px, fy0 + 25 * s, 16 * s, Math.PI, 0, false);
    g.fill();
    g.strokeStyle = '#f8fafc';
    g.lineWidth = 2.2 * s;
    g.beginPath();
    g.arc(px - 6 * s, fy0 + 34 * s, 3.5 * s, 0, Math.PI * 2);
    g.moveTo(px - 6 * s, fy0 + 38 * s); g.lineTo(px - 6 * s, fy0 + 53 * s);
    g.stroke();
    g.strokeStyle = '#fde047';
    g.beginPath();
    g.arc(px + 6 * s, fy0 + 39 * s, 2.8 * s, 0, Math.PI * 2);
    g.moveTo(px + 6 * s, fy0 + 42 * s); g.lineTo(px + 6 * s, fy0 + 53 * s);
    g.stroke();
  } else if (prop.type === 'clean_desk') {
    if (propPass === 'back_only') {
      // Subtle chair back behind seated character
      const chX = px - (prop.facing === 'left' ? -52 : 52) * s;
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#090d16';
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.roundRect(chX - 24 * s, floorY - 64 * s, 48 * s, 10 * s, 4 * s);
      g.roundRect(chX - 26 * s, floorY - 128 * s, 10 * s, 68 * s, 4 * s);
      g.fill();
      g.stroke();
      g.fillRect(chX - 4 * s, floorY - 54 * s, 8 * s, 54 * s);
      g.restore();
      return;
    }
    const dw = 195 * s, dh = 92 * s;
    const topY = floorY - dh;
    const lampOn = prop.lamp_off_at !== undefined ? ts < Number(prop.lamp_off_at) : (prop.lamp_on !== false);
    // Warm tidy desk legs & top
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#090d16';
    g.lineWidth = 2.6 * s;
    g.fillRect(px - dw * 0.44, topY, 10 * s, dh);
    g.fillRect(px + dw * 0.44 - 10 * s, topY, 10 * s, dh);
    g.fillStyle = '#334155';
    g.beginPath();
    g.roundRect(px - dw * 0.5, topY - 12 * s, dw, 14 * s, 5 * s);
    g.fill();
    g.stroke();
    // Neat notebook (open or closed)
    const nbOpen = prop.notebook_closed_at !== undefined ? ts < Number(prop.notebook_closed_at) : Boolean(prop.notebook_open);
    if (nbOpen) {
      g.fillStyle = '#f8fafc';
      g.strokeStyle = '#475569';
      g.lineWidth = 2 * s;
      g.beginPath();
      g.roundRect(px - 34 * s, topY - 20 * s, 56 * s, 9 * s, 2 * s);
      g.fill();
      g.stroke();
    } else {
      g.fillStyle = '#0284c7';
      g.strokeStyle = '#0f172a';
      g.lineWidth = 2 * s;
      g.beginPath();
      g.roundRect(px - 28 * s, topY - 21 * s, 44 * s, 10 * s, 2.5 * s);
      g.fill();
      g.stroke();
    }
    // Clear water glass
    g.fillStyle = 'rgba(186, 230, 253, 0.45)';
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 1.8 * s;
    g.beginPath();
    g.roundRect(px + 28 * s, topY - 30 * s, 13 * s, 18 * s, 2 * s);
    g.fill();
    g.stroke();
    // Warm balanced desk lamp on outer edge
    const lx = px - dw * 0.34;
    g.strokeStyle = '#64748b';
    g.lineWidth = 3.5 * s;
    g.beginPath();
    g.moveTo(lx - 10 * s, topY - 12 * s); g.lineTo(lx + 10 * s, topY - 12 * s);
    g.moveTo(lx, topY - 12 * s); g.lineTo(lx - 6 * s, topY - 52 * s); g.lineTo(lx + 12 * s, topY - 58 * s);
    g.stroke();
    if (lampOn) {
      drawSoftGlow(g, lx + 18 * s, topY - 38 * s, 115 * s, '#fbbf24', 0.34);
      const lg = g.createLinearGradient(lx + 12 * s, topY - 58 * s, lx + 35 * s, topY - 12 * s);
      lg.addColorStop(0, 'rgba(251, 191, 36, 0.34)');
      lg.addColorStop(1, 'rgba(251, 191, 36, 0.02)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(lx + 10 * s, topY - 56 * s);
      g.lineTo(lx + 62 * s, topY - 12 * s);
      g.lineTo(lx - 18 * s, topY - 12 * s);
      g.closePath();
      g.fill();
    }
  } else if (prop.type === 'messy_desk') {
    if (propPass === 'back_only') {
      const chX = px - (prop.facing === 'left' ? -52 : 52) * s;
      g.fillStyle = '#0f172a';
      g.strokeStyle = '#060912';
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.roundRect(chX - 24 * s, floorY - 64 * s, 48 * s, 10 * s, 4 * s);
      g.roundRect(chX - 26 * s, floorY - 126 * s, 10 * s, 66 * s, 4 * s);
      g.fill();
      g.stroke();
      g.fillRect(chX - 4 * s, floorY - 54 * s, 8 * s, 54 * s);
      g.restore();
      return;
    }
    const dw = 220 * s, dh = 92 * s;
    const topY = floorY - dh;
    g.fillStyle = '#0f172a';
    g.strokeStyle = '#060912';
    g.lineWidth = 2.6 * s;
    g.fillRect(px - dw * 0.45, topY, 10 * s, dh);
    g.fillRect(px + dw * 0.45 - 10 * s, topY, 10 * s, dh);
    g.fillStyle = '#1e293b';
    g.beginPath();
    g.roundRect(px - dw * 0.5, topY - 12 * s, dw, 14 * s, 4 * s);
    g.fill();
    g.stroke();
    // Stacked unfinished papers on both sides + fallen crumpled paper on floor
    for (let pi = 0; pi < 4; pi++) {
      g.fillStyle = pi % 2 === 0 ? '#cbd5e1' : '#94a3b8';
      g.fillRect(px - dw * 0.44 + pi * 3 * s, topY - (16 + pi * 4) * s, 32 * s, 3.5 * s);
      g.fillRect(px + dw * 0.24 - pi * 2 * s, topY - (16 + pi * 4) * s, 28 * s, 3.5 * s);
    }
    // Glowing open laptop
    const laptopCol = prop.accepted_at !== undefined && ts >= Number(prop.accepted_at) ? '#22c55e' : '#38bdf8';
    drawSoftGlow(g, px - 4 * s, topY - 34 * s, 72 * s, laptopCol, 0.28);
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3.2 * s;
    g.beginPath();
    g.moveTo(px - 28 * s, topY - 13 * s);
    g.lineTo(px + 12 * s, topY - 13 * s);
    g.lineTo(px + 22 * s, topY - 46 * s);
    g.stroke();
    // Empty coffee cups scattered across desk & floor!
    const cupXs = [-0.26, 0.14, 0.36, 0.44];
    for (let ci = 0; ci < cupXs.length; ci++) {
      const cx2 = px + dw * cupXs[ci];
      const cy2 = topY - 12 * s;
      g.fillStyle = ci % 2 === 0 ? '#e2e8f0' : '#fca5a5';
      g.strokeStyle = '#0f172a';
      g.lineWidth = 1.6 * s;
      g.beginPath();
      g.moveTo(cx2 - 5.5 * s, cy2 - 15 * s);
      g.lineTo(cx2 + 5.5 * s, cy2 - 15 * s);
      g.lineTo(cx2 + 4 * s, cy2);
      g.lineTo(cx2 - 4 * s, cy2);
      g.closePath();
      g.fill();
      g.stroke();
    }
    // Harsh overhead/gooseneck desk lamp cone
    const lx = px + dw * 0.32;
    g.strokeStyle = '#475569';
    g.lineWidth = 3.5 * s;
    g.beginPath();
    g.moveTo(lx, topY - 12 * s);
    g.lineTo(lx + 10 * s, topY - 68 * s);
    g.lineTo(lx - 14 * s, topY - 72 * s);
    g.stroke();
    const harshCol = prop.lamp_color || '#fef08a';
    const [hr, hg, hb] = hexToRgb(harshCol);
    const cone = g.createLinearGradient(lx - 14 * s, topY - 72 * s, px - 10 * s, topY - 12 * s);
    cone.addColorStop(0, `rgba(${hr},${hg},${hb},0.42)`);
    cone.addColorStop(1, `rgba(${hr},${hg},${hb},0.03)`);
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(lx - 14 * s, topY - 70 * s);
    g.lineTo(px - 68 * s, topY - 12 * s);
    g.lineTo(px + 48 * s, topY - 12 * s);
    g.closePath();
    g.fill();
  } else if (prop.type === 'wall_calendar') {
    const cw2 = 104 * s, ch2 = 88 * s;
    const cy2 = floorY - (prop.height_above_floor ?? 275) * s;
    g.fillStyle = '#f8fafc';
    g.strokeStyle = '#334155';
    g.lineWidth = 2.6 * s;
    g.beginPath();
    g.roundRect(px - cw2 * 0.5, cy2, cw2, ch2, 6 * s);
    g.fill();
    g.stroke();
    // Top header band
    g.fillStyle = prop.crossed_out ? '#dc2626' : '#0284c7';
    g.beginPath();
    g.roundRect(px - cw2 * 0.5, cy2, cw2, 20 * s, [6 * s, 6 * s, 0, 0]);
    g.fill();
    // 4x3 grid of days with either clean checkmarks or crossed-out red X's
    const cols = 4, rows = 3;
    const gx0 = px - cw2 * 0.40, gy0 = cy2 + 27 * s;
    const cellW = (cw2 * 0.80) / cols, cellH = (ch2 - 34 * s) / rows;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = gx0 + c * cellW, y0 = gy0 + r * cellH;
        g.strokeStyle = '#cbd5e1';
        g.lineWidth = 1.2 * s;
        g.strokeRect(x0, y0, cellW - 3 * s, cellH - 3 * s);
        if (prop.crossed_out && idx < prop.crossed_out) {
          g.strokeStyle = '#ef4444';
          g.lineWidth = 2.4 * s;
          g.beginPath();
          g.moveTo(x0 + 3 * s, y0 + 3 * s); g.lineTo(x0 + cellW - 6 * s, y0 + cellH - 6 * s);
          g.moveTo(x0 + cellW - 6 * s, y0 + 3 * s); g.lineTo(x0 + 3 * s, y0 + cellH - 6 * s);
          g.stroke();
        } else if (prop.clean_checks && idx < prop.clean_checks) {
          g.strokeStyle = '#0284c7';
          g.lineWidth = 2.2 * s;
          g.beginPath();
          g.moveTo(x0 + 3 * s, y0 + cellH * 0.5);
          g.lineTo(x0 + cellW * 0.42, y0 + cellH - 5 * s);
          g.lineTo(x0 + cellW - 5 * s, y0 + 4 * s);
          g.stroke();
        }
        idx++;
      }
    }
  } else if (prop.type === 'framed_certificate') {
    const cw2 = 108 * s, ch2 = 80 * s;
    const cy2 = floorY - (prop.height_above_floor ?? 285) * s;
    drawSoftGlow(g, px, cy2 + ch2 * 0.5, 85 * s, '#fbbf24', 0.22);
    g.fillStyle = '#fefce8';
    g.strokeStyle = '#b45309';
    g.lineWidth = 4 * s;
    g.beginPath();
    g.roundRect(px - cw2 * 0.5, cy2, cw2, ch2, 4 * s);
    g.fill();
    g.stroke();
    // Text lines + gold seal ribbon
    g.strokeStyle = '#64748b';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.moveTo(px - 34 * s, cy2 + 22 * s); g.lineTo(px + 34 * s, cy2 + 22 * s);
    g.moveTo(px - 26 * s, cy2 + 34 * s); g.lineTo(px + 26 * s, cy2 + 34 * s);
    g.moveTo(px - 22 * s, cy2 + 45 * s); g.lineTo(px + 10 * s, cy2 + 45 * s);
    g.stroke();
    g.fillStyle = '#eab308';
    g.beginPath();
    g.arc(px + 28 * s, cy2 + 54 * s, 10 * s, 0, Math.PI * 2);
    g.fill();
  } else if (prop.type === 'judge_table') {
    const tw = 340 * s, th = 92 * s;
    const topY = floorY - th;
    if (propPass === 'front_only') {
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#475569';
      g.lineWidth = 3 * s;
      g.beginPath();
      g.roundRect(px - tw * 0.5, topY, tw, th, 6 * s);
      g.fill();
      g.stroke();
      g.fillStyle = '#334155';
      g.fillRect(px - tw * 0.52, topY - 10 * s, tw * 1.04, 12 * s);
      g.restore();
      return;
    }
    // 3 seated silhouettes behind the panel desk
    for (let ji = -1; ji <= 1; ji++) {
      const jx = px + ji * 98 * s;
      g.fillStyle = ji === 0 ? '#64748b' : '#475569';
      g.strokeStyle = '#0f172a';
      g.lineWidth = 2.5 * s;
      // Shoulders + head
      g.beginPath();
      g.roundRect(jx - 26 * s, topY - 48 * s, 52 * s, 52 * s, 16 * s);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(jx, topY - 72 * s, 19 * s, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // Wide panel desk front
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.roundRect(px - tw * 0.5, topY, tw, th, 6 * s);
    g.fill();
    g.stroke();
    g.fillStyle = '#334155';
    g.fillRect(px - tw * 0.52, topY - 10 * s, tw * 1.04, 12 * s);
  } else if (prop.type === 'curtain_window') {
    const ww = 250 * s, wh = 230 * s;
    const wy = floorY - 335 * s;
    const openT0 = Number(prop.open_from_t ?? 2.5);
    const openT1 = Number(prop.open_to_t ?? 5.2);
    const openU = ease(clamp((ts - openT0) / Math.max(0.2, openT1 - openT0)));
    // Morning sky outside window
    const skyG = g.createLinearGradient(px, wy, px, wy + wh);
    skyG.addColorStop(0, '#38bdf8');
    skyG.addColorStop(0.6, '#fde68a');
    skyG.addColorStop(1, '#fbbf24');
    g.fillStyle = skyG;
    g.strokeStyle = '#475569';
    g.lineWidth = 4 * s;
    g.fillRect(px - ww * 0.5, wy, ww, wh);
    g.strokeRect(px - ww * 0.5, wy, ww, wh);
    // Warm golden sunlight beam pouring across the room as curtains open!
    if (openU > 0.03) {
      const sunBeam = g.createLinearGradient(px, wy + wh * 0.3, px, floorY + 20);
      sunBeam.addColorStop(0, `rgba(253, 224, 71, ${ca(0.34 * openU)})`);
      sunBeam.addColorStop(1, `rgba(251, 191, 36, ${ca(0.08 * openU)})`);
      g.fillStyle = sunBeam;
      g.beginPath();
      const gapHalf = (ww * 0.44) * openU;
      g.moveTo(px - gapHalf, wy);
      g.lineTo(px + gapHalf, wy);
      g.lineTo(px + gapHalf + 180 * s * openU, floorY);
      g.lineTo(px - gapHalf - 180 * s * openU, floorY);
      g.closePath();
      g.fill();
    }
    // Left & right heavy curtains parting smoothly
    const panelW = lerp(ww * 0.50, ww * 0.13, openU);
    g.fillStyle = '#1e293b';
    g.strokeStyle = '#0f172a';
    g.lineWidth = 2.5 * s;
    g.fillRect(px - ww * 0.5 - 4 * s, wy - 6 * s, panelW + 4 * s, wh + 18 * s);
    g.strokeRect(px - ww * 0.5 - 4 * s, wy - 6 * s, panelW + 4 * s, wh + 18 * s);
    g.fillRect(px + ww * 0.5 - panelW, wy - 6 * s, panelW + 4 * s, wh + 18 * s);
    g.strokeRect(px + ww * 0.5 - panelW, wy - 6 * s, panelW + 4 * s, wh + 18 * s);
  } else if (prop.type === 'park_tree') {
    const th = 225 * s;
    g.strokeStyle = '#451a03';
    g.lineWidth = 14 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(px, floorY);
    g.lineTo(px, floorY - th * 0.62);
    g.moveTo(px, floorY - th * 0.45);
    g.lineTo(px - 28 * s, floorY - th * 0.68);
    g.moveTo(px, floorY - th * 0.50);
    g.lineTo(px + 26 * s, floorY - th * 0.70);
    g.stroke();
    // Lush morning canopy circles
    g.fillStyle = prop.leaf_color || '#15803d';
    g.strokeStyle = '#052e16';
    g.lineWidth = 3 * s;
    for (const [ox, oy, rr] of [[0, -th * 0.80, 56], [-42, -th * 0.68, 44], [42, -th * 0.68, 44]]) {
      g.beginPath();
      g.arc(px + ox * s, floorY + oy, rr * s, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (prop.birds) {
      g.strokeStyle = '#1e293b';
      g.lineWidth = 2.4 * s;
      for (let bi = 0; bi < 3; bi++) {
        const bx2 = px - 90 * s + bi * 55 * s + Math.sin(t * 0.8 + bi) * 28 * s;
        const by2 = floorY - th - (45 + bi * 22) * s + Math.cos(t * 1.4 + bi) * 8 * s;
        const flap = Math.sin(t * 7.5 + bi * 1.9) * 5 * s;
        g.beginPath();
        g.moveTo(bx2 - 9 * s, by2 + flap);
        g.quadraticCurveTo(bx2 - 4 * s, by2 - 5 * s, bx2, by2);
        g.quadraticCurveTo(bx2 + 4 * s, by2 - 5 * s, bx2 + 9 * s, by2 + flap);
        g.stroke();
      }
    }
  }
  g.restore();
}

/**
 * Render an in-world glass screen / presentation board right inside the scene environment
 * so multiple characters can point at and discuss visual proof without cutting to a black screen!
 */
function drawWorldBoard(g, board, ts, dur, W, floorY, sceneAccent = '#38bdf8') {
  if (!board || !board.type) return;
  const revealAt = Number(board.reveal_at ?? board.appear_at ?? board.start_at ?? 0.35);
  const buildDur = Math.max(0.6, Number(board.build_dur ?? 2.6));
  const rawHide = board.hide_at ?? board.disappear_at ?? board.end_at;

  // Smart auto-hide guard: if no explicit `hide_at` / `hold_sec` is set and `persist` is not true,
  // automatically fade out after a clean reading window (`buildDur + 4.2s`) on longer scenes so boards never overstay!
  let hideAt = null;
  if (rawHide !== undefined && rawHide !== null) {
    hideAt = Number(rawHide);
  } else if (board.hold_sec !== undefined) {
    hideAt = revealAt + Number(board.hold_sec);
  } else if (!board.persist && dur > revealAt + buildDur + 5.8) {
    hideAt = Math.min(dur - 0.35, revealAt + Math.max(5.4, buildDur + 4.0));
  }

  if (ts < revealAt) return;
  if (hideAt !== null && ts > hideAt) return;

  const enterU = eo(clamp((ts - revealAt) / 0.38));
  const exitU = hideAt !== null ? ease(clamp((hideAt - ts) / 0.42)) : 1.0;
  const boardVis = enterU * exitU;
  if (boardVis <= 0.01) return;

  // Safe-zone viewport clamping (supports BOTH normalized 0..1 fractions AND pixel dimensions for x, y, w, h!)
  const rawW = board.w !== undefined ? (board.w <= 1.5 ? board.w * W : Number(board.w)) : 760;
  const rawH = board.h !== undefined ? (board.h <= 1.5 ? board.h * 1080 : Number(board.h)) : 410;
  const rawX = board.x !== undefined ? (board.x <= 1.5 ? board.x * W : Number(board.x)) : 0.54 * W;
  const rawY = board.y !== undefined ? (board.y <= 1.5 ? board.y * 1080 : Number(board.y)) : 120;
  const bw = Math.min(Math.max(240, rawW), W - 96);
  const bh = Math.min(Math.max(160, rawH), floorY - 125);
  const bx = clamp(rawX, 48, W - bw - 48);
  const baseBy = clamp(rawY, 74, Math.max(74, floorY - bh - 34));
  const by = baseBy + (1 - enterU) * 16 - (1 - exitU) * 10;
  const accent = board.accent || sceneAccent;
  const u = ease(clamp((ts - (revealAt + 0.10)) / buildDur));

  // Special handmade paper insert: child's crayon/pencil drawing ("FOR THE PEOPLE WHO HELP.")
  if (board.type === 'child_drawing') {
    g.save();
    g.globalAlpha = boardVis;
    drawSoftGlow(g, bx + bw * 0.5, by + bh * 0.5, Math.max(bw, bh) * 0.65, '#fbbf24', 0.22 * boardVis);
    g.translate(bx + bw * 0.5, by + bh * 0.5);
    g.rotate(-0.022);
    // Warm off-white folded paper sheet
    g.fillStyle = '#faf5eb';
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 10);
    g.fill();
    g.stroke();
    // Subtle horizontal & vertical fold crease lines
    g.strokeStyle = 'rgba(148, 163, 184, 0.38)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(0, -bh * 0.48); g.lineTo(0, bh * 0.48);
    g.moveTo(-bw * 0.48, 0); g.lineTo(bw * 0.48, 0);
    g.stroke();

    const groundY = bh * 0.22;
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-bw * 0.38, groundY);
    g.lineTo(bw * 0.38, groundY);
    g.stroke();

    // Crayon rain dashes at top
    g.strokeStyle = 'rgba(96, 165, 250, 0.55)';
    g.lineWidth = 2.4;
    for (let ri = -5; ri <= 5; ri++) {
      const rx = ri * 52;
      const ry = -bh * 0.36 + (Math.abs(ri * 17) % 28);
      g.beginPath();
      g.moveTo(rx, ry); g.lineTo(rx - 5, ry + 14);
      g.stroke();
    }

    const shiftLeft = board.include_white ? -68 : 0;
    // 1. Blue stickman (Sam) holding red umbrella over Yellow stickman (Lily)
    const samX = -38 + shiftLeft;
    const lilyX = 32 + shiftLeft;
    // Red crayon umbrella canopy
    const umbX = 2 + shiftLeft;
    const umbY = groundY - 148;
    g.fillStyle = '#ef4444';
    g.strokeStyle = '#991b1b';
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(umbX, umbY, 74, Math.PI, 0, false);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#475569';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(umbX, umbY); g.lineTo(umbX - 8, groundY - 68);
    g.stroke();

    // Blue stickman (Sam)
    g.strokeStyle = '#3b82f6';
    g.lineWidth = 6.5;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(samX, groundY - 108, 17, 0, Math.PI * 2);
    g.moveTo(samX, groundY - 90); g.lineTo(samX, groundY - 40);
    g.moveTo(samX, groundY - 40); g.lineTo(samX - 14, groundY);
    g.moveTo(samX, groundY - 40); g.lineTo(samX + 12, groundY);
    g.moveTo(samX, groundY - 78); g.lineTo(umbX - 8, groundY - 68);
    g.moveTo(samX, groundY - 78); g.lineTo(samX - 18, groundY - 52);
    g.stroke();

    // Little Yellow stickman (Lily) + yellow bag
    g.strokeStyle = '#eab308';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(lilyX, groundY - 74, 13, 0, Math.PI * 2);
    g.moveTo(lilyX, groundY - 60); g.lineTo(lilyX, groundY - 26);
    g.moveTo(lilyX, groundY - 26); g.lineTo(lilyX - 10, groundY);
    g.moveTo(lilyX, groundY - 26); g.lineTo(lilyX + 10, groundY);
    g.moveTo(lilyX, groundY - 50); g.lineTo(lilyX - 14, groundY - 36);
    g.moveTo(lilyX, groundY - 50); g.lineTo(lilyX + 14, groundY - 36);
    g.stroke();

    // 2. Optional White stickman (Eli) holding black umbrella beside them (Scene 7!)
    if (board.include_white) {
      const eliX = 118;
      const bUmbY = groundY - 142;
      g.fillStyle = '#1e293b';
      g.strokeStyle = '#0f172a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(eliX - 6, bUmbY, 62, Math.PI, 0, false);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = '#334155';
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(eliX - 6, bUmbY); g.lineTo(eliX - 6, groundY - 66);
      g.stroke();

      // White stickman outlined in dark charcoal crayon so he pops on cream paper
      g.strokeStyle = '#334155';
      g.fillStyle = '#ffffff';
      g.lineWidth = 5.5;
      g.beginPath();
      g.arc(eliX, groundY - 104, 16, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(eliX, groundY - 87); g.lineTo(eliX, groundY - 38);
      g.moveTo(eliX, groundY - 38); g.lineTo(eliX - 12, groundY);
      g.moveTo(eliX, groundY - 38); g.lineTo(eliX + 13, groundY);
      g.moveTo(eliX, groundY - 74); g.lineTo(eliX - 6, groundY - 66);
      g.moveTo(eliX, groundY - 74); g.lineTo(eliX + 18, groundY - 50);
      g.stroke();
    }

    // Uneven child handwriting caption underneath
    if (board.caption) {
      const words = String(board.caption).split(' ');
      g.font = 'bold 24px PopB';
      g.fillStyle = '#1e293b';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const fullW = g.measureText(board.caption).width;
      let cx = -fullW * 0.5;
      words.forEach((w, wi) => {
        const ww = g.measureText(w).width;
        const sw2 = g.measureText(' ').width;
        g.save();
        g.translate(cx + ww * 0.5, groundY + 46 + (wi % 2 === 0 ? -2.5 : 3.0));
        g.rotate(wi % 2 === 0 ? -0.035 : 0.04);
        g.fillText(w, 0, 0);
        g.restore();
        cx += ww + sw2;
      });
    }
    g.restore();
    return;
  }

  // Bespoke smartphone notification / chat screen ("Football this evening?", "We saved you a seat.", etc.)
  if (board.type === 'phone_card') {
    g.save();
    g.globalAlpha = boardVis;
    drawSoftGlow(g, bx + bw * 0.5, by + bh * 0.5, Math.max(bw, bh) * 0.62, accent, 0.24 * boardVis);
    g.fillStyle = 'rgba(10, 16, 30, 0.96)';
    g.strokeStyle = accent;
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 24);
    g.fill();
    g.stroke();
    g.fillStyle = '#334155';
    g.beginPath();
    g.roundRect(bx + bw * 0.5 - 38, by + 10, 76, 6, 3);
    g.fill();
    g.font = 'bold 17px PopB';
    g.fillStyle = '#94a3b8';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(board.sender || 'MESSAGE'), bx + bw * 0.5, by + 36);
    g.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(bx + 20, by + 54);
    g.lineTo(bx + bw - 20, by + 54);
    g.stroke();

    let curY = by + 72;
    if (board.call_declined) {
      g.fillStyle = 'rgba(239, 68, 68, 0.18)';
      g.strokeStyle = '#ef4444';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(bx + 24, curY, bw - 48, 38, 12);
      g.fill();
      g.stroke();
      g.font = 'bold 15px PopB';
      g.fillStyle = '#fca5a5';
      g.textAlign = 'center';
      g.fillText(`✕  CALL DECLINED • ${board.call_declined}`, bx + bw * 0.5, curY + 19);
      curY += 50;
    }

    if (board.accepted_badge) {
      g.fillStyle = 'rgba(34, 197, 94, 0.18)';
      g.strokeStyle = '#22c55e';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(bx + 24, curY, bw - 48, 40, 12);
      g.fill();
      g.stroke();
      g.font = 'bold 15px PopB';
      g.fillStyle = '#86efac';
      g.textAlign = 'center';
      g.fillText(`✓  ${board.accepted_badge}`, bx + bw * 0.5, curY + 20);
      curY += 52;
    }

    if (board.family_empty_seat) {
      const phW = bw - 56, phH = 128;
      const phX = bx + 28;
      g.fillStyle = '#291d12';
      g.strokeStyle = '#f59e0b';
      g.lineWidth = 2.2;
      g.beginPath();
      g.roundRect(phX, curY, phW, phH, 12);
      g.fill();
      g.stroke();
      drawSoftGlow(g, phX + phW * 0.5, curY + 28, 80, '#fbbf24', 0.40 * boardVis);
      const tableY = curY + 94;
      const emptyX = phX + phW * 0.74;
      g.strokeStyle = '#fde047';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(emptyX - 14, tableY + 22); g.lineTo(emptyX - 14, tableY - 26);
      g.moveTo(emptyX - 14, tableY - 2); g.lineTo(emptyX + 14, tableY - 2);
      g.lineTo(emptyX + 14, tableY + 22);
      g.stroke();
      for (const [ox, col] of [[0.28, '#fb923c'], [0.48, '#fbbf24']]) {
        const fx2 = phX + phW * ox;
        g.strokeStyle = col;
        g.lineWidth = 3.5;
        g.beginPath();
        g.arc(fx2, tableY - 30, 11, 0, Math.PI * 2);
        g.moveTo(fx2, tableY - 19); g.lineTo(fx2, tableY);
        g.stroke();
      }
      g.fillStyle = '#78350f';
      g.fillRect(phX + phW * 0.16, tableY, phW * 0.68, 9);
      curY += phH + 14;
    }

    if (board.incoming) {
      const incLines = Array.isArray(board.incoming) ? board.incoming : [String(board.incoming)];
      const bubH = 26 + incLines.length * 25;
      g.fillStyle = '#1e293b';
      g.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(bx + 24, curY, bw - 68, bubH, [16, 16, 16, 4]);
      g.fill();
      g.stroke();
      g.font = '18px PopR';
      g.fillStyle = '#f8fafc';
      g.textAlign = 'left';
      incLines.forEach((ln, idx) => {
        g.fillText(ln, bx + 40, curY + 24 + idx * 25);
      });
      curY += bubH + 14;
    }

    if (board.reply && u > 0.32) {
      const ru = eo(K(u, 0.32, 0.72));
      g.save();
      g.globalAlpha = boardVis * ru;
      const repLines = Array.isArray(board.reply) ? board.reply : [String(board.reply)];
      const bubH = 26 + repLines.length * 25;
      const [ar, ag, ab] = hexToRgb(accent);
      g.fillStyle = `rgba(${ar},${ag},${ab},0.26)`;
      g.strokeStyle = accent;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(bx + 68, curY, bw - 92, bubH, [16, 16, 4, 16]);
      g.fill();
      g.stroke();
      g.font = 'bold 18px PopB';
      g.fillStyle = '#ffffff';
      g.textAlign = 'left';
      repLines.forEach((ln, idx) => {
        g.fillText(ln, bx + 84, curY + 24 + idx * 25);
      });
      g.restore();
    } else if (board.typing_deleted && u > 0.25) {
      const draft = u < 0.65 ? "I'm really..." : (u < 0.82 ? "I'm..." : '');
      g.fillStyle = 'rgba(30, 41, 59, 0.78)';
      g.strokeStyle = '#475569';
      g.lineWidth = 1.5;
      g.beginPath();
      g.roundRect(bx + 24, by + bh - 54, bw - 48, 36, 18);
      g.fill();
      g.stroke();
      g.font = '16px PopR';
      g.fillStyle = draft ? '#e2e8f0' : '#64748b';
      g.textAlign = 'left';
      g.fillText(draft || 'Message deleted', bx + 42, by + bh - 36);
    }

    g.restore();
    return { centerX: bx + bw * 0.5, centerY: by + bh * 0.5, leftX: bx, rightX: bx + bw };
  }

  // Bespoke open notebook page with Marcus's rule underlined three times!
  if (board.type === 'obsessive_rule_card') {
    g.save();
    g.globalAlpha = boardVis;
    drawSoftGlow(g, bx + bw * 0.5, by + bh * 0.5, Math.max(bw, bh) * 0.58, '#ef4444', 0.22 * boardVis);
    g.fillStyle = '#f8fafc';
    g.strokeStyle = '#475569';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 12);
    g.fill();
    g.stroke();
    g.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    g.lineWidth = 1.4;
    for (let ly = by + 56; ly < by + bh - 24; ly += 38) {
      g.beginPath(); g.moveTo(bx + 20, ly); g.lineTo(bx + bw - 20, ly); g.stroke();
    }
    g.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(bx + 54, by + 14); g.lineTo(bx + 54, by + bh - 14); g.stroke();

    const textStr = board.text || 'NO EXCUSES. NO WEAKNESS. NO DAYS OFF.';
    g.font = 'bold 24px PopB';
    g.fillStyle = '#0f172a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const midX = bx + bw * 0.5 + 14;
    const midY = by + bh * 0.44;
    g.fillText(textStr, midX, midY);
    const tw = Math.min(bw - 105, g.measureText(textStr).width);

    for (let ui = 0; ui < 3; ui++) {
      const uu = ease(K(u, 0.22 + ui * 0.22, 0.44 + ui * 0.22));
      if (uu > 0.01) {
        g.strokeStyle = '#dc2626';
        g.lineWidth = 3.8;
        g.lineCap = 'round';
        const uy = midY + 22 + ui * 9;
        g.beginPath();
        g.moveTo(midX - tw * 0.5, uy);
        g.lineTo(midX - tw * 0.5 + tw * uu, uy + (ui === 1 ? -1.5 : 1.0));
        g.stroke();
      }
    }
    g.restore();
    return { centerX: bx + bw * 0.5, centerY: by + bh * 0.5, leftX: bx, rightX: bx + bw };
  }

  // Bespoke old family photograph + turned-over handwritten note from Mum (Scene 7!)
  if (board.type === 'photo_back_card') {
    g.save();
    g.globalAlpha = boardVis;
    drawSoftGlow(g, bx + bw * 0.5, by + bh * 0.5, Math.max(bw, bh) * 0.65, '#fbbf24', 0.28 * boardVis);
    const pW = bw * 0.40, pH = bh * 0.88;
    const pX = bx + 12, pY = by + bh * 0.06;
    g.save();
    g.translate(pX + pW * 0.5, pY + pH * 0.5);
    g.rotate(-0.04);
    g.fillStyle = '#fef3c7';
    g.strokeStyle = '#d97706';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(-pW * 0.5, -pH * 0.5, pW, pH, 8);
    g.fill();
    g.stroke();
    g.fillStyle = '#1e293b';
    g.fillRect(-pW * 0.5 + 12, -pH * 0.5 + 12, pW - 24, pH - 44);
    const gy = pH * 0.22;
    for (const [ox, col, sc2] of [[-54, '#fbbf24', 1.0], [0, '#f8fafc', 0.78], [54, '#fb923c', 0.96]]) {
      g.strokeStyle = col;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(ox, gy - 72 * sc2, 14 * sc2, 0, Math.PI * 2);
      g.moveTo(ox, gy - 58 * sc2); g.lineTo(ox, gy - 20 * sc2);
      g.moveTo(ox - 16 * sc2, gy - 44 * sc2); g.lineTo(ox + 16 * sc2, gy - 44 * sc2);
      g.moveTo(ox, gy - 20 * sc2); g.lineTo(ox - 10 * sc2, gy);
      g.moveTo(ox, gy - 20 * sc2); g.lineTo(ox + 10 * sc2, gy);
      g.stroke();
    }
    g.restore();

    const nW = bw * 0.56, nH = bh * 0.86;
    const nX = bx + bw * 0.42, nY = by + bh * 0.08;
    const flipU = eo(K(u, 0.18, 0.65));
    if (flipU > 0.02) {
      g.save();
      g.globalAlpha = boardVis * flipU;
      g.translate(nX + nW * 0.5, nY + nH * 0.5);
      g.rotate(0.022);
      g.fillStyle = '#faf5eb';
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(-nW * 0.5, -nH * 0.5, nW, nH, 8);
      g.fill();
      g.stroke();
      g.font = 'bold 20px PopB';
      g.fillStyle = '#78350f';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const noteLines = board.lines || [
        '"Whatever you become,',
        'we hope you remember',
        'to be happy."',
      ];
      noteLines.forEach((ln, idx) => {
        g.fillText(ln, 0, -34 + idx * 32);
      });
      g.font = '17px PopR';
      g.fillStyle = '#b45309';
      g.fillText('— Mum', nW * 0.24, 72);
      g.restore();
    }
    g.restore();
    return { centerX: bx + bw * 0.5, centerY: by + bh * 0.5, leftX: bx, rightX: bx + bw };
  }

  g.save();
  g.globalAlpha = boardVis;
  // Subtle ambient screen glow on the wall behind the board
  drawSoftGlow(g, bx + bw * 0.5, by + bh * 0.5, Math.max(bw, bh) * 0.65, accent, 0.16 * boardVis);

  // Crisp dark glass panel with colored frame
  g.fillStyle = 'rgba(7, 13, 26, 0.880)';
  const [ar, ag, ab] = hexToRgb(accent);
  g.strokeStyle = `rgba(${ar},${ag},${ab},0.680)`;
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(bx, by, bw, bh, 16);
  g.fill();
  g.stroke();

  // Top header bar
  if (board.title) {
    g.fillStyle = `rgba(${ar},${ag},${ab},0.140)`;
    g.beginPath();
    g.roundRect(bx + 2, by + 2, bw - 4, 52, [14, 14, 0, 0]);
    g.fill();
    g.font = 'bold 22px PopB';
    g.fillStyle = accent;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(board.title.toUpperCase(), bx + 26, by + 28);
  }

  const padX = 44;
  const contentTop = by + (board.title ? 74 : 36);
  const cw = bw - padX * 2;
  const ch = bh - (contentTop - by) - 42;
  const cx0 = bx + padX;
  const cy0 = contentTop;

  if (board.type === 'line_graph') {
    const plotTop = cy0 + 28;
    const plotH = ch - 28;
    // Axes
    g.strokeStyle = 'rgba(203,213,225,0.35)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx0, plotTop);
    g.lineTo(cx0, plotTop + plotH);
    g.lineTo(cx0 + cw, plotTop + plotH);
    g.stroke();

    const series = board.series || [
      { label: 'SHORT-TERM SPIKE', color: '#fb7185', points: [0.15, 0.78, 0.35, 0.18, 0.10] },
      { label: 'COMPOUNDING SYSTEM', color: accent, points: [0.12, 0.16, 0.28, 0.56, 0.92] },
    ];

    // Non-overlapping horizontal legend strip above plot area
    let lxCursor = cx0 + cw;
    for (let sIdx = series.length - 1; sIdx >= 0; sIdx--) {
      const sItem = series[sIdx];
      const lbl = (sItem.label || '').toUpperCase();
      if (!lbl) continue;
      g.font = 'bold 15px PopB';
      g.fillStyle = sItem.color || accent;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(lbl, lxCursor, cy0 + 8);
      const tw = g.measureText(lbl).width;
      g.beginPath();
      g.arc(lxCursor - tw - 10, cy0 + 8, 5, 0, Math.PI * 2);
      g.fill();
      lxCursor -= tw + 34;
    }

    series.forEach((sItem, sIdx) => {
      const pts = sItem.points || [0.1, 0.5, 0.9];
      const steps = 64;
      const maxS = Math.max(1, Math.round(steps * u));
      g.strokeStyle = sItem.color || accent;
      g.lineWidth = sIdx === series.length - 1 ? 5.5 : 4;
      if (sItem.dashed) g.setLineDash([10, 8]);
      g.lineCap = 'round';
      g.beginPath();
      let lastX = cx0, lastY = plotTop + plotH;
      for (let i = 0; i <= maxS; i++) {
        const p = i / steps;
        const scaled = p * (pts.length - 1);
        const idx = Math.min(pts.length - 2, Math.floor(scaled));
        const frac = ease(scaled - idx);
        const val = lerp(pts[idx], pts[idx + 1], frac);
        const x = cx0 + p * cw;
        const y = plotTop + plotH - clamp(val, 0.04, 0.94) * plotH;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
        lastX = x;
        lastY = y;
      }
      g.stroke();
      g.setLineDash([]);

      g.fillStyle = sItem.color || accent;
      g.beginPath();
      g.arc(lastX, lastY, 6, 0, Math.PI * 2);
      g.fill();
    });
  } else if (board.type === 'flow_chain') {
    const rawNodes = Array.isArray(board.nodes) ? board.nodes : null;
    const steps = rawNodes
      ? rawNodes.map((nd) => (typeof nd === 'string' ? nd : nd.title || nd.label || ''))
      : (board.steps || ['STEP 1', 'STEP 2', 'STEP 3', 'STEP 4']);
    const cols = rawNodes
      ? rawNodes.map((nd, idx) => (nd && nd.color) || ['#38bdf8', '#a78bfa', '#34d399', '#fb7185'][idx % 4])
      : (board.colors || ['#94a3b8', '#fb7185', '#38bdf8', '#34d399']);
    const n = steps.length;
    const gap = 30;
    const boxW = Math.min(192, (cw - (n - 1) * gap) / n);
    const boxH = 96;
    const midY = cy0 + ch * 0.5;
    const totalSpan = n * boxW + (n - 1) * gap;
    const startX = cx0 + (cw - totalSpan) * 0.5;

    for (let i = 0; i < n; i++) {
      const su = eo(K(u, i * (0.7 / n), i * (0.7 / n) + 0.3));
      if (su <= 0.01) continue;
      const x = startX + i * (boxW + gap);
      const col = cols[i % cols.length];
      g.save();
      g.globalAlpha = boardVis * su;
      g.fillStyle = '#0f172a';
      g.strokeStyle = col;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x, midY - boxH * 0.5, boxW, boxH, 12);
      g.fill();
      g.stroke();

      const label = String(steps[i] || '');
      g.font = 'bold 17px PopB';
      g.fillStyle = col;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const maxTextW = boxW - 22;
      if (g.measureText(label).width <= maxTextW || !label.includes(' ')) {
        g.fillText(label, x + boxW * 0.5, midY, maxTextW);
      } else {
        const parts = label.split(' ');
        const half = Math.ceil(parts.length / 2);
        const l1 = parts.slice(0, half).join(' ');
        const l2 = parts.slice(half).join(' ');
        g.fillText(l1, x + boxW * 0.5, midY - 11, maxTextW);
        g.fillText(l2, x + boxW * 0.5, midY + 13, maxTextW);
      }

      if (i < n - 1) {
        g.strokeStyle = 'rgba(203,213,225,0.6)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x + boxW + 5, midY);
        g.lineTo(x + boxW + gap - 5, midY);
        g.lineTo(x + boxW + gap - 12, midY - 6);
        g.moveTo(x + boxW + gap - 5, midY);
        g.lineTo(x + boxW + gap - 12, midY + 6);
        g.stroke();
      }
      g.restore();
    }
  } else if (board.type === 'bar_chart') {
    const bars = board.bars || [
      { label: 'REACTIVE MULTITASKING', value: 0.24, color: '#fb7185' },
      { label: 'PASSIVE CONSUMPTION', value: 0.14, color: '#94a3b8' },
      { label: 'DELIBERATE PRACTICE', value: 0.92, color: accent },
    ];
    const rowH = ch / bars.length;
    bars.forEach((b, i) => {
      const bu = b.at !== undefined
        ? eo(clamp((ts - Number(b.at)) / 0.75))
        : eo(K(u, i * 0.22, i * 0.22 + 0.55));
      const ry = cy0 + i * rowH + 6;
      g.font = 'bold 17px PopB';
      g.fillStyle = '#e2e8f0';
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(b.label, cx0, ry);

      const trackY = ry + 26;
      const maxBarW = cw - 85;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.roundRect(cx0, trackY, maxBarW, 24, 6);
      g.fill();

      const normVal = Number(b.value) > 1.0 ? Number(b.value) / 100.0 : Number(b.value || 0);
      const fillW = Math.max(6, maxBarW * clamp(normVal) * bu);
      g.fillStyle = b.color || accent;
      g.beginPath();
      g.roundRect(cx0, trackY, fillW, 24, 6);
      g.fill();

      g.font = 'bold 20px PopB';
      g.fillStyle = b.color || accent;
      g.textBaseline = 'middle';
      g.fillText(b.text || b.display || `${Math.round(normVal * 100 * bu)}%`, cx0 + fillW + 12, trackY + 12);
    });
  } else if (board.type === 'cycle_loop') {
    const nodes = board.nodes || ['1. TRIGGER', '2. ACTION', '3. REWARD', '4. IDENTITY'];
    const cols = board.colors || ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24'];
    const mx = cx0 + cw * 0.5;
    const my = cy0 + ch * 0.5;
    const rx = cw * 0.33;
    const ry = ch * 0.34;
    g.strokeStyle = 'rgba(148,163,184,0.25)';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
    g.stroke();

    g.strokeStyle = accent;
    g.beginPath();
    g.ellipse(mx, my, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u);
    g.stroke();

    const angs = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (let i = 0; i < 4; i++) {
      const nx = mx + Math.cos(angs[i]) * rx;
      const ny = my + Math.sin(angs[i]) * ry;
      const col = cols[i % cols.length];
      g.fillStyle = '#0b1324';
      g.strokeStyle = col;
      g.lineWidth = 2.8;
      g.beginPath();
      g.roundRect(nx - 88, ny - 24, 176, 48, 10);
      g.fill();
      g.stroke();
      g.font = 'bold 16px PopB';
      g.fillStyle = col;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(nodes[i] || '', nx, ny);
    }
  } else if (board.type === 'iceberg') {
    const waterY = cy0 + ch * 0.36;
    const mx = cx0 + cw * 0.36;
    g.strokeStyle = '#38bdf8';
    g.setLineDash([10, 6]);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx0, waterY);
    g.lineTo(cx0 + cw, waterY);
    g.stroke();
    g.setLineDash([]);

    // Visible tip
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.moveTo(mx - 65, waterY);
    g.lineTo(mx - 15, cy0 + 14);
    g.lineTo(mx + 28, cy0 + 26);
    g.lineTo(mx + 70, waterY);
    g.closePath();
    g.fill();
    g.font = 'bold 18px PopB';
    g.fillStyle = '#f8fafc';
    g.textAlign = 'left';
    g.fillText(board.top_label || board.above || 'VISIBLE OUTCOME (10%)', mx + 95, waterY - 28);

    // Submerged foundation
    if (u > 0.25) {
      const bu = ease(K(u, 0.25, 0.85));
      g.save();
      g.globalAlpha = boardVis * bu;
      const [r, gr, b] = hexToRgb(accent);
      g.fillStyle = `rgba(${r},${gr},${b},0.35)`;
      g.strokeStyle = accent;
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(mx - 72, waterY + 4);
      g.lineTo(mx - 135, waterY + ch * 0.32);
      g.lineTo(mx - 45, cy0 + ch - 8);
      g.lineTo(mx + 62, cy0 + ch - 12);
      g.lineTo(mx + 138, waterY + ch * 0.28);
      g.lineTo(mx + 74, waterY + 4);
      g.closePath();
      g.fill();
      g.stroke();

      const items = board.bottom_items || board.below || ['DAILY ENVIRONMENT', 'SLEEP & ENERGY', 'UNSEEN REPETITIONS'];
      g.font = 'bold 17px PopB';
      g.fillStyle = accent;
      items.forEach((it, idx) => {
        g.fillText(`• ${it}`, mx + 155, waterY + 42 + idx * 38);
      });
      g.restore();
    }
  } else if (board.type === 'checklist_card') {
    const items = board.items || [
      '1. Remove starting friction',
      '2. Protect one deep focus block',
      '3. Track inputs, not mood',
    ];
    const rowH = ch / Math.max(1, items.length);
    const itemAts = Array.isArray(board.item_ats) ? board.item_ats : null;
    items.forEach((txt, i) => {
      const iu = itemAts && itemAts[i] !== null && itemAts[i] !== undefined
        ? eo(clamp((ts - Number(itemAts[i])) / 0.55))
        : eo(K(u, i * 0.22, i * 0.22 + 0.4));
      if (iu <= 0.01) return;
      const ry = cy0 + i * rowH + rowH * 0.5;
      g.save();
      g.globalAlpha = boardVis * iu;
      g.fillStyle = accent;
      g.beginPath();
      g.arc(cx0 + 16, ry, 14, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#090d16';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx0 + 10, ry);
      g.lineTo(cx0 + 15, ry + 5);
      g.lineTo(cx0 + 23, ry - 5);
      g.stroke();

      g.font = 'bold 21px PopB';
      g.fillStyle = '#f1f5f9';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(txt, cx0 + 44, ry);
      g.restore();
    });
  } else if (board.type === 'notebook_page' || board.type === 'sketch_card') {
    // Paper / architectural sketch card inside the scene
    g.save();
    g.fillStyle = '#f5f2eb';
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(cx0 - 8, cy0 - 6, cw + 16, ch + 14, 8);
    g.fill();
    g.stroke();

    // Subtle ruled paper lines
    g.strokeStyle = 'rgba(148,163,184,0.28)';
    g.lineWidth = 1;
    for (let ly = cy0 + 28; ly < cy0 + ch; ly += 32) {
      g.beginPath();
      g.moveTo(cx0 + 12, ly);
      g.lineTo(cx0 + cw - 12, ly);
      g.stroke();
    }

    const sketchKind = board.sketch || 'none';
    const textLeft = sketchKind !== 'none' ? cx0 + cw * 0.44 : cx0 + 22;

    if (sketchKind === 'window_desk' || sketchKind === 'streetlamp_window') {
      const sx = cx0 + 24, sy = cy0 + 18, sw = cw * 0.34, sh = ch - 36;
      const drawU = eo(clamp(u * 1.25));
      g.save();
      g.globalAlpha = drawU;
      g.strokeStyle = '#1e293b';
      g.lineWidth = 2.4;
      // Hand-drawn window frame
      g.strokeRect(sx, sy, sw, sh * 0.68);
      g.beginPath();
      g.moveTo(sx + sw * 0.5, sy); g.lineTo(sx + sw * 0.5, sy + sh * 0.68);
      g.moveTo(sx, sy + sh * 0.36); g.lineTo(sx + sw, sy + sh * 0.36);
      g.stroke();
      if (sketchKind === 'window_desk') {
        // Drafting desk silhouette beside window
        g.strokeRect(sx + sw * 0.20, sy + sh * 0.72, sw * 0.65, 8);
        g.beginPath();
        g.moveTo(sx + sw * 0.25, sy + sh * 0.72 + 8); g.lineTo(sx + sw * 0.25, sy + sh * 0.96);
        g.moveTo(sx + sw * 0.80, sy + sh * 0.72 + 8); g.lineTo(sx + sw * 0.80, sy + sh * 0.96);
        g.stroke();
      } else {
        // Streetlamp & sycamore tree outside window
        g.beginPath();
        g.moveTo(sx + sw * 0.28, sy + sh * 0.66); g.lineTo(sx + sw * 0.28, sy + sh * 0.18);
        g.arc(sx + sw * 0.72, sy + sh * 0.38, 22, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    } else if (sketchKind === 'pocket_watch_back' || sketchKind === 'envelope_bill') {
      const sx = cx0 + 24, sy = cy0 + 18, sw = cw * 0.34, sh = ch - 36;
      const drawU = eo(clamp(u * 1.25));
      g.save();
      g.globalAlpha = drawU;
      if (sketchKind === 'pocket_watch_back') {
        const cxW = sx + sw * 0.5, cyW = sy + sh * 0.54, rW = Math.min(sw, sh) * 0.38;
        g.strokeStyle = '#334155';
        g.fillStyle = '#e2e8f0';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(cxW, cyW - rW - 14, 14, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(cxW, cyW, rW, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(cxW, cyW, rW * 0.84, 0, Math.PI * 2);
        g.stroke();
        g.font = 'bold 14px PopB';
        g.fillStyle = '#1e293b';
        g.textAlign = 'center';
        g.fillText('#7741', cxW, cyW - 8);
        g.font = '13px PopR';
        g.fillText('FOR ELENA', cxW, cyW + 14);
      } else {
        // Envelope + crisp $20 bill illustration
        g.fillStyle = '#ffffff';
        g.strokeStyle = '#334155';
        g.lineWidth = 2.4;
        g.strokeRect(sx + 8, sy + 24, sw - 16, sh * 0.46);
        g.beginPath();
        g.moveTo(sx + 8, sy + 24);
        g.lineTo(sx + sw * 0.5, sy + 24 + sh * 0.24);
        g.lineTo(sx + sw - 8, sy + 24);
        g.stroke();
        g.fillStyle = '#dcfce7';
        g.strokeStyle = '#166534';
        g.fillRect(sx + 22, sy + sh * 0.56, sw - 44, sh * 0.30);
        g.strokeRect(sx + 22, sy + sh * 0.56, sw - 44, sh * 0.30);
        g.font = 'bold 20px PopB';
        g.fillStyle = '#166534';
        g.textAlign = 'center';
        g.fillText('$20', sx + sw * 0.5, sy + sh * 0.72);
      }
      g.restore();
    }

    const lines = board.lines || board.items || [];
    lines.forEach((ln, idx) => {
      const lu = eo(K(u, idx * 0.20, idx * 0.20 + 0.42));
      if (lu <= 0.01) return;
      g.save();
      g.globalAlpha = lu;
      g.font = idx === 0 && board.bold_first ? 'bold 21px PopB' : '19px PopR';
      g.fillStyle = '#0f172a';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(ln, textLeft, cy0 + 38 + idx * 42);
      g.restore();
    });

    if (board.rewrite) {
      const ry = cy0 + ch - 56;
      g.font = 'bold 19px PopB';
      g.fillStyle = '#64748b';
      g.textAlign = 'left';
      g.fillText(board.rewrite.old_text || '', textLeft, ry);
      if (u > 0.45) {
        const cu = ease(K(u, 0.45, 0.72));
        const tw = g.measureText(board.rewrite.old_text || '').width;
        g.strokeStyle = '#ef4444';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(textLeft - 4, ry);
        g.lineTo(textLeft + tw * cu, ry);
        g.stroke();
      }
      if (u > 0.68) {
        const nu = ease(K(u, 0.68, 0.96));
        g.save();
        g.globalAlpha = nu;
        g.fillStyle = '#0f172a';
        g.fillText(board.rewrite.new_text || '', textLeft, ry + 32);
        g.restore();
      }
    }
    g.restore();
  } else if (board.type === 'stat_cards') {
    const cards = Array.isArray(board.cards) && board.cards.length > 0
      ? board.cards
      : [
          { value: '9 PM', label: 'Daily Stop Boundary' },
          { value: '3.2x', label: 'Long-Term Output' },
        ];
    const cols = cards.length <= 2 ? cards.length : 2;
    const rows = Math.ceil(cards.length / cols);
    const gap = 18;
    const cardW = (cw - (cols - 1) * gap) / cols;
    const cardH = (ch - (rows - 1) * gap) / rows;

    cards.forEach((c, idx) => {
      const cu = eo(clamp((u * cards.length - idx * 0.42) / Math.max(0.55, cards.length * 0.52)));
      if (cu <= 0.01) return;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = cx0 + col * (cardW + gap);
      const cy = cy0 + row * (cardH + gap) + (1 - cu) * 12;
      const cCol = c.color || accent;
      g.save();
      g.globalAlpha = boardVis * cu;
      g.fillStyle = 'rgba(15, 23, 42, 0.92)';
      g.strokeStyle = cCol;
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(cx, cy, cardW, cardH, 12);
      g.fill();
      g.stroke();

      g.font = 'bold 42px PopB';
      g.fillStyle = cCol;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(c.value || ''), cx + cardW * 0.5, cy + cardH * 0.42);

      g.font = '600 18px PopR';
      g.fillStyle = '#e2e8f0';
      g.fillText(String(c.label || ''), cx + cardW * 0.5, cy + cardH * 0.74);
      g.restore();
    });
  }

  g.restore();
  return { centerX: bx + bw * 0.5, centerY: by + bh * 0.5, leftX: bx, rightX: bx + bw };
}

/**
 * Foreground parallax silhouettes for multi-plane 2.5D depth (Foreground + Midground + Background).
 */
function drawForegroundLayer(g, fgType, W, H, floorY, t, panX = 0) {
  if (!fgType || fgType === 'none') return;
  const fgShift = -panX * 1.45;
  g.save();
  g.translate(fgShift, 0);
  if (fgType === 'window_frame') {
    g.fillStyle = 'rgba(4,8,16,0.72)';
    g.fillRect(-160, 0, 130, H);
    g.fillRect(W + 30, 0, 160, H);
    g.fillStyle = 'rgba(8,14,26,0.42)';
    g.fillRect(W * 0.04, 0, 14, H);
    g.fillRect(W * 0.95, 0, 14, H);
  } else if (fgType === 'street_railing') {
    const ry = floorY + 28;
    g.strokeStyle = 'rgba(7,11,20,0.82)';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(-220, ry);
    g.lineTo(W + 220, ry);
    for (let rx = -200; rx <= W + 200; rx += 160) {
      g.moveTo(rx, ry);
      g.lineTo(rx, H);
    }
    g.stroke();
  } else if (fgType === 'park_trees') {
    g.fillStyle = 'rgba(4,9,18,0.78)';
    g.fillRect(-90, 0, 145, H);
    g.beginPath();
    g.arc(65, 95, 145, 0, Math.PI * 2);
    g.arc(W - 40, 80, 160, 0, Math.PI * 2);
    g.fill();
  } else if (fgType === 'diner_glass') {
    // Subtle rain droplets & reflection streak across foreground diner window
    g.fillStyle = 'rgba(255,255,255,0.025)';
    g.beginPath();
    g.moveTo(140, 0); g.lineTo(280, 0); g.lineTo(90, H); g.lineTo(-50, H);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(6,10,18,0.75)';
    g.fillRect(-140, 0, 165, H);
    g.fillRect(W - 25, 0, 165, H);
  }
  g.restore();
}

module.exports = {
  SUPPORTED_PROPS,
  SUPPORTED_BOARDS,
  CANONICAL_ASSET_LIBRARY,
  computePropAnchors,
  drawHeldPhoneInHand,
  drawHeldCupInHand,
  drawWorldProp,
  drawWorldBoard,
  drawForegroundLayer,
};
