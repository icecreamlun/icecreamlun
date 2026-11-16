// Generates assets/banner-dark.svg and assets/banner-light.svg: an isometric
// voxel room, lit at night (dark theme) and by day (light theme).
// The room is a real 3D voxel model, shaded and rasterised onto a 2px cell grid.
// Animation frames are rendered the same way and stored as diff layers toggled
// by CSS, because GitHub strips scripts from READMEs.
// Usage: node scripts/gen-banner.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Canvas, FONT, Scene, makeRand, renderLit } from './voxel.mjs';

const GW = 600, GH = 232, S = 2;      // grid cells and cell size in px
const W = 72, H = 30;                 // room footprint (square) and wall height, in voxels
const OX = 442, OY = 72;              // screen cell of the room's back corner

const C = {
  wallL: '#ded8cc', wallR: '#64798b', cut: '#f3eee5', trim: '#f4f1ea',
  wood: ['#c9a074', '#c2976a', '#d0a87c'], seam: '#aa8359', slab: '#a17c56',
  walnut: '#8a623f', oak: '#b58a5c', white: '#f4f2ee', linen: '#e4d9c6', terracotta: '#c56f52',
  dark: '#25272e', metal: '#8f939c', red: '#c8372f', redDark: '#a92c26', skin: '#e6b89c', hair: '#35292b',
  black: '#0e0f12', cat: '#97a5ba', catDark: '#7b89a0', leaf: ['#5c8a5e', '#6a9a68', '#4f7d55'],
};
const SYNTAX = ['#e06c75', '#98c379', '#61afef', '#e5c07b', '#c678dd', '#abb2bf'];

// ---------- random detail, fixed across frames and themes ----------
const { rand, ri, pick } = makeRand(23);
const plankTone = Array.from({ length: 40 }, () => Array.from({ length: 8 }, () => ri(0, 2)));
const skyline = Array.from({ length: 29 }, () => ri(2, 7));
for (let i = 1; i < skyline.length; i++) if (rand() < 0.6) skyline[i] = skyline[i - 1];
const cityLit = skyline.map((h) => Array.from({ length: h }, () => rand() < 0.22));
const stars = Array.from({ length: 9 }, () => [ri(0, 28), ri(9, 15)]);
const books1 = [], books2 = [];
for (let x = 4; x <= 14;) { const w = ri(1, 2); books1.push({ x, w, h: ri(3, 5), c: pick(['#b5533c', '#3f5f7a', '#d9b25f', '#6a8f6b', '#e9e4da', '#7a5c7e', '#2f4858']) }); x += w; }
for (let x = 9; x <= 18;) { const w = ri(1, 2); books2.push({ x, w, h: ri(3, 4), c: pick(['#3f5f7a', '#e9e4da', '#b5533c', '#d9b25f', '#2f4858']) }); x += w; }
const codeRows = Array.from({ length: 7 }, (_, i) => i === 3 ? null : ({ indent: ri(0, 3), segs: Array.from({ length: ri(1, 3) }, () => ({ w: ri(1, 3), c: pick(SYNTAX) })) }));
const termRows = [1, 1, 1, 0, 1, 1].map((ok) => ({ ok, w: ri(2, 5) }));

