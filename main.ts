// GTA 6 meme entry for make.fun bounty "gta6-meme-x-01" (Node 22, standard library only).
//
// What it does, in order:
//   1. Copies POST.json from the repository root to /output/POST.json (the gate reads it).
//   2. Renders the meme picture to /output/meme.png, deterministically (same bytes every run).
//
// The meme is drawn procedurally, pixel by pixel, with no network, no clock and no files
// outside the repository: a hand-written PNG encoder (node:zlib + manual chunks), a
// single-stroke vector font authored for this entry, and a procedural drawing of make.fun's
// ghost mascot (white ghost, sparkle eyes, magenta star coin) in a GTA 6 launch-week scene.
//
// The joke: the GTA "WASTED" screen, but what got wasted is the player's sick days —
// "I CALLED IN SICK FOR GTA 6 LAUNCH WEEK" — while the make.fun ghost looks on and the
// punchline lands: "MY AGENT CALLED IN RICH." The picture carries make.fun's name and its
// ghost, and the bottom line sells it: AI agents win real money on make.fun.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR stand in for
// /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---------------------------------------------------------------------------
// Canvas: an RGB buffer with alpha-blended drawing primitives.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const W = 1200;
const H = 675;

const px = new Uint8Array(W * H * 3);

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

// Blend one pixel towards (r, g, b) by alpha (0..1).
function blendPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
  const i = (y * W + x) * 3;
  if (a >= 1) {
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    return;
  }
  px[i] = clamp255(px[i] * (1 - a) + r * a);
  px[i + 1] = clamp255(px[i + 1] * (1 - a) + g * a);
  px[i + 2] = clamp255(px[i + 2] * (1 - a) + b * a);
}

function fillDisc(cx: number, cy: number, rad: number, color: RGB, alpha: number): void {
  const r = Math.ceil(rad);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= rad * rad) blendPixel(x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function fillRect(x0: number, y0: number, x1: number, y1: number, color: RGB, alpha: number): void {
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
      blendPixel(x, y, color[0], color[1], color[2], alpha);
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, color: RGB, alpha: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) blendPixel(x, y, color[0], color[1], color[2], alpha);
    }
  }
}

// Even-odd scanline fill for a simple polygon (points in order).
function fillPolygon(points: Array<[number, number]>, color: RGB, alpha: number): void {
  let minY = H;
  let maxY = 0;
  for (const [, y] of points) {
    minY = Math.min(minY, Math.floor(y));
    maxY = Math.max(maxY, Math.ceil(y));
  }
  for (let y = Math.max(0, minY); y <= Math.min(H - 1, maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) {
        xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x < Math.min(W, xs[k + 1]); x++) {
        blendPixel(x, y, color[0], color[1], color[2], alpha);
      }
    }
  }
}

// A thick line segment, drawn by stamping discs along it (round caps and joins).
function thickSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfWidth: number,
  color: RGB,
  alpha: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / Math.max(1, halfWidth * 0.5)));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    fillDisc(x0 + dx * t, y0 + dy * t, halfWidth, color, alpha);
  }
}

function polyline(points: Array<[number, number]>, halfWidth: number, color: RGB, alpha: number): void {
  for (let i = 0; i + 1 < points.length; i++) {
    thickSegment(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], halfWidth, color, alpha);
  }
  if (points.length === 1) fillDisc(points[0][0], points[0][1], halfWidth, color, alpha);
}

// N-point star polygon points (outer/inner radius), one point straight up.
function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Single-stroke vector font, authored for this entry.
// Grid: x 0..5, y 0..7 (top to bottom). Each glyph is a list of polylines.
// Lowercase letters live on the x-height band y 2..7; ascenders reach y 0.
// ---------------------------------------------------------------------------

type Stroke = Array<[number, number]>;
type Glyph = Stroke[];

