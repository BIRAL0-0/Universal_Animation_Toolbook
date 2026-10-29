'use strict';

/**
 * "Beacon & Harbor" set extension for the warm parchment / hand-inked style.
 *
 * The core engine ships a fixed prop library (`world_props_and_boards.js`) and a fixed list of
 * parchment backdrops (`parchment_ink_style.js`). Per `process/08_LIMITS.md`, a bespoke object is
 * drawn in the prop library and registered in `SUPPORTED_PROPS`. This module keeps that new work
 * in ONE file so the core engine only needs two tiny dispatch hooks:
 *
 *   1. `parchment_ink_style.js :: drawParchmentEnvironment`  -> `drawBeaconBackdrop`
 *   2. `world_props_and_boards.js :: drawWorldProp`          -> `drawBeaconProp`
 *
 * Everything here is deterministic (no per-frame randomness), drawn with the same ink-and-wash
 * vocabulary as the rest of the style (hand-bowed ink lines, warm paper fills, crimson accents,
 * restrained shading) and it never touches film grain.
 *
 * The heart of the set is `keeperPattern()` — one timing model shared by the tower's beam, the
 * lantern-room mechanism and the window light bars, so "three steady sweeps, then a pause" is
 * literally the same clock everywhere in the film.
 */

const INK = '#1a1612';
const INK_SOFT = 'rgba(26, 22, 18, 0.52)';
const INK_FAINT = 'rgba(26, 22, 18, 0.20)';
const PAPER_LIGHT = '#f7ebd4';
const PAPER_MID = '#efe0c2';
const CRIMSON = '#cc292b';
const LAMP = '#f5b223';
const SEA_WASH = 'rgba(96, 128, 154, 0.13)';

// -----------------------------------------------------------------------------------------------
// Small drawing primitives (local copies so this module never creates a require cycle)
// -----------------------------------------------------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const a3 = (v) => Math.round(clamp01(v) * 1000) / 1000;

/** Deterministic 0..1 hash — used for flicker and organic jitter (never per-frame random). */
function hash1(n) {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** Hand-inked stroke with a slight organic bow in the middle, exactly like the core style. */
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
  g.quadraticCurveTo((x1 + x2) * 0.5 + nx * wobble, (y1 + y2) * 0.5 + ny * wobble, x2, y2);
  g.stroke();
  g.restore();
}

function inkPath(g, pts, width = 3.2, color = INK, close = false, fill = null) {
  if (!pts || pts.length < 2) return;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  g.stroke();
  g.restore();
}

function inkBox(g, x, y, w, h, fill = PAPER_LIGHT, lineW = 3.2, radius = 4) {
  g.save();
  if (fill) {
    g.fillStyle = fill;
    g.beginPath();
    g.roundRect(x, y, w, h, radius);
    g.fill();
  }
  g.strokeStyle = INK;
  g.lineWidth = lineW;
  g.lineJoin = 'round';
  g.beginPath();
  g.roundRect(x, y, w, h, radius);
  g.stroke();
  g.restore();
}

function softWash(g, cx, cy, r, rgb, peak) {
  const gr = g.createRadialGradient(cx, cy, Math.max(2, r * 0.06), cx, cy, r);
  gr.addColorStop(0, `rgba(${rgb}, ${a3(peak)})`);
  gr.addColorStop(0.55, `rgba(${rgb}, ${a3(peak * 0.34)})`);
  gr.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

/** A row of hand-drawn water: sine ripple with a deterministic per-row phase offset. */
function waveRow(g, x0, x1, y, amp, spacing, phase, width, color) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  let started = false;
  for (let x = x0; x <= x1; x += spacing) {
    const yy = y + Math.sin(x * 0.028 + phase) * amp;
    if (!started) {
      g.moveTo(x, yy);
      started = true;
    } else {
      g.quadraticCurveTo(x - spacing * 0.5, y + Math.sin((x - spacing * 0.5) * 0.028 + phase) * amp * 1.12, x, yy);
    }
  }
  g.stroke();
  g.restore();
}

// -----------------------------------------------------------------------------------------------
// The keeper's pattern — ONE clock for the whole film
// -----------------------------------------------------------------------------------------------

const PATTERN = Object.freeze({
  period: 4.4,
  // Three light sweeps, then the long pause every boat in the harbor counts on.
  sweeps: [
    [0.2, 1.0],
    [1.2, 2.0],
    [2.2, 3.0],
  ],
  pause: [3.0, 4.4],
});

/**
 * gate(ts, mode) -> { on, sweep, prog, spin }
 *   `on`    lamp brightness 0..1 for this instant
 *   `sweep` index of the active sweep (0..2) or -1 while the light is paused
 *   `prog`  0..1 progress through the active sweep (drives beam angle)
 *   `spin`  shutter rotation in radians (steady mode turns 3/4 of a revolution per sweep set)
 *
 * modes: 'steady' | 'shaded' (same clock, dimmed) | 'flicker' (bright but unreliable) | 'off'
 */
function keeperGate(ts, mode = 'steady', spinRate = 1.0) {
  const t = Number.isFinite(ts) ? ts : 0;
  if (mode === 'off') return { on: 0, sweep: -1, prog: 0, spin: t * 0.5 * spinRate };

  if (mode === 'flicker') {
    // Bright, busy and unreadable: irregular on/off, no pause structure, jittering angle.
    const slot = Math.floor(t * 5.4);
    const r = hash1(slot);
    const raw = r > 0.44 ? 1 : 0.16;
    const jitter = 0.6 + 0.4 * Math.abs(Math.sin(t * 8.7) * Math.sin(t * 3.1 + 1.2));
    const sweepBySlot = slot % 4;
    return {
      on: raw * jitter,
      sweep: raw > 0.5 ? sweepBySlot : -1,
      prog: ((t * 3.3) % 1 + 1) % 1,
      spin: t * 2.15 * spinRate,
    };
  }

  const phase = ((t % PATTERN.period) + PATTERN.period) % PATTERN.period;
  let sweep = -1;
  let prog = 0;
  for (let i = 0; i < PATTERN.sweeps.length; i++) {
    const [s0, s1] = PATTERN.sweeps[i];
    if (phase >= s0 && phase <= s1) {
      sweep = i;
      prog = (phase - s0) / (s1 - s0);
      break;
    }
  }
  const gain = mode === 'shaded' ? 0.66 : 1.0;
  const edge = sweep >= 0 ? Math.min(1, Math.sin(prog * Math.PI) * 1.55 + 0.25) : 0;
  return { on: edge * gain, sweep, prog, spin: phase * 0.62 * spinRate };
}

// -----------------------------------------------------------------------------------------------
// Backdrops
// -----------------------------------------------------------------------------------------------


// The camera can pan/zoom inside the 1920x1080 frame, so every full-width wash, floor, sea band
// and rail has to be painted far past the frame edges or a hard vertical seam appears mid-shot.
const VIEW_L = -1600;
const VIEW_R = 3520;
const VIEW_W = VIEW_R - VIEW_L;

const HOUR_WASH = {
  dusk: { top: 'rgba(88, 70, 116, 0.13)', low: 'rgba(232, 118, 68, 0.19)', orb: null, sea: 0.12 },
  night: { top: 'rgba(24, 38, 66, 0.30)', low: 'rgba(32, 52, 84, 0.15)', orb: 'moon', sea: 0.15 },
  fog: { top: 'rgba(70, 88, 104, 0.34)', low: 'rgba(96, 112, 124, 0.22)', orb: null, sea: 0.10 },
  dawn: { top: 'rgba(120, 128, 152, 0.18)', low: 'rgba(247, 178, 59, 0.24)', orb: 'sun', sea: 0.10 },
  sunrise: { top: 'rgba(150, 132, 138, 0.14)', low: 'rgba(250, 196, 88, 0.32)', orb: 'sun', sea: 0.09 },
};

