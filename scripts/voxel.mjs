// Shared pixel-art helpers: a 2D cell canvas, pixel fonts, and an isometric
// voxel rasteriser (painter's algorithm, 2:1 dimetric, 4x4 cells per voxel).

export const BG = '#0a0c20';

const shadeCache = new Map();
export const shade = (hex, k) => {
  const key = hex + k;
  if (!shadeCache.has(key)) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
    shadeCache.set(key, `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`);
  }
  return shadeCache.get(key);
};

export const makeRand = (seed) => {
  const rand = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  return { rand, ri, pick };
};

export class Canvas {
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
  halo(c) { // 1-cell outline around every lit cell, for neon glow
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

// ---------- voxels ----------
const vkey = (x, y, z) => (x + 2) * 10000 + (y + 2) * 100 + (z + 2);
export const makeVoxels = () => {
  const vox = new Map();
  const set = (x, y, z, c, o) => vox.set(vkey(x, y, z), { x, y, z, c, ...o });
  const box = (x0, y0, z0, x1, y1, z1, c, o) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, c, o);
  };
  return { vox, set, box };
};

const TOP = [[-1, 0], [0, 0], [-1, 1], [0, 1]];
const RIGHT = [[0, 2], [0, 3], [1, 1], [1, 2]];    // +x face
const LEFT = [[-1, 2], [-1, 3], [-2, 1], [-2, 2]]; // +y face
// Voxel options: e = emissive (unshaded), fy = colour override for the +y face.
export function renderIso(vox, ox, oy) {
  const fb = new Canvas();
  const has = (x, y, z) => vox.has(vkey(x, y, z));
  const list = [...vox.values()].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  for (const v of list) {
    const sx = ox + 2 * (v.x - v.y), sy = oy + v.x + v.y - 2 * v.z;
    const paint = (cells, c) => cells.forEach(([i, j]) => fb.set(sx + i, sy + j, c));
    if (!has(v.x, v.y, v.z + 1)) paint(TOP, v.e ? v.c : shade(v.c, 1.18));
    if (!has(v.x + 1, v.y, v.z)) paint(RIGHT, v.e ? v.c : shade(v.c, 0.86));
    if (!has(v.x, v.y + 1, v.z)) paint(LEFT, v.fy || (v.e ? shade(v.c, 0.92) : shade(v.c, 0.62)));
  }
  return fb;
}

// ---------- fonts ----------
export const F5 = {
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
export const F3 = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['###', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '###', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
};
