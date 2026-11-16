// Generates assets/banner.svg: an isometric voxel room rendered as pixel art.
// The room is a real 3D voxel model. It is rasterised here onto a 400x140 cell
// grid (3px cells) with a painter's algorithm; every animation frame is rendered
// the same way and stored as a diff layer toggled by CSS, because GitHub strips
// scripts from READMEs.
// Usage: node scripts/gen-banner.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GW = 400, GH = 146, S = 3;      // grid cells and cell size in px
const W = 44, D = 44, H = 22;         // room size in voxels
const OX = 293, OY = 2 * H + 5;       // screen cell of the room's back corner
const BG = '#0a0c20';

let seed = 11;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const shadeCache = new Map();
const shade = (hex, k) => {
  const key = hex + k;
  if (!shadeCache.has(key)) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
    shadeCache.set(key, `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`);
  }
  return shadeCache.get(key);
};

// ---------- 2D pixel canvas ----------
class Canvas {
  constructor() { this.m = new Map(); }
  set(x, y, c) { this.m.set(y * 1000 + x, c); return this; }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
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
  halo(c) {
    const out = new Canvas();
    for (const k of this.m.keys()) {
      const x = k % 1000, y = Math.floor(k / 1000);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
        if (!this.m.has((y + j) * 1000 + x + i)) out.set(x + i, y + j, c);
    }
    return out;
  }
  diff(base) { // cells of `this` that differ from `base`
    const out = new Canvas();
    for (const [k, c] of this.m) if (base.m.get(k) !== c) out.m.set(k, c);
    for (const k of base.m.keys()) if (!this.m.has(k)) out.m.set(k, BG);
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
      byColor.set(c, (byColor.get(c) || '') + `M${k % 1000} ${Math.floor(k / 1000)}h${n}v1h-${n}z`);
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
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['###', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};

// ---------- palette ----------
const P = {
  cyan: '#7df9ff', pink: '#ff6fb1', green: '#34d399', amber: '#fbbf24', red: '#f87171',
  wall: '#34386f', wallLow: '#262a57', floorA: '#6d4b5c', floorB: '#604252', slab: '#33263d',
  wood: '#a36d53', woodDark: '#6b4435', metal: '#59607f', dark: '#11132a', hair: '#1b1426',
};

// ---------- precomputed random detail (must be identical across frames) ----------
const skyline = Array.from({ length: 18 }, () => ri(1, 5));
const cityLights = [];
skyline.forEach((h, i) => { for (let z = 0; z < h; z++) if (rand() < 0.4) cityLights.push({ i, z, b: ri(0, 4), c: rand() < 0.8 ? '#ffd866' : '#9fd8ff' }); });
const skyStars = Array.from({ length: 7 }, () => ({ i: ri(0, 17), z: ri(5, 7), b: ri(0, 4) }));
const books = Array.from({ length: 9 }, () => ({ h: ri(2, 3), c: pick(['#f87171', '#60a5fa', '#fbbf24', '#34d399', '#c084fc', '#e9dcc5']) }));
const codeRows = Array.from({ length: 6 }, () => ({ indent: ri(0, 2), a: ri(1, 3), b: ri(1, 2), c1: pick([P.pink, P.cyan, P.amber]), c2: pick(['#c9d2ff', P.green]) }));
const logRows = [1, 1, 0, 1, 1, 1].map((ok) => ({ ok, w: ri(3, 6) }));
const rackLeds = Array.from({ length: 7 }, () => ({ c: pick([P.amber, P.cyan, P.green]), b1: ri(0, 4), b2: ri(0, 4) }));

// ---------- scene ----------
function buildScene(st = {}) {
  const vox = new Map();
  const key = (x, y, z) => (x + 2) * 10000 + (y + 2) * 100 + (z + 2);
  const set = (x, y, z, c, o) => vox.set(key(x, y, z), { x, y, z, c, ...o });
  const box = (x0, y0, z0, x1, y1, z1, c, o) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, c, o);
  };
  const off = (b) => st.off === b;
  const lit = (x, y, z, c, b, o = {}) => set(x, y, z, off(b) ? shade(c, 0.3) : c, { e: true, ...o });

