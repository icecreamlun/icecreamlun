// Generates assets/banner.svg: an original pixel-art room/workshop scene.
// Everything is drawn on a 300x100 cell grid (4px cells) and animated with CSS
// inside the SVG, because GitHub strips scripts from READMEs.
// Usage: node scripts/gen-banner.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GW = 300, GH = 100, S = 4;

let seed = 7;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---------- pixel canvas ----------
class Canvas {
  constructor() { this.m = new Map(); }
  set(x, y, c) { this.m.set(y * 1000 + x, c); return this; }
  get(x, y) { return this.m.get(y * 1000 + x); }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  disc(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, c);
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  glyphs(font, gw, x, y, str, c, scale = 1) {
    let cx = x;
    for (const ch of str) {
      const g = font[ch];
      if (g) g.forEach((row, j) => [...row].forEach((bit, i) => {
        if (bit === '#') this.rect(cx + i * scale, y + j * scale, scale, scale, c);
      }));
      cx += (gw + 1) * scale;
    }
    return this;
  }
  // 1-cell halo around every lit cell, for neon glow
  halo(c) {
    const out = new Canvas();
    for (const k of this.m.keys()) {
      const x = k % 1000, y = Math.floor(k / 1000);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
        if (!this.m.has((y + j) * 1000 + x + i)) out.set(x + i, y + j, c);
    }
    return out;
  }
  svg() {
    const byColor = new Map();
    const keys = [...this.m.keys()].sort((a, b) => a - b);
    let i = 0;
    while (i < keys.length) {
      const k = keys[i], c = this.m.get(k);
      let n = 1;
      while (i + n < keys.length && keys[i + n] === k + n && this.m.get(keys[i + n]) === c) n++;
      if (!byColor.has(c)) byColor.set(c, '');
      byColor.set(c, byColor.get(c) + `M${k % 1000} ${Math.floor(k / 1000)}h${n}v1h-${n}z`);
      i += n;
    }
    return [...byColor].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join('');
  }
}

// ---------- fonts ----------
const F5 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};
const F3 = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['###', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
};

// ---------- palette ----------
const P = {
  wall: '#1c1e3d', mortar: '#181a35', ceil: '#0f1024', base: '#2b2e58',
  floor: '#2c2038', floorHi: '#3d2c4d', seam: '#221829',
  frame: '#3a3d6e', frameHi: '#565aa0',
  cyan: '#7df9ff', pink: '#ff6fb1', green: '#34d399', amber: '#fbbf24', red: '#f87171',
  ink: '#05060d', screen: '#0d1326', hair: '#1b1426',
};

const bg = new Canvas();   // static background
const fg = new Canvas();   // static foreground (drawn above animated screens)
const anim = [];           // { c: Canvas, cls, style, clip }
const tw = Array.from({ length: 6 }, () => new Canvas()); // twinkle buckets
const twinkle = (x, y, c) => pick(tw).set(x, y, c);

// ---------- wall, floor ----------
bg.rect(0, 0, GW, 78, P.wall);
for (let y = 2; y < 76; y += 6) {
  bg.rect(0, y, GW, 1, P.mortar);
  const off = (Math.floor(y / 6) % 2) * 7;
  for (let x = off; x < GW; x += 14) bg.rect(x, y + 1, 1, 5, P.mortar);
}
bg.rect(0, 0, GW, 2, P.ceil);
bg.rect(0, 76, GW, 2, P.base);
bg.rect(0, 78, GW, 22, P.floor).rect(0, 78, GW, 1, P.floorHi);
[[84, 0], [91, 18], [100, 7]].forEach(([y, off], i, a) => {
  bg.rect(0, y, GW, 1, P.seam);
  const top = i === 0 ? 79 : a[i - 1][0] + 1;
  for (let x = off + 9; x < GW; x += 38) bg.rect(x, top, 1, y - top, P.seam);
});