// ---------- scene ----------
function buildScene(st, night) {
  const s = new Scene();

  // floor: oak planks running along x
  for (let x = -2; x < W; x++) for (let y = -2; y < W; y++) {
    const plank = Math.floor((y + 2) / 4), seg = Math.floor((x + 2 + plank * 11) / 19);
    const seam = (y + 2) % 4 === 0 || (x + 2 + plank * 11) % 19 === 0;
    let c = seam ? C.seam : C.wood[plankTone[plank % 40][seg % 8]];
    const d = Math.hypot(x - 44, y - 47) / 15;   // round rug
    if (d <= 1) c = d > 0.9 ? '#d6ccba' : d > 0.74 && d < 0.83 ? C.terracotta : '#e9e1d2';
    s.set(x, y, 0, c).set(x, y, -1, C.slab);
  }
  // walls, two voxels thick
  for (let i = -2; i < W; i++) for (let z = 1; z <= H; z++) for (const t of [-2, -1]) {
    const top = z === H, low = z <= 2 && t === -1;
    s.set(t, i, z, top ? C.cut : low ? C.trim : C.wallL);
    if (i >= 0 || t === -2) s.set(i, t, z, top ? C.cut : low ? C.trim : C.wallR);
  }
  for (let z = 1; z <= H; z++) s.set(-1, -1, z, z === H ? C.cut : C.wallL);

  // window in the left wall: a real opening, so light comes through it
  const skyTop = night ? [20, 27, 58] : [150, 198, 234], skyBot = night ? [44, 54, 100] : [220, 236, 247];
  for (let y = 20; y <= 48; y++) for (let z = 10; z <= 25; z++) {
    s.del(-1, y, z);
    const i = y - 20, t = (z - 10) / 15;
    let c = '#' + skyBot.map((b, k) => Math.round(b + (skyTop[k] - b) * t).toString(16).padStart(2, '0')).join('');
    if (z - 10 < skyline[i]) c = night ? (cityLit[i][z - 10] ? '#e3bd6a' : '#0f1428') : (cityLit[i][z - 10] ? '#93a7ba' : '#b3c1cf');
    s.set(-2, y, z, c, { glass: true, ex: c });
  }
  if (night) {
    stars.forEach(([i, z]) => { const v = s.get(-2, 20 + i, 10 + z); if (z >= skyline[i]) v.ex = '#cdd5f2'; });
    for (const [y, z] of [[27, 22], [28, 22], [27, 23], [28, 23], [26, 22], [27, 21]]) s.get(-2, y, z).ex = '#f3ecd2';
  } else {
    for (const [y0, y1, z] of [[23, 30, 22], [25, 29, 23], [38, 45, 20], [40, 44, 21]])
      for (let y = y0; y <= y1; y++) s.get(-2, y, z).ex = '#ffffff';
  }
  for (let z = 9; z <= 26; z++) { s.set(-1, 19, z, C.trim); s.set(-1, 49, z, C.trim); }
  for (let y = 19; y <= 49; y++) { s.set(-1, y, 9, C.trim); s.set(-1, y, 26, C.trim); s.set(-1, y, 18, C.trim); }
  for (let z = 10; z <= 25; z++) s.set(-1, 34, z, C.trim);
  s.box(0, 18, 9, 1, 50, 9, C.trim);
  s.box(0, 14, 28, 0, 54, 28, '#3a3530');
  const curtain = (x, y) => ((y + x) % 2 ? '#d9cdb8' : '#cbbfa9');
  s.box(0, 15, 6, 1, 18, 27, curtain).box(0, 50, 6, 1, 53, 27, curtain);

  // framed prints on the left wall
  s.box(0, 56, 13, 0, 63, 24, '#2b2824').box(0, 57, 14, 0, 62, 23, '#efe7d8');
  for (let y = 58; y <= 61; y++) for (let z = 17; z <= 20; z++) s.set(0, y, z, '#e9a0b4');
  s.set(0, 57, 18, '#d2708c').set(0, 62, 18, '#d2708c').set(0, 57, 20, '#d2708c').set(0, 62, 20, '#d2708c')
    .set(0, 59, 19, '#3a2a30').set(0, 61, 19, '#3a2a30').set(0, 60, 18, '#d2708c');
  s.box(0, 66, 15, 0, 71, 22, '#2b2824').box(0, 67, 16, 0, 70, 21, '#efe7d8')
    .box(0, 68, 18, 0, 69, 19, C.terracotta).box(0, 67, 16, 0, 70, 16, '#3f5f7a');

  // bed along the left wall
  s.box(1, 32, 1, 20, 33, 13, C.walnut).box(1, 34, 1, 20, 67, 3, C.walnut)
    .box(1, 34, 4, 20, 67, 6, '#f2efe9')
    .box(3, 35, 7, 9, 40, 8, '#fbf9f5').box(12, 35, 7, 18, 40, 8, '#fbf9f5')
    .box(1, 43, 7, 21, 68, 7, C.linen).box(21, 43, 3, 21, 68, 6, C.linen).box(1, 68, 3, 21, 68, 7, C.linen)
    .box(1, 43, 8, 21, 45, 8, '#efe6d6')
    .box(1, 62, 8, 21, 66, 8, C.terracotta).box(21, 62, 4, 21, 66, 7, C.terracotta);
  // nightstand
  s.box(23, 33, 1, 29, 39, 7, C.oak);
  for (let x = 23; x <= 29; x++) s.get(x, 39, 4).fy = '#8f6a43';
  s.get(26, 39, 6).fy = '#5a4630'; s.get(26, 39, 2).fy = '#5a4630';
  s.box(24, 34, 8, 28, 37, 8, '#3f5f7a').box(24, 34, 9, 27, 37, 9, '#e9e4da');

  // shelves on the right wall
  s.box(3, 0, 16, 19, 3, 16, C.oak).box(3, 0, 23, 19, 3, 23, C.oak);
  books1.forEach((b) => s.box(b.x, 0, 17, b.x + b.w - 1, 2, 16 + b.h, b.c));
  s.box(16, 1, 17, 18, 3, 18, '#e9e4da').ellipsoid(17.5, 2.5, 20.6, 2, 2, 1.8, C.leaf[1]);
  books2.forEach((b) => s.box(b.x, 0, 24, b.x + b.w - 1, 2, 23 + b.h, b.c));
  s.box(4, 1, 24, 6, 2, 25, '#3a3d46').set(5, 2, 24, '#3a3d46', { fy: '#9fb8c8' });
  // floor plant
  for (let x = 5; x <= 12; x++) for (let y = 6; y <= 13; y++) if (Math.hypot(x - 8.5, y - 9.5) <= 3.6) {
    for (let z = 1; z <= 6; z++) s.set(x, y, z, C.terracotta);
    if (Math.hypot(x - 8.5, y - 9.5) <= 2.6) s.set(x, y, 6, '#4a3a2c');
  }
  s.box(8, 9, 7, 9, 10, 11, '#4f6b45')
    .ellipsoid(9, 10, 13, 4.6, 4.6, 3.4, C.leaf[0]).ellipsoid(6.5, 12.5, 16, 3, 3, 2.4, C.leaf[1])
    .ellipsoid(11.5, 8, 17.5, 3.2, 3, 2.6, C.leaf[2]).ellipsoid(8.5, 10.5, 20.5, 2.4, 2.4, 2, C.leaf[1]);

  // white desk
  s.box(22, 0, 12, 60, 13, 13, C.white).box(22, 1, 1, 23, 12, 11, '#e6e3dd').box(59, 1, 1, 60, 12, 11, '#e6e3dd')
    .box(48, 2, 1, 58, 12, 11, '#eceae5');
  for (let x = 48; x <= 58; x++) for (const z of [4, 8]) s.get(x, 12, z).fy = '#cbc7bf';
  for (const z of [2, 6, 10]) for (let x = 52; x <= 54; x++) s.get(x, 12, z).fy = '#8c8880';
  s.box(24, 3, 1, 27, 11, 10, C.dark);
  s.get(25, 11, 9).ey = '#cfe6ff';
  for (const z of [3, 5, 7]) for (let x = 24; x <= 27; x++) s.get(x, 11, z).fy = '#16171b';

  // monitors: the +y faces are the screens
  const BEZEL = '#15161a';
  s.box(26, 2, 16, 43, 2, 27, '#1c1d22').box(34, 2, 14, 35, 2, 15, '#1c1d22').box(31, 1, 14, 38, 4, 14, '#1c1d22');
  for (let x = 26; x <= 43; x++) for (let z = 16; z <= 27; z++) {
    const i = x - 27, r = 26 - z, v = s.get(x, 2, z);
    if (i < 0 || i > 15 || r < 0 || r > 9) { v.fy = BEZEL; continue; }
    let c = '#1e2029';
    if (i < 3) c = i === 1 && r % 2 === 0 && r < 8 ? '#4b5263' : '#181a21';
    else if (i === 3) c = '#2c303a';
    else {
      const row = codeRows[(r + (st.code || 0)) % codeRows.length];
      if (row) { let p = 5 + row.indent; for (const seg of row.segs) { if (i >= p && i < p + seg.w && p + seg.w <= 16) c = seg.c; p += seg.w + 1; } }
    }
    v.ey = c;
  }
  s.box(47, 2, 16, 56, 2, 29, '#1c1d22').box(51, 2, 14, 52, 2, 15, '#1c1d22').box(49, 1, 14, 54, 4, 14, '#1c1d22');
  for (let x = 47; x <= 56; x++) for (let z = 16; z <= 29; z++) {
    const i = x - 48, r = 28 - z, v = s.get(x, 2, z);
    if (i < 0 || i > 7 || r < 0 || r > 11) { v.fy = BEZEL; continue; }
    const row = termRows[(r + (st.term || 0)) % termRows.length];
    v.ey = r % 2 ? '#1b1d24' : i === 0 ? (row.ok ? '#98c379' : '#e06c75') : i >= 2 && i < 2 + row.w ? '#5f6675' : '#1b1d24';
  }
  // desk lamp, keyboard, mouse, mug, notebook
  s.box(23, 2, 14, 25, 4, 14, '#2b2d33').box(24, 3, 15, 24, 3, 25, '#2b2d33').box(24, 4, 25, 24, 7, 25, '#2b2d33')
    .box(23, 7, 23, 25, 10, 24, '#2b2d33');
  s.box(24, 8, 22, 24, 9, 22, night ? '#ffe2a6' : '#d8d2c6', night ? { e: true } : undefined);
  s.box(29, 8, 14, 37, 11, 14, (x, y) => ((x + y) % 2 ? '#3b3e47' : '#30333b'));
  s.box(40, 9, 14, 41, 10, 14, '#e9e6df').box(45, 7, 14, 46, 8, 16, C.terracotta).box(50, 8, 14, 54, 11, 14, '#2f4858');

  // office chair
  for (let k = 0; k < 5; k++) {
    const a = k * 2 * Math.PI / 5 + 0.3;
    for (let r = 0; r <= 5; r++) s.set(Math.round(32.5 + r * Math.cos(a)), Math.round(23 + r * Math.sin(a)), 2, C.dark);
    s.set(Math.round(32.5 + 5 * Math.cos(a)), Math.round(23 + 5 * Math.sin(a)), 1, C.black);
  }
  s.box(32, 22, 3, 33, 23, 6, C.metal).box(28, 18, 7, 37, 27, 8, '#3b3f4a')
    .box(28, 28, 9, 37, 29, 20, '#30333c').box(27, 20, 11, 27, 26, 11, C.dark).box(38, 20, 11, 38, 26, 11, C.dark)
    .box(27, 23, 9, 27, 23, 10, C.dark).box(38, 23, 9, 38, 23, 10, C.dark);
  for (const x of [28, 37]) for (const z of [9, 20]) { s.del(x, 28, z); s.del(x, 29, z); }

  // developer: red hoodie, black headphones
  s.box(29, 13, 9, 31, 22, 10, '#2c3447').box(34, 13, 9, 36, 22, 10, '#2c3447')
    .box(29, 13, 3, 31, 14, 8, '#2c3447').box(34, 13, 3, 36, 14, 8, '#2c3447')
    .box(29, 11, 1, 31, 14, 2, '#e9e6df').box(34, 11, 1, 36, 14, 2, '#e9e6df')
    .box(29, 21, 11, 36, 26, 19, C.red).box(28, 21, 17, 37, 26, 19, C.red)
    .box(27, 20, 14, 28, 25, 18, C.red).box(37, 20, 14, 38, 25, 18, C.red)
    .box(28, 12, 14, 29, 20, 15, C.red).box(36, 12, 14, 37, 20, 15, C.red)
    .box(29, 10, 15, 30, 11, 15, C.skin).box(35, 10, 15, 36, 11, 15, C.skin)
    .box(30, 26, 16, 35, 27, 20, C.redDark).box(31, 22, 20, 34, 24, 20, C.skin)
    .ellipsoid(33, 23.5, 24.6, 4.1, 4.1, 4.1, (x, y, z) => (z >= 26 || y >= 24 ? C.hair : C.skin));
  for (let x = 27; x <= 38; x++) for (let z = 24; z <= 31; z++) {
    const r = Math.hypot(x + 0.5 - 33, z + 0.5 - 24.6);
    if (r > 4.3 && r < 5.5 && z >= 26) s.box(x, 23, z, x, 24, z, C.black);
  }
  s.box(28, 22, 22, 28, 25, 26, C.black).box(37, 22, 22, 37, 25, 26, C.black);
  for (let y = 23; y <= 24; y++) for (let z = 23; z <= 25; z++) s.get(37, y, z).fx = '#34363e';

  // server rack
  s.box(63, 0, 1, 71, 9, 24, '#282a31').box(65, 2, 25, 69, 6, 25, '#e9e6df').box(69, 6, 26, 69, 6, 28, '#3a3d46');
  for (let z = 3; z <= 22; z += 3) {
    for (let x = 64; x <= 70; x++) s.get(x, 9, z).fy = '#1b1d22';
    const u = (z - 3) / 3;
    s.get(65, 9, z + 1).ey = '#7bd88f';
    if (u % 2 === 0) s.get(67, 9, z + 1).ey = (st.led === u) ? '#3a3d46' : (u === 4 ? '#e5c07b' : '#9fc5e8');
  }

  // helper robot on the rug
  s.box(50, 43, 1, 51, 47, 2, '#2b2d33').box(55, 43, 1, 56, 47, 2, '#2b2d33')
    .box(50, 42, 3, 56, 48, 9, '#eceae4').box(52, 44, 10, 54, 46, 10, C.metal).box(51, 43, 11, 55, 47, 15, '#eceae4')
    .set(53, 45, 16, C.metal).set(53, 45, 17, C.terracotta);
  for (const [x, y] of [[50, 42], [56, 42], [50, 48], [56, 48]]) for (let z = 3; z <= 9; z++) s.del(x, y, z);
  for (let x = 51; x <= 55; x++) for (let z = 12; z <= 14; z++) s.get(x, 47, z).fy = '#22242b';
  for (const x of [52, 54]) s.get(x, 47, 13).ey = st.bot ? '#22242b' : '#9fdcf0';
  s.get(53, 48, 6).fy = C.terracotta;

  return s;
}

