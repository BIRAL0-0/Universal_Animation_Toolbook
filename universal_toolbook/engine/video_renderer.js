'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createCanvas, rawFrameBytes, rawPixelFormat } = require('./canvas_backend');

const { registerFonts } = require('./font');
const { drawWallProp } = require('./impossible_wall');
const { clamp, lerp, ease, eio, eo, ca, hexToRgb, mixRgb, rgbCss, BONES, drawFigure } = require('./character_rig');
const { FLOOR_Y: FLOOR_Y_LANDSCAPE, drawEnvironment, drawSoftGlow, renderNearBlackBackground } = require('./environments');
const FLOOR_Y = FLOOR_Y_LANDSCAPE;
const BASE_W = 1920;
const BASE_H = 1080;

/**
 * Retained for API compatibility. World authoring space stays canonical (1920x1080, FLOOR_Y=855)
 * while `renderEpisodeFrame` natively projects vector geometry and screen-space typography to any
 * target output frame (`1920x1080`, `1080x1920`, `960x540`, `540x960`).
 */
function setFrame(_w, _h) {
  return { width: BASE_W, height: BASE_H, floorY: FLOOR_Y };
}
const {
  drawWorldProp,
  drawWorldBoard,
  drawForegroundLayer,
  computePropAnchors,
  drawHeldPhoneInHand,
  drawHeldCupInHand,
} = require('./world_props_and_boards');
const {
  evaluateCharacterState,
  resolveSceneInteractions,
  resolveScenePropInteractions,
} = require('./motion_library');
const { compileEpisode } = require('./episode');
const {
  computePortraitViewport,
  computeLandscapePropZoomScale,
  fitBoardToPortraitViewport,
} = require('./portrait_framing');
const {
  DEFAULT_SCREEN_VIEWPORT,
  normalizeScreenViewport,
  containRect,
  coverRect,
  fitCanvasFont,
  wrapWordsByWidth,
  getLayoutConfig,
  measureAndPlaceSubtitle,
} = require('./render_layout');
const {
  getParchmentBackdrop,
  isParchmentScene,
  drawParchmentEnvironment,
  drawParchmentForeground,
  drawInkStickFigure,
  drawParchmentHeadline,
  drawParchmentSubtitle,
  drawParchmentIntertitle,
} = require('./parchment_ink_style');

const SPLIT_FURNITURE_TYPES = new Set([
  'desk',
  'clean_desk',
  'messy_desk',
  'cafe_table',
  'judge_table',
  'podium',
]);

function resolveLayerZ(item, defaultZ = -4) {
  if (item.z !== undefined && item.z !== null && Number.isFinite(Number(item.z))) {
    return Number(item.z);
  }
  const layer = String(item.layer || item.lane || '').toLowerCase();
  if (layer === 'far_back') return -30;
  if (layer === 'back') return -12;
  if (layer === 'mid') return 0;
  if (layer === 'front') return 18;
  if (layer === 'far_front') return 30;
  return defaultZ;
}