// ---------- window with night skyline ----------
const WX = 8, WY = 12, WW = 54, WH = 46;
const sky = ['#0a0d2a', '#0d1136', '#121745', '#1a1f58', '#252a6e'];
for (let y = WY + 2; y < WY + WH - 2; y++) {
  const t = (y - WY - 2) / (WH - 4) * (sky.length - 1);
  for (let x = WX + 2; x < WX + WW - 2; x++) {
    const dither = ((x + y) % 2 ? 0.25 : -0.25);
    bg.set(x, y, sky[Math.max(0, Math.min(sky.length - 1, Math.round(t + dither)))]);
  }
}
for (let i = 0; i < 26; i++) {
  const x = ri(WX + 3, WX + WW - 4), y = ri(WY + 3, WY + 22);
  (i % 3 ? bg : pick(tw)).set(x, y, i % 4 ? '#c7d0ff' : '#ffffff');
}
bg.disc(50, 22, 4, 4, '#fdf6c9').set(48, 21, '#e6dba0').set(51, 24, '#e6dba0').set(52, 20, '#e6dba0');
const WB = WY + WH - 2; // bottom of glass
for (let x = WX + 2; x < WX + WW - 2;) {           // far skyline
  const w = ri(4, 7), h = ri(16, 30);
  bg.rect(x, WB - h, Math.min(w, WX + WW - 2 - x), h, '#161b4a');
  x += w;
}
for (let x = WX + 2; x < WX + WW - 2;) {           // near skyline
  const w = Math.min(ri(5, 9), WX + WW - 2 - x), h = ri(8, 22);
  const col = pick(['#070a1c', '#0b0f27']);
  bg.rect(x, WB - h, w, h, col);
  if (rand() < 0.35) { bg.rect(x + (w >> 1), WB - h - 3, 1, 3, col); twinkle(x + (w >> 1), WB - h - 4, P.red); }
  for (let wy = WB - h + 2; wy < WB - 1; wy += 3)
    for (let wx = x + 1; wx < x + w - 1; wx += 2)
      if (rand() < 0.42) (rand() < 0.25 ? pick(tw) : bg).set(wx, wy, rand() < 0.8 ? '#ffd866' : '#9fd8ff');
  x += w;
}
// frame, mullions, sill
bg.rect(WX, WY, WW, 2, P.frame).rect(WX, WY + WH - 2, WW, 2, P.frame)
  .rect(WX, WY, 2, WH, P.frame).rect(WX + WW - 2, WY, 2, WH, P.frame)
  .rect(WX + 26, WY, 2, WH, P.frame).rect(WX, WY + 22, WW, 1, P.frame)
  .rect(WX, WY, WW, 1, P.frameHi).rect(WX - 2, WY + WH, WW + 4, 2, P.frameHi)
  .rect(WX - 2, WY + WH + 2, WW + 4, 1, P.frame);

// ---------- string lights ----------
for (let x = 0; x < GW; x++) {
  const y = 3 + Math.round(3 * Math.sin(Math.PI * (x % 50) / 50));
  bg.set(x, y, '#090a18');
  if (x % 10 === 5) {
    const c = [P.amber, P.pink, P.cyan, P.green][(x / 10 | 0) % 4];
    tw[(x / 10 | 0) % 6].rect(x, y + 1, 2, 2, c);
  }
}

// ---------- poster ----------
bg.rect(66, 18, 16, 23, '#e9dcc5').rect(66, 40, 16, 1, '#c9b99c')
  .rect(66, 17, 3, 2, '#fbbf24').rect(79, 17, 3, 2, '#fbbf24')
  .disc(74, 27, 5, 3.6, '#ff9ec4');
[[68, 24], [67, 27], [68, 30]].forEach(([x, y]) => bg.rect(x, y, 2, 1, '#e0508f').rect(148 - x - 1, y, 2, 1, '#e0508f'));
bg.set(72, 27, P.hair).set(76, 27, P.hair).rect(73, 29, 3, 1, '#c0407a')
  .glyphs(F3, 3, 69, 34, 'AXO', P.hair);

