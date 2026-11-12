'use strict';

/**
 * "Doodle Date" board set.
 *
 * The film's whole conceit is that the two artists draw objects in the air and the drawings
 * pop into the parchment world. Stock boards (stat_cards, notebook_page, …) cannot render
 * a rose or a cartoon dragon, so this module adds one board type — `doodle` — whose
 * `board.doodle` field selects the drawing. Everything is ink line art on the parchment
 * page with a single crimson accent, matching the film's visual identity.
 *
 * Dispatch: engine/world_props_and_boards.js requires this module, adds 'doodle' to
 * SUPPORTED_BOARDS and calls drawDoodleBoard() from inside drawWorldBoard(). Each drawing
 * animates its strokes in with the board's own draw-on progress `u` (0..1, already eased by
 * the caller); looped flourishes (sparkles, wheel spokes, vortex swirl) read `t` (scene
 * seconds) so they keep living after the pen lifts.
 *
 * Supported `doodle` values: rose, necklace, car, jetpack, castle, dragon, black_hole,
 * taco, hearts, subscribe.
 */

const { clamp, lerp, ease } = require('./character_rig');

const INK = '#1a1612';
const INK_SOFT = 'rgba(26, 22, 18, 0.55)';
const INK_FAINT = 'rgba(26, 22, 18, 0.20)';
const PAPER = '#f7ebd4';
const CRIMSON = '#cc292b';
const CRIMSON_SOFT = 'rgba(204, 41, 43, 0.85)';
const GOLD_WASH = 'rgba(222, 184, 94, 0.45)';

const DOODLE_PROPS = Object.freeze([
  'rose',
  'necklace',
  'car',
  'jetpack',
  'castle',
  'dragon',
  'black_hole',
  'taco',
  'hearts',
  'subscribe',
  'notepad',
]);
const DOODLE_SET = new Set(DOODLE_PROPS);

// Local segment helpers (kept dependency-light on purpose).
const K = (t, a, b) => (b <= a ? 1 : clamp((t - a) / (b - a)));
const seg = (u, a, b) => ease(clamp((u - a) / Math.max(1e-6, b - a)));

function inkStroke(g, lw) {
  g.strokeStyle = INK;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
}

/** Draw `points` (polyline) partially: the drawn fraction f of the total path length. */
function partialPolyline(g, points, f) {
  if (f <= 0.001) return;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  let target = total * clamp(f);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (target <= len || i === points.length - 1) {
      const s = len > 0 ? clamp(target / len) : 1;
      g.lineTo(x0 + (x1 - x0) * s, y0 + (y1 - y0) * s);
      g.stroke();
      return;
    }
    g.lineTo(x1, y1);
    target -= len;
  }
  g.stroke();
}

/** Tesselate a quadratic bezier into `n` points so partialPolyline can draw it on. */
function quadPoints(p0, p1, p2, n = 26) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return pts;
}

