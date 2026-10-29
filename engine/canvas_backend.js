'use strict';
/**
 * Canvas backend abstraction.
 *
 * The renderer was written against `node-canvas` (Cairo/Pango). That package needs system
 * libraries and a native build, which fails on modern Node / slim containers / CI images.
 * `@napi-rs/canvas` is an API-compatible drop-in with prebuilt binaries.
 *
 * This module picks whichever is installed and normalizes the two small differences:
 *   1. `registerFont(path, { family })`  ->  `GlobalFonts.registerFromPath(path, family)`
 *   2. `canvas.toBuffer('raw')`          ->  `canvas.data()`  (RGBA, zero-copy view)
 *
 * Every engine module imports from here, so installing either backend is enough.
 */

let native = null;
let backendName = 'none';

try {
  native = require('canvas');
  backendName = 'canvas';
} catch (_) {
  try {
    native = require('@napi-rs/canvas');
    backendName = '@napi-rs/canvas';
  } catch (err) {
    throw new Error(
      'No 2D canvas backend found. Install one of:\n' +
        '  npm install canvas            (node-canvas: needs cairo/pango + a compiler)\n' +
        '  npm install @napi-rs/canvas   (prebuilt binaries, no system libraries)'
    );
  }
}

const isNapi = backendName === '@napi-rs/canvas';

function createCanvas(width, height) {
  return native.createCanvas(width, height);
}

function registerFont(filePath, options = {}) {
  const family = options.family || require('path').basename(filePath).replace(/\.(ttf|otf|ttc)$/i, '');
  if (isNapi) {
    return native.GlobalFonts.registerFromPath(filePath, family);
  }
  return native.registerFont(filePath, options);
}

/**
 * RGBA frame bytes for an ffmpeg `-f rawvideo` pipe.
 * Falls back to reading the PNG/JPEG buffer only if a backend exposes neither path.
 */
function rawFrameBytes(canvas) {
  if (typeof canvas.toBuffer === 'function') {
    try {
      return canvas.toBuffer('raw');
    } catch (_) {
      /* @napi-rs/canvas: 'raw' is not a valid mime, fall through to data() */
    }
  }
  if (typeof canvas.data === 'function') {
    return canvas.data();
  }
  throw new Error(`Canvas backend "${backendName}" cannot produce raw RGBA frames.`);
}

// Both node-canvas ('raw') and @napi-rs/canvas (data()) hand back RGBA byte order.
const rawPixelFormat = 'rgba';

module.exports = {
  createCanvas,
  registerFont,
  rawFrameBytes,
  rawPixelFormat,
  backendName,
  Image: native.Image,
  loadImage: native.loadImage,
};