// ---------- the cat: a hand-drawn sprite, because a round face does not survive voxelisation ----------
// A blue British Shorthair as one round blob. o outline, b base, l light, d shade,
// m muzzle and paws, e copper iris, p pupil, w highlight, n nose, i ear and blush.
const CAT = [
  '....oo..............oo....',
  '...olbo............oblo...',
  '..olibbo..........obbilo..',
  '..olibbboooooooooobbbilo..',
  '.olbbbbbllllllllllbbbbblo.',
  '.olbbbbbbbbbbbbbbbbbbbbbo.',
  'olbbbbbbbbbbbbbbbbbbbbbbbo',
  'olbbbbbbbbbbbbbbbbbbbbbbbo',
  'obbbbweebbbbbbbbbbweebbbbo',
  'obbbbepebbbbbbbbbbepebbbbo',
  'obbbbeeebbbbnnbbbbeeebbbbo',
  'obbbbbbbbmmmnnmmmbbbbbbbbo',
  'obbiibbbmmmmmmmmmmbbbiibbo',
  'obbbbbbbbmmmmmmmmbbbbbbbbo',
  'odbbbbbbbbbbbbbbbbbbbbbbdo',
  'oddbbbbbbbbbbbbbbbbbbbbddo',
  '.odddbbbbbbbbbbbbbbbbdddo.',
  '.oddddmmmddddddddmmmddddo.',
  '..oodommmodddddddommmodoo.',
  '....ooooooooooooooooooo...',
];
const CAT_BLINK = { 8: 'obbbbbbbbbbbbbbbbbbbbbbbbo', 9: 'obbbbooobbbbbbbbbboooobbbo'.slice(0, 18) + 'ooobbbbo', 10: 'obbbbbbbbbbbnnbbbbbbbbbbbo' };
const CAT_PAL = {
  light: { o: '#55617a', b: '#97a5ba', l: '#b7c3d6', d: '#7b89a0', m: '#c6d0df', e: '#eba93c', p: '#2a2320', w: '#ffffff', n: '#e0a0a8', i: '#c9a3b4' },
  dark: { o: '#262c40', b: '#5d6987', l: '#7583a3', d: '#49546f', m: '#8794b1', e: '#d9a047', p: '#17151b', w: '#e8ecf5', n: '#b98793', i: '#8a7896' },
};
const CAT_X = 349, CAT_Y = 108;
const catSprite = (theme, rows) => {
  const c = new Canvas();
  Object.entries(rows).forEach(([j, row]) => [...row].forEach((ch, i) => {
    if (ch !== '.') c.set(CAT_X + i, CAT_Y + Number(j), CAT_PAL[theme][ch]);
  }));
  return c.svg();
};
CAT.forEach((r) => { if (r.length !== 26) throw new Error(`cat row length ${r.length}: ${r}`); });
Object.values(CAT_BLINK).forEach((r) => { if (r.length !== 26) throw new Error(`blink row length ${r.length}: ${r}`); });

