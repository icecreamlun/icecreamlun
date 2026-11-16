// Generates assets/banner.svg: an isometric voxel room rendered as pixel art.
// The room is a real 3D voxel model. It is rasterised here onto a 400x140 cell
// grid (3px cells) with a painter's algorithm; every animation frame is rendered
// the same way and stored as a diff layer toggled by CSS, because GitHub strips
// scripts from READMEs.
// Usage: node scripts/gen-banner.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Canvas, F3, F5, makeRand, makeVoxels, renderIso, shade } from './voxel.mjs';

const GW = 400, GH = 146, S = 3;      // grid cells and cell size in px
const W = 44, D = 44, H = 22;         // room size in voxels
const OX = 293, OY = 2 * H + 5;       // screen cell of the room's back corner

const { rand, ri, pick } = makeRand(11);

// ---------- palette ----------
const P = {
  cyan: '#7df9ff', pink: '#ff6fb1', green: '#34d399', amber: '#fbbf24', red: '#f87171',
  wall: '#34386f', wallLow: '#262a57', floorA: '#c99a6b', floorB: '#bd8d5e', slab: '#7a5536',
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
  const { vox, set, box } = makeVoxels();
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
  const CAT = '#8795ab', CAT_D = '#6c7a91';
  box(3, 37, 5, 8, 42, 7, CAT);
  if (st.cat) box(4, 38, 8, 7, 41, 8, CAT);
  box(2, 39, 5, 2, 42, 5, CAT_D);
  box(8, 39, 5, 12, 42, 8, CAT);
  set(8, 42, 9, CAT_D); set(12, 42, 9, CAT_D);
  set(9, 42, 7, CAT, { fy: st.catBlink ? CAT_D : '#f0a030' }); set(11, 42, 7, CAT, { fy: st.catBlink ? CAT_D : '#f0a030' });
  set(10, 42, 6, CAT, { fy: '#4d596d' });

  // shelf, books and plant on the right wall
  box(2, 1, 11, 13, 2, 11, P.wood);
  books.forEach((b, i) => box(3 + i, 1, 12, 3 + i, 2, 11 + b.h, b.c));
  box(2, 2, 1, 4, 4, 2, '#b8643e');
  box(2, 2, 3, 4, 4, 5, '#2f9e6a'); box(3, 3, 6, 3, 3, 7, '#3fc487'); set(1, 3, 5, '#3fc487'); set(5, 3, 4, '#2f9e6a'); set(3, 5, 4, '#3fc487');

  // desk (white)
  box(15, 1, 7, 38, 8, 7, '#eef0f7');
  box(15, 1, 1, 15, 1, 6, '#c5c9da'); box(15, 8, 1, 15, 8, 6, '#c5c9da'); box(38, 8, 1, 38, 8, 6, '#c5c9da');
  box(32, 2, 3, 37, 8, 6, '#dfe2ee');
  set(34, 8, 5, '#dfe2ee', { fy: '#8b93c9' }); set(35, 8, 5, '#dfe2ee', { fy: '#8b93c9' });
  box(16, 2, 1, 18, 6, 5, P.dark);
  for (let z = 2; z <= 4; z++) set(17, 6, z, P.dark, { fy: st.rgb ? P.pink : P.cyan });
  // monitors: screens are the +y faces
  box(22, 2, 8, 23, 2, 8, P.dark); box(31, 2, 8, 33, 2, 8, P.dark);
  for (let i = 0; i < 7; i++) for (let r = 0; r < 5; r++) {       // code
    const row = codeRows[(r + (st.code || 0)) % codeRows.length];
    const col = i < row.indent ? '#0b1022' : i < row.indent + row.a ? row.c1 : i < row.indent + row.a + row.b ? '#4a5aa8' : '#0b1022';
    set(19 + i, 2, 13 - r, P.dark, { fy: col });
  }
  for (let i = 0; i < 10; i++) for (let r = 0; r < 6; r++) {       // run log
    const row = logRows[(r + (st.log || 0)) % logRows.length];
    const col = i === 0 ? (row.ok ? P.green : P.red) : i >= 2 && i < 2 + row.w ? (row.ok ? '#4a5aa8' : '#b85c6e') : '#0b1022';
    set(27 + i, 2, 14 - r, P.dark, { fy: col });
  }
  box(18, 2, 14, 26, 2, 14, '#2a2d55'); box(18, 2, 9, 18, 2, 13, '#2a2d55'); box(26, 2, 9, 26, 2, 15, '#2a2d55');
  box(26, 2, 15, 37, 2, 15, '#2a2d55'); box(37, 2, 9, 37, 2, 15, '#2a2d55');
  box(19, 5, 8, 23, 6, 8, '#3a3f66');
  set(26, 6, 8, P.green); set(26, 6, 9, P.green);

  // chair and person, facing the desk
  box(21, 12, 1, 22, 13, 3, P.dark);
  box(19, 12, 1, 24, 13, 1, P.dark); box(21, 10, 1, 22, 15, 1, P.dark);
  box(19, 10, 4, 24, 14, 4, '#2e3257');
  box(19, 15, 5, 24, 15, 8, '#4a5088');
  box(20, 8, 5, 23, 11, 5, '#2b3a67');
  box(20, 11, 6, 23, 13, 9, '#d63a3a');
  box(20, 8, 8, 20, 10, 8, '#d63a3a'); box(23, 8, 8, 23, 10, 8, '#d63a3a');
  box(20, 11, 10, 23, 13, 13, '#3b2c35');
  set(23, 11, 10, '#e8b796'); set(23, 11, 11, '#e8b796');
  box(20, 12, 14, 23, 12, 14, '#0b0b10');
  box(24, 12, 11, 24, 12, 13, '#0b0b10'); box(19, 12, 11, 19, 12, 13, '#0b0b10');

  // server rack
  box(40, 1, 1, 43, 5, 15, '#171a36');
  rackLeds.forEach((l, i) => {
    const z = 2 + i * 2;
    set(40, 5, z, '#171a36', { fy: off(l.b1) ? '#0a3d2a' : P.green });
    set(41, 5, z, '#171a36', { fy: off(l.b2) ? shade(l.c, 0.3) : l.c });
    set(43, 5, z, '#171a36', { fy: '#0a0b18' });
  });

  // neon sign above the desk
  const neonC = st.neonDim ? '#7a3558' : '#ff7ab8';
  'SHIP IT'.split('').forEach((ch, n) => (F3[ch] || []).forEach((row, j) => [...row].forEach((bit, i) => {
    if (bit === '#') set(14 + n * 4 + i, 0, 20 - j, P.wall, { fy: neonC });
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
  box(34, 26, 1, 35, 27, 1, P.dark); box(37, 26, 1, 38, 27, 1, P.dark); box(34, 29, 1, 35, 30, 1, P.dark); box(37, 29, 1, 38, 30, 1, P.dark);
  box(34, 26, 2, 38, 30, 4, '#aab2d5');
  box(35, 27, 5, 37, 29, 7, '#d7dcf5');
  set(35, 29, 6, '#d7dcf5', { fy: st.botBlink ? '#d7dcf5' : P.cyan }); set(37, 29, 6, '#d7dcf5', { fy: st.botBlink ? '#d7dcf5' : P.cyan });
  set(36, 30, 3, '#aab2d5', { fy: P.amber });
  set(36, 28, 8, '#59607f'); set(36, 28, 9, st.botBlink ? '#7a2b2b' : P.red, { e: true });

  return vox;
}

const render = (vox) => renderIso(vox, OX, OY);
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
frame({ catBlink: 1 }, 'fr', 'animation:flick 5.1s steps(1) -1s infinite');

// ---------- left-hand text and sky ----------
const neon1 = new Canvas().glyphs(F5, 5, 14, 22, 'ZHUOLUN LI', '#aefcff', 3);
const neon2 = new Canvas().glyphs(F5, 5, 14, 50, 'FRANKLIN', '#ff8cc3', 3);
const tag = new Canvas()
  .glyphs(F3, 3, 14, 84, 'BACKEND + INFRA', '#c9d2ff', 2)
  .glyphs(F3, 3, 14, 99, 'AI AGENTS + EVALS', '#8b93c9', 2);
const cursor = new Canvas().rect(152, 99, 6, 10, P.green);
const starBuckets = Array.from({ length: 4 }, () => new Canvas());
for (let i = 0; i < 90; i++) pick(starBuckets).set(ri(0, GW - 1), ri(0, GH - 1), pick(['#3b4380', '#5b64a8', '#8b93c9', '#c9d2ff']));
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
const [rcx, rcy] = project(W / 2, D / 2, 0);

const svg = `<svg width="${GW * S}" height="${GH * S}" viewBox="0 0 ${GW * S} ${GH * S}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
<title id="title">Zhuolun Li / Franklin</title>
<desc id="desc">Isometric pixel art of a developer's room at night: a developer in a red hoodie at a white desk with two monitors, a neon sign, a rotating hologram, a helper robot, a server rack, and a blue British Shorthair cat on the bed.</desc>
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
</g>
<g style="mix-blend-mode:screen">${glowEls.slice(2).join('')}</g>
</g>
</g>
</svg>
`;

const out = fileURLToPath(new URL('../assets/banner.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB, ${layers.length} animation layers`);