  // floor and walls
  for (let x = 0; x < W; x++) for (let y = 0; y < D; y++) {
    const plank = Math.floor(y / 3);
    const seam = (x + plank * 7) % 13 === 0;
    set(x, y, 0, seam ? shade(P.floorB, 0.85) : plank % 2 ? P.floorA : P.floorB);
    set(x, y, -1, P.slab);
    const d = ((x - 21) / 10) ** 2 + ((y - 15) / 8) ** 2;   // rug
    if (d <= 1) set(x, y, 0, d > 0.78 ? '#6a5ccf' : d > 0.5 ? '#3a2f6b' : '#4a3d8a');
  }
  for (let i = 0; i < W; i++) for (let z = 1; z <= H; z++) {
    const c = z <= 2 ? P.wallLow : P.wall;
    set(0, i, z, c); set(i, 0, z, c);
  }
  // string lights along the wall tops
  for (let i = 2; i < W; i += 4) {
    const cols = [P.amber, P.pink, P.cyan, P.green];
    lit(0, i, H, cols[(i >> 2) % 4], (i >> 2) % 5);
    lit(i, 0, H, cols[((i >> 2) + 2) % 4], ((i >> 2) + 3) % 5);
  }

  // window on the left wall (x = 0)
  box(0, 8, 6, 0, 27, 16, '#5a5fa6');
  const sky = ['#1a1f58', '#161b4d', '#121745', '#0f143c', '#0d1136', '#0b0f30', '#0a0d2a', '#090c26', '#080a22'];
  for (let i = 0; i < 18; i++) for (let z = 7; z <= 15; z++) {
    const y = 26 - i;
    set(0, y, z, z - 7 < skyline[i] ? '#060817' : sky[z - 7], { e: true });
  }
  cityLights.forEach(({ i, z, b, c }) => lit(0, 26 - i, 7 + z, c, b));
  skyStars.forEach(({ i, z, b }) => lit(0, 26 - i, 8 + z, '#e8ecff', b));
  box(0, 11, 13, 0, 12, 14, '#fdf6c9', { e: true });
  box(0, 17, 7, 0, 17, 15, '#5a5fa6');
  box(1, 7, 6, 1, 28, 6, '#7479c4');

  // poster on the left wall
  box(0, 32, 8, 0, 39, 16, '#e9dcc5', { e: true });
  box(0, 33, 11, 0, 38, 14, '#ff9ec4', { e: true });
  set(0, 34, 13, P.hair, { e: true }); set(0, 37, 13, P.hair, { e: true });
  set(0, 32, 12, '#e0508f', { e: true }); set(0, 39, 12, '#e0508f', { e: true });
  set(0, 32, 14, '#e0508f', { e: true }); set(0, 39, 14, '#e0508f', { e: true });

  // bed along the left wall, with a cat
  box(1, 23, 1, 12, 23, 7, P.woodDark);
  box(1, 24, 1, 12, 43, 2, P.woodDark);
  box(1, 24, 3, 12, 43, 3, '#d5d9f2');
  box(3, 25, 4, 10, 28, 4, '#f4f5ff');
  box(1, 31, 4, 12, 43, 4, '#c0394b');
  box(1, 35, 4, 12, 36, 4, '#2f4fa8');
  box(4, 38, 5, 8, 41, 6, '#e89a3c');
  if (st.cat) box(5, 38, 7, 7, 40, 7, '#e89a3c');
  set(5, 39, st.cat ? 7 : 6, '#c97a22'); set(7, 40, 6, '#c97a22');
  box(9, 39, 5, 11, 41, 7, '#e89a3c');
  set(9, 41, 8, '#e89a3c'); set(11, 41, 8, '#e89a3c');
  set(9, 41, 6, '#e89a3c', { fy: P.hair }); set(11, 41, 6, '#e89a3c', { fy: P.hair });
  box(3, 39, 5, 3, 42, 5, '#c97a22');

