'use strict';
const fs = require('fs');
const path = require('path');
const { registerFont } = require('./canvas_backend');

let registered = false;
let fontInfo = { boldFamily: 'sans-serif', regFamily: 'sans-serif', boldPath: null, regPath: null };

function ensureFonts() {
  if (registered) return fontInfo;
  const root = path.resolve(__dirname, '..');

  const boldCandidates = [
    path.join(root, 'assets', 'Poppins-Bold.ttf'),
    '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  ];

  const regCandidates = [
    path.join(root, 'assets', 'Poppins-Regular.ttf'),
    '/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];

  for (const p of boldCandidates) {
    if (fs.existsSync(p)) {
      registerFont(p, { family: 'PopB', weight: 'bold' });
      fontInfo.boldFamily = 'PopB';
      fontInfo.boldPath = p;
      break;
    }
  }

  for (const p of regCandidates) {
    if (fs.existsSync(p)) {
      registerFont(p, { family: 'PopR', weight: 'normal' });
      fontInfo.regFamily = 'PopR';
      fontInfo.regPath = p;
      break;
    }
  }

  if (fontInfo.regFamily === 'sans-serif' && fontInfo.boldFamily === 'PopB') {
    fontInfo.regFamily = 'PopB';
  }
  registered = true;
  return fontInfo;
}

module.exports = { ensureFonts, registerFonts: ensureFonts };
