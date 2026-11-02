'use strict';
/**
 * "The Wall You Agreed With" — set extension for a 45-second parchment-and-ink short.
 *
 * The film is a single-gag fable: a stick figure walks into an invisible wall, decides it is
 * permanent, and then watches someone else stroll through the same spot. So the whole picture
 * depends on four things reading instantly at 1080p:
 *
 *   1. an empty stage with no clutter that could be mistaken for the wall,
 *   2. a *ghost* wall the audience can see and the characters cannot,
 *   3. the contact moment (impact burst, rebound),
 *   4. the crossing moment (ripple arcs) — the visual punchline.
 *
 * Everything here is drawn in the same ink vocabulary as `parchment_ink_style.js` (hand-bowed
 * lines, warm paper fills, crimson accents) and dispatched from that module, exactly the way
 * `beacon_harbor.js` extends the harbor set.
 */

const { clamp, lerp, ease, eo, hexToRgb, ca } = require('./character_rig');

const INK = '#1b1713';
const CRIMSON = '#d9383a';
const PAPER = '#f7eedb';
const PAPER_LIGHT = '#fdf7e9';

// Every full-width wash must cover the pannable world extent, or a hard vertical seam appears
// mid-shot once the camera zooms/pans (the bug fixed on the harbor set — do not repeat it).
const VIEW_L = -1600;
const VIEW_R = 3520;
const VIEW_W = VIEW_R - VIEW_L;

const WALL_BACKDROPS = Object.freeze(['parchment_wall']);

/* -------------------------------------------------------------------------------------------
 * ink helpers (same hand-bowed vocabulary as parchment_ink_style)
 * ----------------------------------------------------------------------------------------- */

function wobble(t, seed = 0, amp = 1) {
  return Math.sin(t * 1.7 + seed * 2.3) * amp + Math.sin(t * 3.1 + seed) * amp * 0.45;
}

function inkLine(g, x1, y1, x2, y2, w = 3.4, bow = 1.2, color = INK) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (x1 + x2) * 0.5 - (dy / len) * bow;
  const my = (y1 + y2) * 0.5 + (dx / len) * bow;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo(mx, my, x2, y2);
  g.stroke();
  g.restore();
}

/** Hand-bowed closed polygon — used for crates and the chalk doorway. */
function inkPoly(g, pts, fill = PAPER_LIGHT, w = 3.2, color = INK, bow = 0.8) {
  g.save();
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    g.quadraticCurveTo(
      (ax + bx) * 0.5 - (dy / len) * bow,
      (ay + by) * 0.5 + (dx / len) * bow,
      bx,
      by
    );
  }
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.strokeStyle = color;
  g.lineWidth = w;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}

function paperPlate(g, cx, cy, w, h, alpha = 1) {
  const x = cx - w * 0.5;
  const y = cy - h * 0.5;
  const grad = g.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0.0, `rgba(247,238,219,0)`);
  grad.addColorStop(0.16, `rgba(247,238,219,${ca(0.86 * alpha)})`);
  grad.addColorStop(0.84, `rgba(247,238,219,${ca(0.86 * alpha)})`);
  grad.addColorStop(1.0, `rgba(247,238,219,0)`);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
}

/* -------------------------------------------------------------------------------------------
 * Backdrop: a deliberately empty stage
 * ----------------------------------------------------------------------------------------- */

