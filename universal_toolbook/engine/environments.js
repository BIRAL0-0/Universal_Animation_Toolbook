'use strict';

const fs = require('fs');
const path = require('path');
const { clamp, ca, hexToRgb } = require('./character_rig');

const FLOOR_Y = 855;

const FALLBACK_VISUAL_IDENTITY = Object.freeze({
  mode: 'near_black_minimal',
  lock_identity: true,
  sky_top: '#040507',
  sky_mid: '#080a0f',
  sky_bottom: '#0c1017',
  floor_top: '#07090e',
  floor_bottom: '#030407',
  horizon_line: '#94a3b8',
  horizon_alpha: 0.16,
  center_lift_alpha: 0.032,
});

function loadVisualIdentityConfig() {
  try {
    const cfgPath = path.join(__dirname, '..', 'config', 'studio_config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (raw && raw.visual_identity && typeof raw.visual_identity === 'object') {
      return Object.freeze({ ...FALLBACK_VISUAL_IDENTITY, ...raw.visual_identity });
    }
  } catch (_) {
    // Fall back to canonical near-black identity if config cannot be read.
  }
  return FALLBACK_VISUAL_IDENTITY;
}

const DEFAULT_VISUAL_IDENTITY = loadVisualIdentityConfig();

const ENVIRONMENT_THEMES = Object.freeze({
  studio_dark:        { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'focus' },
  minimal_void:       { lightColor: '#e2e8f0', ambient: '#06080c', floorColor: '#05070b', accent: '#94a3b8', mood: 'calm' },
  night_city:         { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'focus' },
  modern_office:      { lightColor: '#e2e8f0', ambient: '#080b10', floorColor: '#07090e', accent: '#94a3b8', mood: 'focus' },
  bedroom_late:       { lightColor: '#e2e8f0', ambient: '#07090e', floorColor: '#06080c', accent: '#94a3b8', mood: 'tension' },
  storm_road:         { lightColor: '#cbd5e1', ambient: '#080a10', floorColor: '#06080d', accent: '#94a3b8', mood: 'tension' },
  lecture_stage:      { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'focus' },
  library_study:      { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'calm' },
  tech_lab:           { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'focus' },
  park_twilight:      { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'calm' },
  crossroads_duality: { lightColor: '#e2e8f0', ambient: '#080a0f', floorColor: '#07090e', accent: '#94a3b8', mood: 'tension' },
  canyon_bridge:      { lightColor: '#cbd5e1', ambient: '#080a10', floorColor: '#06080d', accent: '#94a3b8', mood: 'focus' },
  mind_space:         { lightColor: '#e2e8f0', ambient: '#07090e', floorColor: '#06080c', accent: '#94a3b8', mood: 'calm' },
  sunrise_summit:     { lightColor: '#e2e8f0', ambient: '#090b11', floorColor: '#07090e', accent: '#cbd5e1', mood: 'triumph' },
});

const SUPPORTED_ENVIRONMENTS = Object.freeze(Object.keys(ENVIRONMENT_THEMES));

/**
 * Canonical Near-Black Minimal Stage Renderer.
 * Applies a uniform, restrained near-black vertical gradient, subtle central studio depth lift,
 * and grounded dark floor plane across all scenes so individual scene presets cannot accidentally
 * inject colourful or noisy decorative backgrounds.
 */
function renderNearBlackBackground(g, W = 1920, H = 1080, floorY = FLOOR_Y, cfg = DEFAULT_VISUAL_IDENTITY) {
  const id = { ...DEFAULT_VISUAL_IDENTITY, ...(cfg || {}) };
  g.save();

  // Generous overscan so camera pan/zoom or full-bleed 9:16 portrait vector framing never exposes edges
  const padX = 1200;
  const padTop = 1200;
  const padBot = 1200;

  const skyGrad = g.createLinearGradient(0, -480, 0, floorY);
  skyGrad.addColorStop(0, id.sky_top);
  skyGrad.addColorStop(0.56, id.sky_mid);
  skyGrad.addColorStop(1, id.sky_bottom);
  g.fillStyle = skyGrad;
  g.fillRect(-padX, -padTop, W + padX * 2, floorY + padTop + 4);

  // Subtle neutral studio depth falloff behind central staging area (zero colour tint)
  const liftAlpha = clamp(Number(id.center_lift_alpha ?? 0.032), 0, 0.08);
  if (liftAlpha > 0.002) {
    const cx = W * 0.5;
    const cy = floorY * 0.64;
    const rad = g.createRadialGradient(cx, cy, 40, cx, cy, Math.max(W, H) * 0.56);
    rad.addColorStop(0, `rgba(226, 232, 240, ${ca(liftAlpha)})`);
    rad.addColorStop(0.58, `rgba(203, 213, 225, ${ca(liftAlpha * 0.35)})`);
    rad.addColorStop(1, 'rgba(15, 23, 42, 0.000)');
    g.fillStyle = rad;
    g.fillRect(-padX, -padTop, W + padX * 2, floorY + padTop + 4);
  }

  // Restrained near-black ground plane
  const floorGrad = g.createLinearGradient(0, floorY, 0, H + 540);
  floorGrad.addColorStop(0, id.floor_top);
  floorGrad.addColorStop(1, id.floor_bottom);
  g.fillStyle = floorGrad;
  g.fillRect(-padX, floorY, W + padX * 2, H - floorY + padBot);

  // Crisp, low-contrast ground contact horizon line for unambiguous foot grounding
  const [hr, hg, hb] = hexToRgb(id.horizon_line || '#94a3b8');
  const hAlpha = clamp(Number(id.horizon_alpha ?? 0.16), 0.04, 0.30);
  const lineGrad = g.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, `rgba(${hr},${hg},${hb},${ca(hAlpha * 0.35)})`);
  lineGrad.addColorStop(0.15, `rgba(${hr},${hg},${hb},${ca(hAlpha)})`);
  lineGrad.addColorStop(0.85, `rgba(${hr},${hg},${hb},${ca(hAlpha)})`);
  lineGrad.addColorStop(1, `rgba(${hr},${hg},${hb},${ca(hAlpha * 0.35)})`);
  g.fillStyle = lineGrad;
  g.fillRect(-padX, floorY - 1, W + padX * 2, 2);

  g.restore();
  return {
    lightColor: '#e2e8f0',
    accent: '#94a3b8',
    floorColor: id.floor_top,
    visualIdentity: id.mode,
  };
}

