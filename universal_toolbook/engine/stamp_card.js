/**
 * stamp_card board — a loyalty/stamp card you can count.
 *
 * WHY THIS EXISTS
 * ---------------
 * "The Two Free Stamps" turns on a single visual fact: two cards requiring identical effort, one
 * of which starts with two stamps already applied. Before this board, the engine had no way to
 * draw that object. `checklist_card` is the closest neighbour and is structurally wrong for it:
 * it checks EVERY row as the build progresses, so a partly-completed card is not expressible.
 * `stat_cards` prints a number; the argument here depends on the viewer *counting squares*.
 *
 * This is authored as a reusable board (registered in SUPPORTED_BOARDS) rather than a one-video
 * hack, because progress-framing is a recurring idea in this channel's persuasive shorts, and a
 * second video needing a partially-filled card must not fork a second drawing.
 *
 * SCHEMA
 * ------
 * {
 *   "type": "stamp_card",
 *   "x", "y", "w", "h",            // familiar board envelope (fractions or pixels)
 *   "title":  "CAR WASH CLUB",     // small caps header
 *   "reward": "ONE FREE WASH",     // footer line
 *   "total": 8,                    // number of squares (default 8)
 *   "cols":  4,                    // grid columns (default 4)
 *   "pre_filled": 2,               // squares already stamped at reveal — the "head start"
 *   "stamp_at": [2.1, 3.4, 4.9],   // optional: seconds, relative to scene, for further stamps
 *   "progress": true,              // show the n/total rail (default true)
 *   "accent": "#cc292b",           // usually inherits the scene accent
 *   "note": "+2 BONUS STAMPS"      // optional corner tag
 * }
 *
 * Everything drawn is a pure function of the scene clock, so the board is deterministic under the
 * frame-index renderer like every other primitive.
 */

const INK = '#1a1612';
const PAPER = '#f5f2eb';
const PAPER_EDGE = '#c9c2b4';
const EMPTY_SQUARE = 'rgba(107, 79, 48, 0.34)';
const STAMP_INK = '#cc292b';