// ---------- lighting ----------
const LIGHTS = {
  dark: {
    ambient: [0.40, 0.44, 0.60],
    lights: [
      { dir: [-1, -0.55, 0.6], color: [0.50, 0.62, 0.95], soft: 0.05, windowed: true },
      { dir: [0.35, 0.5, 1], color: [0.12, 0.14, 0.2], soft: 0.08 },
      { pos: [24.5, 8.5, 20.5], color: [1.5, 1.05, 0.55], radius: 34 },
      { pos: [34.5, 7, 21.5], color: [0.5, 0.65, 0.95], radius: 24 },
      { pos: [51.5, 6, 22.5], color: [0.3, 0.4, 0.6], radius: 16 },
    ],
  },
  light: {
    ambient: [0.68, 0.69, 0.72],
    lights: [
      { dir: [-1, -0.55, 0.6], color: [1.0, 0.9, 0.7], soft: 0.04, windowed: true },
      { dir: [0.35, 0.5, 1], color: [0.3, 0.3, 0.3], soft: 0.08 },
    ],
  },
};
const THEME = {
  dark: { ink: '#f0ede6', mute: '#a09c93', accent: '#e0a458', shadow: 0.45 },
  light: { ink: '#1f1d1a', mute: '#6b675f', accent: '#b8763a', shadow: 0.14 },
};
const project = (x, y, z) => [(OX + 2 * (x - y)) * S, (OY + x + y - 2 * z + 2) * S];

