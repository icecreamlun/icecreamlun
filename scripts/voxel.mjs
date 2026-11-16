// Shared helpers: a 2D cell canvas and a lit isometric voxel rasteriser.
// Voxels are drawn with a painter's algorithm in 2:1 dimetric projection
// (4x4 cells per voxel). Each visible face is shaded from real lights:
// ambient with occlusion, directional lights with ray-marched soft shadows,
// and point lights with falloff.

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
  diff(base) { // cells of `this` that differ from `base`; cells that vanished are skipped
    const out = new Canvas();
    for (const [k, c] of this.m) if (base.m.get(k) !== c) out.m.set(k, c);
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

// ---------- voxel scene ----------
// Voxel options:
//   e            emissive: drawn unlit in its own colour
//   ex, ey, et   emissive colour for the +x / +y / top face only
//   fx, fy, ft   lit albedo override for the +x / +y / top face only
//   glass        does not block light rays
//   flat         shaded without occlusion or shadows, for a clean cartoon look
const PAD = 4, NX = 176, NY = 104, NZ = 56;
const idx = (x, y, z) => ((x + PAD) * NY + (y + PAD)) * NZ + (z + PAD);
export class Scene {
  constructor() { this.v = new Map(); }
  set(x, y, z, c, o) { this.v.set(idx(x, y, z), { x, y, z, c, ...o }); return this; }
  get(x, y, z) { return this.v.get(idx(x, y, z)); }
  del(x, y, z) { this.v.delete(idx(x, y, z)); return this; }
  box(x0, y0, z0, x1, y1, z1, c, o) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
      this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, o);
    return this;
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, c, o) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2 <= 1)
            this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, o);
    return this;
  }
  // the voxel nearest the viewer along +y for a given x, z within [y0, y1]
  front(x, z, y0, y1) {
    for (let y = y1; y >= y0; y--) { const v = this.get(x, y, z); if (v) return v; }
    return null;
  }
}