function skyWash(g, hour, floorY, fog) {
  const w = HOUR_WASH[hour] || HOUR_WASH.dusk;
  const gr = g.createLinearGradient(0, 0, 0, floorY);
  gr.addColorStop(0, w.top);
  gr.addColorStop(1, w.low);
  g.save();
  g.globalAlpha = a3(1 - fog * 0.25);
  g.fillStyle = gr;
  g.fillRect(VIEW_L, -40, VIEW_W, floorY + 40);
  g.restore();
  return w;
}

function drawMoonOrb(g, hour, floorY, fog, t) {
  const w = HOUR_WASH[hour] || HOUR_WASH.dusk;
  if (!w.orb) return;
  const isSun = w.orb === 'sun';
  const cx = isSun ? 1478 : 1508;
  const cy = isSun ? floorY - 236 : 236;
  const r = isSun ? 74 : 52;
  g.save();
  g.globalAlpha = a3(clamp01(1 - fog * (isSun ? 0.7 : 1.35)));
  softWash(g, cx, cy, r * (isSun ? 5.2 : 3.4), isSun ? '250, 200, 96' : '236, 232, 214', isSun ? 0.34 : 0.2);
  g.fillStyle = isSun ? 'rgba(255, 226, 142, 0.80)' : 'rgba(250, 246, 232, 0.86)';
  g.strokeStyle = INK;
  g.lineWidth = 3.0;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (!isSun) {
    // Crescent shading ticks, restrained
    g.strokeStyle = INK_SOFT;
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(cx - r * 0.34, cy - r * 0.1, r * 0.78, -Math.PI * 0.62, Math.PI * 0.52);
    g.stroke();
  }
  g.restore();
}

/** Small ink town on the left headland: roofs, chimneys, warm windows. */
function drawTownfront(g, baseY, waterY, hour, fog, t) {
  const night = hour === 'night' || hour === 'fog';
  g.save();
  g.globalAlpha = a3(clamp01(1 - fog * 0.55));
  // Headland the town sits on, meeting the waterline
  inkPath(
    g,
    [
      [-60, waterY + 8],
      [40, baseY + 30],
      [150, baseY + 6],
      [250, baseY - 4],
      [400, baseY + 12],
      [500, baseY + 44],
      [556, waterY + 8],
    ],
    3.0,
    INK_SOFT,
    true,
    'rgba(150, 112, 62, 0.13)'
  );
  const houses = [
    [40, 96, 74],
    [148, 78, 92],
    [244, 104, 66],
    [352, 86, 78],
    [452, 70, 58],
  ];
  houses.forEach(([hx, hw, hh], i) => {
    const hy = baseY - hh + 16;
    inkBox(g, hx, hy, hw, hh, PAPER_LIGHT, 2.8, 3);
    // pitched roof
    inkPath(g, [[hx - 7, hy], [hx + hw * 0.5, hy - 30], [hx + hw + 7, hy]], 2.8, INK, true, 'rgba(120, 88, 48, 0.20)');
    // chimney
    inkLine(g, hx + hw * 0.74, hy - 16, hx + hw * 0.74, hy - 40, 2.6, 0.6);
    // window: warm at dusk/night, dark by day
    const warm = night || hour === 'dusk';
    inkBox(
      g,
      hx + hw * 0.28,
      hy + hh * 0.30,
      20,
      22,
      warm ? 'rgba(255, 219, 130, 0.92)' : PAPER_MID,
      2.2,
      2
    );
    if (warm) softWash(g, hx + hw * 0.28 + 10, hy + hh * 0.30 + 11, 46, '245, 178, 35', 0.2 + 0.05 * hash1(i));
    // a wisp of smoke in the cold scenes only
    if (night) {
      g.save();
      g.strokeStyle = 'rgba(26, 22, 18, 0.22)';
      g.lineWidth = 2.0;
      g.beginPath();
      for (let k = 0; k <= 3; k++) {
        const sy = hy - 44 - k * 15;
        const sx = hx + hw * 0.74 + Math.sin(t * 0.7 + k * 0.9 + i) * (4 + k * 2.4);
        if (k === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      }
      g.stroke();
      g.restore();
    }
  });
  g.restore();
}

/** Stone breakwater out in the harbor with a crimson warning mark at its tip. */
function drawBreakwater(g, floorY, fog, t) {
  const y = floorY - 152;
  g.save();
  g.globalAlpha = a3(clamp01(1 - fog * 0.62));
  const stones = [
    [1092, 46, 22],
    [1152, 54, 26],
    [1218, 48, 22],
    [1276, 56, 24],
    [1342, 46, 20],
    [1398, 40, 18],
  ];
  stones.forEach(([sx, sw, sh], i) => {
    const lift = Math.sin(t * 0.9 + i) * 0.4;
    inkPath(
      g,
      [
        [sx - sw * 0.5, y + 20],
        [sx - sw * 0.36, y - sh * 0.5 + lift],
        [sx + sw * 0.3, y - sh * 0.62 + lift],
        [sx + sw * 0.52, y + 18],
      ],
      2.8,
      INK,
      true,
      'rgba(150, 116, 68, 0.17)'
    );
  });
  // warning mark on the seaward tip
  inkLine(g, 1418, y - 6, 1418, y - 44, 3.4, 0.7);
  inkPath(g, [[1418, y - 44], [1450, y - 36], [1418, y - 26]], 2.6, INK, true, 'rgba(204, 41, 43, 0.55)');
  g.restore();
}

function drawQuayFloor(g, floorY, fog) {
  g.save();
  g.fillStyle = 'rgba(238, 224, 194, 0.55)';
  g.fillRect(VIEW_L, floorY, VIEW_W, 1080 - floorY + 60);
  g.restore();
  inkLine(g, VIEW_L, floorY, VIEW_R, floorY, 4.0, 1.6);
  // granite block seams
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.20)';
  g.lineWidth = 2.0;
  for (let hx = VIEW_L; hx < VIEW_R; hx += 128) {
    g.beginPath();
    g.moveTo(hx, floorY + 9);
    g.lineTo(hx + 30, floorY + 9);
    g.stroke();
  }
  for (let hy = floorY + 46; hy < 1060; hy += 58) {
    g.beginPath();
    g.moveTo(-140, hy);
    g.lineTo(2060, hy);
    g.stroke();
  }
  g.restore();
}

function drawFogWash(g, floorY, fog, t, bandTop) {
  if (fog <= 0.01) return;
  g.save();
  for (let i = 0; i < 5; i++) {
    const by = bandTop + i * ((floorY + 40 - bandTop) / 5);
    const drift = Math.sin(t * 0.21 + i * 1.7) * 60;
    const h = 74 + i * 16;
    const gr = g.createLinearGradient(0, by - h * 0.6, 0, by + h * 0.7);
    gr.addColorStop(0, 'rgba(246, 240, 226, 0)');
    gr.addColorStop(0.5, `rgba(246, 240, 226, ${a3(0.5 * fog)})`);
    gr.addColorStop(1, 'rgba(246, 240, 226, 0)');
    g.fillStyle = gr;
    g.fillRect(VIEW_L + drift, by - h * 0.6, VIEW_W + 1600, h * 1.3);
  }
  // cool tint so the fog reads as weather, not as a missing background
  g.fillStyle = `rgba(104, 122, 138, ${a3(0.16 * fog)})`;
  g.fillRect(VIEW_L, -40, VIEW_W, floorY + 80);
  g.restore();
}