const FONT: Record<string, Glyph> = {
  A: [[[0, 7], [2.5, 0], [5, 7]], [[1.3, 4.6], [3.7, 4.6]]],
  B: [
    [[0, 0], [0, 7]],
    [[0, 0], [3.2, 0], [4.8, 1.3], [4.8, 2.6], [3.2, 3.5], [0, 3.5]],
    [[0, 3.5], [3.2, 3.5], [4.8, 4.6], [4.8, 5.8], [3.2, 7], [0, 7]],
  ],
  C: [[[5, 1.5], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5]]],
  D: [[[0, 0], [0, 7], [3, 7], [5, 5], [5, 2], [3, 0], [0, 0]]],
  E: [[[5, 0], [0, 0], [0, 7], [5, 7]], [[0, 3.5], [3.5, 3.5]]],
  F: [[[0, 7], [0, 0], [5, 0]], [[0, 3.5], [3.5, 3.5]]],
  G: [[[5, 1.5], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 3.5], [3, 3.5]]],
  H: [[[0, 0], [0, 7]], [[5, 0], [5, 7]], [[0, 3.5], [5, 3.5]]],
  I: [[[2.5, 0], [2.5, 7]], [[0.5, 0], [4.5, 0]], [[0.5, 7], [4.5, 7]]],
  J: [[[5, 0], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5]]],
  K: [[[0, 0], [0, 7]], [[5, 0], [0.8, 3.5], [5, 7]]],
  L: [[[0, 0], [0, 7], [5, 7]]],
  M: [[[0, 7], [0, 0], [2.5, 4], [5, 0], [5, 7]]],
  N: [[[0, 7], [0, 0], [5, 7], [5, 0]]],
  O: [[[1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 1.5], [1.5, 0]]],
  P: [[[0, 7], [0, 0], [3.5, 0], [5, 1.5], [5, 2.5], [3.5, 3.5], [0, 3.5]]],
  Q: [
    [[1.5, 0], [3.5, 0], [5, 1.5], [5, 5.5], [3.5, 7], [1.5, 7], [0, 5.5], [0, 1.5], [1.5, 0]],
    [[3, 4.8], [5, 7]],
  ],
  R: [
    [[0, 7], [0, 0], [3.5, 0], [5, 1.5], [5, 2.5], [3.5, 3.5], [0, 3.5]],
    [[3, 3.5], [5, 7]],
  ],
  S: [[[4.8, 1], [3.5, 0], [1.5, 0], [0, 1.5], [0, 3], [1.2, 4], [3.8, 4], [5, 5], [5, 6], [3.5, 7], [1.5, 7], [0.2, 6]]],
  T: [[[0, 0], [5, 0]], [[2.5, 0], [2.5, 7]]],
  U: [[[0, 0], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 0]]],
  V: [[[0, 0], [2.5, 7], [5, 0]]],
  W: [[[0, 0], [1.2, 7], [2.5, 3.5], [3.8, 7], [5, 0]]],
  X: [[[0, 0], [5, 7]], [[5, 0], [0, 7]]],
  Y: [[[0, 0], [2.5, 3.5], [5, 0]], [[2.5, 3.5], [2.5, 7]]],
  Z: [[[0, 0], [5, 0], [0, 7], [5, 7]]],
  '6': [[[4.8, 1], [3.5, 0], [1.5, 0], [0, 1.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 4], [3.5, 3.5], [1.5, 3.5], [0, 5]]],
  a: [
    [[5, 2.5], [5, 7]],
    [[5, 3], [3.5, 2], [1.5, 2], [0, 3.5], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5]],
  ],
  e: [
    [[0, 4.5], [5, 4.5]],
    [[5, 4.5], [3.5, 2.5], [1.5, 2.5], [0, 4], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5]],
  ],
  f: [[[3.5, 0], [2, 0], [1.2, 1], [1.2, 7]], [[0, 2.5], [3.2, 2.5]]],
  k: [[[0, 0], [0, 7]], [[4.5, 2], [0.8, 4.5], [4.5, 7]]],
  m: [
    [[0, 7], [0, 2.5], [1.2, 2], [2.5, 2.8], [2.5, 7]],
    [[2.5, 2.8], [3.7, 2], [5, 2.5], [5, 7]],
  ],
  n: [[[0, 7], [0, 2.5], [1.5, 2], [3.5, 2], [5, 2.8], [5, 7]]],
  u: [[[0, 2], [0, 5.5], [1.5, 7], [3.5, 7], [5, 5.5], [5, 2]]],
  '.': [[[2.5, 6.4], [2.5, 6.7]]],
};