const cubicPoints = (p0, p1, p2, p3, n = 30) => {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const mt = 1 - t;
    pts.push([
      mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
      mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
};

function star4(g, cx, cy, r, alpha, color) {
  if (alpha <= 0.02) return;
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = Math.max(1.6, r * 0.16);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - r, cy); g.lineTo(cx + r, cy);
  g.moveTo(cx, cy - r); g.lineTo(cx, cy + r);
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function heartPath(g, cx, cy, s) {
  // Classic bezier heart, apex at bottom.
  g.beginPath();
  g.moveTo(cx, cy + s * 0.78);
  g.bezierCurveTo(cx - s * 1.15, cy - s * 0.05, cx - s * 0.72, cy - s * 0.92, cx, cy - s * 0.28);
  g.bezierCurveTo(cx + s * 0.72, cy - s * 0.92, cx + s * 1.15, cy - s * 0.05, cx, cy + s * 0.78);
  g.closePath();
}

/* ------------------------------------------------------------------ */
/* Individual doodles. All receive a unit box (bx, by, bw, bh) and u/t. */
/* ------------------------------------------------------------------ */

function drawRose(g, bx, by, bw, bh, u, t) {
  const cx = bx + bw * 0.5;
  const s = Math.min(bw, bh) / 260;
  const baseY = by + bh * 0.97;
  const topY = by + bh * 0.30;
  inkStroke(g, 4.2 * s);
  partialPolyline(g, cubicPoints([cx, baseY], [cx - 14 * s, by + bh * 0.74], [cx + 13 * s, by + bh * 0.52], [cx, topY]), seg(u, 0.0, 0.45));
  // Thorns
  const thornU = seg(u, 0.28, 0.5);
  if (thornU > 0.02) {
    g.save();
    g.lineWidth = 3 * s;
    g.beginPath();
    g.moveTo(cx - 1 * s, by + bh * 0.66);
    g.lineTo(cx - 13 * s, by + bh * 0.60);
    g.moveTo(cx + 1 * s, by + bh * 0.53);
    g.lineTo(cx + 12 * s, by + bh * 0.47);
    g.stroke();
    g.restore();
  }
  // Leaves
  const leafL = seg(u, 0.22, 0.5);
  if (leafL > 0.01) {
    g.save();
    g.globalAlpha *= leafL;
    inkStroke(g, 3.4 * s);
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(cx, by + bh * 0.68);
    g.quadraticCurveTo(cx - 46 * s, by + bh * 0.66, cx - 62 * s, by + bh * 0.44);
    g.quadraticCurveTo(cx - 22 * s, by + bh * 0.47, cx, by + bh * 0.62);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
  const leafR = seg(u, 0.32, 0.6);
  if (leafR > 0.01) {
    g.save();
    g.globalAlpha *= leafR;
    inkStroke(g, 3.4 * s);
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(cx, by + bh * 0.55);
    g.quadraticCurveTo(cx + 44 * s, by + bh * 0.53, cx + 58 * s, by + bh * 0.33);
    g.quadraticCurveTo(cx + 20 * s, by + bh * 0.34, cx, by + bh * 0.49);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
  // Bloom: soft crimson wash + three nested arcs + center curl.
  const bloomWash = seg(u, 0.42, 0.75);
  if (bloomWash > 0.01) {
    g.save();
    g.globalAlpha *= bloomWash * 0.35;
    g.fillStyle = CRIMSON;
    g.beginPath();
    g.arc(cx, by + bh * 0.215, 34 * s, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.save();
  g.strokeStyle = CRIMSON;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const bloomY = by + bh * 0.215;
  const arcs = [
    { r: 33 * s, from: -0.5, to: 3.6, u0: 0.4, u1: 0.78, lw: 4.6 * s },
    { r: 22.5 * s, from: 1.8, to: 1.8 + 4.6, u0: 0.55, u1: 0.88, lw: 4.2 * s },
    { r: 12.5 * s, from: 3.4, to: 3.4 + 4.9, u0: 0.68, u1: 0.96, lw: 3.8 * s },
  ];
  for (const a of arcs) {
    const au = seg(u, a.u0, a.u1);
    if (au <= 0.01) continue;
    g.lineWidth = a.lw;
    g.beginPath();
    g.arc(cx, bloomY, a.r, a.from, a.from + (a.to - a.from) * au);
    g.stroke();
  }
  const curl = seg(u, 0.82, 1);
  if (curl > 0.01) {
    g.lineWidth = 3.2 * s;
    g.beginPath();
    g.arc(cx, bloomY, 5 * s, 0, Math.PI * 2 * curl);
    g.stroke();
  }
  g.restore();
}

function drawNecklace(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 220;
  const p0 = [bx + bw * 0.24, by + bh * 0.08];
  const p1 = [bx + bw * 0.5, by + bh * 0.62];
  const p2 = [bx + bw * 0.76, by + bh * 0.08];
  inkStroke(g, 3.1 * s);
  partialPolyline(g, quadPoints(p0, p1, p2), seg(u, 0.0, 0.38));
  // Pendant bail
  const bail = seg(u, 0.32, 0.48);
  const pendantTopY = by + bh * 0.50;
  if (bail > 0.01) {
    g.save();
    g.globalAlpha *= bail;
    inkStroke(g, 2.6 * s);
    g.beginPath();
    g.arc(bx + bw * 0.5, pendantTopY, 4.6 * s, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  // Diamond pendant (rhombus) with girdle facet.
  const dia = seg(u, 0.38, 0.8);
  if (dia > 0.01) {
    const cx = bx + bw * 0.5;
    const top = [cx, by + bh * 0.52];
    const right = [bx + bw * 0.72, by + bh * 0.68];
    const bottom = [cx, by + bh * 0.95];
    const left = [bx + bw * 0.28, by + bh * 0.68];
    g.save();
    g.globalAlpha *= dia;
    g.fillStyle = '#fffdf2';
    inkStroke(g, 4 * s);
    g.beginPath();
    g.moveTo(top[0], top[1]);
    g.lineTo(right[0], right[1]);
    g.lineTo(bottom[0], bottom[1]);
    g.lineTo(left[0], left[1]);
    g.closePath();
    g.fill(); g.stroke();
    // Facet lines
    inkStroke(g, 2 * s);
    g.beginPath();
    g.moveTo(left[0], left[1]); g.lineTo(right[0], right[1]);
    g.moveTo(top[0], top[1]); g.lineTo(bx + bw * 0.385, by + bh * 0.68);
    g.moveTo(top[0], top[1]); g.lineTo(bx + bw * 0.615, by + bh * 0.68);
    g.moveTo(bx + bw * 0.385, by + bh * 0.68); g.lineTo(bottom[0], bottom[1]);
    g.moveTo(bx + bw * 0.615, by + bh * 0.68); g.lineTo(bottom[0], bottom[1]);
    g.stroke();
    g.restore();
  }
  // Sparkles (looped, time-based twinkle)
  const tw = seg(u, 0.55, 0.85);
  if (tw > 0.02) {
    const stars = [[0.5, 0.30, 0], [0.22, 0.52, 2.1], [0.78, 0.52, 4.2]];
    stars.forEach(([fx, fy, phase], idx) => {
      const a = Math.pow(Math.max(0, Math.sin(t * 2.7 + phase)), 3) * tw;
      star4(g, bx + bw * fx, by + bh * fy, 11 * s, a, idx === 0 ? CRIMSON : INK);
    });
  }
}

function drawCar(g, bx, by, bw, bh, u, t) {
  const s = bh / 260;
  const X = (f) => bx + bw * f;
  const Y = (f) => by + bh * f;
  const body = seg(u, 0.0, 0.55);
  if (body > 0.01) {
    g.save();
    g.globalAlpha *= body;
    inkStroke(g, 4.6 * s);
    g.fillStyle = PAPER;
    const pts = cubicPoints(
      [X(0.025), Y(0.66)],
      [X(0.10), Y(0.52)],
      [X(0.26), Y(0.475)],
      [X(0.36), Y(0.455)],
      12,
    );
    partialPolyline(g, pts, clamp(body * 1.6));
    // Cabin + tail (full body outline drawn as second pass once base stroke lands)
    if (body > 0.35) {
      const cabin = seg(u, 0.3, 0.72);
      g.globalAlpha *= cabin;
      const cabinPts = cubicPoints(
        [X(0.36), Y(0.455)],
        [X(0.44), Y(0.30)],
        [X(0.50), Y(0.215)],
        [X(0.66), Y(0.21)],
        14,
      );
      partialPolyline(g, cabinPts, cabin);
      const tailPts = cubicPoints(
        [X(0.66), Y(0.21)],
        [X(0.77), Y(0.23)],
        [X(0.83), Y(0.35)],
        [X(0.895), Y(0.445)],
        14,
      );
      partialPolyline(g, tailPts, cabin);
      inkStroke(g, 4.6 * s);
      partialPolyline(g, [[X(0.895), Y(0.445)], [X(0.955), Y(0.46)], [X(0.965), Y(0.62)], [X(0.90), Y(0.655)], [X(0.025), Y(0.66)]], clamp((cabin - 0.35) * 1.7));
    }
    g.restore();
  }
  // Cockpit inner line
  const canopy = seg(u, 0.35, 0.68);
  if (canopy > 0.01) {
    g.save();
    g.globalAlpha *= canopy;
    inkStroke(g, 2.6 * s);
    partialPolyline(g, cubicPoints(
      [X(0.415), Y(0.44)], [X(0.485), Y(0.315)], [X(0.55), Y(0.265)], [X(0.665), Y(0.26)], 16,
    ), canopy);
    g.restore();
  }
  // Crimson side blade
  const blade = seg(u, 0.5, 0.75);
  if (blade > 0.01) {
    g.save();
    g.globalAlpha *= blade;
    g.strokeStyle = CRIMSON;
    g.lineWidth = 4.2 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(X(0.16), Y(0.575));
    g.lineTo(X(0.16 + 0.70 * blade), Y(0.555));
    g.stroke();
    g.restore();
  }
  // Wheels with slow-spinning spokes
  const wheelU = seg(u, 0.45, 0.8);
  if (wheelU > 0.01) {
    for (const fx of [0.235, 0.755]) {
      const wx = X(fx), wy = Y(0.665), r = 0.092 * bh;
      g.save();
      g.globalAlpha *= wheelU;
      inkStroke(g, 4.4 * s);
      g.fillStyle = PAPER;
      g.beginPath();
      g.arc(wx, wy, r, 0, Math.PI * 2);
      g.fill(); g.stroke();
      g.beginPath();
      g.arc(wx, wy, r * 0.44, 0, Math.PI * 2);
      g.stroke();
      // Spokes creep slowly — a parked dream car with a lazy pulse.
      g.lineWidth = 2.2 * s;
      for (let i = 0; i < 4; i++) {
        const a = t * 0.9 + (i * Math.PI) / 2;
        g.beginPath();
        g.moveTo(wx, wy);
        g.lineTo(wx + Math.cos(a) * r * 0.42, wy + Math.sin(a) * r * 0.42);
        g.stroke();
      }
      g.restore();
    }
  }
  // Ground line + speed dashes
  const ground = seg(u, 0.6, 0.85);
  if (ground > 0.01) {
    g.save();
    g.globalAlpha *= ground * 0.8;
    inkStroke(g, 2.4 * s);
    g.beginPath();
    g.moveTo(X(0.02), Y(0.79));
    g.lineTo(X(0.98), Y(0.79));
    g.stroke();
    g.restore();
  }
  const dashes = seg(u, 0.7, 0.92);
  if (dashes > 0.01) {
    g.save();
    g.globalAlpha *= dashes;
    inkStroke(g, 3 * s);
    for (const [fy, len] of [[0.52, 0.16], [0.62, 0.11], [0.72, 0.19]]) {
      g.beginPath();
      g.moveTo(X(0.13), Y(fy));
      g.lineTo(X(0.13 - len), Y(fy));
      g.stroke();
    }
    g.restore();
  }
}

function drawJetpack(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 230;
  const X = (f) => bx + bw * f;
  const Y = (f) => by + bh * f;
  // Tank
  const tank = seg(u, 0.0, 0.42);
  if (tank > 0.01) {
    g.save();
    g.globalAlpha *= tank;
    g.fillStyle = PAPER;
    inkStroke(g, 4.2 * s);
    g.beginPath();
    g.roundRect(X(0.30), Y(0.18), bw * 0.40, bh * 0.42, 16 * s);
    g.fill(); g.stroke();
    // Cap
    g.beginPath();
    g.roundRect(X(0.375), Y(0.085), bw * 0.25, bh * 0.105, 8 * s);
    g.fill(); g.stroke();
    // Tank band
    inkStroke(g, 2.6 * s);
    g.beginPath();
    g.moveTo(X(0.30), Y(0.36)); g.lineTo(X(0.70), Y(0.36));
    g.stroke();
    g.restore();
  }
  // Straps
  const straps = seg(u, 0.3, 0.55);
  if (straps > 0.01) {
    g.save();
    g.globalAlpha *= straps;
    inkStroke(g, 3 * s);
    g.beginPath();
    g.moveTo(X(0.33), Y(0.22)); g.lineTo(X(0.13), Y(0.47));
    g.moveTo(X(0.67), Y(0.22)); g.lineTo(X(0.87), Y(0.47));
    g.stroke();
    g.restore();
  }
  // Nozzle
  const nozzle = seg(u, 0.45, 0.68);
  if (nozzle > 0.01) {
    g.save();
    g.globalAlpha *= nozzle;
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(X(0.35), Y(0.60));
    g.lineTo(X(0.65), Y(0.60));
    g.lineTo(X(0.575), Y(0.735));
    g.lineTo(X(0.425), Y(0.735));
    g.closePath();
    g.fill();
    g.restore();
  }
  // Flame (flickers with scene clock)
  const flame = seg(u, 0.6, 0.85);
  if (flame > 0.01) {
    const flick = 1 + 0.32 * Math.sin(t * 15.5) + 0.12 * Math.sin(t * 27);
    const apex = 0.735 + 0.20 * flick;
    g.save();
    g.globalAlpha *= flame;
    g.fillStyle = CRIMSON_SOFT;
    g.beginPath();
    g.moveTo(X(0.435), Y(0.735));
    g.lineTo(X(0.565), Y(0.735));
    g.lineTo(X(0.5), Y(apex));
    g.closePath();
    g.fill();
    g.fillStyle = PAPER;
    g.beginPath();
    g.moveTo(X(0.465), Y(0.74));
    g.lineTo(X(0.535), Y(0.74));
    g.lineTo(X(0.5), Y(0.735 + (apex - 0.735) * 0.62));
    g.closePath();
    g.fill();
    g.restore();
  }
  // Lift-off dashes above the cap
  const dash = seg(u, 0.72, 0.95);
  if (dash > 0.01) {
    g.save();
    inkStroke(g, 2.6 * s);
    for (const [fx, ph] of [[0.42, 0], [0.58, 1.7]]) {
      g.globalAlpha *= 0.5 + 0.4 * Math.sin(t * 9 + ph);
      g.beginPath();
      g.moveTo(X(fx), Y(0.045));
      g.lineTo(X(fx), Y(0.005));
      g.stroke();
    }
    g.restore();
  }
}

function drawCastle(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 260;
  const X = (f) => bx + bw * f;
  const Y = (f) => by + bh * f;
  // Ground
  const ground = seg(u, 0.0, 0.22);
  if (ground > 0.01) {
    g.save();
    g.globalAlpha *= ground * 0.85;
    inkStroke(g, 2.6 * s);
    g.beginPath();
    g.moveTo(X(0.02), Y(0.9)); g.lineTo(X(0.98), Y(0.9));
    g.stroke();
    g.restore();
  }
  // Curtain wall with crenels
  const wall = seg(u, 0.18, 0.58);
  if (wall > 0.01) {
    g.save();
    g.globalAlpha *= wall;
    g.fillStyle = PAPER;
    inkStroke(g, 4.2 * s);
    g.beginPath();
    g.rect(X(0.20), Y(0.5), bw * 0.60, bh * 0.4);
    g.fill(); g.stroke();
    // Crenels
    g.fillStyle = PAPER;
    for (let i = 0; i < 5; i++) {
      const cx0 = 0.225 + i * 0.118;
      g.beginPath();
      g.rect(X(cx0), Y(0.415), bw * 0.056, bh * 0.088);
      g.fill(); g.stroke();
    }
    g.restore();
  }
  // Towers + cone roofs
  const towers = seg(u, 0.05, 0.48);
  if (towers > 0.01) {
    for (const tx of [0.075, 0.725]) {
      g.save();
      g.globalAlpha *= towers;
      g.fillStyle = PAPER;
      inkStroke(g, 4.2 * s);
      g.beginPath();
      g.rect(X(tx), Y(0.36), bw * 0.20, bh * 0.54);
      g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(X(tx - 0.035), Y(0.36));
      g.lineTo(X(tx + 0.10), Y(0.155));
      g.lineTo(X(tx + 0.235), Y(0.36));
      g.closePath();
      g.fill(); g.stroke();
      g.restore();
    }
  }
  // Keep + flagpole + crimson pennant
  const keep = seg(u, 0.42, 0.72);
  if (keep > 0.01) {
    g.save();
    g.globalAlpha *= keep;
    g.fillStyle = PAPER;
    inkStroke(g, 4 * s);
    g.beginPath();
    g.rect(X(0.415), Y(0.3), bw * 0.17, bh * 0.22);
    g.fill(); g.stroke();
    inkStroke(g, 2.8 * s);
    g.beginPath();
    g.moveTo(X(0.5), Y(0.3)); g.lineTo(X(0.5), Y(0.08));
    g.stroke();
    g.restore();
    const flag = seg(u, 0.62, 0.88);
    if (flag > 0.01) {
      g.save();
      g.globalAlpha *= flag;
      g.fillStyle = CRIMSON;
      g.strokeStyle = CRIMSON;
      g.lineWidth = 2 * s;
      const wave = Math.sin(t * 6.2) * 3.5 * s;
      g.beginPath();
      g.moveTo(X(0.5), Y(0.075));
      g.lineTo(X(0.5) + bw * 0.115, Y(0.105) + wave);
      g.lineTo(X(0.5), Y(0.145));
      g.closePath();
      g.fill();
      g.restore();
    }
  }
  // Arch door + brick ticks + windows
  const door = seg(u, 0.5, 0.72);
  if (door > 0.01) {
    g.save();
    g.globalAlpha *= door;
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(X(0.455), Y(0.90));
    g.lineTo(X(0.455), Y(0.72));
    g.arc(X(0.5), Y(0.72), bw * 0.045, Math.PI, 0);
    g.lineTo(X(0.545), Y(0.90));
    g.closePath();
    g.fill();
    g.restore();
  }
  const bricks = seg(u, 0.62, 0.9);
  if (bricks > 0.01) {
    g.save();
    g.globalAlpha *= bricks * 0.75;
    inkStroke(g, 2 * s);
    const ticks = [
      [0.28, 0.62, 0.10], [0.52, 0.60, 0.13], [0.70, 0.72, 0.09],
      [0.30, 0.76, 0.12], [0.55, 0.80, 0.10], [0.26, 0.85, 0.08],
    ];
    for (const [tx, ty, len] of ticks) {
      g.beginPath();
      g.moveTo(X(tx), Y(ty)); g.lineTo(X(tx + len), Y(ty));
      g.stroke();
    }
    g.restore();
  }
  const wins = seg(u, 0.72, 0.95);
  if (wins > 0.01) {
    g.save();
    g.globalAlpha *= wins;
    g.fillStyle = INK;
    for (const [fx, fy] of [[0.175, 0.56], [0.825, 0.56], [0.5, 0.38]]) {
      g.beginPath();
      g.ellipse(X(fx), Y(fy), 4.6 * s, 6.4 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

function drawDragon(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 300;
  const X = (f) => bx + bw * f;
  const Y = (f) => by + bh * f;
  inkStroke(g, 5.4 * s);
  // Tail: double spiral curl at the right edge
  const tail = seg(u, 0.05, 0.4);
  if (tail > 0.01) {
    g.save();
    g.globalAlpha *= tail;
    g.lineCap = 'round';
    partialPolyline(g, quadPoints([X(0.97), Y(0.82)], [X(0.90), Y(0.60)], [X(0.74), Y(0.72)]), tail);
    g.beginPath();
    g.arc(X(0.78), Y(0.74), 0.055 * bh, Math.PI * 0.4, Math.PI * 1.9);
    g.stroke();
    g.beginPath();
    g.arc(X(0.80), Y(0.735), 0.024 * bh, Math.PI * 0.6, Math.PI * 2.05);
    g.stroke();
    g.restore();
  }
  // Haunch + belly
  const haunch = seg(u, 0.0, 0.35);
  if (haunch > 0.01) {
    g.save();
    g.globalAlpha *= haunch;
    inkStroke(g, 5.6 * s);
    g.beginPath();
    g.arc(X(0.72), Y(0.74), 0.185 * bh, Math.PI * 1.05, Math.PI * 2.15);
    g.stroke();
    g.restore();
  }
  // Back ridge swooping to the neck
  const ridge = seg(u, 0.15, 0.5);
  if (ridge > 0.01) {
    g.save();
    g.globalAlpha *= ridge;
    inkStroke(g, 5.8 * s);
    partialPolyline(g, cubicPoints(
      [X(0.88), Y(0.60)], [X(0.72), Y(0.33)], [X(0.52), Y(0.24)], [X(0.32), Y(0.30)], 26,
    ), ridge);
    g.restore();
  }
  // Wing: tall arc with finger ribs
  const wing = seg(u, 0.3, 0.62);
  if (wing > 0.01) {
    g.save();
    g.globalAlpha *= wing;
    inkStroke(g, 4.6 * s);
    partialPolyline(g, cubicPoints(
      [X(0.46), Y(0.27)], [X(0.47), Y(0.02)], [X(0.66), Y(0.03)], [X(0.68), Y(0.235)], 20,
    ), wing);
    inkStroke(g, 2.6 * s);
    g.globalAlpha *= 0.8;
    for (const fx of [0.545, 0.60, 0.655]) {
      g.beginPath();
      g.moveTo(X(fx), Y(0.045 + 0.02 * Math.sin(fx * 40)));
      g.lineTo(X(fx - 0.015), Y(0.225));
      g.stroke();
    }
    g.restore();
  }
  // Neck spikes (triangles along the ridge)
  const spikes = seg(u, 0.35, 0.72);
  if (spikes > 0.01) {
    g.save();
    g.globalAlpha *= spikes;
    g.fillStyle = INK;
    const spikeDefs = [
      [0.80, 0.47, 0.030], [0.68, 0.375, 0.030], [0.565, 0.285, 0.026], [0.45, 0.255, 0.022],
    ];
    spikeDefs.forEach(([fx, fy, sz], i) => {
      const su = seg(u, 0.4 + i * 0.08, 0.55 + i * 0.08);
      if (su <= 0.01) return;
      const r = sz * bh * su;
      g.beginPath();
      g.moveTo(X(fx) - r, Y(fy) + r * 0.7);
      g.lineTo(X(fx), Y(fy) - r * 1.35);
      g.lineTo(X(fx) + r, Y(fy) + r * 0.7);
      g.closePath();
      g.fill();
    });
    g.restore();
  }
  // Head: brow ridge + snout wedge + open jaw (two arcs)
  const brow = seg(u, 0.4, 0.66);
  if (brow > 0.01) {
    g.save();
    g.globalAlpha *= brow;
    inkStroke(g, 5.2 * s);
    partialPolyline(g, cubicPoints(
      [X(0.32), Y(0.305)], [X(0.24), Y(0.235)], [X(0.13), Y(0.24)], [X(0.055), Y(0.295)], 18,
    ), brow);
    g.restore();
  }
  const snout = seg(u, 0.48, 0.7);
  if (snout > 0.01) {
    g.save();
    g.globalAlpha *= snout;
    g.fillStyle = PAPER;
    inkStroke(g, 4.6 * s);
    // Upper snout (wedge with nostril)
    g.beginPath();
    g.moveTo(X(0.335), Y(0.295));
    g.lineTo(X(0.075), Y(0.30));
    g.lineTo(X(0.035), Y(0.345));
    g.lineTo(X(0.30), Y(0.375));
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
  const jaw = seg(u, 0.55, 0.76);
  if (jaw > 0.01) {
    g.save();
    g.globalAlpha *= jaw;
    g.fillStyle = PAPER;
    inkStroke(g, 4.2 * s);
    // Lower jaw dropped open
    g.beginPath();
    g.moveTo(X(0.30), Y(0.40));
    g.lineTo(X(0.10), Y(0.475));
    g.lineTo(X(0.045), Y(0.44));
    g.lineTo(X(0.27), Y(0.465));
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }
  // Teeth ticks
  const teeth = seg(u, 0.66, 0.82);
  if (teeth > 0.01) {
    g.save();
    g.globalAlpha *= teeth;
    inkStroke(g, 2.1 * s);
    for (const fx of [0.135, 0.20, 0.265]) {
      g.beginPath();
      g.moveTo(X(fx), Y(0.365));
      g.lineTo(X(fx - 0.004), Y(0.40));
      g.stroke();
    }
    g.restore();
  }
  // Eye: almond + crimson pupil
  const eye = seg(u, 0.62, 0.8);
  if (eye > 0.01) {
    g.save();
    g.globalAlpha *= eye;
    g.fillStyle = PAPER;
    inkStroke(g, 2.6 * s);
    g.beginPath();
    g.ellipse(X(0.215), Y(0.297), 9.5 * s, 4.6 * s, -0.06, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.fillStyle = CRIMSON;
    g.beginPath();
    g.arc(X(0.215), Y(0.297), 2.9 * s, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // Nostril
  const nostril = seg(u, 0.7, 0.85);
  if (nostril > 0.01) {
    g.save();
    g.globalAlpha *= nostril;
    g.fillStyle = INK;
    g.beginPath();
    g.arc(X(0.085), Y(0.315), 1.8 * s, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // Forked crimson tongue, flicking with the scene clock
  const tongue = seg(u, 0.76, 0.92);
  if (tongue > 0.01) {
    const flick = 0.72 + 0.38 * Math.sin(t * 7.5);
    g.save();
    g.globalAlpha *= tongue * clamp(flick + 0.35);
    g.strokeStyle = CRIMSON;
    g.lineWidth = 2.4 * s;
    g.lineCap = 'round';
    const tx = X(0.085), ty = Y(0.40);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx - 0.052 * bw * flick, ty - 0.008 * bh);
    g.moveTo(tx - 0.052 * bw * flick, ty - 0.008 * bh);
    g.lineTo(tx - 0.075 * bw * flick, ty - 0.030 * bh);
    g.moveTo(tx - 0.052 * bw * flick, ty - 0.008 * bh);
    g.lineTo(tx - 0.078 * bw * flick, ty + 0.012 * bh);
    g.stroke();
    g.restore();
  }
  // Front leg with claw ticks
  const leg = seg(u, 0.58, 0.84);
  if (leg > 0.01) {
    g.save();
    g.globalAlpha *= leg;
    inkStroke(g, 4.6 * s);
    partialPolyline(g, [
      [X(0.34), Y(0.42)], [X(0.285), Y(0.62)], [X(0.315), Y(0.80)], [X(0.27), Y(0.885)],
    ], leg);
    g.restore();
    const claws = seg(u, 0.78, 0.95);
    if (claws > 0.01) {
      g.save();
      g.globalAlpha *= claws;
      inkStroke(g, 2.2 * s);
      for (const dx of [-0.016, 0.0, 0.016]) {
        g.beginPath();
        g.moveTo(X(0.27 + dx), Y(0.885));
        g.lineTo(X(0.25 + dx * 1.6), Y(0.925));
        g.stroke();
      }
      g.restore();
    }
  }
}

function drawBlackHole(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 280;
  const cx = bx + bw * 0.5;
  const cy = by + bh * 0.5;
  const grow = ease(clamp(u));
  if (grow <= 0.01) return;
  const R = 0.34 * Math.min(bw, bh) * grow;
  // Gravity lensing arcs (faint, wide)
  g.save();
  g.strokeStyle = INK_FAINT;
  g.lineWidth = 3 * s;
  for (const [ry, span] of [[1.95, 1.5], [2.35, 1.1]]) {
    g.beginPath();
    g.ellipse(cx, cy, R * ry, R * ry * 0.42, 0.18, Math.PI * (1 - span / 2) + t * 0.24, Math.PI * (1 + span / 2) + t * 0.24);
    g.stroke();
  }
  g.restore();
  // Infalling dashes spiralling inward
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const phase = (t * 0.55 + i / 9) % 1;
    const ang = i * ((Math.PI * 2) / 9) + t * 0.7;
    const r0 = R * (2.25 - 1.15 * phase);
    const len = R * 0.30;
    const a = Math.sin(Math.PI * clamp(phase)) * 0.8;
    g.strokeStyle = `rgba(26, 22, 18, ${a.toFixed(3)})`;
    g.lineWidth = 3.4 * s;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.82);
    g.lineTo(cx + Math.cos(ang) * (r0 - len), cy + Math.sin(ang) * (r0 - len) * 0.82);
    g.stroke();
  }
  g.restore();
  // Event horizon: solid ink disc
  g.save();
  const grad = g.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
  grad.addColorStop(0, '#020203');
  grad.addColorStop(0.78, '#0b0a10');
  grad.addColorStop(1, '#1a1612');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Hot accretion rim: rotating crimson arc
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = CRIMSON;
  g.lineWidth = 4.6 * s;
  g.globalAlpha *= 0.9;
  const rot = t * 2.35;
  g.beginPath();
  g.arc(cx, cy, R * 1.06, rot, rot + Math.PI * 0.62);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = 2.2 * s;
  g.globalAlpha *= 0.85;
  g.beginPath();
  g.arc(cx, cy, R * 1.13, rot + Math.PI, rot + Math.PI + Math.PI * 0.85);
  g.stroke();
  g.restore();
  // Swirl streaks on the disc face
  g.save();
  g.strokeStyle = 'rgba(247, 235, 212, 0.28)';
  g.lineWidth = 1.7 * s;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(cx, cy, R * (0.36 + i * 0.21), t * (1.1 + i * 0.33), t * (1.1 + i * 0.33) + Math.PI * 0.9);
    g.stroke();
  }
  g.restore();
}

function drawTaco(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 240;
  const X = (f) => bx + bw * f;
  const Y = (f) => by + bh * f;
  const shell = seg(u, 0.0, 0.5);
  if (shell > 0.01) {
    g.save();
    g.globalAlpha *= shell;
    g.fillStyle = GOLD_WASH;
    inkStroke(g, 4.4 * s);
    // Half-disc shell bulging upward
    g.beginPath();
    g.moveTo(X(0.08), Y(0.68));
    g.arc(X(0.5), Y(0.68), bw * 0.42, Math.PI, 0);
    g.closePath();
    g.fill(); g.stroke();
    // Crimped rim ticks
    g.lineWidth = 2.1 * s;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      const r0 = bw * 0.42, r1 = bw * 0.42 + 6.5 * s;
      g.beginPath();
      g.moveTo(X(0.5) + Math.cos(a) * r0, Y(0.68) + Math.sin(a) * r0);
      g.lineTo(X(0.5) + Math.cos(a) * r1, Y(0.68) + Math.sin(a) * r1);
      g.stroke();
    }
    g.restore();
  }
  // Wavy lettuce line
  const lettuce = seg(u, 0.35, 0.68);
  if (lettuce > 0.01) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      const x = X(0.135 + f * 0.73);
      const wave = Math.sin(f * Math.PI * 6) * 0.030 * bh;
      const lift = Math.sin(f * Math.PI) * 0.135 * bh;
      pts.push([x, Y(0.66) - lift + wave]);
    }
    g.save();
    g.globalAlpha *= lettuce;
    inkStroke(g, 3.1 * s);
    partialPolyline(g, pts, lettuce);
    g.restore();
  }
  // Tomato dots (crimson accent)
  const toms = seg(u, 0.55, 0.8);
  if (toms > 0.01) {
    g.save();
    g.globalAlpha *= toms;
    g.fillStyle = CRIMSON;
    for (const [fx, dy] of [[0.30, 0.545], [0.47, 0.475], [0.64, 0.52], [0.755, 0.60]]) {
      g.beginPath();
      g.arc(X(fx), Y(dy), 4.6 * s, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // Cheese strands
  const cheese = seg(u, 0.68, 0.9);
  if (cheese > 0.01) {
    g.save();
    g.globalAlpha *= cheese;
    inkStroke(g, 1.9 * s);
    for (const [fx, len] of [[0.36, 0.055], [0.52, 0.075], [0.68, 0.05]]) {
      g.beginPath();
      g.moveTo(X(fx), Y(0.60));
      g.lineTo(X(fx + 0.008), Y(0.60 + len));
      g.stroke();
    }
    g.restore();
  }
  // Bite out of the right rim once it is fully drawn? No — tacos stay whole here.
  const shine = seg(u, 0.8, 1);
  if (shine > 0.01) {
    g.save();
    g.globalAlpha *= shine * 0.7;
    inkStroke(g, 2 * s);
    g.beginPath();
    g.arc(X(0.30), Y(0.475), bw * 0.09, Math.PI * 1.15, Math.PI * 1.55);
    g.stroke();
    g.restore();
  }
}

function drawHearts(g, bx, by, bw, bh, u, t) {
  const cx = bx + bw * 0.5;
  const cy = by + bh * 0.52;
  const travel = ease(seg(u, 0.12, 0.72));
  const bump = seg(u, 0.72, 1);
  const gap = lerp(0.335, 0.088, travel) * bw;
  const pop = 1 + 0.30 * Math.sin(Math.PI * bump);
  const s = 0.125 * bw * pop;
  // Left heart: ink. Right heart: crimson.
  g.save();
  heartPath(g, cx - gap, cy, s);
  g.fillStyle = PAPER;
  inkStroke(g, 4.4 * (Math.min(bw, bh) / 260));
  g.fill(); g.stroke();
  g.restore();
  g.save();
  heartPath(g, cx + gap, cy, s);
  g.fillStyle = CRIMSON_SOFT;
  g.strokeStyle = CRIMSON;
  g.lineWidth = 4.4 * (Math.min(bw, bh) / 260);
  g.lineJoin = 'round';
  g.fill(); g.stroke();
  g.restore();
  // Bump burst
  if (bump > 0.02 && bump < 0.98) {
    const a = Math.sin(Math.PI * bump);
    star4(g, cx, cy - s * 0.4, 16 * a + 4, a, CRIMSON);
  }
  if (bump >= 0.98) {
    const twinkle = 0.55 + 0.35 * Math.sin(t * 3.4);
    star4(g, cx + bw * 0.02, cy - s * 0.55, 13, twinkle, CRIMSON);
    star4(g, cx - bw * 0.16, cy + s * 0.35, 8, twinkle * 0.8, INK);
  }
  // Motion arcs while travelling
  if (travel > 0.02 && travel < 0.95) {
    g.save();
    g.globalAlpha *= 0.7;
    inkStroke(g, 2.4 * (Math.min(bw, bh) / 260));
    for (const dir of [-1, 1]) {
      const hx = cx + dir * gap;
      g.beginPath();
      g.arc(hx + dir * s * 1.25, cy, s * 0.72, dir === -1 ? Math.PI * 0.65 : -Math.PI * 0.35, dir === -1 ? Math.PI * 1.15 : Math.PI * 0.35, dir === 1);
      g.stroke();
    }
    g.restore();
  }
}

function drawSubscribe(g, bx, by, bw, bh, u, t) {
  const s = Math.min(bw, bh) / 180;
  const pad = 10 * s;
  // Hand-drawn double-stroke box (sketchy on parchment)
  const box = seg(u, 0.0, 0.42);
  if (box > 0.01) {
    g.save();
    g.globalAlpha *= box;
    inkStroke(g, 4.2 * s);
    g.beginPath();
    g.roundRect(bx + pad, by + pad, bw - pad * 2, bh - pad * 2, 12 * s);
    g.stroke();
    inkStroke(g, 1.6 * s);
    g.globalAlpha *= 0.75;
    g.beginPath();
    g.roundRect(bx + pad + 3.4 * s, by + pad + 2.6 * s, bw - pad * 2 - 4.6 * s, bh - pad * 2 - 3.4 * s, 10 * s);
    g.stroke();
    g.restore();
  }
  // SUBSCRIBE lettering
  const textU = seg(u, 0.3, 0.68);
  if (textU > 0.01) {
    g.save();
    g.globalAlpha *= textU;
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = Math.floor(bh * 0.46);
    const maxW = bw - pad * 2 - 30 * s;
    while (size > 12) {
      g.font = `bold ${size}px PopB`;
      if (g.measureText('SUBSCRIBE').width <= maxW) break;
      size -= 1;
    }
    g.font = `bold ${size}px PopB`;
    g.fillText('SUBSCRIBE', bx + bw * 0.5 - 14 * s, by + bh * 0.5 + 1 * s, maxW);
    g.restore();
  }
  // Crimson underline swosh + tiny heart
  const underline = seg(u, 0.6, 0.88);
  if (underline > 0.01) {
    g.save();
    g.globalAlpha *= underline;
    g.strokeStyle = CRIMSON;
    g.lineWidth = 3.4 * s;
    g.lineCap = 'round';
    const y = by + bh * 0.72;
    g.beginPath();
    g.moveTo(bx + bw * 0.20, y);
    g.quadraticCurveTo(bx + bw * 0.5, y + 5.5 * s, bx + bw * 0.20 + (bw * 0.52) * underline, y - 2.5 * s);
    g.stroke();
    g.restore();
  }
  const heart = seg(u, 0.74, 1);
  if (heart > 0.01) {
    g.save();
    g.globalAlpha *= heart;
    heartPath(g, bx + bw * 0.845, by + bh * 0.485, 9.5 * s * (0.6 + 0.4 * heart));
    g.fillStyle = CRIMSON;
    g.fill();
    g.restore();
  }
}


function drawNotepad(g, bx, by, bw, bh, u, t, board) {
  const s = Math.min(bw, bh) / 300;
  const pad = 6 * s;
  const px = bx + pad, py = by + pad, pw = bw - pad * 2, ph = bh - pad * 2;
  // Paper page (slightly brighter than the parchment world) with sketchy double stroke.
  const page = seg(u, 0.0, 0.3);
  if (page > 0.01) {
    g.save();
    g.globalAlpha *= page;
    g.fillStyle = '#fdf8ec';
    inkStroke(g, 4.6 * s);
    g.beginPath();
    g.roundRect(px, py, pw, ph, 18 * s);
    g.fill(); g.stroke();
    inkStroke(g, 1.7 * s);
    g.globalAlpha *= 0.8;
    g.beginPath();
    g.roundRect(px + 4 * s, py + 3.4 * s, pw - 5 * s, ph - 4.2 * s, 16 * s);
    g.stroke();
    g.restore();
  }
  // Spiral binding holes + wire arcs down the left edge.
  const spiral = seg(u, 0.05, 0.4);
  if (spiral > 0.01) {
    g.save();
    g.globalAlpha *= spiral;
    for (let i = 0; i < 5; i++) {
      const hy = py + ph * (0.16 + i * 0.17);
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(px + 13 * s, hy, 4.6 * s, 6.4 * s, 0, 0, Math.PI * 2);
      g.fill();
      inkStroke(g, 2.4 * s);
      g.beginPath();
      g.arc(px + 2 * s, hy, 10.5 * s, -Math.PI * 0.42, Math.PI * 0.42);
      g.stroke();
    }
    g.restore();
  }
  // Ruled lines with a hand-drawn wobble.
  const lines = seg(u, 0.18, 0.5);
  if (lines > 0.01) {
    g.save();
    g.globalAlpha *= lines * 0.55;
    g.strokeStyle = INK_SOFT;
    g.lineWidth = 1.6 * s;
    for (let i = 0; i < 4; i++) {
      const ly = py + ph * (0.28 + i * 0.165);
      g.beginPath();
      g.moveTo(px + 30 * s, ly);
      for (let x = 30; x <= pw - 24; x += 12) {
        g.lineTo(px + x * s / s * 1, ly + Math.sin(x * 0.055 + i * 2.1) * 1.15 * s);
      }
      g.stroke();
    }
    g.restore();
  }
  const lines_txt = (board && board.lines) || ['Doodle Date', 'Simple wins.'];
  // Title line (ink, bold).
  const titleU = seg(u, 0.34, 0.62);
  if (titleU > 0.01) {
    g.save();
    g.globalAlpha *= titleU;
    g.fillStyle = INK;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    let size = Math.floor(ph * 0.185);
    const maxW = pw - 52 * s;
    while (size > 14) {
      g.font = `bold ${size}px PopB`;
      if (g.measureText(String(lines_txt[0])).width <= maxW) break;
      size -= 1;
    }
    g.font = `bold ${size}px PopB`;
    g.fillText(String(lines_txt[0]), px + 32 * s, py + ph * 0.27, maxW);
    g.restore();
  }
  // Sub line.
  const subU = seg(u, 0.44, 0.72);
  if (subU > 0.01) {
    g.save();
    g.globalAlpha *= subU;
    g.fillStyle = INK_SOFT;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    let size = Math.floor(ph * 0.125);
    const maxW = pw - 52 * s;
    while (size > 11) {
      g.font = `${size}px PopR`;
      if (g.measureText(String(lines_txt[1])).width <= maxW) break;
      size -= 1;
    }
    g.font = `${size}px PopR`;
    g.fillText(String(lines_txt[1]), px + 32 * s, py + ph * 0.435, maxW);
    g.restore();
  }
  // Crimson hand underline swash (the "hand underlines the drawing" beat).
  const swash = seg(u, 0.6, 0.86);
  if (swash > 0.01) {
    g.save();
    g.globalAlpha *= swash;
    g.strokeStyle = CRIMSON;
    g.lineWidth = 5 * s;
    g.lineCap = 'round';
    const sy = py + ph * 0.345;
    partialPolyline(g, [
      [px + 30 * s, sy],
      [px + pw * 0.30, sy + 4 * s],
      [px + pw * 0.55, sy - 1.5 * s],
      [px + 32 * s + (pw * 0.62 - 32 * s) * swash, sy + 2.2 * s],
    ], swash);
    g.restore();
  }
  // Tiny crimson heart under the swash.
  const heart = seg(u, 0.78, 1);
  if (heart > 0.01) {
    g.save();
    g.globalAlpha *= heart;
    heartPath(g, px + pw * 0.48, py + ph * 0.62, 15 * s * (0.5 + 0.5 * heart));
    g.fillStyle = CRIMSON;
    g.fill();
    g.restore();
  }
}

const DOODLE_DRAWERS = {
  rose: drawRose,
  necklace: drawNecklace,
  car: drawCar,
  jetpack: drawJetpack,
  castle: drawCastle,
  dragon: drawDragon,
  black_hole: drawBlackHole,
  taco: drawTaco,
  hearts: drawHearts,
  subscribe: drawSubscribe,
  notepad: drawNotepad,
};

/**
 * Ink-doodle board. No panel, no frame — the drawing lands straight on the parchment page.
 * Returns the board bounds like every other board renderer.
 */
function drawDoodleBoard(g, board, ts, dur, W, floorY, sceneAccent) {
  const revealAt = Number(board.reveal_at ?? board.appear_at ?? board.start_at ?? 0.35);
  const buildDur = Math.max(0.45, Number(board.build_dur ?? 1.6));
  const rawHide = board.hide_at ?? board.disappear_at ?? board.end_at;
  let hideAt = null;
  if (rawHide !== undefined && rawHide !== null) {
    hideAt = Number(rawHide);
  } else if (board.hold_sec !== undefined) {
    hideAt = revealAt + Number(board.hold_sec);
  } else if (!board.persist && dur > revealAt + buildDur + 5.8) {
    hideAt = Math.min(dur - 0.35, revealAt + Math.max(5.0, buildDur + 3.6));
  }
  if (ts < revealAt) return null;
  if (hideAt !== null && ts > hideAt) return null;

  const enterU = ease(clamp((ts - revealAt) / 0.34));
  const exitU = hideAt !== null ? ease(clamp((hideAt - ts) / 0.4)) : 1.0;
  const boardVis = enterU * exitU;
  if (boardVis <= 0.01) return null;

  // Safe-zone viewport clamping — identical contract to the other boards.
  const rawW = board.w !== undefined ? (board.w <= 1.5 ? board.w * W : Number(board.w)) : 420;
  const rawH = board.h !== undefined ? (board.h <= 1.5 ? board.h * 1080 : Number(board.h)) : 300;
  const rawX = board.x !== undefined ? (board.x <= 1.5 ? board.x * W : Number(board.x)) : 0.5 * W;
  const rawY = board.y !== undefined ? (board.y <= 1.5 ? board.y * 1080 : Number(board.y)) : 150;
  const bw = Math.min(Math.max(150, rawW), W - 96);
  const bh = Math.min(Math.max(110, rawH), Math.max(120, floorY - 96));
  const bx = clamp(rawX, 44, W - bw - 44);
  const by = clamp(rawY, 66, Math.max(66, floorY - bh - 26)) + (1 - enterU) * 14 - (1 - exitU) * 10;

  const u = ease(clamp((ts - (revealAt + 0.08)) / buildDur));
  const kind = String(board.doodle || board.sketch || 'rose');
  const drawer = DOODLE_DRAWERS[kind];

  g.save();
  g.globalAlpha = boardVis;
  if (drawer) {
    drawer(g, bx, by, bw, bh, u, ts, board);
  } else {
    // Unknown doodle id — draw a framed mystery box rather than crash the render.
    inkStroke(g, 3);
    g.setLineDash([10, 8]);
    g.strokeRect(bx + 8, by + 8, bw - 16, bh - 16);
    g.setLineDash([]);
  }
  g.restore();

  return { centerX: bx + bw * 0.5, centerY: by + bh * 0.5, leftX: bx, rightX: bx + bw };
}

module.exports = {
  DOODLE_PROPS,
  DOODLE_SET,
  drawDoodleBoard,
};