  // shelf, books and plant on the right wall
  box(2, 1, 11, 13, 2, 11, P.wood);
  books.forEach((b, i) => box(3 + i, 1, 12, 3 + i, 2, 11 + b.h, b.c));
  box(2, 2, 1, 4, 4, 2, '#b8643e');
  box(2, 2, 3, 4, 4, 5, '#2f9e6a'); box(3, 3, 6, 3, 3, 7, '#3fc487'); set(1, 3, 5, '#3fc487'); set(5, 3, 4, '#2f9e6a'); set(3, 5, 4, '#3fc487');

  // desk
  box(15, 1, 7, 37, 8, 7, P.wood);
  box(15, 1, 1, 15, 1, 6, P.woodDark); box(15, 8, 1, 15, 8, 6, P.woodDark); box(37, 8, 1, 37, 8, 6, P.woodDark);
  box(31, 2, 3, 36, 8, 6, P.woodDark);
  set(33, 8, 5, P.woodDark, { fy: P.amber }); set(34, 8, 5, P.woodDark, { fy: P.amber });
  box(17, 2, 1, 19, 6, 5, P.dark);
  for (let z = 2; z <= 4; z++) set(18, 6, z, P.dark, { fy: st.rgb ? P.pink : P.cyan });
  // monitors: screens are the +y faces
  box(19, 2, 8, 20, 2, 8, P.dark); box(28, 2, 8, 30, 2, 8, P.dark);
  for (let i = 0; i < 7; i++) for (let r = 0; r < 5; r++) {       // code
    const row = codeRows[(r + (st.code || 0)) % codeRows.length];
    const col = i < row.indent ? '#0b1022' : i < row.indent + row.a ? row.c1 : i < row.indent + row.a + row.b ? '#4a5aa8' : '#0b1022';
    set(16 + i, 2, 13 - r, P.dark, { fy: col });
  }
  for (let i = 0; i < 10; i++) for (let r = 0; r < 6; r++) {       // eval log
    const row = logRows[(r + (st.log || 0)) % logRows.length];
    const col = i === 0 ? (row.ok ? P.green : P.red) : i >= 2 && i < 2 + row.w ? (row.ok ? '#4a5aa8' : '#b85c6e') : '#0b1022';
    set(24 + i, 2, 14 - r, P.dark, { fy: col });
  }
  box(15, 2, 14, 23, 2, 14, '#2a2d55'); box(23, 2, 9, 23, 2, 14, '#2a2d55');
  box(23, 2, 15, 34, 2, 15, '#2a2d55'); box(34, 2, 9, 34, 2, 15, '#2a2d55');
  box(18, 5, 8, 22, 6, 8, '#8b93c9');
  set(25, 6, 8, '#f4f5ff'); set(25, 6, 9, '#f4f5ff');
  box(35, 3, 8, 36, 4, 8, P.dark); box(35, 3, 9, 35, 3, 12, '#7479c4'); box(34, 3, 12, 34, 4, 12, '#7479c4');
  set(34, 4, 11, '#ffe9a3', { e: true });

  // chair and person, facing the desk
  box(21, 12, 1, 22, 13, 3, P.dark);
  box(19, 12, 1, 24, 13, 1, P.dark); box(21, 10, 1, 22, 15, 1, P.dark);
  box(19, 10, 4, 24, 14, 4, '#2e3257');
  box(19, 15, 5, 24, 15, 8, '#4a5088');
  box(20, 8, 5, 23, 11, 5, '#2b3a67');
  box(20, 11, 6, 23, 13, 9, '#2a9d77');
  box(20, 8, 8, 20, 10, 8, '#2a9d77'); box(23, 8, 8, 23, 10, 8, '#2a9d77');
  box(20, 11, 10, 23, 13, 13, P.hair);
  set(23, 11, 10, '#e8b796'); set(23, 11, 11, '#e8b796');
  box(20, 12, 14, 23, 12, 14, '#cfd6ff');
  box(24, 12, 11, 24, 12, 13, P.pink); box(19, 12, 11, 19, 12, 13, P.pink);