/** Small local easing/ease-out so this module needs no imports from the engine. */
function eo(x) {
  const t = Math.max(0, Math.min(1, x));
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/** Draw a five-point star inside a circle — the stamp mark. */
function drawStar(g, cx, cy, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.44;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

/**
 * @param {CanvasRenderingContext2D} g
 * @param {object} board  the authored board block
 * @param {object} env    { bx, by, bw, bh, boardVis, accent, u, ts, dur }
 */
function drawStampCardBoard(g, board, env) {
  const { bx, by, bw, bh, boardVis, accent, u, ts, dur } = env;
  const total = Math.max(2, Math.min(20, Number(board.total ?? 8)));
  const cols = Math.max(1, Math.min(6, Number(board.cols ?? 4)));
  const rows = Math.ceil(total / cols);
  const preFilled = Math.max(0, Math.min(total, Number(board.pre_filled ?? 0)));
  const stampInk = board.accent || accent || STAMP_INK;
  const stampAts = Array.isArray(board.stamp_at) ? board.stamp_at.map(Number) : null;

  // How many squares are stamped this instant. Pre-filled squares are stamped at reveal; the rest
  // arrive either on their authored `stamp_at` times or spread across the build.
  const staged = stampAts ? stampAts.filter((t) => ts >= t).length : 0;
  const spread = stampAts ? 0 : Math.round(Math.max(0, total - preFilled) * Math.max(0, u - 0.35) / 0.65);
  const stamped = Math.min(total, preFilled + (stampAts ? staged : spread));

  g.save();
  g.globalAlpha = boardVis;

  // --- card body: a physical card, very slightly rotated, with a soft drop shadow ------------
  const cx = bx + bw * 0.5;
  const cy = by + bh * 0.5;
  g.translate(cx, cy);
  g.rotate(Number(board.tilt ?? -0.014));

  g.shadowColor = 'rgba(2, 6, 12, 0.55)';
  g.shadowBlur = 26;
  g.shadowOffsetY = 10;
  g.fillStyle = PAPER;
  g.beginPath();
  g.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 12);
  g.fill();
  g.shadowColor = 'transparent';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;

  g.strokeStyle = PAPER_EDGE;
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 12);
  g.stroke();

  // Punch hole, so it reads as a card and not as a panel.
  g.fillStyle = 'rgba(26, 22, 18, 0.16)';
  g.beginPath();
  g.arc(-bw * 0.5 + 22, 0, 5.5, 0, Math.PI * 2);
  g.fill();

  const padX = 26;
  const innerW = bw - padX * 2;

  // --- header -------------------------------------------------------------------------------
  const title = String(board.title || 'STAMP CARD').toUpperCase();
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = `bold ${Math.round(Math.min(21, bh * 0.085))}px PopB`;
  g.fillStyle = INK;
  g.fillText(title, -bw * 0.5 + padX, -bh * 0.5 + bh * 0.155);

  if (board.note) {
    g.font = `bold ${Math.round(Math.min(15, bh * 0.062))}px PopB`;
    g.fillStyle = stampInk;
    g.textAlign = 'right';
    g.fillText(String(board.note).toUpperCase(), bw * 0.5 - padX, -bh * 0.5 + bh * 0.155);
    g.textAlign = 'left';
  }

  // Hairline under the header
  g.strokeStyle = 'rgba(26, 22, 18, 0.18)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-bw * 0.5 + padX, -bh * 0.5 + bh * 0.20);
  g.lineTo(bw * 0.5 - padX, -bh * 0.5 + bh * 0.20);
  g.stroke();

  // --- stamp grid ---------------------------------------------------------------------------
  const footerH = board.reward ? bh * 0.15 : 0;
  const progressH = board.progress === false ? 0 : bh * 0.115;
  const gridTop = -bh * 0.5 + bh * 0.255;
  const gridH = bh - bh * 0.255 - footerH - progressH - bh * 0.03;
  const gap = Math.max(6, Math.min(14, innerW * 0.025));
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const cellH = Math.min(cellW, (gridH - gap * (rows - 1)) / rows);

  for (let i = 0; i < total; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const sx = -bw * 0.5 + padX + col * (cellW + gap);
    const sy = gridTop + row * (cellH + gap);
    const isStamped = i < stamped;
    // A stamped square pops slightly when it lands; pre-filled ones are already settled.
    const pop = isStamped && i >= preFilled && stampAts
      ? eo(1 - Math.min(1, (ts - stampAts[i - preFilled]) / 0.32))
      : isStamped && i >= preFilled ? 1 : 0;
    const settle = isStamped ? 1 : 0;

    if (settle) {
      g.fillStyle = 'rgba(204, 41, 43, 0.10)';
      g.fillStyle = stampInk;
      g.globalAlpha = boardVis * (0.92 - 0.12 * clamp01(pop));
      g.beginPath();
      g.roundRect(sx, sy, cellW, cellH, 7);
      g.fill();
      g.globalAlpha = boardVis;
      // Ring, like a rubber stamp's edge
      g.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.roundRect(sx + 3.5, sy + 3.5, cellW - 7, cellH - 7, 5);
      g.stroke();
      drawStar(g, sx + cellW * 0.5, sy + cellH * 0.5, Math.min(cellW, cellH) * 0.27, 'rgba(255,255,255,0.92)');
    } else {
      // Empty slot: dashed outline, deliberately faint so stamped squares own the eye.
      g.strokeStyle = EMPTY_SQUARE;
      g.lineWidth = 1.8;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.roundRect(sx, sy, cellW, cellH, 7);
      g.stroke();
      g.setLineDash([]);
      // Faint square number, so the count is readable without counting
      g.font = `bold ${Math.round(Math.min(14, cellH * 0.3))}px PopB`;
      g.fillStyle = 'rgba(107, 79, 48, 0.42)';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(i + 1), sx + cellW * 0.5, sy + cellH * 0.5);
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
    }
  }

  // --- progress rail ------------------------------------------------------------------------
  if (board.progress !== false) {
    const railY = bh * 0.5 - footerH - progressH * 0.55;
    const railH = Math.max(5, bh * 0.022);
    const frac = stamped / total;
    g.fillStyle = 'rgba(107, 79, 48, 0.16)';
    g.beginPath();
    g.roundRect(-bw * 0.5 + padX, railY, innerW, railH, railH * 0.5);
    g.fill();
    if (frac > 0) {
      g.fillStyle = stampInk;
      g.beginPath();
      g.roundRect(-bw * 0.5 + padX, railY, Math.max(railH, innerW * frac), railH, railH * 0.5);
      g.fill();
    }
    g.font = `bold ${Math.round(Math.min(15, bh * 0.058))}px PopB`;
    g.fillStyle = 'rgba(26, 22, 18, 0.66)';
    g.textAlign = 'left';
    g.fillText(`${stamped} / ${total}`, -bw * 0.5 + padX, railY + railH + bh * 0.075);
    if (board.reward) {
      g.textAlign = 'right';
      g.fillStyle = 'rgba(26, 22, 18, 0.5)';
      g.fillText(String(board.reward).toUpperCase(), bw * 0.5 - padX, railY + railH + bh * 0.075);
      g.textAlign = 'left';
    }
  }

  g.restore();
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

module.exports = { drawStampCardBoard };