const rgbCache = new Map();
const rgb = (hex) => {
  if (!rgbCache.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    rgbCache.set(hex, [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
  }
  return rgbCache.get(hex);
};
const q = (v) => Math.max(0, Math.min(255, Math.round(v * 255 / 8) * 8));
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => q(v).toString(16).padStart(2, '0')).join('');
const norm = ([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };

const CELLS = [
  [[-1, 0], [0, 0], [-1, 1], [0, 1]],     // top
  [[0, 2], [0, 3], [1, 1], [1, 2]],       // +x
  [[-1, 2], [-1, 3], [-2, 1], [-2, 2]],   // +y
];
const NORMALS = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
const TANGENTS = [[[1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 1]], [[1, 0, 0], [0, 0, 1]]];
const FACE_AMB = [1, 0.9, 0.8];
const SOFT = [[0, 1, 0.4], [0, -1, -0.4], [0, 0.4, -1], [0, -0.4, 1]];

// cfg: { ox, oy, ambient:[r,g,b], lights:[...], ceiling, xMin, cache }
//   light: { dir:[x,y,z] (towards the light), color, soft, windowed }
//        | { pos:[x,y,z], color, radius }
// `windowed` lights only enter through openings in the x < xMin wall: rays that
// rise above `ceiling` or leave any other side count as blocked.
export function renderLit(scene, cfg) {
  const { ox, oy, ambient, lights, ceiling = 1e9, xMin = -1e9, cache } = cfg;
  const occ = new Uint8Array(NX * NY * NZ), pres = new Uint8Array(NX * NY * NZ);
  for (const [k, v] of scene.v) { pres[k] = 1; if (!v.glass) occ[k] = 1; }
  const inb = (x, y, z) => x >= -PAD && x < NX - PAD && y >= -PAD && y < NY - PAD && z >= -PAD && z < NZ - PAD;
  const solid = (x, y, z) => inb(x, y, z) && occ[idx(x, y, z)] === 1;
  const blocked = (p, d, maxT, windowed) => {
    for (let t = 0.3; t < maxT; t += 0.45) {
      const x = Math.floor(p[0] + d[0] * t), y = Math.floor(p[1] + d[1] * t), z = Math.floor(p[2] + d[2] * t);
      if (windowed) { if (z > ceiling) return true; if (x < xMin) return false; }
      if (!inb(x, y, z)) return windowed;
      if (occ[idx(x, y, z)]) return true;
    }
    return false;
  };
  const dirLights = lights.filter((l) => l.dir).map((l) => ({ ...l, dir: norm(l.dir) }));
  const pointLights = lights.filter((l) => l.pos);

  const light = (v, f) => {
    const ck = idx(v.x, v.y, v.z) * 3 + f;
    if (cache && cache.has(ck)) return cache.get(ck);
    const n = NORMALS[f], [tu, tv] = TANGENTS[f];
    const c = [v.x + n[0], v.y + n[1], v.z + n[2]];
    const p = [v.x + 0.5 + n[0] * 0.52, v.y + 0.5 + n[1] * 0.52, v.z + 0.5 + n[2] * 0.52];
    let acc = 0, tot = 0;
    for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) {
      if (!du && !dv) continue;
      const w = 1 / (Math.abs(du) + Math.abs(dv));
      tot += w;
      if (solid(c[0] + tu[0] * du + tv[0] * dv, c[1] + tu[1] * du + tv[1] * dv, c[2] + tu[2] * du + tv[2] * dv)) acc += w;
    }
    const ao = v.flat ? 1 : 1 - 0.62 * (acc / tot) ** 0.7;
    const out = ambient.map((a) => a * FACE_AMB[f] * ao);
    for (const L of dirLights) {
      const nd = n[0] * L.dir[0] + n[1] * L.dir[1] + n[2] * L.dir[2];
      if (nd <= 0) continue;
      let lit = 0;
      const samples = L.soft ? SOFT : [[0, 0, 0]];
      for (const s of samples) {
        const d = norm([L.dir[0] + s[0] * (L.soft || 0), L.dir[1] + s[1] * (L.soft || 0), L.dir[2] + s[2] * (L.soft || 0)]);
        if (v.flat ? !L.windowed : !blocked(p, d, 90, L.windowed)) lit++;
      }
      const k = nd * lit / samples.length;
      for (let i = 0; i < 3; i++) out[i] += L.color[i] * k;
    }
    for (const L of pointLights) {
      const vx = L.pos[0] - p[0], vy = L.pos[1] - p[1], vz = L.pos[2] - p[2];
      const dist = Math.hypot(vx, vy, vz);
      const att = Math.max(0, 1 - dist / L.radius) ** 2;
      if (att < 0.004) continue;
      const d = [vx / dist, vy / dist, vz / dist];
      const nd = Math.max(0, (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] + 0.2) / 1.2);
      if (nd <= 0 || (!v.flat && blocked(p, d, dist - 0.7, false))) continue;
      for (let i = 0; i < 3; i++) out[i] += L.color[i] * nd * att;
    }
    if (cache) cache.set(ck, out);
    return out;
  };

  const fb = new Canvas();
  const list = [...scene.v.values()].sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
  const E = ['et', 'ex', 'ey'], F = ['ft', 'fx', 'fy'], NB = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
  for (const v of list) {
    const sx = ox + 2 * (v.x - v.y), sy = oy + v.x + v.y - 2 * v.z;
    for (let f = 0; f < 3; f++) {
      const nb = NB[f];
      if (inb(v.x + nb[0], v.y + nb[1], v.z + nb[2]) && pres[idx(v.x + nb[0], v.y + nb[1], v.z + nb[2])]) continue;
      let hex;
      if (v[E[f]]) hex = v[E[f]];
      else if (v.e) hex = v.c;
      else {
        const a = rgb(v[F[f]] || v.c), l = light(v, f);
        hex = toHex(a[0] * l[0], a[1] * l[1], a[2] * l[2]);
      }
      for (const [i, j] of CELLS[f]) fb.set(sx + i, sy + j, hex);
    }
  }
  return fb;
}

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";