  // server rack
  box(38, 1, 1, 43, 5, 15, '#171a36');
  rackLeds.forEach((l, i) => {
    const z = 2 + i * 2;
    set(39, 5, z, '#171a36', { fy: off(l.b1) ? '#0a3d2a' : P.green });
    set(40, 5, z, '#171a36', { fy: off(l.b2) ? shade(l.c, 0.3) : l.c });
    set(42, 5, z, '#171a36', { fy: '#0a0b18' }); set(43, 5, z, '#171a36', { fy: '#0a0b18' });
  });

  // neon sign above the desk
  const neonC = st.neonDim ? '#7a3558' : '#ff7ab8';
  'EVALS'.split('').forEach((ch, n) => F3[ch].forEach((row, j) => [...row].forEach((bit, i) => {
    if (bit === '#') set(17 + n * 4 + i, 0, 20 - j, P.wall, { fy: neonC });
  })));

  // hologram pedestal with a rotating wireframe octahedron
  box(27, 35, 1, 32, 40, 2, '#2a2f4a');
  box(28, 36, 3, 31, 39, 3, '#454c75');
  box(29, 37, 3, 30, 38, 3, P.cyan, { e: true });
  const th = (Math.PI / 2) * ((st.holo || 0) / 4) + 0.3;
  const hv = [[0, 0, 6], [0, 0, -6], ...[0, 1, 2, 3].map((k) => [5.2 * Math.cos(th + k * Math.PI / 2), 5.2 * Math.sin(th + k * Math.PI / 2), 0])];
  const he = [[2, 3], [3, 4], [4, 5], [5, 2], ...[2, 3, 4, 5].flatMap((k) => [[0, k], [1, k]])];
  he.forEach(([a, b], n) => {
    for (let t = 0; t <= 1.0001; t += 1 / 18) {
      const p = [0, 1, 2].map((i) => hv[a][i] + (hv[b][i] - hv[a][i]) * t);
      set(Math.round(29.5 + p[0]), Math.round(37.5 + p[1]), Math.round(12 + p[2]), n < 4 ? '#c8fdff' : '#5fe3f0');
    }
  });

  // helper robot
  box(12, 38, 1, 13, 39, 1, P.dark); box(15, 38, 1, 16, 39, 1, P.dark); box(12, 41, 1, 13, 42, 1, P.dark); box(15, 41, 1, 16, 42, 1, P.dark);
  box(12, 38, 2, 16, 42, 4, '#aab2d5');
  box(13, 39, 5, 15, 41, 7, '#d7dcf5');
  set(13, 41, 6, '#d7dcf5', { fy: st.botBlink ? '#d7dcf5' : P.cyan }); set(15, 41, 6, '#d7dcf5', { fy: st.botBlink ? '#d7dcf5' : P.cyan });
  set(14, 42, 3, '#aab2d5', { fy: P.amber });
  set(14, 40, 8, '#59607f'); set(14, 40, 9, st.botBlink ? '#7a2b2b' : P.red, { e: true });

  return vox;
}

// ---------- isometric rasteriser ----------
const TOP = [[-1, 0], [0, 0], [-1, 1], [0, 1]];
const RIGHT = [[0, 2], [0, 3], [1, 1], [1, 2]];   // +x face
const LEFT = [[-1, 2], [-1, 3], [-2, 1], [-2, 2]]; // +y face
function render(vox) {
  const fb = new Canvas();
  const has = (x, y, z) => vox.has((x + 2) * 10000 + (y + 2) * 100 + (z + 2));
  const list = [...vox.values()].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  for (const v of list) {
    const sx = OX + 2 * (v.x - v.y), sy = OY + v.x + v.y - 2 * v.z;
    const paint = (cells, c) => cells.forEach(([i, j]) => fb.set(sx + i, sy + j, c));
    if (!has(v.x, v.y, v.z + 1)) paint(TOP, v.e ? v.c : shade(v.c, 1.18));
    if (!has(v.x + 1, v.y, v.z)) paint(RIGHT, v.e ? v.c : shade(v.c, 0.86));
    if (!has(v.x, v.y + 1, v.z)) paint(LEFT, v.fy || (v.e ? shade(v.c, 0.92) : shade(v.c, 0.62)));
  }
  return fb;
}
const project = (x, y, z) => [(OX + 2 * (x - y)) * S, (OY + x + y - 2 * z + 2) * S];

