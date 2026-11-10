'use strict';

/**
 * Authoritative Video Format Policy, Aspect-Specific Safe Regions (16:9 & 9:16),
 * Text Measurement, Balanced Line Wrapping, and Collision-Aware Subtitle Layout Engine.
 */

const BASE_W = 1920;
const BASE_H = 1080;
const FORMAT_DURATION_BOUNDARY_SEC = 60.0;

const DEFAULT_SCREEN_VIEWPORT = Object.freeze({
  left: 0,
  width: BASE_W,
  centerX: BASE_W * 0.5,
  right: BASE_W,
});

const CANONICAL_LAYOUT_16_9 = Object.freeze({
  format: '16:9',
  orientation: 'landscape',
  canonicalWidth: 1920,
  canonicalHeight: 1080,
  margins: Object.freeze({ left: 72, right: 72, top: 48, bottom: 42 }),
  headerSafeRegion: Object.freeze({ left: 72, top: 44, right: 1848, bottom: 108 }),
  animationSafeRegion: Object.freeze({ left: 96, top: 108, right: 1824, bottom: 862 }),
  objectVisibilityRegion: Object.freeze({ left: 120, top: 132, right: 1800, bottom: 862 }),
  subtitleSafeRegion: Object.freeze({ left: 240, top: 882, right: 1680, bottom: 1038, defaultCenterY: 954 }),
  subtitleFallbackCentersY: Object.freeze([954, 976, 926, 168, 214]),
  subtitleStyle: Object.freeze({
    fontSize: 28,
    lineHeight: 40,
    maxLineWidth: 1240,
    maxLines: 3,
    padX: 28,
    padY: 14,
    radius: 14,
  }),
});

const CANONICAL_LAYOUT_9_16 = Object.freeze({
  format: '9:16',
  orientation: 'portrait',
  canonicalWidth: 1080,
  canonicalHeight: 1920,
  margins: Object.freeze({ left: 56, right: 56, top: 96, bottom: 128 }),
  headerSafeRegion: Object.freeze({ left: 56, top: 96, right: 1024, bottom: 188 }),
  animationSafeRegion: Object.freeze({ left: 68, top: 240, right: 1012, bottom: 1465 }),
  objectVisibilityRegion: Object.freeze({ left: 84, top: 300, right: 996, bottom: 1455 }),
  subtitleSafeRegion: Object.freeze({ left: 64, top: 1490, right: 1016, bottom: 1786, defaultCenterY: 1618 }),
  subtitleFallbackCentersY: Object.freeze([1618, 1668, 1564, 264, 326]),
  subtitleStyle: Object.freeze({
    fontSize: 38,
    lineHeight: 52,
    maxLineWidth: 880,
    maxLines: 3,
    padX: 30,
    padY: 16,
    radius: 16,
  }),
});

/**
 * Automatic Video Format & Duration Policy:
 *  - `< 60.0s` (`00:59` or less)  -> Portrait `9:16` (`1080 x 1920`) for YouTube Shorts
 *  - `>= 60.0s` (`01:00` or longer) -> Landscape `16:9` (`1920 x 1080`) for YouTube Long-Form
 *  - Explicit user format override is respected and explicitly reported.
 */
function selectVideoFormatForDuration(durationSec, opts = {}) {
  const dur = Number.isFinite(Number(durationSec)) ? Math.max(0, Number(durationSec)) : 0;
  const autoIsPortrait = dur < FORMAT_DURATION_BOUNDARY_SEC;
  const autoFormat = autoIsPortrait ? '9:16' : '16:9';

  let explicit = opts.explicitFormat || opts.explicitAspect || opts.overrideFormat || null;
  if (explicit === 'portrait') explicit = '9:16';
  if (explicit === 'landscape') explicit = '16:9';
  if (explicit !== '9:16' && explicit !== '16:9') explicit = null;

  const chosen = explicit || autoFormat;
  const isPortrait = chosen === '9:16';
  const draft = Boolean(opts.draft);
  const width = isPortrait ? (draft ? 540 : 1080) : (draft ? 960 : 1920);
  const height = isPortrait ? (draft ? 960 : 1920) : (draft ? 540 : 1080);
  const overridden = Boolean(explicit && explicit !== autoFormat);

  return {
    format: chosen,
    aspect: chosen,
    aspectRatio: chosen,
    orientation: isPortrait ? 'portrait' : 'landscape',
    width,
    height,
    masterResolution: isPortrait ? [1080, 1920] : [1920, 1080],
    platform: isPortrait ? 'youtube_shorts' : 'youtube_long_form',
    durationSec: +dur.toFixed(3),
    boundarySec: FORMAT_DURATION_BOUNDARY_SEC,
    autoRecommendedFormat: autoFormat,
    recommendedAspect: autoFormat,
    policyApplied: explicit
      ? 'explicit_override'
      : (isPortrait ? 'auto_duration_under_60s' : 'auto_duration_60s_or_longer'),
    overridden,
    overrideNotice: overridden
      ? `Explicit format ${chosen} overrides automatic duration policy (${autoFormat} for ${dur.toFixed(1)}s).`
      : null,
  };
}

