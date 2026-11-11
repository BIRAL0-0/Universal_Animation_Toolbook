'use strict';

/**
 * "The Bamboo Seed" set — a ground cutaway, drawn in the warm parchment ink vocabulary.
 *
 * The one idea this film needs that nothing in the engine could draw: a single frame that
 * shows ABOVE the ground and BELOW it at once. Above the soil line lives everything visible —
 * sky, sun, a farmer, a label reading "0 cm". Below it lives the actual story: roots spreading
 * wider every year while nothing appears above.
 *
 * That is the film's whole argument in one composition, so the cutaway is not a backdrop with a
 * prop on top. It is a prop (`bamboo_cutaway`) drawn across the full frame with the soil line as
 * its spine, and the sun (`bamboo_sun`) arcs above it. Everything animates from a single number:
 *
 *     yearProgress(sceneT, duration) -> 0.0 .. 5.0
 *
 * Year 1 is the first fifth of the scene, year 5 the last. Roots, ring counts, soil texture and
 * the growth burst all read that clock, so they cannot drift apart.
 *
 * PORTRAIT IS THE HARD CASE. A 9:16 output is a narrow centre crop of the 1920-wide stage, so any
 * cutaway designed to fill the width would lose its soil line and half its roots. The whole set is
 * therefore kept inside a narrow central column: given `frame` ({x, width} in stage coordinates)
 * from the renderer, it draws itself scaled and centred to fit. It reads as a cutaway either way.
 *
 * Registered through the established extension pattern (two dispatch hooks, no core rewrite):
 *   1. parchment_ink_style.js :: drawParchmentEnvironment -> drawBambooBackdrop
 *   2. world_props_and_boards.js :: drawWorldProp       -> drawBambooProp
 *
 * Deterministic throughout: no per-frame randomness, only hash1() on fixed indices.
 */

const INK = '#1a1612';
const INK_SOFT = 'rgba(26, 22, 18, 0.55)';
const INK_FAINT = 'rgba(26, 22, 18, 0.20)';
const PAPER_LIGHT = '#f7ebd4';
const PAPER_MID = '#efe0c2';
const CRIMSON = '#cc292b';
const AMBER = '#e09a2c';
const SOIL_DARK = '#8a6a42';
const SOIL_MID = '#a8845a';
const SOIL_LIGHT = '#c3a077';
const ROOT_BROWN = '#6b4f30';
const GOLD = '#d9a521';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

/** Deterministic 0..1 hash — organic jitter that never flickers between frames. */
function hash1(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Hand-inked stroke with a slight organic bow, same vocabulary as the rest of the style. */
function inkLine(g, x1, y1, x2, y2, width = 3.4, bow = 1.3, color = INK) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const wobble = Math.sin(x1 * 0.037 + y1 * 0.053 + x2 * 0.019) * bow;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.quadraticCurveTo(
    (x1 + x2) / 2 + nx * wobble,
    (y1 + y2) / 2 + ny * wobble,
    x2,
    y2
  );
  g.stroke();
  g.restore();
}

/* ---------------------------------------------------------------------------------------------
 * Scene clock
 * ------------------------------------------------------------------------------------------- */

/**
 * How far into the five years we are, as a continuous number.
 *
 * `years` lets a scene declare its own span (a 5s beat is not five years). Default is the whole
 * arc, which is what the montage scenes want.
 */
function yearProgress(sceneT, duration) {
  const d = Math.max(0.001, Number(duration) || 0.001);
  return clamp01(sceneT / d) * 5;
}

/**
 * Growth burst: 0 until `at` years, then snaps up over `over` years with an ease-out overshoot.
 * The overshoot matters — a bamboo shoot that grows linearly looks like a diagram; one that
 * overshoots and settles looks like it is *erupting*, which is the point of year five.
 */
function burst(yearNow, at = 4.35, over = 0.55) {
  if (yearNow <= at) return 0;
  const u = clamp01((yearNow - at) / over);
  const eased = 1 - Math.pow(1 - u, 3);
  return eased + Math.sin(u * Math.PI) * 0.06; // small overshoot, no wobble at rest
}

/* ---------------------------------------------------------------------------------------------
 * Viewport fitting — the crop-safe column
 * ------------------------------------------------------------------------------------------- */

/**
 * Work out the drawable column.
 *
 * With a portrait `frame` supplied by the renderer, the set is scaled to fit inside that column so
 * nothing important is cropped away. Without one (landscape, or a still), it fills the stage.
 */