function build(theme) {
  const night = theme === 'dark';
  const cache = new Map();
  const cfg = (useCache) => ({ ox: OX, oy: OY, ...LIGHTS[theme], ceiling: H, xMin: -2, cache: useCache ? cache : undefined });
  const base = renderLit(buildScene({}, night), cfg(true));
  const layers = [];
  const frame = (st, style, sameGeometry = true) =>
    layers.push(`<g class="fr" style="animation:${style}">${renderLit(buildScene(st, night), cfg(sameGeometry)).diff(base).svg()}</g>`);
  const cycle = (n, period, mk) => {
    for (let f = 1; f < n; f++) frame(mk(f), `cyc${n} ${period}s steps(1) ${(f * period / n).toFixed(2)}s infinite`);
  };
  cycle(7, 9.8, (f) => ({ code: f }));
  cycle(6, 13.2, (f) => ({ term: f }));
  frame({ bot: 1 }, 'blink 8.3s steps(1) -3s infinite');
  frame({ led: 0 }, 'cyc2 7s steps(1) 3.5s infinite');
  frame({ led: 2 }, 'cyc2 11s steps(1) 5.5s infinite');

  const t = THEME[theme];
  const [rcx, rcy] = project(W / 2, W / 2, 0);
  const glow = (id, [cx, cy], r, color, o) => [
    `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`];
  const glows = night ? [
    glow('gl', project(24.5, 8.5, 20), 120, '#ffc978', 0.34),
    glow('gm', project(35, 4, 21), 110, '#7fa8ff', 0.2),
  ] : [];

  return `<svg width="${GW * S}" height="${GH * S}" viewBox="0 0 ${GW * S} ${GH * S}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Zhuolun Li / Franklin</title>
<desc id="desc">Backend, infrastructure, AI agents and evals. Isometric pixel art of a room ${night ? 'at night' : 'in daylight'}: a developer in a red hoodie and black headphones at a white desk with two monitors, an oak floor, a server rack, a helper robot, and a round blue British Shorthair cat on the bed.</desc>
<style>
.fr{visibility:hidden}
@keyframes cyc2{0%{visibility:visible}50%,100%{visibility:hidden}}
@keyframes cyc6{0%{visibility:visible}16.67%,100%{visibility:hidden}}
@keyframes cyc7{0%{visibility:visible}14.29%,100%{visibility:hidden}}
@keyframes blink{0%,100%{visibility:hidden}60%{visibility:visible}63%{visibility:hidden}}
.breathe{animation:br 4s steps(1) infinite}@keyframes br{50%{transform:translateY(-1px)}}
.lamp{animation:lamp 7s ease-in-out infinite alternate}@keyframes lamp{to{opacity:.82}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
<radialGradient id="under" cx="${rcx}" cy="${rcy + 86}" r="330" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${(rcy + 86) * 0.86}) scale(1 0.14)"><stop stop-color="#000" stop-opacity="${t.shadow}"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
${glows.map((g) => g[0]).join('\n')}
</defs>
<ellipse cx="${rcx}" cy="${rcy + 86}" rx="330" ry="46" fill="url(#under)"/>
<g transform="scale(${S})" shape-rendering="crispEdges">
${base.svg()}
${layers.join('\n')}
</g>
<ellipse cx="${(CAT_X + 13) * S}" cy="${(CAT_Y + 19) * S}" rx="30" ry="7" fill="#000" opacity="${night ? 0.35 : 0.2}"/>
<g transform="scale(${S})" shape-rendering="crispEdges">
<g class="breathe">${catSprite(theme, CAT)}<g class="fr" style="animation:blink 5.7s steps(1) infinite">${catSprite(theme, CAT_BLINK)}</g></g>
</g>
${glows.length ? `<g class="lamp" style="mix-blend-mode:screen">${glows.map((g) => g[1]).join('')}</g>` : ''}
<g font-family="${FONT}">
<rect x="60" y="150" width="36" height="3" rx="1.5" fill="${t.accent}"/>
<text x="60" y="226" fill="${t.ink}" font-size="68" font-weight="700" letter-spacing="-1.6">Zhuolun Li</text>
<text x="60" y="290" fill="${t.mute}" font-size="52" font-weight="300" letter-spacing="-0.8">Franklin</text>
<text x="62" y="340" fill="${t.mute}" font-size="15" font-weight="600" letter-spacing="2.6">BACKEND  ·  INFRA  ·  AI AGENTS  ·  EVALS</text>
</g>
</svg>
`;
}

for (const theme of ['dark', 'light']) {
  const svg = build(theme);
  const out = fileURLToPath(new URL(`../assets/banner-${theme}.svg`, import.meta.url));
  writeFileSync(out, svg);
  console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`);
}