// ---------- task board ----------
bg.rect(212, 9, 58, 32, '#565aa0').rect(213, 10, 56, 30, '#141a3a')
  .glyphs(F3, 3, 216, 12, 'EVALS', P.cyan).rect(216, 18, 50, 1, '#2b3566');
[['CODE REVIEW', 20, true], ['BENCHMARKS', 27, true], ['MEMORY', 34, false]].forEach(([label, y, done]) => {
  bg.rect(216, y, 5, 1, '#6f7ab8').rect(216, y + 4, 5, 1, '#6f7ab8').rect(216, y, 1, 5, '#6f7ab8').rect(220, y, 1, 5, '#6f7ab8')
    .glyphs(F3, 3, 224, y, label, done ? '#c9d2ff' : P.amber);
  if (done) bg.set(217, y + 2, P.green).set(218, y + 3, P.green).set(219, y + 2, P.green).set(220, y + 1, P.green).set(221, y, P.green);
});
anim.push({ c: new Canvas().rect(217, 35, 3, 3, P.amber), cls: 'blink' });

// ---------- server rack ----------
bg.rect(274, 26, 22, 58, '#0e1024').rect(274, 26, 22, 1, '#2a2d55').rect(274, 26, 1, 58, '#2a2d55')
  .rect(275, 84, 3, 2, P.ink).rect(292, 84, 3, 2, P.ink);
for (let u = 0; u < 11; u++) {
  const y = 28 + u * 5;
  bg.rect(276, y, 18, 4, '#181b38').rect(284, y + 1, 8, 1, '#0a0b18').rect(284, y + 2, 8, 1, '#0a0b18');
  twinkle(278, y + 1, P.green); twinkle(280, y + 1, pick([P.amber, P.cyan, P.green]));
  bg.set(278, y + 2, '#0a3d2a');
}

// ---------- workbench, projector, robot arm ----------
bg.rect(210, 66, 60, 2, '#59607f').rect(210, 68, 60, 1, '#3a4060')
  .rect(212, 69, 2, 15, '#2e3350').rect(266, 69, 2, 15, '#2e3350').rect(214, 76, 52, 1, '#2e3350')
  .rect(217, 70, 12, 6, '#c0392b').rect(217, 72, 12, 1, '#8e2a20').rect(222, 71, 2, 2, P.amber).rect(220, 69, 6, 1, '#8e2a20')
  .rect(233, 63, 14, 3, '#2a2f4a').rect(233, 63, 14, 1, '#454c75').rect(237, 62, 6, 1, P.cyan)
  .rect(256, 63, 9, 3, '#3a4060').rect(256, 63, 9, 1, '#59607f');
for (const d of [0, 1]) bg.line(261 + d, 62, 258 + d, 54, '#aab2d5').line(258, 54 + d, 251, 50 + d, '#8791bd');
bg.disc(258.5, 54, 1.5, 1.5, '#d7dcf5').rect(249, 49, 2, 1, '#d7dcf5').rect(249, 52, 2, 1, '#d7dcf5').set(251, 50, '#d7dcf5').set(251, 51, '#d7dcf5');
anim.push({ c: new Canvas().set(258, 54, P.red).set(259, 54, P.red), cls: 'blink' });

// hologram: a rotating wireframe cube, drawn as discrete frames
const cubeV = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) cubeV.push([x, y, z]);
const cubeE = [];
for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++)
  if (cubeV[a].filter((v, i) => v !== cubeV[b][i]).length === 1) cubeE.push([a, b]);