const base = render(buildScene());
const layers = []; // { svg, cls, style }
const frame = (st, cls, style) => layers.push({ svg: render(buildScene(st)).diff(base).svg(), cls, style });
const cycle = (name, n, period, mk) => {
  for (let f = 1; f < n; f++) frame(mk(f), 'fr', `animation:cyc${n} ${period}s steps(1) ${(f * period / n).toFixed(2)}s infinite`);
};
cycle('holo', 4, 0.8, (f) => ({ holo: f }));
cycle('code', 6, 3, (f) => ({ code: f }));
cycle('log', 6, 7.2, (f) => ({ log: f }));
cycle('cat', 2, 3.2, () => ({ cat: 1 }));
cycle('rgb', 2, 2.6, () => ({ rgb: 1 }));
[2.3, 3.1, 4.7, 1.9, 5.3].forEach((dur, b) => frame({ off: b }, 'fr', `animation:tw ${dur}s steps(1) -${(b * 0.7).toFixed(1)}s infinite`));
frame({ neonDim: 1 }, 'fr', 'animation:flick 6s steps(1) infinite');
frame({ botBlink: 1 }, 'fr', 'animation:flick 4.3s steps(1) -2s infinite');

// ---------- left-hand text and sky ----------
const neon1 = new Canvas().glyphs(F5, 5, 14, 22, 'ZHUOLUN LI', '#aefcff', 3);
const neon2 = new Canvas().glyphs(F5, 5, 14, 50, 'FRANKLIN', '#ff8cc3', 3);
const tag = new Canvas()
  .glyphs(F3, 3, 14, 84, 'AI CODING AGENTS', '#c9d2ff', 2)
  .glyphs(F3, 3, 14, 99, 'EVALS + AUTOMATION', '#8b93c9', 2);
const cursor = new Canvas().rect(160, 99, 6, 10, P.green);
const starBuckets = Array.from({ length: 4 }, () => new Canvas());
for (let i = 0; i < 90; i++) pick(starBuckets).set(ri(0, GW - 1), ri(0, GH - 1), pick(['#3b4380', '#5b64a8', '#8b93c9', '#c9d2ff']));
const [catX, catY] = project(10, 41, 9).map((v) => Math.round(v / S));
const zzz = [[0, 0, 0], [-4, -5, 1.2]].map(([dx, dy, d]) => {
  const x = catX + dx, y = catY + dy;
  const c = new Canvas().rect(x, y, 4, 1, '#c7d0ff').set(x + 2, y + 1, '#c7d0ff').set(x + 1, y + 2, '#c7d0ff').rect(x, y + 3, 4, 1, '#c7d0ff');
  return `<g class="zzz" style="animation-delay:${d}s">${c.svg()}</g>`;
}).join('');

const glowDefs = [], glowEls = [];
const glow = (id, [cx, cy], rx, ry, color, o) => {
  glowDefs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${rx}" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${cy * (1 - ry / rx)}) scale(1 ${ry / rx})"><stop stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
  glowEls.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id})"/>`);
};
glow('g1', [300, 108], 300, 80, '#22d3ee', 0.26);
glow('g2', [260, 190], 260, 70, '#ff4f9e', 0.24);
glow('g3', project(26, 1, 18), 110, 60, '#ff4f9e', 0.36);
glow('g4', project(26, 3, 10), 120, 70, '#4f7dff', 0.30);
glow('g5', project(29.5, 37.5, 11), 80, 80, '#22d3ee', 0.30);
glow('g6', project(0, 17, 11), 110, 90, '#6f7dff', 0.20);
glow('g7', project(34, 5, 10), 50, 44, '#ffd866', 0.34);
const [rcx, rcy] = project(W / 2, D / 2, 0);