function drawHeldAccessoriesAndCallouts(g, state, joints, actor, sceneAccent, globalT = 0, parchmentMode = false) {
  const s = state.s || 1.0;
  const useLegacyFlatProp = Boolean(parchmentMode || (actor && actor.style === 'ink_stick'));

  if (state.wetShoulder && joints && joints.sh) {
    const sx = joints.sh[0] - (state.flip ? -10 * s : 10 * s);
    const sy = joints.sh[1] + 6 * s;
    g.save();
    g.fillStyle = 'rgba(186, 230, 253, 0.85)';
    for (let di = 0; di < 4; di++) {
      const prog = ((globalT * 1.45 + di * 0.27) % 1.0);
      const dx = sx + (di % 2 === 0 ? -3 * s : 2 * s);
      const dy = sy + prog * 38 * s;
      g.beginPath();
      g.ellipse(dx, dy, 2.1 * s, 3.6 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  if (state.heldCup && useLegacyFlatProp) {
    const { x, y, tilt } = state.heldCup;
    g.save();
    g.translate(x, y);
    g.rotate(tilt || 0);
    g.fillStyle = '#e2e8f0';
    g.strokeStyle = '#0f172a';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.roundRect(-7 * s, -9 * s, 14 * s, 17 * s, 3 * s);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(7 * s, 0, 4.5 * s, -Math.PI * 0.5, Math.PI * 0.5);
    g.stroke();
    g.restore();
  }

  if (state.heldDrawing) {
    const { x, y, facing } = state.heldDrawing;
    g.save();
    drawSoftGlow(g, x, y, 42 * s, '#fef3c7', 0.26);
    g.translate(x, y);
    g.rotate(facing * 0.16);
    g.fillStyle = '#faf5eb';
    g.strokeStyle = '#475569';
    g.lineWidth = 2 * s;
    g.beginPath();
    g.roundRect(-14 * s, -11 * s, 28 * s, 22 * s, 2.5 * s);
    g.fill();
    g.stroke();
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(0, -3 * s, 6 * s, Math.PI, 0, false);
    g.fill();
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.moveTo(0, -10 * s); g.lineTo(0, 10 * s);
    g.stroke();
    g.restore();
  }

  if (state.heldUmbrella) {
    const { x, y, color, open, tilt, facing, shaking, shaftLength } = state.heldUmbrella;
    const uCol = color || '#ef4444';
    const isRed = uCol.toLowerCase() === '#ef4444' || uCol.toLowerCase() === '#e11d48';
    const isBlack = uCol.toLowerCase() === '#1e293b' || uCol.toLowerCase() === '#0f172a';
    g.save();
    g.translate(x, y);
    g.rotate(tilt || 0);

    if (open) {
      const shaftLen = (Number(shaftLength) > 0 ? Number(shaftLength) : 136) * s;
      const canopyR = 88 * s;
      const topY = -shaftLen;
      if (isRed) {
        drawSoftGlow(g, 0, topY + 12 * s, 145 * s, '#ef4444', 0.34);
      } else if (!isBlack) {
        drawSoftGlow(g, 0, topY + 12 * s, 120 * s, uCol, 0.24);
      }
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 4.2 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 10 * s);
      g.lineTo(0, topY - 12 * s);
      g.stroke();
      g.strokeStyle = '#0f172a';
      g.lineWidth = 5.2 * s;
      g.beginPath();
      g.moveTo(0, 2 * s);
      g.lineTo(0, 14 * s);
      g.arc(-7 * s * (facing || 1), 14 * s, 7 * s, 0, Math.PI, (facing || 1) < 0);
      g.stroke();

      g.fillStyle = uCol;
      g.strokeStyle = isBlack ? '#64748b' : '#060912';
      g.lineWidth = 3.2 * s;
      g.beginPath();
      g.arc(0, topY + canopyR * 0.52, canopyR, Math.PI * 1.04, -Math.PI * 0.04, false);
      const leftX = -canopyR * Math.cos(0.04 * Math.PI);
      const rightX = canopyR * Math.cos(0.04 * Math.PI);
      const rimY = topY + canopyR * 0.52 - canopyR * Math.sin(0.04 * Math.PI);
      const segW = (rightX - leftX) / 3;
      g.quadraticCurveTo(leftX + segW * 0.5, rimY - 11 * s, leftX + segW, rimY);
      g.quadraticCurveTo(leftX + segW * 1.5, rimY - 11 * s, leftX + segW * 2, rimY);
      g.quadraticCurveTo(leftX + segW * 2.5, rimY - 11 * s, rightX, rimY);
      g.closePath();
      g.fill();
      g.stroke();

      g.strokeStyle = isRed ? 'rgba(254, 202, 202, 0.48)' : 'rgba(226, 232, 240, 0.34)';
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.arc(0, topY + canopyR * 0.52, canopyR - 5 * s, Math.PI * 1.18, Math.PI * 1.82, false);
      g.stroke();
    } else {
      const len = 84 * s;
      if (isRed) drawSoftGlow(g, 0, len * 0.45, 72 * s, '#ef4444', 0.25);
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 4.2 * s;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(-6 * s, -6 * s, 6 * s, 0, Math.PI, true);
      g.moveTo(0, -6 * s);
      g.lineTo(0, len + 10 * s);
      g.stroke();
      g.fillStyle = uCol;
      g.strokeStyle = isBlack ? '#64748b' : '#060912';
      g.lineWidth = 2.6 * s;
      g.beginPath();
      g.moveTo(-7 * s, 6 * s);
      g.lineTo(7 * s, 6 * s);
      g.lineTo(3 * s, len);
      g.lineTo(-3 * s, len);
      g.closePath();
      g.fill();
      g.stroke();
      if (shaking) {
        g.fillStyle = 'rgba(186, 230, 253, 0.85)';
        for (let k = 0; k < 5; k++) {
          const ang = (k - 2) * 0.45 + Math.sin(globalT * 22 + k) * 0.2;
          const dist = (14 + ((globalT * 65 + k * 9) % 24)) * s;
          g.beginPath();
          g.arc(Math.sin(ang) * dist, len * 0.7 + Math.cos(ang) * dist * 0.4, 2.2 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }

  if (state.heldPhone && useLegacyFlatProp) {
    const { x, y, facing } = state.heldPhone;
    g.save();
    drawSoftGlow(g, x + facing * 8 * s, y - 8 * s, 58 * s, '#38bdf8', 0.38);
    g.translate(x, y);
    g.rotate(facing * -0.45);
    g.fillStyle = '#0f172a';
    g.strokeStyle = '#7dd3fc';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(-7 * s, -14 * s, 14 * s, 26 * s, 3);
    g.fill();
    g.stroke();
    g.restore();
  }

  if (state.heldPen) {
    const { x, y, dir } = state.heldPen;
    g.save();
    g.strokeStyle = sceneAccent || '#38bdf8';
    g.lineWidth = 4.5 * s;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + dir * 18 * s, y - 10 * s);
    g.stroke();
    g.restore();
  }

  if (state.heldBlueprint) {
    const { x, y, facing, open } = state.heldBlueprint;
    g.save();
    drawSoftGlow(g, x, y, 52 * s, sceneAccent || '#38bdf8', 0.28);
    g.translate(x, y);
    g.rotate(facing * 0.18);
    if (open) {
      g.fillStyle = '#0f2942';
      g.strokeStyle = '#7dd3fc';
      g.lineWidth = 2.2 * s;
      g.beginPath();
      g.roundRect(-22 * s, -16 * s, 44 * s, 30 * s, 3 * s);
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(186, 230, 253, 0.85)';
      g.lineWidth = 1.4 * s;
      g.beginPath();
      g.moveTo(-16 * s, 6 * s); g.lineTo(16 * s, 6 * s);
      g.moveTo(-9 * s, 6 * s); g.lineTo(-9 * s, -8 * s);
      g.moveTo(9 * s, 6 * s); g.lineTo(9 * s, -8 * s);
      g.moveTo(-16 * s, 5 * s); g.quadraticCurveTo(-9 * s, -7 * s, 0, 4 * s);
      g.quadraticCurveTo(9 * s, -7 * s, 16 * s, 5 * s);
      g.stroke();
    } else {
      g.fillStyle = '#e0f2fe';
      g.strokeStyle = '#0f172a';
      g.lineWidth = 2.2 * s;
      g.beginPath();
      g.roundRect(-20 * s, -6 * s, 40 * s, 12 * s, 5 * s);
      g.fill();
      g.stroke();
      g.fillStyle = sceneAccent || '#f59e0b';
      g.fillRect(-3 * s, -6 * s, 6 * s, 12 * s);
    }
    g.restore();
  }

  if (state.callout && joints && joints.head) {
    const cx = joints.head[0];
    const headR = BONES.HEAD_R * s;
    const cy = joints.head[1] - headR - (actor.showNameTag ? 72 : 42) * s;
    const text = String(state.callout);
    g.save();
    g.font = 'bold 17px PopB';
    const tw = g.measureText(text).width;
    const pw = tw + 28;
    const ph = 32;
    const col = actor.callout_color || sceneAccent || '#38bdf8';
    g.fillStyle = 'rgba(9, 14, 26, 0.90)';
    g.strokeStyle = col;
    g.lineWidth = 2.2;
    g.beginPath();
    g.roundRect(cx - pw * 0.5, cy - ph * 0.5, pw, ph, 10);
    g.fill();
    g.stroke();
    g.fillStyle = col;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, cx, cy + 1);
    g.restore();
  }
}

function drawChapterRibbon(g, chapterTitle, ts, accentColor, channelName, viewport = DEFAULT_SCREEN_VIEWPORT) {
  if (!chapterTitle || ts > 4.2) return;
  const frame = normalizeScreenViewport(viewport);
  const enter = eo(clamp(ts / 0.45));
  const exit = ts > 3.5 ? 1 - ease(clamp((ts - 3.5) / 0.7)) : 1;
  const vis = enter * exit;
  if (vis <= 0.01) return;

  const title = String(chapterTitle).toUpperCase();
  const channel = String(channelName || '').toUpperCase();
  const hasChannel = Boolean(channel.trim());
  const maxTextW = Math.max(120, frame.width - 104);
  const titleSize = fitCanvasFont(g, title, { family: 'PopB', baseSize: 23, minSize: 14, maxWidth: maxTextW });
  const titleW = g.measureText(title).width;
  let subW = 0;
  let subSize = 13;
  if (hasChannel) {
    subSize = fitCanvasFont(g, channel, { family: 'PopR', weight: '600', baseSize: 13, minSize: 10, maxWidth: maxTextW });
    subW = g.measureText(channel).width;
  }
  const boxW = Math.min(frame.width - 24, Math.max(titleW, subW) + 52);
  const boxH = hasChannel ? 68 : 50;
  const isFullFrame = frame.left === 0 && Math.abs(frame.width - BASE_W) < 1;
  const x = isFullFrame
    ? lerp(-40, 54, enter)
    : lerp(frame.left - boxW - 12, frame.left + 24, enter);
  const y = 44;

  g.save();
  g.globalAlpha = vis;
  g.fillStyle = 'rgba(8, 13, 24, 0.86)';
  g.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.roundRect(x, y, boxW, boxH, 12);
  g.fill();
  g.stroke();

  g.fillStyle = accentColor;
  g.beginPath();
  g.roundRect(x, y, 7, boxH, [12, 0, 0, 12]);
  g.fill();

  if (hasChannel) {
    g.font = `600 ${subSize}px PopR`;
    g.fillStyle = accentColor;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(channel, x + 22, y + 12, Math.max(1, boxW - 34));

    g.font = `bold ${titleSize}px PopB`;
    g.fillStyle = '#f8fafc';
    g.fillText(title, x + 22, y + 32, Math.max(1, boxW - 34));
  } else {
    g.font = `bold ${titleSize}px PopB`;
    g.fillStyle = '#f8fafc';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(title, x + 22, y + boxH * 0.5 + 1, Math.max(1, boxW - 34));
  }
  g.restore();
}

/**
 * Crisp Cinema Lower-Third Subtitles with Smooth Gap-Bridged Word Glow & Persistent Keyword Highlights
 * - Zero muddy `strokeText` smear (uses clean soft radial halo + crisp rounded pill + sharp drop-shadowed text)
 * - Multi-word & single-word `highlight` keywords glow in warm cinema gold (`#fbbf24`) and retain a subtle luminous underline
 * - Consecutive word gaps are pre-bridged in `episode.js` so the active word highlight glides smoothly without strobing!
 */
function drawCinemaSubtitle(g, subtitles, ts, accentColor, mode = 'cinema', viewport = DEFAULT_SCREEN_VIEWPORT) {
  if (mode === 'off' || !Array.isArray(subtitles) || subtitles.length === 0) return;

  let active = null;
  for (const sub of subtitles) {
    if (ts >= sub.start && ts <= sub.end) {
      active = sub;
      break;
    }
  }
  if (!active) return;

  const fadeIn = clamp((ts - active.start) / 0.12);
  const fadeOut = clamp((active.end - ts) / 0.14);
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.02) return;

  g.save();
  g.globalAlpha = alpha;
  g.font = 'bold 29px PopB';
  g.textBaseline = 'middle';
  const frame = normalizeScreenViewport(viewport);

  // Keep the lower-third inside the visible portrait crop (and retain the legacy 1280px cap in 16:9).
  const maxLineW = Math.max(160, Math.min(1280, frame.width - 96));
  const spaceW = g.measureText(' ').width * 1.12;
  const lines = [];
  let curLine = [];
  let curW = 0;

  for (const tok of active.tokens) {
    const w = g.measureText(tok.raw).width + (tok.isSpeakerLabel ? 8 : 0);
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

  // Rebalance orphan 1-2 word second lines cleanly
  if (lines.length === 2 && lines[1].items.length <= 2 && lines[0].items.length >= 5) {
    const moved = lines[0].items.splice(lines[0].items.length - 2, 2);
    lines[1].items.unshift(...moved);
    lines[0].width = lines[0].items.reduce((s, t) => s + t.width, 0) + Math.max(0, lines[0].items.length - 1) * spaceW;
    lines[1].width = lines[1].items.reduce((s, t) => s + t.width, 0) + Math.max(0, lines[1].items.length - 1) * spaceW;
  }

  const lineH = 46;
  const totalH = lines.length * lineH + 26;
  const maxW = Math.max(...lines.map((l) => l.width)) + 68;
  // Title-safe lower third: ~7% (75px) bottom clearance, still cleanly below FLOOR_Y (855px)
  const centerY = 930 - (lines.length - 1) * 20;
  const baseAccentRgb = hexToRgb(accentColor || '#38bdf8');
  const brightAccentCss = rgbCss(mixRgb(baseAccentRgb, [255, 255, 255], 0.28));
  const goldRgb = [251, 191, 36]; // #fbbf24 key-phrase highlight gold

  // Frosted dark cinema lower-third card with subtle top specular rim
  const boxX = frame.centerX - maxW * 0.5;
  const boxY = centerY - totalH * 0.5;
  g.fillStyle = 'rgba(6, 10, 20, 0.89)';
  g.strokeStyle = 'rgba(148, 163, 184, 0.30)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.roundRect(boxX, boxY, maxW, totalH, 15);
  g.fill();
  g.stroke();

  // Find the single active spoken token across ALL lines of this cue so two lines never double-glow simultaneously
  let globalActiveLine = -1;
  let globalActiveIdx = -1;
  let globalStrength = 0;

  lines.forEach((line, lIdx) => {
    line.items.forEach((it, idx) => {
      if (it.isSpeakerLabel || it.tStart === undefined || it.tEnd === undefined) return;
      if (ts >= it.tStart - 0.025 && ts <= it.tEnd + 0.035) {
        const span = Math.max(0.06, it.tEnd - it.tStart);
        const atk = clamp((ts - (it.tStart - 0.025)) / Math.min(0.055, span * 0.45));
        const rel = clamp(((it.tEnd + 0.035) - ts) / Math.min(0.065, span * 0.50));
        const str = Math.min(atk, rel);
        if (str >= globalStrength) {
          globalStrength = str;
          globalActiveLine = lIdx;
          globalActiveIdx = idx;
        }
      }
    });
  });

  g.textAlign = 'left';
  lines.forEach((line, lIdx) => {
    let x = frame.centerX - line.width * 0.5;
    const y = centerY - ((lines.length - 1) * lineH) * 0.5 + lIdx * lineH + 1;

    line.items.forEach((it, idx) => {
      const hasTiming = it.tStart !== undefined && it.tEnd !== undefined;
      const isSpokenNow = lIdx === globalActiveLine && idx === globalActiveIdx && globalStrength > 0.04;
      const alreadySpoken = !hasTiming || it.isSpeakerLabel || ts > it.tEnd;

      if (it.isSpeakerLabel) {
        // Sleek colored speaker badge tag (e.g. `DANIEL:`)
        g.save();
        g.fillStyle = `rgba(${baseAccentRgb[0]}, ${baseAccentRgb[1]}, ${baseAccentRgb[2]}, 0.18)`;
        g.strokeStyle = `rgba(${baseAccentRgb[0]}, ${baseAccentRgb[1]}, ${baseAccentRgb[2]}, 0.65)`;
        g.lineWidth = 1.4;
        g.beginPath();
        g.roundRect(x - 6, y - 16, it.width + 4, 32, 8);
        g.fill();
        g.stroke();
        g.fillStyle = brightAccentCss;
        g.fillText(it.raw, x, y);
        g.restore();
      } else if (isSpokenNow) {
        const midX = x + it.width * 0.5;
        const liftY = -1.6 * globalStrength;
        g.save();
        if (it.highlight) {
          // Luminous warm-gold cinema capsule strictly reserved for emphasized `accent_words`
          drawSoftGlow(g, midX, y + liftY, Math.max(44, it.width * 0.78), '#fbbf24', 0.36 * globalStrength);
          g.fillStyle = `rgba(${goldRgb[0]}, ${goldRgb[1]}, ${goldRgb[2]}, ${ca(0.26 * globalStrength)})`;
          g.strokeStyle = `rgba(${goldRgb[0]}, ${goldRgb[1]}, ${goldRgb[2]}, ${ca(0.92 * globalStrength)})`;
          g.lineWidth = 1.65;
          g.beginPath();
          g.roundRect(x - 6, y - 18 + liftY, it.width + 12, 36, 9);
          g.fill();
          g.stroke();
          g.fillStyle = 'rgba(0, 0, 0, 0.75)';
          g.fillText(it.raw, x + 1, y + liftY + 1.5);
          g.fillStyle = '#fef08a';
          g.fillText(it.raw, x, y + liftY);
        } else {
          // Clean pure-white active word focus without noisy colored boxes on standard words
          drawSoftGlow(g, midX, y + liftY, Math.max(36, it.width * 0.65), '#f8fafc', 0.14 * globalStrength);
          g.fillStyle = 'rgba(0, 0, 0, 0.75)';
          g.fillText(it.raw, x + 1, y + liftY + 1.5);
          g.fillStyle = '#ffffff';
          g.fillText(it.raw, x, y + liftY);
        }
        g.restore();
      } else if (alreadySpoken) {
        g.save();
        g.fillStyle = 'rgba(0, 0, 0, 0.60)';
        g.fillText(it.raw, x + 1, y + 1.5);
        if (it.highlight) {
          g.fillStyle = '#fde047';
          g.fillText(it.raw, x, y);
          // Subtle luminous keyword underline bar
          g.fillStyle = 'rgba(251, 191, 36, 0.78)';
          g.beginPath();
          g.roundRect(x, y + 16, it.width, 2.6, 1.3);
          g.fill();
        } else {
          g.fillStyle = '#f8fafc';
          g.fillText(it.raw, x, y);
        }
        g.restore();
      } else {
        // Upcoming words: crisp readable slate or warm dimmed gold for upcoming highlighted keywords
        g.fillStyle = it.highlight
          ? 'rgba(253, 224, 71, 0.76)'
          : 'rgba(203, 213, 225, 0.64)';
        g.fillText(it.raw, x, y);
      }

      x += it.width + (idx < line.items.length - 1 ? spaceW : 0);
    });
  });

  g.restore();
}

function drawOutroFrame(g, outro, ts, channelName, viewport = DEFAULT_SCREEN_VIEWPORT) {
  const frame = normalizeScreenViewport(viewport);
  drawEnvironment(g, 'night_city', ts, 0, outro.accentColor || '#38bdf8');
  g.fillStyle = 'rgba(6, 10, 20, 0.62)';
  g.fillRect(0, 0, BASE_W, BASE_H);

  const u = eo(clamp(ts / 0.8));
  g.save();
  g.globalAlpha = u;
  drawSoftGlow(g, frame.centerX, BASE_H * 0.46, 520, outro.accentColor, 0.22);

  const maxTextW = Math.max(140, frame.width - 72);
  const subText = (outro.subtitle || channelName || '').trim().toUpperCase();
  if (subText) {
    fitCanvasFont(g, subText, { family: 'PopB', baseSize: 20, minSize: 12, maxWidth: maxTextW });
    g.fillStyle = outro.accentColor;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(subText, frame.centerX, BASE_H * 0.38, maxTextW);
  }

  const title = String(outro.title || '').trim();
  let titleSize = 50;
  let lines = [];
  do {
    g.font = `bold ${titleSize}px PopB`;
    lines = wrapWordsByWidth(g, title, maxTextW);
    if (lines.every((line) => g.measureText(line).width <= maxTextW) || titleSize <= 28) break;
    titleSize -= 1;
  } while (titleSize > 28);
  g.font = `bold ${titleSize}px PopB`;
  g.fillStyle = '#f8fafc';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lineH = Math.max(38, titleSize * 1.16);
  const startY = BASE_H * 0.49 - ((lines.length - 1) * lineH) * 0.5;
  lines.forEach((line, idx) => g.fillText(line, frame.centerX, startY + idx * lineH, maxTextW));
  g.restore();
}

function findSceneAtFrame(episode, frameIdx) {
  if (episode.outro && frameIdx >= episode.outro.startFrame) {
    return { type: 'outro', outro: episode.outro };
  }
  const scenes = episode.scenes;
  for (let i = 0; i < scenes.length; i++) {
    if (frameIdx < scenes[i].endFrame || i === scenes.length - 1) {
      return { type: 'scene', scene: scenes[i], index: i };
    }
  }
  return { type: 'scene', scene: scenes[0], index: 0 };
}

function evaluateSceneCamera(sc, ts) {
  if (Array.isArray(sc.cameraShots) && sc.cameraShots.length > 0) {
    let activeIdx = 0;
    for (let i = 0; i < sc.cameraShots.length; i++) {
      if (ts >= sc.cameraShots[i].start) activeIdx = i;
    }
    const sh = sc.cameraShots[activeIdx];
    const rawSpan = Math.max(0.05, sh.end - sh.start);
    const hasSignificantPanOrFocus =
      Math.abs(sh.panTo - sh.panFrom) > 0.04 ||
      Math.abs(sh.focusXTo - sh.focusXFrom) > 0.05 ||
      Math.abs(sh.zoomTo - sh.zoomFrom) > 0.10;
    // Motivated camera move duration: if a shot moves significantly across the stage, settle over a crisp
    // cinematic window (`moveDur` or `min(rawSpan, 3.2s)`) rather than drifting aimlessly for 20+ seconds!
    const effDur = sh.moveDur !== null && sh.moveDur !== undefined
      ? Math.max(0.15, sh.moveDur)
      : (hasSignificantPanOrFocus ? Math.min(rawSpan, 3.2) : rawSpan);
    const u = eio(clamp((ts - sh.start) / effDur));
    let zoom = lerp(sh.zoomFrom, sh.zoomTo, u);
    let panX = lerp(sh.panFrom, sh.panTo, u) * BASE_W;
    let focusX = lerp(sh.focusXFrom, sh.focusXTo, u) * BASE_W;
    let focusY = lerp(sh.focusYFrom, sh.focusYTo, u) * BASE_H;

    if (!sh.cut && activeIdx > 0 && ts - sh.start < sh.blendSec) {
      const prev = sc.cameraShots[activeIdx - 1];
      const k = eio(clamp((ts - sh.start) / sh.blendSec));
      zoom = lerp(prev.zoomTo, zoom, k);
      panX = lerp(prev.panTo * BASE_W, panX, k);
      focusX = lerp(prev.focusXTo * BASE_W, focusX, k);
      focusY = lerp(prev.focusYTo * BASE_H, focusY, k);
    }
    return { zoom, panX, focusX, focusY };
  }

  const effSceneCamDur = sc.camera.moveDur !== null && sc.camera.moveDur !== undefined
    ? Math.max(0.2, sc.camera.moveDur)
    : Math.max(0.1, sc.duration);
  const camU = eio(clamp(ts / effSceneCamDur));
  return {
    zoom: lerp(sc.camera.zoomFrom, sc.camera.zoomTo, camU),
    panX: lerp(sc.camera.panFrom, sc.camera.panTo, camU) * BASE_W,
    focusX: lerp(sc.camera.focusXFrom ?? 0.5, sc.camera.focusXTo ?? 0.5, camU) * BASE_W,
    focusY: lerp(sc.camera.focusYFrom ?? 0.54, sc.camera.focusYTo ?? 0.54, camU) * BASE_H,
  };
}

function evaluateSceneSpeechState(sc, ts) {
  const lineTimings = sc.lineTimings || [];
  const wordTimings = sc.wordTimings || [];
  const hasCharacterDialogue = lineTimings.some((lt) => lt.speaker && lt.speaker.toLowerCase() !== 'narrator');
  let activeLine = null;
  let activeSpeaker = null;
  for (const lt of lineTimings) {
    if (ts >= lt.start - 0.025 && ts <= lt.end + 0.035) {
      activeLine = lt;
      activeSpeaker = String(lt.speaker || 'narrator').toLowerCase();
      break;
    }
  }
  let talkAmount = 0;
  let viseme = 'open';
  if (activeSpeaker && activeSpeaker !== 'narrator' && activeLine) {
    // 1. Resolve current word viseme (bridging <=120ms coarticulation gaps smoothly)
    const lineWords = Array.isArray(activeLine.words) && activeLine.words.length > 0 ? activeLine.words : wordTimings;
    for (let i = 0; i < lineWords.length; i++) {
      const w = lineWords[i];
      const nxt = lineWords[i + 1];
      const bridgedEnd = nxt && (nxt.start - w.end <= 0.14) ? nxt.start : w.end + 0.02;
      if (ts >= w.start - 0.02 && ts <= bridgedEnd) {
        const rawWord = String(w.word || '').toLowerCase().replace(/[^a-z]/g, '');
        const nearWordStart = ts <= w.start + 0.075;
        const nearWordEnd = ts >= w.end - 0.055;
        if ((nearWordStart && /^[bmp]/.test(rawWord)) || (nearWordEnd && /[bmp]$/.test(rawWord))) {
          viseme = 'closed';
        } else {
          viseme = w.viseme || 'open';
        }
        break;
      }
    }

    // 2. Drive jaw opening from actual 30fps PCM speech envelope when synthesized, or bridged syllable envelope fallback
    const env = activeLine.env_30fps || activeLine.env30fps;
    if (Array.isArray(env) && env.length > 1) {
      const fPos = Math.max(0, (ts - activeLine.start) * 30.0);
      const i0 = Math.min(env.length - 1, Math.floor(fPos));
      const i1 = Math.min(env.length - 1, i0 + 1);
      const frac = fPos - Math.floor(fPos);
      talkAmount = clamp(lerp(Number(env[i0] || 0), Number(env[i1] || 0), frac));
    } else {
      for (let i = 0; i < lineWords.length; i++) {
        const w = lineWords[i];
        const nxt = lineWords[i + 1];
        const hasShortGap = nxt && (nxt.start - w.end <= 0.12);
        const effEnd = hasShortGap ? nxt.start : w.end;
        if (ts >= w.start - 0.02 && ts <= effEnd + 0.02) {
          const wDur = Math.max(0.07, effEnd - w.start);
          const wu = clamp((ts - w.start) / wDur);
          const syll = 0.62 + 0.38 * Math.abs(Math.sin(wu * Math.PI * Math.max(1, Math.round(wDur * 4.8))));
          const edge = hasShortGap ? (0.32 + 0.68 * Math.sin(wu * Math.PI)) : Math.sin(wu * Math.PI);
          talkAmount = clamp(edge * syll);
          break;
        }
      }
    }
  }
  return { activeSpeaker, activeLine, talkAmount, viseme, hasCharacterDialogue };
}

/**
 * Draw every `ink_caption` prop in screen space, ignoring the scene camera.
 *
 * Captions carry the film's text beats, so they must never pan, zoom, or clip at the frame edge.
 */
function drawScreenCaptionPass(g, sc, ts) {
  const props = Array.isArray(sc.props) ? sc.props : [];
  for (const prop of props) {
    if (prop && prop.type === 'ink_caption') {
      drawWallProp(g, prop, BASE_W, FLOOR_Y, ts, ts, prop.scale ?? 1.0, BASE_H);
    }
  }
}

function projectPoint(matrix, wx, wy) {
  return [
    matrix.a * wx + matrix.c * wy + matrix.e,
    matrix.b * wx + matrix.d * wy + matrix.f,
  ];
}

function projectWorldRectToScreen(ctx, left, top, right, bottom) {
  const m = ctx.getTransform();
  const [x0, y0] = projectPoint(m, left, top);
  const [x1, y1] = projectPoint(m, right, bottom);
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  };
}

function recordCharacterScreenObstacles(ctx, joints, state, obstacles) {
  if (!joints || !Array.isArray(obstacles)) return;
  const s = state.s || 1.0;
  if (joints.head) {
    const hr = BONES.HEAD_R * s * 1.18;
    obstacles.push({
      kind: 'face',
      ...projectWorldRectToScreen(ctx, joints.head[0] - hr, joints.head[1] - hr, joints.head[0] + hr, joints.head[1] + hr),
    });
  }
  const handPts = [joints.hl, joints.hr, joints.al && joints.al[2], joints.ar && joints.ar[2]].filter(
    (p) => Array.isArray(p) && p.length >= 2
  );
  for (const hp of handPts) {
    const hPad = 14 * s;
    obstacles.push({
      kind: 'hand',
      ...projectWorldRectToScreen(ctx, hp[0] - hPad, hp[1] - hPad, hp[0] + hPad, hp[1] + hPad),
    });
  }
  if (state.heldPhone) {
    const px = state.heldPhone.x ?? (joints.hl ? joints.hl[0] : state.x);
    const py = state.heldPhone.y ?? (joints.hl ? joints.hl[1] : state.fy - 140 * s);
    obstacles.push({
      kind: 'prop',
      ...projectWorldRectToScreen(ctx, px - 18 * s, py - 24 * s, px + 18 * s, py + 24 * s),
    });
  }
  if (state.heldCup) {
    const cx = state.heldCup.x ?? state.x;
    const cy = state.heldCup.y ?? state.fy - 130 * s;
    obstacles.push({
      kind: 'prop',
      ...projectWorldRectToScreen(ctx, cx - 14 * s, cy - 16 * s, cx + 14 * s, cy + 16 * s),
    });
  }
  const pts = [joints.head, joints.hip, joints.sh, joints.hl, joints.hr, joints.fl, joints.fr]
    .concat(joints.ll || [], joints.lr || [], joints.al || [], joints.ar || [])
    .filter((p) => Array.isArray(p) && p.length >= 2);
  if (pts.length > 0) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const headPad = BONES.HEAD_R * s;
    obstacles.push({
      kind: 'body',
      ...projectWorldRectToScreen(
        ctx,
        Math.min(...xs) - 14 * s,
        Math.min(...ys) - headPad,
        Math.max(...xs) + 14 * s,
        Math.max(...ys) + 12 * s
      ),
    });
  }
}

function renderCharacterPass(ctx, entry, drawMode, parchmentMode, activeLight, speechState, globalT) {
  const { actor, state } = entry;
  const actorIsSpeaking = Boolean(
    speechState.activeSpeaker && speechState.activeSpeaker === String(actor.id || '').toLowerCase()
  );
  const useInkStick = parchmentMode || actor.style === 'ink_stick';
  if (useInkStick) {
    if (drawMode !== 'full' && drawMode !== 'body_no_front_arm' && drawMode !== 'upper_front') {
      return null;
    }
    return drawInkStickFigure(ctx, state.x, state.fy, state.s, state.pose, state.flip, {
      accessories: actor.accessories || actor.accessory,
      expression: state.expression || actor.expression,
      posture: state.posture ?? actor.posture,
      nameTag: actor.showNameTag ? actor.name : null,
      globalT,
      // Amplitude + viseme driven lip sync, gated to this actor's own speech (never the narrator's)
      faceAnim: {
        talkAmount: actorIsSpeaking ? speechState.talkAmount : 0,
        viseme: actorIsSpeaking ? speechState.viseme || 'open' : 'open',
      },
    });
  }

  const phoneInHand = Boolean(state.heldPhone && state.heldPhone.inHand !== false);
  const phoneOnFarHand = phoneInHand && state.heldPhone.hand === 'far';
  const farHandOverlay = phoneOnFarHand
    ? (gHand, handInfo) => {
        drawHeldPhoneInHand(gHand, handInfo, state.heldPhone, globalT);
      }
    : null;
  const hasFrontHandProp = Boolean((phoneInHand && !phoneOnFarHand) || state.heldCup);
  const frontHandOverlay = hasFrontHandProp
    ? (gHand, handInfo) => {
        if (phoneInHand && !phoneOnFarHand) {
          drawHeldPhoneInHand(gHand, handInfo, state.heldPhone, globalT);
        }
        if (state.heldCup) {
          drawHeldCupInHand(gHand, handInfo, state.heldCup, globalT);
        }
      }
    : null;
  const screenGlow = (phoneInHand && state.heldPhone.lit !== false)
    ? 1.0
    : (state.typingTapL !== undefined ? 0.52 : 0);

  return drawFigure(ctx, state.x, state.fy, state.s, state.pose, state.flip, {
    id: actor.id,
    color: actor.color,
    style: actor.style,
    build: actor.build,
    hair: actor.hair,
    hairColor: actor.hairColor,
    shoeColor: actor.shoeColor,
    barefoot: actor.barefoot,
    accessory: actor.accessory,
    accessories: actor.accessories,
    eyes: actor.eyes,
    expression: state.expression || actor.expression,
    posture: state.posture ?? actor.posture,
    outlineWidth: actor.outlineWidth,
    coatColor: actor.coatColor,
    scarfColor: actor.scarfColor,
    bagColor: actor.bagColor,
    lightColor: activeLight,
    screenGlow,
    nameTag: actor.showNameTag ? actor.name : null,
    turnScaleX: state.turnScaleX ?? 1.0,
    drawMode,
    farHandOverlay,
    frontHandOverlay,
    faceAnim: {
      talkAmount: actorIsSpeaking ? speechState.talkAmount : 0,
      viseme: actorIsSpeaking ? (speechState.viseme || 'open') : 'open',
      globalT,
      blinkSeed: state.actorSeed || 0,
      lookX: state.lookX || 0,
      lookY: state.lookY || 0,
    },
  });
}

/**
 * Drop signpost label plates that a portrait crop would show as unreadable clipped fragments.
 *
 * The 9:16 master is a `viewport.width`-wide crop of the 1920-wide stage, and the crop follows
 * the speaker/camera, so its left edge moves every frame. Drawing a 148px label plate whose
 * visible part is only a few pixels produces a floating colour chip with no text. Keep a label
 * only when at least 70% of its plate lies inside the crop. Landscape renders pass a full-width
 * viewport and are untouched, so their output is byte-identical.
 */
function pruneClippedSignpostLabels(prop, { zoom, focusX, panX, viewport, baseW }) {
  if (!viewport || viewport.width >= baseW || prop.type !== 'signpost') return prop;
  if (!prop.left_label && !prop.right_label) return prop;
  const s = prop.scale ?? 1.0;
  const px = (prop.x ?? 0.5) * baseW;
  const stageX = (worldX) => baseW * 0.5 + zoom * (worldX - focusX - panX);
  const visibleFraction = (x0, x1) => {
    const a = stageX(Math.min(x0, x1));
    const b = stageX(Math.max(x0, x1));
    const visible = Math.max(0, Math.min(b, viewport.right) - Math.max(a, viewport.left));
    return visible / Math.max(1, b - a);
  };
  let result = prop;
  if (prop.left_label && visibleFraction(px - 155 * s, px - 7 * s) < 0.7) {
    result = { ...result };
    delete result.left_label;
  }
  if (prop.right_label && visibleFraction(px + 7 * s, px + 155 * s) < 0.7) {
    result = { ...result };
    delete result.right_label;
  }
  return result;
}

function renderBaseEpisodeFrame(
  ctx,
  episode,
  frameIdx,
  viewport = DEFAULT_SCREEN_VIEWPORT,
  cameraZoomScale = 1,
  renderMeta = null
) {
  const globalT = frameIdx / episode.fps;
  const frame = normalizeScreenViewport(viewport);
  const hit = findSceneAtFrame(episode, frameIdx);
  if (hit.type === 'outro') {
    const ts = Math.max(0, globalT - hit.outro.startSec);
    drawOutroFrame(ctx, hit.outro, ts, episode.channelName, frame);
    return;
  }

  const sc = hit.scene;
  const ts = clamp(globalT - sc.startSec, 0, sc.duration);
  const { zoom: sceneZoom, panX, focusX, focusY } = evaluateSceneCamera(sc, ts);
  const zoom = sceneZoom * Math.max(0.05, Number(cameraZoomScale) || 1);
  const speechState = evaluateSceneSpeechState(sc, ts);
  const obstacles = renderMeta && Array.isArray(renderMeta.screenObstacles) ? renderMeta.screenObstacles : null;

  const parchmentMode = isParchmentScene(sc);
  if (parchmentMode) {
    ctx.drawImage(getParchmentBackdrop(BASE_W, BASE_H), 0, 0);
  }

  // Boards are screen-space UI (safe-zone clamped), so remember the pre-camera transform and
  // draw them through it: they stay put while the camera pans/pushes, exactly like real graphics.
  const screenMatrix = ctx.getTransform();

  ctx.save();
  if (zoom !== 1.0 || panX !== 0.0 || focusX !== BASE_W * 0.5 || focusY !== BASE_H * 0.54) {
    ctx.translate(BASE_W * 0.5, BASE_H * 0.54);
    ctx.scale(zoom, zoom);
    ctx.translate(-focusX - panX, -focusY);
  }

  // 1. Render custom parametric setting OR built-in environment (ZERO grain!)
  const envInfo = parchmentMode
    ? drawParchmentEnvironment(ctx, sc.setting, globalT, ts, panX, FLOOR_Y, BASE_W, BASE_H)
    : drawEnvironment(ctx, sc.setting || sc.environment, globalT, panX, sc.accentColor);
  const activeLight = sc.accentColor || envInfo.lightColor;

  // 1b. Optional Split-Screen dual-room backdrop tint
  if (sc.splitScreen) {
    const ss = sc.splitScreen;
    const sFrom = ss.from_t !== undefined ? Number(ss.from_t) : 0.0;
    const sTo = ss.to_t !== undefined ? Number(ss.to_t) : sc.duration + 1.0;
    if (ts >= sFrom && ts <= sTo + 0.8) {
      const fadeOut = sTo < sc.duration ? ease(clamp(((sTo + 0.8) - ts) / 0.85)) : 1.0;
      if (fadeOut > 0.01) {
        ctx.save();
        ctx.globalAlpha = fadeOut;
        const leftWarm = ss.left_tint || 'rgba(56, 189, 248, 0.07)';
        const rightTint = ss.right_tint || 'rgba(2, 6, 16, 0.42)';
        ctx.fillStyle = leftWarm;
        ctx.fillRect(-120, -60, BASE_W * 0.5 + 120, FLOOR_Y + 60);
        ctx.fillStyle = rightTint;
        ctx.fillRect(BASE_W * 0.5, -60, BASE_W * 0.5 + 120, FLOOR_Y + 60);

        if (ss.left_lights_out_at !== undefined && ts >= Number(ss.left_lights_out_at)) {
          const dimU = ease(clamp((ts - Number(ss.left_lights_out_at)) / 0.45));
          ctx.fillStyle = `rgba(3, 7, 16, ${ca(0.68 * dimU)})`;
          ctx.fillRect(-120, -60, BASE_W * 0.5 + 120, BASE_H + 120);
        }
        ctx.restore();
      }
    }
  }

  // 2. Evaluate all active characters & solve paired 2-character + physical prop interactions
  const rawActiveChars = [];
  for (let cIdx = 0; cIdx < sc.characters.length; cIdx++) {
    const actor = sc.characters[cIdx];
    if (actor.from_t !== undefined && ts < actor.from_t) continue;
    if (actor.to_t !== undefined && ts > actor.to_t) continue;
    const state = evaluateCharacterState(actor, ts, sc.duration, globalT, BASE_W, FLOOR_Y, speechState);
    rawActiveChars.push({
      actor,
      state,
      z: resolveLayerZ(actor, 0),
      order: cIdx,
    });
  }
  resolveSceneInteractions(rawActiveChars, globalT, speechState);

  // Portrait output is a narrow crop of the 1920-wide authoring stage. A signpost label plate
  // that the camera pushes mostly outside that crop used to leave an unreadable coloured sliver
  // pinned to the frame edge (KI-012). Prune such labels per frame; the crop moves continuously,
  // so a static prop x cannot keep every label readable for a whole scene.
  const portraitCrop = viewport && viewport.width < BASE_W ? viewport : null;
  const safeProp = (prop) => pruneClippedSignpostLabels(prop, {
    zoom, focusX, panX, viewport: portraitCrop, baseW: BASE_W,
  });

  // 3. Synchronize physical prop anchors, parent switching, persistent moved coordinates, & door hinges
  const rawVisibleProps = [];
  const rawPropOrders = [];
  sc.props.forEach((prop, pIdx) => {
    if (prop.from_t !== undefined && ts < prop.from_t) return;
    if (prop.to_t !== undefined && ts > prop.to_t) return;
    rawVisibleProps.push(prop);
    rawPropOrders.push(pIdx);
  });
  const resolvedProps = resolveScenePropInteractions(
    rawVisibleProps,
    rawActiveChars,
    sc.characters,
    ts,
    sc.duration,
    BASE_W,
    FLOOR_Y
  );

  const activeProps = [];
  resolvedProps.forEach((prop, idx) => {
    activeProps.push({
      prop: safeProp(prop),
      z: resolveLayerZ(prop, -4),
      order: rawPropOrders[idx],
      splitOwners: [],
    });
  });

  // Match seated/podium characters with overlapping split-depth furniture (supports multi-actor cafe_table & judge_table!)
  if (!parchmentMode) {
    for (const cEntry of rawActiveChars) {
      let bestPropItem = null;
      let bestDx = Infinity;
      for (const pItem of activeProps) {
        if (!SPLIT_FURNITURE_TYPES.has(pItem.prop.type)) continue;
        const allowMulti = pItem.prop.type === 'cafe_table' || pItem.prop.type === 'judge_table';
        if (!allowMulti && pItem.splitOwners.length > 0) continue;
        if (Math.abs(pItem.z - cEntry.z) > 10) continue;
        const propX = (pItem.prop.x ?? 0.5) * BASE_W;
        const propS = pItem.prop.scale ?? 1.0;
        const dx = Math.abs(cEntry.state.x - propX);
        const isStandingBehindLectern = pItem.prop.type === 'podium' || pItem.prop.type === 'judge_table';
        const maxSnap = pItem.prop.type === 'cafe_table'
          ? 235 * propS
          : (isStandingBehindLectern ? 85 * propS : 155 * propS);
        if ((cEntry.state.seatedAtDesk || isStandingBehindLectern) && dx < maxSnap && dx < bestDx) {
          bestDx = dx;
          bestPropItem = pItem;
        }
      }
      if (bestPropItem) {
        bestPropItem.splitOwners.push(cEntry);
        cEntry.splitPropItem = bestPropItem;
        const bp = bestPropItem.prop;
        if (
          cEntry.state.seatedAtDesk &&
          (bp.type === 'desk' || bp.type === 'clean_desk' || bp.type === 'messy_desk')
        ) {
          const propX = (bp.x ?? 0.5) * BASE_W;
          const propS = bp.scale ?? 1.0;
          if (Math.abs(cEntry.state.x - propX) < 28 * propS) {
            const faceLeft = bp.facing === 'left';
            const chairOff = bp.type === 'desk' ? (bp.chair_offset ?? 82) : 52;
            const shiftX = (faceLeft ? chairOff : -chairOff) * propS - (cEntry.state.x - propX);
            cEntry.state.x += shiftX;
            cEntry.state.flip = faceLeft;
            if (cEntry.state.pose.fl) cEntry.state.pose.fl = [cEntry.state.pose.fl[0] + shiftX, cEntry.state.pose.fl[1]];
            if (cEntry.state.pose.fr) cEntry.state.pose.fr = [cEntry.state.pose.fr[0] + shiftX, cEntry.state.pose.fr[1]];
            if (cEntry.state.pose.hl) cEntry.state.pose.hl = [cEntry.state.pose.hl[0] + shiftX, cEntry.state.pose.hl[1]];
            if (cEntry.state.pose.hr) cEntry.state.pose.hr = [cEntry.state.pose.hr[0] + shiftX, cEntry.state.pose.hr[1]];
          }
        }
      }
    }
  }

  const renderQueue = [];
  const rawBoards = Array.isArray(sc.boards) && sc.boards.length > 0 ? sc.boards : (sc.board ? [sc.board] : []);
  const activeBoards = rawBoards.map((bd) => fitBoardToPortraitViewport(bd, frame, BASE_W));
  activeBoards.forEach((bd, bIdx) => {
    renderQueue.push({
      kind: 'board',
      board: bd,
      z: resolveLayerZ(bd, -18),
      order: bIdx,
    });
  });

  for (const pItem of activeProps) {
    if (pItem.splitOwners.length === 0) {
      renderQueue.push({
        kind: 'prop',
        prop: pItem.prop,
        z: pItem.z,
        order: 100 + pItem.order,
      });
    }
  }

  const emittedHugGroups = new Set();
  const emittedSplitProps = new Set();
  for (const cEntry of rawActiveChars) {
    if (cEntry.splitPropItem && !cEntry.state.hugGroupId) {
      const spItem = cEntry.splitPropItem;
      if (emittedSplitProps.has(spItem)) continue;
      emittedSplitProps.add(spItem);
      renderQueue.push({
        kind: 'split_group',
        prop: spItem.prop,
        members: spItem.splitOwners,
        z: Math.max(...spItem.splitOwners.map((m) => m.z)),
        order: 500 + cEntry.order,
      });
    } else if (cEntry.state.hugGroupId) {
      const gid = cEntry.state.hugGroupId;
      if (emittedHugGroups.has(gid)) continue;
      emittedHugGroups.add(gid);
      const members = rawActiveChars.filter((m) => m.state.hugGroupId === gid);
      renderQueue.push({
        kind: 'hug_group',
        members,
        z: Math.max(...members.map((m) => m.z)),
        order: 500 + cEntry.order,
      });
    } else {
      renderQueue.push({
        kind: 'char',
        entry: cEntry,
        z: cEntry.z,
        order: 500 + cEntry.order,
      });
    }
  }

  renderQueue.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.order - b.order));

  // 4. Execute Unified Depth-Sorted World Render Queue
  const KEY_PROP_OBSTACLE_TYPES = new Set([
    'phone', 'laptop', 'computer', 'cup', 'books', 'briefcase', 'treasure_chest',
  ]);
  for (const item of renderQueue) {
    if (item.kind === 'board') {
      ctx.save();
      ctx.setTransform(screenMatrix.a, screenMatrix.b, screenMatrix.c, screenMatrix.d, screenMatrix.e, screenMatrix.f);
      const portraitTransform = item.board._portraitTransform;
      if (portraitTransform) {
        ctx.translate(portraitTransform.translateX, portraitTransform.translateY);
        ctx.scale(portraitTransform.scale, portraitTransform.scale);
      }
      drawWorldBoard(ctx, item.board, ts, sc.duration, BASE_W, FLOOR_Y, activeLight);
      if (obstacles) {
        const bx = (item.board.x ?? 0.56) * BASE_W;
        const by = (item.board.y ?? 0.34) * BASE_H;
        const bw = item.board.width ?? 480;
        const bh = item.board.height ?? 270;
        obstacles.push({
          kind: 'text',
          ...projectWorldRectToScreen(ctx, bx - bw * 0.5, by - bh * 0.5, bx + bw * 0.5, by + bh * 0.5),
        });
      }
      ctx.restore();
    } else if (item.kind === 'prop') {
      drawWorldProp(ctx, item.prop, BASE_W, FLOOR_Y, globalT, activeLight, ts, 'full');
      if (obstacles && item.prop && !item.prop._attachedToActor && KEY_PROP_OBSTACLE_TYPES.has(item.prop.type)) {
        const anc = computePropAnchors(item.prop, BASE_W, FLOOR_Y);
        if (anc && anc.bounds) {
          obstacles.push({
            kind: 'prop',
            ...projectWorldRectToScreen(ctx, anc.bounds.left, anc.bounds.top, anc.bounds.right, anc.bounds.bottom),
          });
        }
      }
    } else if (item.kind === 'split_group') {
      // Multi-actor two-plane split-furniture occlusion: chairs behind -> all seated legs/torsos -> table/desk front -> heads & arms!
      drawWorldProp(ctx, item.prop, BASE_W, FLOOR_Y, globalT, activeLight, ts, 'back_only');
      for (const m of item.members) {
        renderCharacterPass(ctx, m, 'lower_and_torso', parchmentMode, activeLight, speechState, globalT);
      }
      drawWorldProp(ctx, item.prop, BASE_W, FLOOR_Y, globalT, activeLight, ts, 'front_only');
      for (const m of item.members) {
        const joints = renderCharacterPass(ctx, m, 'upper_front', parchmentMode, activeLight, speechState, globalT);
        drawHeldAccessoriesAndCallouts(ctx, m.state, joints, m.actor, activeLight, globalT, parchmentMode);
        recordCharacterScreenObstacles(ctx, joints, m.state, obstacles);
      }
    } else if (item.kind === 'hug_group') {
      // 3-pass interleaved embrace: back arms -> bodies & heads -> front arms wrapped across each other's backs!
      for (const m of item.members) {
        renderCharacterPass(ctx, m, 'back_arm_only', parchmentMode, activeLight, speechState, globalT);
      }
      const jointMap = new Map();
      for (const m of item.members) {
        const j = renderCharacterPass(ctx, m, 'body_no_front_arm', parchmentMode, activeLight, speechState, globalT);
        jointMap.set(m, j);
      }
      for (const m of item.members) {
        const jFront = renderCharacterPass(ctx, m, 'front_arm_only', parchmentMode, activeLight, speechState, globalT);
        const resolvedJoints = jFront || jointMap.get(m);
        drawHeldAccessoriesAndCallouts(ctx, m.state, resolvedJoints, m.actor, activeLight, globalT, parchmentMode);
        recordCharacterScreenObstacles(ctx, resolvedJoints, m.state, obstacles);
      }
    } else if (item.kind === 'char') {
      const cEntry = item.entry;
      const { actor, state } = cEntry;
      if (state.pushedBoulder) {
        drawWorldProp(
          ctx,
          {
            type: 'boulder',
            x: state.pushedBoulder.x,
            scale: state.pushedBoulder.scale,
            label: state.pushedBoulder.label,
          },
          BASE_W,
          FLOOR_Y,
          globalT,
          activeLight,
          ts,
          'full'
        );
      }

      if (cEntry.splitProp) {
        // Two-plane split-furniture occlusion: chair behind -> legs/torso -> desk front/top -> head & typing arms/hands!
        drawWorldProp(ctx, cEntry.splitProp, BASE_W, FLOOR_Y, globalT, activeLight, ts, 'back_only');
        renderCharacterPass(ctx, cEntry, 'lower_and_torso', parchmentMode, activeLight, speechState, globalT);
        drawWorldProp(ctx, cEntry.splitProp, BASE_W, FLOOR_Y, globalT, activeLight, ts, 'front_only');
        const joints = renderCharacterPass(ctx, cEntry, 'upper_front', parchmentMode, activeLight, speechState, globalT);
        drawHeldAccessoriesAndCallouts(ctx, state, joints, actor, activeLight, globalT, parchmentMode);
        recordCharacterScreenObstacles(ctx, joints, state, obstacles);
      } else {
        const joints = renderCharacterPass(ctx, cEntry, 'full', parchmentMode, activeLight, speechState, globalT);
        drawHeldAccessoriesAndCallouts(ctx, state, joints, actor, activeLight, globalT, parchmentMode);
        recordCharacterScreenObstacles(ctx, joints, state, obstacles);
      }
    }
  }

  // 5. Optional 2.5D foreground parallax silhouettes
  if (sc.foreground) {
    if (parchmentMode) {
      drawParchmentForeground(ctx, sc.foreground, globalT, FLOOR_Y);
    } else {
      drawForegroundLayer(ctx, sc.foreground, BASE_W, BASE_H, FLOOR_Y, globalT, panX);
    }
  }

  ctx.restore();

  // Screen-space Split-Screen center divider rule
  if (sc.splitScreen) {
    const ss = sc.splitScreen;
    const sFrom = ss.from_t !== undefined ? Number(ss.from_t) : 0.0;
    const sTo = ss.to_t !== undefined ? Number(ss.to_t) : sc.duration + 1.0;
    if (ts >= sFrom && ts <= sTo + 0.8) {
      const fadeOut = sTo < sc.duration ? ease(clamp(((sTo + 0.8) - ts) / 0.85)) : 1.0;
      if (fadeOut > 0.01) {
        ctx.save();
        ctx.globalAlpha = fadeOut;
        drawSoftGlow(ctx, frame.centerX, BASE_H * 0.45, 45, '#94a3b8', 0.25);
        ctx.fillStyle = 'rgba(226, 232, 240, 0.82)';
        ctx.fillRect(frame.centerX - 2, 0, 4, BASE_H);
        if (ss.left_label || ss.right_label) {
          ctx.font = 'bold 17px PopB';
          ctx.textBaseline = 'middle';
          if (ss.left_label) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
            ctx.textAlign = 'left';
            ctx.fillText(ss.left_label, frame.left + 38, 42, Math.max(1, frame.width * 0.42));
          }
          if (ss.right_label) {
            ctx.fillStyle = 'rgba(252, 165, 165, 0.78)';
            ctx.textAlign = 'right';
            ctx.fillText(ss.right_label, frame.right - 38, 42, Math.max(1, frame.width * 0.42));
          }
        }
        ctx.restore();
      }
    }
  }

  // Optional warm golden memory flashback wash
  if (Array.isArray(sc.flashbackWindow) && sc.flashbackWindow.length === 2) {
    const [fb0, fb1] = sc.flashbackWindow;
    if (ts >= fb0 - 0.5 && ts <= fb1 + 0.5) {
      const fIn = ease(clamp((ts - (fb0 - 0.5)) / 0.65));
      const fOut = ease(clamp(((fb1 + 0.5) - ts) / 0.65));
      const fbAlpha = Math.min(fIn, fOut);
      if (fbAlpha > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(251, 191, 36, ${ca(0.16 * fbAlpha)})`;
        ctx.fillRect(0, 0, BASE_W, BASE_H);
        const vg = ctx.createRadialGradient(BASE_W * 0.5, BASE_H * 0.5, BASE_W * 0.26, BASE_W * 0.5, BASE_H * 0.5, BASE_W * 0.62);
        vg.addColorStop(0, 'rgba(251, 191, 36, 0.000)');
        vg.addColorStop(1, `rgba(120, 53, 15, ${ca(0.38 * fbAlpha)})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, BASE_W, BASE_H);
        ctx.restore();
      }
    }
  }

  // Optional voiced Final End Card logo & subtitle on pure black
  if (sc.endCard) {
    const ec = sc.endCard;
    const enter = eo(clamp((ts - (ec.start_at ?? 0.25)) / 1.0));
    if (enter > 0.01) {
      ctx.save();
      ctx.globalAlpha = enter;
      const cx = frame.centerX;
      const cy = BASE_H * 0.44;
      const maxCardTextW = Math.max(160, frame.width - 72);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy - 86, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy - 78); ctx.lineTo(cx, cy - 95); ctx.lineTo(cx + 15, cy - 78);
      ctx.moveTo(cx - 10, cy - 68); ctx.lineTo(cx, cy - 80); ctx.lineTo(cx + 10, cy - 68);
      ctx.stroke();

      fitCanvasFont(ctx, String(ec.logo_text || 'THE GROWTH PROTOCOL'), {
        family: 'PopB', baseSize: 46, minSize: 20, maxWidth: maxCardTextW,
      });
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ec.logo_text || 'THE GROWTH PROTOCOL'), cx, cy - 8, maxCardTextW);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 180, cy + 28);
      ctx.lineTo(cx + 180, cy + 28);
      ctx.stroke();

      fitCanvasFont(ctx, String(ec.tagline || 'BUILD DISCIPLINE. BECOME BETTER.'), {
        family: 'PopB', baseSize: 23, minSize: 12, maxWidth: maxCardTextW,
      });
      ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(ec.tagline || 'BUILD DISCIPLINE. BECOME BETTER.'), cx, cy + 62, maxCardTextW);
      ctx.restore();
    }
  }

  if (sc.chapter) {
    if (parchmentMode) {
      drawParchmentHeadline(ctx, sc.chapter, ts, frame);
    } else if (renderMeta && renderMeta.deferSubtitlesToScreen) {
      renderMeta.pendingChapter = {
        title: sc.chapter,
        ts,
        accentColor: activeLight,
        channelName: episode.channelName,
      };
    } else {
      drawChapterRibbon(ctx, sc.chapter, ts, activeLight, episode.channelName, frame);
    }
  }

  // Screen-space story captions. These are PROPS in the spec but must not live in world space:
  // a camera zoom would drag them off-frame and clip the text. Drawn after the camera restore,
  // before subtitles, so a caption always outranks the line art underneath it.
  if (parchmentMode) {
    drawScreenCaptionPass(ctx, sc, ts);
  }

  if (parchmentMode) {
    drawParchmentSubtitle(ctx, sc.subtitles, ts, episode.subtitlesMode, frame);
  } else if (renderMeta && renderMeta.deferSubtitlesToScreen) {
    renderMeta.pendingSubtitle = {
      subtitles: sc.subtitles,
      ts,
      accentColor: activeLight,
      mode: episode.subtitlesMode,
    };
  } else {
    drawCinemaSubtitle(ctx, sc.subtitles, ts, activeLight, episode.subtitlesMode, frame);
  }

  if (sc.intertitle && ts >= (sc.intertitle.start_at ?? 0)) {
    if (parchmentMode) {
      drawParchmentIntertitle(ctx, sc.intertitle, ts, frame);
    } else {
      const iu = ease(clamp((ts - (sc.intertitle.start_at ?? 0)) / 0.85));
      ctx.save();
      ctx.fillStyle = `rgba(4, 7, 14, ${ca(iu * (sc.intertitle.backdrop_alpha ?? 0.92))})`;
      ctx.fillRect(-1200, -1200, BASE_W + 2400, BASE_H + 2400);
      ctx.globalAlpha = iu;
      const lines = sc.intertitle.lines || [];
      const lh = 56;
      const y0 = BASE_H * 0.5 - ((lines.length - 1) * lh) * 0.5;
      const maxTitleW = Math.max(160, frame.width - 72);
      lines.forEach((ln, idx) => {
        fitCanvasFont(ctx, String(ln), {
          family: 'PopB', baseSize: idx === lines.length - 1 && lines.length > 1 ? 38 : 34,
          minSize: 18, maxWidth: maxTitleW,
        });
        ctx.fillStyle = idx === lines.length - 1 && sc.intertitle.accent_color ? sc.intertitle.accent_color : '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ln), frame.centerX, y0 + idx * lh, maxTitleW);
      });
      ctx.restore();
    }
  }

  if (sc.windBlackoutAt !== null && sc.windBlackoutAt !== undefined && ts >= sc.windBlackoutAt) {
    const wu = ease(clamp((ts - sc.windBlackoutAt) / Math.max(0.25, sc.duration - sc.windBlackoutAt)));
    ctx.save();
    const rMax = Math.hypot(BASE_W, BASE_H) * 2.2;
    const rad = lerp(60, rMax, wu);
    ctx.fillStyle = '#03050a';
    ctx.beginPath();
    ctx.arc(BASE_W * 0.56, BASE_H * 0.52, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const prevSc = sc.index > 0 ? episode.scenes[sc.index - 1] : null;
  const nextSc = sc.index < episode.scenes.length - 1 ? episode.scenes[sc.index + 1] : null;
  const envChangedFromPrev = !prevSc || prevSc.settingSignature !== sc.settingSignature;
  const envChangesToNext = !nextSc || nextSc.settingSignature !== sc.settingSignature;
  const transRgb = parchmentMode ? '243, 229, 202' : '5, 8, 16';

  if (renderMeta) {
    renderMeta.postOverlays = {
      cutToBlack: Boolean(sc.cutToBlackAt !== null && sc.cutToBlackAt !== undefined && ts >= sc.cutToBlackAt),
      fadeToBlackAlpha: sc.fadeToBlack && sc.duration - ts < 1.8 ? 1 - ease((sc.duration - ts) / 1.8) : 0,
      fadeToBlackRgb: parchmentMode ? '235, 218, 188' : '0, 0, 0',
      transAlpha: envChangedFromPrev && ts < 0.32
        ? (1 - ease(ts / 0.32)) * (sc.index === 0 ? 0.85 : 0.48)
        : (envChangesToNext && sc.duration - ts < 0.28 ? (1 - ease((sc.duration - ts) / 0.28)) * 0.48 : 0),
      transRgb,
    };
  } else {
    if (sc.cutToBlackAt !== null && sc.cutToBlackAt !== undefined && ts >= sc.cutToBlackAt) {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.restore();
    }
    if (sc.fadeToBlack && sc.duration - ts < 1.8) {
      const f = 1 - ease((sc.duration - ts) / 1.8);
      ctx.fillStyle = parchmentMode ? `rgba(235, 218, 188, ${ca(f)})` : `rgba(0, 0, 0, ${ca(f)})`;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
    if (envChangedFromPrev && ts < 0.32) {
      const fade = 1 - ease(ts / 0.32);
      ctx.fillStyle = `rgba(${transRgb}, ${ca(fade * (sc.index === 0 ? 0.85 : 0.48))})`;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    } else if (envChangesToNext && sc.duration - ts < 0.28) {
      const fade = 1 - ease((sc.duration - ts) / 0.28);
      ctx.fillStyle = `rgba(${transRgb}, ${ca(fade * 0.48)})`;
      ctx.fillRect(0, 0, BASE_W, BASE_H);
    }
  }
}

function drawNativeScreenChapterRibbon(g, outW, outH, pendingChapter, obstacles = []) {
  if (!pendingChapter || !pendingChapter.title || pendingChapter.ts > 4.2) return null;
  const { title: rawTitle, ts, accentColor, channelName } = pendingChapter;
  const enter = eo(clamp(ts / 0.45));
  const exit = ts > 3.5 ? 1 - ease(clamp((ts - 3.5) / 0.7)) : 1;
  const vis = enter * exit;
  if (vis <= 0.01) return null;

  const layout = getLayoutConfig(outW, outH);
  const s = layout.scale;
  const title = String(rawTitle).toUpperCase();
  const channel = String(channelName || '').toUpperCase();
  const hasChannel = Boolean(channel.trim());
  const maxTextW = Math.max(120 * s, (layout.headerSafeRegion.right - layout.headerSafeRegion.left) - 64 * s);

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const titleSize = fitCanvasFont(g, title, {
    family: 'PopB',
    baseSize: Math.max(14, Math.round(23 * s)),
    minSize: Math.max(11, Math.round(14 * s)),
    maxWidth: maxTextW,
  });
  const titleW = g.measureText(title).width;
  let subW = 0;
  let subSize = Math.max(9, Math.round(13 * s));
  if (hasChannel) {
    subSize = fitCanvasFont(g, channel, {
      family: 'PopR',
      weight: '600',
      baseSize: subSize,
      minSize: Math.max(8, Math.round(10 * s)),
      maxWidth: maxTextW,
    });
    subW = g.measureText(channel).width;
  }

  const boxW = Math.min(
    layout.headerSafeRegion.right - layout.headerSafeRegion.left,
    Math.max(titleW, subW) + 50 * s
  );
  const boxH = (hasChannel ? 66 : 48) * s;
  const x = lerp(-boxW * 0.4, layout.headerSafeRegion.left, enter);
  const y = layout.headerSafeRegion.top;

  g.globalAlpha = vis;
  g.fillStyle = 'rgba(8, 12, 22, 0.88)';
  g.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  g.lineWidth = Math.max(1, 1.5 * s);
  g.beginPath();
  g.roundRect(x, y, boxW, boxH, 11 * s);
  g.fill();
  g.stroke();

  g.fillStyle = accentColor || '#cbd5e1';
  g.beginPath();
  g.roundRect(x, y, 6.5 * s, boxH, [11 * s, 0, 0, 11 * s]);
  g.fill();

  if (hasChannel) {
    g.font = `600 ${subSize}px PopR`;
    g.fillStyle = accentColor || '#cbd5e1';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(channel, x + 20 * s, y + 11 * s, Math.max(1, boxW - 30 * s));

    g.font = `bold ${titleSize}px PopB`;
    g.fillStyle = '#f8fafc';
    g.fillText(title, x + 20 * s, y + 30 * s, Math.max(1, boxW - 30 * s));
  } else {
    g.font = `bold ${titleSize}px PopB`;
    g.fillStyle = '#f8fafc';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(title, x + 20 * s, y + boxH * 0.5 + 1 * s, Math.max(1, boxW - 30 * s));
  }
  g.restore();

  const rect = { left: x, top: y, right: x + boxW, bottom: y + boxH };
  if (Array.isArray(obstacles)) {
    obstacles.push({ kind: 'text', ...rect });
  }
  return rect;
}

function drawNativeScreenSubtitle(g, outW, outH, pending, obstacles = []) {
  if (!pending || pending.mode === 'off' || !Array.isArray(pending.subtitles) || pending.subtitles.length === 0) {
    return null;
  }
  const { subtitles, ts, accentColor } = pending;
  let active = null;
  for (const sub of subtitles) {
    if (ts >= sub.start && ts <= sub.end) {
      active = sub;
      break;
    }
  }
  if (!active) return null;

  const fadeIn = clamp((ts - active.start) / 0.10);
  const fadeOut = clamp((active.end - ts) / 0.11);
  const alpha = Math.min(fadeIn, fadeOut);
  if (alpha <= 0.02) return null;

  const layout = getLayoutConfig(outW, outH);
  const tokensForMeasure = active.tokens.map((tok) => ({
    ...tok,
    word: tok.isSpeakerLabel ? `${tok.raw} ` : tok.raw,
  }));
  const placement = measureAndPlaceSubtitle(g, tokensForMeasure, layout, obstacles, outW * 0.5);
  if (!placement) return null;

  const s = layout.scale;
  const baseAccentRgb = hexToRgb(accentColor || '#cbd5e1');
  const brightAccentCss = rgbCss(mixRgb(baseAccentRgb, [255, 255, 255], 0.32));

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = alpha;
  g.font = `500 ${placement.fontSize}px PopR`;
  g.textBaseline = 'middle';

  // Soft diffused ambient dark vignette behind borderless cinema text (zero visible box or pill border!)
  const softReadability = g.createRadialGradient(
    placement.centerX,
    placement.centerY,
    8 * s,
    placement.centerX,
    placement.centerY,
    Math.max(placement.boxW * 0.65, 180 * s)
  );
  softReadability.addColorStop(0, 'rgba(4, 6, 11, 0.42)');
  softReadability.addColorStop(0.65, 'rgba(4, 6, 11, 0.16)');
  softReadability.addColorStop(1, 'rgba(4, 6, 11, 0.00)');
  g.fillStyle = softReadability;
  g.fillRect(
    placement.boxX - 40 * s,
    placement.boxY - 24 * s,
    placement.boxW + 80 * s,
    placement.boxH + 48 * s
  );

  let globalActiveLine = -1;
  let globalActiveIdx = -1;
  let globalStrength = 0;

  placement.lines.forEach((line, lIdx) => {
    line.items.forEach((it, idx) => {
      if (it.isSpeakerLabel || it.tStart === undefined || it.tEnd === undefined) return;
      if (ts >= it.tStart - 0.025 && ts <= it.tEnd + 0.03) {
        const span = Math.max(0.06, it.tEnd - it.tStart);
        const atk = clamp((ts - (it.tStart - 0.025)) / Math.min(0.055, span * 0.45));
        const rel = clamp(((it.tEnd + 0.03) - ts) / Math.min(0.06, span * 0.50));
        const str = Math.min(atk, rel);
        if (str >= globalStrength) {
          globalStrength = str;
          globalActiveLine = lIdx;
          globalActiveIdx = idx;
        }
      }
    });
  });

  g.textAlign = 'left';
  placement.lines.forEach((line, lIdx) => {
    let x = placement.centerX - line.width * 0.5;
    const y = placement.centerY - ((placement.lines.length - 1) * placement.lineHeight) * 0.5 + lIdx * placement.lineHeight + 1 * s;

    line.items.forEach((it, idx) => {
      const isSpokenNow = lIdx === globalActiveLine && idx === globalActiveIdx && globalStrength > 0.04;

      if (it.isSpeakerLabel) {
        g.save();
        g.fillStyle = 'rgba(0, 0, 0, 0.85)';
        g.fillText(it.raw, x + 1.2 * s, y + 1.8 * s);
        g.fillStyle = brightAccentCss;
        g.fillText(it.raw, x, y);
        g.restore();
      } else {
        // Minimalist borderless cinema subtitles: crisp white normal words + warm sand-gold accent words (#dfba78)
        const liftY = isSpokenNow ? (-0.8 * s * globalStrength) : 0;
        const wordColor = it.highlight
          ? (isSpokenNow ? '#ebd098' : '#dfba78')
          : (isSpokenNow ? '#ffffff' : '#f4f7fb');
        g.save();
        if (it.highlight && isSpokenNow) {
          drawSoftGlow(g, x + it.width * 0.5, y + liftY, Math.max(28 * s, it.width * 0.62), '#dfba78', 0.16 * globalStrength);
        }
        // Crisp 2-layer dark cinema drop-shadow for effortless borderless legibility
        g.fillStyle = 'rgba(0, 0, 0, 0.88)';
        g.fillText(it.raw, x + 1.4 * s, y + liftY + 2.0 * s);
        g.fillStyle = 'rgba(0, 0, 0, 0.46)';
        g.fillText(it.raw, x, y + liftY + 0.8 * s);
        g.fillStyle = wordColor;
        g.fillText(it.raw, x, y + liftY);
        g.restore();
      }

      x += it.width + (idx < line.items.length - 1 ? placement.spaceW : 0);
    });
  });

  g.restore();
  return placement;
}

function gTextCenter(ctx, txt, x, y) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, x, y);
}