const HOLO_FRAMES = 8;
for (let f = 0; f < HOLO_FRAMES; f++) {
  const th = (Math.PI / 2) * (f / HOLO_FRAMES) + 0.2, tilt = 0.55;
  const pts = cubeV.map(([x, y, z]) => {
    const x1 = x * Math.cos(th) + z * Math.sin(th), z1 = -x * Math.sin(th) + z * Math.cos(th);
    return { x: 240 + 5.2 * x1, y: 51 - 5.2 * (y * Math.cos(tilt) - z1 * Math.sin(tilt)), z: y * Math.sin(tilt) + z1 * Math.cos(tilt) };
  });
  const c = new Canvas();
  [...cubeE].sort((a, b) => (pts[a[0]].z + pts[a[1]].z) - (pts[b[0]].z + pts[b[1]].z))
    .forEach(([a, b]) => c.line(pts[a].x, pts[a].y, pts[b].x, pts[b].y, pts[a].z + pts[b].z < 0 ? '#2a9fb5' : '#aefcff'));
  pts.forEach((p) => p.z > 0 && c.set(Math.round(p.x), Math.round(p.y), '#ffffff'));
  anim.push({ c, cls: 'f8', style: `animation-delay:${(f * 0.16).toFixed(2)}s` });
}

// ---------- bed and cat ----------
bg.rect(3, 58, 3, 20, '#5a3a48').rect(4, 74, 62, 4, '#5a3a48').rect(4, 74, 62, 1, '#734c5d')
  .rect(5, 78, 2, 6, '#3f2833').rect(62, 78, 2, 6, '#3f2833')
  .rect(6, 68, 58, 6, '#c9cde8').rect(6, 73, 58, 1, '#9aa0c8')
  .rect(7, 63, 13, 5, '#eef0ff').rect(7, 67, 13, 1, '#b9bfe6')
  .rect(22, 66, 43, 8, '#b8394a').rect(22, 65, 43, 1, '#d65a6a').rect(22, 69, 43, 2, '#2f4fa8').rect(22, 73, 43, 1, '#8e2a3a');
bg.disc(47, 62.5, 6.5, 3, '#e89a3c').disc(40.5, 62.5, 3, 2.6, '#e89a3c')
  .set(38, 59, '#e89a3c').set(39, 59, '#e89a3c').set(42, 59, '#e89a3c').set(43, 59, '#e89a3c')
  .rect(51, 65, 5, 1, '#c97a22').set(56, 64, '#c97a22')
  .set(45, 61, '#c97a22').set(48, 61, '#c97a22').set(51, 62, '#c97a22')
  .set(39, 63, P.hair).set(42, 63, P.hair);
anim.push({ c: new Canvas().rect(43, 59, 8, 1, '#e89a3c'), cls: 'breath' });
[[36, 55, 0], [33, 52, 1.2]].forEach(([x, y, d]) =>
  anim.push({ c: new Canvas().rect(x, y, 4, 1, '#c7d0ff').set(x + 2, y + 1, '#c7d0ff').set(x + 1, y + 2, '#c7d0ff').rect(x, y + 3, 4, 1, '#c7d0ff'), cls: 'zzz', style: `animation-delay:${d}s` }));

// ---------- rug ----------
bg.disc(150, 93, 46, 5, '#2b2350').disc(150, 93, 42, 4, '#3a2f6b').disc(150, 93, 30, 2.6, '#2b2350');

// ---------- desk ----------
bg.rect(98, 66, 104, 2, '#8a5a44').rect(98, 66, 104, 1, '#a36d53').rect(98, 68, 104, 1, '#5e3b2e')
  .rect(100, 69, 2, 15, '#4a2e25').rect(198, 69, 2, 15, '#4a2e25')
  .rect(180, 69, 18, 13, '#6b4435').rect(180, 75, 18, 1, '#4a2e25').rect(188, 71, 2, 1, P.amber).rect(188, 78, 2, 1, P.amber)
  .rect(104, 71, 9, 13, '#0b0c1c').rect(104, 71, 9, 1, '#22254a');