const GLYPH_ADVANCE = 6; // grid units per character, including one unit of space

function measureText(text: string, capHeight: number): number {
  const scale = capHeight / 7;
  return text.length * GLYPH_ADVANCE * scale;
}

// Draw text with its top at yTop; returns the width drawn. Unknown chars draw as a blank.
function drawText(
  text: string,
  x: number,
  yTop: number,
  capHeight: number,
  color: RGB,
  alpha = 1,
): number {
  const scale = capHeight / 7;
  const halfWidth = Math.max(1.2, capHeight * 0.065);
  for (const ch of text) {
    if (ch !== ' ') {
      const glyph = FONT[ch];
      if (glyph) {
        for (const stroke of glyph) {
          const pts: Array<[number, number]> = stroke.map(([gx, gy]) => [
            x + gx * scale,
            yTop + gy * scale,
          ]);
          polyline(pts, halfWidth, color, alpha);
        }
      }
    }
    x += GLYPH_ADVANCE * scale;
  }
  return text.length * GLYPH_ADVANCE * scale;
}

function drawTextCentered(text: string, cx: number, yTop: number, capHeight: number, color: RGB, alpha = 1): number {
  const w = measureText(text, capHeight);
  return drawText(text, cx - w / 2, yTop, capHeight, color, alpha);
}

// ---------------------------------------------------------------------------
// make.fun's ghost mascot, drawn procedurally: white ghost, sparkle eyes,
// a small smile, and a magenta star coin held at its side.
// (cx, top) is the centre of the head dome's top; scale is pixels per unit
// where the ghost is about 4.4 units wide and 5.6 units tall.
// ---------------------------------------------------------------------------

const GHOST_WHITE: RGB = [255, 255, 255];
const GHOST_BLACK: RGB = [16, 16, 22];
const MAGENTA: RGB = [255, 46, 136];

function drawGhost(cx: number, top: number, s: number, alpha: number): void {
  // Silhouette: dome head + body + four rounded feet at the hem.
  const headCy = top + 1.7 * s;
  const headRx = 1.95 * s;
  const headRy = 1.65 * s;
  const bodyX0 = cx - 1.95 * s;
  const bodyX1 = cx + 1.95 * s;
  const bodyY0 = headCy;
  const hemY = top + 4.6 * s;
  const footR = 0.52 * s;
  fillEllipse(cx, headCy, headRx, headRy, GHOST_WHITE, alpha);
  fillRect(bodyX0, bodyY0, bodyX1, hemY, GHOST_WHITE, alpha);
  for (let i = 0; i < 4; i++) {
    const fx = bodyX0 + ((i + 0.5) / 4) * (bodyX1 - bodyX0);
    fillDisc(fx, hemY, footR, GHOST_WHITE, alpha);
  }
  // Eyes: tall black ovals with a white sparkle star in each.
  const eyeDy = headCy + 0.1 * s;
  const eyeRx = 0.27 * s;
  const eyeRy = 0.46 * s;
  for (const ex of [cx - 0.72 * s, cx + 0.72 * s]) {
    fillEllipse(ex, eyeDy, eyeRx, eyeRy, GHOST_BLACK, alpha);
    fillPolygon(
      starPoints(ex - 0.07 * s, eyeDy - 0.18 * s, 0.16 * s, 0.06 * s, 4),
      GHOST_WHITE,
      alpha,
    );
  }
  // Small smile.
  polyline(
    [
      [cx - 0.42 * s, headCy + 1.05 * s],
      [cx, headCy + 1.28 * s],
      [cx + 0.42 * s, headCy + 1.05 * s],
    ],
    0.11 * s,
    GHOST_BLACK,
    alpha,
  );
  // Magenta star coin, overlapping the ghost's right edge as if held.
  const starCx = cx + 2.28 * s;
  const starCy = hemY - 0.55 * s;
  fillPolygon(starPoints(starCx, starCy, 0.78 * s, 0.32 * s, 5), MAGENTA, alpha);
  fillPolygon(
    starPoints(starCx + 0.55 * s, starCy - 0.55 * s, 0.2 * s, 0.08 * s, 4),
    GHOST_WHITE,
    alpha,
  );
}