function clearContext(ctx, width, height, color = '#07090e') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function applyNativePostOverlays(ctx, width, height, postOverlays) {
  if (!postOverlays) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (postOverlays.cutToBlack) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  if (postOverlays.fadeToBlackAlpha > 0.001) {
    ctx.fillStyle = `rgba(${postOverlays.fadeToBlackRgb}, ${ca(postOverlays.fadeToBlackAlpha)})`;
    ctx.fillRect(0, 0, width, height);
  }
  if (postOverlays.transAlpha > 0.001) {
    ctx.fillStyle = `rgba(${postOverlays.transRgb}, ${ca(postOverlays.transAlpha)})`;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function renderEpisodeFrame(ctx, outW, outH, episode, frameIdx) {
  if (!Number.isFinite(outW) || !Number.isFinite(outH) || outW <= 0 || outH <= 0) {
    throw new RangeError(`Invalid output dimensions: ${outW}x${outH}`);
  }
  const width = Math.round(outW);
  const height = Math.round(outH);
  clearContext(ctx, width, height, '#07090e');

  const renderMeta = {
    outW: width,
    outH: height,
    isPortrait: height > width,
    screenObstacles: [],
    deferSubtitlesToScreen: true,
    pendingChapter: null,
    pendingSubtitle: null,
    postOverlays: null,
  };

  if (height > width) {
    const viewport = computePortraitViewport(episode, frameIdx, width, height, {
      baseWidth: BASE_W,
      baseHeight: BASE_H,
      floorY: FLOOR_Y,
      findSceneAtFrame,
      evaluateSceneCamera,
      evaluateSceneSpeechState,
    });
    const hit = findSceneAtFrame(episode, frameIdx);
    if (hit.type === 'scene' && isParchmentScene(hit.scene)) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(getParchmentBackdrop(width, height), 0, 0);
      ctx.restore();
    } else {
      renderNearBlackBackground(ctx, width, height, Math.round(height * 0.742));
    }

    // Native full-bleed vector projection onto 9:16 canvas (zero bitmap crop, zero blur bars)
    const stageScale = width / Math.max(1, viewport.width);
    const targetFloorScreenY = Math.round(height * 0.742);
    const stageOffsetX = -stageScale * viewport.left;
    const stageOffsetY = targetFloorScreenY - stageScale * FLOOR_Y;

    ctx.save();
    ctx.setTransform(stageScale, 0, 0, stageScale, stageOffsetX, stageOffsetY);
    renderBaseEpisodeFrame(ctx, episode, frameIdx, viewport, viewport.cameraZoomScale || 1, renderMeta);
    ctx.restore();

    drawNativeScreenChapterRibbon(ctx, width, height, renderMeta.pendingChapter, renderMeta.screenObstacles);
    const subtitleLayout = drawNativeScreenSubtitle(ctx, width, height, renderMeta.pendingSubtitle, renderMeta.screenObstacles);
    applyNativePostOverlays(ctx, width, height, renderMeta.postOverlays);
    return {
      orientation: 'portrait',
      width,
      height,
      viewport,
      subtitleLayout,
      screenObstacles: renderMeta.screenObstacles,
    };
  }

  const landscape = containRect(BASE_W, BASE_H, width, height);
  const cameraZoomScale = computeLandscapePropZoomScale(episode, frameIdx, {
    baseWidth: BASE_W,
    floorY: FLOOR_Y,
    findSceneAtFrame,
    evaluateSceneCamera,
    evaluateSceneSpeechState,
  });
  ctx.save();
  ctx.setTransform(landscape.scale, 0, 0, landscape.scale, landscape.x, landscape.y);
  renderBaseEpisodeFrame(ctx, episode, frameIdx, DEFAULT_SCREEN_VIEWPORT, cameraZoomScale, renderMeta);
  ctx.restore();

  drawNativeScreenChapterRibbon(ctx, width, height, renderMeta.pendingChapter, renderMeta.screenObstacles);
  const subtitleLayout = drawNativeScreenSubtitle(ctx, width, height, renderMeta.pendingSubtitle, renderMeta.screenObstacles);
  applyNativePostOverlays(ctx, width, height, renderMeta.postOverlays);
  return {
    orientation: 'landscape',
    width,
    height,
    ...landscape,
    subtitleLayout,
    screenObstacles: renderMeta.screenObstacles,
  };
}

async function renderVideoSegment({
  episode,
  outputPath,
  ffmpegBin = 'ffmpeg',
  width = 1920,
  height = 1080,
  startFrame = 0,
  endFrame = null,
  crf = 17,
  preset = 'fast',
  onProgress = null,
}) {
  registerFonts();
  const finalEnd = endFrame !== null ? Math.min(episode.totalFrames, endFrame) : episode.totalFrames;
  const totalToRender = Math.max(1, finalEnd - startFrame);

  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.quality = 'best';
  ctx.patternQuality = 'best';

  const args = [
    '-y',
    '-f', 'rawvideo',
    '-pix_fmt', rawPixelFormat,
    '-s', `${width}x${height}`,
    '-r', String(episode.fps),
    '-i', 'pipe:0',
    '-an',
    '-c:v', 'libx264',
    '-preset', preset,
    '-tune', 'animation',
    '-crf', String(crf),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];

  const ff = spawn(ffmpegBin, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderrTail = '';
  ff.stderr.on('data', (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2400);
  });

  const closed = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail}`));
    });
  });

  const t0 = Date.now();
  for (let f = startFrame; f < finalEnd; f++) {
    renderEpisodeFrame(ctx, width, height, episode, f);
    const raw = rawFrameBytes(canvas);
    if (!ff.stdin.write(raw)) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }
    const done = f - startFrame + 1;
    if (onProgress && (done % 60 === 0 || done === totalToRender)) {
      const elapsed = Math.max(0.001, (Date.now() - t0) / 1000);
      onProgress({
        done,
        total: totalToRender,
        fps: +(done / elapsed).toFixed(1),
      });
    }
  }

  ff.stdin.end();
  await closed;
  return { outputPath, framesRendered: totalToRender };
}

function renderSceneStills({ episode, outDir, width = 1920, height = 1080, sceneLimit = 12 }) {
  registerFonts();
  fs.mkdirSync(outDir, { recursive: true });
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.quality = 'best';
  ctx.patternQuality = 'best';

  const scenes = episode.scenes;
  const picked = [];
  if (scenes.length <= sceneLimit || sceneLimit <= 1) {
    picked.push(...(sceneLimit <= 1 ? scenes.slice(0, 1) : scenes));
  } else {
    for (let i = 0; i < sceneLimit; i++) {
      const idx = Math.min(scenes.length - 1, Math.round((i * (scenes.length - 1)) / (sceneLimit - 1)));
      picked.push(scenes[idx]);
    }
  }

  const paths = [];
  for (const sc of picked) {
    const midFrame = sc.startFrame + Math.floor((sc.endFrame - sc.startFrame) * 0.58);
    setFrame(width, height);
    renderEpisodeFrame(ctx, width, height, episode, midFrame);
    const outPath = path.join(outDir, `${sc.id}_${sc.environment}.png`);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    paths.push({ sceneId: sc.id, environment: sc.environment, frame: midFrame, path: outPath });
  }
  return paths;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const getArg = (flag, def = null) => {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : def;
  };

  const mode = getArg('--mode', 'render');
  const epPath = getArg('--episode');
  if (!epPath) {
    console.error('Usage: node engine/video_renderer.js --episode <file.json> [--mode render|stills|inspect]');
    process.exit(1);
  }

  const spec = JSON.parse(fs.readFileSync(epPath, 'utf8'));
  const width = Number(getArg('--width', '1920'));
  const height = Number(getArg('--height', '1080'));
  const subtitlesMode = getArg('--subtitles', null);
  const episode = compileEpisode(spec, { width, height, subtitlesMode });

  if (mode === 'inspect') {
    console.log(
      JSON.stringify(
        {
          title: episode.title,
          totalDuration: episode.totalDuration,
          totalFrames: episode.totalFrames,
          sceneCount: episode.scenes.length,
          castCount: Object.keys(episode.cast).length,
          chapters: episode.chapters,
          soundEventsCount: episode.soundEvents.length,
          warnings: episode.warnings,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (mode === 'stills') {
    const outDir = getArg('--out-dir', path.join(process.cwd(), 'output', 'stills'));
    const limit = Number(getArg('--limit', '12'));
    const written = renderSceneStills({ episode, outDir, width, height, sceneLimit: limit });
    console.log(JSON.stringify({ count: written.length, stills: written }, null, 2));
    process.exit(0);
  }

  const outputPath = getArg('--out', path.join(process.cwd(), 'output', 'video_silent.mp4'));
  const ffmpegBin = getArg('--ffmpeg', 'ffmpeg');
  const startFrame = Number(getArg('--start-frame', '0'));
  const endFrameRaw = getArg('--end-frame', null);
  const endFrame = endFrameRaw !== null ? Number(endFrameRaw) : null;
  const crf = Number(getArg('--crf', '17'));
  const preset = getArg('--preset', 'fast');

  renderVideoSegment({
    episode,
    outputPath,
    ffmpegBin,
    width,
    height,
    startFrame,
    endFrame,
    crf,
    preset,
    onProgress: (p) => {
      process.stderr.write(`[render] ${p.done}/${p.total} frames (${p.fps} fps)\n`);
    },
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  setFrame,
  BASE_W,
  BASE_H,
  pruneClippedSignpostLabels,
  renderEpisodeFrame,
  renderVideoSegment,
  renderSceneStills,
};