anim.push({ c: new Canvas().rect(106, 73, 1, 9, P.cyan), cls: 'hue' });

const monitor = (x, y, w, h) => {
  const cx = x + (w >> 1);
  bg.rect(cx - 1, y + h, 2, 66 - y - h, P.ink).rect(cx - 4, 65, 8, 1, P.ink)
    .rect(x, y, w, h, P.ink).rect(x + 1, y + 1, w - 2, h - 2, P.screen);
};
monitor(104, 47, 23, 15); monitor(130, 44, 40, 18); monitor(174, 42, 13, 21);

// left screen: scrolling code
{
  const c = new Canvas();
  const cols = [P.pink, P.cyan, '#c9d2ff', P.green, P.amber, '#8b93c9'];
  const pattern = Array.from({ length: 6 }, (_, i) => ({ indent: [0, 2, 4, 4, 2, 0][i], segs: [ri(2, 5), ri(2, 6), ri(0, 4)], col: ri(0, 5) }));
  for (let i = 0; i < 14; i++) {
    const p = pattern[i % 6];
    let x = 106 + p.indent;
    p.segs.forEach((w, k) => { if (w) { c.rect(x, 49 + i * 2, w, 1, cols[(p.col + k * 2) % cols.length]); x += w + 1; } });
  }
  anim.push({ c, cls: 'scrA', clip: [105, 48, 21, 13] });
}
// centre screen: eval run log
bg.rect(131, 45, 38, 2, '#1b2444').set(132, 45, P.red).set(134, 45, P.amber).set(136, 45, P.green);
{
  const c = new Canvas();
  const status = [1, 1, 0, 1, 1];
  const widths = status.map(() => [ri(8, 16), ri(3, 5)]);
  for (let i = 0; i < 10; i++) {
    const y = 48 + i * 4, ok = status[i % 5], [w, ms] = widths[i % 5];
    if (ok) c.set(133, y + 1, P.green).set(134, y + 2, P.green).set(135, y + 1, P.green).set(136, y, P.green);
    else c.set(133, y, P.red).set(135, y, P.red).set(134, y + 1, P.red).set(133, y + 2, P.red).set(135, y + 2, P.red);
    c.rect(139, y + 1, w, 1, ok ? '#c9d2ff' : '#fca5a5').rect(167 - ms, y + 1, ms, 1, '#5b668f');
  }
  anim.push({ c, cls: 'scrB', clip: [131, 47, 38, 14] });
}
// right screen: bar chart
bg.rect(176, 44, 5, 1, '#5b668f').rect(175, 61, 11, 1, '#1b2444');
[[6, 10, 14], [8, 11, 13], [7, 13, 16]].forEach((hs, f) => {
  const c = new Canvas();
  hs.forEach((h, i) => c.rect(176 + i * 3, 61 - h, 2, h, [P.green, P.cyan, P.amber][i]));
  anim.push({ c, cls: 'f3', style: `animation-delay:${(f * 0.9).toFixed(1)}s` });
});

// lamp and mug
bg.rect(193, 65, 5, 1, P.ink).rect(195, 53, 1, 12, '#3a3d6e').line(195, 53, 191, 50, '#3a3d6e')
  .rect(188, 48, 6, 2, '#3a3d6e').rect(189, 50, 4, 1, '#ffe9a3');
bg.rect(127, 63, 3, 3, '#eef0ff').set(130, 64, '#eef0ff').rect(127, 63, 3, 1, '#6b4435');
[[[128, 61], [127, 59], [128, 57]], [[127, 61], [128, 59], [129, 57]], [[128, 60], [129, 58], [128, 56]]].forEach((pts, f) => {
  const c = new Canvas();
  pts.forEach(([x, y]) => c.set(x, y, '#9aa0c8'));
  anim.push({ c, cls: 'f3', style: `animation-delay:${(f * 0.9).toFixed(1)}s`, attrs: 'opacity="0.7"' });
});