function drawWallBackdrop(g, setting, globalT, ts, floorY, W = 1920, H = 1080) {
  const st = setting || {};

  // 1. Warm paper ground — full pannable extent.
  const sky = g.createLinearGradient(0, -40, 0, floorY);
  sky.addColorStop(0.0, '#f6ecd6');
  sky.addColorStop(0.55, '#f3e5ca');
  sky.addColorStop(1.0, '#ead8b6');
  g.fillStyle = sky;
  g.fillRect(VIEW_L, -40, VIEW_W, floorY + 40);

  // 2. A single low horizon, far away, so the empty space reads as *space*, not as a missing
  //    background. Two soft hills, then a long flat line.
  g.save();
  g.globalAlpha = 0.5;
  g.fillStyle = 'rgba(120, 92, 52, 0.10)';
  g.beginPath();
  g.moveTo(VIEW_L, floorY - 120);
  for (let x = VIEW_L; x <= VIEW_R; x += 40) {
    const h = Math.sin(x / 520) * 26 + Math.sin(x / 210 + 1.7) * 11;
    g.lineTo(x, floorY - 132 + h);
  }
  g.lineTo(VIEW_R, floorY);
  g.lineTo(VIEW_L, floorY);
  g.closePath();
  g.fill();
  g.restore();

  // 3. Ink horizon stroke, hand-bowed across the whole extent.
  g.save();
  g.strokeStyle = 'rgba(27,23,19,0.34)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(VIEW_L, floorY - 132);
  for (let x = VIEW_L; x <= VIEW_R; x += 30) {
    const h = Math.sin(x / 520) * 26 + Math.sin(x / 210 + 1.7) * 11;
    g.lineTo(x, floorY - 132 + h);
  }
  g.stroke();
  g.restore();

  // 4. Floor: a warm plane plus long perspective lines that drift past the camera, giving the
  //    pan something to move against.
  g.fillStyle = '#e9d6b2';
  g.fillRect(VIEW_L, floorY, VIEW_W, H - floorY + 60);
  g.save();
  g.strokeStyle = 'rgba(120, 92, 52, 0.20)';
  g.lineWidth = 1.6;
  for (let i = -14; i <= 26; i++) {
    const x = i * 168;
    g.beginPath();
    g.moveTo(x, floorY);
    g.lineTo(x + (x - W * 0.5) * 0.42, H);
    g.stroke();
  }
  g.restore();

  // 5. Contact shadow band where the stage floor meets the horizon.
  const band = g.createLinearGradient(0, floorY - 26, 0, floorY + 8);
  band.addColorStop(0, 'rgba(120, 92, 52, 0)');
  band.addColorStop(1, 'rgba(120, 92, 52, 0.13)');
  g.fillStyle = band;
  g.fillRect(VIEW_L, floorY - 26, VIEW_W, 34);

  // 6. Two far fence posts for scale reference (one left, one right, well outside the action).
  [0.055, 0.94].forEach((fx, i) => {
    const px = fx * W;
    g.save();
    g.globalAlpha = 0.34;
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(px, floorY - 6);
    g.lineTo(px, floorY - 132);
    g.stroke();
    g.beginPath();
    g.moveTo(px - 16, floorY - 118);
    g.lineTo(px + 16, floorY - 118);
    g.stroke();
    g.restore();
  });

  // 7. Optional dusk warmth, so a scene can shift hour without a new backdrop.
  const hour = String(st.hour || 'day');
  if (hour === 'dusk' || hour === 'night') {
    const dusk = g.createLinearGradient(0, -40, 0, floorY);
    dusk.addColorStop(0, hour === 'night' ? 'rgba(52, 44, 74, 0.30)' : 'rgba(196, 122, 58, 0.20)');
    dusk.addColorStop(1, 'rgba(196, 122, 58, 0.02)');
    g.fillStyle = dusk;
    g.fillRect(VIEW_L, -40, VIEW_W, floorY + 40);
  }

  // 8. A slow drifting mote or two keeps a static frame alive during long holds.
  g.save();
  g.fillStyle = 'rgba(120, 92, 52, 0.16)';
  for (let i = 0; i < 7; i++) {
    const t0 = globalT * (0.05 + i * 0.007) + i * 1.9;
    const x = ((t0 * 190) % (VIEW_W + 400)) + VIEW_L - 200;
    const y = H * 0.14 + ((i * 137 + Math.sin(t0) * 26) % (H * 0.42));
    g.beginPath();
    g.arc(x, y, 2.1 + (i % 3) * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/* -------------------------------------------------------------------------------------------
 * Props
 * ----------------------------------------------------------------------------------------- */

/**
 * The invisible wall.
 *
 * `mode`:
 *   'ghost'  — dashed ink outline + faint hatching + a slow shimmer band travelling up. The
 *              audience sees it; the characters do not. This is the default and the joke.
 *   'agreed' — solid enough to read as "real", used the instant before impact.
 *   'open'   — the outline only, no hatching: something has stopped agreeing with it.
 *
 * `beat_at` drives a short compression pulse so the wall *reacts* to being hit.
 */
function drawWallSlab(g, prop, px, floorY, t, ts, s, W = 1920, H = 1080) {
  const h = (prop.height ?? H * 0.28) * s;
  const w = (prop.width ?? W * 0.145) * s;
  const mode = prop.mode || 'ghost';
  const top = floorY - h;
  const left = px - w * 0.5;
  const hitAts = Array.isArray(prop.hit_ats) ? prop.hit_ats.map(Number) : [];
  let pulse = 0;
  for (const at of hitAts) {
    const d = ts - at;
    if (d >= 0 && d < 0.55) pulse = Math.max(pulse, 1 - d / 0.55);
  }
  const squeeze = 1 + pulse * 0.035;
  const alpha = mode === 'agreed' ? 0.62 : mode === 'open' ? 0.22 : 0.36;

  g.save();
  g.translate(px, floorY);
  g.scale(1 / squeeze, squeeze);
  g.translate(-px, -floorY);

  // Faint paper fill so the wall is a *place*, never an object.
  if (mode !== 'open') {
    const fill = g.createLinearGradient(0, top, 0, floorY);
    fill.addColorStop(0, `rgba(247, 238, 219, ${ca(0.10 * (0.5 + alpha))})`);
    fill.addColorStop(1, `rgba(120, 92, 52, ${ca(0.10 * (0.5 + alpha))})`);
    g.fillStyle = fill;
    g.fillRect(left, top, w, h);
  }

  // Dashed outline: the shape of an agreement.
  g.save();
  g.strokeStyle = `rgba(27, 23, 19, ${ca(alpha * 1.55)})`;
  g.lineWidth = 2.6;
  g.setLineDash([13, 11]);
  g.lineDashOffset = -t * 22;
  g.beginPath();
  g.roundRect(left, top, w, h, 5);
  g.stroke();
  g.restore();

  // Brick hatching — horizontal courses, no vertical joints, so it reads as *surface*.
  if (mode !== 'open') {
    g.save();
    g.strokeStyle = `rgba(27, 23, 19, ${ca(alpha * 0.62)})`;
    g.lineWidth = 1.7;
    const rows = Math.max(3, Math.floor(h / 96));
    for (let r = 1; r < rows; r++) {
      const y = top + (h / rows) * r;
      const jog = Math.sin(r * 2.1 + t * 0.35) * 1.6;
      g.beginPath();
      g.moveTo(left + 5, y + jog);
      g.lineTo(left + w - 5, y + jog);
      g.stroke();
    }
    g.restore();
  }

  // Shimmer band: a slow vertical sweep proving the surface is *there* and *thin*.
  const sweep = ((t * 0.34 + (prop.shimmer_offset ?? 0)) % 1.6) - 0.3;
  if (sweep > -0.1 && sweep < 1.1) {
    const sy = top + h * sweep;
    const bandGrad = g.createLinearGradient(0, sy - 60, 0, sy + 60);
    bandGrad.addColorStop(0, 'rgba(255, 252, 240, 0)');
    bandGrad.addColorStop(0.5, 'rgba(255, 252, 240, 0.30)');
    bandGrad.addColorStop(1, 'rgba(255, 252, 240, 0)');
    g.save();
    g.beginPath();
    g.rect(left + 2, top, w - 4, h);
    g.clip();
    g.fillStyle = bandGrad;
    g.fillRect(left, sy - 60, w, 120);
    g.restore();
  }
  g.restore();
}

/**
 * Ripple arcs at a crossing point — the punchline. A figure walks *through* the wall and the
 * wall answers with three expanding, fading rings.
 */
function drawWallRipple(g, prop, px, floorY, ts, s) {
  const at = Number(prop.at ?? 0);
  const baseY = floorY - (prop.height ?? 250) * s;
  const events = Array.isArray(prop.at_many) ? prop.at_many.map(Number) : [at];
  g.save();
  for (const ev of events) {
    const d = ts - ev;
    if (d < 0 || d > 2.4) continue;
    for (let ring = 0; ring < 3; ring++) {
      const dd = d - ring * 0.16;
      if (dd < 0) continue;
      const u = clamp(dd / 1.9);
      const rx = (26 + u * 150) * s;
      const ry = (18 + u * 112) * s;
      g.strokeStyle = `rgba(217, 56, 58, ${ca(0.42 * (1 - u) * (1 - ring * 0.24))})`;
      g.lineWidth = (3.1 - ring * 0.6) * s;
      g.beginPath();
      g.ellipse(px, baseY, rx, ry, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
}

/** Impact burst: ink spikes + a short shock ring, at the exact contact frame. */
function drawImpactStar(g, prop, px, floorY, ts, s) {
  const at = Number(prop.at ?? 0);
  const d = ts - at;
  if (d < 0 || d > 0.75) return;
  const u = clamp(d / 0.75);
  const cy = floorY - (prop.height ?? 300) * s;
  const x = px + (prop.dx ?? 0) * s;
  const a = (1 - u) ** 1.6;

  g.save();
  g.translate(x, cy);
  // Star spikes
  g.strokeStyle = `rgba(27, 23, 19, ${ca(0.85 * a)})`;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.22;
    const r0 = 16 + u * 26;
    const r1 = 34 + u * 96;
    g.lineWidth = (5.2 - i * 0.14) * (1 - u * 0.45);
    g.beginPath();
    g.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0 * 0.86);
    g.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1 * 0.86);
    g.stroke();
  }
  // Shock ring
  g.strokeStyle = `rgba(217, 56, 58, ${ca(0.55 * a)})`;
  g.lineWidth = 3.2;
  g.beginPath();
  g.arc(0, 0, 26 + u * 118, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** "!!" above the head — the jaw-drop beat, drawn rather than rigged. */
function drawShockMarks(g, prop, px, floorY, ts, s) {
  const at = Number(prop.at ?? 0);
  const hold = Number(prop.hold ?? 1.6);
  const d = ts - at;
  if (d < 0 || d > hold) return;
  const inU = eo(clamp(d / 0.18));
  const outU = 1 - ease(clamp((d - (hold - 0.35)) / 0.35));
  const a = inU * outU;
  const x = px + (prop.dx ?? 0) * s;
  const y = floorY - (prop.height ?? 470) * s;
  const pop = 1 + Math.sin(clamp(d / 0.4) * Math.PI) * 0.16;

  g.save();
  g.translate(x, y);
  g.scale(pop, pop);
  g.rotate(-0.06);
  g.fillStyle = `rgba(217, 56, 58, ${ca(0.94 * a)})`;
  g.font = `bold ${Math.round(72 * s)}px PopB`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillText('!', -20 * s, 0);
  g.fillText('!', 22 * s, -18 * s);
  g.restore();
}

/** A door sketched in crimson chalk on the (ghost) wall, with a drifting chalk dust puff. */
function drawChalkDoor(g, prop, px, floorY, ts, s) {
  const at = Number(prop.at ?? 0);
  const dw = 118 * s;
  const dh = 300 * s;
  const top = floorY - dh;
  const left = px - dw * 0.5;
  const draw = eo(clamp((ts - at) / 0.7));
  if (draw <= 0.01) return;

  g.save();
  g.globalAlpha = draw;
  // Crimson chalk stroke, doubled for a hand-drawn look.
  for (const [off, alpha, wid] of [[0, 0.92, 4.6], [2.2, 0.34, 1.8]]) {
    g.strokeStyle = `rgba(217, 56, 58, ${alpha})`;
    g.lineWidth = wid;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(left + off, floorY);
    g.lineTo(left + off, top + 4);
    g.quadraticCurveTo(px + off, top - 16, left + dw + off, top + 4);
    g.lineTo(left + dw + off, floorY);
    g.stroke();
  }
  // Knob
  g.fillStyle = 'rgba(217, 56, 58, 0.9)';
  g.beginPath();
  g.arc(left + dw * 0.82, floorY - dh * 0.48, 5.4 * s, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Chalk dust: a few specks that fall and fade right after the door is drawn.
  const dust = clamp((ts - at - 0.55) / 1.5);
  if (dust > 0 && dust < 1) {
    g.save();
    for (let i = 0; i < 11; i++) {
      const seed = i * 1.618;
      const dx = Math.sin(seed * 3.1) * 52 * s;
      const dy = -((dust * 150 + seed * 13) % 190) * s;
      const a = (1 - dust) * 0.5;
      g.fillStyle = `rgba(217, 56, 58, ${ca(a)})`;
      g.beginPath();
      g.arc(px + dx, floorY - 40 + dy, 2.4 * s, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

/** A stack of crates to climb — three boxes, slightly askew so it looks hand-placed. */
function drawBoxStack(g, prop, px, floorY, t, s) {
  const n = Math.max(1, Math.min(4, Number(prop.count ?? 3)));
  const bw = 86 * s;
  const bh = 66 * s;
  const colours = ['#f1e2c4', '#e8d3ad', '#f5e9cf', '#e3cda6'];
  for (let i = 0; i < n; i++) {
    const y = floorY - (i + 1) * bh;
    const jitterX = Math.sin(i * 2.4) * 7 * s;
    const jitterY = Math.cos(i * 1.7) * 2 * s;
    const x = px - bw * 0.5 + jitterX;
    inkPoly(
      g,
      [
        [x, y + jitterY],
        [x + bw, y - 2 + jitterY],
        [x + bw - 2, y + bh + jitterY],
        [x + 2, y + bh + 2 + jitterY],
      ],
      colours[i % colours.length],
      3.0,
      INK,
      0.7
    );
    // Crate cross-brace
    inkLine(g, x + 8, y + 10 + jitterY, x + bw - 10, y + bh - 8 + jitterY, 1.7, 0.6);
    inkLine(g, x + bw - 10, y + 10 + jitterY, x + 8, y + bh - 8 + jitterY, 1.7, -0.6);
  }
  // Ground shadow
  g.save();
  g.fillStyle = 'rgba(42, 30, 16, 0.12)';
  g.beginPath();
  g.ellipse(px, floorY + 3 * s, bw * 0.62, 7 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * Big on-screen caption — the film's TEXT beats.
 *
 * Drawn on its own paper plate so it stays legible over the ink stage, with the accent phrase in
 * crimson exactly like the chapter headlines elsewhere in the toolbook.
 */
function drawCaption(g, prop, px, floorY, ts, W = 1920) {
  const at = Number(prop.at ?? 0);
  const until = Number(prop.until ?? at + 4.4);
  if (ts < at || ts > until) return;
  const inU = eo(clamp((ts - at) / 0.28));
  const outU = 1 - ease(clamp((ts - (until - 0.34)) / 0.34));
  const a = inU * outU;
  if (a <= 0.01) return;

  const lead = String(prop.text ?? '');
  const accent = String(prop.accent ?? '');
  const cx = (prop.x ?? 0.5) * W;
  const maxW = Number(prop.max_width ?? W * 0.86);

  // Captions are the film's dialogue, so they must stay readable: shrink a little, but when a line
  // is still too wide, wrap it in two balanced lines rather than shrinking into illegibility.
  const words = `${lead} ${accent}`.trim().split(/\s+/).filter(Boolean);
  const leadWordCount = lead.trim() ? lead.trim().split(/\s+/).length : 0;

  const measureLine = (txt, sz) => {
    g.font = `bold ${sz}px PopB`;
    return g.measureText(txt).width;
  };
  const layoutFor = (sz, splitIdx) => {
    // splitIdx = null -> single line; otherwise line1 = words[0:splitIdx], line2 = the rest
    const l1 = splitIdx === null ? words.join(' ') : words.slice(0, splitIdx).join(' ');
    const l2 = splitIdx === null ? '' : words.slice(splitIdx).join(' ');
    const w1 = measureLine(l1, sz);
    const w2 = l2 ? measureLine(l2, sz) : 0;
    return { l1, l2, w1, w2, widest: Math.max(w1, w2) };
  };

  let size = Number(prop.size ?? 84);
  let split = null;
  let lay = layoutFor(size, null);
  if (lay.widest > maxW) {
    // try a balanced two-line split
    const mid = Math.ceil(words.length / 2);
    let best = null;
    for (let k = Math.max(1, mid - 3); k <= Math.min(words.length - 1, mid + 3); k++) {
      const cand = layoutFor(size, k);
      if (!best || cand.widest < best.widest) best = { k, ...cand };
    }
    if (best && best.widest < lay.widest) {
      split = best.k;
      lay = best;
    }
    if (lay.widest > maxW) {
      size = Math.max(30, Math.floor((size * maxW) / lay.widest));
      lay = layoutFor(size, split);
    }
    if (lay.widest > maxW) {
      size = Math.max(24, Math.floor((size * maxW) / lay.widest));
      lay = layoutFor(size, split);
    }
  }

  const lines = lay.l2 ? [lay.l1, lay.l2] : [lay.l1];
  const lineH = size * 1.24;
  const blockTop = Number(prop.y ?? 176);
  const plateH = lineH * lines.length + size * 0.62;
  g.save();
  g.globalAlpha = a;
  g.font = `bold ${size}px PopB`;
  g.textBaseline = 'middle';

  const lift = (1 - inU) * 14;
  paperPlate(g, cx, blockTop - lift + ((lines.length - 1) * lineH) / 2, lay.widest + 96, plateH, a);

  // Colour each word the way it was authored: lead in ink, accent phrase in crimson.
  const drawWords = (txt, startWordIdx, y) => {
    const ws = txt.split(' ');
    let total = 0;
    for (const w of ws) total += measureLine(w + ' ', size);
    let x = cx - (total - measureLine(' ', size)) * 0.5;
    ws.forEach((w, i) => {
      const isAccent = startWordIdx + i >= leadWordCount && accent;
      g.fillStyle = isAccent ? CRIMSON : INK;
      g.textAlign = 'left';
      g.fillText(w, x, y);
      x += measureLine(w + ' ', size);
    });
    return total;
  };

  let wordIdx = 0;
  lines.forEach((ln, i) => {
    const y = blockTop - lift + i * lineH;
    drawWords(ln, wordIdx, y);
    wordIdx += ln.split(' ').length;
  });

  const ruleW = (lay.widest + 40) * clamp((ts - at) / 0.5);
  g.strokeStyle = `rgba(27, 23, 19, 0.42)`;
  g.lineWidth = 2.4;
  g.beginPath();
  const ruleY = blockTop - lift + (lines.length - 1) * lineH + size * 0.62;
  g.moveTo(cx - ruleW * 0.5, ruleY);
  g.lineTo(cx + ruleW * 0.5, ruleY);
  g.stroke();
  g.restore();

}

/* -------------------------------------------------------------------------------------------
 * Dispatch
 * ----------------------------------------------------------------------------------------- */

const WALL_PROPS = Object.freeze([
  'wall_slab',
  'wall_ripple',
  'impact_star',
  'shock_marks',
  'chalk_door',
  'box_stack',
  'ink_caption',
]);

function drawWallProp(g, prop, W, floorY, t, sceneT = null, sIn = null, H = 1080) {
  const ts = sceneT !== null && sceneT !== undefined ? sceneT : t;
  const s = sIn ?? prop.scale ?? 1.0;
  const px = (prop.x ?? 0.5) * W;

  switch (prop.type) {
    case 'wall_slab':
      drawWallSlab(g, prop, px, floorY, t, ts, s, W, H);
      return;
    case 'wall_ripple':
      drawWallRipple(g, prop, px, floorY, ts, s);
      return;
    case 'impact_star':
      drawImpactStar(g, prop, px, floorY, ts, s);
      return;
    case 'shock_marks':
      drawShockMarks(g, prop, px, floorY, ts, s);
      return;
    case 'chalk_door':
      drawChalkDoor(g, prop, px, floorY, ts, s);
      return;
    case 'box_stack':
      drawBoxStack(g, prop, px, floorY, t, s);
      return;
    case 'ink_caption':
      drawCaption(g, prop, px, floorY, ts, W);
      return;
    default:
      return;
  }
}

module.exports = {
  INK,
  CRIMSON,
  WALL_BACKDROPS,
  WALL_PROPS,
  drawWallBackdrop,
  drawWallProp,
};
