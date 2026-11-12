#!/usr/bin/env node
'use strict';
/**
 * Poster + still contact sheet for the film, drawn in the same house style as the episode.
 *
 *   NODE_PATH=/home/user/canvaslibs node tools/make_poster.js <hero.png> <out-dir> <still-1..8>
 *
 * The hero frame is a real frame grabbed from the master (`ffmpeg -ss 45.6`), so the poster can
 * never drift from what the film actually looks like. The title is typeset with the engine's own
 * registered fonts and the same ink/crimson pair the chapter headlines use.
 */
const fs = require('fs');
const path = require('path');
// Always go through the engine's backend shim (it picks node-canvas or @napi-rs/canvas).
const { createCanvas, loadImage } = require(path.resolve(__dirname, '../universal_toolbook/engine/canvas_backend'));
const { registerFonts } = require(path.resolve(__dirname, '../universal_toolbook/engine/font'));

const INK = '#1b1713';
const CRIMSON = '#d9383a';
const PAPER = '#f7eedb';

async function poster(heroPath, outPath) {
  registerFonts();
  const W = 1920, H = 1080;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');

  const hero = await loadImage(heroPath);
  // Cover-fit the frame, biased slightly upward so the horizon keeps its air.
  const scale = Math.max(W / hero.width, H / hero.height);
  const dw = hero.width * scale, dh = hero.height * scale;
  // Lift the plate ~130 px: the ink figures then sit above the title band instead of behind it,
  // and only the bare floor strip of the frame is cropped.
  g.drawImage(hero, (W - dw) / 2, (H - dh) / 2 - 130, dw, dh);

  // Warm the whole plate toward paper so the photo frame reads as ink-on-parchment, not video.
  const wash = g.createLinearGradient(0, 0, 0, H);
  wash.addColorStop(0.0, 'rgba(247, 238, 219, 0.26)');
  wash.addColorStop(0.50, 'rgba(247, 238, 219, 0.08)');
  wash.addColorStop(0.58, 'rgba(247, 238, 219, 0.10)');
  wash.addColorStop(0.66, 'rgba(247, 238, 219, 0.55)');
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);

  // Solid paper band under the title. The hero frame is a real film frame, so it can carry a
  // burned-in subtitle at y~660; this band clears it without cropping the illustration.
  const band = g.createLinearGradient(0, H * 0.66, 0, H * 0.735);
  band.addColorStop(0, 'rgba(248, 240, 224, 0.0)');
  band.addColorStop(0.42, 'rgba(248, 240, 224, 0.90)');
  band.addColorStop(1, 'rgba(249, 241, 226, 1.0)');
  g.fillStyle = band;
  g.fillRect(0, H * 0.655, W, H * 0.08);
  g.fillStyle = 'rgba(249, 241, 226, 1.0)';
  g.fillRect(0, H * 0.73, W, H * 0.27);

  // Corner vignette keeps the eye on the tower and the title.
  const vig = g.createRadialGradient(W * 0.5, H * 0.42, W * 0.20, W * 0.5, H * 0.5, W * 0.78);
  vig.addColorStop(0, 'rgba(120, 88, 44, 0)');
  vig.addColorStop(1, 'rgba(120, 88, 44, 0.20)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);

  // --- title block -----------------------------------------------------------------------
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = 'bold 96px PopB';
  const t1 = 'THE BEACON ';
  const t2 = 'THAT KEPT TIME';
  const w1 = g.measureText(t1).width;
  const w2 = g.measureText(t2).width;
  let x = W / 2 - (w1 + w2) / 2;
  const titleY = 902;
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.fillText(t1, x, titleY);
  g.fillStyle = CRIMSON;
  g.fillText(t2, x + w1, titleY);

  // Hairline rule under the title, weighted like the ink work in the film.
  g.strokeStyle = 'rgba(27, 23, 19, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W / 2 - (w1 + w2) / 2 - 40, titleY + 26);
  g.lineTo(W / 2 + (w1 + w2) / 2 + 40, titleY + 26);
  g.stroke();

  g.textAlign = 'center';
  g.font = '30px PopR';
  g.fillStyle = 'rgba(27, 23, 19, 0.86)';
  g.fillText('A fable about a light the harbor could trust — and the two keepers who made it steady.', W / 2, titleY + 76);

  g.font = 'bold 24px PopB';
  g.fillStyle = 'rgba(27, 23, 19, 0.62)';
  g.fillText('ANYA  ·  MARA  ·  THE HARBOR AT DUSK', W / 2, titleY + 122);

  // Reel tag, top-left, deliberately small.
  g.textAlign = 'left';
  g.font = 'bold 20px PopB';
  g.fillStyle = 'rgba(27, 23, 19, 0.55)';
  g.fillText('UNIVERSAL ANIMATION TOOLBOOK  ·  PARCHMENT & INK', 96, 96);

  fs.writeFileSync(outPath, await c.encode('png'));
  return outPath;
}

async function sheet(stillPaths, outPath, cols = 4) {
  registerFonts();
  const cw = 640, ch = 360, pad = 18, header = 96, footer = 54;
  const rows = Math.ceil(stillPaths.length / cols);
  const W = cols * cw + (cols + 1) * pad;
  const H = header + rows * (ch + pad + 30) + footer;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, W, H);

  g.fillStyle = INK;
  g.font = 'bold 44px PopB';
  g.textAlign = 'left';
  g.fillText('THE BEACON ', pad + 12, 62);
  const w = g.measureText('THE BEACON ').width;
  g.fillStyle = CRIMSON;
  g.fillText('THAT KEPT TIME', pad + 12 + w, 62);
  g.font = '22px PopR';
  g.fillStyle = 'rgba(27, 23, 19, 0.66)';
  g.textAlign = 'right';
  g.fillText('eight scenes  ·  1920×1080  ·  30 fps  ·  1:47', W - pad - 12, 60);

  const labels = [];

  for (let i = 0; i < stillPaths.length; i++) {
    const img = await loadImage(stillPaths[i]);
    const r = Math.floor(i / cols), col = i % cols;
    const x = pad + col * (cw + pad);
    const y = header + r * (ch + pad + 30);
    g.drawImage(img, x, y, cw, ch);
    g.strokeStyle = 'rgba(27, 23, 19, 0.35)';
    g.lineWidth = 1.5;
    g.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
    g.fillStyle = 'rgba(27, 23, 19, 0.72)';
    g.font = 'bold 19px PopB';
    g.textAlign = 'left';
    g.fillText(`S${String(i + 1).padStart(2, '0')}`, x + 2, y + ch + 22);
    labels.push(stillPaths[i]);
  }
  fs.writeFileSync(outPath, await c.encode('png'));
  return outPath;
}

(async () => {
  const hero = process.argv[2];
  const outDir = process.argv[3];
  const stills = process.argv.slice(4);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(await poster(hero, path.join(outDir, 'poster.png')));
  if (stills.length) console.log(await sheet(stills, path.join(outDir, 'contact_sheet.png')));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