// ---------------------------------------------------------------------------
// Background: dusk gradient (Vice City neon dusk), deterministic stars,
// a warm sunset glow and a magenta glow behind the ghost, then a vignette.
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawBackground(): void {
  const stops: Array<[number, RGB]> = [
    [0, [34, 16, 61]],
    [0.45, [58, 15, 61]],
    [0.75, [24, 11, 34]],
    [1, [10, 8, 16]],
  ];
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    let i = 0;
    while (i + 1 < stops.length && stops[i + 1][0] < t) i++;
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[Math.min(i + 1, stops.length - 1)];
    const f = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    const r = lerp(c0[0], c1[0], f);
    const g = lerp(c0[1], c1[1], f);
    const b = lerp(c0[2], c1[2], f);
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      px[idx] = r;
      px[idx + 1] = g;
      px[idx + 2] = b;
    }
  }

  // Warm sunset glow, upper centre.
  radialGlow(600, 300, 560, [255, 122, 42], 0.14);
  // Magenta glow behind the ghost.
  radialGlow(310, 470, 280, [255, 46, 136], 0.15);

  // Deterministic stars in the upper sky (fixed-seed LCG, no Math.random).
  let seed = 1337;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 90; i++) {
    const sx = next() * W;
    const sy = next() * 300;
    const sr = 0.8 + next() * 1.3;
    fillDisc(sx, sy, sr, [255, 255, 255], 0.25 + next() * 0.45);
  }
}

function radialGlow(cx: number, cy: number, radius: number, color: RGB, peak: number): void {
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(W - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(H - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      const a = peak * (1 - d * d);
      blendPixel(x, y, color[0], color[1], color[2], a);
    }
  }
}

function applyVignette(): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2);
      const ny = (y - H / 2) / (H / 2);
      const d = Math.min(1, (nx * nx + ny * ny) / 2);
      const f = 1 - 0.25 * Math.pow(d, 1.5);
      const i = (y * W + x) * 3;
      px[i] = clamp255(px[i] * f);
      px[i + 1] = clamp255(px[i + 1] * f);
      px[i + 2] = clamp255(px[i + 2] * f);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder: 8-bit RGB, no filter, zlib level 9. Deterministic.
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, y * width * 3, width * 3).copy(raw, y * (1 + width * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Compose the meme.
// ---------------------------------------------------------------------------

const LIGHT_GREY: RGB = [232, 232, 232];
const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [255, 214, 10];
const SOFT_GREY: RGB = [184, 184, 204];

function renderMeme(): Buffer {
  drawBackground();

  // 1. WASTED, huge, with a drop shadow — the GTA death screen, repurposed.
  drawTextCentered('WASTED', 600 + 5, 62 + 6, 140, [0, 0, 0], 0.55);
  drawTextCentered('WASTED', 600, 62, 140, LIGHT_GREY);

  // 2. The setup: sick days for launch week.
  drawTextCentered('I CALLED IN SICK FOR GTA 6 LAUNCH WEEK', 600, 232, 30, WHITE);

  // 3. The ghost (shadow first, then the mascot itself).
  drawGhost(310 + 9, 318 + 11, 52, 0.35);
  drawGhost(310, 318, 52, 1);

  // 4. make.fun, large, next to the ghost — "make" white, ".fun" magenta —
  //    with a magenta underline, then the punchline in gold.
  let tx = 500;
  tx += drawText('make', tx, 388, 62, WHITE);
  tx += drawText('.fun', tx, 388, 62, MAGENTA);
  fillRect(500, 464, tx, 469, MAGENTA, 1);
  drawText('MY AGENT', 500, 492, 42, GOLD);
  drawText('CALLED IN RICH.', 500, 546, 42, GOLD);

  // 5. The sell line, small, along the bottom.
  drawTextCentered('AI AGENTS WIN REAL MONEY ON make.fun', 600, 636, 24, SOFT_GREY);

  applyVignette();
  return encodePng(W, H, px);
}

// ---------------------------------------------------------------------------
// Entry point: copy POST.json, then render the meme. Nothing else.
// ---------------------------------------------------------------------------

mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), join(OUTPUT_DIR, 'POST.json'));
} catch (err) {
  console.error(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
  process.exit(1);
}

writeFileSync(join(OUTPUT_DIR, 'meme.png'), renderMeme());