function hash01(i, s = 1) {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawLightCone(g, x, topY, floorY, topW, botW, colorHex, intensity = 0.22) {
  if (intensity <= 0.004) return;
  const [r, gr, b] = hexToRgb(colorHex);
  const grad = g.createLinearGradient(0, topY, 0, floorY);
  grad.addColorStop(0, `rgba(${r},${gr},${b},${ca(intensity)})`);
  grad.addColorStop(0.75, `rgba(${r},${gr},${b},${ca(intensity * 0.35)})`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0.000)`);
  g.save();
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x - topW, topY);
  g.lineTo(x + topW, topY);
  g.lineTo(x + botW, floorY);
  g.lineTo(x - botW, floorY);
  g.closePath();
  g.fill();
  g.restore();
}

function drawSoftGlow(g, cx, cy, radius, colorHex, alpha = 0.25) {
  if (alpha <= 0.004 || radius <= 2) return;
  const [r, gr, b] = hexToRgb(colorHex);
  const rad = g.createRadialGradient(cx, cy, 2, cx, cy, radius);
  rad.addColorStop(0, `rgba(${r},${gr},${b},${ca(alpha)})`);
  rad.addColorStop(0.55, `rgba(${r},${gr},${b},${ca(alpha * 0.32)})`);
  rad.addColorStop(1, `rgba(${r},${gr},${b},0.000)`);
  g.save();
  g.fillStyle = rad;
  g.beginPath();
  g.arc(cx, cy, radius, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawFloorBase(g, W, H, floorY, floorHex, trimHex, trimAlpha = 0.55) {
  const [fr, fg, fb] = hexToRgb(floorHex);
  const grad = g.createLinearGradient(0, floorY, 0, H);
  grad.addColorStop(0, `rgb(${fr},${fg},${fb})`);
  grad.addColorStop(1, '#03050a');
  g.fillStyle = grad;
  g.fillRect(-300, floorY, W + 600, H - floorY + 100);

  const [tr, tg, tb] = hexToRgb(trimHex);
  const lineGrad = g.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, `rgba(${tr},${tg},${tb},0.080)`);
  lineGrad.addColorStop(0.15, `rgba(${tr},${tg},${tb},${ca(trimAlpha)})`);
  lineGrad.addColorStop(0.85, `rgba(${tr},${tg},${tb},${ca(trimAlpha)})`);
  lineGrad.addColorStop(1, `rgba(${tr},${tg},${tb},0.080)`);
  g.fillStyle = lineGrad;
  g.fillRect(-200, floorY - 1.5, W + 400, 3);

  // Perspective floor sheen + depth bands so the lower third never reads as flat black
  g.save();
  g.beginPath();
  g.rect(-300, floorY, W + 600, H - floorY + 100);
  g.clip();
  const depth = Math.max(1, H - floorY);
  for (let i = 1; i <= 5; i++) {
    const yy = floorY + (depth * i) / 5.2;
    g.strokeStyle = `rgba(${tr},${tg},${tb},${ca(0.055 * (1 - i / 7))})`;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-300, yy);
    g.lineTo(W + 300, yy);
    g.stroke();
  }
  const sheen = g.createLinearGradient(0, floorY, 0, floorY + depth * 0.65);
  sheen.addColorStop(0, `rgba(${tr},${tg},${tb},${ca(0.12)})`);
  sheen.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
  g.fillStyle = sheen;
  g.fillRect(-300, floorY, W + 600, depth * 0.65);
  const warm = g.createRadialGradient(W * 0.5, floorY + depth * 0.18, 20, W * 0.5, floorY + depth * 0.18, Math.max(W, H) * 0.45);
  warm.addColorStop(0, `rgba(${tr},${tg},${tb},${ca(0.07)})`);
  warm.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
  g.fillStyle = warm;
  g.fillRect(-300, floorY, W + 600, depth + 100);
  g.restore();
}

function drawSkyGradient(g, W, floorY, stops) {
  const sky = g.createLinearGradient(0, 0, 0, floorY);
  for (const [pos, col] of stops) sky.addColorStop(pos, col);
  g.fillStyle = sky;
  g.fillRect(-300, -100, W + 600, floorY + 102);
}

function renderEnvironment(g, envName, W, H, floorY, t, opts = {}) {
  const key = ENVIRONMENT_THEMES[envName] ? envName : 'studio_dark';
  const theme = ENVIRONMENT_THEMES[key];
  if (DEFAULT_VISUAL_IDENTITY.lock_identity && !opts.override_visual_identity) {
    return renderNearBlackBackground(g, W, H, floorY, opts.visualIdentity);
  }
  const lightColor = opts.lightColor || theme.lightColor;
  const panX = opts.panX || 0;
  const farShift = -panX * 0.18;
  const midShift = -panX * 0.45;
  const nearShift = -panX * 0.85;

  g.save();

  if (key === 'night_city') {
    drawSkyGradient(g, W, floorY, [
      [0, '#040814'],
      [0.55, '#09152e'],
      [1, '#12264c'],
    ]);
    // Crisp stars
    g.save();
    g.translate(farShift, 0);
    for (let i = 0; i < 45; i++) {
      const sx = hash01(i, 1) * (W + 400) - 200;
      const sy = hash01(i, 2) * (floorY * 0.52);
      const tw = 0.45 + 0.45 * Math.sin(t * 1.8 + i * 2.1);
      g.fillStyle = `rgba(226,240,255,${ca(tw * 0.75)})`;
      g.beginPath();
      g.arc(sx, sy, 1.1 + hash01(i, 3) * 1.1, 0, Math.PI * 2);
      g.fill();
    }
    // Far skyline
    g.fillStyle = '#081226';
    for (let i = -2; i < 16; i++) {
      const bx = i * 145;
      const bw = 110 + hash01(i + 20, 4) * 55;
      const bh = 180 + hash01(i + 20, 5) * 240;
      g.fillRect(bx, floorY - bh, bw, bh);
    }
    g.restore();

    // Mid skyline with sharp glowing cyan & violet windows
    g.save();
    g.translate(midShift, 0);
    for (let i = -2; i < 13; i++) {
      const bx = i * 185 + 20;
      const bw = 128 + Math.round(hash01(i + 5, 6) * 44);
      const bh = 150 + Math.round(hash01(i + 5, 7) * 230);
      const by = floorY - bh;
      g.fillStyle = '#0d1b35';
      g.strokeStyle = 'rgba(56,189,248,0.16)';
      g.lineWidth = 1.5;
      g.fillRect(bx, by, bw, bh);
      g.strokeRect(bx, by, bw, bh);

      const cols = Math.floor((bw - 24) / 22);
      const rows = Math.floor((bh - 30) / 26);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = hash01(i * 100 + r * 13 + c, 9);
          if (lit < 0.66) continue;
          g.fillStyle = lit > 0.88 ? 'rgba(167,139,250,0.55)' : 'rgba(56,189,248,0.48)';
          g.fillRect(bx + 14 + c * 22, by + 16 + r * 26, 12, 14);
        }
      }
    }
    g.restore();

    drawFloorBase(g, W, H, floorY, theme.floorColor, lightColor, 0.55);

    // Streetlamps with sapphire-cyan light cones
    g.save();
    g.translate(nearShift, 0);
    for (const lx of [280, 960, 1640]) {
      g.strokeStyle = '#334155';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(lx, floorY);
      g.lineTo(lx, floorY - 360);
      g.lineTo(lx + 38, floorY - 360);
      g.stroke();
      drawLightCone(g, lx + 38, floorY - 358, floorY, 16, 210, lightColor, 0.20);
      drawSoftGlow(g, lx + 38, floorY - 358, 46, lightColor, 0.55);
      g.fillStyle = '#e0f2fe';
      g.beginPath();
      g.arc(lx + 38, floorY - 356, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  } else if (key === 'modern_office') {
    drawSkyGradient(g, W, floorY, [
      [0, '#09111e'],
      [1, '#122036'],
    ]);
    // Subtle architectural wall panels
    g.save();
    g.translate(midShift * 0.4, 0);
    g.strokeStyle = 'rgba(148,163,184,0.09)';
    g.lineWidth = 2;
    for (let x = 0; x <= W; x += 240) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, floorY);
      g.stroke();
    }

    // Large panoramic office window showing night skyline
    const wx = 190, wy = 135, ww = 680, wh = 370;
    const winSky = g.createLinearGradient(0, wy, 0, wy + wh);
    winSky.addColorStop(0, '#061229');
    winSky.addColorStop(1, '#13315c');
    g.fillStyle = winSky;
    g.fillRect(wx, wy, ww, wh);
    // Distant towers inside window
    g.fillStyle = '#0a1c3a';
    for (let i = 0; i < 8; i++) {
      const bh = 90 + hash01(i, 12) * 180;
      g.fillRect(wx + 20 + i * 82, wy + wh - bh, 64, bh);
    }
    // Window mullions
    g.strokeStyle = '#1e293b';
    g.lineWidth = 10;
    g.strokeRect(wx, wy, ww, wh);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(wx + ww / 3, wy);
    g.lineTo(wx + ww / 3, wy + wh);
    g.moveTo(wx + (2 * ww) / 3, wy);
    g.lineTo(wx + (2 * ww) / 3, wy + wh);
    g.stroke();

    // Recessed ceiling fixtures
    for (const cx of [460, 1020, 1520]) {
      g.fillStyle = '#334155';
      g.fillRect(cx - 52, 0, 104, 14);
      g.fillStyle = '#cffafe';
      g.fillRect(cx - 42, 12, 84, 5);
      drawLightCone(g, cx, 16, floorY, 44, 260, lightColor, 0.13);
    }
    g.restore();

    drawFloorBase(g, W, H, floorY, theme.floorColor, lightColor, 0.45);
  } else if (key === 'bedroom_late') {
    drawSkyGradient(g, W, floorY, [
      [0, '#070918'],
      [1, '#121636'],
    ]);
    g.save();
    g.translate(midShift * 0.35, 0);
    // Moonlit window with blinds on left wall
    const wx = 180, wy = 150, ww = 310, wh = 340;
    g.fillStyle = '#18224c';
    g.fillRect(wx, wy, ww, wh);
    drawSoftGlow(g, wx + ww * 0.7, wy + 80, 95, '#c7d2fe', 0.45);
    g.fillStyle = '#e0e7ff';
    g.beginPath();
    g.arc(wx + ww * 0.7, wy + 80, 26, 0, Math.PI * 2);
    g.fill();
    // Blinds slats
    g.fillStyle = '#0c1026';
    for (let y = wy + 14; y < wy + wh; y += 24) {
      g.fillRect(wx, y, ww, 8);
    }
    g.strokeStyle = '#1e2448';
    g.lineWidth = 10;
    g.strokeRect(wx, wy, ww, wh);

    // Diagonal moonlight cast
    drawLightCone(g, wx + ww * 0.5, wy + wh, floorY, 150, 320, '#818cf8', 0.11);

    // Bookshelf silhouette on right
    const sx = 1480, sy = floorY - 410, sw = 210, sh = 410;
    g.fillStyle = '#0b0e24';
    g.strokeStyle = 'rgba(129,140,248,0.22)';
    g.lineWidth = 2;
    g.fillRect(sx, sy, sw, sh);
    g.strokeRect(sx, sy, sw, sh);
    for (let r = 1; r <= 4; r++) {
      const shelfY = sy + r * 80;
      g.fillStyle = '#161b3d';
      g.fillRect(sx + 6, shelfY, sw - 12, 8);
      for (let b = 0; b < 7; b++) {
        const bCol = ['#38bdf8', '#818cf8', '#fb7185', '#34d399'][b % 4];
        g.fillStyle = bCol;
        g.globalAlpha = 0.35;
        g.fillRect(sx + 16 + b * 24, shelfY - 44 - (b % 3) * 8, 16, 44 + (b % 3) * 8);
        g.globalAlpha = 1;
      }
    }
    g.restore();
    drawFloorBase(g, W, H, floorY, theme.floorColor, lightColor, 0.42);
  } else if (key === 'storm_road') {
    drawSkyGradient(g, W, floorY, [
      [0, '#070b12'],
      [0.6, '#141e2e'],
      [1, '#233146'],
    ]);
    // Distant jagged mountains
    g.save();
    g.translate(farShift, 0);
    g.fillStyle = '#0e1624';
    g.beginPath();
    g.moveTo(-200, floorY);
    for (let x = -200; x <= W + 300; x += 180) {
      g.lineTo(x + 90, floorY - 140 - hash01(x, 3) * 170);
      g.lineTo(x + 180, floorY - 60 - hash01(x + 1, 4) * 70);
    }
    g.lineTo(W + 300, floorY);
    g.closePath();
    g.fill();
    g.restore();

    // Utility poles + warning light
    g.save();
    g.translate(midShift, 0);
    for (const px of [340, 1080, 1780]) {
      g.strokeStyle = '#1e293b';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(px, floorY);
      g.lineTo(px, floorY - 390);
      g.moveTo(px - 36, floorY - 350);
      g.lineTo(px + 36, floorY - 350);
      g.stroke();
    }
    drawLightCone(g, 1080, floorY - 350, floorY, 18, 240, lightColor, 0.18);
    drawSoftGlow(g, 1080, floorY - 350, 56, lightColor, 0.55);
    g.restore();

    drawFloorBase(g, W, H, floorY, theme.floorColor, '#64748b', 0.48);

    // Crisp rain streaks
    g.save();
    g.strokeStyle = 'rgba(186,210,235,0.28)';
    g.lineWidth = 1.6;
    for (let i = 0; i < 95; i++) {
      const sp = 1150 + 350 * hash01(i, 7);
      const ry = ((hash01(i, 8) * floorY + t * sp) % floorY);
      const rx = hash01(i, 9) * (W + 200) - 0.18 * ry;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx - 6, ry + 26);
      g.stroke();
    }
    g.restore();
  } else if (key === 'lecture_stage') {
    drawSkyGradient(g, W, floorY, [
      [0, '#070614'],
      [0.65, '#120f2b'],
      [1, '#1d1740'],
    ]);
    // Overhead theatrical lighting rig
    g.strokeStyle = '#262046';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(80, 58);
    g.lineTo(W - 80, 58);
    g.stroke();
    for (const [lx, col] of [[380, '#a78bfa'], [960, '#38bdf8'], [1540, '#a78bfa']]) {
      drawLightCone(g, lx, 60, floorY, 26, 280, col, 0.15);
      g.fillStyle = '#e9d5ff';
      g.fillRect(lx - 12, 54, 24, 8);
    }
    drawFloorBase(g, W, H, floorY, theme.floorColor, '#a78bfa', 0.55);
  } else if (key === 'library_study') {
    drawSkyGradient(g, W, floorY, [
      [0, '#061014'],
      [1, '#0e2429'],
    ]);
    g.save();
    g.translate(midShift * 0.35, 0);
    // Repeating background bookcases
    for (const bx of [110, 410, 1360, 1640]) {
      g.fillStyle = '#09181c';
      g.strokeStyle = 'rgba(52,211,153,0.16)';
      g.lineWidth = 2;
      g.fillRect(bx, 130, 220, floorY - 130);
      g.strokeRect(bx, 130, 220, floorY - 130);
      for (let sy = 210; sy < floorY; sy += 92) {
        g.fillStyle = '#112a30';
        g.fillRect(bx + 6, sy, 208, 8);
      }
    }
    // Center tall arched window
    const cx = 960, wy = 120, ww = 300, wh = 420;
    g.fillStyle = '#12353d';
    g.beginPath();
    g.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0);
    g.lineTo(cx + ww / 2, wy + wh);
    g.lineTo(cx - ww / 2, wy + wh);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1f4b55';
    g.lineWidth = 8;
    g.stroke();
    drawLightCone(g, cx, wy + 120, floorY, 130, 360, lightColor, 0.14);
    g.restore();
    drawFloorBase(g, W, H, floorY, theme.floorColor, lightColor, 0.48);
  } else if (key === 'tech_lab') {
    drawSkyGradient(g, W, floorY, [
      [0, '#030b12'],
      [1, '#081f30'],
    ]);
    // Crisp engineering coordinate grid
    g.save();
    g.translate(midShift * 0.25, 0);
    g.strokeStyle = 'rgba(34,211,238,0.075)';
    g.lineWidth = 1.2;
    for (let x = -100; x <= W + 200; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, floorY);
      g.stroke();
    }
    for (let y = 0; y <= floorY; y += 64) {
      g.beginPath();
      g.moveTo(-100, y);
      g.lineTo(W + 200, y);
      g.stroke();
    }
    drawLightCone(g, 480, 0, floorY, 60, 280, '#22d3ee', 0.14);
    drawLightCone(g, 1440, 0, floorY, 60, 280, '#34d399', 0.12);
    g.restore();
    drawFloorBase(g, W, H, floorY, theme.floorColor, '#22d3ee', 0.58);
  } else if (key === 'park_twilight') {
    drawSkyGradient(g, W, floorY, [
      [0, '#071224'],
      [0.58, '#0f2d42'],
      [1, '#1a4a5a'],
    ]);
    // Soft rolling twilight hills
    g.save();
    g.translate(farShift, 0);
    g.fillStyle = '#0c2333';
    g.beginPath();
    g.moveTo(-200, floorY);
    g.quadraticCurveTo(450, floorY - 190, 1050, floorY - 95);
    g.quadraticCurveTo(1550, floorY - 210, W + 250, floorY - 70);
    g.lineTo(W + 250, floorY);
    g.closePath();
    g.fill();
    g.restore();

    // Stylized rounded trees & park lamps
    g.save();
    g.translate(midShift, 0);
    for (const [tx, tr] of [[210, 95], [640, 78], [1380, 105], [1740, 82]]) {
      g.fillStyle = '#0a1c28';
      g.fillRect(tx - 8, floorY - tr * 1.6, 16, tr * 1.6);
      g.fillStyle = '#0f2f3c';
      g.strokeStyle = 'rgba(45,212,191,0.25)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(tx, floorY - tr * 1.75, tr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    for (const lx of [430, 1160]) {
      g.strokeStyle = '#1e3a4a';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(lx, floorY);
      g.lineTo(lx, floorY - 290);
      g.stroke();
      drawSoftGlow(g, lx, floorY - 295, 95, '#2dd4bf', 0.35);
      g.fillStyle = '#ccfbf1';
      g.beginPath();
      g.arc(lx, floorY - 295, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    drawFloorBase(g, W, H, floorY, theme.floorColor, '#2dd4bf', 0.50);
  } else if (key === 'crossroads_duality') {
    // Left half warm crimson-slate tension, Right half cool sky-cyan clarity (ONE continuous world!)
    const horizGrad = g.createLinearGradient(0, 0, W, 0);
    horizGrad.addColorStop(0, '#240b15');
    horizGrad.addColorStop(0.48, '#0c1020');
    horizGrad.addColorStop(0.52, '#0b1526');
    horizGrad.addColorStop(1, '#0c2942');
    g.fillStyle = horizGrad;
    g.fillRect(0, 0, W, floorY);

    drawLightCone(g, W * 0.25, 0, floorY, 80, 360, '#fb7185', 0.16);
    drawLightCone(g, W * 0.75, 0, floorY, 80, 360, '#38bdf8', 0.18);
    drawFloorBase(g, W, H, floorY, theme.floorColor, '#94a3b8', 0.48);
  } else if (key === 'canyon_bridge') {
    drawSkyGradient(g, W, floorY, [
      [0, '#050b18'],
      [0.6, '#0d1f3d'],
      [1, '#173666'],
    ]);
    drawFloorBase(g, W, H, floorY, '#050c1a', '#60a5fa', 0.55);
    // Central misty chasm cut into floor, with rock lips and depth falloff
    const gapL = W * 0.355, gapR = W * 0.645;
    const jag = (edgeX, dir, seed) => {
      // irregular rock lip so the chasm never reads as a flat rectangle
      g.beginPath();
      g.moveTo(edgeX, floorY + 2);
      let y = floorY + 2;
      let s2 = seed;
      const step = (H - floorY) / 7;
      for (let i = 0; i < 7; i += 1) {
        s2 = (s2 * 1103515245 + 12345) & 0x7fffffff;
        const jitter = (s2 % 100) / 100;
        y += step;
        g.lineTo(edgeX + dir * (6 + jitter * 26), y);
      }
      g.lineTo(edgeX, H + 10);
      g.closePath();
      g.fillStyle = '#02060f';
      g.fill();
    };
    // Rim shadow at the far lip, deep gloom through the middle, faint mist near camera
    const deepGrad = g.createLinearGradient(0, floorY, 0, H);
    deepGrad.addColorStop(0, '#01040b');
    deepGrad.addColorStop(0.30, '#020711');
    deepGrad.addColorStop(0.72, '#061530');
    deepGrad.addColorStop(1, '#0a1d3f');
    g.fillStyle = deepGrad;
    g.fillRect(gapL, floorY - 2, gapR - gapL, H - floorY + 10);
    // distant river thread deep in the gorge
    g.strokeStyle = 'rgba(96,165,250,0.28)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(gapL + 40, H - 16);
    g.bezierCurveTo(W * 0.46, H - 40, W * 0.54, H - 30, gapR - 40, H - 46);
    g.stroke();
    jag(gapL, -1, 7919);
    jag(gapR, 1, 104729);
    // rim light along both lips
    g.strokeStyle = 'rgba(96,165,250,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(gapL - 2, floorY + 1);
    g.lineTo(gapR + 2, floorY + 1);
    g.stroke();
    // Bridge deck across chasm
    g.fillStyle = '#334155';
    g.strokeStyle = '#60a5fa';
    g.lineWidth = 2.5;
    g.fillRect(gapL - 16, floorY - 6, gapR - gapL + 32, 10);
    g.strokeRect(gapL - 16, floorY - 6, gapR - gapL + 32, 10);
    g.fillStyle = 'rgba(96,165,250,0.16)';
    g.fillRect(gapL - 16, floorY + 2, gapR - gapL + 32, 26);
    // mist pooling just under the far lip
    const mist = g.createLinearGradient(0, floorY + 4, 0, floorY + 70);
    mist.addColorStop(0, 'rgba(148,197,255,0.20)');
    mist.addColorStop(1, 'rgba(148,197,255,0)');
    g.fillStyle = mist;
    g.fillRect(gapL, floorY + 4, gapR - gapL, 70);
    // suspension pylons + catenary cables behind the deck
    const towerH = 300;
    const cableSpan = (gapR - gapL) + 150;
    g.strokeStyle = 'rgba(148,163,184,0.55)';
    g.lineWidth = 3;
    [gapL - 8, gapR + 8].forEach((tx) => {
      g.beginPath();
      g.moveTo(tx, floorY + 4);
      g.lineTo(tx, floorY - towerH);
      g.stroke();
      g.beginPath();
      g.moveTo(tx - 12, floorY - towerH + 4);
      g.lineTo(tx, floorY - towerH - 16);
      g.lineTo(tx + 12, floorY - towerH + 4);
      g.stroke();
    });
    g.strokeStyle = 'rgba(148,163,184,0.30)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(gapL - 8, floorY - towerH);
    g.quadraticCurveTo(W * 0.5, floorY - towerH + 120, gapR + 8, floorY - towerH);
    g.stroke();
    for (let cx = gapL; cx <= gapR; cx += cableSpan / 12) {
      const t = (cx - (gapL - 8)) / ((gapR + 8) - (gapL - 8));
      const drop = (floorY - towerH) + 120 * (4 * t * (1 - t)) * 0.9;
      g.beginPath();
      g.moveTo(cx, drop + 12);
      g.lineTo(cx, floorY - 4);
      g.stroke();
    }
    drawLightCone(g, W * 0.5, 0, floorY, 90, 380, '#60a5fa', 0.15);
  } else if (key === 'sunrise_summit') {
    drawSkyGradient(g, W, floorY, [
      [0, '#0d152e'],
      [0.45, '#2b244d'],
      [0.78, '#9d3f5d'],
      [1, '#f59e0b'],
    ]);
    drawSoftGlow(g, W * 0.72, floorY - 40, 360, '#fb923c', 0.42);
    // Soft cloud sea below horizon
    g.save();
    g.translate(farShift, 0);
    g.fillStyle = 'rgba(255,218,185,0.12)';
    for (let x = -100; x < W + 200; x += 170) {
      g.beginPath();
      g.arc(x, floorY - 12, 95, Math.PI, 0);
      g.fill();
    }
    g.restore();
    drawFloorBase(g, W, H, floorY, theme.floorColor, '#fb923c', 0.58);
  } else {
    // mind_space default
    drawSkyGradient(g, W, floorY, [
      [0, '#060814'],
      [1, '#101730'],
    ]);
    for (let x = 220; x < W; x += 360) {
      g.fillStyle = 'rgba(148,163,184,0.05)';
      g.fillRect(x - 18, 80, 36, floorY - 80);
    }
    drawLightCone(g, W * 0.35, 0, floorY, 70, 310, lightColor, 0.15);
    drawLightCone(g, W * 0.68, 0, floorY, 70, 310, lightColor, 0.15);
    drawFloorBase(g, W, H, floorY, theme.floorColor, lightColor, 0.50);
  }

  g.restore();
  return { lightColor, accent: opts.accent || theme.accent, floorColor: theme.floorColor };
}

/**
 * Universal Parametric Setting Composer: allows the AI/prompt to construct any custom setting
 * dynamically from the script's world requirements without relying on fixed preset rooms.
 */
function renderCustomSetting(g, setting, W, H, floorY, t, panX = 0, accentOverride = null) {
  const skyColors = Array.isArray(setting.sky) && setting.sky.length >= 2
    ? setting.sky
    : ['#071020', '#122645'];
  const stops = skyColors.map((col, idx) => [idx / (skyColors.length - 1), col]);
  const lightColor = accentOverride || setting.light_color || '#38bdf8';
  const floorColor = setting.floor_color || setting.floor || '#08111e';
  const backdrop = setting.backdrop || 'pillars';
  const weather = setting.weather || (setting.rain ? 'rain' : (setting.stars ? 'stars' : (setting.particles ? 'particles' : 'clear')));
  const lighting = setting.lighting || 'skylights';

  if (backdrop === 'pure_black') {
    g.save();
    g.fillStyle = '#000000';
    g.fillRect(-300, -100, W + 600, H + 200);
    g.restore();
    return { lightColor: '#ffffff', accent: '#ffffff', floorColor: '#000000' };
  }

  if (DEFAULT_VISUAL_IDENTITY.lock_identity && !setting.override_visual_identity) {
    return renderNearBlackBackground(g, W, H, floorY, setting.visual_identity);
  }

  const farShift = -panX * 0.20;
  const midShift = -panX * 0.48;

  g.save();
  drawSkyGradient(g, W, floorY, stops);

  // Weather / atmosphere back layer
  if (weather === 'stars' || weather === 'particles' || weather === 'embers') {
    g.save();
    g.translate(farShift, 0);
    const [lr, lg, lb] = hexToRgb(weather === 'embers' ? '#fb923c' : lightColor);
    for (let i = 0; i < 42; i++) {
      const px = hash01(i, 31) * (W + 300) - 150;
      const py = weather === 'stars'
        ? hash01(i, 32) * (floorY * 0.55)
        : ((hash01(i, 32) * floorY - t * (weather === 'embers' ? 28 : 14)) % floorY + floorY) % floorY;
      const alpha = 0.28 + 0.35 * Math.sin(t * 2.0 + i);
      g.fillStyle = weather === 'stars'
        ? `rgba(235,245,255,${ca(alpha)})`
        : `rgba(${lr},${lg},${lb},${ca(alpha * 0.8)})`;
      g.beginPath();
      g.arc(px, py, 1.4 + hash01(i, 33) * 1.6, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Celestial sun/moon orb BEHIND mid-ground skyline/landscape
  if (lighting === 'sun_orb' || lighting === 'moon_orb') {
    const ox = W * 0.72 + farShift;
    const oy = lighting === 'sun_orb' ? floorY - 220 : 185;
    drawSoftGlow(g, ox, oy, lighting === 'sun_orb' ? 360 : 190, lightColor, 0.38);
    g.fillStyle = lighting === 'sun_orb' ? lightColor : '#f1f5f9';
    g.beginPath();
    g.arc(ox, oy, lighting === 'sun_orb' ? 48 : 32, 0, Math.PI * 2);
    g.fill();
  }

  // Composable mid-ground backdrop
  g.save();
  g.translate(midShift, 0);
  const [r, gr, b] = hexToRgb(lightColor);
  if (backdrop === 'mountains' || backdrop === 'desert') {
    g.fillStyle = backdrop === 'desert' ? 'rgba(120,53,15,0.38)' : 'rgba(15,23,42,0.72)';
    g.beginPath();
    g.moveTo(-250, floorY);
    for (let x = -250; x <= W + 300; x += 220) {
      const peak = 110 + hash01(x, 41) * (backdrop === 'desert' ? 95 : 220);
      g.lineTo(x + 110, floorY - peak);
      g.lineTo(x + 220, floorY - 35);
    }
    g.lineTo(W + 300, floorY);
    g.closePath();
    g.fill();
  } else if (backdrop === 'hills' || backdrop === 'ocean') {
    g.fillStyle = `rgba(${r},${gr},${b},0.10)`;
    g.beginPath();
    g.moveTo(-250, floorY);
    for (let x = -250; x <= W + 250; x += 40) {
      const waveY = backdrop === 'ocean'
        ? 38 + Math.sin(x * 0.012 + t * 1.6) * 12
        : 85 + Math.sin(x * 0.004) * 55;
      g.lineTo(x, floorY - waveY);
    }
    g.lineTo(W + 250, floorY);
    g.closePath();
    g.fill();
  } else if (backdrop === 'forest') {
    for (let i = -1; i < 14; i++) {
      const tx = i * 155 + 40;
      const tr = 65 + hash01(i, 51) * 42;
      g.fillStyle = 'rgba(8,22,28,0.85)';
      g.fillRect(tx - 7, floorY - tr * 1.7, 14, tr * 1.7);
      g.fillStyle = `rgba(${Math.round(r * 0.22)},${Math.round(gr * 0.32)},${Math.round(b * 0.30)},0.88)`;
      g.strokeStyle = `rgba(${r},${gr},${b},0.22)`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(tx, floorY - tr * 1.85, tr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else if (backdrop === 'city') {
    const winRgb = setting.window_color ? hexToRgb(setting.window_color) : [r, gr, b];
    const winBoost = Number(setting.window_warmth ?? 1.0);
    for (let i = -2; i < 13; i++) {
      const bx = i * 175 + 20;
      const bw = 122 + Math.round(hash01(i, 61) * 40);
      const bh = 160 + Math.round(hash01(i, 62) * 230);
      g.fillStyle = 'rgba(10,18,34,0.90)';
      g.strokeStyle = `rgba(${r},${gr},${b},0.22)`;
      g.lineWidth = 1.6;
      g.fillRect(bx, floorY - bh, bw, bh);
      g.strokeRect(bx, floorY - bh, bw, bh);
      for (let wy = floorY - bh + 22; wy < floorY - 26; wy += 28) {
        for (let wx = bx + 16; wx < bx + bw - 20; wx += 26) {
          if (hash01(wx, wy) > 0.42) {
            const wa = (0.14 + hash01(wy, wx) * 0.22) * winBoost;
            g.fillStyle = `rgba(${winRgb[0]},${winRgb[1]},${winRgb[2]},${ca(wa)})`;
            g.fillRect(wx, wy, 12, 14);
          }
        }
      }
    }
  } else if (backdrop === 'grid') {
    g.strokeStyle = `rgba(${r},${gr},${b},0.085)`;
    g.lineWidth = 1.2;
    for (let x = -120; x <= W + 180; x += 64) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, floorY); g.stroke();
    }
    for (let y = 0; y <= floorY; y += 64) {
      g.beginPath(); g.moveTo(-120, y); g.lineTo(W + 180, y); g.stroke();
    }
  } else if (backdrop === 'arches' || backdrop === 'pillars') {
    for (let x = 180; x < W; x += 340) {
      g.fillStyle = 'rgba(148,163,184,0.06)';
      g.strokeStyle = `rgba(${r},${gr},${b},0.16)`;
      g.lineWidth = 2;
      g.fillRect(x - 24, 90, 48, floorY - 90);
      g.strokeRect(x - 24, 90, 48, floorY - 90);
      if (backdrop === 'arches' && x + 340 < W) {
        g.beginPath();
        g.arc(x + 170, 190, 146, Math.PI, 0);
        g.stroke();
      }
    }
  } else if (backdrop === 'shelves') {
    for (const sx of [120, 420, 1340, 1640]) {
      g.fillStyle = 'rgba(8,14,26,0.55)';
      g.strokeStyle = `rgba(${r},${gr},${b},0.22)`;
      g.lineWidth = 2;
      g.fillRect(sx, 130, 180, floorY - 130);
      g.strokeRect(sx, 130, 180, floorY - 130);
      for (let sy = 220; sy < floorY; sy += 95) {
        g.fillStyle = `rgba(${r},${gr},${b},0.16)`;
        g.fillRect(sx + 4, sy, 172, 6);
        for (let bk = sx + 14; bk < sx + 160; bk += 18) {
          const bh2 = 34 + Math.round(hash01(bk, sy) * 32);
          g.fillStyle = `rgba(${r},${gr},${b},${ca(0.10 + hash01(sy, bk) * 0.14)})`;
          g.fillRect(bk, sy - bh2, 12, bh2);
        }
      }
    }
  } else if (backdrop === 'windows') {
    for (const wx of [180, 1140]) {
      const ww = 580, wh = 360, wy = 125;
      g.fillStyle = 'rgba(5,11,24,0.78)';
      g.fillRect(wx, wy, ww, wh);
      // Distant exterior skyline silhouettes inside window
      g.save();
      g.beginPath();
      g.rect(wx + 4, wy + 4, ww - 8, wh - 8);
      g.clip();
      for (let sb = 0; sb < 7; sb++) {
        const sbx = wx + sb * 92 + 8;
        const sbh = 75 + Math.round(hash01(sb, wx) * 145);
        g.fillStyle = `rgba(${r},${gr},${b},0.09)`;
        g.fillRect(sbx, wy + wh - sbh, 74, sbh);
      }
      // Exterior rain or snow visible THROUGH the window glass
      if (weather === 'rain') {
        g.strokeStyle = 'rgba(186,230,253,0.30)';
        g.lineWidth = 1.6;
        for (let ri = 0; ri < 24; ri++) {
          const rx = wx + ((hash01(ri, wx + 7) * ww - t * 90) % ww + ww) % ww;
          const ry = wy + ((hash01(ri, wx + 13) * wh + t * 420) % wh);
          g.beginPath();
          g.moveTo(rx, ry);
          g.lineTo(rx - 6, ry + 22);
          g.stroke();
        }
      } else if (weather === 'snow') {
        g.fillStyle = 'rgba(241,245,249,0.55)';
        for (let si = 0; si < 26; si++) {
          const sx2 = wx + ((hash01(si, wx + 19) * ww + Math.sin(t + si) * 18) % ww + ww) % ww;
          const sy2 = wy + ((hash01(si, wx + 29) * wh + t * 48) % wh);
          g.beginPath();
          g.arc(sx2, sy2, 2.0 + hash01(si, 41) * 1.4, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Subtle diagonal glass reflection
      g.fillStyle = 'rgba(255,255,255,0.032)';
      g.beginPath();
      g.moveTo(wx + 60, wy);
      g.lineTo(wx + 170, wy);
      g.lineTo(wx + 40, wy + wh);
      g.lineTo(wx - 70, wy + wh);
      g.closePath();
      g.fill();
      g.restore();
      // Architectural window frame & mullions
      g.strokeStyle = `rgba(${r},${gr},${b},0.30)`;
      g.lineWidth = 5;
      g.strokeRect(wx, wy, ww, wh);
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(wx + ww / 3, wy); g.lineTo(wx + ww / 3, wy + wh);
      g.moveTo(wx + (ww * 2) / 3, wy); g.lineTo(wx + (ww * 2) / 3, wy + wh);
      g.moveTo(wx, wy + wh * 0.62); g.lineTo(wx + ww, wy + wh * 0.62);
      g.stroke();
      // Window sill
      g.fillStyle = `rgba(${r},${gr},${b},0.22)`;
      g.fillRect(wx - 10, wy + wh, ww + 20, 8);
    }
  } else if (backdrop === 'horizon') {
    // Radiant golden horizon orb + distant mountain ridge + two converging paths (Scene 9 finale!)
    const sunX = W * 0.5, sunY = floorY - 8;
    drawSoftGlow(g, sunX, sunY, 390, '#fbbf24', 0.56);
    drawSoftGlow(g, sunX, sunY, 175, '#fef08a', 0.72);
    g.fillStyle = '#fef9c3';
    g.beginPath();
    g.arc(sunX, sunY, 72, Math.PI, 0, false);
    g.fill();
    // Distant low hills silhouette
    g.fillStyle = 'rgba(15, 23, 42, 0.85)';
    g.beginPath();
    g.moveTo(-250, floorY);
    g.quadraticCurveTo(W * 0.18, floorY - 65, W * 0.42, floorY - 14);
    g.lineTo(W * 0.58, floorY - 14);
    g.quadraticCurveTo(W * 0.82, floorY - 68, W + 250, floorY);
    g.closePath();
    g.fill();
  }
  g.restore();

  // Rain or snow foreground streaks (outdoor scenes only; indoor window scenes clip rain inside window panes)
  if ((weather === 'rain' || weather === 'snow') && backdrop !== 'windows' && backdrop !== 'shelves') {
    const rainInt = Number(setting.rain_intensity ?? 1.0);
    const dropCount = Math.round(58 * clamp(rainInt, 0.4, 2.0));
    g.strokeStyle = weather === 'rain'
      ? `rgba(186,230,253,${ca(0.24 * Math.min(1.4, rainInt))})`
      : 'rgba(241,245,249,0.45)';
    g.lineWidth = weather === 'rain' ? 1.7 : 3.0;
    const windDx = weather === 'rain' ? -(8 + 7 * (rainInt - 1.0)) : -2;
    const speedY = weather === 'rain' ? 540 * Math.max(0.8, rainInt) : 95;
    for (let i = 0; i < dropCount; i++) {
      const rx = ((hash01(i, 71) * (W + 300) - 150 - t * (weather === 'rain' ? 140 * rainInt : 35)) % (W + 300) + (W + 300)) % (W + 300) - 150;
      const ry = ((hash01(i, 72) * floorY + t * speedY) % floorY);
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + windDx, ry + (weather === 'rain' ? 28 * Math.min(1.35, rainInt) : 4));
      g.stroke();
    }
  }

  // Composable scene lighting
  if (lighting === 'skylights' || lighting === 'spotlights') {
    const positions = lighting === 'spotlights' ? [380, 960, 1540] : [480, 1440];
    for (const lx of positions) {
      drawLightCone(g, lx, 0, floorY, 45, 290, lightColor, 0.14);
    }
  } else if (lighting === 'streetlamps') {
    const lampXs = Array.isArray(setting.lamp_xs) ? setting.lamp_xs.map((f) => f * W) : [320, 1600];
    const lampCol = setting.lamp_color || lightColor;
    for (const lx of lampXs) {
      g.strokeStyle = '#334155';
      g.lineWidth = 6;
      g.beginPath(); g.moveTo(lx, floorY); g.lineTo(lx, floorY - 360); g.stroke();
      drawLightCone(g, lx, floorY - 360, floorY, 20, 220, lampCol, 0.22);
      drawSoftGlow(g, lx, floorY - 362, 52, lampCol, 0.56);
    }
  }

  drawFloorBase(g, W, H, floorY, floorColor, lightColor, 0.54);

  // Subtle wet pavement reflections when raining outdoors
  if (weather === 'rain' && backdrop !== 'windows' && backdrop !== 'shelves') {
    const refCol = setting.lamp_color || lightColor;
    const [rr, rg, rb] = hexToRgb(refCol);
    for (let pi = 0; pi < 7; pi++) {
      const px2 = 160 + pi * 265;
      const pw2 = 65 + (pi % 3) * 34;
      const py2 = floorY + 12 + (pi % 2) * 10;
      const shimmer = 0.08 + 0.05 * Math.sin(t * 3.1 + pi * 1.7);
      g.fillStyle = `rgba(${rr},${rg},${rb},${ca(shimmer)})`;
      g.beginPath();
      g.ellipse(px2, py2, pw2, 4.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  return { lightColor, accent: lightColor, floorColor };
}

function drawEnvironment(g, envOrSetting, t, panX = 0, accentColor = null, width = 1920, height = 1080, floorY = FLOOR_Y) {
  if (envOrSetting && typeof envOrSetting === 'object') {
    return renderCustomSetting(g, envOrSetting, width, height, floorY, t, panX, accentColor);
  }
  return renderEnvironment(g, envOrSetting, width, height, floorY, t, {
    panX,
    lightColor: accentColor || undefined,
    accent: accentColor || undefined,
  });
}

module.exports = {
  FLOOR_Y,
  DEFAULT_VISUAL_IDENTITY,
  ENVIRONMENT_THEMES,
  ENVIRONMENTS: ENVIRONMENT_THEMES,
  SUPPORTED_ENVIRONMENTS,
  drawLightCone,
  drawSoftGlow,
  renderNearBlackBackground,
  renderEnvironment,
  renderCustomSetting,
  drawEnvironment,
};