function scaleRect(rect, sx, sy) {
  const out = {
    left: rect.left * sx,
    top: rect.top * sy,
    right: rect.right * sx,
    bottom: rect.bottom * sy,
  };
  if (rect.defaultCenterY !== undefined) out.defaultCenterY = rect.defaultCenterY * sy;
  return out;
}

function getLayoutConfig(width = 1920, height = 1080) {
  const isPortrait = height > width;
  const base = isPortrait ? CANONICAL_LAYOUT_9_16 : CANONICAL_LAYOUT_16_9;
  const sx = width / base.canonicalWidth;
  const sy = height / base.canonicalHeight;
  const s = Math.min(sx, sy);

  return {
    format: base.format,
    orientation: base.orientation,
    width,
    height,
    scaleX: sx,
    scaleY: sy,
    scale: s,
    margins: {
      left: base.margins.left * sx,
      right: base.margins.right * sx,
      top: base.margins.top * sy,
      bottom: base.margins.bottom * sy,
    },
    headerSafeRegion: scaleRect(base.headerSafeRegion, sx, sy),
    animationSafeRegion: scaleRect(base.animationSafeRegion, sx, sy),
    objectVisibilityRegion: scaleRect(base.objectVisibilityRegion, sx, sy),
    subtitleSafeRegion: scaleRect(base.subtitleSafeRegion, sx, sy),
    subtitleFallbackCentersY: base.subtitleFallbackCentersY.map((cy) => cy * sy),
    subtitleStyle: {
      fontSize: Math.max(12, Math.round(base.subtitleStyle.fontSize * s)),
      lineHeight: base.subtitleStyle.lineHeight * s,
      maxLineWidth: Math.min(
        base.subtitleStyle.maxLineWidth * sx,
        width - (base.margins.left + base.margins.right) * sx - base.subtitleStyle.padX * 2 * sx
      ),
      maxLines: base.subtitleStyle.maxLines,
      padX: base.subtitleStyle.padX * sx,
      padY: base.subtitleStyle.padY * sy,
      radius: base.subtitleStyle.radius * s,
    },
  };
}

function normalizeScreenViewport(viewport = DEFAULT_SCREEN_VIEWPORT, stageWidth = BASE_W) {
  const left = Number.isFinite(Number(viewport.left)) ? Number(viewport.left) : 0;
  const width = Number.isFinite(Number(viewport.width))
    ? Math.max(1, Math.min(stageWidth, Number(viewport.width)))
    : stageWidth;
  return { left, width, centerX: left + width * 0.5, right: left + width };
}

function containRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    scale,
    x: (targetWidth - width) * 0.5,
    y: (targetHeight - height) * 0.5,
    width,
    height,
  };
}

function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    scale,
    x: (targetWidth - width) * 0.5,
    y: (targetHeight - height) * 0.5,
    width,
    height,
  };
}