/** `parchment_harbor` — dusk/night/dawn quay with sea, town, breakwater and weather. */
function drawHarborBackdrop(g, st, globalT, ts, floorY) {
  const hour = st.hour || 'dusk';
  const fog = clamp01(Number(st.fog ?? 0));
  const t = globalT;

  const wash = skyWash(g, hour, floorY, fog);
  drawMoonOrb(g, hour, floorY, fog, t);

  const seaTop = floorY - 214;
  const horizon = seaTop + 6;

  // distant hills behind the town
  g.save();
  g.globalAlpha = a3(clamp01(1 - fog * 0.7));
  inkPath(
    g,
    [
      [1120, horizon + 4],
      [1320, horizon - 52],
      [1520, horizon - 18],
      [1720, horizon - 62],
      [1990, horizon + 6],
    ],
    2.6,
    INK_FAINT,
    false
  );
  g.restore();

  drawTownfront(g, horizon - 34, horizon, hour, fog, t);

  // Sea band + ripples
  g.save();
  g.fillStyle = `rgba(96, 128, 154, ${a3(wash.sea * (1 - fog * 0.4))})`;
  g.fillRect(VIEW_L, horizon, VIEW_W, floorY - horizon);
  g.restore();
  inkLine(g, VIEW_L, horizon, VIEW_R, horizon, 2.6, 1.0, 'rgba(26, 22, 18, 0.44)');

  const rows = 5;
  for (let i = 0; i < rows; i++) {
    const frac = (i + 1) / (rows + 0.4);
    const wy = lerp(horizon + 12, floorY - 14, frac * frac);
    const amp = lerp(2.0, 6.4, frac);
    const alpha = lerp(0.22, 0.5, frac) * (1 - fog * 0.5);
    waveRow(g, VIEW_L + 60, VIEW_R - 60, wy, amp, 26, t * (0.9 + i * 0.16) + i * 1.9, 2.2 + i * 0.22, `rgba(26, 22, 18, ${a3(alpha)})`);
  }

  drawBreakwater(g, floorY, fog, t);
  drawQuayFloor(g, floorY, fog);
  drawFogWash(g, floorY, fog, t, seaTop - 150);

  // Light-painted path on the water when the beacon is sweeping the harbor
  const beam = st.beam_pattern || 'steady';
  const gate = keeperGate(ts, beam);
  if (gate.on > 0.02) {
    const bx = (st.beam_from_x ?? 0.87) * 1920;
    const by = st.beam_from_y !== undefined ? Number(st.beam_from_y) : floorY - 470;
    const ang = lerp(-0.36, 0.3, gate.prog);
    const reach = 1500;
    // beam_dir: -1 lights the water to the left of the lamp, +1 to the right
    const bdir = Number(st.beam_dir ?? -1) >= 0 ? 1 : -1;
    const endX = bx + bdir * Math.cos(ang) * reach;
    const endY = lerp(by, floorY - 60, 0.72) + Math.sin(ang) * reach * 0.16;
    g.save();
    g.globalAlpha = a3(gate.on * (1 - fog * 0.28));
    const gr = g.createLinearGradient(bx, by, endX, endY);
    gr.addColorStop(0, `rgba(245, 178, 35, ${a3(0.4 * gate.on)})`);
    gr.addColorStop(1, 'rgba(245, 178, 35, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(endX, endY - 74);
    g.lineTo(endX, endY + 74);
    g.closePath();
    g.fill();
    // glitter path on the water
    g.strokeStyle = `rgba(255, 214, 110, ${a3(0.5 * gate.on)})`;
    g.lineWidth = 2.4;
    for (let k = 0; k < 9; k++) {
      const ku = 0.16 + k * 0.09;
      const gx = lerp(bx, endX, ku);
      const gy = floorY - 132 + k * 11;
      g.beginPath();
      g.moveTo(gx - 14, gy);
      g.lineTo(gx + 14, gy);
      g.stroke();
    }
    g.restore();
  }

  return { lightColor: LAMP, isParchment: true };
}

/** `parchment_lantern` — the lantern room: warm walls, arched window, sweeping light bars. */
function drawLanternRoomBackdrop(g, st, globalT, ts, floorY) {
  const hour = st.hour || 'night';
  const fog = clamp01(Number(st.fog ?? 0));
  const beam = st.beam_pattern || 'steady';
  const t = globalT;

  // Interior wall wash — warm, lamplit, slightly darker at the top
  const wr = g.createLinearGradient(0, 0, 0, floorY);
  wr.addColorStop(0, 'rgba(92, 66, 36, 0.26)');
  wr.addColorStop(0.55, 'rgba(214, 168, 96, 0.14)');
  wr.addColorStop(1, 'rgba(120, 86, 46, 0.20)');
  g.fillStyle = wr;
  g.fillRect(VIEW_L, -40, VIEW_W, floorY + 40);

  // Curved masonry: radial ribs + two horizontal courses
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.11)';
  g.lineWidth = 2.0;
  for (let i = 0; i <= 26; i++) {
    const rx = VIEW_L + i * 200;
    g.beginPath();
    g.moveTo(rx, 96);
    g.lineTo(rx + 26, floorY - 6);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(VIEW_L, 210);
  g.lineTo(VIEW_R, 226);
  g.stroke();
  g.beginPath();
  g.moveTo(VIEW_L, floorY - 196);
  g.lineTo(VIEW_R, floorY - 208);
  g.stroke();
  g.restore();

  // Arched window onto the sea
  const winCx = (st.window_x ?? 0.26) * 1920;
  const winW = (st.window_w ?? 0.30) * 1920;
  const winTop = floorY - 508;
  const winBot = floorY - 214;
  const seaTop = winBot - 44;

  g.save();
  g.beginPath();
  g.moveTo(winCx - winW * 0.5, winBot);
  g.lineTo(winCx - winW * 0.5, winTop + 78);
  g.quadraticCurveTo(winCx, winTop - 66, winCx + winW * 0.5, winTop + 78);
  g.lineTo(winCx + winW * 0.5, winBot);
  g.closePath();
  g.clip();

  const sky = HOUR_WASH[hour] || HOUR_WASH.night;
  const night = hour === 'night' || hour === 'fog';
  const gr = g.createLinearGradient(0, winTop - 70, 0, winBot);
  if (night) {
    gr.addColorStop(0, 'rgba(22, 36, 62, 0.66)');
    gr.addColorStop(1, 'rgba(52, 72, 96, 0.42)');
  } else if (hour === 'dusk') {
    gr.addColorStop(0, 'rgba(88, 70, 116, 0.42)');
    gr.addColorStop(1, 'rgba(240, 150, 84, 0.42)');
  } else {
    gr.addColorStop(0, 'rgba(150, 160, 186, 0.30)');
    gr.addColorStop(1, 'rgba(250, 198, 104, 0.46)');
  }
  g.fillStyle = gr;
  g.fillRect(winCx - winW, winTop - 90, winW * 2, winBot - winTop + 120);

  if (sky.orb === 'moon' && fog < 0.55) {
    g.save();
    g.globalAlpha = a3(1 - fog * 1.6);
    g.fillStyle = 'rgba(250, 246, 232, 0.8)';
    g.beginPath();
    g.arc(winCx + winW * 0.24, winTop + 40, 22, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else if (sky.orb === 'sun') {
    softWash(g, winCx - winW * 0.18, seaTop - 16, 150, '250, 200, 96', 0.4);
  }

  g.fillStyle = `rgba(84, 116, 142, ${a3(night ? 0.34 : 0.24)})`;
  g.fillRect(winCx - winW, seaTop, winW * 2, winBot - seaTop + 10);
  inkLine(g, winCx - winW, seaTop, winCx + winW, seaTop, 2.4, 0.6, 'rgba(26, 22, 18, 0.5)');
  for (let i = 0; i < 3; i++) {
    waveRow(g, winCx - winW * 0.9, winCx + winW * 0.9, seaTop + 22 + i * 26, 3 + i * 1.6, 22, t * (1 + i * 0.3) + i, 2.0, `rgba(26, 22, 18, ${a3(0.3 + i * 0.08)})`);
  }

  // weather outside the glass
  if (fog > 0.02) {
    for (let i = 0; i < 4; i++) {
      const by = seaTop - 90 + i * 58;
      const drift = Math.sin(t * 0.3 + i) * 34;
      g.fillStyle = `rgba(244, 238, 224, ${a3(0.36 * fog)})`;
      g.fillRect(winCx - winW + drift, by, winW * 2, 44);
    }
  }
  // Distant harbor traffic seen through the glass (one entry per boat)
  const boats = Array.isArray(st.window_boats)
    ? st.window_boats
    : st.window_boat
    ? [{ x: st.window_boat_x ?? 0.2, lamp: st.window_boat_lamp, scale: 1 }]
    : [];
  boats.forEach((bt, bi) => {
    const bx = winCx + winW * (bt.x ?? 0.0);
    const sc = bt.scale ?? 0.62;
    const by = seaTop + 16 + bi * 9 + Math.sin(t * (1.1 + bi * 0.22) + bi) * 2.2;
    g.save();
    g.globalAlpha = a3(clamp01(1 - fog * 0.5));
    inkPath(
      g,
      [
        [bx - 30 * sc, by],
        [bx + 30 * sc, by],
        [bx + 19 * sc, by + 12 * sc],
        [bx - 19 * sc, by + 12 * sc],
      ],
      2.4,
      INK,
      true,
      'rgba(150, 116, 68, 0.4)'
    );
    inkLine(g, bx, by, bx, by - 26 * sc, 2.0, 0.4);
    g.restore();
    if (bt.lamp) {
      softWash(g, bx - 20 * sc, by - 4 * sc, 44 * sc, '255, 214, 110', 0.55);
      g.fillStyle = 'rgba(255, 226, 140, 0.95)';
      g.beginPath();
      g.arc(bx - 20 * sc, by - 4 * sc, 4.0 * sc, 0, Math.PI * 2);
      g.fill();
    }
  });
  g.restore();

  // glass frame, mullions and sill
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 5.0;
  g.beginPath();
  g.moveTo(winCx - winW * 0.5, winBot);
  g.lineTo(winCx - winW * 0.5, winTop + 78);
  g.quadraticCurveTo(winCx, winTop - 66, winCx + winW * 0.5, winTop + 78);
  g.lineTo(winCx + winW * 0.5, winBot);
  g.stroke();
  g.lineWidth = 2.8;
  g.strokeStyle = 'rgba(26, 22, 18, 0.6)';
  for (let i = 1; i < 4; i++) {
    const mx = winCx - winW * 0.5 + (winW * i) / 4;
    g.beginPath();
    g.moveTo(mx, winTop + 40 + Math.abs(i - 2) * 24);
    g.lineTo(mx, winBot);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(winCx - winW * 0.5, (winTop + winBot) * 0.5 + 26);
  g.lineTo(winCx + winW * 0.5, (winTop + winBot) * 0.5 + 26);
  g.stroke();
  g.restore();
  inkBox(g, winCx - winW * 0.5 - 14, winBot, winW + 28, 16, PAPER_MID, 3.0, 3);

  // Brass guard rail behind the keepers
  const railY = floorY - 132;
  inkLine(g, VIEW_L, railY, VIEW_R, railY, 3.6, 1.1);
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.55)';
  g.lineWidth = 2.6;
  for (let rx = -1520; rx < VIEW_R; rx += 96) {
    if (rx > winCx - winW * 0.5 - 20 && rx < winCx + winW * 0.5 + 20) continue;
    g.beginPath();
    g.moveTo(rx, railY);
    g.lineTo(rx, floorY - 22);
    g.stroke();
  }
  g.restore();

  // Floorboards
  g.save();
  g.fillStyle = 'rgba(226, 205, 168, 0.62)';
  g.fillRect(VIEW_L, floorY, VIEW_W, 1080 - floorY + 60);
  g.strokeStyle = 'rgba(26, 22, 18, 0.26)';
  g.lineWidth = 2.0;
  for (let bx2 = VIEW_L; bx2 < VIEW_R; bx2 += 96) {
    g.beginPath();
    g.moveTo(bx2, floorY + 6);
    g.lineTo(bx2 - 22, 1078);
    g.stroke();
  }
  for (let by2 = floorY + 34; by2 < 1070; by2 += 62) {
    g.beginPath();
    g.moveTo(VIEW_L, by2);
    g.lineTo(VIEW_R, by2);
    g.stroke();
  }
  g.restore();
  inkLine(g, VIEW_L, floorY, VIEW_R, floorY, 3.8, 1.4);

  // The lamp's own light, and the three sweeps crossing the room
  const gate = keeperGate(ts, beam);
  const glowX = (st.glow_x ?? 0.74) * 1920;
  const glowY = floorY - 330;
  if (gate.on > 0.02) {
    softWash(g, glowX, glowY, 520, '245, 178, 35', 0.3 * gate.on);
    const dir = st.window_x < 0.5 ? -1 : 1;
    for (let b = 0; b < 2; b++) {
      const barU = clamp01(gate.prog + b * 0.42);
      const bx0 = glowX - dir * (90 + barU * 1500);
      g.save();
      g.globalAlpha = a3(gate.on * 0.5);
      const lg = g.createLinearGradient(glowX, glowY, bx0, floorY - 60);
      lg.addColorStop(0, `rgba(255, 220, 128, ${a3(0.34 * gate.on)})`);
      lg.addColorStop(1, 'rgba(255, 220, 128, 0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(glowX, glowY - 26);
      g.lineTo(bx0, floorY - 150);
      g.lineTo(bx0, floorY - 30);
      g.closePath();
      g.fill();
      g.restore();
    }
  } else {
    // never a black room: cold moonlight fallback
    g.fillStyle = 'rgba(120, 140, 168, 0.10)';
    g.fillRect(VIEW_L, -40, VIEW_W, floorY + 40);
  }

  return { lightColor: LAMP, isParchment: true };
}

const HARBOR_BACKDROPS = Object.freeze(['parchment_harbor', 'parchment_lantern']);

function drawBeaconBackdrop(g, setting, globalT, ts, panX, floorY) {
  const st = setting || {};
  if (st.backdrop === 'parchment_lantern') return drawLanternRoomBackdrop(g, st, globalT, ts, floorY);
  return drawHarborBackdrop(g, st, globalT, ts, floorY);
}

// -----------------------------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------------------------

const BEACON_PROPS = Object.freeze([
  'beacon_tower',
  'beacon_mechanism',
  'harbor_boat',
  'oil_flask',
  'fog_bank',
  'keeper_bench',
  'rope_coil',
  'channel_marker',
]);

/** The harbor beacon seen from the quay: rock, tower, lantern room and its sweeping beam. */
function drawBeaconTower(g, prop, px, floorY, s, t, gate) {
  const rockW = 230 * s;
  const rockH = 54 * s;
  const baseY = floorY - 4 * s;
  const th = (prop.height ?? 322) * s;
  const topY = baseY - th - rockH * 0.4;
  const bwHalf = 62 * s;
  const twHalf = 40 * s;

  // rock plinth
  inkPath(
    g,
    [
      [px - rockW * 0.5, baseY + 6],
      [px - rockW * 0.3, baseY - rockH * 0.72],
      [px - rockW * 0.08, baseY - rockH],
      [px + rockW * 0.26, baseY - rockH * 0.8],
      [px + rockW * 0.5, baseY + 6],
    ],
    3.2,
    INK,
    true,
    'rgba(150, 116, 68, 0.24)'
  );

  const bodyBottom = baseY - rockH * 0.5;
  // tower body, gently tapered
  inkPath(
    g,
    [
      [px - bwHalf, bodyBottom],
      [px - twHalf, topY],
      [px + twHalf, topY],
      [px + bwHalf, bodyBottom],
    ],
    3.6,
    INK,
    true,
    PAPER_LIGHT
  );
  // two crimson bands + a door
  const bands = [0.32, 0.62];
  bands.forEach((f) => {
    const by = lerp(bodyBottom, topY, f);
    const half = lerp(bwHalf, twHalf, f);
    inkPath(
      g,
      [
        [px - half, by],
        [px + half, by],
        [px + half, by - 20 * s],
        [px - half, by - 20 * s],
      ],
      2.6,
      INK_SOFT,
      true,
      'rgba(204, 41, 43, 0.34)'
    );
  });
  inkPath(
    g,
    [
      [px - 15 * s, bodyBottom],
      [px - 15 * s, bodyBottom - 40 * s],
      [px, bodyBottom - 50 * s],
      [px + 15 * s, bodyBottom - 40 * s],
      [px + 15 * s, bodyBottom],
    ],
    2.8,
    INK,
    true,
    PAPER_MID
  );
  // stair window ticks
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.4)';
  g.lineWidth = 2.0;
  for (let i = 1; i <= 4; i++) {
    const wy = lerp(bodyBottom - 64 * s, topY + 26 * s, i / 5);
    const half = lerp(bwHalf, twHalf, (wy - topY) / (bodyBottom - topY));
    g.beginPath();
    g.roundRect(px - 7 * s, wy, 14 * s, 12 * s, 3);
    g.stroke();
  }
  g.restore();

  // gallery deck + rail
  inkBox(g, px - twHalf - 15 * s, topY - 12 * s, (twHalf + 15 * s) * 2, 13 * s, PAPER_MID, 3.0, 3);
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.6)';
  g.lineWidth = 1.9;
  for (let rx = -twHalf - 10 * s; rx <= twHalf + 10 * s; rx += 12 * s) {
    g.beginPath();
    g.moveTo(px + rx, topY - 30 * s);
    g.lineTo(px + rx, topY - 12 * s);
    g.stroke();
  }
  g.restore();
  inkLine(g, px - twHalf - 15 * s, topY - 30 * s, px + twHalf + 15 * s, topY - 30 * s, 2.6, 0.6);

  // lantern room
  const lrW = 34 * s;
  const lrH = 56 * s;
  const lrBottom = topY - 30 * s;
  const lrTop = lrBottom - lrH;
  const lampCx = px;
  const lampCy = lrBottom - lrH * 0.52;

  g.save();
  g.fillStyle = gate.on > 0.02 ? `rgba(255, 226, 130, ${a3(0.5 + 0.45 * gate.on)})` : 'rgba(232, 224, 206, 0.7)';
  g.strokeStyle = INK;
  g.lineWidth = 3.2;
  g.beginPath();
  g.roundRect(lampCx - lrW, lrTop, lrW * 2, lrH, 4 * s);
  g.fill();
  g.stroke();
  g.restore();
  if (gate.on > 0.02) softWash(g, lampCx, lampCy, 168 * s, '245, 178, 35', 0.72 * gate.on);
  // lamp core + vertical glazing bars
  g.save();
  g.fillStyle = `rgba(255, 246, 214, ${a3(0.55 + 0.45 * gate.on)})`;
  g.beginPath();
  g.ellipse(lampCx, lampCy, 12 * s, 15 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(26, 22, 18, 0.5)';
  g.lineWidth = 1.8;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(lampCx + i * lrW * 0.62, lrTop + 2);
    g.lineTo(lampCx + i * lrW * 0.62, lrBottom - 2);
    g.stroke();
  }
  g.restore();

  // dome roof + finial vane
  inkPath(
    g,
    [
      [lampCx - lrW - 6 * s, lrTop],
      [lampCx, lrTop - 34 * s],
      [lampCx + lrW + 6 * s, lrTop],
    ],
    3.2,
    INK,
    true,
    'rgba(120, 88, 48, 0.34)'
  );
  inkLine(g, lampCx, lrTop - 34 * s, lampCx, lrTop - 54 * s, 2.4, 0.4);
  inkPath(g, [[lampCx, lrTop - 54 * s], [lampCx + 22 * s, lrTop - 47 * s], [lampCx, lrTop - 40 * s]], 2.2, INK, true, 'rgba(204, 41, 43, 0.5)');

  // The beam: one lobe, carried across the harbor by the rotation. During the pause there is
  // nothing on the water at all — that absence is the whole point of the film's design.
  if (prop.beams !== false && gate.on > 0.02) {
    const dir = prop.beam_dir === -1 ? -1 : 1;
    const reach = (prop.beam_reach ?? 1180) * s;
    const spread = 0.075 + 0.05 * Math.abs(Math.sin(t * 0.8));
    const ang = lerp(-0.40, 0.34, gate.prog) * (prop.beam_swing ?? 1);
    const ex = lampCx + dir * Math.cos(ang) * reach;
    const ey = lampCy + Math.sin(ang) * reach * 0.34;
    g.save();
    const lg = g.createLinearGradient(lampCx, lampCy, ex, ey);
    lg.addColorStop(0, `rgba(255, 224, 128, ${a3(0.44 * gate.on)})`);
    lg.addColorStop(0.6, `rgba(247, 186, 62, ${a3(0.17 * gate.on)})`);
    lg.addColorStop(1, 'rgba(247, 186, 62, 0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(lampCx, lampCy - 13 * s);
    g.lineTo(ex, ey - reach * spread);
    g.lineTo(ex, ey + reach * spread);
    g.closePath();
    g.fill();
    g.restore();
    // faint counter-glow on the opposite side of the lamp, so it reads as a rotating optic
    softWash(g, lampCx - dir * 44 * s, lampCy, 120 * s, '245, 178, 35', 0.22 * gate.on);
  }
}

/**
 * Close-up of the keeper's lamp: oil font, flame, parabolic mirror, the three-window shutter
 * drum, the hand wheel, and the light that leaves it.
 *
 * The drum is drawn as a turning cylinder — its three apertures pass the front face one after
 * another — so the mechanism reads as *rotation*, and the beam only exists while the shared
 * keeper's clock (`keeperGate`) says it should. `slow_at` / `slow_dur` ramp the spin down and
 * `shade_at` / `shade_dur` swing a shading paddle over the mirror: the two fixes in scene five.
 */
function drawBeaconMechanism(g, prop, px, floorY, s, t, ts, gate) {
  const stand = (prop.stand_height ?? 126) * s;
  const baseY = floorY - 6 * s;
  const deckY = baseY - stand;
  const cx = px;
  const cy = deckY - 104 * s;
  const bright = prop.bright ?? 1.0;

  const spin = prop.spin ?? 1.0;
  const spinTo = prop.spin_to ?? spin;
  const slowAt = Number(prop.slow_at ?? -1);
  let rate = spin;
  if (slowAt >= 0) {
    const k = clamp01((ts - slowAt) / Math.max(0.35, Number(prop.slow_dur ?? 3.2)));
    rate = lerp(spin, spinTo, ease(k));
  }
  const shadeAt = Number(prop.shade_at ?? -1);
  const shadeAmt = shadeAt >= 0 ? clamp01((ts - shadeAt) / Math.max(0.4, Number(prop.shade_dur ?? 2.6))) : 0;
  const dim = 1 - shadeAmt * 0.52;
  const lit = gate.on * bright * dim;

  // ---- plinth, column, deck plate
  inkBox(g, cx - 128 * s, baseY - 15 * s, 256 * s, 17 * s, PAPER_MID, 3.2, 4);
  inkPath(
    g,
    [
      [cx - 30 * s, baseY - 15 * s],
      [cx - 20 * s, deckY + 10 * s],
      [cx + 20 * s, deckY + 10 * s],
      [cx + 30 * s, baseY - 15 * s],
    ],
    3.4,
    INK,
    true,
    PAPER_LIGHT
  );
  inkLine(g, cx - 104 * s, deckY + 10 * s, cx + 104 * s, deckY + 10 * s, 3.4, 0.7);

  // ---- parabolic mirror behind the burner (dish opening toward +x)
  const mx0 = cx - 92 * s;
  const dishRy = 104 * s;
  const dishRx = 30 * s;
  g.save();
  g.fillStyle = "rgba(234, 224, 198, 0.94)";
  g.strokeStyle = INK;
  g.lineWidth = 4.0;
  g.beginPath();
  g.ellipse(mx0, cy, dishRx, dishRy, 0, Math.PI * 0.5, Math.PI * 1.5);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = "rgba(26, 22, 18, 0.32)";
  g.lineWidth = 1.8;
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(mx0 - dishRx * 0.86, cy + i * 26 * s);
    g.lineTo(mx0 + 1 * s, cy + i * 30 * s);
    g.stroke();
  }
  g.restore();
  // mirror polish flash (the "brighter mirror" of scene three)
  if (bright > 1.05) {
    g.save();
    g.strokeStyle = `rgba(255, 232, 150, ${a3(0.5 * bright)})`;
    g.lineWidth = 5.0;
    g.beginPath();
    g.ellipse(mx0 + 4 * s, cy, dishRx * 0.72, dishRy * 0.86, 0, Math.PI * 0.62, Math.PI * 1.38);
    g.stroke();
    g.restore();
  }

  // ---- oil font, wick and flame
  inkBox(g, cx - 74 * s, cy + 40 * s, 46 * s, 44 * s, PAPER_MID, 3.0, 6);
  inkLine(g, cx - 62 * s, cy + 40 * s, cx - 62 * s, cy + 18 * s, 3.0, 0.4);
  const flameH = (20 + 8 * Math.abs(Math.sin(t * 7.1) * Math.sin(t * 2.9)) + 8 * gate.on) * s;
  g.save();
  g.fillStyle = `rgba(255, 214, 96, ${a3(0.55 + 0.45 * gate.on)})`;
  g.strokeStyle = INK;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(cx - 70 * s, cy + 22 * s);
  g.quadraticCurveTo(cx - 62 * s, cy + 22 * s - flameH * 1.4, cx - 54 * s, cy + 22 * s);
  g.quadraticCurveTo(cx - 62 * s, cy + 30 * s, cx - 70 * s, cy + 22 * s);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  softWash(g, mx0 + 34 * s, cy, 170 * s, "245, 178, 35", 0.22 + 0.4 * lit);

  // ---- the shutter drum: a turning cylinder with three windows
  const drumCx = cx + 46 * s;
  const drumRx = 54 * s;
  const drumTop = cy - 78 * s;
  const drumBot = cy + 78 * s;
  const ang = t * 1.35 * rate;
  g.save();
  g.fillStyle = "rgba(243, 232, 206, 0.96)";
  g.strokeStyle = INK;
  g.lineWidth = 3.8;
  g.beginPath();
  g.moveTo(drumCx - drumRx, drumTop);
  g.lineTo(drumCx - drumRx, drumBot);
  g.ellipse(drumCx, drumBot, drumRx, 16 * s, 0, Math.PI, 0, true);
  g.lineTo(drumCx + drumRx, drumTop);
  g.ellipse(drumCx, drumTop, drumRx, 16 * s, 0, 0, Math.PI, true);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  for (let k = 0; k < 3; k++) {
    const th = ang + (k * Math.PI * 2) / 3;
    const front = Math.cos(th);
    if (front <= 0.04) continue;
    const ax = drumCx + Math.sin(th) * drumRx * 0.9;
    const aw = Math.max(7 * s, 26 * s * front);
    const heat = lit * (0.35 + 0.65 * front);
    g.save();
    g.fillStyle = heat > 0.06 ? `rgba(255, 232, 148, ${a3(0.35 + 0.6 * heat)})` : "rgba(214, 198, 168, 0.9)";
    g.strokeStyle = INK;
    g.lineWidth = 2.6;
    g.beginPath();
    g.roundRect(ax - aw * 0.5, drumTop + 22 * s, aw, (drumBot - drumTop) - 44 * s, 5 * s);
    g.fill();
    g.stroke();
    g.restore();
    if (heat > 0.2) softWash(g, ax, cy, 70 * s, "255, 214, 110", 0.34 * heat);
  }
  inkLine(g, drumCx - drumRx, cy, drumCx + drumRx, cy, 2.0, 0.4, "rgba(26, 22, 18, 0.28)");

  // ---- the light that leaves the drum
  if (lit > 0.02 && prop.beams !== false) {
    const reach = (prop.beam_reach ?? 620) * s;
    const x0 = drumCx + drumRx * 0.6;
    g.save();
    const lg = g.createLinearGradient(x0, cy, x0 + reach, cy);
    lg.addColorStop(0, `rgba(255, 228, 136, ${a3(0.5 * lit)})`);
    lg.addColorStop(1, "rgba(255, 228, 136, 0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(x0, cy - 26 * s);
    g.lineTo(x0 + reach, cy - reach * 0.10);
    g.lineTo(x0 + reach, cy + reach * 0.12);
    g.closePath();
    g.fill();
    g.restore();
  }

  // ---- shading paddle (swung across the mirror in scene five)
  if (shadeAmt > 0.005) {
    const pdX = lerp(cx + 176 * s, mx0 + 26 * s, ease(shadeAmt));
    g.save();
    g.fillStyle = "rgba(214, 190, 148, 0.95)";
    g.strokeStyle = INK;
    g.lineWidth = 3.4;
    g.beginPath();
    g.roundRect(pdX - 15 * s, cy - 96 * s, 30 * s, 192 * s, 8 * s);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(26, 22, 18, 0.5)";
    g.lineWidth = 2.2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(pdX - 9 * s, cy + i * 34 * s);
      g.lineTo(pdX + 9 * s, cy + i * 34 * s);
      g.stroke();
    }
    g.restore();
    inkLine(g, pdX, cy + 96 * s, cx + 150 * s, baseY - 84 * s, 3.0, 0.7);
  }

  // ---- the hand wheel the keepers turn
  const wx = cx + 168 * s;
  const wy = baseY - 76 * s;
  const wr = 48 * s;
  const wheelAng = t * 0.95 * (prop.wheel_rate ?? 1.0) * (rate / Math.max(0.001, spin));
  g.save();
  g.strokeStyle = INK;
  g.lineWidth = 4.2;
  g.beginPath();
  g.arc(wx, wy, wr, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2.8;
  for (let i = 0; i < 6; i++) {
    const a0 = wheelAng + (i * Math.PI) / 3;
    g.beginPath();
    g.moveTo(wx - Math.cos(a0) * wr, wy - Math.sin(a0) * wr);
    g.lineTo(wx + Math.cos(a0) * wr, wy + Math.sin(a0) * wr);
    g.stroke();
  }
  g.fillStyle = PAPER_LIGHT;
  g.beginPath();
  g.arc(wx, wy, 9 * s, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // crank handle
  const hx = wx + Math.cos(wheelAng) * wr;
  const hy = wy + Math.sin(wheelAng) * wr;
  g.lineWidth = 3.6;
  g.beginPath();
  g.moveTo(hx, hy);
  g.lineTo(hx + 16 * s, hy + 9 * s);
  g.stroke();
  g.restore();
  inkLine(g, wx, wy + wr, wx, baseY - 15 * s, 3.0, 0.6);

  if (prop.label) {
    g.save();
    g.font = `bold ${Math.round(15 * s)}px PopB`;
    g.fillStyle = CRIMSON;
    g.textAlign = "center";
    g.fillText(String(prop.label), cx, baseY + 24 * s);
    g.restore();
  }
}

function drawHarborBoat(g, prop, W, floorY, t, s) {
  const lift = (prop.lift ?? 118) * s;
  const bobAmp = prop.bob ?? 3.2;
  let cx = (prop.x ?? 0.5) * W;
  if (prop.move_from_x !== undefined || prop.move_to_x !== undefined) {
    const at = Number(prop.move_at ?? 0);
    const dur = Math.max(0.4, Number(prop.move_dur ?? 6));
    const u = ease(clamp01(((t - at) / dur)));
    cx = lerp((prop.move_from_x ?? prop.x ?? 0.5) * W, (prop.move_to_x ?? prop.x ?? 0.5) * W, u);
  }
  const bob = Math.sin(t * 1.35 + cx * 0.0016) * bobAmp;
  const cy = floorY - lift + bob;
  const hullW = 132 * s;
  const tilt = Math.sin(t * 1.05 + cx * 0.0012) * 0.028;

  g.save();
  g.translate(cx, cy);
  g.rotate(tilt);
  // wake
  g.save();
  g.strokeStyle = 'rgba(26, 22, 18, 0.28)';
  g.lineWidth = 2.0;
  for (let i = 1; i <= 2; i++) {
    g.beginPath();
    g.moveTo(-hullW * 0.5 - 10 * s * i, 16 * s + i * 7 * s);
    g.lineTo(-hullW * 0.5 - 62 * s * i, 16 * s + i * 7 * s);
    g.stroke();
  }
  g.restore();
  // hull
  inkPath(
    g,
    [
      [-hullW * 0.5, -8 * s],
      [hullW * 0.54, -12 * s],
      [hullW * 0.36, 16 * s],
      [-hullW * 0.32, 16 * s],
    ],
    3.4,
    INK,
    true,
    'rgba(150, 112, 62, 0.34)'
  );
  inkLine(g, -hullW * 0.4, 2 * s, hullW * 0.46, 0, 2.0, 0.5, 'rgba(26, 22, 18, 0.4)');
  // mast, furled sail and a gaff
  inkLine(g, -6 * s, -10 * s, -6 * s, -86 * s, 3.2, 0.6);
  inkPath(
    g,
    [
      [-4 * s, -80 * s],
      [46 * s, -58 * s],
      [44 * s, -44 * s],
      [-4 * s, -52 * s],
    ],
    2.6,
    INK_SOFT,
    true,
    'rgba(232, 224, 206, 0.85)'
  );
  inkBox(g, -50 * s, -32 * s, 40 * s, 24 * s, PAPER_LIGHT, 2.8, 3);
  // deck lamp
  const lampOn = prop.lamp !== false;
  inkLine(g, -44 * s, -32 * s, -44 * s, -48 * s, 2.4, 0.4);
  if (lampOn) {
    softWash(g, -44 * s, -52 * s, 92 * s, '255, 214, 110', 0.55);
    g.save();
    g.fillStyle = 'rgba(255, 228, 132, 0.95)';
    g.strokeStyle = INK;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(-44 * s, -52 * s, 8 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  } else {
    inkBox(g, -50 * s, -60 * s, 12 * s, 14 * s, PAPER_MID, 2.2, 2);
  }
  // one keeper aboard, small and calm (no rescue drama, just hands on the rail)
  if (prop.crew) {
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = 3.0 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(22 * s, -12 * s);
    g.lineTo(22 * s, -34 * s);
    g.stroke();
    g.fillStyle = PAPER_LIGHT;
    g.beginPath();
    g.arc(22 * s, -42 * s, 8.4 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
}

function drawOilFlask(g, prop, px, floorY, s) {
  const lift = (prop.lift ?? 0) * s;
  const y = floorY - lift;
  const h = (prop.flask_height ?? 62) * s;
  const w = 34 * s;
  const fill = clamp01(prop.fill ?? 0.55);
  g.save();
  g.translate(px, y);
  // body
  inkPath(
    g,
    [
      [-w * 0.5, 0],
      [-w * 0.5, -h * 0.52],
      [-w * 0.22, -h * 0.72],
      [-w * 0.22, -h],
      [w * 0.22, -h],
      [w * 0.22, -h * 0.72],
      [w * 0.5, -h * 0.52],
      [w * 0.5, 0],
    ],
    3.0,
    INK,
    true,
    'rgba(240, 234, 216, 0.9)'
  );
  // oil level
  const lvl = -h * 0.06 - (h * 0.44) * fill;
  g.save();
  g.beginPath();
  g.rect(-w * 0.5, -h * 0.55, w, h * 0.55);
  g.clip();
  g.fillStyle = 'rgba(198, 140, 52, 0.5)';
  g.fillRect(-w * 0.5, lvl, w, h);
  g.strokeStyle = 'rgba(26, 22, 18, 0.5)';
  g.lineWidth = 2.0;
  g.beginPath();
  g.moveTo(-w * 0.48, lvl);
  g.lineTo(w * 0.48, lvl);
  g.stroke();
  g.restore();
  // cork
  inkBox(g, -w * 0.26, -h - 9 * s, w * 0.52, 10 * s, PAPER_MID, 2.4, 2);
  // the marked reserve line
  if (prop.marked) {
    const my = -h * 0.06 - h * 0.44 * clamp01(prop.mark ?? 0.28);
    inkLine(g, -w * 0.72, my, -w * 0.3, my, 2.6, 0.3, CRIMSON);
    if (prop.mark_label) {
      g.save();
      g.font = `bold ${Math.round(14 * s)}px PopB`;
      g.fillStyle = CRIMSON;
      g.textAlign = 'right';
      g.fillText(String(prop.mark_label), -w * 1.18, my + 5 * s);
      g.restore();
    }
  }
  g.restore();
}

function drawFogBank(g, prop, W, floorY, t) {
  const density = clamp01(prop.density ?? 0.5);
  const cx = (prop.x ?? 0.5) * W;
  const w = (prop.w ?? 1.25) * W;
  const lift = prop.lift ?? 150;
  const h = prop.h ?? 210;
  const cy = floorY - lift;
  g.save();
  // Each puff is a radial wash squashed into an ellipse, so the fog fades out in every
  // direction and never leaves a hard elliptical rim sitting on top of the frame.
  for (let i = 0; i < 5; i++) {
    const drift = Math.sin(t * (0.16 + i * 0.05) + i * 1.3) * (40 + i * 22);
    const pcx = cx - w * 0.5 + drift + w * (0.26 + 0.06 * i);
    const pcy = cy + (i - 2) * (h * 0.3);
    const rx = w * (0.30 + 0.07 * i);
    const ry = Math.max(46, h * (0.24 + 0.09 * ((i % 3) + 1)));
    const peak = density * (0.42 - i * 0.03);
    g.save();
    g.translate(pcx, pcy);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, `rgba(248, 243, 231, ${a3(peak)})`);
    gr.addColorStop(0.55, `rgba(247, 241, 229, ${a3(peak * 0.72)})`);
    gr.addColorStop(1, 'rgba(246, 240, 226, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // two soft ink contour squiggles so the fog still reads as drawn, not as a blur
  g.strokeStyle = `rgba(26, 22, 18, ${a3(density * 0.22)})`;
  g.lineWidth = 2.2;
  for (let k = 0; k < 3; k++) {
    const ky = cy + (k - 1) * 52;
    g.beginPath();
    for (let x = cx - w * 0.4; x <= cx + w * 0.4; x += 24) {
      const yy = ky + Math.sin(x * 0.02 + t * 0.5 + k) * 5;
      if (x === cx - w * 0.4) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.restore();
}

function drawKeeperBench(g, prop, px, floorY, s) {
  const w = (prop.w ?? 300) * s;
  const h = (prop.h ?? 96) * s;
  const topY = floorY - h;
  inkBox(g, px - w * 0.5, topY, w, 16 * s, PAPER_LIGHT, 3.4, 4);
  inkLine(g, px - w * 0.4, topY + 16 * s, px - w * 0.44, floorY, 3.4, 0.5);
  inkLine(g, px + w * 0.4, topY + 16 * s, px + w * 0.44, floorY, 3.4, 0.5);
  inkLine(g, px - w * 0.42, floorY - h * 0.42, px + w * 0.42, floorY - h * 0.42, 2.8, 0.6);
  // a couple of ink tools on the shelf
  inkBox(g, px - w * 0.3, floorY - h * 0.42 - 22 * s, 30 * s, 20 * s, PAPER_MID, 2.4, 3);
  inkLine(g, px + w * 0.1, floorY - h * 0.42 - 4 * s, px + w * 0.3, floorY - h * 0.42 - 16 * s, 2.6, 0.4);
}

function drawRopeCoil(g, prop, px, floorY, s) {
  const cy = floorY - 12 * s;
  const r0 = 34 * s;
  g.save();
  g.strokeStyle = 'rgba(140, 100, 52, 0.9)';
  g.lineWidth = 4.2 * s;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(px, cy - i * 5 * s, r0 - i * 8 * s, (r0 - i * 8 * s) * 0.36, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.strokeStyle = INK_SOFT;
  g.lineWidth = 3.0 * s;
  if (prop.tail) {
    g.beginPath();
    g.moveTo(px + r0 * 0.8, cy - 4 * s);
    g.quadraticCurveTo(px + r0 * 2.2, cy - 40 * s, px + r0 * 4.4, cy - 16 * s);
    g.stroke();
  }
  g.restore();
}

function drawChannelMarker(g, prop, px, floorY, s, t) {
  const lift = (prop.lift ?? 60) * s;
  const y = floorY - lift;
  const half = (prop.w ?? 96) * s;
  for (const side of [-1, 1]) {
    const mx = px + side * half;
    inkLine(g, mx, y, mx, y - 74 * s, 3.4, 0.7);
    const lampOn = prop.lamp !== false && (side === 1 ? Math.sin(t * 1.6) > -0.6 : Math.sin(t * 1.6 + 1.2) > -0.6);
    if (lampOn) {
      softWash(g, mx, y - 80 * s, 62 * s, '255, 214, 110', 0.42);
      g.fillStyle = 'rgba(255, 226, 130, 0.95)';
    } else {
      g.fillStyle = PAPER_MID;
    }
    g.save();
    g.strokeStyle = INK;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(mx, y - 80 * s, 7 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.save();
  g.strokeStyle = 'rgba(140, 100, 52, 0.75)';
  g.lineWidth = 2.6 * s;
  g.beginPath();
  g.moveTo(px - half, y - 52 * s);
  g.quadraticCurveTo(px, y - 20 * s + Math.sin(t * 0.9) * 4, px + half, y - 52 * s);
  g.stroke();
  g.restore();
}

/**
 * Entry point called from `world_props_and_boards.js :: drawWorldProp`.
 * Returns true when the prop was handled here.
 */
function drawBeaconProp(g, prop, W, floorY, t, sceneT = null, sIn = null) {
  const ts = sceneT !== null && sceneT !== undefined ? sceneT : t;
  const s = sIn ?? (prop.scale ?? 1.0);
  const px = (prop.x ?? 0.5) * W;
  const mode = prop.pattern || 'steady';
  const gate = keeperGate(ts, mode, prop.spin ?? 1.0);

  g.save();
  if (prop.show_from_t !== undefined && ts < Number(prop.show_from_t)) {
    g.restore();
    return true;
  }
  if (prop.show_to_t !== undefined && ts > Number(prop.show_to_t)) {
    g.restore();
    return true;
  }

  switch (prop.type) {
    case 'beacon_tower':
      drawBeaconTower(g, prop, px, floorY, s, t, gate);
      break;
    case 'beacon_mechanism':
      drawBeaconMechanism(g, prop, px, floorY, s, t, ts, gate);
      break;
    case 'harbor_boat':
      drawHarborBoat(g, prop, W, floorY, t, s);
      break;
    case 'oil_flask':
      drawOilFlask(g, prop, px, floorY, s);
      break;
    case 'fog_bank':
      drawFogBank(g, prop, W, floorY, t);
      break;
    case 'keeper_bench':
      drawKeeperBench(g, prop, px, floorY, s);
      break;
    case 'rope_coil':
      drawRopeCoil(g, prop, px, floorY, s);
      break;
    case 'channel_marker':
      drawChannelMarker(g, prop, px, floorY, s, t);
      break;
    default:
      g.restore();
      return false;
  }
  g.restore();
  return true;
}

module.exports = {
  INK,
  CRIMSON,
  LAMP,
  PATTERN,
  BEACON_PROPS,
  HARBOR_BACKDROPS,
  keeperGate,
  drawBeaconBackdrop,
  drawBeaconProp,
};