// ---------- chair and person (foreground) ----------
fg.rect(142, 92, 16, 1, '#11122a').rect(142, 93, 2, 1, P.ink).rect(156, 93, 2, 1, P.ink).rect(149, 93, 2, 1, P.ink)
  .rect(149, 84, 2, 8, '#11122a').rect(140, 81, 20, 3, '#23263f')
  .rect(141, 67, 18, 14, '#2e3257').rect(142, 66, 16, 1, '#2e3257').rect(142, 67, 1, 13, '#3d4270').rect(141, 80, 18, 1, '#23263f')
  .rect(139, 64, 22, 3, '#2a9d77').rect(140, 63, 20, 1, '#2a9d77').rect(139, 66, 2, 6, '#2a9d77').rect(159, 66, 2, 6, '#2a9d77')
  .rect(140, 63, 20, 1, '#3fc497').rect(145, 61, 10, 3, '#1f7a5c')
  .disc(150, 57, 5.5, 5, P.hair)
  .rect(146, 52, 4, 1, '#3d4f8a').set(145, 53, '#3d4f8a')
  .rect(145, 51, 10, 1, '#cfd6ff').rect(144, 52, 1, 3, '#cfd6ff').rect(155, 52, 1, 3, '#cfd6ff')
  .rect(143, 55, 2, 5, P.pink).rect(155, 55, 2, 5, P.pink);

// ---------- neon sign ----------
const neon1 = new Canvas().glyphs(F5, 5, 91, 10, 'ZHUOLUN LI', '#aefcff', 2);
const neon2 = new Canvas().glyphs(F5, 5, 103, 27, 'FRANKLIN', '#ff8cc3', 2);