const svg = `<svg width="${GW * S}" height="${GH * S}" viewBox="0 0 ${GW * S} ${GH * S}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Zhuolun Li / Franklin</title>
<desc id="desc">Isometric pixel art of a developer's room at night: a desk with monitors running evals under a neon sign, a rotating hologram, a helper robot, a server rack, and a cat asleep on the bed.</desc>
<style>
.fr{visibility:hidden}
@keyframes cyc2{0%{visibility:visible}50%,100%{visibility:hidden}}
@keyframes cyc4{0%{visibility:visible}25%,100%{visibility:hidden}}
@keyframes cyc6{0%{visibility:visible}16.67%,100%{visibility:hidden}}
@keyframes tw{0%,100%{visibility:hidden}55%{visibility:visible}78%{visibility:hidden}}
@keyframes flick{0%,100%{visibility:hidden}70%{visibility:visible}72%{visibility:hidden}75%{visibility:visible}77%{visibility:hidden}}
.st{animation:st 3s steps(1) infinite}.st1{animation-duration:4.3s;animation-delay:-1s}.st2{animation-duration:2.1s;animation-delay:-.5s}.st3{animation-duration:5.9s;animation-delay:-2s}
@keyframes st{0%,100%{opacity:1}50%{opacity:.3}}
.blink{animation:bl 1.1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.n1{animation:n1 7s steps(1) infinite}@keyframes n1{0%,100%{opacity:1}46%{opacity:.55}47%{opacity:1}}
.n2{animation:n2 5s steps(1) infinite}@keyframes n2{0%,100%{opacity:1}70%{opacity:.35}72%{opacity:1}74%{opacity:.5}76%{opacity:1}}
.zzz{opacity:0;animation:zz 2.4s steps(6) infinite}@keyframes zz{0%{opacity:0;transform:translate(0,2px)}20%{opacity:1}100%{opacity:0;transform:translate(-3px,-6px)}}
.float{animation:fl 6s ease-in-out infinite alternate}@keyframes fl{to{transform:translateY(-6px)}}
.shadow{animation:sh 6s ease-in-out infinite alternate}@keyframes sh{to{opacity:.6}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
<clipPath id="frame"><rect width="${GW * S}" height="${GH * S}" rx="20"/></clipPath>
<linearGradient id="bg" x1="0" y1="0" x2="${GW * S}" y2="${GH * S}" gradientUnits="userSpaceOnUse"><stop stop-color="#070818"/><stop offset="0.6" stop-color="#0c0e2a"/><stop offset="1" stop-color="#150f33"/></linearGradient>
<radialGradient id="under" cx="${rcx}" cy="${rcy + 150}" r="330" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${(rcy + 150) * 0.78}) scale(1 0.22)"><stop stop-color="#000" stop-opacity="0.7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
${glowDefs.join('\n')}
</defs>
<g clip-path="url(#frame)">
<rect width="${GW * S}" height="${GH * S}" fill="url(#bg)"/>
<g transform="scale(${S})" shape-rendering="crispEdges">
${starBuckets.map((c, i) => `<g class="st st${i}">${c.svg()}</g>`).join('\n')}
</g>
<ellipse class="shadow" cx="${rcx}" cy="${rcy + 150}" rx="330" ry="72" fill="url(#under)"/>
<g style="mix-blend-mode:screen">${glowEls.slice(0, 2).join('')}</g>
<g transform="scale(${S})" shape-rendering="crispEdges">
<g class="n1"><g opacity="0.35">${neon1.halo('#22d3ee').svg()}</g>${neon1.svg()}</g>
<g class="n2"><g opacity="0.35">${neon2.halo('#ff4f9e').svg()}</g>${neon2.svg()}</g>
${tag.svg()}
<g class="blink">${cursor.svg()}</g>
</g>
<g class="float">
<g transform="scale(${S})" shape-rendering="crispEdges">
${base.svg()}
${layers.map((l) => `<g class="${l.cls}" style="${l.style}">${l.svg}</g>`).join('\n')}
${zzz}
</g>
<g style="mix-blend-mode:screen">${glowEls.slice(2).join('')}</g>
</g>
</g>
</svg>
`;

const out = fileURLToPath(new URL('../assets/banner.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB, ${layers.length} animation layers`);
