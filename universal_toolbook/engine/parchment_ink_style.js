'use strict';

/**
 * Stick-House Inspired Warm Parchment & Hand-Inked Stick Figure Style Engine
 * Renders:
 *  - Deterministic static aged kraft/parchment paper canvas + soft sepia vignette (zero flicker)
 *  - Organic hand-inked architectural & metaphor environments (foreground, midground, background)
 *  - Expressive hand-drawn charcoal-ink stick figures with parchment-occluded round heads,
 *    hair wisps/silhouettes, oval hands & shoes, cartoon expressions, sweat drops, and comic rays
 *  - Bold dark-ink + crimson-red typography & parchment subtitle cards
 */

const { createCanvas } = require('./canvas_backend');
const { BONES, clamp, lerp, ease, eo, ca, skeleton, applyPostureToPose } = require('./character_rig');
const { HARBOR_BACKDROPS, drawBeaconBackdrop, keeperGate } = require('./beacon_harbor');
// "The Wall You Agreed With" stage (empty parchment + ghost wall); same extension pattern.
const { WALL_BACKDROPS, drawWallBackdrop } = require('./impossible_wall');
// "The Bamboo Seed" set: ground cutaway + above/below-ground staging; same extension pattern.
const { BAMBOO_BACKDROPS, drawBambooBackdrop } = require('./bamboo_grove');

const INK = '#1a1612';
const INK_SOFT = 'rgba(26, 22, 18, 0.55)';
const INK_FAINT = 'rgba(26, 22, 18, 0.18)';
const PAPER_LIGHT = '#f7ebd4';
const PAPER_MID = '#efe0c2';
const CRIMSON = '#cc292b';
const AMBER_WASH = 'rgba(234, 158, 52, 0.24)';