function fitCanvasFont(ctx, text, {
  family = 'PopB',
  weight = 'bold',
  baseSize = 30,
  minSize = 14,
  maxWidth = BASE_W,
} = {}) {
  let size = baseSize;
  const label = String(text || '');
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(label).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

function wrapWordsByWidth(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rectIntersectionArea(a, b, pad = 0) {
  if (!a || !b) return 0;
  const ix0 = Math.max(a.left - pad, b.left);
  const iy0 = Math.max(a.top - pad, b.top);
  const ix1 = Math.min(a.right + pad, b.right);
  const iy1 = Math.min(a.bottom + pad, b.bottom);
  if (ix1 <= ix0 || iy1 <= iy0) return 0;
  return (ix1 - ix0) * (iy1 - iy0);
}

/**
 * Measures word tokens with `ctx.measureText` BEFORE placement, wraps dynamically with
 * balanced line lengths, clamps strictly inside frame safety margins, and resolves collisions
 * against faces, active hands, held/important props, character bodies, and other text!
 */
function measureAndPlaceSubtitle(ctx, tokens, layout, obstacles = [], preferredCenterX = null) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const style = layout.subtitleStyle;
  ctx.save();
  ctx.font = `bold ${style.fontSize}px PopB`;
  const spaceW = ctx.measureText(' ').width * 1.32;

  const measured = tokens.map((tk) => ({
    ...tk,
    width: ctx.measureText(String(tk.word || '')).width + (tk.highlight && !tk.isSpeakerLabel ? 6 * layout.scale : 0),
  }));

  // Greedy wrap within `style.maxLineWidth`, then rebalance 2-line splits to eliminate 1-word orphans
  const buildLines = (maxW) => {
    const rows = [];
    let cur = [];
    let curW = 0;
    for (const m of measured) {
      const addW = cur.length > 0 ? spaceW + m.width : m.width;
      if (cur.length > 0 && curW + addW > maxW) {
        rows.push({ items: cur, width: curW });
        cur = [m];
        curW = m.width;
      } else {
        cur.push(m);
        curW += addW;
      }
    }
    if (cur.length > 0) rows.push({ items: cur, width: curW });
    return rows;
  };

  let lines = buildLines(style.maxLineWidth);
  if (lines.length === 2 && lines[1].items.length === 1 && measured.length >= 4) {
    // Rebalance around half total width for clean visual symmetry
    const totalW = measured.reduce((acc, m, idx) => acc + m.width + (idx > 0 ? spaceW : 0), 0);
    const balanced = buildLines(Math.max(style.maxLineWidth * 0.58, totalW * 0.58));
    if (balanced.length === 2) lines = balanced;
  }
  ctx.restore();

  const maxRowW = lines.reduce((mx, r) => Math.max(mx, r.width), 0);
  const boxW = Math.min(
    layout.width - layout.margins.left - layout.margins.right,
    maxRowW + style.padX * 2
  );
  const boxH = lines.length * style.lineHeight + style.padY * 2 - (style.lineHeight - style.fontSize) * 0.35;

  const targetCX = Number.isFinite(preferredCenterX) ? preferredCenterX : layout.width * 0.5;
  const minBoxX = layout.margins.left;
  const maxBoxX = Math.max(minBoxX, layout.width - layout.margins.right - boxW);
  const boxX = Math.max(minBoxX, Math.min(maxBoxX, targetCX - boxW * 0.5));

  const minBoxY = layout.margins.top;
  const maxBoxY = Math.max(minBoxY, layout.height - layout.margins.bottom - boxH);

  // Candidate vertical centers: default lower safe zone -> nudged lower/higher -> upper safe zone
  const candidatesY = [];
  for (const cy of layout.subtitleFallbackCentersY) {
    const by = Math.max(minBoxY, Math.min(maxBoxY, cy - boxH * 0.5));
    if (!candidatesY.some((existing) => Math.abs(existing - by) < 2)) {
      candidatesY.push(by);
    }
  }

  const WEIGHTS = {
    face: 2400,
    hand: 1800,
    prop: 1800,
    text: 2600,
    body: 900,
  };
  const padPx = 8 * layout.scale;

  let best = null;
  candidatesY.forEach((candBoxY, idx) => {
    const rect = {
      left: boxX,
      top: candBoxY,
      right: boxX + boxW,
      bottom: candBoxY + boxH,
    };
    let penalty = idx * 14; // mild preference for default primary subtitle zone when clear
    let criticalOverlap = 0;
    let totalOverlap = 0;
    for (const obs of obstacles) {
      const area = rectIntersectionArea(rect, obs, padPx);
      if (area > 0) {
        const w = WEIGHTS[obs.kind] || 200;
        penalty += area * w;
        totalOverlap += area;
        criticalOverlap += area;
      }
    }
    if (!best || penalty < best.penalty) {
      best = {
        boxX,
        boxY: candBoxY,
        boxW,
        boxH,
        centerX: boxX + boxW * 0.5,
        centerY: candBoxY + boxH * 0.5,
        rect,
        lines,
        spaceW,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        padX: style.padX,
        padY: style.padY,
        radius: style.radius,
        relocated: idx > 0,
        candidateIndex: idx,
        criticalOverlapPx: +criticalOverlap.toFixed(2),
        totalOverlapPx: +totalOverlap.toFixed(2),
        penalty,
      };
    }
  });

  return best;
}

module.exports = {
  BASE_W,
  BASE_H,
  FORMAT_DURATION_BOUNDARY_SEC,
  CANONICAL_LAYOUT_16_9,
  CANONICAL_LAYOUT_9_16,
  DEFAULT_SCREEN_VIEWPORT,
  selectVideoFormatForDuration,
  getLayoutConfig,
  normalizeScreenViewport,
  containRect,
  coverRect,
  fitCanvasFont,
  wrapWordsByWidth,
  rectIntersectionArea,
  measureAndPlaceSubtitle,
};