function fitColumn(frame, W, floorY, H) {
  if (frame && Number.isFinite(Number(frame.width)) && Number(frame.width) > 0) {
    const left = Number(frame.left) || 0;
    const colW = Number(frame.width);
    const cx = left + colW / 2;
    return { left, cx, colW, scale: Math.min(1, colW / 1100), portrait: colW < W * 0.92 };
  }
  return { left: 0, cx: W / 2, colW: W, scale: 1, portrait: false };
}

/**
 * Where to put something horizontally.
 *
 * In LANDSCAPE, prop.x is a fraction of the whole stage, as usual.
 *
 * In PORTRAIT the stage is cropped to a ~607px column, so a prop authored at x = 0.70 of 1920
 * lands outside the frame entirely — which is exactly what happened to the "0 cm" label on the
 * first portrait pass. Inside portrait, prop.x is therefore read as a fraction of the *column*,
 * so the same authored value keeps the composition intact in both formats.
 */
function placeX(prop, col, W) {
  if (col.portrait) {
    // x_portrait is authoritative when given; otherwise prop.x is read column-relative.
    const u = prop.x_portrait !== undefined ? Number(prop.x_portrait)
      : (prop.x === undefined || prop.x === null ? 0.5 : Number(prop.x));
    return col.left + u * col.colW;
  }
  const u = prop.x === undefined || prop.x === null ? 0.5 : Number(prop.x);
  return u * W;
}

/* ---------------------------------------------------------------------------------------------
 * Backdrop: sky, sun, soil, strata
 * ------------------------------------------------------------------------------------------- */

const BAMBOO_BACKDROPS = Object.freeze(['parchment_bamboo']);