let _cachedParchment = null;
let _cachedKey = '';

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getParchmentBackdrop(w = 1920, h = 1080) {
  const key = `${w}x${h}`;
  if (_cachedParchment && _cachedKey === key) return _cachedParchment;

  const c = createCanvas(w, h);
  const g = c.getContext('2d');
  const rng = seededRand(20261025);

  // 1. Base warm cream-kraft radial wash
  const baseGrad = g.createRadialGradient(w * 0.5, h * 0.48, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
  baseGrad.addColorStop(0.0, '#f8edd8');
  baseGrad.addColorStop(0.58, '#efe0c2');
  baseGrad.addColorStop(0.86, '#dfc69c');
  baseGrad.addColorStop(1.0, '#c7a472');
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, w, h);

  // 2. Subtle organic tea-stain / paper mottled clouds (static, zero per-frame noise)
  for (let i = 0; i < 46; i++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = 90 + rng() * 280;
    const warm = rng() > 0.42;
    const gr = g.createRadialGradient(cx, cy, 4, cx, cy, r);
    gr.addColorStop(0, warm ? 'rgba(168, 126, 72, 0.055)' : 'rgba(255, 250, 238, 0.08)');
    gr.addColorStop(1, 'rgba(168, 126, 72, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  // 3. Delicate crumpled-paper crease network (matching reference kraft texture)
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 65; i++) {
    const x0 = rng() * w;
    const y0 = rng() * h;
    const len = 60 + rng() * 220;
    const ang = rng() * Math.PI * 2;
    const mx = x0 + Math.cos(ang + 0.18) * len * 0.5;
    const my = y0 + Math.sin(ang + 0.18) * len * 0.5;
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;

    g.strokeStyle = i % 2 === 0 ? 'rgba(138, 99, 52, 0.065)' : 'rgba(255, 250, 240, 0.11)';
    g.lineWidth = 1.0 + rng() * 1.3;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(mx, my, x1, y1);
    g.stroke();
  }
  g.restore();

  // 4. Soft burnt-sepia corner & border vignette
  const vig = g.createRadialGradient(w * 0.5, h * 0.5, w * 0.34, w * 0.5, h * 0.5, w * 0.68);
  vig.addColorStop(0, 'rgba(120, 82, 38, 0)');
  vig.addColorStop(0.75, 'rgba(120, 82, 38, 0.08)');
  vig.addColorStop(1, 'rgba(96, 62, 24, 0.30)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);

  _cachedParchment = c;
  _cachedKey = key;
  return c;
}

// Hand-inked stroke helper with slight organic mid-bow so lines feel pen-drawn
function inkLine(g, x1, y1, x2, y2, width = 3.6, bow = 1.4, color = INK) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const hash = Math.sin(x1 * 0.037 + y1 * 0.053 + x2 * 0.019) * bow;
  const mx = (x1 + x2) * 0.5 + nx * hash;
  const my = (y1 + y2) * 0.5 + ny * hash;

  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo(mx, my, x2, y2);
  g.stroke();
  g.restore();
}

function inkBox(g, x, y, w, h, fill = PAPER_LIGHT, lineW = 3.4, radius = 4) {
  g.save();
  if (fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, radius);
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = lineW;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.roundRect(x, y, w, h, radius);
  g.stroke();
  g.restore();
}

function drawCrumpledPaperBall(g, cx, cy, r = 16) {
  g.save();
  g.fillStyle = PAPER_LIGHT;
  g.strokeStyle = INK;
  g.lineWidth = 2.6;
  g.lineJoin = 'round';
  g.beginPath();
  const pts = 7;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rad = r * (0.82 + 0.24 * Math.sin(i * 2.7 + cx * 0.1));
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad * 0.85;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.stroke();

  // Inner crinkle creases
  g.lineWidth = 1.7;
  g.beginPath();
  g.moveTo(cx - r * 0.4, cy - r * 0.15);
  g.lineTo(cx + r * 0.15, cy + r * 0.25);
  g.lineTo(cx + r * 0.45, cy - r * 0.2);
  g.stroke();
  g.restore();
}

function drawParchmentHorizon(g, floorY, fromX = -260, toX = 2180, gapStart = null, gapEnd = null) {
  g.save();
  // Soft warm ground wash below horizon
  const fg = g.createLinearGradient(0, floorY, 0, 1080);
  fg.addColorStop(0, 'rgba(148, 108, 60, 0.10)');
  fg.addColorStop(1, 'rgba(120, 84, 42, 0.20)');
  g.fillStyle = fg;
  if (gapStart !== null && gapEnd !== null) {
    g.fillRect(fromX, floorY, gapStart - fromX, 1080 - floorY);
    g.fillRect(gapEnd, floorY, toX - gapEnd, 1080 - floorY);
    inkLine(g, fromX, floorY, gapStart, floorY, 4.0, 1.5);
    inkLine(g, gapEnd, floorY, toX, floorY, 4.0, 1.5);
  } else {
    g.fillRect(fromX, floorY, toX - fromX, 1080 - floorY);
    inkLine(g, fromX, floorY, toX, floorY, 4.0, 1.8);
  }

  // Subtle hand-drawn floor hatch ticks
  g.strokeStyle = 'rgba(26, 22, 18, 0.22)';
  g.lineWidth = 2.0;
  for (let hx = -120; hx < 2060; hx += 115) {
    if (gapStart !== null && hx > gapStart - 20 && hx < gapEnd + 20) continue;
    g.beginPath();
    g.moveTo(hx, floorY + 8);
    g.lineTo(hx + 28, floorY + 8);
    g.stroke();
  }
  g.restore();
}

/**
 * Render one of the 6 rich hand-inked Stick House environments
 */
function drawParchmentEnvironment(g, setting, globalT, ts, panX, floorY = 835, W = 1920, H = 1080) {
  const kind = (setting && setting.backdrop) || 'parchment_studio';

  // Harbor-beacon set (see engine/beacon_harbor.js): the whole prop + backdrop extension for
  // "The Beacon That Kept Time" lives in that module and is dispatched here, so this file keeps
  // owning the shared ink vocabulary and every existing backdrop is untouched.
  if (HARBOR_BACKDROPS.includes(kind)) {
    return drawBeaconBackdrop(g, setting, globalT, ts, panX, floorY);
  }

  // Bamboo cutaway set (see engine/bamboo_grove.js): sky, cycling sun, soil strata, ground line.
  if (BAMBOO_BACKDROPS.includes(kind)) {
    return drawBambooBackdrop(g, setting, globalT, ts, panX, floorY, W, H);
  }

  // Bare stage for the wall fable: deliberately empty, so the only object in frame is the wall.
  if (WALL_BACKDROPS.includes(kind)) {
    return drawWallBackdrop(g, setting, globalT, ts, floorY, W, H);
  }

  if (kind === 'parchment_studio') {
    drawParchmentHorizon(g, floorY);

    // Background: Courtyard window showing Arthur's glowing architect studio across the lane
    const wx = 310, wy = 205, ww = 350, wh = 265;
    inkBox(g, wx, wy, ww, wh, '#e7d5b4', 3.4, 4);
    // Warm amber glow in neighbor's window across courtyard
    const glow = g.createRadialGradient(wx + ww * 0.52, wy + wh * 0.52, 12, wx + ww * 0.52, wy + wh * 0.52, 145);
    glow.addColorStop(0, 'rgba(245, 166, 35, 0.42)');
    glow.addColorStop(1, 'rgba(245, 166, 35, 0)');
    g.fillStyle = glow;
    g.fillRect(wx + 8, wy + 8, ww - 16, wh - 16);

    // Distant neighbor window frame & tiny framed bridge silhouette inside it
    inkBox(g, wx + 95, wy + 58, 160, 115, 'rgba(255, 236, 190, 0.65)', 2.4, 2);
    // Tiny suspension bridge silhouette on Arthur's distant wall
    inkLine(g, wx + 120, wy + 132, wx + 230, wy + 132, 2.2, 0.4);
    inkLine(g, wx + 145, wy + 95, wx + 145, wy + 135, 2.2, 0.2);
    inkLine(g, wx + 205, wy + 95, wx + 205, wy + 135, 2.2, 0.2);
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = 1.9;
    g.beginPath();
    g.moveTo(wx + 145, wy + 98);
    g.quadraticCurveTo(wx + 175, wy + 128, wx + 205, wy + 98);
    g.stroke();
    g.restore();
    // Window mullions
    inkLine(g, wx + ww * 0.5, wy, wx + ww * 0.5, wy + wh, 2.8, 0.5);
    inkLine(g, wx, wy + wh * 0.56, wx + ww, wy + wh * 0.56, 2.8, 0.5);
    inkBox(g, wx - 12, wy + wh, ww + 24, 14, PAPER_LIGHT, 3.0, 2);

    // Wall clock at 2:15 AM
    const clX = 835, clY = 255, clR = 46;
    g.save();
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(clX, clY, clR, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(clX + Math.cos(a) * (clR - 9), clY + Math.sin(a) * (clR - 9));
      g.lineTo(clX + Math.cos(a) * (clR - 3), clY + Math.sin(a) * (clR - 3));
      g.stroke();
    }
    // 2:15 hands + subtle second tick
    inkLine(g, clX, clY, clX + 18, clY - 12, 3.2, 0.2);
    inkLine(g, clX, clY, clX + 29, clY + 2, 2.4, 0.2);
    const secA = Math.floor(globalT * 2) * (Math.PI / 30);
    inkLine(g, clX, clY, clX + Math.cos(secA) * 30, clY + Math.sin(secA) * 30, 1.5, 0, CRIMSON);
    g.restore();

    // Bookshelf on right wall
    inkBox(g, 1380, 260, 230, 16, PAPER_LIGHT, 3.0, 2);
    const bookW = [22, 28, 19, 26, 24, 20];
    let bx = 1400;
    bookW.forEach((bw, idx) => {
      const bh = 62 + (idx % 3) * 14;
      inkBox(g, bx, 260 - bh, bw, bh, idx === 2 ? 'rgba(204, 41, 43, 0.22)' : PAPER_LIGHT, 2.4, 2);
      bx += bw + 4;
    });

    // Midground behind character: High-backed desk chair (Daniel sits at x=1225 facing left -1)
    inkBox(g, 1182, floorY - 265, 92, 165, PAPER_LIGHT, 3.4, 10);
    inkLine(g, 1202, floorY - 100, 1196, floorY, 3.6, 0.4);
    inkLine(g, 1254, floorY - 100, 1262, floorY, 3.6, 0.4);
  } else if (kind === 'parchment_pedestals') {
    drawParchmentHorizon(g, floorY);

    // Towering pedestals in background/midground (customizable via setting.pedestal_labels)
    const pLabels = Array.isArray(setting && setting.pedestal_labels) && setting.pedestal_labels.length >= 3
      ? setting.pedestal_labels
      : ['STAGE 1', 'STAGE 2', 'PEAK'];
    const cols = [
      { x: 1060, h: 310, label: pLabels[0] },
      { x: 1290, h: 420, label: pLabels[1] },
      { x: 1520, h: 530, label: pLabels[2] },
    ];
    cols.forEach((c) => {
      const topY = floorY - c.h;
      g.fillStyle = 'rgba(148, 108, 60, 0.11)';
      g.fillRect(c.x - 62, topY + 20, 124, c.h - 20);
      inkBox(g, c.x - 58, topY + 22, 116, c.h - 22, PAPER_LIGHT, 3.2, 2);
      inkBox(g, c.x - 72, topY, 144, 24, PAPER_LIGHT, 3.4, 3);
      inkBox(g, c.x - 70, floorY - 18, 140, 18, PAPER_LIGHT, 3.2, 2);
      inkLine(g, c.x - 24, topY + 38, c.x - 24, floorY - 30, 1.8, 0.4, INK_SOFT);
      inkLine(g, c.x, topY + 38, c.x, floorY - 30, 1.8, 0.4, INK_SOFT);
      inkLine(g, c.x + 24, topY + 38, c.x + 24, floorY - 30, 1.8, 0.4, INK_SOFT);

      inkBox(g, c.x - 28, topY - 64, 56, 56, PAPER_LIGHT, 2.8, 4);
      g.save();
      g.font = 'bold 15px PopB';
      g.fillStyle = CRIMSON;
      g.textAlign = 'center';
      g.fillText(String(c.label), c.x, topY + 58);
      g.restore();
    });

    // Easel in midground (customizable via setting.easel_label)
    const ex = 875, ey = floorY;
    const easelLabel = (setting && setting.easel_label !== undefined) ? String(setting.easel_label) : 'START ?';
    inkLine(g, ex - 45, ey, ex, ey - 280, 3.4, 0.5);
    inkLine(g, ex + 45, ey, ex, ey - 280, 3.4, 0.5);
    inkLine(g, ex, ey - 280, ex + 26, ey, 2.8, 0.4);
    inkBox(g, ex - 68, ey - 255, 136, 165, '#fcf6ea', 3.6, 3);
    if (easelLabel) {
      g.save();
      g.font = 'bold 18px PopB';
      g.fillStyle = 'rgba(26,22,18,0.36)';
      g.textAlign = 'center';
      g.fillText(easelLabel, ex, ey - 168);
      g.restore();
    }
  } else if (kind === 'parchment_hallway') {
    drawParchmentHorizon(g, floorY);

    // Apartment corridor wainscoting & two doors (customizable via setting.door_labels & setting.crate_label)
    const dLabels = Array.isArray(setting && setting.door_labels) && setting.door_labels.length >= 2
      ? setting.door_labels
      : ['4A', '4B'];
    const crateLabel = (setting && setting.crate_label !== undefined) ? String(setting.crate_label) : 'ARCHIVE';
    inkLine(g, -100, floorY - 220, 2020, floorY - 220, 2.4, 1.0, INK_SOFT);
    [320, 1460].forEach((dx, idx) => {
      inkBox(g, dx, floorY - 430, 195, 430, PAPER_LIGHT, 3.6, 3);
      inkBox(g, dx + 24, floorY - 395, 147, 155, PAPER_MID, 2.4, 2);
      inkBox(g, dx + 24, floorY - 205, 147, 165, PAPER_MID, 2.4, 2);
      g.save();
      g.font = 'bold 20px PopB';
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.fillText(String(dLabels[idx]), dx + 97, floorY - 315);
      g.fillStyle = INK;
      g.beginPath();
      g.arc(dx + 168, floorY - 218, 6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });

    // Gently swaying ceiling bulb
    const swing = Math.sin(globalT * 1.4) * 10;
    inkLine(g, 960, 40, 960 + swing, 195, 2.8, 0.3);
    const bglow = g.createRadialGradient(960 + swing, 215, 6, 960 + swing, 215, 190);
    bglow.addColorStop(0, 'rgba(245, 178, 64, 0.30)');
    bglow.addColorStop(1, 'rgba(245, 178, 64, 0)');
    g.fillStyle = bglow;
    g.beginPath();
    g.arc(960 + swing, 215, 190, 0, Math.PI * 2);
    g.fill();
    inkBox(g, 946 + swing, 192, 28, 16, INK, 2, 3);
    g.save();
    g.fillStyle = '#fff7d6';
    g.strokeStyle = INK;
    g.lineWidth = 2.8;
    g.beginPath();
    g.arc(960 + swing, 222, 16, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();

    const cx = 860, cy = floorY - 108;
    inkBox(g, cx, cy, 205, 108, '#e6cfa8', 3.6, 4);
    inkLine(g, cx, cy + 36, cx + 205, cy + 36, 2.6, 0.4);
    inkLine(g, cx, cy + 72, cx + 205, cy + 72, 2.6, 0.4);
    if (crateLabel) {
      g.save();
      g.font = 'bold 17px PopB';
      g.fillStyle = INK;
      g.textAlign = 'center';
      g.fillText(crateLabel, cx + 102, cy + 25);
      g.restore();
    }

    // Spilled crossed-out blueprint sheets across floor
    const sheets = [
      { x: 675, y: floorY - 26, w: 120, h: 42, rot: -0.12 },
      { x: 785, y: floorY - 18, w: 132, h: 46, rot: 0.08 },
      { x: 1055, y: floorY - 24, w: 126, h: 44, rot: 0.14 },
    ];
    sheets.forEach((sh) => {
      g.save();
      g.translate(sh.x, sh.y);
      g.rotate(sh.rot);
      inkBox(g, -sh.w * 0.5, -sh.h * 0.5, sh.w, sh.h, '#fcf6e8', 2.6, 3);
      // Tiny bridge arch + crimson X mark
      inkLine(g, -sh.w * 0.34, 8, sh.w * 0.34, 8, 2.0, 0.2);
      inkLine(g, -18, -12, 18, 12, 3.0, 0.2, CRIMSON);
      inkLine(g, 18, -12, -18, 12, 3.0, 0.2, CRIMSON);
      g.restore();
    });
  } else if (kind === 'parchment_drafting') {
    drawParchmentHorizon(g, floorY);

    // Tall arched studio window on left with soft ink rain streaks
    const wx = 220, wy = 165, ww = 290, wh = 390;
    inkBox(g, wx, wy, ww, wh, '#e6d3b1', 3.6, 8);
    g.save();
    g.beginPath();
    g.rect(wx + 6, wy + 6, ww - 12, wh - 12);
    g.clip();
    g.strokeStyle = 'rgba(26, 22, 18, 0.20)';
    g.lineWidth = 1.8;
    for (let i = 0; i < 22; i++) {
      const rx = wx + ((i * 43 + globalT * 55) % (ww + 40)) - 20;
      const ry = wy + ((i * 71 + globalT * 240) % (wh + 50)) - 25;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx - 10, ry + 28);
      g.stroke();
    }
    g.restore();
    inkLine(g, wx + ww * 0.5, wy, wx + ww * 0.5, wy + wh, 3.0, 0.4);
    inkLine(g, wx, wy + wh * 0.5, wx + ww, wy + wh * 0.5, 3.0, 0.4);

    // Framed "DRAFT #48 — NORTH RIVER BRIDGE" masterpiece on right wall
    const fx = 1235, fy = 185, fw = 410, fh = 235;
    inkBox(g, fx - 10, fy - 10, fw + 20, fh + 20, PAPER_MID, 3.8, 4);
    inkBox(g, fx, fy, fw, fh, '#fbf3e2', 2.6, 2);
    // Suspension bridge drawing inside frame
    inkLine(g, fx + 34, fy + 168, fx + fw - 34, fy + 168, 3.4, 0.3);
    inkLine(g, fx + 115, fy + 62, fx + 115, fy + 195, 3.6, 0.2);
    inkLine(g, fx + fw - 115, fy + 62, fx + fw - 115, fy + 195, 3.6, 0.2);
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(fx + 38, fy + 145);
    g.quadraticCurveTo(fx + 76, fy + 118, fx + 115, fy + 68);
    g.moveTo(fx + 115, fy + 68);
    g.quadraticCurveTo(fx + fw * 0.5, fy + 158, fx + fw - 115, fy + 68);
    g.moveTo(fx + fw - 115, fy + 68);
    g.quadraticCurveTo(fx + fw - 76, fy + 118, fx + fw - 38, fy + 145);
    g.stroke();
    const frameLabel = (setting && setting.frame_label !== undefined)
      ? String(setting.frame_label)
      : 'FINAL BLUEPRINT';
    if (frameLabel) {
      g.font = 'bold 16px PopB';
      g.fillStyle = CRIMSON;
      g.textAlign = 'center';
      g.fillText(frameLabel, fx + fw * 0.5, fy + fh - 18);
    }
    g.restore();

    // Center tilted wooden architect's drafting table
    const tx = 835, ty = floorY - 175;
    inkLine(g, tx + 40, ty + 28, tx + 22, floorY, 4.0, 0.4);
    inkLine(g, tx + 230, ty + 28, tx + 248, floorY, 4.0, 0.4);
    inkLine(g, tx + 32, floorY - 62, tx + 238, floorY - 62, 3.0, 0.3);
    g.save();
    g.translate(tx + 135, ty + 8);
    g.rotate(-0.14);
    inkBox(g, -155, -14, 310, 22, '#e6cfa8', 3.6, 3);
    // Clean sheet of parchment taped on top
    inkBox(g, -125, -24, 250, 14, '#fffaf0', 2.8, 2);

    // If setting.crooked_line_at is active, animate the bold crooked crimson stroke across the sheet!
    if (setting && Number.isFinite(setting.crooked_line_at) && ts >= setting.crooked_line_at) {
      const prog = clamp((ts - setting.crooked_line_at) / 1.1);
      const xEnd = lerp(-105, 108, ease(prog));
      g.strokeStyle = CRIMSON;
      g.lineWidth = 5.0;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-105, -28);
      g.quadraticCurveTo(lerp(-105, -15, prog), -46, xEnd, -26);
      g.stroke();
    }
    g.restore();
  } else if (kind === 'parchment_chasm') {
    // Visual callback to Stick House cliff & rippling water, reimagined:
    // Daniel builds his own plank bridge across the gap while finished ink pages pin across the sky!
    const gapL = 620, gapR = 1300;
    drawParchmentHorizon(g, floorY, -260, 2180, gapL, gapR);

    // Cliff walls descending into rippling ink water
    inkLine(g, gapL, floorY, gapL + 38, 1040, 4.0, 2.0);
    inkLine(g, gapR, floorY, gapR - 38, 1040, 4.0, 2.0);

    // Animated ink water waves & droplets between cliffs (direct homage to sddefault.jpg!)
    const waterY = floorY + 128;
    g.save();
    g.fillStyle = 'rgba(132, 158, 172, 0.14)';
    g.fillRect(gapL + 18, waterY, gapR - gapL - 36, 140);
    g.strokeStyle = INK;
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    for (let row = 0; row < 2; row++) {
      const wy = waterY + row * 34;
      g.beginPath();
      for (let wx = gapL + 18; wx <= gapR - 18; wx += 28) {
        const wave = Math.sin(wx * 0.045 + globalT * 3.4 + row * 1.7) * 7;
        if (wx === gapL + 18) g.moveTo(wx, wy + wave);
        else g.lineTo(wx, wy + wave);
      }
      g.stroke();
    }
    // Little splash droplets
    for (let d = 0; d < 4; d++) {
      const dx = gapL + 130 + d * 140 + Math.sin(globalT * 2.2 + d) * 14;
      const dy = waterY - 14 - Math.abs(Math.sin(globalT * 3.1 + d * 1.3)) * 18;
      g.beginPath();
      g.ellipse(dx, dy, 5, 3, -0.4 + d * 0.3, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // Background gallery of pinned comic pages appearing as ts progresses!
    const pages = [
      { x: 300, y: 185, label: 'PAGE 1', at: 0.4 },
      { x: 545, y: 165, label: 'PAGE 6', at: 3.0 },
      { x: 795, y: 180, label: 'PAGE 14', at: 6.2 },
      { x: 1045, y: 162, label: 'PAGE 23', at: 9.5 },
      { x: 1295, y: 182, label: 'PAGE 35', at: 13.0 },
      { x: 1545, y: 168, label: 'PAGE 48', at: 16.5 },
    ];
    pages.forEach((pg, idx) => {
      if (ts < pg.at) return;
      const u = eo(clamp((ts - pg.at) / 0.55));
      g.save();
      g.globalAlpha = u;
      g.translate(pg.x, pg.y + (1 - u) * 22);
      g.rotate((idx % 2 === 0 ? -1 : 1) * 0.04);
      inkBox(g, -74, -92, 148, 184, '#fcf5e6', 2.8, 3);
      // Crimson pushpin
      g.fillStyle = CRIMSON;
      g.beginPath();
      g.arc(0, -78, 6.5, 0, Math.PI * 2);
      g.fill();
      // Comic panel boxes inside page
      inkBox(g, -56, -58, 112, 48, PAPER_LIGHT, 1.8, 2);
      inkBox(g, -56, -2, 52, 52, PAPER_LIGHT, 1.8, 2);
      inkBox(g, 4, -2, 52, 52, PAPER_LIGHT, 1.8, 2);
      g.font = 'bold 15px PopB';
      g.fillStyle = idx === pages.length - 1 ? CRIMSON : INK;
      g.textAlign = 'center';
      g.fillText(pg.label, 0, 74);
      g.restore();
    });

    // Imperfect wooden planks progressively laid across the chasm ahead of Daniel's walk!
    const numPlanks = 7;
    const span = gapR - gapL;
    const plankW = span / numPlanks;
    const bridgeDur = (setting && setting.bridge_duration) || 19.0;
    for (let i = 0; i < numPlanks; i++) {
      const appearAt = 0.6 + (i / numPlanks) * (bridgeDur * 0.72);
      if (ts < appearAt) continue;
      const u = eo(clamp((ts - appearAt) / 0.45));
      const px = gapL + i * plankW;
      const dropY = (1 - u) * -38;
      g.save();
      g.globalAlpha = u;
      g.translate(px + plankW * 0.5, floorY + 7 + dropY);
      g.rotate((i % 2 === 0 ? 1 : -1) * 0.018);
      inkBox(g, -plankW * 0.48, -9, plankW * 0.96, 18, '#e3c89c', 3.0, 2);
      g.restore();
    }
  } else if (kind === 'parchment_sunrise') {
    // Warm golden-rose watercolor dawn wash over hand-inked street & mailbox
    const sunGrad = g.createRadialGradient(1420, 480, 30, 1420, 480, 620);
    sunGrad.addColorStop(0.0, 'rgba(247, 178, 59, 0.42)');
    sunGrad.addColorStop(0.55, 'rgba(232, 118, 68, 0.16)');
    sunGrad.addColorStop(1.0, 'rgba(232, 118, 68, 0)');
    g.fillStyle = sunGrad;
    g.fillRect(0, 0, 1920, floorY);

    // Rising ink-outlined morning sun orb
    g.save();
    g.fillStyle = 'rgba(255, 224, 140, 0.72)';
    g.strokeStyle = INK;
    g.lineWidth = 3.0;
    g.beginPath();
    g.arc(1420, 470, 68, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();

    drawParchmentHorizon(g, floorY);

    // Apartment facade on left with Arthur waving a coffee mug in upper window!
    inkBox(g, 190, 220, 410, floorY - 220, PAPER_LIGHT, 3.6, 3);
    inkBox(g, 330, floorY - 210, 130, 210, PAPER_MID, 3.2, 2);
    // Upper studio window where Arthur waves
    inkBox(g, 260, 285, 135, 145, '#fff0c9', 3.0, 2);
    // Mini Arthur silhouette in upper window raising coffee mug!
    g.save();
    const wx = 328, wy = 378;
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 2.6;
    g.beginPath();
    g.arc(wx, wy - 26, 17, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    inkLine(g, wx, wy - 9, wx, wy + 46, 3.0, 0.2);
    const wave = Math.sin(globalT * 4.0) * 6;
    inkLine(g, wx, wy + 2, wx + 28, wy - 16 + wave, 2.8, 0.2);
    inkBox(g, wx + 26, wy - 28 + wave, 13, 15, CRIMSON, 2.0, 2);
    g.restore();

    // Streetlamp + Corner Mailbox ("MAIL") in midground
    inkLine(g, 1210, floorY, 1210, 360, 4.0, 0.4);
    inkLine(g, 1210, 360, 1155, 360, 3.6, 0.3);
    inkBox(g, 1138, 360, 34, 28, '#fff2c2', 2.8, 4);

    // Classic arched street mailbox at x = 980
    const mx = 980, my = floorY;
    inkBox(g, mx - 46, my - 155, 92, 125, PAPER_MID, 3.6, 18);
    inkLine(g, mx - 38, my - 30, mx - 42, my, 3.8, 0.2);
    inkLine(g, mx + 38, my - 30, mx + 42, my, 3.8, 0.2);
    inkBox(g, mx - 28, my - 122, 56, 18, INK, 2.0, 3);
    g.save();
    g.font = 'bold 16px PopB';
    g.fillStyle = CRIMSON;
    g.textAlign = 'center';
    g.fillText('MAIL', mx, my - 72);
    g.restore();
  } else if (kind === 'parchment_cliff') {
    // Classic Stick-House cliff ledge + rippling ink water waves on the right side
    const cliffX = (setting && setting.cliff_x ? setting.cliff_x : 0.48) * 1920;
    drawParchmentHorizon(g, floorY, -260, cliffX, null, null);
    inkLine(g, cliffX, floorY, cliffX + 42, floorY + 75, 4.0, 1.5);
    const waterY = floorY + 52;
    g.save();
    g.fillStyle = 'rgba(132, 158, 172, 0.12)';
    g.fillRect(cliffX + 26, waterY, 2180 - cliffX, 200);
    g.strokeStyle = INK;
    g.lineWidth = 3.2;
    g.beginPath();
    for (let wx = cliffX + 24; wx <= 2120; wx += 28) {
      const wave = Math.sin(wx * 0.045 + globalT * 3.4) * 7;
      if (wx === cliffX + 24) g.moveTo(wx, waterY + wave);
      else g.lineTo(wx, waterY + wave);
    }
    g.stroke();
    g.restore();
  } else {
    // Clean parchment_stage (minimal hand-inked horizon + subtle background clouds)
    drawParchmentHorizon(g, floorY);
  }

  // Foreground layer: crumpled paper balls in studio, or ink framing details
  return { lightColor: CRIMSON, isParchment: true };
}

function drawParchmentForeground(g, kind, globalT, floorY = 835) {
  if (kind === 'studio_desk_and_papers' || kind === 'crumpled_papers') {
    if (kind === 'studio_desk_and_papers') {
      const deskX = 910, deskY = floorY - 142, deskW = 355, deskH = 18;
      // Desk legs & top in front of seated character
      inkLine(g, deskX + 28, deskY + deskH, deskX + 24, floorY, 3.8, 0.5);
      inkLine(g, deskX + deskW - 28, deskY + deskH, deskX + deskW - 24, floorY, 3.8, 0.5);
      inkBox(g, deskX, deskY, deskW, deskH, PAPER_LIGHT, 3.6, 3);

      // Desk lamp on left side of desk
      inkBox(g, deskX + 30, deskY - 10, 46, 10, PAPER_LIGHT, 2.8, 3);
      inkLine(g, deskX + 53, deskY - 10, deskX + 38, deskY - 78, 3.2, 0.6);
      inkLine(g, deskX + 38, deskY - 78, deskX + 82, deskY - 96, 3.2, 0.6);
      g.save();
      g.fillStyle = 'rgba(245, 178, 64, 0.16)';
      g.beginPath();
      g.moveTo(deskX + 84, deskY - 90);
      g.lineTo(deskX + 245, deskY);
      g.lineTo(deskX + 50, deskY);
      g.closePath();
      g.fill();
      g.restore();
      inkBox(g, deskX + 70, deskY - 108, 34, 22, PAPER_LIGHT, 2.8, 5);

      // Open Laptop positioned slightly left & lower so Daniel's full expressive face sits cleanly above/beside the lid (just like 2.jpg!)
      g.save();
      g.fillStyle = PAPER_LIGHT;
      g.strokeStyle = INK;
      g.lineWidth = 3.6;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(deskX + 86, deskY - 82);
      g.lineTo(deskX + 188, deskY - 82);
      g.lineTo(deskX + 204, deskY - 8);
      g.lineTo(deskX + 102, deskY - 8);
      g.closePath();
      g.fill();
      g.stroke();
      inkBox(g, deskX + 102, deskY - 10, 142, 10, PAPER_LIGHT, 3.2, 2);
      inkBox(g, deskX + 136, deskY - 49, 20, 9, INK, 1.5, 2);
      g.restore();
    }

    const balls = [
      [420, floorY + 28, 17],
      [615, floorY + 42, 15],
      [790, floorY + 22, 18],
      [1045, floorY + 36, 16],
      [1315, floorY + 26, 19],
      [1490, floorY + 44, 15],
    ];
    for (const [bx, by, br] of balls) {
      drawCrumpledPaperBall(g, bx, by, br);
    }
  } else if (kind === 'floating_leaves') {
    g.save();
    g.strokeStyle = INK;
    g.fillStyle = 'rgba(217, 119, 6, 0.35)';
    g.lineWidth = 2.0;
    for (let i = 0; i < 6; i++) {
      const lx = ((i * 340 + globalT * 62) % 2040) - 60;
      const ly = 220 + ((i * 130 + Math.sin(globalT * 1.6 + i) * 38) % 520);
      g.save();
      g.translate(lx, ly);
      g.rotate(globalT * 1.1 + i);
      g.beginPath();
      g.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    }
    g.restore();
  }
}

/**
 * Draw authentic Stick-House hand-inked stick character using fixed-length FK/IK skeleton
 */
function drawInkStickFigure(g, x, fy, s, p0 = {}, flip = false, opts = {}) {
  const posed = applyPostureToPose(p0, opts.posture ?? 0, s);
  const r = skeleton(x, fy, s, posed, flip);
  const dir = flip ? -1 : 1;
  const lineW = 4.0 * s;

  // Height-aware soft ink ground shadow ellipse
  const footCenterX = (r.world.ll[2][0] + r.world.lr[2][0]) * 0.5;
  const lowestFootY = Math.max(r.world.ll[2][1], r.world.lr[2][1]);
  const airFactor = clamp(1 - Math.max(0, fy - lowestFootY) / (135 * s), 0.22, 1.0);
  g.save();
  g.fillStyle = `rgba(42, 30, 16, ${(0.14 * airFactor).toFixed(3)})`;
  g.beginPath();
  g.ellipse(footCenterX, fy + 3 * s, 38 * s * airFactor, 7.5 * s * airFactor, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  function strokeLimb(pts) {
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = lineW;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    g.lineTo(pts[2][0], pts[2][1]);
    g.stroke();
    g.restore();
  }

  function drawOvalShoe(footPt, footAng = 0) {
    g.save();
    g.translate(footPt[0], footPt[1]);
    g.rotate(footAng * dir);
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 3.0 * s;
    g.beginPath();
    g.ellipse(dir * 6.5 * s, -1.2 * s, 11.2 * s, 4.6 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  function drawOvalHand(elbowPt, handPt) {
    const ang = Math.atan2(handPt[1] - elbowPt[1], handPt[0] - elbowPt[0]);
    g.save();
    g.translate(handPt[0], handPt[1]);
    g.rotate(ang);
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.ellipse(3.2 * s, 0, 7.4 * s, 4.8 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Subtle thumb loop
    g.beginPath();
    g.arc(1.2 * s, -4.2 * s, 2.5 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }

  // Back leg & back arm
  strokeLimb(r.world.lr);
  drawOvalShoe(r.world.lr[2], posed.footAngleR || 0);
  strokeLimb(r.world.ar);
  drawOvalHand(r.world.ar[1], r.world.ar[2]);

  // Optional Stick-House A-line coat/dress or curved stick spine
  const sh = r.world.shoulder;
  const hip = r.world.hip;
  const mid = r.world.spineMid || [lerp(sh[0], hip[0], 0.5), lerp(sh[1], hip[1], 0.5)];
  const accs = Array.isArray(opts.accessories) ? opts.accessories : (opts.accessory ? [opts.accessory] : []);
  if (accs.includes('tunic') || accs.includes('dress')) {
    g.save();
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 3.4 * s;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(sh[0], sh[1] + 4 * s);
    g.lineTo(hip[0] - 24 * s, hip[1] + 28 * s);
    g.lineTo(hip[0] + 24 * s, hip[1] + 28 * s);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  } else {
    // Curved expressive stick spine following thoracic posture!
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = lineW + 0.4 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(sh[0], sh[1] - 5 * s);
    g.quadraticCurveTo(mid[0], mid[1], hip[0], hip[1]);
    g.stroke();
    g.restore();
    if (accs.includes('collar') || accs.includes('coat')) {
      g.save();
      g.strokeStyle = INK;
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.moveTo(sh[0] - 8 * s, sh[1] + 2 * s);
      g.lineTo(sh[0] + dir * 5 * s, sh[1] + 15 * s);
      g.lineTo(sh[0] + 9 * s, sh[1] + 3 * s);
      g.stroke();
      g.restore();
    }
  }

  // Front leg
  strokeLimb(r.world.ll);
  drawOvalShoe(r.world.ll[2], posed.footAngleL || 0);

  // Oversized expressive Stick-House head (1.52x standard radius so cartoon expressions read clearly!)
  const hr = BONES.HEAD_R * 1.52 * s;
  const hd = [
    sh[0] + (r.world.head[0] - sh[0]) * 1.18,
    sh[1] + (r.world.head[1] - sh[1]) * 1.24,
  ];

  // Optional shoulder-length parted hair back layer (like Claire in 1.jpg)
  if (accs.includes('long_hair')) {
    g.save();
    g.fillStyle = PAPER_LIGHT;
    g.strokeStyle = INK;
    g.lineWidth = 3.2 * s;
    g.beginPath();
    g.moveTo(hd[0] - hr * 0.92, hd[1] - hr * 0.25);
    g.quadraticCurveTo(hd[0] - hr * 1.22, hd[1] + hr * 0.95, hd[0] - hr * 0.85, hd[1] + hr * 1.32);
    g.lineTo(hd[0] + hr * 0.85, hd[1] + hr * 1.32);
    g.quadraticCurveTo(hd[0] + hr * 1.22, hd[1] + hr * 0.95, hd[0] + hr * 0.92, hd[1] - hr * 0.25);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // Head circle filled with warm parchment so background ink lines never bleed through
  g.save();
  g.fillStyle = PAPER_LIGHT;
  g.strokeStyle = INK;
  g.lineWidth = 3.8 * s;
  g.beginPath();
  g.arc(hd[0], hd[1], hr, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Signature Stick-House hair wisps on crown (matching sddefault.jpg & 3.jpg!)
  if (accs.includes('long_hair')) {
    g.beginPath();
    g.lineWidth = 3.0 * s;
    g.moveTo(hd[0] - hr * 0.72, hd[1] - hr * 0.52);
    g.quadraticCurveTo(hd[0], hd[1] - hr * 0.18, hd[0] + hr * 0.74, hd[1] - hr * 0.48);
    g.stroke();
  } else if (accs.includes('side_wisps')) {
    // Older mentor Arthur: neat side hair wisps
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.moveTo(hd[0] - dir * hr * 0.78, hd[1] - hr * 0.45);
    g.quadraticCurveTo(hd[0] - dir * hr * 1.05, hd[1] - hr * 0.65, hd[0] - dir * hr * 0.85, hd[1] - hr * 0.82);
    g.moveTo(hd[0] - dir * hr * 0.58, hd[1] - hr * 0.68);
    g.quadraticCurveTo(hd[0] - dir * hr * 0.82, hd[1] - hr * 0.92, hd[0] - dir * hr * 0.52, hd[1] - hr * 1.02);
    g.stroke();
  } else {
    // Classic 3 Stick-House hair tufts curving over the forehead
    g.lineWidth = 3.0 * s;
    g.beginPath();
    g.moveTo(hd[0] - dir * hr * 0.10, hd[1] - hr * 0.96);
    g.quadraticCurveTo(hd[0] + dir * hr * 0.28, hd[1] - hr * 1.24, hd[0] + dir * hr * 0.52, hd[1] - hr * 1.04);
    g.moveTo(hd[0] + dir * hr * 0.08, hd[1] - hr * 0.92);
    g.quadraticCurveTo(hd[0] + dir * hr * 0.44, hd[1] - hr * 1.12, hd[0] + dir * hr * 0.68, hd[1] - hr * 0.88);
    g.moveTo(hd[0] - dir * hr * 0.28, hd[1] - hr * 0.92);
    g.quadraticCurveTo(hd[0] + dir * hr * 0.05, hd[1] - hr * 1.18, hd[0] + dir * hr * 0.26, hd[1] - hr * 1.05);
    g.stroke();
  }

  // Expressive Stick-House Cartoon Facial Acting!
  const expr = opts.expression || 'neutral';
  const ex1 = hd[0] + dir * hr * 0.14;
  const ex2 = hd[0] + dir * hr * 0.50;
  const ey = hd[1] - hr * 0.08;

  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineCap = 'round';

  // Eyes
  if (expr === 'burnout_cry') {
    // Scrunched stressed eyes (2.jpg!)
    g.lineWidth = 2.8 * s;
    g.beginPath();
    g.moveTo(ex1 - 5 * s, ey - 3 * s); g.lineTo(ex1 + 4 * s, ey); g.lineTo(ex1 - 5 * s, ey + 3 * s);
    g.moveTo(ex2 + 5 * s, ey - 3 * s); g.lineTo(ex2 - 4 * s, ey); g.lineTo(ex2 + 5 * s, ey + 3 * s);
    g.stroke();
  } else {
    const eyeH = expr === 'shocked' ? 6.2 * s : (expr === 'tired' || expr === 'sad' ? 4.0 * s : 5.2 * s);
    const eyeW = 3.1 * s;
    g.beginPath();
    g.ellipse(ex1, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
    g.ellipse(ex2, ey, eyeW * 0.92, eyeH * 0.95, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Optional round spectacles (for Arthur)
  if (accs.includes('glasses')) {
    g.lineWidth = 2.3 * s;
    g.beginPath();
    g.arc(ex1, ey, 7.2 * s, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(ex2, ey, 6.8 * s, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(ex1 + dir * 6.8 * s, ey);
    g.lineTo(ex2 - dir * 6.4 * s, ey);
    g.stroke();
  }

  // Brows
  const by = ey - 10.5 * s;
  g.lineWidth = 2.6 * s;
  g.beginPath();
  if (expr === 'chin_doubt' || expr === 'sad' || expr === 'tired' || expr === 'exhausted' || expr === 'worried' || expr === 'burnout_cry') {
    g.moveTo(ex1 - 5 * s, by + 2.5 * s); g.lineTo(ex1 + 4 * s, by - 2.0 * s);
    g.moveTo(ex2 - 4 * s, by - 2.0 * s); g.lineTo(ex2 + 5 * s, by + 2.5 * s);
  } else if (expr === 'determined' || expr === 'focused') {
    g.moveTo(ex1 - 5 * s, by - 2.2 * s); g.lineTo(ex1 + 4.5 * s, by + 1.8 * s);
    g.moveTo(ex2 - 4 * s, by + 1.8 * s); g.lineTo(ex2 + 5 * s, by - 2.2 * s);
  } else {
    g.moveTo(ex1 - 4.5 * s, by - 1.5 * s); g.quadraticCurveTo(ex1, by - 4 * s, ex1 + 4.5 * s, by - 1 * s);
    g.moveTo(ex2 - 4 * s, by - 1 * s); g.quadraticCurveTo(ex2, by - 4 * s, ex2 + 4.5 * s, by - 1.5 * s);
  }
  g.stroke();

  // Mouths (matching 2.jpg wide cry mouth, 3.jpg wavy doubt mouth, sddefault.jpg happy D-smile!)
  const mx = hd[0] + dir * hr * 0.30;
  const my = hd[1] + hr * 0.34;
  g.lineWidth = 2.8 * s;
  if (expr === 'burnout_cry') {
    // Wide open stressed cartoon mouth (2.jpg!)
    g.fillStyle = PAPER_MID;
    g.beginPath();
    g.roundRect(mx - 12 * s, my - 7 * s, 23 * s, 14 * s, 6 * s);
    g.fill();
    g.stroke();
    // Flying sweat droplets & stress ticks!
    const pulse = (opts.globalT || 0) * 5.0;
    for (let d = 0; d < 3; d++) {
      const dropOff = ((pulse + d * 0.9) % 1.8) * 9 * s;
      const sx = hd[0] - dir * (hr + 8 * s + dropOff);
      const sy = hd[1] - hr * 0.4 + d * 11 * s;
      g.beginPath();
      g.ellipse(sx, sy, 4.2 * s, 2.4 * s, -0.35 * dir, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (expr === 'chin_doubt') {
    // Wavy uncertain mouth (3.jpg!)
    g.beginPath();
    g.moveTo(mx - 9 * s, my + 1 * s);
    g.quadraticCurveTo(mx - 4.5 * s, my - 3.5 * s, mx, my + 1 * s);
    g.quadraticCurveTo(mx + 4.5 * s, my + 5 * s, mx + 9 * s, my);
    g.stroke();
  } else if (expr === 'smile' || expr === 'hopeful') {
    // Cheerful Stick-House open crescent smile (sddefault.jpg & 1.jpg!)
    g.beginPath();
    g.arc(mx, my - 3 * s, 8.5 * s, 0.12 * Math.PI, 0.88 * Math.PI);
    g.closePath();
    g.fillStyle = PAPER_MID;
    g.fill();
    g.stroke();
  } else if (expr === 'shocked') {
    g.beginPath();
    g.ellipse(mx, my, 5.2 * s, 6.8 * s, 0, 0, Math.PI * 2);
    g.stroke();
    // 3 comic exclamation rays above crown (sddefault.jpg!)
    g.lineWidth = 2.6 * s;
    for (let k = -1; k <= 1; k++) {
      const rx = hd[0] + k * 14 * s;
      const ry = hd[1] - hr - 10 * s;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + k * 5 * s, ry - 16 * s);
      g.stroke();
    }
  } else if (expr === 'sad' || expr === 'tired' || expr === 'exhausted' || expr === 'worried') {
    g.beginPath();
    g.arc(mx, my + 6 * s, 7.5 * s, 1.18 * Math.PI, 1.82 * Math.PI);
    g.stroke();
  } else {
    // Determined / neutral slight confident curve
    g.beginPath();
    g.moveTo(mx - 6.5 * s, my + 1 * s);
    g.quadraticCurveTo(mx, my + 3.8 * s, mx + 6.5 * s, my - 0.8 * s);
    g.stroke();
  }

  // Speech-locked ink mouth. `opts.faceAnim` is only non-zero while THIS actor is the active
  // speaker (the renderer gates it by speaker id and ignores narrator lines entirely), so the
  // jaw closes on its own between lines and never moves over a narrator passage.
  const faceAnim = opts.faceAnim;
  const talk = faceAnim ? clamp(Number(faceAnim.talkAmount) || 0) : 0;
  if (talk > 0.045 && expr !== 'burnout_cry') {
    const sealed = faceAnim.viseme === 'closed';
    const openW = 8.2 * s - 1.5 * s * talk;
    const openH = sealed ? 1.1 * s : (1.6 + 6.9 * talk) * s;
    g.save();
    // mask the resting expression line, then draw the ink mouth over it
    g.fillStyle = PAPER_LIGHT;
    g.beginPath();
    g.ellipse(mx, my + 1.2 * s, 10.4 * s, 6.6 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = sealed ? 'rgba(247, 235, 212, 0.9)' : 'rgba(120, 84, 46, 0.78)';
    g.strokeStyle = INK;
    g.lineWidth = 2.5 * s;
    g.beginPath();
    g.ellipse(mx, my + (sealed ? 0.6 * s : 0.4 * s), Math.max(3.2 * s, openW), Math.max(1.0 * s, openH), 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();

  // Front arm (if chin_doubt + pace_think/idle_stand, lift front hand toward chin like 3.jpg!)
  let frontArmPts = r.world.al;
  if (expr === 'chin_doubt') {
    const elbow = [sh[0] + dir * 24 * s, sh[1] + 28 * s];
    const chinHand = [hd[0] + dir * hr * 0.36, hd[1] + hr * 0.78];
    frontArmPts = [sh, elbow, chinHand];
  }
  strokeLimb(frontArmPts);
  drawOvalHand(frontArmPts[1], frontArmPts[2]);

  // Clean ink name badge if first appearance
  if (opts.nameTag) {
    g.save();
    g.font = `bold ${Math.round(16 * s)}px PopB`;
    const tw = g.measureText(opts.nameTag).width;
    const bx = hd[0] - (tw + 22) * 0.5;
    const byTag = hd[1] - hr - 42 * s;
    inkBox(g, bx, byTag, tw + 22, 28 * s, '#fffaf0', 2.4, 8);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(opts.nameTag, hd[0], byTag + 14 * s + 1);
    g.restore();
  }

  return {
    hl: r.world.al[2],
    hr: frontArmPts[2],
    fl: r.world.ll[2],
    fr: r.world.lr[2],
    head: hd,
    sh,
    hip,
  };
}

/**
 * Stick-House Top Headline Banner (matching sddefault.jpg bold black + crimson emphasis!)
 */
function drawParchmentHeadline(g, chapterTitle, ts, viewport = { left: 0, width: 1920, centerX: 960 }) {
  if (!chapterTitle || ts > 4.4) return;
  const enter = eo(clamp(ts / 0.45));
  const exit = ts > 3.6 ? 1 - ease(clamp((ts - 3.6) / 0.8)) : 1;
  const vis = enter * exit;
  if (vis <= 0.01) return;

  // Split "Lead Phrase | Crimson Phrase" if "|" is present, otherwise highlight last 2 words in crimson
  let blackPart = String(chapterTitle);
  let redPart = '';
  if (blackPart.includes('|')) {
    const parts = blackPart.split('|');
    blackPart = parts[0].trim() + ' ';
    redPart = parts[1].trim();
  } else {
    const words = blackPart.trim().split(/\s+/);
    if (words.length >= 3) {
      redPart = words.slice(-2).join(' ');
      blackPart = words.slice(0, -2).join(' ') + ' ';
    }
  }

  g.save();
  g.globalAlpha = vis;
  const frameLeft = Number(viewport.left) || 0;
  const frameWidth = Math.max(1, Math.min(1920, Number(viewport.width) || 1920));
  const centerX = Number.isFinite(Number(viewport.centerX)) ? Number(viewport.centerX) : frameLeft + frameWidth * 0.5;
  const maxTextW = Math.max(120, frameWidth - 96);
  let fontSize = 42;
  let w1 = 0;
  let w2 = 0;
  while (fontSize > 16) {
    g.font = `bold ${fontSize}px PopB`;
    w1 = g.measureText(blackPart).width;
    w2 = g.measureText(redPart).width;
    if (w1 + w2 <= maxTextW) break;
    fontSize -= 1;
  }
  g.font = `bold ${fontSize}px PopB`;
  w1 = g.measureText(blackPart).width;
  w2 = g.measureText(redPart).width;
  g.textBaseline = 'middle';
  const totalW = w1 + w2;
  const startX = centerX - totalW * 0.5;
  const y = lerp(52, 74, enter);

  // Soft paper plate: the chapter headline is screen-space, so background line art (window frames,
  // lamps, clocks) can drift behind it during camera moves. A low-alpha cream wash keeps the ink
  // legible without reading as a visible card.
  const plateW = Math.min(frameWidth - 16, totalW + 76);
  const plateH = 74;
  const plateX = centerX - plateW * 0.5;
  const plateY = y - plateH * 0.5;
  const plateGrad = g.createLinearGradient(plateX, 0, plateX + plateW, 0);
  plateGrad.addColorStop(0, 'rgba(247, 238, 219, 0)');
  plateGrad.addColorStop(0.14, 'rgba(247, 238, 219, 0.86)');
  plateGrad.addColorStop(0.86, 'rgba(247, 238, 219, 0.86)');
  plateGrad.addColorStop(1, 'rgba(247, 238, 219, 0)');
  g.fillStyle = plateGrad;
  g.beginPath();
  g.roundRect(plateX, plateY, plateW, plateH, 16);
  g.fill();

  g.fillStyle = INK;
  g.textAlign = 'left';
  g.fillText(blackPart, startX, y);
  if (redPart) {
    g.fillStyle = CRIMSON;
    g.fillText(redPart, startX + w1, y);
  }
  g.restore();
}

/**
 * Parchment-styled Cinema Subtitles (warm cream pill, dark ink words, crimson highlights)
 */
function drawParchmentSubtitle(g, subtitles, ts, mode = 'cinema', viewport = { left: 0, width: 1920, centerX: 960 }) {
  if (mode === 'off' || !Array.isArray(subtitles) || subtitles.length === 0) return;
  let active = null;
  for (const sub of subtitles) {
    if (ts >= sub.start && ts <= sub.end) {
      active = sub;
      break;
    }
  }
  if (!active) return;

  const fadeIn = clamp((ts - active.start) / 0.14);
  const fadeOut = clamp((active.end - ts) / 0.16);
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.02) return;

  g.save();
  g.globalAlpha = alpha;
  g.font = 'bold 30px PopB';
  g.textBaseline = 'middle';
  const frameLeft = Number(viewport.left) || 0;
  const frameWidth = Math.max(1, Math.min(1920, Number(viewport.width) || 1920));
  const centerX = Number.isFinite(Number(viewport.centerX)) ? Number(viewport.centerX) : frameLeft + frameWidth * 0.5;

  const maxLineW = Math.max(140, Math.min(1360, frameWidth - 80));
  const spaceW = g.measureText(' ').width;
  const lines = [];
  let curLine = [];
  let curW = 0;

  for (const tok of active.tokens) {
    const w = g.measureText(tok.raw).width;
    if (curLine.length > 0 && curW + spaceW + w > maxLineW) {
      lines.push({ items: curLine, width: curW });
      curLine = [{ ...tok, width: w }];
      curW = w;
    } else {
      if (curLine.length > 0) curW += spaceW;
      curLine.push({ ...tok, width: w });
      curW += w;
    }
  }
  if (curLine.length > 0) lines.push({ items: curLine, width: curW });

  const lineH = 42;
  const totalH = lines.length * lineH + 22;
  const maxW = Math.max(...lines.map((l) => l.width)) + 56;
  const centerY = 962 - (lines.length - 1) * 18;

  g.fillStyle = 'rgba(252, 244, 228, 0.93)';
  g.strokeStyle = 'rgba(26, 22, 18, 0.42)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.roundRect(centerX - maxW * 0.5, centerY - totalH * 0.5, maxW, totalH, 14);
  g.fill();
  g.stroke();

  g.textAlign = 'left';
  lines.forEach((line, lIdx) => {
    let x = centerX - line.width * 0.5;
    const y = centerY - ((lines.length - 1) * lineH) * 0.5 + lIdx * lineH + 1;

    let activeIdx = -1;
    let activeStrength = 0;
    for (let idx = 0; idx < line.items.length; idx++) {
      const it = line.items[idx];
      if (it.isSpeakerLabel || it.tStart === undefined || it.tEnd === undefined) continue;
      if (ts >= it.tStart - 0.03 && ts <= it.tEnd + 0.06) {
        const atk = clamp((ts - (it.tStart - 0.03)) / 0.045);
        const rel = clamp(((it.tEnd + 0.06) - ts) / 0.065);
        const str = Math.min(atk, rel);
        if (str > activeStrength) {
          activeStrength = str;
          activeIdx = idx;
        }
      }
    }

    line.items.forEach((it, idx) => {
      const hasTiming = it.tStart !== undefined && it.tEnd !== undefined;
      const isSpokenNow = idx === activeIdx && activeStrength > 0.03;
      const alreadySpoken = !hasTiming || it.isSpeakerLabel || ts > it.tEnd + 0.05;

      if (isSpokenNow) {
        const liftY = -2.0 * activeStrength;
        g.save();
        g.fillStyle = `rgba(217, 56, 58, ${(0.18 * activeStrength).toFixed(3)})`;
        g.strokeStyle = `rgba(217, 56, 58, ${(0.72 * activeStrength).toFixed(3)})`;
        g.lineWidth = 1.8;
        g.beginPath();
        g.roundRect(x - 6, y - 18 + liftY, it.width + 12, 36, 8);
        g.fill();
        g.stroke();
        g.fillStyle = CRIMSON;
        g.fillText(it.raw, x, y + liftY);
        g.restore();
      } else if (alreadySpoken) {
        g.fillStyle = it.highlight ? CRIMSON : INK;
        g.fillText(it.raw, x, y);
      } else {
        g.fillStyle = it.highlight ? 'rgba(217, 56, 58, 0.58)' : 'rgba(27, 23, 19, 0.48)';
        g.fillText(it.raw, x, y);
      }
      x += it.width + (idx < line.items.length - 1 ? spaceW : 0);
    });
  });
  g.restore();
}

/**
 * Warm Parchment Closing Intertitle (ink black + crimson payoff quote)
 */
function drawParchmentIntertitle(g, intertitle, ts, viewport = { left: 0, width: 1920, centerX: 960 }) {
  if (!intertitle || ts < (intertitle.start_at ?? 0)) return;
  const iu = ease(clamp((ts - (intertitle.start_at ?? 0)) / 0.85));
  g.save();
  g.globalAlpha = iu;
  const bg = getParchmentBackdrop(1920, 1080);
  g.drawImage(bg, 0, 0);

  const lines = intertitle.lines || [];
  const frameLeft = Number(viewport.left) || 0;
  const frameWidth = Math.max(1, Math.min(1920, Number(viewport.width) || 1920));
  const centerX = Number.isFinite(Number(viewport.centerX)) ? Number(viewport.centerX) : frameLeft + frameWidth * 0.5;
  const maxTextW = Math.max(140, frameWidth - 80);
  const lh = 64;
  const y0 = 540 - ((lines.length - 1) * lh) * 0.5;
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1 && lines.length > 1;
    let size = isLast ? 46 : 38;
    const weight = 'bold';
    while (size > 18) {
      g.font = `${weight} ${size}px PopB`;
      if (g.measureText(String(ln)).width <= maxTextW) break;
      size -= 1;
    }
    g.font = `${weight} ${size}px PopB`;
    g.fillStyle = isLast ? CRIMSON : INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(ln), centerX, y0 + idx * lh, maxTextW);
  });
  g.restore();
}

function isParchmentScene(sc) {
  return Boolean(
    sc &&
      sc.setting &&
      (sc.setting.style === 'parchment' ||
        (typeof sc.setting.backdrop === 'string' && sc.setting.backdrop.startsWith('parchment_')))
  );
}

module.exports = {
  INK,
  CRIMSON,
  PAPER_LIGHT,
  getParchmentBackdrop,
  isParchmentScene,
  drawParchmentEnvironment,
  drawParchmentForeground,
  drawInkStickFigure,
  drawParchmentHeadline,
  drawParchmentSubtitle,
  drawParchmentIntertitle,
};