// ---------- assemble ----------
const clips = [];
const animSvg = anim.map(({ c, cls, style, clip, attrs }, i) => {
  let g = `<g class="${cls}"${style ? ` style="${style}"` : ''}${attrs ? ' ' + attrs : ''}>${c.svg()}</g>`;
  if (cls === 'f8') g = `<g class="bob">${g}</g>`;
  if (!clip) return g;
  clips.push(`<clipPath id="c${i}"><rect x="${clip[0]}" y="${clip[1]}" width="${clip[2]}" height="${clip[3]}"/></clipPath>`);
  return `<g clip-path="url(#c${i})">${g}</g>`;
}).join('\n');
const twSvg = tw.map((c, i) => `<g class="tw tw${i}">${c.svg()}</g>`).join('\n');
const px = (n) => n * S;
const glow = (id, cx, cy, rx, ry, color, o) =>
  [`<radialGradient id="${id}" cx="${px(cx)}" cy="${px(cy)}" r="${px(rx)}" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${px(cy) * (1 - ry / rx)}) scale(1 ${ry / rx})"><stop stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
    `<ellipse cx="${px(cx)}" cy="${px(cy)}" rx="${px(rx)}" ry="${px(ry)}" fill="url(#${id})"/>`];
const glows = [
  glow('g1', 150, 17, 80, 22, '#22d3ee', 0.34),
  glow('g2', 150, 34, 66, 20, '#ff4f9e', 0.34),
  glow('g3', 148, 56, 60, 26, '#4f7dff', 0.22),
  glow('g4', 240, 52, 26, 22, '#22d3ee', 0.30),
  glow('g5', 191, 58, 16, 14, '#ffd866', 0.30),
  glow('g6', 35, 36, 44, 34, '#6f7dff', 0.14),
];

const svg = `<svg width="${px(GW)}" height="${px(GH)}" viewBox="0 0 ${px(GW)} ${px(GH)}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Zhuolun Li / Franklin</title>
<desc id="desc">Pixel art of a developer's room at night: a neon sign reading Zhuolun Li, Franklin; a desk with three monitors running evals; a holographic cube on a workbench; a cat asleep on the bed; a city skyline through the window.</desc>
<style>
.tw{animation:tw 3s steps(1) infinite}.tw1{animation-duration:2.3s;animation-delay:-1s}.tw2{animation-duration:4.1s;animation-delay:-2s}.tw3{animation-duration:1.7s}.tw4{animation-duration:5.3s;animation-delay:-3s}.tw5{animation-duration:2.9s;animation-delay:-.6s}
@keyframes tw{0%,100%{opacity:1}55%{opacity:.25}75%{opacity:1}}
.blink{animation:bl 1.2s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.breath{animation:bl 3.2s steps(1) infinite}
.f3,.f8{visibility:hidden}
.f3{animation:f3 2.7s steps(1) infinite}@keyframes f3{0%{visibility:visible}33.3%,100%{visibility:hidden}}
.f8{animation:f8 1.28s steps(1) infinite}@keyframes f8{0%{visibility:visible}12.5%,100%{visibility:hidden}}
.scrA{animation:sa 2.4s steps(6) infinite}@keyframes sa{to{transform:translateY(-12px)}}
.scrB{animation:sb 6s steps(5) infinite}@keyframes sb{to{transform:translateY(-20px)}}
.zzz{opacity:0;animation:zz 2.4s steps(6) infinite}@keyframes zz{0%{opacity:0;transform:translate(0,2px)}20%{opacity:1}100%{opacity:0;transform:translate(-3px,-5px)}}
.hue{animation:hu 4s steps(4) infinite}@keyframes hu{to{filter:hue-rotate(360deg)}}
.n1{animation:n1 7s steps(1) infinite}@keyframes n1{0%,100%{opacity:1}46%{opacity:.55}47%{opacity:1}}
.n2{animation:n2 5s steps(1) infinite}@keyframes n2{0%,100%{opacity:1}70%{opacity:.3}72%{opacity:1}74%{opacity:.45}76%{opacity:1}}
.bob{animation:bob 3s steps(3) infinite alternate}@keyframes bob{to{transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.f3,.f8{visibility:visible}}
</style>
<defs>
<clipPath id="frame"><rect width="${px(GW)}" height="${px(GH)}" rx="20"/></clipPath>
${clips.join('')}
${glows.map((g) => g[0]).join('\n')}
<radialGradient id="vig" cx="${px(150)}" cy="${px(46)}" r="${px(190)}" gradientUnits="userSpaceOnUse"><stop offset="0.45" stop-color="#03040c" stop-opacity="0"/><stop offset="1" stop-color="#03040c" stop-opacity="0.72"/></radialGradient>
<linearGradient id="cone" x1="0" y1="${px(62)}" x2="0" y2="${px(42)}" gradientUnits="userSpaceOnUse"><stop stop-color="#7df9ff" stop-opacity="0.34"/><stop offset="1" stop-color="#7df9ff" stop-opacity="0"/></linearGradient>
</defs>
<g clip-path="url(#frame)">
<g transform="scale(${S})" shape-rendering="crispEdges">
${bg.svg()}
${twSvg}
<g class="n1"><g opacity="0.35">${neon1.halo('#22d3ee').svg()}</g>${neon1.svg()}</g>
<g class="n2"><g opacity="0.35">${neon2.halo('#ff4f9e').svg()}</g>${neon2.svg()}</g>
</g>
<path d="M${px(237)} ${px(62)}L${px(229)} ${px(42)}H${px(251)}L${px(243)} ${px(62)}Z" fill="url(#cone)"/>
<g transform="scale(${S})" shape-rendering="crispEdges">
${animSvg}
${fg.svg()}
</g>
<g style="mix-blend-mode:screen">
${glows.map((g) => g[1]).join('\n')}
</g>
<rect width="${px(GW)}" height="${px(GH)}" fill="url(#vig)"/>
</g>
</svg>
`;

const out = fileURLToPath(new URL('../assets/banner.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`);
