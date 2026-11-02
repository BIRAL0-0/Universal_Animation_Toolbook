'use strict';

/**
 * Generic output-frame geometry and text-fit helpers.
 * Keep aspect-ratio math here so renderers can reuse it without stretching content.
 */

const BASE_W = 1920;

const DEFAULT_SCREEN_VIEWPORT = Object.freeze({
  left: 0,
  width: BASE_W,
  centerX: BASE_W * 0.5,
  right: BASE_W,
});

function normalizeScreenViewport(viewport = DEFAULT_SCREEN_VIEWPORT, stageWidth = BASE_W) {
  const left = Number.isFinite(Number(viewport.left)) ? Number(viewport.left) : 0;
  const width = Number.isFinite(Number(viewport.width))
    ? Math.max(1, Math.min(stageWidth, Number(viewport.width)))
    : stageWidth;
  return { left, width, centerX: left + width * 0.5, right: left + width };
}

/** Return a centered, aspect-preserving rectangle that fits a source inside a target. */
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

/** Return an aspect-preserving rectangle that covers a target (the overflow is cropped). */
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

/** Reduce a canvas font only as much as needed to keep a label inside its safe width. */
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

/** Wrap text at word boundaries using the currently selected canvas font. */
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

module.exports = {
  BASE_W,
  DEFAULT_SCREEN_VIEWPORT,
  normalizeScreenViewport,
  containRect,
  coverRect,
  fitCanvasFont,
  wrapWordsByWidth,
};