function drawBambooBackdrop(g, setting, globalT, ts, panX, floorY, W = 1920, H = 1080) {
  const st = setting || {};
  const frame = st._frame || null;
  const col = fitColumn(frame, W, floorY, H);
  const soilY = Number(st.soil_y ?? 0.52) * H;
  const yearNow = yearProgress(ts, st._sceneDuration ?? 12);

  // OVERSCAN. The backdrop is drawn in world space, so a camera zoomed out (as the closing
  // shot is, 0.86) sees a wider region than 0..W x 0..H. Covering only the stage rectangle
  // left a visible paper border with the vignette showing through it, like a mounted print.
  const OL = -Math.round(W * 0.45);
  const OR = Math.round(W * 1.45);
  const OT = -Math.round(H * 0.45);
  const OB = Math.round(H * 1.45);
  const OW = OR - OL;

  // 1. Paper sky. Warm, low contrast, so the ink reads.
  const sky = g.createLinearGradient(0, OT, 0, soilY);
  sky.addColorStop(0.0, '#f8eeda');
  sky.addColorStop(0.6, '#f4e6cb');
  sky.addColorStop(1.0, '#efdcbc');
  g.fillStyle = sky;
  g.fillRect(OL, OT, OW, soilY - OT);

  // 2. Far hills — two washes, hand-bowed, deliberately faint.
  for (const [amp, freq, phase, alpha, lift] of [[26, 520, 0, 0.10, 132], [15, 210, 1.7, 0.07, 96]]) {
    g.save();
    g.fillStyle = `rgba(120, 92, 52, ${alpha})`;
    g.beginPath();
    g.moveTo(OL, soilY);
    for (let x = OL; x <= OR; x += 40) {
      const h = Math.sin(x / freq + phase) * amp + Math.sin(x / (freq * 2.4) + phase * 0.6) * amp * 0.4;
      g.lineTo(x, soilY - lift + h);
    }
    g.lineTo(OR, soilY);
    g.closePath();
    g.fill();
    g.restore();
  }

  // 2b. Faint ink clouds — long lazy strokes, deterministic, very low contrast. The upper
  //     third is where a 9:16 crop puts most of its sky, and empty paper there reads as a
  //     missing background rather than as air.
  g.save();
  g.strokeStyle = 'rgba(120, 108, 88, 0.16)';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  for (let cIdx = 0; cIdx < 7; cIdx++) {
    const cxp = OL + hash1(cIdx * 4.7) * OW;
    const cyp = OT + 120 + hash1(cIdx * 9.3 + 2) * (soilY - OT - 260);
    const cw = 90 + hash1(cIdx * 6.1) * 160;
    g.beginPath();
    g.moveTo(cxp - cw, cyp);
    g.quadraticCurveTo(cxp, cyp - 16 - hash1(cIdx) * 10, cxp + cw, cyp + 4);
    g.stroke();
    g.beginPath();
    g.moveTo(cxp - cw * 0.45, cyp + 12);
    g.quadraticCurveTo(cxp + cw * 0.1, cyp - 2, cxp + cw * 0.5, cyp + 14);
    g.stroke();
  }
  g.restore();

  // 3. The sun, cycling. Its arc IS the day counter, so the audience feels time pass without
  //    being told a date. It traverses once per "year beat" of the scene.
  if (st.sun !== false) {
    const cycles = Number(st.sun_cycles ?? Math.max(1, Math.round(yearNow || 1)));
    const phase = ((ts * Math.max(1, cycles)) / Math.max(0.001, st._sceneDuration ?? 12)) % 1;
    const sunX = col.cx + Math.sin((phase - 0.5) * Math.PI) * col.colW * 0.30;
    // stay clear of the top edge: a sun clipped by the frame reads as a bug
    const sunY = soilY - 74 - Math.sin(phase * Math.PI) * Math.max(60, soilY - 230);
    const r = Number(st.sun_r ?? 34) * col.scale;
    const glow = g.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 4.2);
    glow.addColorStop(0, 'rgba(236, 170, 60, 0.34)');
    glow.addColorStop(1, 'rgba(236, 170, 60, 0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(sunX, sunY, r * 4.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e9a737';
    g.beginPath();
    g.arc(sunX, sunY, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2.6 * col.scale;
    g.stroke();
  }

  // 4. SOIL. This is the film's spine: a heavy ink line, then layered earth beneath it.
  const soilTop = soilY;
  const soilGrad = g.createLinearGradient(0, soilTop, 0, OB);
  soilGrad.addColorStop(0.0, SOIL_LIGHT);
  soilGrad.addColorStop(0.35, SOIL_MID);
  soilGrad.addColorStop(1.0, SOIL_DARK);
  g.fillStyle = soilGrad;
  g.fillRect(OL, soilTop, OW, OB - soilTop);

  // 5. Strata: thin bowed bands, so the earth reads as depth rather than a brown rectangle.
  g.save();
  g.globalAlpha = 0.28;
  for (let i = 1; i <= 4; i++) {
    const y = soilTop + ((H - soilTop) * i) / 5;
    g.strokeStyle = 'rgba(60, 42, 24, 0.5)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(OL, y);
    for (let x = OL; x <= OR; x += 60) {
      g.lineTo(x, y + Math.sin(x / 260 + i) * 7);
    }
    g.stroke();
  }
  g.restore();

  // 6. Pebbles — deterministic, evenly scattered, never in the way of the roots.
  g.save();
  for (let i = 0; i < 84; i++) {
    const px = OL + hash1(i * 3.1) * OW;
    const py = soilTop + 24 + hash1(i * 7.7 + 4) * (OB - soilTop - 40);
    const rr = 2.4 + hash1(i * 5.3 + 9) * 4.2;
    g.fillStyle = i % 3 === 0 ? 'rgba(70, 50, 30, 0.35)' : 'rgba(120, 92, 60, 0.30)';
    g.beginPath();
    g.ellipse(px, py, rr, rr * 0.72, hash1(i) * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // 7. The ground line itself — the hardest stroke in the frame, because everything above it is
  //    "what you can see" and everything below is "what you cannot".
  inkLine(g, OL, soilTop, OR, soilTop, 5.2, 1.6);

  // 8. Grass tufts along the line, only above it, only outside the planting spot.
  g.save();
  g.strokeStyle = 'rgba(70, 92, 48, 0.55)';
  g.lineWidth = 2.2;
  for (let i = 0; i < 60; i++) {
    const gx = OL + (i / 59) * OW;
    if (Math.abs(gx - col.cx) < 130) continue;
    const gh = 8 + hash1(i * 2.7) * 13;
    g.beginPath();
    g.moveTo(gx, soilTop);
    g.quadraticCurveTo(gx + 3, soilTop - gh * 0.6, gx + 7, soilTop - gh);
    g.stroke();
  }
  g.restore();
}

/* ---------------------------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------------------------- */

const BAMBOO_PROPS = Object.freeze([
  'bamboo_cutaway',
  'bamboo_sun',
  'bamboo_label',
  'bamboo_stalk',
]);

/**
 * The hero drawing: a seed that will not show itself, and the root system it is quietly building.
 *
 * Reads `prop.year` (absolute year 0..5) when given, else the scene clock. `prop.grove` grows a
 * stand of stalks around the centre one at the same moment — bamboo comes up as a clump, and a
 * single lone stalk reads as a weed.
 */
function drawBambooCutaway(g, prop, W, floorY, s, t, sceneT, sceneDuration, frame) {
  const H = 1080;
  const col = fitColumn(frame, W, floorY, H);
  const soilY = (prop.soil_y ?? 0.54) * H;
  // A scene may pin a year (montage beats) or animate a range (the eruption scene, which has
  // to happen *inside* the shot rather than before it).
  let yearNow;
  if (prop.year !== undefined && prop.year_from === undefined) {
    yearNow = Number(prop.year);
  } else if (prop.year_from !== undefined) {
    const u = clamp01(sceneT / Math.max(0.001, Number(sceneDuration) || 0.001));
    yearNow = lerp(Number(prop.year_from), Number(prop.year_to ?? 5), u);
  } else {
    yearNow = yearProgress(sceneT, sceneDuration);
  }
  const cx = placeX(prop, col, W);
  // No col.scale here: placement is already column-relative in portrait, so shrinking the
  // whole composition as well made the grove a shrub inside its own crop.
  const sc = prop.scale ?? 1;

  // The seed sits just below the soil line; the roots spread out and down from it.
  const seedY = soilY + 22 * sc;
  // ROOTS MUST STAY UNDER THE GROUND LINE. The first pass let the spread grow wider than the
  // depth and the outer roots surfaced into the sky like a spider. Depth now leads the spread,
  // and every control point is clamped below the soil.
  const mature = clamp01(yearNow / 5);
  const rootDepth = lerp(58, 250, mature) * sc;
  // Cap the spread against BOTH the column width and the depth. Roots that outrun the frame
  // edge get sliced flat by the crop, which reads as a rendering fault rather than as soil.
  const sideRoom = Math.min(cx - col.left, col.left + col.colW - cx);
  const rootSpan = Math.min(
    lerp(30, 168, mature) * sc,
    Math.max(24, sideRoom * 0.72),
    rootDepth * 0.95
  );
  const rootBranches = 5 + Math.round(yearNow * 2.2);

  g.save();

  // --- root system -----------------------------------------------------------------------
  for (let i = 0; i < rootBranches; i++) {
    const u = i / Math.max(1, rootBranches - 1);
    const spread = (u - 0.5) * 2; // -1 .. 1
    const wob = (hash1(i * 11.3) - 0.5) * 26 * sc;
    const tipX = cx + spread * rootSpan * (0.72 + hash1(i * 3.7) * 0.36);
    // taper the depth toward the edges so the silhouette is a fan, not a comb
    const tipY = seedY + rootDepth * (0.58 + hash1(i * 8.1) * 0.42) * (1 - Math.abs(spread) * 0.32);
    const ctrlX = cx + spread * rootSpan * 0.34;
    const ctrlY = Math.min(soilY + 16 * sc, seedY + rootDepth * 0.34 + wob);

    const width = (3.6 - u * 0.8) * sc * (1 + mature * 0.55);
    g.strokeStyle = ROOT_BROWN;
    g.lineWidth = Math.max(1.6, width);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, seedY);
    g.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
    g.stroke();

    // Hair roots: fine hairs only appear once there is something to drink.
    if (yearNow > 1.4) {
      const hairs = 2 + Math.floor(hash1(i * 5.9) * 3);
      for (let hIdx = 0; hIdx < hairs; hIdx++) {
        const uu = 0.35 + (hIdx / hairs) * 0.6;
        const bx = lerp(lerp(cx, ctrlX, uu), lerp(ctrlX, tipX, uu), uu);
        const by = lerp(lerp(seedY, ctrlY, uu), lerp(ctrlY, tipY, uu), uu);
        // point hairs downward-outward so they stay in the soil
        const ang = Math.PI * 0.5 + (hash1(i * 13.1 + hIdx) - 0.5) * 1.5;
        const len = (11 + hash1(i * 17.7 + hIdx) * 16) * sc;
        const hx = bx + Math.cos(ang) * len;
        const hy = Math.min(H - 6, by + Math.abs(Math.sin(ang)) * len * 0.9);
        g.strokeStyle = 'rgba(107, 79, 48, 0.68)';
        g.lineWidth = Math.max(0.9, 1.3 * sc);
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(hx, hy);
        g.stroke();
      }
    }
  }

  // --- the corm ---------------------------------------------------------------------------
  // Turns gold as the moral lands: the reward is the roots nobody watched.
  const goldU = clamp01((yearNow - 3.9) / 1.1);
  const cormR = 12 * sc;
  if (goldU > 0.01) {
    const glow = g.createRadialGradient(cx, seedY, cormR * 0.5, cx, seedY, cormR * 7);
    glow.addColorStop(0, `rgba(217, 165, 33, ${0.40 * goldU})`);
    glow.addColorStop(1, 'rgba(217, 165, 33, 0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, seedY, cormR * 7, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = goldU > 0.5 ? GOLD : '#7a5a36';
  g.beginPath();
  g.ellipse(cx, seedY, cormR * 1.15, cormR * 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2.2 * sc;
  g.stroke();

  // --- the grove ----------------------------------------------------------------------------
  // Zero for four years. Then it does not creep; it erupts.
  const grow = burst(yearNow, 4.35, 0.62);
  if (grow > 0.001) {
    const maxH = (prop.stalk_height ?? 470) * sc;
    // centre stalk tallest, flanking stalks a little shorter: a clump, not a hedge
    const stalks = [{ dx: 0, k: 1.0 }, { dx: -0.16, k: 0.82 }, { dx: 0.17, k: 0.88 },
                     { dx: -0.30, k: 0.66 }, { dx: 0.31, k: 0.7 }];
    stalks.forEach((st, idx) => {
      const sx = cx + st.dx * Math.min(rootSpan * 1.6, 210) * sc;
      const shootH = maxH * grow * st.k;
      if (shootH < 2) return;
      const sway = Math.sin(t * 1.6 + idx * 1.1) * (4 + idx) * sc * grow;
      const stalkW = lerp(3, 11, grow) * sc * st.k;
      const topY = soilY - shootH;

      // faint motion arcs at the moment of eruption
      if (grow > 0.08 && grow < 0.8 && idx === 0) {
        g.save();
        g.strokeStyle = `rgba(26, 22, 18, ${0.24 * (1 - grow)})`;
        g.lineWidth = 2.2 * sc;
        for (let aIdx = 0; aIdx < 3; aIdx++) {
          const ax = sx + (aIdx - 1) * 46 * sc;
          g.beginPath();
          g.moveTo(ax, soilY - shootH * 0.42);
          g.lineTo(ax + (aIdx - 1) * 16 * sc, soilY - shootH * 0.60);
          g.stroke();
        }
        g.restore();
      }

      g.strokeStyle = '#6f8a3f';
      g.lineWidth = stalkW;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sx, soilY);
      g.quadraticCurveTo(sx + sway * 0.5, soilY - shootH * 0.5, sx + sway, topY);
      g.stroke();
      // ink shoulders so the stalk holds against pale sky
      g.strokeStyle = INK;
      g.lineWidth = 1.5 * sc;
      g.beginPath();
      g.moveTo(sx - stalkW * 0.5, soilY);
      g.quadraticCurveTo(sx + sway * 0.5 - stalkW * 0.5, soilY - shootH * 0.5, sx + sway - stalkW * 0.4, topY);
      g.stroke();
      g.beginPath();
      g.moveTo(sx + stalkW * 0.5, soilY);
      g.quadraticCurveTo(sx + sway * 0.5 + stalkW * 0.5, soilY - shootH * 0.5, sx + sway + stalkW * 0.4, topY);
      g.stroke();

      const nodes = Math.max(1, Math.round(shootH / (58 * sc)));
      for (let n = 1; n <= nodes; n++) {
        const uu = n / (nodes + 1);
        inkLine(g, sx + sway * uu * uu - stalkW * 0.6, soilY - shootH * uu,
          sx + sway * uu * uu + stalkW * 0.6, soilY - shootH * uu, 1.9 * sc, 0.7);
      }

      // leaves unfurl last, at the crown
      if (grow > 0.7) {
        const leafU = clamp01((grow - 0.7) / 0.3);
        const crownX = sx + sway;
        // Bamboo leaves are long, narrow and droop outward from the crown. Drawing them as
        // symmetric lenses made the grove look like a row of arrows.
        for (let lIdx = 0; lIdx < 7; lIdx++) {
          const side = lIdx % 2 === 0 ? 1 : -1;
          const droop = 0.05 + (lIdx % 4) * 0.13; // how far down the tip hangs
          const len = (58 + (lIdx % 3) * 16) * sc * leafU * st.k;
          const baseY = topY + (lIdx % 3) * 9 * sc;
          const tipX = crownX + side * len;
          const tipY = baseY + len * droop;
          g.save();
          g.fillStyle = lIdx % 3 === 0 ? 'rgba(104, 138, 62, 0.95)' : 'rgba(132, 164, 82, 0.95)';
          g.strokeStyle = '#4e6b2f';
          g.lineWidth = 1.2 * sc;
          g.beginPath();
          g.moveTo(crownX, baseY);
          // upper edge bows up, lower edge bows down: a leaf, not a lozenge
          g.quadraticCurveTo(crownX + side * len * 0.45, baseY - len * 0.22, tipX, tipY);
          g.quadraticCurveTo(crownX + side * len * 0.42, baseY + len * 0.10, crownX, baseY + 2 * sc);
          g.closePath();
          g.fill();
          g.stroke();
          g.restore();
        }
      }
    });
  }

  g.restore();
}

/**
 * Standalone sun, for scenes that use a plain parchment backdrop instead of the full cutaway.
 * Kept separate so the montage can be built from either.
 */
function drawBambooSun(g, prop, W, floorY, s, t, sceneT, sceneDuration, frame) {
  const col = fitColumn(frame, W, floorY, 1080);
  const cx = placeX(prop, col, W);
  const cy = floorY - (prop.elevation ?? 420) * s;
  const r = (prop.r ?? 30) * s;
  const phase = clamp01(sceneT / Math.max(0.001, sceneDuration));
  const arcX = cx + Math.sin((phase - 0.5) * Math.PI) * (prop.arc ?? 260) * s;
  const arcY = cy - Math.sin(phase * Math.PI) * (prop.arc ?? 260) * s * 0.5;
  const glow = g.createRadialGradient(arcX, arcY, r * 0.4, arcX, arcY, r * 4);
  glow.addColorStop(0, 'rgba(236, 170, 60, 0.30)');
  glow.addColorStop(1, 'rgba(236, 170, 60, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(arcX, arcY, r * 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e9a737';
  g.beginPath();
  g.arc(arcX, arcY, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2.4 * s;
  g.stroke();
}

/**
 * A small ink plate for "0 cm", "YEAR 1" and the like.
 *
 * Deliberately a prop rather than a board: boards are screen-space typography with their own
 * entrance/exit timing, and this label is *diegetic* — it is a measurement of the thing in frame,
 * so it has to sit on the soil line and move with the camera.
 */
function drawBambooLabel(g, prop, W, floorY, s, t, frame, sceneT, sceneDuration) {
  const col = fitColumn(frame, W, floorY, 1080);
  const ls = s;
  let text = String(prop.text ?? '0 cm');
  if (prop.track_growth) {
    // Once the bamboo is up, a label still reading "0 cm" is simply wrong on screen — the drawing
    // and the measurement would be contradicting each other in the same frame. Let it count up
    // with the shoot, so both tell the same story.
    const yr = prop.year_from !== undefined
      ? lerp(Number(prop.year_from), Number(prop.year_to ?? 5),
             clamp01(sceneT / Math.max(0.001, Number(sceneDuration) || 0.001)))
      : (prop.year !== undefined ? Number(prop.year) : 0);
    const grown = burst(yr, 4.35, 0.62);
    const metres = grown * (prop.max_metres ?? 4.2);
    text = grown > 0.02 ? `${metres.toFixed(1)} m` : String(prop.zero_text ?? '0 cm');
  }
  const y = floorY - (prop.elevation ?? 120) * s;

  g.save();
  g.font = `bold ${Math.round((prop.size ?? 30) * ls)}px PopB`;
  const padX = 16 * ls;
  const padY = 9 * ls;
  const tw = g.measureText(text).width;
  const plateW = tw + padX * 2;
  const plateH = (prop.size ?? 30) * ls + padY * 2;

  // keep the whole plate inside the crop column, then translate ONCE and draw everything
  // relative to the plate centre (translating after drawing put the plate at the canvas origin)
  const halfW = plateW / 2 + 40 * ls;
  const x = Math.max(col.left + halfW, Math.min(col.left + col.colW - halfW, placeX(prop, col, W)));
  g.globalAlpha = prop.opacity ?? 1;
  g.translate(x, y);
  g.rotate(((prop.tilt ?? -1.4) * Math.PI) / 180);

  g.fillStyle = prop.plate ?? PAPER_LIGHT;
  g.strokeStyle = prop.color ?? INK;
  g.lineWidth = 2.4 * ls;
  g.beginPath();
  g.roundRect(-plateW / 2, -plateH / 2, plateW, plateH, 4 * ls);
  g.fill();
  g.stroke();

  // hand-inked measuring tick to the left of the plate, so it reads as a measurement
  g.beginPath();
  g.moveTo(-plateW / 2 - 13 * ls, -plateH / 2 + 3 * ls);
  g.lineTo(-plateW / 2 - 13 * ls, plateH / 2 - 3 * ls);
  g.stroke();

  g.fillStyle = prop.color ?? INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 1 * ls);
  g.restore();
}

/** A single bamboo stalk, for the closing shot where the grove stands tall. */
function drawBambooStalk(g, prop, W, floorY, s, t, frame) {
  const col = fitColumn(frame, W, floorY, 1080);
  let x = placeX(prop, col, W);
  const h = (prop.height ?? 460) * s;
  const sway = Math.sin(t * 0.9 + (prop.x ?? 0.5) * 9) * 7 * s;
  const w = (prop.width ?? 11) * s;
  const baseY = floorY - (prop.elevation ?? 0) * s;
  const topY = baseY - h;
  const gold = Boolean(prop.gold);

  g.save();
  g.strokeStyle = gold ? GOLD : '#6f8a3f';
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x, baseY);
  g.quadraticCurveTo(x + sway * 0.5, baseY - h * 0.5, x + sway, topY);
  g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = 1.4 * s;
  g.beginPath();
  g.moveTo(x - w * 0.5, baseY);
  g.quadraticCurveTo(x + sway * 0.5 - w * 0.5, baseY - h * 0.5, x + sway - w * 0.4, topY);
  g.stroke();

  const nodes = Math.max(1, Math.round(h / (62 * s)));
  for (let n = 1; n <= nodes; n++) {
    const u = n / (nodes + 1);
    const nx = x + sway * u * u;
    const ny = baseY - h * u;
    inkLine(g, nx - w * 0.62, ny, nx + w * 0.62, ny, 1.8 * s, 0.6);
  }

  // leaf fans at three heights, so a grove reads even when the stalks overlap
  if (prop.leaves !== false) {
    for (let band = 0; band < 3; band++) {
      const u = 0.62 + band * 0.16;
      const lx = x + sway * u * u;
      const ly = baseY - h * u;
      for (let lIdx = 0; lIdx < 4; lIdx++) {
        const side = lIdx % 2 === 0 ? 1 : -1;
        const len = (30 + lIdx * 4 + band * 3) * s;
        g.strokeStyle = gold ? GOLD : '#5f7d38';
        g.lineWidth = 1.3 * s;
        g.beginPath();
        g.moveTo(lx, ly);
        g.quadraticCurveTo(lx + side * len * 0.6, ly - len * 0.3, lx + side * len, ly - len * 0.08);
        g.stroke();
      }
    }
  }
  g.restore();
}

/* ---------------------------------------------------------------------------------------------
 * Dispatch
 * ------------------------------------------------------------------------------------------- */

function drawBambooProp(g, prop, W, floorY, t, sceneT, s, sceneDuration, frame) {
  const ts = sceneT !== null && sceneT !== undefined ? sceneT : t;
  switch (prop.type) {
    case 'bamboo_cutaway':
      drawBambooCutaway(g, prop, W, floorY, s, t, ts, sceneDuration, frame);
      return true;
    case 'bamboo_sun':
      drawBambooSun(g, prop, W, floorY, s, t, ts, sceneDuration, frame);
      return true;
    case 'bamboo_label':
      drawBambooLabel(g, prop, W, floorY, s, t, frame, ts, sceneDuration);
      return true;
    case 'bamboo_stalk':
      drawBambooStalk(g, prop, W, floorY, s, t, frame);
      return true;
    default:
      return false;
  }
}

module.exports = {
  BAMBOO_BACKDROPS,
  BAMBOO_PROPS,
  yearProgress,
  burst,
  drawBambooBackdrop,
  drawBambooProp,
};
